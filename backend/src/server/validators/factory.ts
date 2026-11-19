import { z } from 'zod';

export const PRODUCTION_ORDER_STATUS = [
  'DRAFT',
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'ON_HOLD',
] as const;

export const PRODUCTION_STAGE_STATUS = [
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'SKIPPED',
] as const;

export const UNITS = [
  'PCS',
  'KG',
  'G',
  'M',
  'M2',
  'L',
  'ML',
  'BOX',
  'PACK',
  'PAIR',
  'SET',
] as const;

export const PRODUCTION_MATERIAL_TYPES = ['LEATHER', 'ACCESSORY', 'OTHER'] as const;

const materialSchema = z.object({
  productId: z.string().cuid(),
  unit: z.enum(UNITS).default('PCS'),
  plannedQty: z.coerce.number().positive('Planned qty must be > 0'),
  unitCost: z.coerce.number().min(0).optional(),
  materialType: z.enum(PRODUCTION_MATERIAL_TYPES).default('OTHER'),
  fromWarehouseId: z.string().cuid().optional().or(z.literal('')),
  note: z.string().trim().max(300).optional().or(z.literal('')),
});

const stageSchema = z.object({
  sequence: z.coerce.number().int().min(1),
  name: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(300).optional().or(z.literal('')),
});

export const productionOrderCreateSchema = z.object({
  branchId: z.string().cuid(),
  productId: z.string().cuid(),
  planId: z.string().cuid().optional().or(z.literal('')),
  plannedQty: z.coerce.number().positive('Planned qty must be > 0'),
  unit: z.enum(UNITS).default('PCS'),
  plannedStartDate: z.coerce.date(),
  plannedEndDate: z.coerce.date(),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  buyerName: z.string().trim().max(200).optional().or(z.literal('')),
  batchName: z.string().trim().max(200).optional().or(z.literal('')),
  saleAmount: z.coerce.number().min(0).optional(),
  materials: z.array(materialSchema).default([]),
  stages: z.array(stageSchema).default([]),
});
export type ProductionOrderCreateInput = z.infer<typeof productionOrderCreateSchema>;

export const PRODUCTION_PLAN_PRIORITY = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

export const productionPlanCreateSchema = z.object({
  branchId: z.string().cuid(),
  productId: z.string().cuid(),
  quantity: z.coerce.number().positive('Quantity must be > 0'),
  planningDate: z.coerce.date(),
  plannedStartDate: z.coerce.date(),
  plannedEndDate: z.coerce.date(),
  priority: z.enum(PRODUCTION_PLAN_PRIORITY).default('MEDIUM'),
  productionLine: z.string().trim().max(120).optional().or(z.literal('')),
  machine: z.string().trim().max(120).optional().or(z.literal('')),
  shift: z.string().trim().max(60).optional().or(z.literal('')),
});
export type ProductionPlanCreateInput = z.infer<typeof productionPlanCreateSchema>;

export const productionPlanDecisionSchema = z.object({
  id: z.string().cuid(),
  decision: z.enum(['APPROVE', 'CANCEL']),
});
export type ProductionPlanDecisionInput = z.infer<typeof productionPlanDecisionSchema>;

export const productionConsumeSchema = z.object({
  orderId: z.string().cuid(),
  items: z
    .array(
      z.object({
        materialId: z.string().cuid(),
        quantity: z.coerce.number().positive('Quantity must be > 0'),
        costPerUnit: z.coerce.number().min(0).default(0),
        warehouseId: z.string().cuid().optional(),
      }),
    )
    .min(1),
});
export type ProductionConsumeInput = z.infer<typeof productionConsumeSchema>;

export const productionOutputSchema = z.object({
  orderId: z.string().cuid(),
  quantity: z.coerce.number().positive('Quantity must be > 0'),
  costPerUnit: z.coerce.number().min(0).default(0),
  toWarehouseId: z.string().cuid(),
  note: z.string().trim().max(300).optional().or(z.literal('')),
});
export type ProductionOutputInput = z.infer<typeof productionOutputSchema>;

