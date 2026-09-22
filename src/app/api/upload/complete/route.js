import { revalidatePath } from "next/cache.js";
import { getCookieValue } from "../../../../lib/cookies.js";
import { getRequestTraceId } from "../../../../lib/headers.js";
import {
  completeUploadSchema,
  API_ERROR_CODES,
  parseRequestBody,
  successResponse,
  errorResponse,
} from "../../../../lib/api-validation.js";
import { createDocument } from "../../../../lib/documents.js";
import { getCurrentUser } from "../../../../lib/auth.js";
import { createTraceId, getTraceId, logger, withTraceId } from "../../../../lib/logger.js";
import {
  detectDocumentType,
  extractTitleFromFileName,
  formatFileSize,
} from "../../../../lib/file-validation.js";

/**
 * POST /api/upload/complete
 * 
 * Finalizes direct-to-cloud file upload by persisting document metadata in the vault.
 * Revalidates vault paths and returns the created document.
 */
export async function POST(request) {
  const traceId = (await getRequestTraceId(request)) || getTraceId() || createTraceId();

  return withTraceId(traceId, async () => {
    const parsed = await parseRequestBody(request, completeUploadSchema);
    if (!parsed.success) {
      logger.warn({ action: "document.upload_validation_failed", traceId, route: "/api/upload/complete" }, "Upload validation failed");
      return parsed.response;
    }

    const { objectKey, fileName, contentType, fileSize, documentId } = parsed.data;

    // Determine user identity
    let userId = "demo-user";
    try {
      if (process.env.NEXT_PUBLIC_AUTH_ENABLED === "true") {
        const user = await getCurrentUser();
        if (user?.id) {
          userId = user.id;
        }
      } else {
        const cookieUser = await getCookieValue("demo-user");
        if (cookieUser) {
          userId = cookieUser;
        }
      }
    } catch {
      userId = "demo-user";
    }

    const type = detectDocumentType(fileName, contentType) || "PDF";
    const title = extractTitleFromFileName(fileName) || "Uploaded Document";
    const formattedSize = formatFileSize(fileSize);

    try {
      const document = await createDocument({
        ...(documentId ? { id: documentId } : {}),
        title,
        description: `Verified ${type} document uploaded to secure vault.`,
        type,
        size: formattedSize,
        fileKey: objectKey,
        fileUrl: objectKey,
        mimeType: contentType,
        fileSizeBytes: fileSize,
        userId,
      });

      try {
        revalidatePath("/documents");
        revalidatePath("/dashboard");
        revalidatePath(`/documents/${document.id}`);
      } catch {
        // Graceful no-op in non-Next request contexts
      }

      logger.info({ action: "document.upload", traceId, userId, documentId: document.id }, "Document upload completed");
      return successResponse({ document }, 201);
    } catch (error) {
      logger.error({ action: "document.upload_failed", traceId, userId, err: error }, "Document upload failed");
      return errorResponse({ code: API_ERROR_CODES.UPLOAD_FAILED, message: "Unable to complete document upload", status: 500 });
    }
  });
}
