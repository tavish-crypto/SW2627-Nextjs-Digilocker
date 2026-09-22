import test from "node:test";
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_STORAGE_BUCKET = "local";

const {
  authenticateUser,
  createSessionToken,
  createUser,
  verifySessionToken,
} = await import("../src/lib/auth.js");

test("Credentials authentication hashes and verifies passwords", async () => {
  const user = await createUser({
    email: `auth-${Date.now()}@example.com`,
    password: "correct-horse",
    name: "Auth Test",
  });

  assert.equal(user.name, "Auth Test");
  assert.equal(user.email.startsWith("auth-"), true);
  await assert.doesNotReject(() => authenticateUser({ email: user.email, password: "correct-horse" }));
  await assert.rejects(
    () => authenticateUser({ email: user.email, password: "incorrect" }),
    /Invalid email or password/
  );
});

test("Session tokens are signed and contain an expiring user session", async () => {
  const user = await createUser({
    email: `session-${Date.now()}@example.com`,
    password: "correct-horse",
    name: "Session User",
  });
  const token = createSessionToken(user);
  const session = verifySessionToken(token);

  assert.equal(session.userId, user.id);
  assert.equal(session.email, user.email);
  assert.equal(session.name, "Session User");
  assert.equal(verifySessionToken(`${token}tampered`), null);
});
