import { z } from 'zod';

export const CONTRACT_TYPES = ['CONTRACT', 'PROBATION', 'INTERNSHIP', 'PERMANENT'] as const;
export const PRE_JOIN_CONTRACT_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'SENT', 'SIGNED', 'WAITING_FOR_JOINING'] as const;
export const EMPLOYMENT_CONTRACT_STATUSES = ['ACTIVE', 'EXPIRING', 'EXPIRED', 'RENEWED', 'TERMINATED'] as const;
export const CONTRACT_STATUSES = [...PRE_JOIN_CONTRACT_STATUSES, ...EMPLOYMENT_CONTRACT_STATUSES] as const;

const contractFields = {
  contractNo: z.string().trim().min(1).max(64),
  employeeId: z.string().cuid().optional().or(z.literal('')).nullable(),
  candidateId: z.string().cuid().optional().or(z.literal('')).nullable(),
  offerId: z.string().cuid().optional().or(z.literal('')).nullable(),
  candidateName: z.string().trim().max(160).optional().or(z.literal('')).nullable(),
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
    const hasEmployee = !!data.employeeId;
    const hasCandidate = !!data.candidateId || !!data.offerId || !!data.candidateName;
    return hasEmployee || hasCandidate;
  },
  {
    message: 'Provide either an employee or a recruitment-linked candidate/offer reference.',
    path: ['employeeId'],
  }
).refine(
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
).refine(
  (data) => {
    if (['ACTIVE', 'EXPIRING', 'EXPIRED', 'RENEWED', 'TERMINATED'].includes(data.status) && !data.employeeId) {
      return false;
    }
    return true;
  },
  {
    message: 'An employee must be assigned before a contract can move into active employment statuses.',
    path: ['status'],
  }
).refine(
  (data) => {
    if (data.status === 'SIGNED' && !data.attachmentUrl) {
      return false;
    }
    return true;
  },
  {
    message: 'A signed contract attachment is required before the contract status can be set to SIGNED.',
    path: ['attachmentUrl'],
  }
);

export const contractUpdateSchema = z.object({
  id: z.string().cuid(),
  ...contractFields,
}).refine(
  (data) => {
    const hasEmployee = !!data.employeeId;
    const hasCandidate = !!data.candidateId || !!data.offerId || !!data.candidateName;
    return hasEmployee || hasCandidate;
  },
  {
    message: 'Provide either an employee or a recruitment-linked candidate/offer reference.',
    path: ['employeeId'],
  }
).refine(
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
).refine(
  (data) => {
    if (['ACTIVE', 'EXPIRING', 'EXPIRED', 'RENEWED', 'TERMINATED'].includes(data.status) && !data.employeeId) {
      return false;
    }
    return true;
  },
  {
    message: 'An employee must be assigned before a contract can move into active employment statuses.',
    path: ['status'],
  }
).refine(
  (data) => {
    if (data.status === 'SIGNED' && !data.attachmentUrl) {
      return false;
    }
    return true;
  },
  {
    message: 'A signed contract attachment is required before the contract status can be set to SIGNED.',
    path: ['attachmentUrl'],
  }
);

export type ContractCreateInput = z.infer<typeof contractCreateSchema>;
export type ContractUpdateInput = z.infer<typeof contractUpdateSchema>;
