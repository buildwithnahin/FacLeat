import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { overtimeService } from '@/server/services/overtime.service';
import {
  overtimeManagerApprovalSchema,
  overtimeHrVerificationSchema,
  overtimeAccountsApprovalSchema,
} from '@/server/validators/overtime';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Single mutation endpoint mirroring the original overtimeStatusAction
 * Server Action's `action` discriminator — keeps the many small approval
 * transitions (submit / cancel / post-payroll / manager|hr|accounts
 * approve|reject|sendback) as one route instead of a dozen near-identical
 * ones.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? '');
  if (!action) return Response.json(apiError('Missing action'), { status: 422 });

  try {
    if (action === 'submit') {
      await overtimeService.submit(session, id);
    } else if (action === 'cancel') {
      await overtimeService.cancel(session, id);
    } else if (action === 'post-payroll') {
      await overtimeService.postToPayroll(session, id);
    } else if (action === 'manager-approve' || action === 'manager-reject' || action === 'manager-sendback') {
      const decision = action === 'manager-approve' ? 'APPROVED' : action === 'manager-reject' ? 'REJECTED' : 'SENT_BACK';
      const parsed = overtimeManagerApprovalSchema.safeParse({
        id,
        decision,
        approvedOtMinutes: body?.approvedOtMinutes ?? undefined,
        remarks: body?.remarks ?? '',
      });
      if (!parsed.success) return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
      await overtimeService.managerApproval(session, parsed.data);
    } else if (action === 'hr-verify' || action === 'hr-reject' || action === 'hr-sendback') {
      const decision = action === 'hr-verify' ? 'VERIFIED' : action === 'hr-reject' ? 'REJECTED' : 'SENT_BACK';
      const parsed = overtimeHrVerificationSchema.safeParse({
        id,
        decision,
        verifiedMinutes: body?.verifiedMinutes ?? undefined,
        remarks: body?.remarks ?? '',
      });
      if (!parsed.success) return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
      await overtimeService.hrVerification(session, parsed.data);
    } else if (action === 'accounts-approve' || action === 'accounts-reject' || action === 'accounts-correction') {
      const decision = action === 'accounts-approve' ? 'APPROVED' : action === 'accounts-reject' ? 'REJECTED' : 'CORRECTION_REQUESTED';
      const parsed = overtimeAccountsApprovalSchema.safeParse({
        id,
        decision,
        otRate: body?.otRate ?? undefined,
        payrollMonth: body?.payrollMonth ?? '',
        costCenter: body?.costCenter ?? '',
        remarks: body?.remarks ?? '',
      });
      if (!parsed.success) return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
      await overtimeService.accountsApproval(session, parsed.data);
    } else {
      return Response.json(apiError('Unknown action'), { status: 422 });
    }
    return Response.json(apiOk({ id }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/hr/overtime/[id]/status failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
