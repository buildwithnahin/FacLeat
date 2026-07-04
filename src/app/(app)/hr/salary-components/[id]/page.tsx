import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/server/auth/session';
import { SalaryComponentsService } from '@/server/services/salary-components.service';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle } from 'lucide-react';

export default async function SalaryComponentViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const p = await params;
  const session = await getSession();
  const canWrite = session?.permissions.includes('hr:write') ?? false;

  const component = await SalaryComponentsService.getSalaryComponentById(p.id).catch(() => null);

  if (!component) {
    notFound();
  }

  const renderBoolean = (value: boolean) => {
    return value ? (
      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-4 w-4" /> Yes
      </span>
    ) : (
      <span className="flex items-center gap-1 text-slate-500">
        <XCircle className="h-4 w-4" /> No
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Salary Component Details"
        description={`Detailed view of ${component.name}`}
      >
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/hr/salary-components">Back to List</Link>
          </Button>
          {canWrite && (
            <Button asChild>
              <Link href={`/hr/salary-components?edit=${component.id}`}>Edit Component</Link>
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 border-b pb-2">
              <span className="text-muted-foreground font-medium">Component Name</span>
              <span className="col-span-2 font-semibold">{component.name}</span>
            </div>
            <div className="grid grid-cols-3 border-b pb-2">
              <span className="text-muted-foreground font-medium">Code</span>
              <span className="col-span-2 font-mono">{component.code}</span>
            </div>
            <div className="grid grid-cols-3 border-b pb-2">
              <span className="text-muted-foreground font-medium">Category</span>
              <span className="col-span-2">
                <Badge variant={component.category === 'EARNINGS' ? 'success' : 'destructive'}>
                  {component.category}
                </Badge>
              </span>
            </div>
            <div className="grid grid-cols-3 border-b pb-2">
              <span className="text-muted-foreground font-medium">Type</span>
              <span className="col-span-2">{component.type}</span>
            </div>
            <div className="grid grid-cols-3 border-b pb-2">
              <span className="text-muted-foreground font-medium">Status</span>
              <span className="col-span-2">
                <Badge variant={component.status === 'ACTIVE' ? 'default' : 'outline'}>
                  {component.status}
                </Badge>
              </span>
            </div>
            <div className="grid grid-cols-3 pb-2">
              <span className="text-muted-foreground font-medium">Description</span>
              <span className="col-span-2">{component.description || '-'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Calculation Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 border-b pb-2">
              <span className="text-muted-foreground font-medium">Calculation Method</span>
              <span className="col-span-2">{component.calculationType.replace('_', ' ')}</span>
            </div>
            
            {component.calculationType === 'PERCENTAGE' && (
              <div className="grid grid-cols-3 border-b pb-2">
                <span className="text-muted-foreground font-medium">Percentage</span>
                <span className="col-span-2">{component.value ? `${component.value}% of ${component.baseComponent || 'Base'}` : '-'}</span>
              </div>
            )}
            
            {component.calculationType === 'FIXED_AMOUNT' && (
              <div className="grid grid-cols-3 border-b pb-2">
                <span className="text-muted-foreground font-medium">Fixed Value</span>
                <span className="col-span-2">{component.value ? component.value.toString() : '-'}</span>
              </div>
            )}

            {component.calculationType === 'FORMULA' && (
              <div className="grid grid-cols-3 border-b pb-2">
                <span className="text-muted-foreground font-medium">Formula</span>
                <span className="col-span-2 font-mono text-sm bg-slate-100 dark:bg-slate-800 p-1 rounded">{component.formula}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payroll Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 border-b pb-2">
              <span className="text-muted-foreground font-medium">Include in Gross</span>
              <span className="col-span-2">{renderBoolean(component.includeInGross)}</span>
            </div>
            <div className="grid grid-cols-3 border-b pb-2">
              <span className="text-muted-foreground font-medium">Include in Net</span>
              <span className="col-span-2">{renderBoolean(component.includeInNet)}</span>
            </div>
            <div className="grid grid-cols-3 border-b pb-2">
              <span className="text-muted-foreground font-medium">Taxable</span>
              <span className="col-span-2">{renderBoolean(component.isTaxable)}</span>
            </div>
            <div className="grid grid-cols-3 border-b pb-2">
              <span className="text-muted-foreground font-medium">Show in Payslip</span>
              <span className="col-span-2">{renderBoolean(component.showInPayslip)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Validation Rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 border-b pb-2">
              <span className="text-muted-foreground font-medium">Mandatory</span>
              <span className="col-span-2">{renderBoolean(component.isMandatory)}</span>
            </div>
            <div className="grid grid-cols-3 border-b pb-2">
              <span className="text-muted-foreground font-medium">Editable During Payroll</span>
              <span className="col-span-2">{renderBoolean(component.isEditableDuringPayroll)}</span>
            </div>
            <div className="grid grid-cols-3 border-b pb-2">
              <span className="text-muted-foreground font-medium">Allow Negative</span>
              <span className="col-span-2">{renderBoolean(component.allowNegativeValue)}</span>
            </div>
            <div className="grid grid-cols-3 border-b pb-2">
              <span className="text-muted-foreground font-medium">Min Amount</span>
              <span className="col-span-2">{component.minAmount ? component.minAmount.toString() : '-'}</span>
            </div>
            <div className="grid grid-cols-3 pb-2">
              <span className="text-muted-foreground font-medium">Max Amount</span>
              <span className="col-span-2">{component.maxAmount ? component.maxAmount.toString() : '-'}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
