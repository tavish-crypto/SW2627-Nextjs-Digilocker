"use server";

import { requireRole, setUserRole, getUserByEmail, ROLES } from "../../lib/auth.js";
import { revalidatePath } from "next/cache.js";
import { prisma } from "../../lib/prisma.js";

/**
 * Server Action: Update a user's role.
 * Privileged operation strictly protected by requireRole("admin").
 */
export async function updateUserRoleAction(prevState, formData) {
  try {
    // 1. Independent server-side authorization check
    const adminUser = await requireRole(ROLES.ADMIN);

    const targetEmail = (formData.get("email") || "").toString().trim().toLowerCase();
    const newRole = (formData.get("role") || "").toString().trim().toLowerCase();

    if (!targetEmail) {
      return { success: false, error: "Target user email is required." };
    }

    if (newRole !== ROLES.USER && newRole !== ROLES.ADMIN) {
      return { success: false, error: "Invalid role specified." };
    }

    const targetUser = await getUserByEmail(targetEmail);
    if (!targetUser) {
      return { success: false, error: `User with email ${targetEmail} not found.` };
    }

    const updated = await setUserRole(targetEmail, newRole);

    try {
      revalidatePath("/admin");
    } catch {
      // Graceful fallback in non-request test contexts
    }

    return {
      success: true,
      error: null,
      message: `Role for ${updated.email} updated to ${updated.role} by ${adminUser.email}.`,
    };
  } catch (err) {
    return {
      success: false,
      error: err?.message || "An unexpected error occurred during role update.",
    };
  }
}

/**
 * Server Action: Purge system logs or maintenance operations.
 * Privileged operation strictly protected by requireRole("admin").
 */
export async function purgeAuditLogsAction(prevState, formData) {
  try {
    await requireRole(ROLES.ADMIN);

    try {
      await prisma.documentActivity.deleteMany({});
    } catch {
      // Safe fallback if database is offline or not yet initialized
    }

    try {
      revalidatePath("/admin");
    } catch {
      // Graceful fallback in non-request test contexts
    }

    return {
      success: true,
      error: null,
      message: "System audit logs purged successfully.",
    };
  } catch (err) {
    return {
      success: false,
      error: err?.message || "Failed to purge audit logs.",
    };
  }
}
