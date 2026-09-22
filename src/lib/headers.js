import { headers } from "next/headers.js";

/**
 * Builds Content Security Policy (CSP) directive string.
 */
export function buildContentSecurityPolicy({ isDev = process.env.NODE_ENV === "development" } = {}) {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ];
  return directives.join("; ");
}

/**
 * Comprehensive standard security headers recommended by OWASP and Next.js.
 */
export function getStandardSecurityHeaders({ isDev = process.env.NODE_ENV === "development" } = {}) {
  const headersMap = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "0",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  };

  if (process.env.CSP_ENABLED !== "false") {
    headersMap["Content-Security-Policy"] = buildContentSecurityPolicy({ isDev });
  }

  return headersMap;
}

/**
 * Anti-caching security headers for private, authenticated, or sensitive API routes.
 */
export const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

/**
 * Returns security headers formatted as an array of { key, value } for next.config.ts.
 */
export function getSecurityHeadersArray(options = {}) {
  const headersMap = getStandardSecurityHeaders(options);
  return Object.entries(headersMap).map(([key, value]) => ({ key, value }));
}

/**
 * Safely resolves a Web Headers instance from:
 * 1. An existing Headers instance
 * 2. An incoming Request object
 * 3. Next.js headers() server context
 */
export async function resolveHeaders(headersOrRequest) {
  if (headersOrRequest) {
    if (typeof headersOrRequest.headers?.get === "function") {
      return headersOrRequest.headers;
    }
    if (typeof headersOrRequest.get === "function") {
      return headersOrRequest;
    }
  }

  try {
    return await headers();
  } catch {
    return new Headers();
  }
}

/**
 * Read-safe header extraction.
 */
export async function getHeader(name, headersOrRequest) {
  const h = await resolveHeaders(headersOrRequest);
  return h.get(name) || null;
}

/**
 * Safely extracts client IP address from proxy headers (x-forwarded-for, x-real-ip).
 * Handles multi-hop proxy chains by selecting the first untrusted upstream IP.
 */
export async function getClientIp(headersOrRequest) {
  const h = await resolveHeaders(headersOrRequest);

  const forwardedFor = h.get("x-forwarded-for");
  if (forwardedFor) {
    const ips = forwardedFor.split(",").map((ip) => ip.trim());
    if (ips[0]) {
      // Strip IPv6-mapped IPv4 prefix if present (::ffff:)
      return ips[0].replace(/^::ffff:/, "");
    }
  }

  const realIp = h.get("x-real-ip") || h.get("cf-connecting-ip");
  if (realIp) {
    return realIp.trim().replace(/^::ffff:/, "");
  }

  return "127.0.0.1";
}

/**
 * Safely extracts User-Agent header with size bounding and sanitization
 * to prevent log injection or header flood attacks.
 */
export async function getUserAgent(headersOrRequest, maxLength = 255) {
  const h = await resolveHeaders(headersOrRequest);
  const ua = h.get("user-agent") || "";
  return ua
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, maxLength);
}

/**
 * Extracts and parses a Bearer token from the Authorization header.
 */
export async function getBearerToken(headersOrRequest) {
  const h = await resolveHeaders(headersOrRequest);
  const authHeader = h.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+([A-Za-z0-9._~+/-]+=*)$/i);
  return match ? match[1] : null;
}

/**
 * Extracts or generates request correlation trace ID from headers.
 */
export async function getRequestTraceId(headersOrRequest) {
  const h = await resolveHeaders(headersOrRequest);
  return h.get("x-trace-id") || h.get("x-request-id") || null;
}

/**
 * CSRF defense for sensitive mutating operations.
 * Compares the Origin or Referer header against the request Host and allowed origins.
 */
export async function validateCsrfOrigin(
  headersOrRequest,
  allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ? process.env.CORS_ALLOWED_ORIGINS.split(",").map(o => o.trim()).filter(Boolean) : [])
) {
  const h = await resolveHeaders(headersOrRequest);

  const origin = h.get("origin");
  const host = h.get("x-forwarded-host") || h.get("host");

  if (!origin) {
    // If no origin, check referer as fallback
    const referer = h.get("referer");
    if (!referer) {
      // In strict API/Form contexts, absence of both on mutation is suspect
      return false;
    }
    try {
      const refererUrl = new URL(referer);
      if (host && refererUrl.host.toLowerCase() === host.toLowerCase()) {
        return true;
      }
      return allowedOrigins.some((allowed) => {
        try {
          return new URL(allowed).origin === refererUrl.origin;
        } catch {
          return false;
        }
      });
    } catch {
      return false;
    }
  }

  try {
    const originUrl = new URL(origin);
    if (host && originUrl.host.toLowerCase() === host.toLowerCase()) {
      return true;
    }

    return allowedOrigins.some((allowed) => {
      try {
        return new URL(allowed).origin === originUrl.origin;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

/**
 * Applies all security headers onto an existing Response, NextResponse, or Headers instance.
 */
export function applySecurityHeaders(target, { isDev, noCache = false } = {}) {
  const secHeaders = getStandardSecurityHeaders({ isDev });
  const headersTarget = target?.headers || target;

  if (typeof headersTarget?.set === "function") {
    for (const [key, value] of Object.entries(secHeaders)) {
      headersTarget.set(key, value);
    }
    if (noCache) {
      for (const [key, value] of Object.entries(NO_CACHE_HEADERS)) {
        headersTarget.set(key, value);
      }
    }
  }

  return target;
}
