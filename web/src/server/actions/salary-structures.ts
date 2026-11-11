'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { salaryStructureFormSchema, salaryStructureAssignmentSchema } from '@/server/validators/salary-structures';

function handleError(error: unknown) {
  if (error instanceof BackendApiError) return { success: false as const, error: error.message };
  if (error instanceof Error) return { success: false as const, error: error.message };
  return { success: false as const, error: 'An unknown error occurred' };
}

export async function createSalaryStructure(formData: unknown) {
  try {
    const validatedData = salaryStructureFormSchema.parse(formData);
    const result = await backendFetch('/api/mobile/hr/salary-structure', {
      method: 'POST',
      body: JSON.stringify(validatedData),
    });
    revalidatePath('/hr/salary-structure');
    return { success: true as const, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function updateSalaryStructure(id: string, formData: unknown) {
  try {
    const validatedData = salaryStructureFormSchema.parse(formData);
    const result = await backendFetch(`/api/mobile/hr/salary-structure/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(validatedData),
    });
    revalidatePath('/hr/salary-structure');
    revalidatePath(`/hr/salary-structure/${id}`);
    return { success: true as const, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function assignSalaryStructureEmployees(id: string, formData: unknown) {
  try {
    const validatedData = salaryStructureAssignmentSchema.parse(formData);
    const result = await backendFetch(`/api/mobile/hr/salary-structure/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify(validatedData),
    });
    revalidatePath('/hr/salary-structure');
    revalidatePath(`/hr/salary-structure/${id}`);
    return { success: true as const, data: result };
  } catch (error) {
    return handleError(error);
  }
}
