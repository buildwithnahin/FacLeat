'use server';

import { revalidatePath } from 'next/cache';
import { salaryComponentFormSchema } from '../validators/salary-components';
import { SalaryComponentsService } from '../services/salary-components.service';
import { ApiError } from '@/lib/errors';

function handleError(error: unknown) {
  if (error instanceof Error) {
    return { success: false, error: error.message };
  }
  return { success: false, error: 'An unknown error occurred' };
}

export async function createSalaryComponent(formData: unknown) {
  try {
    const validatedData = salaryComponentFormSchema.parse(formData);
    const result = await SalaryComponentsService.createSalaryComponent(validatedData);
    revalidatePath('/hr/salary-components');
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function updateSalaryComponent(id: string, formData: unknown) {
  try {
    const validatedData = salaryComponentFormSchema.parse(formData);
    const result = await SalaryComponentsService.updateSalaryComponent(id, validatedData);
    revalidatePath('/hr/salary-components');
    revalidatePath(`/hr/salary-components/${id}`);
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function deactivateSalaryComponent(id: string) {
  try {
    const result = await SalaryComponentsService.deactivateSalaryComponent(id);
    revalidatePath('/hr/salary-components');
    revalidatePath(`/hr/salary-components/${id}`);
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}
