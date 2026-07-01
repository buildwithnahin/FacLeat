import { ArrowUpCircle, Pencil, PlusCircle } from 'lucide-react';
import { getSession } from '@/server/auth/session';
import { authorize } from '@/server/auth/authorize';
import { AlertBanner } from '@/components/shared/alert-banner';
import { buildDesignationOptions } from '@/lib/hr-master-data';
import { hrService } from '@/server/services/hr.service';
import {
  isEmployeePromotionTableMissingError,
  isPromotionTableAvailable,
  PROMOTION_TABLE_UNAVAILABLE_MESSAGE,
  promotionsService,
} from '@/server/services/promotions.service';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import {
  PromotionForm,
  PromotionKpiCards,
  PromotionTable,
} from './promotion-components';

export const metadata = { title: 'Employee Promotion — HR' };

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
  await authorize(session, 'hr:read');

  const canWrite = session?.permissions.includes('hr:write') ?? false;
  const activeBranch = session?.activeBranchId ?? undefined;
  const promotionsAvailable = await isPromotionTableAvailable();

  const [employees, designationRows, promotionListResult, promotionCountResult, editPromotionResult] = await Promise.all([
    hrService.listEmployees(session, { status: 'ACTIVE' }),
    hrService.listMasterData(session, { type: 'designations', status: 'ACTIVE', branchId: activeBranch }),
    promotionsAvailable
      ? promotionsService
          .list(session, {
            branchId: activeBranch,
            promotionType: type,
            status,
            q,
          })
          .then((records) => ({ records, unavailable: false }))
          .catch((error) => {
            if (isEmployeePromotionTableMissingError(error)) {
              return { records: [], unavailable: true };
            }
            throw error;
          })
      : Promise.resolve({ records: [], unavailable: true }),
    promotionsAvailable
      ? promotionsService
          .countByStatus(session, activeBranch)
          .then((counts) => ({ counts, unavailable: false }))
          .catch((error) => {
            if (isEmployeePromotionTableMissingError(error)) {
              return { counts: {}, unavailable: true };
            }
            throw error;
          })
      : Promise.resolve({ counts: {}, unavailable: true }),
    promotionsAvailable && edit
      ? promotionsService
          .getById(session, edit)
          .then((record) => ({ record, unavailable: false }))
          .catch((error) => {
            if (isEmployeePromotionTableMissingError(error)) {
              return { record: null, unavailable: true };
            }
            return { record: null, unavailable: false };
          })
      : Promise.resolve({ record: null, unavailable: false }),
  ]);
  const promotions = promotionListResult.records.map((promotion) => ({
    id: promotion.id,
    promotionNumber: promotion.promotionNumber,
    promotionType: promotion.promotionType,
    newDesignation: promotion.newDesignation,
    newSalary: promotion.newSalary.toString(),
    effectiveDate: promotion.effectiveDate.toISOString(),
    status: promotion.status,
    reportingManagerUserId: promotion.reportingManager?.user?.id ?? null,
    employee: promotion.employee
      ? {
          id: promotion.employee.id,
          code: promotion.employee.code,
          firstName: promotion.employee.firstName,
          lastName: promotion.employee.lastName,
          designation: promotion.employee.designation,
          department: promotion.employee.department,
          basicSalary: promotion.employee.basicSalary.toString(),
          user: promotion.employee.user,
        }
      : null,
  }));
  const counts = promotionCountResult.counts;
  const editPromotion = editPromotionResult.record;
  const promotionsUnavailable =
    promotionListResult.unavailable || promotionCountResult.unavailable || editPromotionResult.unavailable;

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
      branch: employee.branch?.name ?? '-',
      department: employee.department ?? '-',
      designation: employee.designation ?? '-',
      salary: formatMoney(employee.basicSalary.toString()),
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
                      employeeId: editPromotion.employeeId,
                      promotionType: editPromotion.promotionType,
                      newDesignation: editPromotion.newDesignation,
                      newSalary: editPromotion.newSalary.toString(),
                      effectiveDate: editPromotion.effectiveDate.toISOString(),
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
          <PromotionTable promotions={promotions} canWrite={canWrite} currentUserId={session.userId} />
        </CardContent>
      </Card>
    </div>
  );
}
