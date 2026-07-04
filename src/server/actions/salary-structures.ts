'use server';

import { revalidatePath } from 'next/cache';
import { salaryStructureFormSchema, salaryStructureAssignmentSchema } from '../validators/salary-structures';
import { SalaryStructuresService } from '../services/salary-structures.service';

function handleError(error: unknown) {
  if (error instanceof Error) {
    return { success: false, error: error.message };
  }
  return { success: false, error: 'An unknown error occurred' };
}

export async function createSalaryStructure(formData: unknown) {
  try {
    const validatedData = salaryStructureFormSchema.parse(formData);
    const result = await SalaryStructuresService.createSalaryStructure(validatedData);
    revalidatePath('/hr/salary-structure');
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function updateSalaryStructure(id: string, formData: unknown) {
  try {
    const validatedData = salaryStructureFormSchema.parse(formData);
    const result = await SalaryStructuresService.updateSalaryStructure(id, validatedData);
    revalidatePath('/hr/salary-structure');
    revalidatePath(`/hr/salary-structure/${id}`);
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function assignSalaryStructureEmployees(id: string, formData: unknown) {
  try {
    const validatedData = salaryStructureAssignmentSchema.parse(formData);
    const result = await SalaryStructuresService.assignEmployees(id, validatedData);
    revalidatePath('/hr/salary-structure');
    revalidatePath(`/hr/salary-structure/${id}`);
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function deactivateSalaryStructure(id: string) {
  try {
    const result = await SalaryStructuresService.deactivateSalaryStructure(id);
    revalidatePath('/hr/salary-structure');
    revalidatePath(`/hr/salary-structure/${id}`);
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}
