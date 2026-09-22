"use server";

import { revalidatePath } from "next/cache.js";
import { redirect } from "next/navigation.js";
import { cookies } from "next/headers.js";
import {
  createDocument as createDocumentService,
  updateDocument as updateDocumentService,
  deleteDocument as deleteDocumentService,
  createShareLink as createShareLinkService,
  deleteShareLink as deleteShareLinkService,
  getDocumentById,
} from "../../../lib/documents.js";
import { getCurrentUser } from "../../../lib/auth.js";
import {
  createDocumentSchema,
  updateDocumentSchema,
  deleteDocumentSchema,
  createShareLinkActionSchema,
  revokeShareLinkActionSchema,
  formatActionErrors,
} from "../../../lib/api-validation.js";

const ALLOWED_TYPES = ["PDF", "DOCX", "JPG", "JPEG", "PNG", "WEBP", "XML", "JSON"];

/**
 * Helper to safely trigger path revalidation across both Next.js request lifecycle
 * and test runner environments.
 */
function safeRevalidatePath(path) {
  try {
    revalidatePath(path);
  } catch {
    // Graceful no-op when invoked outside Next.js request context
  }
}

/**
 * Helper to extract FormData regardless of whether the action is invoked via
 * React 19's useActionState (prevState, formData) or directly (formData).
 */
function extractFormData(firstArg, secondArg) {
  if (secondArg && typeof secondArg.get === "function") {
    return secondArg;
  }
  if (firstArg && typeof firstArg.get === "function") {
    return firstArg;
  }
  return new FormData();
}

/**
 * Helper to authenticate and authorize the current session on the server.
 * Ensures the caller is verified before any mutation occurs.
 */
async function requireAuth() {
  if (process.env.NEXT_PUBLIC_AUTH_ENABLED === "true") {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error("Unauthorized: Active user session required.");
    }
    return { userId: user.id };
  }

  try {
    const cookieStore = await cookies();
    const userId = cookieStore?.get?.("demo-user")?.value || "demo-user";
    if (!userId) {
      throw new Error("Unauthorized: Active user session required.");
    }
    return { userId };
  } catch (err) {
    if (err?.message?.includes("Unauthorized")) {
      throw err;
    }
    return { userId: "demo-user" };
  }
}

/**
 * Server Action: Create a new document in the vault.
 * Supports useActionState(createDocument, initialState) signature (prevState, formData)
 * as well as direct form action invocation createDocument(formData).
 *
 * Pattern:
 * 1. Validate input on the server using Zod safeParse
 * 2. Return field-level validation errors if invalid (no throwing)
 * 3. Authenticate and authorize session
 * 4. Execute mutation
 * 5. Revalidate affected cache paths
 * 6. Redirect or return structured success state
 */
export async function createDocument(prevState, formData) {
  const form = extractFormData(prevState, formData);

  const rawInput = {
    title: form.get("title") ?? "",
    description: form.get("description") || undefined,
    type: form.get("type") || "PDF",
    size: form.get("size") || undefined,
  };

  const validationResult = createDocumentSchema.safeParse(rawInput);
  if (!validationResult.success) {
    return {
      errors: formatActionErrors(validationResult.error),
      data: null,
    };
  }

  try {
    await requireAuth();

    const newDocument = await createDocumentService({
      title: validationResult.data.title,
      description: validationResult.data.description || "Uploaded vault document.",
      type: validationResult.data.type,
      size: validationResult.data.size,
    });

    // Invalidate affected caches only after successful mutation
    safeRevalidatePath("/documents");
    safeRevalidatePath("/dashboard");
    safeRevalidatePath(`/documents/${newDocument.id}`);

    try {
      redirect(`/documents/${newDocument.id}`);
    } catch (redirectErr) {
      if (
        redirectErr?.digest?.startsWith("NEXT_REDIRECT") ||
        redirectErr?.message?.includes("NEXT_REDIRECT")
      ) {
        throw redirectErr;
      }
      return { errors: null, data: newDocument };
    }
  } catch (err) {
    if (
      err?.digest?.startsWith("NEXT_REDIRECT") ||
      err?.message?.includes("NEXT_REDIRECT")
    ) {
      throw err;
    }

    const formError = err?.message?.includes("Unauthorized")
      ? "Unauthorized: Active user session required."
      : "Could not save right now";

    return {
      errors: {
        _form: [formError],
      },
      data: null,
    };
  }
}

/**
 * Server Action: Update metadata for an existing document.
 * Receives (prevState, formData) from useActionState.
 */
