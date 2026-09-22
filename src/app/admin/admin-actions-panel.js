"use client";

import { useActionState } from "react";
import { updateUserRoleAction, purgeAuditLogsAction } from "./actions.js";

const initialRoleState = { success: false, error: null, message: null };
const initialPurgeState = { success: false, error: null, message: null };

export function AdminActionsPanel() {
  const [roleState, roleAction, isRolePending] = useActionState(
    updateUserRoleAction,
    initialRoleState
  );

  const [purgeState, purgeAction, isPurgePending] = useActionState(
    purgeAuditLogsAction,
    initialPurgeState
  );

  return (
    <div className="space-y-6">
      {/* Role Management Form */}
      <div className="rounded-lg border border-black/10 p-6 dark:border-white/15">
        <h2 className="text-lg font-semibold mb-1">Manage User Roles</h2>
        <p className="text-sm text-foreground/75 mb-4">
          Privileged action: Change an existing account&apos;s authorization role.
        </p>

        <form action={roleAction} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="user-email" className="block text-sm font-medium mb-1">
                User Email
              </label>
              <input
                id="user-email"
                name="email"
                type="email"
                required
                placeholder="user@example.com"
                className="w-full rounded border border-black/15 px-3 py-2 text-sm bg-background dark:border-white/20"
              />
            </div>
            <div>
              <label htmlFor="user-role" className="block text-sm font-medium mb-1">
                New Role
              </label>
              <select
                id="user-role"
                name="role"
                defaultValue="user"
                className="w-full rounded border border-black/15 px-3 py-2 text-sm bg-background dark:border-white/20"
              >
                <option value="user">User (Standard)</option>
                <option value="admin">Admin (Privileged)</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={isRolePending}
            className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isRolePending ? "Updating Role..." : "Update Role"}
          </button>

          {roleState.error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {roleState.error}
            </p>
          )}
          {roleState.message && (
            <p role="status" className="text-sm text-green-600 dark:text-green-400">
              {roleState.message}
            </p>
          )}
        </form>
      </div>

      {/* Privileged Maintenance Section */}
      <div className="rounded-lg border border-black/10 p-6 dark:border-white/15">
        <h2 className="text-lg font-semibold mb-1">System Maintenance</h2>
        <p className="text-sm text-foreground/75 mb-4">
          Trigger administrator maintenance tasks and audit log rotation.
        </p>

        <form action={purgeAction}>
          <button
            type="submit"
            disabled={isPurgePending}
            className="rounded border border-red-600/30 bg-red-50 dark:bg-red-950/30 px-4 py-2 text-sm font-medium text-red-700 dark:text-red-300 transition-colors hover:bg-red-100 dark:hover:bg-red-950/50 disabled:opacity-50"
          >
            {isPurgePending ? "Purging..." : "Purge Audit Logs"}
          </button>

          {purgeState.error && (
            <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
              {purgeState.error}
            </p>
          )}
          {purgeState.message && (
            <p role="status" className="mt-2 text-sm text-green-600 dark:text-green-400">
              {purgeState.message}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
