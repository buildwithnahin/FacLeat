'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { backendFetch, BackendApiError } from '@/lib/backend-client';

// Thin wrapper for the simpler `/hr/payroll` list+detail pages (distinct
// from the full `/hr/payroll-run` calculation engine). Deliberately kept out
// of `@/server/actions/hr` — that filename is shared with the employees /
// attendance / leaves pages other HR agents own in parallel, so a dedicated
// file here avoids a merge collision on the same path.
export type FormState = { error?: string; success?: boolean; id?: string } | undefined;

export async function createPayrollRunAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const branchId = String(fd.get('branchId') ?? '');
  const period = String(fd.get('period') ?? '');
  const notes = String(fd.get('notes') ?? '');

  if (!branchId || !period) return { error: 'Branch and period are required' };

  try {
    const run = await backendFetch<{ id: string }>('/api/mobile/hr/payroll/runs', {
      method: 'POST',
      body: JSON.stringify({ branchId, period, notes }),
    });
    revalidatePath('/hr/payroll');
    return { success: true, id: run.id };
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
}

export async function payrollStatusAction(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  const action = String(fd.get('action') ?? '');
  if (!id) return;

  try {
    await backendFetch(`/api/mobile/hr/payroll/runs/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return;
    throw e;
  }
  revalidatePath('/hr/payroll');
  revalidatePath(`/hr/payroll/${id}`);
  if (action === 'cancel') {
    redirect('/hr/payroll');
  }
}
