import Link from 'next/link';
import { Plus, Pencil } from 'lucide-react';
import { getSession } from '@/server/auth/session';
import { userService } from '@/server/services/user.service';
import { setUserStatusAction } from '@/server/actions/users';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Users' };

export default async function UsersPage() {
  const session = await getSession();
  const users = await userService.list(session);
  const canWrite = session?.permissions.includes('users:write') ?? false;

  return (
    <div>
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
                    No users yet.
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
                    {u.createdAt.toISOString().slice(0, 10)}
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
