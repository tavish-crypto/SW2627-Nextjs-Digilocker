import { requireRole } from "@/src/lib/auth";
import { getDocuments, getVaultStats } from "@/src/lib/documents";
import { API_ERROR_CODES, errorResponse, successResponse } from "@/src/lib/api-validation";

export async function GET() {
  try {
    const adminUser = await requireRole("admin");
    const [documents, stats] = await Promise.all([
      getDocuments(),
      getVaultStats(),
    ]);

    return successResponse({
      admin: {
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
      },
      stats: {
        totalDocuments: documents.length,
        totalCategories: stats.totalCategories,
        storageQuotaMB: stats.storageQuotaMB,
      },
    });
  } catch (err) {
    const status = err?.statusCode === 401 || err?.statusCode === 403 ? err.statusCode : 500;
    const code = status === 401 ? API_ERROR_CODES.UNAUTHORIZED :
      status === 403 ? API_ERROR_CODES.FORBIDDEN : API_ERROR_CODES.INTERNAL_SERVER_ERROR;
    const message = status === 401
      ? "Authentication required"
      : status === 403
        ? "You do not have permission to perform this action"
        : "Unable to fetch admin data";
    return errorResponse({ code, message, status });
  }
}
