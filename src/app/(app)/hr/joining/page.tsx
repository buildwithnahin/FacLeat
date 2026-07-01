import { getSession } from '@/server/auth/session';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CompleteJoiningForm } from './_components/complete-joining-form';
import { UserCheck, ShieldCheck, ClipboardCheck, ArrowUpRight, Award, Calendar } from 'lucide-react';
import { formatCurrency } from '@/lib/money';
import Link from 'next/link';

export const metadata = { title: 'Employee Onboarding & Joining' };

type JoiningMetadata = Record<string, unknown>;

export default async function JoiningPage() {
  const session = await getSession();
  await authorize(session, 'hr:read');
  const canWrite = session?.permissions.includes('hr:write') ?? false;

  const [offers, readyContracts] = await Promise.all([
    prisma.hrWorkflowRecord.findMany({
      where: { section: 'job-offers', status: 'Offer Accepted' },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.contract.findMany({
      where: {
        offerId: { not: null },
        status: { in: ['SIGNED', 'WAITING_FOR_JOINING'] },
      },
      select: {
        offerId: true,
        contractType: true,
        department: true,
        designation: true,
      },
    }),
  ]);

  const readyContractsByOfferId = new Map(
    readyContracts
      .filter((contract): contract is typeof contract & { offerId: string } => Boolean(contract.offerId))
      .map((contract) => [contract.offerId, contract])
  );
  const acceptedOffers = offers.filter((offer) => readyContractsByOfferId.has(offer.id));

  // Fetch completed joining records
  const joiningRecords = await prisma.hrWorkflowRecord.findMany({
    where: { section: 'joining' },
    orderBy: { createdAt: 'desc' },
  });

  // Fetch branches
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' },
  });

  const shifts = await prisma.shift.findMany({
    where: { status: 'ACTIVE' },
    orderBy: [{ branch: { name: 'asc' } }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      code: true,
      startTime: true,
      endTime: true,
      branchId: true,
      branch: { select: { name: true, code: true } },
    },
  });

  const serializedAcceptedOffers = acceptedOffers.map((o) => {
    const linkedContract = readyContractsByOfferId.get(o.id);
    const offerMetadata = (o.metadata as Record<string, unknown> | null) || null;

    return {
      id: o.id,
      title: o.title,
      subject: o.subject,
      amount: o.amount ? Number(o.amount) : null,
      metadata: {
        ...offerMetadata,
        contractType: linkedContract?.contractType || null,
        department: linkedContract?.department || offerMetadata?.department || null,
        designation: linkedContract?.designation || o.subject || null,
      },
    };
  });

  const totalJoined = joiningRecords.length;
  const pendingOnboarding = acceptedOffers.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidate Joining & Onboarding"
        description="Convert accepted job offers into official employee profiles and execute the checklist."
      />

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Successfully Joined</p>
              <p className="mt-2 text-2xl font-bold text-emerald-600">{totalJoined}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <UserCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Pending Joining (Signed Contracts)</p>
              <p className="mt-2 text-2xl font-bold text-amber-600">{pendingOnboarding}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {canWrite && (
        <Card className="shadow-sm border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              Complete Onboarding & Contract Finalization
            </CardTitle>
          </CardHeader>
          <CardContent>
            {acceptedOffers.length === 0 ? (
              <div className="text-xs text-amber-600 bg-amber-50 p-4 rounded-lg flex items-center gap-2">
                <span>No signed offer contracts are currently pending onboarding. An offer must be accepted and the contract must be signed first.</span>
              </div>
            ) : (
              <CompleteJoiningForm
                acceptedOffers={serializedAcceptedOffers}
                branches={branches}
                shifts={shifts}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Joining Logs */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/20 px-6 py-4 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            Joining Logs
          </CardTitle>
          <Link href="/hr/employees" className="text-xs text-primary font-medium hover:underline flex items-center gap-0.5">
            View Employee Directory
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground border-b">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Employee Code</th>
                  <th className="text-left font-semibold px-4 py-3">Employee Name</th>
                  <th className="text-left font-semibold px-4 py-3">Role / Department</th>
                  <th className="text-right font-semibold px-4 py-3">Basic Salary</th>
                  <th className="text-left font-semibold px-4 py-3">Joining Date</th>
                  <th className="text-left font-semibold px-4 py-3">Onboarding Notes</th>
                  <th className="text-left font-semibold px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {joiningRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No onboarding logs registered yet.
                    </td>
                  </tr>
                ) : (
                  joiningRecords.map((record) => {
                    const meta = (record.metadata as JoiningMetadata | null) || {};
                    return (
                      <tr key={record.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-mono font-semibold text-primary">
                          {meta.employeeCode || '—'}
                        </td>
                        <td className="px-4 py-3 font-semibold text-card-foreground">
                          {record.title.replace('Joining - ', '')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{record.subject || '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-foreground">
                          {record.amount ? formatCurrency(record.amount as number) : '—'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            {record.startDate ? new Date(record.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[250px] truncate">
                          {record.notes || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="success">Active</Badge>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
