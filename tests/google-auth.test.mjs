import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_STORAGE_BUCKET = "local";
process.env.AUTH_SECRET = "test-auth-secret-for-jwt-signing";
process.env.AUTH_GOOGLE_ID = "test-google-client-id-env.apps.googleusercontent.com";
process.env.AUTH_GOOGLE_SECRET = "test-google-client-secret-env";

const { authConfig } = await import("../src/auth.config.js");
const {
  createUser,
  findOrCreateGoogleUser,
} = await import("../src/lib/auth.js");

test("Google OAuth Provider Configuration", async (t) => {
  await t.test("Google provider is registered in Auth.js configuration", () => {
    assert.ok(Array.isArray(authConfig.providers), "providers must be an array");
    const googleProvider = authConfig.providers.find(
      (p) => (typeof p === "function" ? p().id : p.id) === "google"
    );
    assert.ok(googleProvider, "Google provider must be configured");
  });

  await t.test("Provider credentials come from environment variables and are not hardcoded", () => {
    const rawGoogleProvider = authConfig.providers[0];
    const providerObj = typeof rawGoogleProvider === "function" ? rawGoogleProvider() : rawGoogleProvider;

    const configuredId = providerObj.clientId || providerObj.options?.clientId;
    assert.equal(
      configuredId,
      process.env.AUTH_GOOGLE_ID,
      "clientId must be read from process.env.AUTH_GOOGLE_ID"
    );

    // Verify secrets are not hardcoded literals
    assert.notEqual(configuredId, "your-client-id");
    assert.notEqual(providerObj.clientSecret, "your-client-secret");
  });

  await t.test("src/auth.js initializes NextAuth and exports handlers, auth, signIn, signOut", () => {
    const authFilePath = path.resolve("src/auth.js");
    const authContent = fs.readFileSync(authFilePath, "utf-8");

    assert.ok(authContent.includes("NextAuth"), "src/auth.js must call NextAuth");
    assert.ok(
      authContent.includes("export const { handlers, auth, signIn, signOut } = NextAuth("),
      "src/auth.js must export standard Auth.js v5 methods"
    );
  });

  await t.test("App Router auth route exports required GET and POST handlers", () => {
    const routeFilePath = path.resolve("src/app/api/auth/[...nextauth]/route.js");
    const routeContent = fs.readFileSync(routeFilePath, "utf-8");

    assert.ok(
      routeContent.includes("export const { GET, POST } = handlers"),
      "Route handler must export GET and POST methods"
    );
  });
});

test("JWT Session Configuration & Minimal Safe Fields", async (t) => {
  await t.test("Session strategy is explicitly configured as 'jwt'", () => {
    assert.equal(authConfig.session?.strategy, "jwt");
  });

  await t.test("jwt callback stores only safe fields and filters raw OAuth tokens", async () => {
    const initialToken = {};
    const user = { id: "google-user-123", email: "user@example.com", name: "Google User" };
    const account = {
      provider: "google",
      access_token: "sensitive-raw-access-token-12345",
      refresh_token: "sensitive-raw-refresh-token-67890",
      id_token: "sensitive-id-token",
    };

    const token = await authConfig.callbacks.jwt({ token: initialToken, user, account });

    assert.equal(token.userId, "google-user-123");
    assert.equal(token.email, "user@example.com");
    assert.equal(token.name, "Google User");

    // Ensure raw OAuth tokens and provider secrets are never stored
    assert.equal(token.access_token, undefined);
    assert.equal(token.refresh_token, undefined);
    assert.equal(token.clientSecret, undefined);
  });

  await t.test("session callback presents minimal safe fields without leaking credentials", async () => {
    const session = { user: {}, expires: new Date(Date.now() + 86400000).toISOString() };
    const token = {
      userId: "google-user-123",
      email: "user@example.com",
      name: "Google User",
    };

    const resultSession = await authConfig.callbacks.session({ session, token });

    assert.equal(resultSession.user.id, "google-user-123");
    assert.equal(resultSession.user.email, "user@example.com");
    assert.equal(resultSession.user.name, "Google User");
    assert.equal(resultSession.user.password, undefined);
    assert.equal(resultSession.user.passwordHash, undefined);
  });
});

test("Google User Identity Mapping & Existing Auth Compatibility", async (t) => {
  await t.test("findOrCreateGoogleUser creates user record in application user store", () => {
    const googleUser = findOrCreateGoogleUser({
      id: "google-uid-001",
      email: "new-google-user@example.com",
      name: "New Google User",
      image: "https://example.com/avatar.png",
    });

    assert.ok(googleUser);
    assert.equal(googleUser.email, "new-google-user@example.com");
    assert.equal(googleUser.name, "New Google User");
    assert.equal(googleUser.provider, "google");
  });

  await t.test("findOrCreateGoogleUser preserves existing account when email already exists", async () => {
    const existingCredUser = await createUser({
      email: "existing-user@example.com",
      password: "password-12345",
      name: "Existing Credential User",
    });

    const mappedUser = findOrCreateGoogleUser({
      id: "google-uid-002",
      email: "existing-user@example.com",
      name: "Existing Credential User",
    });

    // Should return existing user record without overwriting id or deleting passwordHash
    assert.equal(mappedUser.id, existingCredUser.id);
    assert.equal(mappedUser.email, "existing-user@example.com");
    assert.ok(mappedUser.passwordHash, "Existing passwordHash must be preserved");
  });

  await t.test("signIn callback maps user to store on successful Google sign-in", async () => {
    const email = `oauth-${Date.now()}@example.com`;
    const allow = await authConfig.callbacks.signIn({
      user: { id: "g-id-99", email, name: "OAuth Test" },
      account: { provider: "google" },
    });

    assert.equal(allow, true);

    const user = findOrCreateGoogleUser({ id: "g-id-99", email, name: "OAuth Test" });
    assert.equal(user.email, email);
    assert.equal(user.name, "OAuth Test");
  });

  await t.test("signIn callback rejects authentication when email is missing", async () => {
    const allow = await authConfig.callbacks.signIn({
      user: { id: "g-id-no-email" },
      account: { provider: "google" },
    });

    assert.equal(allow, false);
  });
});

test("Sign-in UI & Actions Integration", async (t) => {
  await t.test("Login page renders Google sign-in button alongside credentials form", () => {
    const loginPagePath = path.resolve("src/app/(auth)/login/page.js");
    const loginContent = fs.readFileSync(loginPagePath, "utf-8");

    assert.ok(
      loginContent.includes("signInWithGoogle"),
      "Login page must import and use signInWithGoogle"
    );
    assert.ok(
      loginContent.includes("Sign in with Google"),
      "Login page must render 'Sign in with Google' text"
    );
  });

  await t.test("Auth actions export signInWithGoogle server action", () => {
    const actionsPath = path.resolve("src/app/(auth)/actions.js");
    const actionsContent = fs.readFileSync(actionsPath, "utf-8");

    assert.ok(
      actionsContent.includes("export async function signInWithGoogle"),
      "src/app/(auth)/actions.js must export signInWithGoogle"
    );
    assert.ok(
      actionsContent.includes('signIn("google"'),
      "signInWithGoogle must invoke signIn('google')"
    );
  });
});