export async function updateDocument(prevState, formData) {
  const form = extractFormData(prevState, formData);

  const rawInput = {
    documentId: form.get("documentId") ?? "",
    title: form.get("title") ?? "",
    description: form.get("description") || undefined,
    type: form.get("type") || undefined,
  };

  const validationResult = updateDocumentSchema.safeParse(rawInput);
  if (!validationResult.success) {
    return {
      errors: formatActionErrors(validationResult.error),
      data: null,
    };
  }

  try {
    await requireAuth();

    const existingDoc = await getDocumentById(validationResult.data.documentId);
    if (!existingDoc) {
      return {
        errors: {
          _form: ["Document does not exist or has been removed."],
        },
        data: null,
      };
    }

    const updated = await updateDocumentService(validationResult.data.documentId, {
      title: validationResult.data.title,
      description: validationResult.data.description,
      type: validationResult.data.type,
    });

    // Invalidate all affected vault views
    safeRevalidatePath("/documents");
    safeRevalidatePath("/dashboard");
    safeRevalidatePath(`/documents/${validationResult.data.documentId}`);

    return { errors: null, data: updated };
  } catch (err) {
    const formError = err?.message?.includes("Unauthorized")
      ? "Unauthorized: Active user session required."
      : "Could not save right now";

    return {
      errors: {
        _form: [formError],
      },
      data: null,
    };
  }
}

/**
 * Server Action: Delete a document from the vault.
 * Receives (prevState, formData) from useActionState.
 */
export async function deleteDocument(prevState, formData) {
  const form = extractFormData(prevState, formData);

  const rawInput = {
    documentId: form.get("documentId") ?? "",
  };

  const validationResult = deleteDocumentSchema.safeParse(rawInput);
  if (!validationResult.success) {
    return {
      errors: formatActionErrors(validationResult.error),
      data: null,
    };
  }

  try {
    await requireAuth();

    const existingDoc = await getDocumentById(validationResult.data.documentId);
    if (!existingDoc) {
      return {
        errors: {
          _form: ["Document does not exist or has been removed."],
        },
        data: null,
      };
    }

    await deleteDocumentService(validationResult.data.documentId);

    // Invalidate vault listings
    safeRevalidatePath("/documents");
    safeRevalidatePath("/dashboard");
    safeRevalidatePath(`/documents/${validationResult.data.documentId}`);

    try {
      redirect("/documents");
    } catch (redirectErr) {
      if (
        redirectErr?.digest?.startsWith("NEXT_REDIRECT") ||
        redirectErr?.message?.includes("NEXT_REDIRECT")
      ) {
        throw redirectErr;
      }
      return { errors: null, data: true };
    }
  } catch (err) {
    if (
      err?.digest?.startsWith("NEXT_REDIRECT") ||
      err?.message?.includes("NEXT_REDIRECT")
    ) {
      throw err;
    }

    const formError = err?.message?.includes("Unauthorized")
      ? "Unauthorized: Active user session required."
      : "Could not delete document right now";

    return {
      errors: {
        _form: [formError],
      },
      data: null,
    };
  }
}

/**
 * Server Action: Generate a secure, expiring share link for a document.
 * Receives (prevState, formData) from useActionState.
 */
export async function createShareLink(prevState, formData) {
  const form = extractFormData(prevState, formData);

  const rawInput = {
    documentId: form.get("documentId") ?? "",
    expiresInMinutes: form.get("expiresInMinutes") ?? undefined,
  };

  const validationResult = createShareLinkActionSchema.safeParse(rawInput);
  if (!validationResult.success) {
    return {
      errors: formatActionErrors(validationResult.error),
      data: null,
    };
  }

  try {
    await requireAuth();

    const existingDoc = await getDocumentById(validationResult.data.documentId);
    if (!existingDoc) {
      return {
        errors: {
          _form: ["Document does not exist."],
        },
        data: null,
      };
    }

    const link = await createShareLinkService(validationResult.data.documentId, {
      expiresInMinutes: validationResult.data.expiresInMinutes,
    });

    safeRevalidatePath(`/documents/${validationResult.data.documentId}`);

    return { errors: null, data: link };
  } catch (err) {
    const formError = err?.message?.includes("Unauthorized")
      ? "Unauthorized: Active user session required."
      : "Could not create share link right now";

    return {
      errors: {
        _form: [formError],
      },
      data: null,
    };
  }
}

/**
 * Server Action: Revoke an existing share link for a document.
 * Receives (prevState, formData) from useActionState.
 */
export async function revokeShareLink(prevState, formData) {
  const form = extractFormData(prevState, formData);

  const rawInput = {
    documentId: form.get("documentId") ?? "",
    linkId: form.get("linkId") ?? "",
  };

  const validationResult = revokeShareLinkActionSchema.safeParse(rawInput);
  if (!validationResult.success) {
    return {
      errors: formatActionErrors(validationResult.error),
      data: null,
    };
  }

  try {
    await requireAuth();

    await deleteShareLinkService(
      validationResult.data.documentId,
      validationResult.data.linkId
    );

    safeRevalidatePath(`/documents/${validationResult.data.documentId}`);

    return { errors: null, data: true };
  } catch (err) {
    const formError = err?.message?.includes("Unauthorized")
      ? "Unauthorized: Active user session required."
      : "Could not revoke share link right now";

    return {
      errors: {
        _form: [formError],
      },
      data: null,
    };
  }
}

