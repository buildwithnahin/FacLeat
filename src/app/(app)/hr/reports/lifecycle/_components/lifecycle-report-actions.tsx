'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Download, FileText, Printer } from 'lucide-react';

export function LifecycleReportActions({
  filename,
  columns,
  rows,
}: {
  filename: string;
  columns: string[];
  rows: Array<Array<string | number>>;
}) {
  const exportCsv = () => {
    const csv = [columns, ...rows]
      .map((line) => line.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(','))
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
      <Button type="submit">Generate Report</Button>
      <Button type="button" variant="outline" asChild>
        <Link href="/hr/reports/lifecycle">Reset</Link>
      </Button>
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
