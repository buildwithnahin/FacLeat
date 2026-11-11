import { Building } from 'lucide-react';
import type { AppSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { SwitcherDropdown } from '@/components/shared/switcher-dropdown';

interface CompanyDto {
  id: string;
  name: string;
  code: string;
}

export async function CompanySwitcher({ session }: { session: AppSession }) {
  let companies: CompanyDto[] = [];
  try {
    companies = await backendFetch<CompanyDto[]>('/api/mobile/companies');
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
      onSelectUrl="/api/session/active-company"
      fieldName="companyId"
      items={companies.map((c) => ({ id: c.id, name: c.name, meta: c.code }))}
    />
  );
}
