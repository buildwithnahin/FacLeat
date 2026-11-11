// Barrel/composition — the real implementation lives in ./purchase/*, split
// by sub-flow (Requisition / Order / GRN / Invoice / DebitNote / Dashboard).
// The public API (`purchaseService.methodName(...)`) is unchanged, so every
// existing importer (Server Actions, other services) keeps working as-is.
import 'server-only';
import { requisitionMethods } from './purchase/requisition';
import { orderMethods } from './purchase/order';
import { grnMethods } from './purchase/grn';
import { invoiceMethods } from './purchase/invoice';
import { debitNoteMethods } from './purchase/debit-note';
import { dashboardMethods } from './purchase/dashboard';
import { lookupMethods } from './purchase/lookups';

export const purchaseService = {
  ...requisitionMethods,
  ...orderMethods,
  ...grnMethods,
  ...invoiceMethods,
  ...debitNoteMethods,
  ...dashboardMethods,
  ...lookupMethods,
};
