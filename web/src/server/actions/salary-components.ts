'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { salaryComponentFormSchema } from '@/server/validators/salary-components';

function handleError(error: unknown) {
  if (error instanceof BackendApiError) return { success: false as const, error: error.message };
  if (error instanceof Error) return { success: false as const, error: error.message };
  return { success: false as const, error: 'An unknown error occurred' };
}

export async function createSalaryComponent(formData: unknown) {
  try {
    const validatedData = salaryComponentFormSchema.parse(formData);
    const result = await backendFetch('/api/mobile/hr/salary-components', {
      method: 'POST',
      body: JSON.stringify(validatedData),
    });
    revalidatePath('/hr/salary-components');
    return { success: true as const, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function updateSalaryComponent(id: string, formData: unknown) {
  try {
    const validatedData = salaryComponentFormSchema.parse(formData);
    const result = await backendFetch(`/api/mobile/hr/salary-components/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(validatedData),
    });
    revalidatePath('/hr/salary-components');
    revalidatePath(`/hr/salary-components/${id}`);
    return { success: true as const, data: result };
  } catch (error) {
    return handleError(error);
  }
}
