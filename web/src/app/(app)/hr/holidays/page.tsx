import Link from 'next/link';
import { Plus, Pencil } from 'lucide-react';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

const HOLIDAY_TYPE_LABELS: Record<string, string> = {
  GOVERNMENT_HOLIDAY: 'Government Holiday',
  COMPANY_HOLIDAY: 'Company Holiday',
  RELIGIOUS_HOLIDAY: 'Religious Holiday',
  FESTIVAL_HOLIDAY: 'Festival Holiday',
  WEEKLY_HOLIDAY: 'Weekly Holiday',
  SPECIAL_HOLIDAY: 'Special Holiday',
};

export const metadata = { title: 'Holiday Calendar' };

interface HolidayRow {
  id: string;
  name: string;
  code: string;
  startDate: string;
  endDate: string;
  type: string;
  isPaid: boolean;
  status: string;
  description: string | null;
  branch: { name: string; code: string } | null;
}

export default async function HolidaysPage() {
  const session = await getSession();
  const holidays = await backendFetch<HolidayRow[]>('/api/mobile/hr/holidays');
  const canWrite = session?.permissions.includes('hr:write') ?? false;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Holiday Calendar"
        description="Manage paid and unpaid holidays that affect attendance, leave, payroll, and overtime."
      >
        {canWrite && (
          <Button asChild>
            <Link href="/hr/holidays/new">
              <Plus className="h-4 w-4" />
              New holiday
            </Link>
          </Button>
        )}
      </PageHeader>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Name</th>
                <th className="px-4 py-3 text-left font-semibold">Code</th>
                <th className="px-4 py-3 text-left font-semibold">Date</th>
                <th className="px-4 py-3 text-left font-semibold">Type</th>
                <th className="px-4 py-3 text-left font-semibold">Branch</th>
                <th className="px-4 py-3 text-left font-semibold">Paid</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {holidays.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    No holidays configured yet.
                  </td>
                </tr>
              )}
              {holidays.map((holiday) => (
                <tr key={holiday.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{holiday.name}</div>
                    <div className="text-xs text-muted-foreground">{holiday.description || 'No description'}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{holiday.code}</td>
                  <td className="px-4 py-3">
                    {holiday.startDate.slice(0, 10) === holiday.endDate.slice(0, 10)
                      ? holiday.startDate.slice(0, 10)
                      : `${holiday.startDate.slice(0, 10)} to ${holiday.endDate.slice(0, 10)}`}
                  </td>
                  <td className="px-4 py-3">{HOLIDAY_TYPE_LABELS[holiday.type] ?? holiday.type}</td>
                  <td className="px-4 py-3">{holiday.branch ? `${holiday.branch.name} (${holiday.branch.code})` : 'All branches'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={holiday.isPaid ? 'success' : 'outline'}>{holiday.isPaid ? 'PAID' : 'UNPAID'}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={holiday.status === 'ACTIVE' ? 'success' : 'outline'}>{holiday.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {canWrite && (
                      <div className="flex items-center justify-end">
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/hr/holidays/${holiday.id}/edit`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
