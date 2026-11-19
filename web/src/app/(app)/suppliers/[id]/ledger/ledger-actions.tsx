'use client';

import { Printer, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LedgerEntry {
  id: string;
  entryDate: string;
  entryType: string;
  description: string;
  refType: string;
  debit: string;
  credit: string;
  runningBalance: string;
}

interface LedgerActionsProps {
  supplier: {
    code: string;
    name: string;
    currency: string;
  };
  entries: LedgerEntry[];
  currentBalance: string;
}

export function LedgerActions({ supplier, entries, currentBalance }: LedgerActionsProps) {
  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    const headers = [
      'Date',
      'Entry Type',
      'Reference Type',
      'Description',
      'Debit (+)',
      'Credit (-)',
      'Running Balance',
      'Currency',
    ];

    const rows = entries.map((e) => [
      `"${new Date(e.entryDate).toLocaleDateString()}"`,
      `"${e.entryType}"`,
      `"${e.refType}"`,
      `"${e.description.replace(/"/g, '""')}"`,
      Number(e.debit || 0).toFixed(2),
      Number(e.credit || 0).toFixed(2),
      Number(e.runningBalance || 0).toFixed(2),
      supplier.currency,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `vendor_ledger_${supplier.code}_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex items-center gap-2 print:hidden">
      <Button variant="outline" size="sm" onClick={handlePrint}>
        <Printer className="h-4 w-4 mr-1.5" />
        Print Statement
      </Button>
      <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={entries.length === 0}>
        <Download className="h-4 w-4 mr-1.5" />
        Export CSV
      </Button>
    </div>
  );
}
