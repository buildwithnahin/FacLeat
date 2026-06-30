import { z } from 'zod';

export const CONTRACT_TYPES = ['CONTRACT', 'PROBATION', 'INTERNSHIP', 'PERMANENT'] as const;
export const CONTRACT_STATUSES = ['DRAFT', 'ACTIVE', 'EXPIRED', 'RENEWED', 'TERMINATED'] as const;

const contractFields = {
  contractNo: z.string().trim().min(1).max(64),
  employeeId: z.string().cuid(),
  branchId: z.string().cuid().optional().or(z.literal('')).nullable(),
  department: z.string().trim().max(120).optional().or(z.literal('')).nullable(),
  designation: z.string().trim().max(120).optional().or(z.literal('')).nullable(),
  contractType: z.enum(CONTRACT_TYPES),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().or(z.literal('')).nullable(),
  basicSalary: z.coerce.number().min(0),
  allowances: z.coerce.number().min(0).default(0),
  shiftId: z.string().cuid().optional().or(z.literal('')).nullable(),
  weeklyOff: z.string().trim().min(1).default('Friday'),
  status: z.enum(CONTRACT_STATUSES).default('DRAFT'),
  attachmentUrl: z.string().trim().max(500).optional().or(z.literal('')).nullable(),
  notes: z.string().trim().max(1000).optional().or(z.literal('')).nullable(),
};

export const contractCreateSchema = z.object(contractFields).refine(
  (data) => {
    if (data.contractType !== 'PERMANENT' && !data.endDate) {
      return false;
    }
    if (data.startDate && data.endDate && new Date(data.endDate) < new Date(data.startDate)) {
      return false;
    }
    return true;
  },
  {
    message: 'End date is required and must be on or after start date for non-permanent contracts',
    path: ['endDate'],
  }
);

export const contractUpdateSchema = z.object({
  id: z.string().cuid(),
  ...contractFields,
}).refine(
  (data) => {
    if (data.contractType !== 'PERMANENT' && !data.endDate) {
      return false;
    }
    if (data.startDate && data.endDate && new Date(data.endDate) < new Date(data.startDate)) {
      return false;
    }
    return true;
  },
  {
    message: 'End date is required and must be on or after start date for non-permanent contracts',
    path: ['endDate'],
  }
);

export type ContractCreateInput = z.infer<typeof contractCreateSchema>;
export type ContractUpdateInput = z.infer<typeof contractUpdateSchema>;
