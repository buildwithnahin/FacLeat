import type { PillTone } from '@/components/shared/pill';

export function getActionTone(action: string): PillTone {
  const upper = action.toUpperCase();
  if (
    upper.includes('CREATE') ||
    upper.includes('ADD') ||
    upper.includes('INSERT') ||
    upper.includes('SUBMIT') ||
    upper.includes('COMPLETE')
  ) {
    return 'green';
  }
  if (
    upper.includes('UPDATE') ||
    upper.includes('EDIT') ||
    upper.includes('MODIFY') ||
    upper.includes('ASSIGN')
  ) {
    return 'blue';
  }
  if (
    upper.includes('DELETE') ||
    upper.includes('REMOVE') ||
    upper.includes('CANCEL') ||
    upper.includes('VOID') ||
    upper.includes('TERMINATE')
  ) {
    return 'red';
  }
  if (
    upper.includes('REJECT') ||
    upper.includes('SUSPEND') ||
    upper.includes('BLOCK') ||
    upper.includes('DISMISS')
  ) {
    return 'amber';
  }
  if (upper.includes('APPROVE') || upper.includes('VERIFY')) {
    return 'green';
  }
  return 'neutral';
}

export function getModuleTone(module: string): PillTone {
  const upper = module.toUpperCase();
  if (upper.includes('PURCHASE')) return 'blue';
  if (upper.includes('WAREHOUSE')) return 'amber';
  if (upper.includes('INVENTORY') || upper.includes('STOCK')) return 'green';
  if (upper.includes('HR') || upper.includes('PAYROLL')) return 'orange';
  if (upper.includes('FACTORY') || upper.includes('PRODUCTION')) return 'black';
  if (upper.includes('FINANCE') || upper.includes('ACCOUNT')) return 'green';
  if (upper.includes('AUTH') || upper.includes('SECURITY')) return 'grey';
  return 'neutral';
}

export function getEntityUrl(entityType: string, entityId: string | null): string | null {
  if (!entityId) return null;
  const lower = entityType.toLowerCase();

  if (lower.includes('purchaseorder') || lower === 'po') {
    return '/purchase/orders';
  }
  if (lower.includes('purchaserequisition')) {
    return '/purchase/requisitions';
  }
  if (lower.includes('purchaseinvoice')) {
    return `/purchase/invoices/${entityId}`;
  }
  if (lower.includes('goodsreceivednote') || lower === 'grn') {
    return `/purchase/grn/${entityId}`;
  }
  if (lower.includes('stockrequisition')) {
    return `/warehouse/requisitions/${entityId}`;
  }
  if (lower.includes('damagereport') || lower.includes('faulty')) {
    return '/warehouse/faulty';
  }
  if (lower.includes('physicalcount')) {
    return '/warehouse/count';
  }
  if (lower.includes('transfer')) {
    return '/warehouse/transfer';
  }
  if (lower.includes('payrollrun')) {
    return `/hr/payroll/${entityId}`;
  }
  if (lower.includes('employee')) {
    return '/hr/payroll';
  }
  if (lower.includes('approvalrequest') || lower.includes('approval')) {
    return `/approvals/${entityId}`;
  }
  if (lower.includes('document')) {
    return `/documents/${entityId}`;
  }
  if (lower.includes('productionplan')) {
    return `/factory/${entityId}`;
  }
  if (lower.includes('customer') || lower.includes('lead')) {
    return '/crm';
  }
  if (lower.includes('cashentry') || lower.includes('cashtransfer')) {
    return '/transactions';
  }

  return null;
}
