import Link from 'next/link';
import { ArrowLeft, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/shared/data-table';
import { Pill } from '@/components/shared/pill';
import { backendFetch } from '@/lib/backend-client';
import { RuleForm } from './rule-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Approval rules' };

interface ApprovalRule {
  id: string;
  name: string;
  module: string;
  action: string;
  minAmount: string;
  approverRoles: string[];
  escalateAfterHours?: number;
  isActive: boolean;
  description?: string | null;
}

export default async function ApprovalRulesPage({
  searchParams,
}: {
  searchParams?: Promise<{ edit?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const [rules, roles] = await Promise.all([
    backendFetch<ApprovalRule[]>('/api/mobile/approvals/rules'),
    backendFetch<{ id: string; name: string }[]>('/api/mobile/roles').catch(() => []),
  ]);
  const editRule = sp.edit ? rules.find((r) => r.id === sp.edit) ?? null : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval Rules"
        description="Define who approves what, and when"
      >
        <Button variant="outline" asChild>
          <Link href="/approvals">
            <ArrowLeft className="h-4 w-4" /> Back to queue
          </Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        <Card className="p-0">
          <div className="px-4 py-3 border-b text-sm font-medium">
            {rules.length} rule{rules.length === 1 ? '' : 's'}
          </div>
          <DataTable
            rows={rules}
            rowKey={(r) => r.id}
            empty="No rules defined yet."
            columns={[
              { key: 'name', header: 'Name', cell: (r) => r.name },
              {
                key: 'scope',
                header: 'Scope',
                cell: (r) => (
                  <span className="text-xs">
                    {r.module}:{r.action}
                  </span>
                ),
              },
              {
                key: 'min',
                header: 'Min amount',
                align: 'right',
                cell: (r) => <span className="tabular">{r.minAmount}</span>,
              },
              {
                key: 'roles',
                header: 'Approvers',
                cell: (r) => (
                  <div className="flex gap-1 flex-wrap">
                    {r.approverRoles.map((role) => (
                      <Pill key={role} tone="blue">
                        {role}
                      </Pill>
                    ))}
                  </div>
                ),
              },
              {
                key: 'active',
                header: 'Active',
                cell: (r) => (
                  <Pill tone={r.isActive ? 'green' : 'grey'}>
                    {r.isActive ? 'yes' : 'no'}
                  </Pill>
                ),
              },
              {
                key: 'action',
                header: '',
                cell: (r) => (
                  <Button size="xs" variant="ghost" asChild>
                    <Link href={`/approvals/rules?edit=${r.id}`}>
                      <Pencil className="h-3 w-3 mr-1" /> Edit
                    </Link>
                  </Button>
                ),
              },
            ]}
          />
        </Card>

        <RuleForm initial={editRule} availableRoles={roles.map((r) => r.name)} />
      </div>
    </div>
  );
}
