import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError, ValidationError } from '@/lib/errors';
import { accountsService } from '@/server/services/accounts.service';
import { storeVoucherImage } from '@/lib/voucher-image';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  const branchId = sp.get('branchId') ?? session.activeBranchId ?? undefined;
  if (!branchId) return Response.json(apiOk([]));

  const direction = sp.get('direction') === 'RECEIVED' ? 'RECEIVED' : 'SENT';

  try {
    const transfers = await accountsService.listCashTransfers(session, {
      branchId,
      direction,
      from: sp.get('from') ? new Date(sp.get('from')!) : undefined,
      to: sp.get('to') ? new Date(sp.get('to')!) : undefined,
    });
    return Response.json(apiOk(transfers));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/accounts/cash-transfers failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });
  if (!session.activeBranchId) {
    return Response.json(apiError(new ValidationError('No active branch selected')), { status: 422 });
  }

  try {
    const formData = await req.formData();
    const imageUrl = await storeVoucherImage(formData);
    const transfer = await accountsService.createCashTransfer(session, {
      fromBranchId: session.activeBranchId,
      toBranchId: formString(formData, 'toBranchId'),
      amount: formString(formData, 'amount'),
      transferDate: new Date(formString(formData, 'transferDate')),
      transferVia: formString(formData, 'transferVia') || undefined,
      reference: formString(formData, 'reference') || undefined,
      remarks: formString(formData, 'remarks'),
      imageUrl,
    });
    return Response.json(
      apiOk({ id: transfer.id, number: transfer.number, toBranch: transfer.toBranch.name }),
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/accounts/cash-transfers failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
