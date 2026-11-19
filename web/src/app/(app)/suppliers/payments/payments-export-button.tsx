'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaymentRow {
  id: string;
  number: string;
  paymentDate: string;
  amount: string;
  currency: string;
  method: string;
  reference: string | null;
  supplier: { id: string; name: string };
  invoice: { id: string; number: string } | null;
}

export function PaymentsExportButton({ payments }: { payments: PaymentRow[] }) {
  const exportCsv = () => {
    const headers = [
      'Payment Voucher',
      'Date',
      'Supplier',
      'Amount',
      'Currency',
      'Payment Method',
      'Reference / Txn',
      'Applied Invoice',
    ];

    const rows = payments.map((p) => [
      `"${p.number}"`,
      `"${new Date(p.paymentDate).toLocaleDateString()}"`,
      `"${p.supplier.name.replace(/"/g, '""')}"`,
      Number(p.amount || 0).toFixed(2),
      p.currency,
      `"${p.method.replace(/_/g, ' ')}"`,
      `"${(p.reference ?? '').replace(/"/g, '""')}"`,
      `"${(p.invoice?.number ?? 'General / Unapplied').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `supplier_payments_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Button variant="outline" size="sm" onClick={exportCsv} disabled={payments.length === 0}>
      <Download className="h-4 w-4 mr-1.5" />
      Export Payments CSV
    </Button>
  );
}
