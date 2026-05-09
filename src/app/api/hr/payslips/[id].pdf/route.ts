import { getSession } from '@/server/auth/session';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';
import { createSimplePdf, pdfResponse } from '@/server/pdf/simple-pdf';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  await authorize(session, 'hr:read');

  const payslip = await prisma.payslip.findUnique({
    where: { id },
    include: {
      employee: true,
      payrollRun: { include: { branch: true } },
    },
  });
  if (!payslip) return new Response('Payslip not found', { status: 404 });

  const bytes = await createSimplePdf({
    title: `Payslip ${payslip.payrollRun.period}`,
    subtitle: `${payslip.employee.code} · ${payslip.employee.firstName} ${payslip.employee.lastName}`,
    sections: [
      {
        title: 'Employee',
        rows: [
          ['Branch', payslip.payrollRun.branch.name],
          ['Department', payslip.employee.department ?? ''],
          ['Designation', payslip.employee.designation ?? ''],
          ['Worked days', payslip.workedDays],
          ['Leave days', payslip.leaveDays],
          ['Absent days', payslip.absentDays],
        ],
      },
      {
        title: 'Earnings',
        rows: [
          ['Basic', payslip.basic.toString()],
          ['House allowance', payslip.houseAllowance.toString()],
          ['Transport allowance', payslip.transportAllowance.toString()],
          ['Medical allowance', payslip.medicalAllowance.toString()],
          ['Other allowance', payslip.otherAllowance.toString()],
          ['Bonus', payslip.bonus.toString()],
          ['Gross', payslip.gross.toString()],
        ],
      },
      {
        title: 'Deductions',
        rows: [
          ['Provident fund', payslip.providentFund.toString()],
          ['Tax', payslip.taxDeduction.toString()],
          ['Other deduction', payslip.otherDeduction.toString()],
          ['Net pay', payslip.net.toString()],
        ],
      },
    ],
  });

  return pdfResponse(`payslip-${payslip.employee.code}-${payslip.payrollRun.period}.pdf`, bytes);
}
