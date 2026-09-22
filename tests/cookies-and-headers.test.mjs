import test from "node:test";
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_STORAGE_BUCKET = "local";
process.env.AUTH_SECRET = "test-auth-secret-for-cookies-and-headers";
process.env.CORS_ALLOWED_ORIGINS = "http://localhost:3000,https://digilocker.gov.in";

const cookiesModule = await import("../src/lib/cookies.js");
const headersModule = await import("../src/lib/headers.js");
const { proxy } = await import("../src/proxy.js");
const { successResponse, errorResponse } = await import("../src/lib/api-validation.js");
const nextConfigModule = await import("../next.config.ts");

const {
  getDefaultCookieOptions,
  signCookieValue,
  verifySignedCookieValue,
  createSignedPayload,
  verifySignedPayload,
} = cookiesModule;

const {
  getStandardSecurityHeaders,
  NO_CACHE_HEADERS,
  getSecurityHeadersArray,
  getClientIp,
  getUserAgent,
  getBearerToken,
  getRequestTraceId,
  validateCsrfOrigin,
  applySecurityHeaders,
} = headersModule;

test("Secure Cookie Configuration & Defaults", async (t) => {
  await t.test("getDefaultCookieOptions provides OWASP recommended defaults", () => {
    const opts = getDefaultCookieOptions();
    assert.equal(opts.httpOnly, true, "Must set httpOnly to true to prevent XSS access");
    assert.equal(opts.sameSite, "lax", "Must default to sameSite=lax for CSRF mitigation");
    assert.equal(opts.path, "/", "Must be scoped to root path");
    assert.equal(typeof opts.secure, "boolean", "Secure flag must be evaluated");
    assert.equal(typeof opts.maxAge, "number", "Must specify a maxAge lifespan");
  });

  await t.test("custom options override defaults cleanly", () => {
    const opts = getDefaultCookieOptions({
      sameSite: "strict",
      maxAge: 3600,
      path: "/vault",
    });
    assert.equal(opts.httpOnly, true, "httpOnly remains true");
    assert.equal(opts.sameSite, "strict");
    assert.equal(opts.maxAge, 3600);
    assert.equal(opts.path, "/vault");
  });
});

test("Tamper-Resistant Signed Cookie Handling", async (t) => {
  const secret = "super-secret-signing-key-123456789";

  await t.test("signs and verifies valid string values", () => {
    const raw = "user-session-identifier-789";
    const signed = signCookieValue(raw, secret);
    assert.ok(signed.includes("."), "Signed cookie must contain a dot separator");

    const verified = verifySignedCookieValue(signed, secret);
    assert.equal(verified, raw, "Verified value must match the original value");
  });

  await t.test("detects and rejects tampered values", () => {
    const raw = "user-session-identifier-789";
    const signed = signCookieValue(raw, secret);

    const tamperedPayload = `attacker${signed.slice(signed.indexOf("."))}`;
    assert.equal(verifySignedCookieValue(tamperedPayload, secret), null);

    const tamperedSignature = `${signed}extra`;
    assert.equal(verifySignedCookieValue(tamperedSignature, secret), null);

    assert.equal(verifySignedCookieValue("not-a-signed-value", secret), null);
    assert.equal(verifySignedCookieValue("", secret), null);
  });

  await t.test("creates, signs, and unpacks structured JSON payloads", () => {
    const payload = { userId: "usr-42", role: "admin", vaultId: "vault-99" };
    const token = createSignedPayload(payload, { secret, expiresInSeconds: 60 });

    const unpacked = verifySignedPayload(token, { secret });
    assert.deepEqual(unpacked, payload);
  });

  await t.test("rejects expired signed payloads", () => {
    const payload = { userId: "usr-42" };
    const expiredToken = createSignedPayload(payload, { secret, expiresInSeconds: -10 });

    const result = verifySignedPayload(expiredToken, { secret });
    assert.equal(result, null, "Expired signed payload must evaluate to null");
  });

  await t.test("rejects payload signed with a different secret", () => {
    const payload = { userId: "usr-42" };
    const token = createSignedPayload(payload, { secret: "secret-A", expiresInSeconds: 60 });

    assert.equal(verifySignedPayload(token, { secret: "secret-B" }), null);
  });
});

