import { revalidatePath } from "next/cache";
import { createDocument, getDocuments } from "@/src/lib/documents";
import { API_ERROR_CODES, errorResponse, successResponse } from "@/src/lib/api-validation";
import { createTraceId, getTraceId, logger, withTraceId } from "@/src/lib/logger";

export async function GET() {
  const traceId = getTraceId() || createTraceId();
  return withTraceId(traceId, async () => {
    try {
      const documents = await getDocuments();
      logger.info({ action: "document.list", traceId, count: documents.length }, "Documents listed");
      return successResponse({ documents });
    } catch (error) {
      logger.error({ action: "document.list_failed", traceId, err: error }, "Document list failed");
      return errorResponse({ code: API_ERROR_CODES.DATABASE_ERROR, message: "Unable to fetch documents", status: 500 });
    }
  });
}

export async function POST(request) {
  const traceId = getTraceId() || createTraceId();

  return withTraceId(traceId, async () => {
    let body;

    try {
      body = await request.json();
    } catch (error) {
      logger.warn({ action: "document.create_validation_failed", traceId, err: error }, "Document create request body was invalid");
      return errorResponse({ code: API_ERROR_CODES.VALIDATION_ERROR, message: "Invalid JSON body", status: 400 });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      logger.warn({ action: "document.create_validation_failed", traceId }, "Document create request body missing");
      return errorResponse({ code: API_ERROR_CODES.VALIDATION_ERROR, message: "Request body is required", status: 400 });
    }

    if (typeof body.title !== "string" || body.title.trim() === "") {
      logger.warn({ action: "document.create_validation_failed", traceId }, "Document create request missing title");
      return errorResponse({ code: API_ERROR_CODES.VALIDATION_ERROR, message: "The title field is required", status: 400 });
    }

    try {
      const document = await createDocument({
        title: body.title.trim(),
        description: typeof body.description === "string" ? body.description : "",
        issuedOn: typeof body.issuedOn === "string" ? body.issuedOn : new Date().toISOString(),
        type: typeof body.type === "string" ? body.type : "",
        size: typeof body.size === "string" ? body.size : "",
      });

      revalidatePath("/documents");
      revalidatePath("/dashboard");
      revalidatePath(`/documents/${document.id}`);

      logger.info({ action: "document.create", traceId, documentId: document.id }, "Document created");
      return successResponse({ document }, 201);
    } catch (error) {
      logger.error({ action: "document.create_failed", traceId, err: error }, "Document create failed");
      return errorResponse({ code: API_ERROR_CODES.DATABASE_ERROR, message: "Unable to create document", status: 500 });
    }
  });
}