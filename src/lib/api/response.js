import { getTraceId } from "../logger.js";
import { applySecurityHeaders } from "../headers.js";

export function successResponse(data = {}, options = {}, customHeaders = {}) {
  const normalizedOptions = typeof options === "number"
    ? { status: options, headers: customHeaders }
    : options;
  const { status = 200, message, headers = {} } = normalizedOptions;

  if (status === 204) {
    return new Response(null, { status });
  }

  const body = { success: true };
  if (message) body.message = message;
  body.data = data;

  const response = Response.json(body, { status, headers });
  const traceId = getTraceId();
  if (traceId) response.headers.set("x-trace-id", traceId);
  applySecurityHeaders(response, { noCache: true });
  return response;
}