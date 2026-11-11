import { ArrowUpCircle, Pencil, PlusCircle } from 'lucide-react';
import { getSession } from '@/server/auth/session';
import { AlertBanner } from '@/components/shared/alert-banner';
import { buildDesignationOptions } from '@/lib/hr-master-data';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import {
  PromotionForm,
  PromotionKpiCards,
  PromotionTable,
} from './promotion-components';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Employee Promotion — HR' };

const PROMOTION_TABLE_UNAVAILABLE_MESSAGE =
  'Promotion tables are not migrated on this database yet. Run the pending Prisma migration to enable this module.';

interface EmployeeRow {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  department: string | null;
  designation: string | null;
  basicSalary: string;
  branchName: string | null;
}

interface MasterDataRow {
  id: string;
  name: string;
  metadata: unknown;
}

interface PromotionRow {
  id: string;
  promotionNumber: string;
  promotionType: string;
  newDesignation: string;
  newSalary: string;
  effectiveDate: string;
  status: string;
  reason: string;
  remarks: string | null;
  reportingManager: { user: { id: string } | null } | null;
  employee: {
    id: string;
    code: string;
    firstName: string;
    lastName: string;
    designation: string | null;
    department: string | null;
    basicSalary: string;
  } | null;
}

function formatMoney(value: string | number) {
  const amount = typeof value === 'number' ? value : Number(value || 0);
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 2,
  }).format(amount);
}

export default async function PromotionsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; type?: string; status?: string; q?: string }>;
}) {
  const { edit, type, status, q } = await searchParams;
  const session = await getSession();

  const canWrite = session?.permissions.includes('hr:write') ?? false;
  const activeBranch = session?.activeBranchId ?? undefined;

  const listParams = new URLSearchParams();
  if (activeBranch) listParams.set('branchId', activeBranch);
  if (type) listParams.set('promotionType', type);
  if (status) listParams.set('status', status);
  if (q) listParams.set('q', q);

  const [employees, designationRows, promotionListResult, counts] = await Promise.all([
    backendFetch<EmployeeRow[]>('/api/mobile/hr/employees?status=ACTIVE'),
    backendFetch<MasterDataRow[]>(
      `/api/mobile/hr/master-data?${new URLSearchParams({ type: 'designations', status: 'ACTIVE', ...(activeBranch ? { branchId: activeBranch } : {}) }).toString()}`,
    ),
    backendFetch<{ records: PromotionRow[]; unavailable: boolean }>(`/api/mobile/hr/promotions?${listParams.toString()}`),
    backendFetch<Record<string, number>>(`/api/mobile/hr/promotions/counts${activeBranch ? `?branchId=${activeBranch}` : ''}`),
  ]);

  const promotionsUnavailable = promotionListResult.unavailable;
  const promotions = promotionListResult.records;

  const editPromotion = edit ? promotions.find((p) => p.id === edit) ?? null : null;

  const employeeOptions = employees.map((employee) => ({
    id: employee.id,
    label: `${employee.code} · ${employee.firstName} ${employee.lastName}`,
  }));

  const employeeDetails: Record<
    string,
    {
      employeeLabel: string;
      branch: string;
      department: string;
      designation: string;
      salary: string;
    }
  > = {};
  for (const employee of employees) {
    employeeDetails[employee.id] = {
      employeeLabel: `${employee.code} - ${employee.firstName} ${employee.lastName}`,
      branch: employee.branchName ?? '-',
      department: employee.department ?? '-',
      designation: employee.designation ?? '-',
      salary: formatMoney(employee.basicSalary),
    };
  }

  const isEditing = Boolean(editPromotion && editPromotion.status === 'DRAFT');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Promotion"
        description="Manage HR-submitted promotion requests and reporting-manager approval."
      />

      {promotionsUnavailable && (
        <AlertBanner tone="warning" title="Promotion migration required">
          {PROMOTION_TABLE_UNAVAILABLE_MESSAGE}
        </AlertBanner>
      )}

      <PromotionKpiCards counts={counts} />

      {canWrite && !promotionsUnavailable && (
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              {isEditing ? (
                <Pencil className="h-4 w-4 text-primary" />
              ) : (
                <PlusCircle className="h-4 w-4 text-primary" />
              )}
              {isEditing ? 'Edit Promotion' : 'New Promotion Request'}
            </div>
            <PromotionForm
              mode={isEditing ? 'edit' : 'create'}
              employees={employeeOptions}
              employeeDetails={employeeDetails}
              designationOptions={buildDesignationOptions(
                designationRows.map((row) => ({ name: row.name, metadata: row.metadata })),
              )}
              initial={
                isEditing && editPromotion
                  ? {
                      id: editPromotion.id,
                      employeeId: editPromotion.employee?.id ?? '',
                      promotionType: editPromotion.promotionType,
                      newDesignation: editPromotion.newDesignation,
                      newSalary: editPromotion.newSalary,
                      effectiveDate: editPromotion.effectiveDate,
                      reason: editPromotion.reason,
                      remarks: editPromotion.remarks,
                    }
                  : undefined
              }
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="border-b px-6 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ArrowUpCircle className="h-4 w-4 text-primary" />
              Promotion Records
            </div>
          </div>
          <PromotionTable
            promotions={promotions.map((promotion) => ({
              id: promotion.id,
              promotionNumber: promotion.promotionNumber,
              promotionType: promotion.promotionType,
              newDesignation: promotion.newDesignation,
              newSalary: promotion.newSalary,
              effectiveDate: promotion.effectiveDate,
              status: promotion.status,
              reportingManagerUserId: promotion.reportingManager?.user?.id ?? null,
              employee: promotion.employee,
            }))}
            canWrite={canWrite}
            currentUserId={session?.userId ?? ''}
          />
        </CardContent>
      </Card>
    </div>
  );
}
