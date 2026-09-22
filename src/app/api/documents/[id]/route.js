import { getDocumentById } from "@/src/lib/documents";
import {
  documentIdSchema,
  API_ERROR_CODES,
  errorResponse,
  formatValidationDetails,
  successResponse,
} from "@/src/lib/api-validation";
import { createTraceId, getTraceId, logger, withTraceId } from "@/src/lib/logger";

export async function GET(_request, { params }) {
  const traceId = getTraceId() || createTraceId();

  return withTraceId(traceId, async () => {
    let routeParams;

    try {
      routeParams = await params;
    } catch (error) {
      logger.warn({ action: "document.read_validation_failed", traceId, err: error }, "Document ID parameter invalid");
      return errorResponse({ code: API_ERROR_CODES.VALIDATION_ERROR, message: "Invalid document ID", status: 400 });
    }

    const result = documentIdSchema.safeParse(routeParams?.id);
    if (!result.success) {
      logger.warn({ action: "document.read_validation_failed", traceId, documentId: routeParams?.id }, "Document ID validation failed");
      return errorResponse({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: "Invalid document ID",
        status: 400,
        details: formatValidationDetails(result.error),
      });
    }

    try {
      const document = await getDocumentById(result.data);

      if (!document) {
        logger.warn({ action: "document.not_found", traceId, documentId: result.data }, "Document not found");
        return errorResponse({ code: API_ERROR_CODES.NOT_FOUND, message: "Document not found", status: 404 });
      }

      logger.info({ action: "document.read", traceId, documentId: document.id }, "Document fetched");
      return successResponse({ document });
    } catch (error) {
      logger.error({ action: "document.read_failed", traceId, documentId: result.data, err: error }, "Document read failed");
      return errorResponse({ code: API_ERROR_CODES.DATABASE_ERROR, message: "Unable to fetch document", status: 500 });
    }
  });
}