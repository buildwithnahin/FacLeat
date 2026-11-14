import Link from 'next/link';
import { Plus, Pencil, Search, RotateCcw } from 'lucide-react';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { setUserStatusAction } from '@/server/actions/users';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Users' };

interface UserRow {
  id: string;
  name: string;
  email: string;
  status: string;
  branchAccessType: 'ALL_BRANCHES' | 'ASSIGNED_BRANCHES' | 'OWN_BRANCH_ONLY';
  createdAt: string;
  employee: { firstName: string; lastName: string; designation: string | null } | null;
  defaultBranch: { name: string } | null;
  branchAccesses: { branch: { code: string } }[];
  roles: { role: { id: string; name: string } }[];
}

interface RoleOption {
  id: string;
  name: string;
}

interface BranchOption {
  id: string;
  code: string;
  name: string;
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string; roleId?: string; branchId?: string }>;
}) {
  const session = await getSession();
  const sp = (await searchParams) ?? {};
  const q = sp.q?.trim() || '';
  const status = sp.status || '';
  const roleId = sp.roleId || '';
  const branchId = sp.branchId || '';

  const listParams = new URLSearchParams();
  if (q) listParams.set('q', q);
  if (status && status !== 'ALL') listParams.set('status', status);
  if (roleId && roleId !== 'ALL') listParams.set('roleId', roleId);
  if (branchId && branchId !== 'ALL') listParams.set('branchId', branchId);

  const [users, roles, branches] = await Promise.all([
    backendFetch<UserRow[]>(`/api/mobile/users?${listParams.toString()}`).catch(() => []),
    backendFetch<RoleOption[]>('/api/mobile/roles').catch(() => []),
    backendFetch<BranchOption[]>('/api/mobile/branches?activeOnly=true').catch(() => []),
  ]);
  const canWrite = session?.permissions.includes('users:write') ?? false;

  return (
    <div className="space-y-4">
      <PageHeader title="Users" description="System users, their roles, and branch access.">
        {canWrite && (
          <Button asChild>
            <Link href="/users/new">
              <Plus className="h-4 w-4" />
              New user
            </Link>
          </Button>
        )}
      </PageHeader>

      <Card>
        <CardContent className="p-4">
          <form method="GET" className="grid grid-cols-1 gap-3 md:grid-cols-5 items-end">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Search</label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  name="q"
                  placeholder="Name, email, code…"
                  defaultValue={q}
                  className="pl-8 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Role</label>
              <select
                name="roleId"
                defaultValue={roleId}
                aria-label="Filter by role"
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="ALL">All Roles</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Branch</label>
              <select
                name="branchId"
                defaultValue={branchId}
                aria-label="Filter by branch"
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="ALL">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <select
                name="status"
                defaultValue={status}
                aria-label="Filter by status"
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="DISABLED">DISABLED</option>
                <option value="PENDING">PENDING</option>
              </select>
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                Filter
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/users">
                  <RotateCcw className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="max-w-full overflow-hidden">
        <div className="max-w-full overflow-x-hidden">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-[17%]" />
              <col className="w-[19%]" />
              <col className="w-[11%]" />
              <col className="w-[13%]" />
              <col className="w-[14%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-3 text-left font-semibold">Employee</th>
                <th className="px-3 py-3 text-left font-semibold">Email</th>
                <th className="px-3 py-3 text-left font-semibold">Role</th>
                <th className="px-3 py-3 text-left font-semibold">Designation</th>
                <th className="px-3 py-3 text-left font-semibold">Branch access</th>
                <th className="px-3 py-3 text-left font-semibold">Status</th>
                <th className="px-3 py-3 text-left font-semibold">Created</th>
                <th className="px-3 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    No users matching the criteria.
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30">
                  <td className="px-3 py-3 font-medium">
                    <span className="block whitespace-normal break-words leading-5">
                      {u.employee ? `${u.employee.firstName} ${u.employee.lastName}` : u.name}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    <span className="block break-all leading-5">{u.email}</span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((ur) => (
                        <Badge key={ur.role.id} variant="secondary">
                          {ur.role.name}
                        </Badge>
                      ))}
                      {u.roles.length === 0 && <span className="text-muted-foreground">—</span>}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    <span className="block truncate">{u.employee?.designation ?? '—'}</span>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    <span className="block truncate">
                      {u.branchAccessType === 'ALL_BRANCHES'
                        ? 'All branches'
                        : u.branchAccessType === 'ASSIGNED_BRANCHES'
                          ? `${u.branchAccesses.length} assigned`
                          : u.defaultBranch?.name ?? '—'}
                    </span>
                    {u.branchAccessType === 'ASSIGNED_BRANCHES' && u.branchAccesses.length > 0 ? (
                      <span className="block truncate text-xs">
                        {u.branchAccesses.map((access) => access.branch.code).join(', ')}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="px-3 py-3 text-muted-foreground tabular">
                    {new Date(u.createdAt).toISOString().slice(0, 10)}
                  </td>
                  <td className="px-3 py-3">
                    {canWrite && (
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/users/${u.id}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                        <form action={setUserStatusAction}>
                          <input type="hidden" name="id" value={u.id} />
                          <input
                            type="hidden"
                            name="status"
                            value={u.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED'}
                          />
                          <Button size="sm" variant="outline" type="submit" className="px-2">
                            {u.status === 'DISABLED' ? 'Enable' : 'Disable'}
                          </Button>
                        </form>
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
