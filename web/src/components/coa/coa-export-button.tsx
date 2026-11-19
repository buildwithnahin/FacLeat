'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FlatAccount } from './coa-client';

export function CoaExportButton({ accounts }: { accounts: (FlatAccount & { detailLabel: string; balance: number })[] }) {
  const handleExport = () => {
    if (!accounts.length) return;

    const headers = [
      'Account Code',
      'Account Name',
      'Account Type',
      'Normal Side',
      'Detail Type',
      'Status',
      'As of Date',
      'Balance (BDT)',
    ];

    const csvLines = accounts.map((a) => [
      `"${a.code}"`,
      `"${a.name.replace(/"/g, '""')}"`,
      `"${a.type}"`,
      `"${a.normalSide}"`,
      `"${(a.detailLabel ?? '').replace(/"/g, '""')}"`,
      `"${a.isActive ? 'Active' : 'Inactive'}"`,
      `"${a.openingBalanceDate ? a.openingBalanceDate.slice(0, 10) : ''}"`,
      `"${a.balance.toFixed(2)}"`,
    ]);

    const csvContent = [headers.join(','), ...csvLines.map((line) => line.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `chart-of-accounts-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={accounts.length === 0}
      className="h-8 border-[#00758a] text-xs text-[#00758a] flex items-center gap-1.5 hover:bg-[#e7f1f4]"
    >
      <Download className="h-3.5 w-3.5" />
      <span>Export CSV ({accounts.length})</span>
    </Button>
  );
}
