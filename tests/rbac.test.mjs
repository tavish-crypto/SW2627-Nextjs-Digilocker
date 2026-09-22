import test from "node:test";
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_STORAGE_BUCKET = "local";
process.env.AUTH_SECRET = "test-auth-secret-for-jwt-signing";
process.env.AUTH_GOOGLE_ID = "test-google-client-id-env.apps.googleusercontent.com";
process.env.AUTH_GOOGLE_SECRET = "test-google-client-secret-env";

const { authConfig } = await import("../src/auth.config.js");
const {
  createUser,
  findOrCreateGoogleUser,
  getUserByEmail,
  setUserRole,
  hasRole,
  requireRole,
  createSessionToken,
  verifySessionToken,
  ROLES,
} = await import("../src/lib/auth.js");
const { proxy, resolveRequestAuthState } = await import("../src/proxy.js");
const { updateUserRoleAction, purgeAuditLogsAction } = await import("../src/app/admin/actions.js");
const { getDocuments, createDocument } = await import("../src/lib/documents.js");

function createMockRequest(pathname, { sessionToken } = {}) {
  const url = `http://localhost:3000${pathname}`;
  return {
    url,
    nextUrl: new URL(url),
    cookies: {
      get(name) {
        if (name === "digilocker-session" && sessionToken) {
          return { value: sessionToken };
        }
        return undefined;
      },
    },
  };
}

test("Role Model, Least Privilege & Escalation Prevention", async (t) => {
  await t.test("createUser assigns 'user' role by default", async () => {
    const email = `test-user-${Date.now()}@example.com`;
    const user = await createUser({
      email,
      password: "password-12345",
      name: "Default User",
    });

    assert.equal(user.role, ROLES.USER);
    const stored = getUserByEmail(email);
    assert.equal(stored.role, ROLES.USER);
  });

  await t.test("createUser rejects or ignores client-submitted role='admin'", async () => {
    const email = `escalate-attempt-${Date.now()}@example.com`;
    const user = await createUser({
      email,
      password: "password-12345",
      name: "Attacker",
      role: "admin", // Malicious attempt to escalate
    });

    assert.equal(user.role, ROLES.USER, "New user must strictly default to lowest privilege 'user'");
    const stored = getUserByEmail(email);
    assert.equal(stored.role, ROLES.USER, "Persisted role must remain 'user'");
  });

  await t.test("findOrCreateGoogleUser assigns 'user' role by default for new OAuth accounts", () => {
    const email = `google-user-${Date.now()}@example.com`;
    const googleUser = findOrCreateGoogleUser({
      id: `google-uid-${Date.now()}`,
      email,
      name: "New OAuth User",
      role: "admin", // Untrusted input
    });

    assert.equal(googleUser.role, ROLES.USER);
    const stored = getUserByEmail(email);
    assert.equal(stored.role, ROLES.USER);
  });

  await t.test("setUserRole properly updates trusted role in authoritative store", async () => {
    const email = `target-user-${Date.now()}@example.com`;
    await createUser({
      email,
      password: "password-12345",
      name: "Target User",
    });

    const updated = setUserRole(email, ROLES.ADMIN);
    assert.equal(updated.role, ROLES.ADMIN);
    assert.equal(getUserByEmail(email).role, ROLES.ADMIN);

    assert.throws(
      () => setUserRole(email, "superadmin"),
      /Invalid role/,
      "Must reject unapproved arbitrary roles"
    );
  });

  await t.test("hasRole helper validates role equality", () => {
    assert.equal(hasRole("admin", ROLES.ADMIN), true);
    assert.equal(hasRole("user", ROLES.ADMIN), false);
    assert.equal(hasRole({ role: "admin" }, ROLES.ADMIN), true);
    assert.equal(hasRole({ role: "user" }, ROLES.ADMIN), false);
  });
});

