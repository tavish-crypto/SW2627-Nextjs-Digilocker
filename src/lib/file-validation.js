/**
 * Client and Server File Validation Utilities
 * 
 * Implements PRD Section 5.4 and 5.6 requirements:
 * - 10 MB max file size limit
 * - Supported formats: PDF, JPG, JPEG, PNG, WEBP, DOCX, XML, JSON
 * - Pre-flight client-side rejection without making server network requests
 */

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB in bytes

export const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".xml",
  ".json",
];

export const EXTENSION_TO_TYPE = {
  pdf: "PDF",
  docx: "DOCX",
  jpg: "JPG",
  jpeg: "JPG",
  png: "PNG",
  webp: "WEBP",
  xml: "XML",
  json: "JSON",
};

export const MIME_TO_TYPE = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "image/jpeg": "JPG",
  "image/jpg": "JPG",
  "image/png": "PNG",
  "image/webp": "WEBP",
  "application/xml": "XML",
  "text/xml": "XML",
  "application/json": "JSON",
};

export const ALLOWED_MIME_TYPES = Object.keys(MIME_TO_TYPE);

/**
 * Format bytes to readable string (e.g. "1.5 MB", "850 KB")
 */
export function formatFileSize(bytes) {
  if (typeof bytes !== "number" || isNaN(bytes) || bytes < 0) {
    return "0 B";
  }
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const unitIndex = Math.min(i, units.length - 1);
  const value = bytes / Math.pow(1024, unitIndex);

  // Format integer if clean, or 1 decimal place
  return `${Number(value.toFixed(1))} ${units[unitIndex]}`;
}

/**
 * Detect document type (e.g. "PDF", "DOCX", "JPG") from file name and MIME type
 */
export function detectDocumentType(fileName = "", mimeType = "") {
  // First attempt mapping via MIME type
  if (mimeType && MIME_TO_TYPE[mimeType.toLowerCase()]) {
    return MIME_TO_TYPE[mimeType.toLowerCase()];
  }

  // Fallback to file extension
  const extMatch = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (extMatch && extMatch[1] && EXTENSION_TO_TYPE[extMatch[1]]) {
    return EXTENSION_TO_TYPE[extMatch[1]];
  }

  return null;
}

/**
 * Extract clean title from file name (removes extension and cleans up hyphens/underscores)
 */
export function extractTitleFromFileName(fileName = "") {
  if (!fileName) return "";
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
  return nameWithoutExt
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Client-side file validator.
 * 
 * Rules:
 * 1. IF file.size > 10 MB -> "File is larger than the 10 MB limit."
 * 2. IF file.type is not allowed -> "This file type is not supported."
 * 
 * @param {File | { name: string, size: number, type?: string }} file
 * @returns {{ valid: boolean, error: string | null, details?: { detectedType: string, formattedSize: string, title: string, mimeType: string } }}
 */
export function validateFile(file) {
  if (!file) {
    return {
      valid: false,
      error: "Please select a file to upload.",
    };
  }

  const fileName = file.name || "";
  const fileSize = typeof file.size === "number" ? file.size : 0;
  const fileMime = file.type || "";

  // 1. Check size limit (10 MB)
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: "File is larger than the 10 MB limit.",
    };
  }

  // 2. Check format / type
  const detectedType = detectDocumentType(fileName, fileMime);
  if (!detectedType) {
    return {
      valid: false,
      error: "This file type is not supported.",
    };
  }

  return {
    valid: true,
    error: null,
    details: {
      detectedType,
      formattedSize: formatFileSize(fileSize),
      title: extractTitleFromFileName(fileName),
      mimeType: fileMime || `application/${detectedType.toLowerCase()}`,
    },
  };
}
