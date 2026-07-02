'use client';

import { Button } from '@/components/ui/button';
import { Download, FileText, Printer } from 'lucide-react';

type BalanceExportRow = {
  employeeCode: string;
  employeeName: string;
  branchName: string;
  department: string | null;
  designation: string | null;
  leaveType: string;
  entitledDays: number;
  approvedTakenDays: number;
  pendingLeaveDays: number;
  manualAdjustmentDays: number;
  carryForwardDays: number;
  availableBalance: number;
  status: string;
};

export function LeaveBalanceActions({ rows }: { rows: BalanceExportRow[] }) {
  const exportCsv = () => {
    const header = [
      'Employee Code',
      'Employee Name',
      'Branch',
      'Department',
      'Designation',
      'Leave Type',
      'Entitled',
      'Taken',
      'Pending',
      'Adjusted',
      'Carry Forward',
      'Available',
      'Status',
    ];

    const csv = [header, ...rows.map((row) => [
      row.employeeCode,
      row.employeeName,
      row.branchName,
      row.department ?? '',
      row.designation ?? '',
      row.leaveType,
      String(row.entitledDays),
      String(row.approvedTakenDays),
      String(row.pendingLeaveDays),
      String(row.manualAdjustmentDays),
      String(row.carryForwardDays),
      String(row.availableBalance),
      row.status,
    ])]
      .map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'leave-balance-report.csv';
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
