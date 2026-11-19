'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface DepartmentSummary {
  department: string;
  count: number;
  total: string;
}

interface PurchaseExportProps {
  summary: {
    poCount: number;
    poTotal: string;
    invoiceCount: number;
    invoiceTotal: string;
    invoicePaid: string;
    invoiceOutstanding: string;
    openPayable: string;
    byDepartment: DepartmentSummary[];
  };
  from: string;
  to: string;
}

export function PurchaseExportButton({ summary, from, to }: PurchaseExportProps) {
  const handleExport = () => {
    const lines = [
      'Annex Leather — Procurement & Payables Summary Report',
      `Period: ${from} to ${to}`,
      '',
      'Metric,Count,Amount (BDT)',
      `Purchase Orders Created,${summary.poCount},${Number(summary.poTotal).toFixed(2)}`,
      `Supplier Invoices Received,${summary.invoiceCount},${Number(summary.invoiceTotal).toFixed(2)}`,
      `Payments Disbursed to Suppliers,-,${Number(summary.invoicePaid).toFixed(2)}`,
      `Current Invoiced Outstanding,-,${Number(summary.invoiceOutstanding).toFixed(2)}`,
      `Total Open Payables,-,${Number(summary.openPayable).toFixed(2)}`,
      '',
      'Department,PO Count,Total Procurement (BDT)',
    ];

    summary.byDepartment.forEach((d) => {
      lines.push(
        `"${d.department.replace(/"/g, '""')}",${d.count},${Number(d.total).toFixed(2)}`,
      );
    });

    const csvContent = lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `procurement-summary-${from}-to-${to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Procurement summary exported to CSV');
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5 shadow-sm text-xs">
      <Download className="h-3.5 w-3.5" /> Export Summary CSV
    </Button>
  );
}
