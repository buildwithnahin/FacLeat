import Link from 'next/link';
import { ArrowRight, Database, FolderKanban, PlusCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/money';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { HrMasterDataForm, HrWorkflowRecordForm, type SelectOption } from './hr-section-forms';

type SectionKind = 'master' | 'workflow';

export interface HrSectionShellProps {
  title: string;
  description: string;
  category: string;
  slug: string;
  path: string;
  kind: SectionKind;
  canWrite: boolean;
  branches: SelectOption[];
  employees: SelectOption[];
  links?: { label: string; href: string }[];
  masterRows?: Array<{
    id: string;
    code: string | null;
    name: string;
    description: string | null;
    status: string;
    branch?: { code: string; name: string } | null;
    updatedAt: Date;
  }>;
  workflowRows?: Array<{
    id: string;
    title: string;
    subject: string | null;
    status: string;
    priority: string;
    startDate: Date | null;
    endDate: Date | null;
    amount: unknown;
    owner: string | null;
    notes: string | null;
    branch?: { code: string; name: string } | null;
    employee?: { code: string; firstName: string; lastName: string } | null;
    updatedAt: Date;
  }>;
}

export function HrSectionShell({
  title,
  description,
  slug,
  path,
  kind,
  canWrite,
  branches,
  employees,
  links = [],
  masterRows = [],
  workflowRows = [],
}: HrSectionShellProps) {
  const rowCount = kind === 'master' ? masterRows.length : workflowRows.length;

  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Metric label="Saved Records" value={String(rowCount)} />
        <Metric label="Data Layer" value={kind === 'master' ? 'Master' : 'Workflow'} />
        <Metric label="Branch Scope" value="Global/Branch" />
      </div>

      {canWrite && (
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <PlusCircle className="h-4 w-4 text-primary" />
              New {kind === 'master' ? 'Setup Record' : 'Workflow Record'}
            </div>
            {kind === 'master' ? (
              <HrMasterDataForm type={slug} path={path} branches={branches} />
            ) : (
              <HrWorkflowRecordForm section={slug} path={path} branches={branches} employees={employees} />
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card>
          <CardContent className="p-0">
            <div className="border-b px-6 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Database className="h-4 w-4 text-primary" />
                Saved Data
              </div>
            </div>
            {kind === 'master' ? <MasterTable rows={masterRows} /> : <WorkflowTable rows={workflowRows} />}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <FolderKanban className="h-4 w-4 text-primary" />
              Related Pages
            </div>
            {links.length === 0 ? (
              <p className="text-sm text-muted-foreground">No linked operational pages yet.</p>
            ) : (
              <div className="space-y-2">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:border-primary hover:text-primary"
                  >
                    <span>{link.label}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function MasterTable({ rows }: { rows: NonNullable<HrSectionShellProps['masterRows']> }) {
  if (rows.length === 0) return <EmptyState text="No records saved yet." />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">Name</th>
            <th className="px-4 py-3 text-left">Code</th>
            <th className="px-4 py-3 text-left">Branch</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-left">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3">
                <div className="font-medium">{row.name}</div>
                {row.description && <div className="text-xs text-muted-foreground">{row.description}</div>}
              </td>
              <td className="px-4 py-3 font-mono text-xs">{row.code ?? '-'}</td>
              <td className="px-4 py-3">{row.branch?.code ?? 'All'}</td>
              <td className="px-4 py-3"><Badge variant={row.status === 'ACTIVE' ? 'success' : 'outline'}>{row.status}</Badge></td>
              <td className="px-4 py-3 text-muted-foreground">{row.updatedAt.toISOString().slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WorkflowTable({ rows }: { rows: NonNullable<HrSectionShellProps['workflowRows']> }) {
  if (rows.length === 0) return <EmptyState text="No workflow records saved yet." />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">Record</th>
            <th className="px-4 py-3 text-left">Employee</th>
            <th className="px-4 py-3 text-left">Dates</th>
            <th className="px-4 py-3 text-right">Amount</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-left">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3">
                <div className="font-medium">{row.title}</div>
                <div className="text-xs text-muted-foreground">
                  {[row.subject, row.owner, row.branch?.code].filter(Boolean).join(' · ') || '-'}
                </div>
              </td>
              <td className="px-4 py-3">
                {row.employee ? `${row.employee.code} · ${row.employee.firstName} ${row.employee.lastName}` : '-'}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {row.startDate ? row.startDate.toISOString().slice(0, 10) : '-'}
                {row.endDate ? ` to ${row.endDate.toISOString().slice(0, 10)}` : ''}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {row.amount ? formatCurrency(row.amount as never) : '-'}
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <Badge variant={row.status === 'COMPLETED' || row.status === 'APPROVED' ? 'success' : row.status === 'REJECTED' ? 'destructive' : 'outline'}>
                    {row.status}
                  </Badge>
                  <Badge variant="outline">{row.priority}</Badge>
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{row.updatedAt.toISOString().slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="p-8 text-center text-sm text-muted-foreground">{text}</div>;
}
