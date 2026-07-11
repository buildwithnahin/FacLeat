import { Building2 } from 'lucide-react';
import type { AppSession } from '@/server/auth/session';
import { branchService } from '@/server/services/branch.service';
import { SwitcherDropdown } from '@/components/shared/switcher-dropdown';

export async function BranchSwitcher({ session }: { session: AppSession }) {
  let branches: Awaited<ReturnType<typeof branchService.listAccessible>> = [];
  try {
    branches = await branchService.listAccessible(session);
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