test("Security Response Headers Specification", async (t) => {
  const headers = getStandardSecurityHeaders();

  await t.test("includes mandatory OWASP security headers", () => {
    assert.equal(headers["X-Content-Type-Options"], "nosniff");
    assert.equal(headers["X-Frame-Options"], "DENY");
    assert.equal(headers["X-XSS-Protection"], "0");
    assert.equal(headers["Referrer-Policy"], "strict-origin-when-cross-origin");
    assert.ok(headers["Strict-Transport-Security"].includes("max-age=63072000"));
    assert.ok(headers["Strict-Transport-Security"].includes("includeSubDomains"));
    assert.ok(headers["Permissions-Policy"].includes("camera=()"));
    assert.ok(headers["Permissions-Policy"].includes("microphone=()"));
    assert.ok(headers["Permissions-Policy"].includes("geolocation=()"));
  });

  await t.test("Content-Security-Policy protects App Router against injection", () => {
    const csp = headers["Content-Security-Policy"];
    assert.ok(csp.includes("default-src 'self'"));
    assert.ok(csp.includes("object-src 'none'"));
    assert.ok(csp.includes("frame-ancestors 'none'"));
    assert.ok(csp.includes("base-uri 'self'"));
    assert.ok(csp.includes("form-action 'self'"));
  });

  await t.test("NO_CACHE_HEADERS contains strict anti-caching directives", () => {
    assert.ok(NO_CACHE_HEADERS["Cache-Control"].includes("no-store"));
    assert.ok(NO_CACHE_HEADERS["Cache-Control"].includes("no-cache"));
    assert.equal(NO_CACHE_HEADERS["Pragma"], "no-cache");
    assert.equal(NO_CACHE_HEADERS["Expires"], "0");
  });

  await t.test("getSecurityHeadersArray formats for next.config.ts", () => {
    const arr = getSecurityHeadersArray();
    assert.ok(Array.isArray(arr));
    assert.ok(arr.some((item) => item.key === "X-Content-Type-Options" && item.value === "nosniff"));
    assert.ok(arr.some((item) => item.key === "X-Frame-Options" && item.value === "DENY"));
  });

  await t.test("applySecurityHeaders sets headers on response objects", () => {
    const res = new Response("ok", { status: 200 });
    applySecurityHeaders(res, { noCache: true });

    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(res.headers.get("x-frame-options"), "DENY");
    assert.ok(res.headers.get("cache-control").includes("no-store"));
  });
});

