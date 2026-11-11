import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError, ValidationError } from '@/lib/errors';
import { accountsService } from '@/server/services/accounts.service';
import { storeVoucherImage } from '@/lib/voucher-image';

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  const type = sp.get('type') === 'CASH_OUT' ? 'CASH_OUT' : 'CASH_IN';

  try {
    const rows = await accountsService.listCashEntries(session, {
      type,
      branchId: sp.get('branchId') ?? session.activeBranchId ?? undefined,
      from: sp.get('from') ? new Date(sp.get('from')!) : undefined,
      to: sp.get('to') ? new Date(sp.get('to')!) : undefined,
    });

    const mapped = rows.map((r) => ({
      id: r.id,
      number: r.number,
      date: r.date,
      amount: r.amount,
      totalAmount: r.totalAmount,
      taxAmount: r.taxAmount ?? null,
      contactName: r.contact?.name ?? r.contactName ?? null,
      contactType: r.contact?.type ?? r.contactType ?? null,
      receiveMode: r.receiveMode,
      payMode: r.receiveMode,
      category: r.category,
      reference: r.reference ?? null,
      projectName: r.projectName ?? null,
      remarks: r.remarks ?? null,
      branchName: r.branch.name,
      sourceModule: r.sourceModule ?? null,
      sourceRefId: r.sourceRefId ?? null,
      imageUrl: r.imageUrl ?? null,
    }));
    return Response.json(apiOk(mapped));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/accounts/cash-entries failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });
  if (!session.activeBranchId) {
    return Response.json(apiError(new ValidationError('No active branch selected')), { status: 422 });
  }

  try {
    const formData = await req.formData();
    const type = formString(formData, 'type') === 'CASH_OUT' ? 'CASH_OUT' : 'CASH_IN';
    const imageUrl = await storeVoucherImage(formData);

    // `receiveMode` doubles as `payMode` on the outbound side — the service's
    // CashEntry model has one generic mode column, matching root's
    // createCashOutAction which maps formData's `payMode` onto the same field.
    const receiveMode =
      type === 'CASH_OUT' ? formString(formData, 'payMode') : formString(formData, 'receiveMode');

    const entry = await accountsService.createCashEntry(session, {
      type,
      branchId: session.activeBranchId,
      date: new Date(formString(formData, 'date')),
      amount: formString(formData, 'amount'),
      taxPercent: formString(formData, 'taxPercent') || undefined,
      contactId: formString(formData, 'contactId') || undefined,
      contactName: formString(formData, 'contactName') || undefined,
      contactType: formString(formData, 'contactType') || undefined,
      receiveMode,
      category: formString(formData, 'category'),
      reference: formString(formData, 'reference') || undefined,
      projectName: formString(formData, 'projectName') || undefined,
      remarks: formString(formData, 'remarks') || undefined,
      imageUrl,
    });

    return Response.json(
      apiOk({
        id: entry.id,
        number: entry.number,
        date: entry.date,
        amount: entry.amount,
        totalAmount: entry.totalAmount,
        taxAmount: entry.taxAmount ?? null,
        contactName: entry.contact?.name ?? entry.contactName ?? null,
        contactType: entry.contact?.type ?? entry.contactType ?? null,
        receiveMode: entry.receiveMode,
        payMode: entry.receiveMode,
        category: entry.category,
        reference: entry.reference ?? null,
        projectName: entry.projectName ?? null,
        remarks: entry.remarks ?? null,
        branchName: entry.branch.name,
        imageUrl: entry.imageUrl ?? null,
      }),
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/accounts/cash-entries failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
