import bcrypt from "bcrypt";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers.js";
import { env } from "./env.js";
import prisma from "./prisma.js";
import { getDefaultCookieOptions } from "./cookies.js";
import { createTraceId, getTraceId, logger } from "./logger.js";

const SESSION_COOKIE = "digilocker-session";
const BCRYPT_ROUNDS = 12;

function getSessionSecret() {
  const secret = env.AUTH_SECRET || process.env.AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required in production.");
  }
  return "local-development-auth-secret";
}

export const ROLES = {
  USER: "user",
  ADMIN: "admin",
};

const ALLOWED_ROLES = new Set(Object.values(ROLES));

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(payload) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

export function createSessionToken(user) {
  const payload = encode({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role || ROLES.USER,
    expiresAt: Date.now() + env.AUTH_SESSION_EXPIRY_SECONDS * 1000,
  });
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token) {
  if (typeof token !== "string") return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expectedSignature = sign(payload);
  const received = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!session.userId || !session.email || session.expiresAt <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export function validateCredentials({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    throw new Error("A valid email address is required.");
  }
  if (typeof password !== "string" || password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  return { email: normalizedEmail, password };
}

export async function createUser({ email, password, name }) {
  const credentials = validateCredentials({ email, password });
  const existing = await prisma.user.findUnique({ where: { email: credentials.email } });
  if (existing) {
    throw new Error("An account with this email already exists.");
  }

  const user = await prisma.user.create({
    data: {
      email: credentials.email,
      name: typeof name === "string" && name.trim() ? name.trim() : credentials.email,
      passwordHash: await bcrypt.hash(credentials.password, BCRYPT_ROUNDS),
      role: ROLES.USER,
    },
  });

  logger.info({ action: "auth.register", traceId: getTraceId() || createTraceId(), userId: user.id, email: user.email }, "User registered");
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export async function authenticateUser({ email, password }) {
  const credentials = validateCredentials({ email, password });
  const user = await prisma.user.findUnique({ where: { email: credentials.email } });
  const passwordHash = user?.passwordHash || "$2b$12$invalidpasswordhashinvalidpasswordhashinvalidpasswordhash";
  const passwordMatches = await bcrypt.compare(credentials.password, passwordHash).catch(() => false);
  if (!user || !user.passwordHash || !passwordMatches) {
    logger.warn({ action: "auth.login_failed", traceId: getTraceId() || createTraceId(), email: credentials.email }, "Authentication failed");
    throw new Error("Invalid email or password.");
  }
  logger.info({ action: "auth.login", traceId: getTraceId() || createTraceId(), userId: user.id, email: user.email }, "User authenticated");
  return { id: user.id, email: user.email, name: user.name, role: user.role || ROLES.USER };
}

export async function findOrCreateGoogleUser({ id, email, name, image }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return prisma.user.update({
      where: { email: normalizedEmail },
      data: {
        provider: "google",
        name: existing.name || (typeof name === "string" && name.trim() ? name.trim() : normalizedEmail),
        image: existing.image || image || null,
      },
    });
  }

  return prisma.user.create({
    data: {
      ...(id ? { id } : {}),
      email: normalizedEmail,
      name: typeof name === "string" && name.trim() ? name.trim() : normalizedEmail,
      provider: "google",
      image: image || null,
      role: ROLES.USER,
    },
  });
}

export async function getUserByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  return prisma.user.findUnique({ where: { email: normalized } });
}

export async function setUserRole(email, role) {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error("A valid email address is required.");
  if (!ALLOWED_ROLES.has(role)) {
    throw new Error(`Invalid role: ${role}. Allowed roles are: ${Array.from(ALLOWED_ROLES).join(", ")}`);
  }
  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (!existing) throw new Error(`User not found: ${normalized}`);

  const user = await prisma.user.update({ where: { email: normalized }, data: { role } });
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export function hasRole(userOrRole, requiredRole) {
  const role = typeof userOrRole === "string" ? userOrRole : userOrRole?.role;
  return role === requiredRole;
}

export async function requireRole(requiredRole) {
  const user = await getCurrentUser();
  if (!user) {
    const error = new Error("Unauthorized: Authentication required.");
    error.statusCode = 401;
    throw error;
  }
  if (user.role !== requiredRole) {
    const error = new Error(`Forbidden: Access denied. Required role: ${requiredRole}.`);
    error.statusCode = 403;
    throw error;
  }
  return user;
}

export async function getCurrentUser() {
  try {
    const { auth } = await import("../auth.js");
    const nextAuthSession = await auth();
    if (nextAuthSession?.user?.email) {
      const dbUser = await getUserByEmail(nextAuthSession.user.email);
      if (dbUser) {
        return { id: dbUser.id, email: dbUser.email, name: dbUser.name, image: dbUser.image, role: dbUser.role || ROLES.USER };
      }
    }
  } catch {
    // Fall back to signed local session cookie below.
  }

  try {
    const cookieStore = await cookies();
    const session = verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
    if (!session) return null;
    const user = await getUserByEmail(session.email);
    if (!user) return null;
    return { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role || ROLES.USER };
  } catch {
    return null;
  }
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}

export function getSessionCookieOptions() {
  return getDefaultCookieOptions({ maxAge: env.AUTH_SESSION_EXPIRY_SECONDS });
}
