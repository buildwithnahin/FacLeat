import { Building } from 'lucide-react';
import type { AppSession } from '@/server/auth/session';
import { companyService } from '@/server/services/company.service';
import { setActiveCompanyAction } from '@/server/actions/companies';
import { SwitcherDropdown } from '@/components/shared/switcher-dropdown';

export async function CompanySwitcher({ session }: { session: AppSession }) {
  let companies: Awaited<ReturnType<typeof companyService.listAccessible>> = [];
  try {
    companies = await companyService.listAccessible(session);
  } catch {
    return null;
  }

  if (companies.length === 0) return null;

  const active = companies.find((c) => c.id === session.activeCompanyId) ?? companies[0];

  return (
    <SwitcherDropdown
      icon={<Building className="h-4 w-4 shrink-0" />}
      triggerLabel={active?.name ?? 'Select company'}
      panelTitle="Switch company"
      emptyLabel="No companies"
      activeId={active?.id}
      action={setActiveCompanyAction}
      fieldName="companyId"
      items={companies.map((c) => ({ id: c.id, name: c.name, meta: `${c.code} · ${c.currency}` }))}
    />
  );
}
