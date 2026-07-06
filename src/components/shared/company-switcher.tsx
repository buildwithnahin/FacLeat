import { Building, ChevronDown } from 'lucide-react';
import type { AppSession } from '@/server/auth/session';
import { companyService } from '@/server/services/company.service';
import { setActiveCompanyAction } from '@/server/actions/companies';

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
    <div className="relative group">
      <button
        type="button"
        className="inline-flex items-center gap-2 h-9 px-3 rounded-md border bg-background text-sm hover:bg-muted/50"
      >
        <Building className="h-4 w-4" />
        <span className="font-medium">{active?.name ?? 'Select company'}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      <div className="absolute right-0 mt-1 min-w-[220px] rounded-md border bg-popover text-popover-foreground shadow-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition z-20">
        <div className="px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground border-b">
          Switch company
        </div>
        <ul className="py-1 max-h-80 overflow-y-auto">
          {companies.map((c) => (
            <li key={c.id}>
              <form action={setActiveCompanyAction}>
                <input type="hidden" name="companyId" value={c.id} />
                <button
                  type="submit"
                  className={
                    'w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground ' +
                    (c.id === active?.id ? 'bg-muted/50 font-medium' : '')
                  }
                >
                  <span className="block">{c.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {c.code} · {c.currency}
                  </span>
                </button>
              </form>
            </li>
          ))}
          {companies.length === 0 && (
            <li className="px-3 py-6 text-sm text-muted-foreground text-center">No companies</li>
          )}
        </ul>
      </div>
    </div>
  );
}
