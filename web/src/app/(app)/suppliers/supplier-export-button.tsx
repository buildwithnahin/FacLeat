'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SupplierRow {
  id: string;
  code: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  country: string | null;
  currency: string;
  status: string;
  totalPurchase: string;
  dueAmount: string;
}

export function SupplierExportButton({ suppliers }: { suppliers: SupplierRow[] }) {
  const exportCsv = () => {
    const headers = [
      'Supplier ID',
      'Supplier Name',
      'Contact Person',
      'Phone',
      'Email',
      'City',
      'Country',
      'Currency',
      'Status',
      'Total Purchase',
      'Due Amount',
    ];

    const rows = suppliers.map((s) => [
      `"${s.code.replace(/"/g, '""')}"`,
      `"${s.name.replace(/"/g, '""')}"`,
      `"${(s.contactPerson ?? '').replace(/"/g, '""')}"`,
      `"${(s.phone ?? '').replace(/"/g, '""')}"`,
      `"${(s.email ?? '').replace(/"/g, '""')}"`,
      `"${(s.city ?? '').replace(/"/g, '""')}"`,
      `"${(s.country ?? '').replace(/"/g, '""')}"`,
      s.currency,
      s.status,
      Number(s.totalPurchase || 0).toFixed(2),
      Number(s.dueAmount || 0).toFixed(2),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `suppliers_directory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Button variant="outline" size="sm" onClick={exportCsv} disabled={suppliers.length === 0}>
      <Download className="h-4 w-4 mr-1.5" />
      Export CSV
    </Button>
  );
}
