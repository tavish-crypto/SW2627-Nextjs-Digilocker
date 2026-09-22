/**
 * Centralized environment configuration.
 *
 * Important:
 * - Optional variables receive safe defaults.
 * - Missing variables DO NOT crash `next build`.
 * - Production configuration can be checked explicitly with
 *   validateEnvironment().
 */

/**
 * Parse a numeric environment variable.
 */
function parseNumber(value, variableName, defaultValue) {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return defaultValue;
  }

  const parsed = Number.parseInt(String(value), 10);

  if (Number.isNaN(parsed)) {
    console.warn(
      `[env] Invalid number for ${variableName}: "${value}". Using default: ${defaultValue}`
    );

    return defaultValue;
  }

  return parsed;
}

/**
 * Parse a boolean environment variable.
 */
function parseBoolean(value, defaultValue = false) {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();

  if (normalized === "true" || normalized === "1") {
    return true;
  }

  if (normalized === "false" || normalized === "0") {
    return false;
  }

  return defaultValue;
}

/**
 * Parse comma-separated values.
 */
function parseList(value, defaultValue = []) {
  if (!value || String(value).trim() === "") {
    return defaultValue;
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Resolve application URL.
 */
function getAppUrl() {
  // Explicit value should always win
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // Vercel automatically exposes VERCEL_URL on deployments
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

export const env = {
  // -----------------------------------------------------
  // Application
  // -----------------------------------------------------

  NODE_ENV: process.env.NODE_ENV || "development",

  NEXT_PUBLIC_APP_ENV:
    process.env.NEXT_PUBLIC_APP_ENV || "development",

  NEXT_PUBLIC_APP_NAME:
    process.env.NEXT_PUBLIC_APP_NAME || "DigiLocker Vault",

  NEXT_PUBLIC_APP_URL: getAppUrl(),

  // -----------------------------------------------------
  // API
  // -----------------------------------------------------

  NEXT_PUBLIC_API_BASE_URL:
    process.env.NEXT_PUBLIC_API_BASE_URL || "/api",

  API_TIMEOUT: parseNumber(
    process.env.API_TIMEOUT,
    "API_TIMEOUT",
    30000
  ),

  API_LOG_ENABLED: parseBoolean(
    process.env.API_LOG_ENABLED,
    false
  ),

  // -----------------------------------------------------
  // Storage
  // -----------------------------------------------------

  STORAGE_PROVIDER:
    process.env.STORAGE_PROVIDER ||
    (process.env.NODE_ENV === "production" && process.env.DATABASE_URL ? "database" : "mock"),

  GCP_PROJECT_ID:
    process.env.GCP_PROJECT_ID || "",

  GCP_STORAGE_BUCKET:
    process.env.GCP_STORAGE_BUCKET || "",

  GCP_CLIENT_EMAIL:
    process.env.GCP_CLIENT_EMAIL || "",

  GCP_PRIVATE_KEY:
    process.env.GCP_PRIVATE_KEY
      ? process.env.GCP_PRIVATE_KEY.replace(/\\n/g, "\n")
      : "",

  NEXT_PUBLIC_STORAGE_BUCKET:
    process.env.NEXT_PUBLIC_STORAGE_BUCKET || "",

  NEXT_PUBLIC_STORAGE_REGION:
    process.env.NEXT_PUBLIC_STORAGE_REGION || "us-east-1",

  NEXT_PUBLIC_STORAGE_ENDPOINT:
    process.env.NEXT_PUBLIC_STORAGE_ENDPOINT || "",

  STORAGE_ACCESS_KEY_ID:
    process.env.STORAGE_ACCESS_KEY_ID || "",

  STORAGE_SECRET_ACCESS_KEY:
    process.env.STORAGE_SECRET_ACCESS_KEY || "",

  PRESIGNED_URL_EXPIRY_SECONDS: parseNumber(
    process.env.PRESIGNED_URL_EXPIRY_SECONDS,
    "PRESIGNED_URL_EXPIRY_SECONDS",
    900
  ),

  STORAGE_ENABLE_ENCRYPTION: parseBoolean(
    process.env.STORAGE_ENABLE_ENCRYPTION,
    false
  ),

  STORAGE_KMS_KEY_ID:
    process.env.STORAGE_KMS_KEY_ID || "",

  // -----------------------------------------------------
  // Database
  // -----------------------------------------------------

  DATABASE_URL:
    process.env.DATABASE_URL || "",

  DATABASE_POOL_SIZE: parseNumber(
    process.env.DATABASE_POOL_SIZE,
    "DATABASE_POOL_SIZE",
    10
  ),

  DATABASE_LOG_ENABLED: parseBoolean(
    process.env.DATABASE_LOG_ENABLED,
    false
  ),

  // -----------------------------------------------------
  // Authentication
  // -----------------------------------------------------

  NEXT_PUBLIC_AUTH_ENABLED: parseBoolean(
    process.env.NEXT_PUBLIC_AUTH_ENABLED,
    false
  ),

  AUTH_SECRET:
    process.env.AUTH_SECRET || "",

  AUTH_GOOGLE_ID:
    process.env.AUTH_GOOGLE_ID || "",

  AUTH_GOOGLE_SECRET:
    process.env.AUTH_GOOGLE_SECRET || "",

  AUTH_SESSION_EXPIRY_SECONDS: parseNumber(
    process.env.AUTH_SESSION_EXPIRY_SECONDS,
    "AUTH_SESSION_EXPIRY_SECONDS",
    86400
  ),

  CORS_ALLOWED_ORIGINS: parseList(
    process.env.CORS_ALLOWED_ORIGINS,
    ["http://localhost:3000"]
  ),

  // -----------------------------------------------------
  // File Upload
  // -----------------------------------------------------

  MAX_FILE_SIZE_MB: parseNumber(
    process.env.MAX_FILE_SIZE_MB,
    "MAX_FILE_SIZE_MB",
    10
  ),

  MAX_STORAGE_PER_USER_MB: parseNumber(
    process.env.MAX_STORAGE_PER_USER_MB,
    "MAX_STORAGE_PER_USER_MB",
    100
  ),

  ALLOWED_FILE_TYPES: parseList(
    process.env.ALLOWED_FILE_TYPES,
    [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/xml",
      "application/json",
    ]
  ),

  VIRUS_SCAN_ENABLED: parseBoolean(
    process.env.VIRUS_SCAN_ENABLED,
    false
  ),

  VIRUS_SCAN_URL:
    process.env.VIRUS_SCAN_URL || "",

  // -----------------------------------------------------
  // Sharing
  // -----------------------------------------------------

  NEXT_PUBLIC_ENABLE_SHARE_LINKS: parseBoolean(
    process.env.NEXT_PUBLIC_ENABLE_SHARE_LINKS,
    true
  ),

  NEXT_PUBLIC_DEFAULT_EXPIRY_MINUTES: parseNumber(
    process.env.NEXT_PUBLIC_DEFAULT_EXPIRY_MINUTES,
    "NEXT_PUBLIC_DEFAULT_EXPIRY_MINUTES",
    60
  ),

  MAX_SHARE_LINK_EXPIRY_MINUTES: parseNumber(
    process.env.MAX_SHARE_LINK_EXPIRY_MINUTES,
    "MAX_SHARE_LINK_EXPIRY_MINUTES",
    43200
  ),

  NEXT_PUBLIC_ENABLE_SHARE_PIN: parseBoolean(
    process.env.NEXT_PUBLIC_ENABLE_SHARE_PIN,
    false
  ),

  NEXT_PUBLIC_ENABLE_SHARE_VIEW_LIMITS: parseBoolean(
    process.env.NEXT_PUBLIC_ENABLE_SHARE_VIEW_LIMITS,
    false
  ),

  // -----------------------------------------------------
  // Security
  // -----------------------------------------------------

  CSP_ENABLED: parseBoolean(
    process.env.CSP_ENABLED,
    true
  ),

  CORS_ENABLED: parseBoolean(
    process.env.CORS_ENABLED,
    true
  ),

  RATE_LIMIT_ENABLED: parseBoolean(
    process.env.RATE_LIMIT_ENABLED,
    false
  ),

  RATE_LIMIT_WINDOW_SECONDS: parseNumber(
    process.env.RATE_LIMIT_WINDOW_SECONDS,
    "RATE_LIMIT_WINDOW_SECONDS",
    60
  ),

  RATE_LIMIT_MAX_REQUESTS: parseNumber(
    process.env.RATE_LIMIT_MAX_REQUESTS,
    "RATE_LIMIT_MAX_REQUESTS",
    100
  ),

  REQUEST_LOG_ENABLED: parseBoolean(
    process.env.REQUEST_LOG_ENABLED,
    false
  ),

  // -----------------------------------------------------
  // Logging / Monitoring
  // -----------------------------------------------------

  LOG_LEVEL:
    process.env.LOG_LEVEL || "info",

  ERROR_REPORTING_ENABLED: parseBoolean(
    process.env.ERROR_REPORTING_ENABLED,
    false
  ),

  ERROR_REPORTING_DSN:
    process.env.ERROR_REPORTING_DSN || "",

  ANALYTICS_ENABLED: parseBoolean(
    process.env.ANALYTICS_ENABLED,
    false
  ),

  ANALYTICS_TOKEN:
    process.env.ANALYTICS_TOKEN || "",

  // -----------------------------------------------------
  // Development
  // -----------------------------------------------------

  NEXT_PUBLIC_STRICT_MODE: parseBoolean(
    process.env.NEXT_PUBLIC_STRICT_MODE,
    true
  ),

  DEBUG: parseBoolean(
    process.env.DEBUG,
    false
  ),

  MOCK_API_ENABLED: parseBoolean(
    process.env.MOCK_API_ENABLED,
    false
  ),

  // -----------------------------------------------------
  // Helpers
  // -----------------------------------------------------

  isProduction:
    process.env.NODE_ENV === "production",

  isDevelopment:
    process.env.NODE_ENV !== "production",

  /**
   * Check whether important configuration exists.
   * This DOES NOT execute automatically during next build.
   */
  validate() {
    const errors = [];

    if (!this.DATABASE_URL) {
      errors.push("Missing DATABASE_URL");
    }

    if (
      this.NEXT_PUBLIC_AUTH_ENABLED &&
      !this.AUTH_SECRET
    ) {
      errors.push(
        "Missing AUTH_SECRET while authentication is enabled"
      );
    }

    if (
      this.STORAGE_PROVIDER === "gcp"
    ) {
      if (!this.GCP_PROJECT_ID) {
        errors.push("Missing GCP_PROJECT_ID");
      }

      if (!this.GCP_STORAGE_BUCKET) {
        errors.push("Missing GCP_STORAGE_BUCKET");
      }

      if (!this.GCP_CLIENT_EMAIL) {
        errors.push("Missing GCP_CLIENT_EMAIL");
      }

      if (!this.GCP_PRIVATE_KEY) {
        errors.push("Missing GCP_PRIVATE_KEY");
      }
    }

    return errors;
  },

  isConfigured() {
    return this.validate().length === 0;
  },
};

/**
 * Call this explicitly at runtime if strict validation is needed.
 *
 * Do NOT automatically execute it when this module is imported,
 * because Next.js imports route modules while running `next build`.
 */
export function validateEnvironment() {
  const errors = env.validate();

  if (errors.length > 0) {
    console.error(
      "[env] Environment configuration errors:",
      errors
    );

    return false;
  }

  console.log(
    "[env] Environment configuration validated"
  );

  return true;
}