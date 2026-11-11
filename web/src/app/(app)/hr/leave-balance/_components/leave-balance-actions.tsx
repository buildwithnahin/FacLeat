'use client';

import { Button } from '@/components/ui/button';
import { Download, FileText, Printer } from 'lucide-react';

type ExportColumn<T extends Record<string, string | number | null>> = {
  key: keyof T;
  label: string;
};

export function LeaveBalanceActions<T extends Record<string, string | number | null>>({
  rows,
  columns,
  filename,
}: {
  rows: T[];
  columns: ExportColumn<T>[];
  filename: string;
}) {
  const exportCsv = () => {
    const header = columns.map((column) => column.label);
    const csv = [header, ...rows.map((row) => columns.map((column) => row[column.key] ?? ''))]
      .map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Button type="button" variant="outline" onClick={exportCsv}>
        <Download className="mr-2 h-4 w-4" />
        Export Excel
      </Button>
      <Button type="button" variant="outline" onClick={() => window.print()}>
        <FileText className="mr-2 h-4 w-4" />
        Export PDF
      </Button>
      <Button type="button" variant="outline" onClick={() => window.print()}>
        <Printer className="mr-2 h-4 w-4" />
        Print
      </Button>
    </>
  );
}
