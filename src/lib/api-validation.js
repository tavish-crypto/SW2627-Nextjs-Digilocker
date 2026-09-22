import { z } from "zod";
import {
  API_ERROR_CODES,
  errorResponse,
  formatValidationDetails,
  getValidationErrorResponse,
  successResponse,
} from "./api/index.js";

export { API_ERROR_CODES, errorResponse, formatValidationDetails, successResponse };

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_PAGE_SIZE = 100;
const allowedContentTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/xml",
  "application/json",
];

const documentId = z.string().trim().min(1).max(128);
const fileName = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine((value) => !/[\\/]/.test(value), "File name must not contain a path");
const contentType = z.enum(allowedContentTypes);
const fileSize = z.number().int().positive().max(MAX_FILE_SIZE_BYTES);

export const documentQuerySchema = z
  .object({
    cursor: z.string().trim().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  })
  .strict();

export const documentIdSchema = documentId;

export const presignUploadSchema = z
  .object({
    fileName,
    contentType,
    fileSize,
  })
  .strict();

export const completeUploadSchema = z
  .object({
    documentId: documentId.optional(),
    objectKey: z.string().trim().min(1).max(1024),
    fileName,
    contentType,
    fileSize,
  })
  .strict();

export const createShareLinkSchema = z
  .object({
    expiresInMinutes: z.union([z.literal(10), z.literal(60), z.literal(1440)]),
    pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits").optional(),
    maxViews: z.union([z.literal(1), z.literal(3), z.literal(5)]).optional(),
  })
  .strict();

export const shareTokenSchema = z.string().trim().min(1).max(512);

export const uploadPresignSchema = presignUploadSchema;
export const uploadCompleteSchema = completeUploadSchema;
export const shareLinkSchema = createShareLinkSchema;

export const ALLOWED_DOCUMENT_TYPES = [
  "PDF",
  "DOCX",
  "JPG",
  "JPEG",
  "PNG",
  "WEBP",
  "XML",
  "JSON",
];

export const createDocumentSchema = z.object({
  title: z
    .string({ required_error: "Document title is required." })
    .trim()
    .min(1, "Document title is required.")
    .max(120, "Document title cannot exceed 120 characters."),
  type: z
    .string()
    .trim()
    .transform((val) => val.toUpperCase())
    .refine(
      (val) => ALLOWED_DOCUMENT_TYPES.includes(val),
      (val) => ({ message: `Unsupported document format "${val}".` })
    )
    .default("PDF"),
  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters.")
    .optional()
    .default(""),
  size: z
    .string()
    .trim()
    .max(50, "File size string cannot exceed 50 characters.")
    .optional()
    .default("1.2 MB"),
});

export const updateDocumentSchema = z.object({
  documentId: z.string().trim().min(1, "Missing document ID."),
  title: z
    .string({ required_error: "Document title cannot be empty." })
    .trim()
    .min(1, "Document title cannot be empty.")
    .max(120, "Document title cannot exceed 120 characters."),
  type: z
    .string()
    .trim()
    .transform((val) => val.toUpperCase())
    .refine(
      (val) => ALLOWED_DOCUMENT_TYPES.includes(val),
      (val) => ({ message: `Unsupported document format "${val}".` })
    )
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters.")
    .optional(),
});

export const deleteDocumentSchema = z.object({
  documentId: z.string().trim().min(1, "Missing document ID."),
});

export const createShareLinkActionSchema = z.object({
  documentId: z.string().trim().min(1, "Missing document ID."),
  expiresInMinutes: z.coerce
    .number({ invalid_type_error: "Expiration duration must be a positive number." })
    .int("Expiration duration must be an integer.")
    .positive("Expiration duration must be a positive number.")
    .default(60),
});

export const revokeShareLinkActionSchema = z.object({
  documentId: z.string().trim().min(1, "Missing document ID."),
  linkId: z.string().trim().min(1, "Missing share link ID."),
});

export function formatActionErrors(error) {
  if (!error) return null;
  const flattened = error.flatten?.();
  if (flattened?.fieldErrors) {
    return flattened.fieldErrors;
  }
  const errors = {};
  for (const issue of error.issues || []) {
    const key = issue.path[0] ? String(issue.path[0]) : "_form";
    if (!errors[key]) {
      errors[key] = [];
    }
    errors[key].push(issue.message);
  }
  return errors;
}

export function formatValidationErrors(error) {
  return error.issues.map(({ path, message }) => ({
    path: path.join("."),
    message,
  }));
}
export async function parseRequestBody(request, schema) {
  let body;

  try {
    body = await request.json();
  } catch {
    return {
      success: false,
      response: errorResponse({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: "Invalid JSON payload",
        status: 400,
      }),
    };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      success: false,
      response: getValidationErrorResponse(result.error, body),
    };
  }

  return { success: true, data: result.data };
}

