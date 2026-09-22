import { getTraceId } from "../logger.js";
import { applySecurityHeaders } from "../headers.js";

export const API_ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
  CONFLICT: "CONFLICT",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  INVALID_FILE_TYPE: "INVALID_FILE_TYPE",
  UPLOAD_FAILED: "UPLOAD_FAILED",
  DATABASE_ERROR: "DATABASE_ERROR",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
});

export function errorResponse(input = {}, legacyStatus, legacyDetails = [], customHeaders = {}) {
  const legacyCall = typeof input === "string";
  const options = legacyCall
    ? {
        code: legacyStatus >= 400 && legacyStatus < 500
          ? API_ERROR_CODES.VALIDATION_ERROR
          : API_ERROR_CODES.INTERNAL_SERVER_ERROR,
        message: input,
        status: legacyStatus,
        details: legacyDetails,
        headers: customHeaders,
      }
    : input;
  const {
  code = API_ERROR_CODES.INTERNAL_SERVER_ERROR,
  message = "An unexpected error occurred",
  status = 500,
  details,
    headers = {},
  } = options;
  const error = { code, message };
  if (details && Object.keys(details).length > 0) {
    error.details = details;
  }

  const response = Response.json({ success: false, error }, { status, headers });
  const traceId = getTraceId();
  if (traceId) response.headers.set("x-trace-id", traceId);
  applySecurityHeaders(response, { noCache: true });
  return response;
}

export function formatValidationDetails(error) {
  const details = {};

  for (const issue of error?.issues || []) {
    const field = issue.path?.length ? issue.path.join(".") : "_form";
    if (!details[field]) details[field] = [];
    details[field].push(issue.message);
  }

  return details;
}

export function getValidationErrorResponse(error, input = {}) {
  const issueCodes = new Set((error?.issues || []).map((issue) => issue.code));
  const hasFileSizeIssue = issueCodes.has("too_big");
  const hasFileTypeIssue = issueCodes.has("invalid_value") &&
    (error?.issues || []).some((issue) =>
      issue.path?.includes("contentType") && typeof input.contentType === "string"
    );

  if (hasFileSizeIssue) {
    return errorResponse({
      code: API_ERROR_CODES.FILE_TOO_LARGE,
      message: "File size cannot exceed 10 MB",
      status: 413,
      details: formatValidationDetails(error),
    });
  }

  if (hasFileTypeIssue) {
    return errorResponse({
      code: API_ERROR_CODES.INVALID_FILE_TYPE,
      message: "Unsupported document type",
      status: 415,
      details: formatValidationDetails(error),
    });
  }

  return errorResponse({
    code: API_ERROR_CODES.VALIDATION_ERROR,
    message: "Invalid request data",
    status: 400,
    details: formatValidationDetails(error),
  });
}