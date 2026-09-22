/**
 * Example API Route - Using Environment Variables
 * 
 * This is an example showing how to use the environment configuration
 * in API routes. This file demonstrates best practices for:
 * - Accessing environment variables safely
 * - Validating configuration
 * - Error handling
 * 
 * Location: src/app/api/config/route.js
 * 
 * Usage:
 *   GET /api/config - Returns public configuration
 *   (only safe for exposing public information)
 */

import { env } from '@/src/lib/env'

/**
 * GET /api/config
 * 
 * Returns public configuration (NEXT_PUBLIC_* only)
 * Safe to expose to client - contains no secrets
 */
export async function GET(request) {
  try {
    // Validate that we're configured properly
    const errors = env.validate()
    
    if (errors.length > 0 && env.isProduction) {
      return new Response(
        JSON.stringify({
          error: 'Server configuration error',
          message: 'Please contact support',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Return only PUBLIC configuration
    // Never expose secrets, API keys, database URLs, etc.
    const config = {
      app: {
        env: env.NEXT_PUBLIC_APP_ENV,
        name: env.NEXT_PUBLIC_APP_NAME,
        url: env.NEXT_PUBLIC_APP_URL,
        strictMode: env.NEXT_PUBLIC_STRICT_MODE,
      },
      api: {
        baseUrl: env.NEXT_PUBLIC_API_BASE_URL,
      },
      storage: {
        bucket: env.NEXT_PUBLIC_STORAGE_BUCKET,
        region: env.NEXT_PUBLIC_STORAGE_REGION,
        endpoint: env.NEXT_PUBLIC_STORAGE_ENDPOINT,
      },
      upload: {
        maxFileSizeMB: env.MAX_FILE_SIZE_MB,
        allowedFileTypes: env.ALLOWED_FILE_TYPES,
      },
      features: {
        authEnabled: env.NEXT_PUBLIC_AUTH_ENABLED,
        shareLinksEnabled: env.NEXT_PUBLIC_ENABLE_SHARE_LINKS,
        sharePinEnabled: env.NEXT_PUBLIC_ENABLE_SHARE_PIN,
        shareViewLimitsEnabled: env.NEXT_PUBLIC_ENABLE_SHARE_VIEW_LIMITS,
        defaultExpiryMinutes: env.NEXT_PUBLIC_DEFAULT_EXPIRY_MINUTES,
      },
      security: {
        corsEnabled: env.CORS_ENABLED,
        cspEnabled: env.CSP_ENABLED,
        rateLimitEnabled: env.RATE_LIMIT_ENABLED,
      },
    }

    return Response.json(config, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    })
  } catch (error) {
    console.error('Config endpoint error:', error)
    return Response.json(
      { error: 'Failed to retrieve configuration' },
      { status: 500 }
    )
  }
}

/**
 * Example: Using server-only environment variables in API routes
 * 
 * NEVER expose these to the client!
 * - Database credentials
 * - AWS keys
 * - Auth secrets
 * - API keys
 * 
 * Example server-side usage:
 */

// import { env } from '@/src/lib/env'
// 
// export async function POST(request) {
//   // Safe to use server-only variables here
//   const dbUrl = env.DATABASE_URL
//   const storageKey = env.STORAGE_ACCESS_KEY_ID
//   const authSecret = env.AUTH_SECRET
//   
//   // Do something with server-only secrets...
//   // Never return these in response
// }

/**
 * Example: Accessing environment in middleware
 * 
 * Location: src/middleware.js
 */

// import { env } from '@/src/lib/env'
// import { NextResponse } from 'next/server'
// 
// export function middleware(request) {
//   // Check if auth is enabled
//   if (env.NEXT_PUBLIC_AUTH_ENABLED) {
//     // Require authentication for protected routes
//     // ...
//   }
//   
//   // Add security headers
//   const response = NextResponse.next()
//   
//   if (env.CSP_ENABLED) {
//     response.headers.set(
//       'Content-Security-Policy',
//       "default-src 'self'; script-src 'self' 'unsafe-inline'"
//     )
//   }
//   
//   return response
// }
//
// export const config = {
//   matcher: ['/:path*'],
// }

/**
 * Example: Using environment in Server Components
 * 
 * Location: src/app/some-page.js
 */

// import { env } from '@/src/lib/env'
// 
// export default async function Page() {
//   // Can safely use NEXT_PUBLIC_* in Server Components
//   const storageRegion = env.NEXT_PUBLIC_STORAGE_REGION
//   
//   // Server Components can also access server-only variables
//   const dbUrl = env.DATABASE_URL
//   
//   return (
//     <div>
//       {/* Only expose public vars in rendered HTML */}
//       Storage region: {storageRegion}
//     </div>
//   )
// }

/**
 * Example: Using environment in Client Components
 * 
 * Location: src/components/upload-form.js
 * 
 * ⚠️ Client Components can ONLY access NEXT_PUBLIC_* variables
 */

// "use client"
// 
// import { env } from '@/src/lib/env'
// 
// // Only works with NEXT_PUBLIC_* variables
// const maxFileSize = env.NEXT_PUBLIC_MAX_FILE_SIZE_MB  // ✓ Works
// // const dbUrl = env.DATABASE_URL  // ✗ Error: undefined
// 
// export function UploadForm() {
//   return (
//     <div>
//       Max file size: {maxFileSize}MB
//     </div>
//   )
// }
