import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/shared/data-table';
import { Pill } from '@/components/shared/pill';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { CloseSessionForm } from './close-session-form';
import { formatCurrency } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'POS Sessions' };

interface SessionRow {
  id: string;
  status: string;
  openedAt: string;
  openingFloat: string;
  expectedCash: string;
  countedCash: string;
  cashVariance: string;
  warehouse: { code: string; name: string };
}

export default async function SessionsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const sessions = await backendFetch<SessionRow[]>('/api/mobile/pos/sessions');
  const open = sessions.find((s) => s.status === 'OPEN');

  return (
    <div className="space-y-6">
      <PageHeader title="Cash sessions" description="Your open and past POS sessions.">
        <Button variant="dark" asChild>
          <Link href="/pos">Back to terminal</Link>
        </Button>
      </PageHeader>

      {open && (
        <Card className="p-4 border-emerald-500/40 bg-emerald-50/40">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-xs text-muted-foreground">Open session</div>
              <div className="font-medium">{open.warehouse.code} — {open.warehouse.name}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Opened {new Date(open.openedAt).toLocaleString()} · Opening balance {formatCurrency(open.openingFloat, 'BDT')}
              </div>
            </div>
            <CloseSessionForm sessionId={open.id} />
          </div>
        </Card>
      )}

      <Card className="p-0">
        <DataTable
          rows={sessions}
          rowKey={(r) => r.id}
          empty="No sessions yet."
          columns={[
            {
              key: 'opened',
              header: 'Opened',
              cell: (r) => <span className="tabular">{new Date(r.openedAt).toISOString().slice(0, 16).replace('T', ' ')}</span>,
            },
            { key: 'warehouse', header: 'Till', cell: (r) => `${r.warehouse.code} · ${r.warehouse.name}` },
            {
              key: 'float',
              header: 'Opening balance',
              align: 'right',
              cell: (r) => <span className="tabular">{formatCurrency(r.openingFloat, 'BDT')}</span>,
            },
            {
              key: 'expected',
              header: 'Expected',
              align: 'right',
              cell: (r) => (
                <span className="tabular">
                  {r.status === 'OPEN' || r.expectedCash == null ? '—' : formatCurrency(r.expectedCash, 'BDT')}
                </span>
              ),
            },
            {
              key: 'counted',
              header: 'Counted',
              align: 'right',
              cell: (r) => (
                <span className="tabular">
                  {r.status === 'OPEN' || r.countedCash == null ? '—' : formatCurrency(r.countedCash, 'BDT')}
                </span>
              ),
            },
            {
              key: 'variance',
              header: 'Variance',
              align: 'right',
              cell: (r) => {
                if (r.status === 'OPEN' || r.cashVariance == null) {
                  return <span className="text-muted-foreground">—</span>;
                }
                const v = Number(r.cashVariance);
                return (
                  <span className={`tabular font-medium ${v < 0 ? 'text-red-600' : v > 0 ? 'text-amber-700' : 'text-muted-foreground'}`}>
                    {formatCurrency(r.cashVariance, 'BDT')}
                  </span>
                );
              },
            },
            {
              key: 'status',
              header: 'Status',
              cell: (r) => (
                <Pill tone={r.status === 'OPEN' ? 'black' : 'grey'}>{r.status.toLowerCase()}</Pill>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
