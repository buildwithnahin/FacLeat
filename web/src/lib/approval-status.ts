import { backendFetch } from '@/lib/backend-client';
import type { AppSession } from '@/server/auth/session';

export interface EntityApprovalRequest {
  id: string;
  status: string;
}

/**
 * Looks up whether an entity already has an active (non-terminal) approval
 * request against it. Fetched once per detail page and used for two things:
 * rendering the "pending approval" banner, and — just as importantly —
 * deciding whether to show that entity's own direct Approve/Reject buttons
 * at all. Approval bypass is never allowed (see CLAUDE.md), so once a
 * formal approval request exists, calling the direct decide action again
 * always fails server-side (ForbiddenError: "Approval is pending for ...").
 * Showing those buttons anyway makes them look broken — clicking does
 * nothing, with no error surfaced — so callers should gate on
 * `!approvalRequest` alongside their own status checks.
 */
export async function getEntityApprovalRequest(
  session: AppSession | null,
  module: string,
  entityType: string,
  entityId: string,
): Promise<EntityApprovalRequest | null> {
  if (!session?.permissions.includes('approvals:read')) return null;
  const params = new URLSearchParams({ module, entityType, entityId });
  return backendFetch<EntityApprovalRequest | null>(`/api/mobile/approvals/for-entity?${params}`);
}
