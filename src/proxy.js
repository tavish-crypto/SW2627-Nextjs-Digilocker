import { NextResponse } from "next/server.js";
import { randomUUID } from "node:crypto";
import { verifySessionToken } from "./lib/auth.js";
import { applySecurityHeaders, getRequestTraceId } from "./lib/headers.js";

/**
 * Next.js 16 Proxy Convention for Route-Level Authorization and Security Headers
 * - Enforces authentication and RBAC for privileged routes
 * - Injects OWASP security response headers across all responses
 * - Establishes and propagates end-to-end request trace correlation IDs
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

function enhanceResponse(response, traceId, isPrivate = false) {
  if (response?.headers?.set) {
    if (traceId) {
      response.headers.set("x-trace-id", traceId);
    }
    applySecurityHeaders(response, { noCache: isPrivate });
  }
  return response;
}

export async function resolveRequestAuthState(request, authFn) {
  let nextAuthSession = null;

  if (typeof authFn === "function") {
    try {
      nextAuthSession = await authFn();
    } catch {
      nextAuthSession = null;
    }
  } else {
    try {
      const { auth } = await import("./auth.js");
      nextAuthSession = await auth();
    } catch {
      nextAuthSession = null;
    }
  }

  if (nextAuthSession?.user) {
    const user = nextAuthSession.user;
    return {
      isAuthenticated: true,
      user: {
        ...user,
        id: user.id || user.sub || null,
        role: user.role || "user",
      },
    };
  }

  const rawCookie = request.cookies?.get?.("digilocker-session");
  const cookieValue = typeof rawCookie === "object" ? rawCookie?.value : rawCookie;
  if (!cookieValue) {
    return { isAuthenticated: false, user: null };
  }

  const verified = verifySessionToken(cookieValue);
  if (!verified) {
    return { isAuthenticated: false, user: null };
  }

  return {
    isAuthenticated: true,
    user: {
      id: verified.userId,
      email: verified.email,
      name: verified.name,
      role: verified.role || "user",
    },
  };
}

export async function proxy(request) {
  const url = request.nextUrl || new URL(request.url);
  const pathname = url.pathname;
  const traceId = (await getRequestTraceId(request)) || randomUUID();

  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";
  const isVaultRoute = pathname.startsWith("/dashboard") || pathname.startsWith("/documents");
  const isPrivate = isVaultRoute || pathname.startsWith("/admin") || pathname.startsWith("/api/");
  const authState = await resolveRequestAuthState(request);

  if (authEnabled && isVaultRoute && !authState.isAuthenticated) {
    return enhanceResponse(NextResponse.redirect(new URL("/login", request.url)), traceId, isPrivate);
  }

  if (pathname.startsWith("/admin")) {
    if (!authState.isAuthenticated) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return enhanceResponse(NextResponse.redirect(loginUrl), traceId, isPrivate);
    }

    if (authState.user.role !== "admin") {
      return enhanceResponse(NextResponse.redirect(new URL("/forbidden", request.url)), traceId, isPrivate);
    }
  }

  const response = NextResponse.next();
  return enhanceResponse(response, traceId, isPrivate);
}

export default proxy;