export const productionStageUpdateSchema = z.object({
  stageId: z.string().cuid(),
  status: z.enum(PRODUCTION_STAGE_STATUS),
  notes: z.string().trim().max(300).optional().or(z.literal('')),
});
export type ProductionStageUpdateInput = z.infer<typeof productionStageUpdateSchema>;

export const productionMaterialCreateSchema = z.object({
  orderId: z.string().cuid(),
  productId: z.string().cuid(),
  unit: z.enum(UNITS).default('PCS'),
  plannedQty: z.coerce.number().positive('Planned qty must be > 0'),
  unitCost: z.coerce.number().min(0).optional(),
  materialType: z.enum(PRODUCTION_MATERIAL_TYPES).default('OTHER'),
  fromWarehouseId: z.string().cuid().optional().or(z.literal('')),
  note: z.string().trim().max(300).optional().or(z.literal('')),
});
export type ProductionMaterialCreateInput = z.infer<typeof productionMaterialCreateSchema>;

export const productionStageCreateSchema = z.object({
  orderId: z.string().cuid(),
  sequence: z.coerce.number().int().min(1).default(1),
  name: z.string().trim().min(1, 'Stage name is required').max(120),
  notes: z.string().trim().max(300).optional().or(z.literal('')),
});
export type ProductionStageCreateInput = z.infer<typeof productionStageCreateSchema>;

export const productionOrderStatusSchema = z.object({
  orderId: z.string().cuid(),
  status: z.enum(PRODUCTION_ORDER_STATUS),
});
export type ProductionOrderStatusInput = z.infer<typeof productionOrderStatusSchema>;

export const PRODUCTION_COST_TYPES = ['OVERHEAD', 'WEDGE', 'LABOUR'] as const;

export const productionCostEntryCreateSchema = z
  .object({
    orderId: z.string().cuid(),
    type: z.enum(PRODUCTION_COST_TYPES),
    description: z.string().trim().min(1).max(255),
    hours: z.coerce.number().positive().optional(),
    rate: z.coerce.number().min(0).optional(),
    amount: z.coerce.number().min(0).optional(),
    note: z.string().trim().max(500).optional().or(z.literal('')),
  })
  .superRefine((val, ctx) => {
    if (val.amount !== undefined) {
      return;
    }
    if (val.type === 'LABOUR' && val.hours && val.rate) {
      return;
    }
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Amount is required',
      path: ['amount'],
    });
  });
export type ProductionCostEntryCreateInput = z.infer<typeof productionCostEntryCreateSchema>;

export const productionCostEntryDeleteSchema = z.object({
  entryId: z.string().cuid(),
  orderId: z.string().cuid(),
});
export type ProductionCostEntryDeleteInput = z.infer<typeof productionCostEntryDeleteSchema>;

export const productionOverheadRateSchema = z.object({
  orderId: z.string().cuid(),
  overheadRate: z.coerce.number().min(0, 'Rate cannot be negative').max(100, 'Rate cannot exceed 100%'),
});
export type ProductionOverheadRateInput = z.infer<typeof productionOverheadRateSchema>;

export const PRODUCTION_ISSUE_STATUS = [
  'DRAFT',
  'REQUESTED',
  'APPROVED',
  'ISSUED',
  'REJECTED',
] as const;

export const PROCESS_TRACKING_STATUS = [
  'PENDING',
  'RUNNING',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
] as const;

export const QUALITY_CHECK_STATUS = [
  'PENDING',
  'PASSED',
  'FAILED',
  'REWORK',
] as const;

const productionIssueItemSchema = z.object({
  productId: z.string().cuid(),
  batchNo: z.string().trim().max(120).optional().or(z.literal('')),
  lotNo: z.string().trim().max(120).optional().or(z.literal('')),
  requiredQty: z.coerce.number().min(0),
  issuedQty: z.coerce.number().positive('Issued qty must be > 0'),
  uom: z.enum(UNITS).default('PCS'),
});

