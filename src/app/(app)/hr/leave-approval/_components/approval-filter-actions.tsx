'use client';

import { Button } from '@/components/ui/button';
import { Download, Printer } from 'lucide-react';

type ExportLeaveRow = {
  leaveRequestNo: string;
  type: string;
  fromDate: string;
  toDate: string;
  days: number;
  status: string;
  managerStatus: string;
  hrStatus: string;
  reason: string;
  employee: {
    code: string;
    firstName: string;
    lastName: string;
    department: string | null;
    branch: { name: string } | null;
  };
};

export function ApprovalFilterActions({ rows }: { rows: ExportLeaveRow[] }) {
  const handleExport = () => {
    const header = [
      'Leave No',
      'Employee Code',
      'Employee Name',
      'Branch',
      'Department',
      'Leave Type',
      'From Date',
      'To Date',
      'Days',
      'Manager Status',
      'HR Status',
      'Final Status',
      'Reason',
    ];

    const csvRows = rows.map((row) => [
      row.leaveRequestNo,
      row.employee.code,
      `${row.employee.firstName} ${row.employee.lastName}`,
      row.employee.branch?.name ?? '',
      row.employee.department ?? '',
      row.type,
      row.fromDate.slice(0, 10),
      row.toDate.slice(0, 10),
      String(row.days),
      row.managerStatus,
      row.hrStatus,
      row.status,
      row.reason.replaceAll('"', '""'),
    ]);

    const csv = [header, ...csvRows]
      .map((cells) => cells.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'leave-approval-report.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Button type="button" variant="outline" onClick={handleExport}>
        <Download className="mr-2 h-4 w-4" />
        Export Excel
      </Button>
      <Button type="button" variant="outline" onClick={() => window.print()}>
        <Printer className="mr-2 h-4 w-4" />
        Print
      </Button>
    </>
  );
}