test("Incoming Header Extraction & Validation", async (t) => {
  await t.test("getClientIp extracts client IP from x-forwarded-for multi-proxy chain", async () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178",
    });
    const ip = await getClientIp(headers);
    assert.equal(ip, "203.0.113.195");
  });

  await t.test("getClientIp handles x-real-ip and strips IPv6 mapping", async () => {
    const headers = new Headers({
      "x-real-ip": "::ffff:192.168.1.50",
    });
    const ip = await getClientIp(headers);
    assert.equal(ip, "192.168.1.50");
  });

  await t.test("getUserAgent bounds length and removes control characters", async () => {
    const mockHeaders = {
      get(name) {
        if (name.toLowerCase() === "user-agent") {
          return "Mozilla/5.0 \r\n Injected-Header: evil \t TestBrowser";
        }
        return null;
      },
    };
    const ua = await getUserAgent(mockHeaders, 30);
    assert.ok(!ua.includes("\r") && !ua.includes("\n"));
    assert.ok(ua.length <= 30);
  });

  await t.test("getBearerToken extracts bearer token case-insensitively", async () => {
    const headers1 = new Headers({ authorization: "Bearer secret-token-xyz" });
    assert.equal(await getBearerToken(headers1), "secret-token-xyz");

    const headers2 = new Headers({ authorization: "bearer token-abc-123" });
    assert.equal(await getBearerToken(headers2), "token-abc-123");

    const headers3 = new Headers({ authorization: "Basic dXNlcjpwYXNz" });
    assert.equal(await getBearerToken(headers3), null);

    const headers4 = new Headers();
    assert.equal(await getBearerToken(headers4), null);
  });

  await t.test("getRequestTraceId reads trace or request correlation ID", async () => {
    const headers1 = new Headers({ "x-trace-id": "trace-123" });
    assert.equal(await getRequestTraceId(headers1), "trace-123");

    const headers2 = new Headers({ "x-request-id": "req-456" });
    assert.equal(await getRequestTraceId(headers2), "req-456");

    const headers3 = new Headers();
    assert.equal(await getRequestTraceId(headers3), null);
  });

  await t.test("validateCsrfOrigin verifies matching origin and host", async () => {
    const validHeaders = new Headers({
      origin: "http://localhost:3000",
      host: "localhost:3000",
    });
    assert.equal(await validateCsrfOrigin(validHeaders), true);

    const evilHeaders = new Headers({
      origin: "http://evil-attacker.com",
      host: "localhost:3000",
    });
    assert.equal(await validateCsrfOrigin(evilHeaders), false);

    const allowedOriginHeaders = new Headers({
      origin: "https://digilocker.gov.in",
      host: "api.digilocker.gov.in",
    });
    assert.equal(
      await validateCsrfOrigin(allowedOriginHeaders, ["https://digilocker.gov.in"]),
      true
    );
  });
});

test("Framework Integration: next.config.ts & proxy.js & API Handlers", async (t) => {
  await t.test("next.config.ts defines security and anti-cache headers", async () => {
    const config = nextConfigModule.default;
    assert.equal(typeof config.headers, "function");

    const headersList = await config.headers();
    assert.ok(Array.isArray(headersList));

    const globalRule = headersList.find((r) => r.source === "/:path*");
    assert.ok(globalRule, "Must have global /:path* headers rule");
    assert.ok(globalRule.headers.some((h) => h.key === "X-Content-Type-Options" && h.value === "nosniff"));
    assert.ok(globalRule.headers.some((h) => h.key === "X-Frame-Options" && h.value === "DENY"));
    assert.ok(globalRule.headers.some((h) => h.key === "Content-Security-Policy"));

    const apiRule = headersList.find((r) => r.source === "/api/:path*");
    assert.ok(apiRule, "Must have /api/:path* anti-cache rule");
    assert.ok(apiRule.headers.some((h) => h.key === "Cache-Control" && h.value.includes("no-store")));
  });

  await t.test("proxy.js applies security headers and trace context on responses", async () => {
    const mockRequest = {
      url: "http://localhost:3000/dashboard",
      nextUrl: new URL("http://localhost:3000/dashboard"),
      headers: new Headers({ "x-trace-id": "client-trace-777" }),
      cookies: { get: () => undefined },
    };

    const response = await proxy(mockRequest);
    assert.equal(response.headers.get("x-trace-id"), "client-trace-777");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
  });

  await t.test("api-validation response helpers attach security and anti-cache headers", () => {
    const successRes = successResponse({ test: true });
    assert.equal(successRes.status, 200);
    assert.equal(successRes.headers.get("x-content-type-options"), "nosniff");
    assert.equal(successRes.headers.get("x-frame-options"), "DENY");
    assert.ok(successRes.headers.get("cache-control").includes("no-store"));

    const errorRes = errorResponse("Something failed", 400);
    assert.equal(errorRes.status, 400);
    assert.equal(errorRes.headers.get("x-content-type-options"), "nosniff");
    assert.equal(errorRes.headers.get("x-frame-options"), "DENY");
    assert.ok(errorRes.headers.get("cache-control").includes("no-store"));
  });
});