test("JWT & Session Role Propagation", async (t) => {
  await t.test("jwt callback copies trusted user role into token", async () => {
    const email = `jwt-admin-${Date.now()}@example.com`;
    await createUser({ email, password: "password-12345", name: "JWT Admin" });
    setUserRole(email, ROLES.ADMIN);

    const token = await authConfig.callbacks.jwt({
      token: {},
      user: { id: "u-jwt-1", email, name: "JWT Admin" },
    });

    assert.equal(token.role, ROLES.ADMIN);
    assert.equal(token.email, email);
  });

  await t.test("jwt callback safely defaults to 'user' for new or untyped tokens", async () => {
    const token = await authConfig.callbacks.jwt({
      token: {},
      user: { id: "u-jwt-2", email: "unknown@example.com", name: "Unknown" },
    });

    assert.equal(token.role, ROLES.USER);
  });

  await t.test("session callback exposes role on session.user", async () => {
    const session = {
      user: {},
      expires: new Date(Date.now() + 86400000).toISOString(),
    };
    const token = {
      userId: "u-sess-1",
      email: "sess@example.com",
      name: "Sess User",
      role: ROLES.ADMIN,
    };

    const result = await authConfig.callbacks.session({ session, token });
    assert.equal(result.user.id, "u-sess-1");
    assert.equal(result.user.email, "sess@example.com");
    assert.equal(result.user.name, "Sess User");
    assert.equal(result.user.role, ROLES.ADMIN);
    assert.equal(result.user.password, undefined);
    assert.equal(result.user.passwordHash, undefined);
  });

  await t.test("signed session cookie token includes role and verifies correctly", async () => {
    const email = `cookie-admin-${Date.now()}@example.com`;
    const user = await createUser({ email, password: "password-12345", name: "Cookie Admin" });
    setUserRole(email, ROLES.ADMIN);

    const adminUser = getUserByEmail(email);
    const token = createSessionToken(adminUser);
    const verified = verifySessionToken(token);

    assert.ok(verified);
    assert.equal(verified.email, email);
    assert.equal(verified.role, ROLES.ADMIN);
  });
});

test("Route-Level Authorization via Proxy (Next.js 16)", async (t) => {
  await t.test("unauthenticated access to /admin redirects to /login", async () => {
    const req = createMockRequest("/admin");
    const res = await proxy(req);

    assert.equal(res.status, 307);
    const location = res.headers.get("location");
    assert.ok(location.includes("/login"), "Unauthenticated user must be redirected to /login");
    assert.ok(location.includes("callbackUrl=%2Fadmin"), "Redirect URL should preserve destination callback");
  });

  await t.test("authenticated regular user access to /admin redirects to /forbidden", async () => {
    const email = `regular-user-${Date.now()}@example.com`;
    const user = await createUser({ email, password: "password-12345", name: "Regular" });
    const token = createSessionToken(user);

    const req = createMockRequest("/admin", { sessionToken: token });
    const res = await proxy(req);

    assert.equal(res.status, 307);
    const location = res.headers.get("location");
    assert.ok(location.includes("/forbidden"), "Authenticated regular user must be redirected to /forbidden (403)");
  });

  await t.test("authenticated admin access to /admin is allowed through", async () => {
    const email = `admin-allowed-${Date.now()}@example.com`;
    const user = await createUser({ email, password: "password-12345", name: "Admin" });
    setUserRole(email, ROLES.ADMIN);
    const adminToken = createSessionToken(getUserByEmail(email));

    const req = createMockRequest("/admin", { sessionToken: adminToken });
    const res = await proxy(req);

    assert.equal(res.status, 200, "Admin request should be allowed through to destination");
  });

  await t.test("Google OAuth session is accepted for protected vault routes", async () => {
    const req = createMockRequest("/dashboard");
    const authState = await resolveRequestAuthState(req, async () => ({
      user: {
        email: "google-user@example.com",
        name: "Google User",
        role: "user",
      },
    }));

    assert.equal(authState.isAuthenticated, true, "Google sessions should count as authenticated");
    assert.equal(authState.user.email, "google-user@example.com");
  });

  await t.test("non-admin routes are unaffected by proxy", async () => {
    const req = createMockRequest("/documents");
    const res = await proxy(req);

    assert.equal(res.status, 200, "Non-admin route should pass through unaffected");
  });
});

test("Server Boundary Authorization & Privileged Server Operations", async (t) => {
  await t.test("requireRole('admin') rejects when no user is authenticated", async () => {
    await assert.rejects(
      () => requireRole(ROLES.ADMIN),
      (err) => err.statusCode === 401 || err.message.includes("Unauthorized")
    );
  });

  await t.test("privileged Server Actions reject unauthorized callers", async () => {
    const formData = new FormData();
    formData.append("email", "someuser@example.com");
    formData.append("role", "admin");

    const result = await updateUserRoleAction(null, formData);
    assert.equal(result.success, false);
    assert.ok(result.error.includes("Unauthorized") || result.error.includes("Authentication required"));
  });

  await t.test("privileged maintenance action rejects unauthorized callers", async () => {
    const result = await purgeAuditLogsAction(null, new FormData());
    assert.equal(result.success, false);
    assert.ok(result.error.includes("Unauthorized") || result.error.includes("Authentication required"));
  });
});

test("Preservation of Existing Vault & Document Functionality", async (t) => {
  await t.test("vault documents can be fetched without requiring admin role", async () => {
    const docs = await getDocuments();
    assert.ok(Array.isArray(docs));
    assert.ok(docs.length > 0);
  });

  await t.test("vault document creation works independently of RBAC", async () => {
    const newDoc = await createDocument({
      title: "RBAC Compatibility Test Doc",
      type: "PDF",
      description: "Testing vault operations with RBAC enabled",
    });

    assert.ok(newDoc.id);
    assert.equal(newDoc.title, "RBAC Compatibility Test Doc");
  });
});
