'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Trash2, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { createJournalAction } from '@/server/actions/accounts';
import { createChartAccountInlineAction } from '@/server/actions/coa';

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface Branch {
  id: string;
  code: string;
  name: string;
  currency: string;
}

interface Line {
  key: string;
  accountId: string;
  debit: string;
  credit: string;
  memo: string;
}

function emptyLine(): Line {
  return {
    key: Math.random().toString(36).slice(2),
    accountId: '',
    debit: '',
    credit: '',
    memo: '',
  };
}

export function JournalEditor({
  branches,
  accounts,
  defaultBranchId,
}: {
  branches: Branch[];
  accounts: Account[];
  defaultBranchId: string;
}) {
  const router = useRouter();
  const [branchId, setBranchId] = useState(defaultBranchId);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState('');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Local accounts state to reflect newly created accounts on the fly
  const [accountsList, setAccountsList] = useState<Account[]>(accounts);

  // New account modal state
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [targetLineKey, setTargetLineKey] = useState<string | null>(null);
  const [newAccCode, setNewAccCode] = useState('');
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE'>('EXPENSE');
  const [newAccNormalSide, setNewAccNormalSide] = useState<'DEBIT' | 'CREDIT'>('DEBIT');
  const [newAccDesc, setNewAccDesc] = useState('');
  const [accountModalError, setAccountModalError] = useState<string | null>(null);
  const [isCreatingAccount, startCreatingAccount] = useTransition();

  const totals = useMemo(() => {
    const d = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
    const c = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
    return { d, c, diff: d - c, balanced: Math.abs(d - c) < 0.00005 && d > 0 };
  }, [lines]);

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function openNewAccountModal(lineKey: string) {
    setTargetLineKey(lineKey);
    setNewAccCode('');
    setNewAccName('');
    setNewAccType('EXPENSE');
    setNewAccNormalSide('DEBIT');
    setNewAccDesc('');
    setAccountModalError(null);
    setShowAccountModal(true);
  }

  function handleTypeChange(type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE') {
    setNewAccType(type);
    if (type === 'ASSET' || type === 'EXPENSE') {
      setNewAccNormalSide('DEBIT');
    } else {
      setNewAccNormalSide('CREDIT');
    }
  }

  function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    setAccountModalError(null);
    if (!newAccCode.trim()) {
      setAccountModalError('Account code is required');
      return;
    }
    if (!newAccName.trim()) {
      setAccountModalError('Account name is required');
      return;
    }

    startCreatingAccount(async () => {
      const res = await createChartAccountInlineAction({
        code: newAccCode,
        name: newAccName,
        type: newAccType,
        normalSide: newAccNormalSide,
        branchId: branchId || null,
        description: newAccDesc,
      });

      if (!res.success || !res.account) {
        setAccountModalError(res.error ?? 'Failed to create account');
        return;
      }

      const created: Account = {
        id: res.account.id,
        code: res.account.code,
        name: res.account.name,
        type: res.account.type,
      };

      setAccountsList((prev) => [...prev, created].sort((a, b) => a.code.localeCompare(b.code)));

      if (targetLineKey) {
        updateLine(targetLineKey, { accountId: created.id });
      }

      setShowAccountModal(false);
    });
  }

  function submit(post: boolean) {
    setError(null);
    const payload = {
      branchId,
      date,
      memo,
      reference,
      post,
      lines: lines
        .filter((l) => l.accountId && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0))
        .map((l) => ({
          accountId: l.accountId,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
          currency: 'BDT' as const,
          fxRate: 1,
          memo: l.memo,
        })),
    };

    if (payload.lines.length < 2) {
      setError('Add at least two lines with an account and an amount.');
      return;
    }

    const fd = new FormData();
    fd.set('payload', JSON.stringify(payload));
    startTransition(async () => {
      const res = await createJournalAction(undefined, fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      if (res?.success && res.entryId) {
        router.push(`/accounts/journals/${res.entryId}`);
      }
    });
  }

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="branchId">Branch</Label>
              <select
                id="branchId"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} · {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="reference">Reference</Label>
              <Input
                id="reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="External doc no., cheque no., etc."
              />
            </div>
            <div className="md:col-span-4 space-y-2">
              <Label htmlFor="memo">Memo</Label>
              <Textarea id="memo" rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left font-semibold px-3 py-2 w-10">#</th>
                  <th className="text-left font-semibold px-3 py-2 min-w-[260px]">Account</th>
                  <th className="text-right font-semibold px-3 py-2 w-36">Debit</th>
                  <th className="text-right font-semibold px-3 py-2 w-36">Credit</th>
                  <th className="text-left font-semibold px-3 py-2">Memo</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lines.map((l, idx) => (
                  <tr key={l.key}>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <select
                          value={l.accountId}
                          onChange={(e) => updateLine(l.key, { accountId: e.target.value })}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm"
                        >
                          <option value="">— select account —</option>
                          {accountsList.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code} · {a.name}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 w-9 p-0 shrink-0"
                          title="Add new account to Chart of Accounts"
                          onClick={() => openNewAccountModal(l.key)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        step="0.0001"
                        min="0"
                        value={l.debit}
                        onChange={(e) => updateLine(l.key, { debit: e.target.value, credit: e.target.value ? '' : l.credit })}
                        className="text-right tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        step="0.0001"
                        min="0"
                        value={l.credit}
                        onChange={(e) => updateLine(l.key, { credit: e.target.value, debit: e.target.value ? '' : l.debit })}
                        className="text-right tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={l.memo}
                        onChange={(e) => updateLine(l.key, { memo: e.target.value })}
                        placeholder="Optional"
                      />
                    </td>
                    <td className="px-3 py-2">
                      {lines.length > 2 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setLines((prev) => prev.filter((p) => p.key !== l.key))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/40 font-semibold">
                <tr>
                  <td colSpan={2} className="px-3 py-2 text-right text-xs uppercase text-muted-foreground">
                    Totals
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{totals.d.toFixed(4)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{totals.c.toFixed(4)}</td>
                  <td
                    colSpan={2}
                    className={`px-3 py-2 text-xs ${totals.balanced ? 'text-emerald-600' : 'text-destructive'}`}
                  >
                    {totals.balanced
                      ? '✓ Balanced'
                      : `Difference: ${totals.diff.toFixed(4)} — not balanced`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="px-3 py-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLines((prev) => [...prev, emptyLine()])}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add line
            </Button>
          </div>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center gap-2">
          <Button
            type="button"
            disabled={isPending}
            onClick={() => submit(true)}
            title={!totals.balanced ? 'Totals must balance' : ''}
          >
            {isPending ? 'Posting…' : 'Post entry'}
          </Button>
          <Button type="button" variant="outline" disabled={isPending} onClick={() => submit(false)}>
            Save as draft
          </Button>
          <Button type="button" variant="ghost" asChild>
            <Link href="/accounts/journals">Cancel</Link>
          </Button>
        </div>
      </div>

      {/* Modal to add new Chart Account */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background border rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-semibold text-base">Add New Account (Chart of Accounts)</h3>
              <button
                type="button"
                onClick={() => setShowAccountModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="modalAccCode">Account Code *</Label>
                  <Input
                    id="modalAccCode"
                    placeholder="e.g. 1199"
                    value={newAccCode}
                    onChange={(e) => setNewAccCode(e.target.value.toUpperCase())}
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="modalAccType">Account Type *</Label>
                  <select
                    id="modalAccType"
                    value={newAccType}
                    onChange={(e) =>
                      handleTypeChange(e.target.value as 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE')
                    }
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                  >
                    <option value="ASSET">ASSET</option>
                    <option value="LIABILITY">LIABILITY</option>
                    <option value="EQUITY">EQUITY</option>
                    <option value="INCOME">INCOME</option>
                    <option value="EXPENSE">EXPENSE</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="modalAccName">Account Name *</Label>
                <Input
                  id="modalAccName"
                  placeholder="e.g. Petty Cash — Head Office"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="modalAccNormal">Normal Side *</Label>
                <select
                  id="modalAccNormal"
                  value={newAccNormalSide}
                  onChange={(e) => setNewAccNormalSide(e.target.value as 'DEBIT' | 'CREDIT')}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                >
                  <option value="DEBIT">DEBIT</option>
                  <option value="CREDIT">CREDIT</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="modalAccDesc">Description (Optional)</Label>
                <Input
                  id="modalAccDesc"
                  placeholder="Notes / details"
                  value={newAccDesc}
                  onChange={(e) => setNewAccDesc(e.target.value)}
                />
              </div>

              {accountModalError && <p className="text-xs text-destructive">{accountModalError}</p>}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAccountModal(false)}
                  disabled={isCreatingAccount}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isCreatingAccount}>
                  {isCreatingAccount ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…
                    </>
                  ) : (
                    'Add Account'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
