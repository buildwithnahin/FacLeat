import { Building2 } from 'lucide-react';
import type { AppSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { SwitcherDropdown } from '@/components/shared/switcher-dropdown';

interface BranchDto {
  id: string;
  name: string;
  code: string;
  companyId: string;
  currency: string;
}

export async function BranchSwitcher({ session }: { session: AppSession }) {
  let branches: BranchDto[] = [];
  try {
    branches = await backendFetch<BranchDto[]>('/api/mobile/branches');
  } catch {
    return null;
  }

  if (branches.length === 0) return null;

  const active = branches.find((b) => b.id === session.activeBranchId) ?? null;

  return (
    <SwitcherDropdown
      icon={<Building2 className="h-4 w-4 shrink-0" />}
      triggerLabel={active?.name ?? 'Select branch'}
      panelTitle="Switch branch"
      emptyLabel="No branches"
      activeId={active?.id}
      onSelectUrl="/api/session/active-branch"
      fieldName="branchId"
      items={branches.map((b) => ({ id: b.id, name: b.name, meta: `${b.code} · ${b.currency}` }))}
    />
  );
}
