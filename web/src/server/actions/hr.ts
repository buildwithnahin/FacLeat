'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import {
  hrMasterDataCreateSchema,
  hrMasterDataUpdateSchema,
  hrWorkflowRecordCreateSchema,
  hrWorkflowRecordUpdateSchema,
  employeeCreateSchema,
  employeeUpdateSchema,
  attendanceMarkSchema,
} from '@/server/validators/hr';

export type FormState =
  | { error?: string; fieldErrors?: Record<string, string[]>; success?: boolean; id?: string }
  | undefined;

function parseEmployeeForm(fd: FormData) {
  const num = (k: string) => fd.get(k) ?? 0;
  return {
    branchId: fd.get('branchId'),
    code: String(fd.get('code') ?? '').toUpperCase(),
    firstName: fd.get('firstName'),
    lastName: fd.get('lastName'),
    email: fd.get('email') ?? '',
    phone: fd.get('phone') ?? '',
    designation: fd.get('designation') ?? '',
    department: fd.get('department') ?? '',
    employmentType: fd.get('employmentType') ?? '',
    shiftId: fd.get('shiftId') ?? '',
    reportingManagerId: fd.get('reportingManagerId') ?? '',
    systemRoleId: fd.get('systemRoleId') ?? '',
    joinedAt: fd.get('joinedAt'),
    status: fd.get('status') ?? 'ACTIVE',
    basicSalary: num('basicSalary'),
    houseAllowance: num('houseAllowance'),
    transportAllowance: num('transportAllowance'),
    medicalAllowance: num('medicalAllowance'),
    otherAllowance: num('otherAllowance'),
    providentFund: num('providentFund'),
    taxDeduction: num('taxDeduction'),
    bankName: fd.get('bankName') ?? '',
    bankAccount: fd.get('bankAccount') ?? '',
  };
}

export async function createEmployeeAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = employeeCreateSchema.safeParse(parseEmployeeForm(fd));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await backendFetch('/api/mobile/hr/employees', { method: 'POST', body: JSON.stringify(parsed.data) });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/hr/employees');
  redirect('/hr/employees');
}

export async function updateEmployeeAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = employeeUpdateSchema.safeParse({ id: fd.get('id'), ...parseEmployeeForm(fd) });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await backendFetch(`/api/mobile/hr/employees/${parsed.data.id}`, {
      method: 'PUT',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/hr/employees');
  redirect('/hr/employees');
}

export async function markAttendanceAction(fd: FormData) {
  const parsed = attendanceMarkSchema.safeParse({
    employeeId: fd.get('employeeId'),
    date: fd.get('date'),
    status: fd.get('status'),
    checkIn: fd.get('checkIn') ?? '',
    checkOut: fd.get('checkOut') ?? '',
    remarks: fd.get('remarks') ?? '',
  });
  if (!parsed.success) {
    console.error('Attendance Validation Error:', parsed.error.flatten().fieldErrors);
    return;
  }
  try {
    await backendFetch('/api/mobile/hr/attendance', { method: 'POST', body: JSON.stringify(parsed.data) });
  } catch (e) {
    if (e instanceof BackendApiError) return;
    throw e;
  }
  revalidatePath('/hr/attendance');
}

export async function createHrMasterDataAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const path = String(fd.get('path') ?? '/hr');
  const parsed = hrMasterDataCreateSchema.safeParse({
    type: fd.get('type'),
    branchId: fd.get('branchId') ?? '',
    code: fd.get('code') ?? '',
    name: fd.get('name'),
    department: fd.get('department') ?? '',
    description: fd.get('description') ?? '',
    status: fd.get('status') ?? 'ACTIVE',
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  try {
    const row = await backendFetch<{ id: string }>('/api/mobile/hr/master-data', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
    revalidatePath(path);
    if (parsed.data.type === 'departments') revalidatePath('/hr/recruitment');
    if (parsed.data.type === 'designations') {
      revalidatePath('/hr/employees/new');
      revalidatePath('/hr/promotions');
      revalidatePath('/hr/recruitment');
    }
    return { success: true, id: row.id };
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
}

export async function updateHrMasterDataAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const path = String(fd.get('path') ?? '/hr');
  const parsed = hrMasterDataUpdateSchema.safeParse({
    id: fd.get('id'),
    type: fd.get('type'),
    branchId: fd.get('branchId') ?? '',
    code: fd.get('code') ?? '',
    name: fd.get('name'),
    department: fd.get('department') ?? '',
    description: fd.get('description') ?? '',
    status: fd.get('status') ?? 'ACTIVE',
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  try {
    await backendFetch(`/api/mobile/hr/master-data/${parsed.data.id}`, {
      method: 'PUT',
      body: JSON.stringify(parsed.data),
    });
    revalidatePath(path);
    if (parsed.data.type === 'departments') revalidatePath('/hr/recruitment');
    if (parsed.data.type === 'designations') {
      revalidatePath('/hr/employees/new');
      revalidatePath('/hr/promotions');
      revalidatePath('/hr/recruitment');
    }
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  redirect(path);
}

export async function createHrWorkflowRecordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const path = String(fd.get('path') ?? '/hr');
  const parsed = hrWorkflowRecordCreateSchema.safeParse({
    section: fd.get('section'),
    branchId: fd.get('branchId') ?? '',
    employeeId: fd.get('employeeId') ?? '',
    title: fd.get('title'),
    subject: fd.get('subject') ?? '',
    status: fd.get('status') ?? 'OPEN',
    priority: fd.get('priority') ?? 'NORMAL',
    startDate: fd.get('startDate') ?? '',
    endDate: fd.get('endDate') ?? '',
    amount: fd.get('amount') ?? '',
    owner: fd.get('owner') ?? '',
    notes: fd.get('notes') ?? '',
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  try {
    const row = await backendFetch<{ id: string }>('/api/mobile/hr/workflow-records', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
    revalidatePath(path);
    return { success: true, id: row.id };
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
}

export async function updateHrWorkflowRecordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const path = String(fd.get('path') ?? '/hr');
  const parsed = hrWorkflowRecordUpdateSchema.safeParse({
    id: fd.get('id'),
    section: fd.get('section'),
    branchId: fd.get('branchId') ?? '',
    employeeId: fd.get('employeeId') ?? '',
    title: fd.get('title'),
    subject: fd.get('subject') ?? '',
    status: fd.get('status') ?? 'OPEN',
    priority: fd.get('priority') ?? 'NORMAL',
    startDate: fd.get('startDate') ?? '',
    endDate: fd.get('endDate') ?? '',
    amount: fd.get('amount') ?? '',
    owner: fd.get('owner') ?? '',
    notes: fd.get('notes') ?? '',
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  try {
    await backendFetch(`/api/mobile/hr/workflow-records/${parsed.data.id}`, {
      method: 'PUT',
      body: JSON.stringify(parsed.data),
    });
    revalidatePath(path);
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  redirect(path);
}
