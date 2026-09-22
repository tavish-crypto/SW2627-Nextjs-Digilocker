import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import pino from "pino";

const VALID_LOG_LEVELS = new Set(["fatal", "error", "warn", "info", "debug", "trace"]);
const configuredLevel = (process.env.LOG_LEVEL || "info").toLowerCase();
const level = VALID_LOG_LEVELS.has(configuredLevel) ? configuredLevel : "info";

const globalLoggerState = globalThis;

const logger =
  globalLoggerState.__digilockerLogger ??=
  pino({
    level,
    timestamp: pino.stdTimeFunctions.isoTime,
    base: undefined,
    formatters: {
      level: (label) => ({ level: label }),
    },
    redact: [
      "password",
      "authorization",
      "cookie",
      "set-cookie",
      "token",
      "accessToken",
      "refreshToken",
      "secret",
      "apiKey",
      "session",
    ],
  });

const traceContext = new AsyncLocalStorage();

export function createTraceId() {
  return randomUUID();
}

export function withTraceId(traceId, callback) {
  return traceContext.run(traceId, callback);
}

export function getTraceId() {
  return traceContext.getStore() || null;
}

export { logger };
