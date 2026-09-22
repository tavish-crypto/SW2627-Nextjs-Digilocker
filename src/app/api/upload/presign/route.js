import { getCookieValue } from "../../../../lib/cookies.js";
import { getRequestTraceId } from "../../../../lib/headers.js";
import {
  presignUploadSchema,
  parseRequestBody,
  successResponse,
  errorResponse,
} from "../../../../lib/api-validation.js";
import { getCurrentUser } from "../../../../lib/auth.js";
import { generateSignedUploadUrl } from "../../../../lib/cloud-storage.js";
import { createTraceId, getTraceId, logger, withTraceId } from "../../../../lib/logger.js";

/**
 * POST /api/upload/presign
 * 
 * Generates a temporary pre-signed URL for direct browser-to-cloud upload.
 * Validates payload (fileName, contentType, fileSize <= 10MB) before generating URL.
 * Pre-signed URL is valid for 15 minutes (900 seconds) per PRD Section 5.5.
 */
export async function POST(request) {
  const traceId = (await getRequestTraceId(request)) || getTraceId() || createTraceId();

  return withTraceId(traceId, async () => {
    const parsed = await parseRequestBody(request, presignUploadSchema);
    if (!parsed.success) {
      return parsed.response;
    }

    const { fileName, contentType, fileSize } = parsed.data;

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

    const sanitizedFileName = fileName
      .toLowerCase()
      .replace(/[^a-z0-9.-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const timestamp = Date.now();
    const objectKey = `uploads/${userId}/${timestamp}-${sanitizedFileName}`;

    const signedUpload = generateSignedUploadUrl({
      objectKey,
      contentType,
      fileSize,
      expiresInSeconds: 900, // 15 minutes per PRD 5.5
    });

    logger.info(
      {
        action: "storage.upload_presigned",
        traceId,
        userId,
        objectKey,
        provider: signedUpload.provider,
      },
      "Generated signed direct upload URL"
    );

    return successResponse({
      uploadUrl: signedUpload.uploadUrl,
      objectKey: signedUpload.objectKey,
      expiresIn: signedUpload.expiresIn,
      method: signedUpload.method,
      headers: signedUpload.headers,
      provider: signedUpload.provider,
    });
  });
}
