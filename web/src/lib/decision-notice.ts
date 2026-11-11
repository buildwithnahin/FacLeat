import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { BackendApiError } from '@/lib/backend-client';

/**
 * Runs a direct-decision backend call (approve/reject/cancel) and always
 * gives the user visible feedback afterward — including, critically, when
 * the call didn't actually apply because a formal approval workflow
 * intervened (ForbiddenError: "Approval is pending/requested for ...").
 * That case used to be caught and silently discarded, so the Approve/Reject
 * buttons looked completely dead — clicking did nothing, no error, no
 * navigation, nothing. Approval bypass is never allowed (see CLAUDE.md), so
 * this can't be "fixed" by letting the click through — it can only be
 * fixed by actually telling the user what happened.
 */
export async function runDecisionAndRedirect(
  run: () => Promise<void>,
  detailPath: string,
  listPath: string,
): Promise<never> {
  let notice: string | null = null;
  try {
    await run();
  } catch (e) {
    if (!(e instanceof BackendApiError)) throw e;
    notice = e.message;
  }
  revalidatePath(listPath);
  revalidatePath(detailPath);
  redirect(notice ? `${detailPath}?notice=${encodeURIComponent(notice)}` : detailPath);
}