export const productionIssueCreateSchema = z.object({
  orderId: z.string().cuid(),
  date: z.coerce.date(),
  warehouseId: z.string().cuid(),
  remarks: z.string().trim().max(1000).optional().or(z.literal('')),
  items: z.array(productionIssueItemSchema).min(1, 'At least one item is required'),
});
export type ProductionIssueCreateInput = z.infer<typeof productionIssueCreateSchema>;

export const productionIssueStatusSchema = z.object({
  voucherId: z.string().cuid(),
  status: z.enum(PRODUCTION_ISSUE_STATUS),
});
export type ProductionIssueStatusInput = z.infer<typeof productionIssueStatusSchema>;

export const processTrackingCreateSchema = z.object({
  trackingId: z.string().cuid().optional().or(z.literal('')),
  orderId: z.string().cuid(),
  productId: z.string().cuid(),
  stageId: z.string().cuid(),
  operatorId: z.string().cuid().optional().or(z.literal('')),
  machine: z.string().trim().max(120).optional().or(z.literal('')),
  batchNo: z.string().trim().max(120).optional().or(z.literal('')),
  inputQty: z.coerce.number().min(0),
  outputQty: z.coerce.number().min(0).default(0),
  rejectedQty: z.coerce.number().min(0).default(0),
  scrapQty: z.coerce.number().min(0).default(0),
  reworkQty: z.coerce.number().min(0).default(0),
  startTime: z.string().optional().or(z.literal('')),
  endTime: z.string().optional().or(z.literal('')),
  status: z.enum(PROCESS_TRACKING_STATUS),
}).superRefine((val, ctx) => {
  if (val.outputQty + val.rejectedQty + val.scrapQty > val.inputQty && val.inputQty > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Output + rejected + scrap cannot exceed input qty',
      path: ['outputQty'],
    });
  }
});
export type ProcessTrackingCreateInput = z.infer<typeof processTrackingCreateSchema>;

export const productionReceiveCreateSchema = z.object({
  date: z.coerce.date(),
  orderId: z.string().cuid(),
  fromStageId: z.string().cuid(),
  toStageId: z.string().cuid(),
  productId: z.string().cuid(),
  receivedQty: z.coerce.number().positive('Received qty must be > 0'),
  rejectedQty: z.coerce.number().min(0).default(0),
  scrapQty: z.coerce.number().min(0).default(0),
  operatorId: z.string().cuid().optional().or(z.literal('')),
  remarks: z.string().trim().max(1000).optional().or(z.literal('')),
}).superRefine((val, ctx) => {
  if (val.fromStageId === val.toStageId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'From process and to process must be different',
      path: ['toStageId'],
    });
  }
});
export type ProductionReceiveCreateInput = z.infer<typeof productionReceiveCreateSchema>;

const finishedGoodsReceiveItemSchema = z.object({
  productId: z.string().cuid(),
  batchNo: z.string().trim().max(120).optional().or(z.literal('')),
  quantity: z.coerce.number().positive('Received qty must be > 0'),
  uom: z.enum(UNITS).default('PCS'),
  qualityStatus: z.enum(QUALITY_CHECK_STATUS).default('PENDING'),
});

export const finishedGoodsReceiveCreateSchema = z.object({
  date: z.coerce.date(),
  orderId: z.string().cuid(),
  warehouseId: z.string().cuid(),
  sourceStageId: z.string().cuid().optional().or(z.literal('')),
  remarks: z.string().trim().max(1000).optional().or(z.literal('')),
  items: z.array(finishedGoodsReceiveItemSchema).min(1, 'At least one item is required'),
});
export type FinishedGoodsReceiveCreateInput = z.infer<typeof finishedGoodsReceiveCreateSchema>;
