import { z } from 'zod';

export const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'] as const;
export const NORMAL_SIDES = ['DEBIT', 'CREDIT'] as const;

export const COA_DETAIL_TYPES = [
  {
    label: 'Cash and cash equivalents',
    type: 'ASSET',
    normalSide: 'DEBIT',
    codeMin: 1000,
    codeMax: 1099,
    defaultDetail: 'Bank',
    description:
      'Use Bank accounts to track all your current activity, including debit card transactions. Each current account your company has at a bank or other financial institution should have its own Bank type account.',
  },
  {
    label: 'Accounts Receivable (A/R)',
    type: 'ASSET',
    normalSide: 'DEBIT',
    codeMin: 1100,
    codeMax: 1199,
    defaultDetail: 'Accounts receivable',
    description: 'Track money customers owe your company for sales made on credit.',
  },
  {
    label: 'Current assets',
    type: 'ASSET',
    normalSide: 'DEBIT',
    codeMin: 1200,
    codeMax: 1499,
    defaultDetail: 'Current asset',
    description: 'Track short-term assets that are expected to be converted into cash within one operating cycle.',
  },
  {
    label: 'Fixed assets',
    type: 'ASSET',
    normalSide: 'DEBIT',
    codeMin: 1500,
    codeMax: 1699,
    defaultDetail: 'Fixed asset',
    description: 'Track long-term assets such as machinery, equipment, vehicles, furniture, and leasehold improvements.',
  },
  {
    label: 'Non-current assets',
    type: 'ASSET',
    normalSide: 'DEBIT',
    codeMin: 1700,
    codeMax: 1999,
    defaultDetail: 'Non-current asset',
    description: 'Track long-term assets that are not expected to become cash within the current operating cycle.',
  },
  {
    label: 'Accounts Payable (A/P)',
    type: 'LIABILITY',
    normalSide: 'CREDIT',
    codeMin: 2000,
    codeMax: 2099,
    defaultDetail: 'Accounts payable',
    description: 'Track amounts your company owes suppliers and vendors.',
  },
  {
    label: 'Current liabilities',
    type: 'LIABILITY',
    normalSide: 'CREDIT',
    codeMin: 2100,
    codeMax: 2499,
    defaultDetail: 'Current liability',
    description: 'Track liabilities due within one year or one operating cycle.',
  },
  {
    label: 'Non-current liabilities',
    type: 'LIABILITY',
    normalSide: 'CREDIT',
    codeMin: 2500,
    codeMax: 2899,
    defaultDetail: 'Non-current liability',
    description: 'Track long-term liabilities due after the current operating cycle.',
  },
  {
    label: 'Credit card',
    type: 'LIABILITY',
    normalSide: 'CREDIT',
    codeMin: 2900,
    codeMax: 2999,
    defaultDetail: 'Credit card',
    description: 'Track credit card balances, charges, payments, and adjustments.',
  },
  {
    label: "Owner's equity",
    type: 'EQUITY',
    normalSide: 'CREDIT',
    codeMin: 3000,
    codeMax: 3999,
    defaultDetail: "Owner's equity",
    description: 'Track owner investment, retained earnings, drawings, and equity movements.',
  },
  {
    label: 'Income',
    type: 'INCOME',
    normalSide: 'CREDIT',
    codeMin: 4000,
    codeMax: 4999,
    defaultDetail: 'Sales income',
    description: 'Track income from primary business activities.',
  },
  {
    label: 'Cost of sales',
    type: 'EXPENSE',
    normalSide: 'DEBIT',
    codeMin: 5000,
    codeMax: 5999,
    defaultDetail: 'Cost of sales',
    description: 'Track direct costs related to goods or services sold.',
  },
  {
    label: 'Expenses',
    type: 'EXPENSE',
    normalSide: 'DEBIT',
    codeMin: 6000,
    codeMax: 6999,
    defaultDetail: 'Expense',
    description: 'Track operating expenses and ordinary business costs.',
  },
  {
    label: 'Other income',
    type: 'INCOME',
    normalSide: 'CREDIT',
    codeMin: 7000,
    codeMax: 7999,
    defaultDetail: 'Other income',
    description: 'Track income that is not part of primary operations.',
  },
  {
    label: 'Other expense',
    type: 'EXPENSE',
    normalSide: 'DEBIT',
    codeMin: 8000,
    codeMax: 8999,
    defaultDetail: 'Other expense',
    description: 'Track expenses outside ordinary operations.',
  },
] as const;

export const COA_DETAIL_TYPE_LABELS = COA_DETAIL_TYPES.map((detail) => detail.label);

export const chartAccountCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(24)
    .regex(/^[A-Z0-9._-]+$/i, 'Use letters, digits, dot, dash, underscore'),
  name: z.string().trim().min(1).max(160),
  type: z.enum(ACCOUNT_TYPES),
  normalSide: z.enum(NORMAL_SIDES),
  parentId: z.string().cuid().optional().nullable(),
  isPosting: z.boolean().default(true),
  isControl: z.boolean().default(false),
  currency: z.enum(['BDT', 'INR', 'USD', 'EUR']).default('BDT'),
  branchId: z.string().cuid().optional().nullable(),
  openingBalance: z.coerce.number().finite().default(0),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  isActive: z.boolean().default(true),
  detailType: z.string().trim().max(120).optional().or(z.literal('')),
  openingBalanceDate: z.coerce.date().optional().nullable(),
});

export const chartAccountUpdateSchema = chartAccountCreateSchema.extend({
  id: z.string().cuid(),
});

export type ChartAccountCreateInput = z.infer<typeof chartAccountCreateSchema>;
export type ChartAccountUpdateInput = z.infer<typeof chartAccountUpdateSchema>;
