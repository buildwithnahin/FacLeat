import { AlertBanner } from '@/components/shared/alert-banner';

/**
 * Renders the message a decision action (approve/reject/cancel) redirected
 * back with — see lib/decision-notice.ts. Every message that reaches here
 * came from a caught BackendApiError, so it's always worth showing: either
 * the action was blocked by a pending/required approval workflow, or some
 * other real backend error the user needs to see instead of a silently
 * dead button.
 */
export function DecisionNoticeBanner({ notice }: { notice?: string }) {
  if (!notice) return null;
  return (
    <AlertBanner tone="warning" title={notice} />
  );
}
