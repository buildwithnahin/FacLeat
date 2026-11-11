import Link from 'next/link';
import { Database, Pencil, PlusCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/money';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  editMasterRow?: {
    id: string;
    branchId: string | null;
    code: string | null;
    name: string;
    department?: string | null;
    description: string | null;
    status: string;
  } | null;
  editWorkflowRow?: {
    id: string;
    branchId: string | null;
    employeeId: string | null;
    title: string;
    subject: string | null;
    status: string;
    priority: string;
    startDate: Date | null;
    endDate: Date | null;
    amount: string;
    owner: string | null;
    notes: string | null;
  } | null;
  masterRows?: Array<{
    id: string;
    branchId?: string | null;
    code: string | null;
    name: string;
    department?: string | null;
    description: string | null;
    status: string;
    branch?: { code: string; name: string } | null;
    updatedAt: Date;
  }>;
  workflowRows?: Array<{
    id: string;
    branchId?: string | null;
    employeeId?: string | null;
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
  departments?: string[];
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
  departments = [],
  editMasterRow,
  editWorkflowRow,
  masterRows = [],
  workflowRows = [],
}: HrSectionShellProps) {
  const isEditing = kind === 'master' ? Boolean(editMasterRow) : Boolean(editWorkflowRow);

  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />

      {canWrite && (
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              {isEditing ? <Pencil className="h-4 w-4 text-primary" /> : <PlusCircle className="h-4 w-4 text-primary" />}
              {isEditing ? `Edit ${kind === 'master' ? 'Setup Record' : 'Workflow Record'}` : `New ${kind === 'master' ? 'Setup Record' : 'Workflow Record'}`}
            </div>
            {kind === 'master' ? (
              <HrMasterDataForm
                mode={isEditing ? 'edit' : 'create'}
                type={slug}
                path={path}
                branches={branches}
                departments={departments}
                initial={editMasterRow ?? undefined}
              />
            ) : (
              <HrWorkflowRecordForm
                mode={isEditing ? 'edit' : 'create'}
                section={slug}
                path={path}
                branches={branches}
                employees={employees}
                initial={editWorkflowRow ?? undefined}
              />
            )}
          </CardContent>
        </Card>
      )}

      <div>
        <Card>
          <CardContent className="p-0">
            <div className="border-b px-6 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Database className="h-4 w-4 text-primary" />
                Saved Data
              </div>
            </div>
            {kind === 'master' ? <MasterTable rows={masterRows} path={path} canWrite={canWrite} /> : <WorkflowTable rows={workflowRows} path={path} canWrite={canWrite} />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MasterTable({
  rows,
  path,
  canWrite,
}: {
  rows: NonNullable<HrSectionShellProps['masterRows']>;
  path: string;
  canWrite: boolean;
}) {
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
            {canWrite && <th className="px-4 py-3 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3">
                <div className="font-medium">{row.name}</div>
                {row.description && <div className="text-xs text-muted-foreground">{row.description}</div>}
                {row.department && <div className="text-xs text-muted-foreground">Department: {row.department}</div>}
              </td>
              <td className="px-4 py-3 font-mono text-xs">{row.code ?? '-'}</td>
              <td className="px-4 py-3">{row.branch?.code ?? 'All'}</td>
              <td className="px-4 py-3"><Badge variant={row.status === 'ACTIVE' ? 'success' : 'outline'}>{row.status}</Badge></td>
              <td className="px-4 py-3 text-muted-foreground">{row.updatedAt.toISOString().slice(0, 10)}</td>
              {canWrite && (
                <td className="px-4 py-3 text-right">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <Link href={`${path}?edit=${row.id}`}>Edit</Link>
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WorkflowTable({
  rows,
  path,
  canWrite,
}: {
  rows: NonNullable<HrSectionShellProps['workflowRows']>;
  path: string;
  canWrite: boolean;
}) {
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
            {canWrite && <th className="px-4 py-3 text-right">Actions</th>}
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
              {canWrite && (
                <td className="px-4 py-3 text-right">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <Link href={`${path}?edit=${row.id}`}>Edit</Link>
                  </Button>
                </td>
              )}
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
