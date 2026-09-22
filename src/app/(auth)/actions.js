"use server";

import { cookies } from "next/headers.js";
import { redirect } from "next/navigation.js";
import {
  authenticateUser,
  createSessionToken,
  createUser,
  getSessionCookieName,
  getSessionCookieOptions,
} from "../../lib/auth.js";
import { setCookie, deleteCookie } from "../../lib/cookies.js";
import { createTraceId, getTraceId, logger } from "../../lib/logger.js";
import { signIn, signOut } from "../../auth.js";

function readFormValue(formData, name) {
  const value = formData?.get(name);
  return typeof value === "string" ? value : "";
}

async function startSession(user) {
  await setCookie(getSessionCookieName(), createSessionToken(user), getSessionCookieOptions());
}

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/dashboard" });
}

export async function register(formData) {
  const traceId = getTraceId() || createTraceId();
  const user = await createUser({
    name: readFormValue(formData, "name"),
    email: readFormValue(formData, "email"),
    password: readFormValue(formData, "password"),
  });
  await startSession(user);
  logger.info({ action: "auth.register_success", traceId, userId: user.id }, "User registration completed");
  redirect("/dashboard");
}

export async function login(formData) {
  const traceId = getTraceId() || createTraceId();
  const user = await authenticateUser({
    email: readFormValue(formData, "email"),
    password: readFormValue(formData, "password"),
  });
  await startSession(user);
  logger.info({ action: "auth.login_success", traceId, userId: user.id }, "User login completed");
  redirect("/dashboard");
}

export async function logout() {
  const traceId = getTraceId() || createTraceId();
  await deleteCookie(getSessionCookieName(), getSessionCookieOptions());
  try {
    await signOut({ redirect: false });
  } catch {
    // Graceful no-op when NextAuth session is inactive
  }
  logger.info({ action: "auth.logout", traceId }, "User logged out");
  redirect("/login");
}
