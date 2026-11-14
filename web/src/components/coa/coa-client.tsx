'use client';

import { useActionState, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Equal,
  Filter,
  MoreHorizontal,
  Minus,
  Plus,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ACCOUNT_TYPES,
  COA_DETAIL_TYPES,
  NORMAL_SIDES,
} from '@/server/validators/coa';
import {
  createChartAccountAction,
  deleteChartAccountAction,
  toggleActiveAction,
  type CoaFormState,
} from '@/server/actions/coa';
import { cn } from '@/lib/utils';

type AccountType = (typeof ACCOUNT_TYPES)[number];
type NormalSide = (typeof NORMAL_SIDES)[number];

export interface FlatAccount {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  normalSide: NormalSide;
  parentId: string | null;
  depth: number;
  isPosting: boolean;
  isActive: boolean;
  openingBalance: string;
  currentBalance: string;
  detailType: string | null;
  openingBalanceDate: string | null;
  createdAt: string;
}

const TYPE_ORDER: AccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'EXPENSE', 'INCOME'];
const CARD_ORDER: AccountType[] = ['INCOME', 'LIABILITY', 'EQUITY', 'EXPENSE', 'ASSET'];

const TYPE_META: Record<AccountType, { label: string; range: [number, number]; icon: 'plus' | 'minus' | 'equal' }> = {
  ASSET: { label: 'Assets', range: [1000, 1999], icon: 'equal' },
  LIABILITY: { label: 'Liabilities', range: [2000, 2999], icon: 'plus' },
  EQUITY: { label: 'Equity', range: [3000, 3999], icon: 'plus' },
  INCOME: { label: 'Income', range: [4000, 7999], icon: 'plus' },
  EXPENSE: { label: 'Expense', range: [5000, 8999], icon: 'minus' },
};

const CARD_STYLE: Record<AccountType, { card: string; icon: string; amount: string }> = {
  INCOME: { card: 'bg-sky-50', icon: 'bg-[#5a9dac]', amount: 'text-slate-950' },
  LIABILITY: { card: 'bg-emerald-200/70', icon: 'bg-[#5a9dac]', amount: 'text-[#00806f]' },
  EQUITY: { card: 'bg-sky-50', icon: 'bg-[#5a9dac]', amount: 'text-slate-950' },
  EXPENSE: { card: 'bg-amber-100', icon: 'bg-[#dbb85b]', amount: 'text-slate-950' },
  ASSET: { card: 'bg-neutral-100', icon: 'bg-neutral-600', amount: 'text-slate-950' },
};

const DETAIL_BY_LABEL = new Map<string, (typeof COA_DETAIL_TYPES)[number]>(
  COA_DETAIL_TYPES.map((detail) => [detail.label, detail]),
);

function money(value: number) {
  return `BDT ${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function codeRange(min: number, max: number) {
  return `${min.toLocaleString('en-US')} - ${max.toLocaleString('en-US')}`;
}

function numberCode(code: string) {
  const n = Number.parseInt(code.replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function accountDetail(account: FlatAccount) {
  if (account.detailType && DETAIL_BY_LABEL.has(account.detailType)) return account.detailType;
  const name = account.name.toLowerCase();
  const code = numberCode(account.code);

  if (account.type === 'ASSET') {
    if (code === 1110 || String(code).startsWith('112') || name.includes('cash') || name.includes('bank')) {
      return 'Cash and cash equivalents';
    }
    if (code === 1130 || name.includes('receivable')) {
      return 'Accounts Receivable (A/R)';
    }
    if ((code >= 1140 && code < 1200) || name.includes('inventory') || name.includes('advance') || name.includes('deposit')) {
      return 'Current assets';
    }
    if ((code >= 1200 && code < 1700) || name.includes('plant') || name.includes('machinery') || name.includes('equipment') || name.includes('vehicle') || name.includes('furniture')) {
      return 'Fixed assets';
    }
    if (code >= 1700 || name.includes('security') || name.includes('non-current')) {
      return 'Non-current assets';
    }
  }

  if (account.type === 'LIABILITY') {
    if (code === 2110 || code === 2000 || name.includes('payable') || name.includes('vendor') || name.includes('supplier')) {
      return 'Accounts Payable (A/P)';
    }
    if (name.includes('credit card')) {
      return 'Credit card';
    }
    if (code >= 2100 && code < 2500) {
      return 'Current liabilities';
    }
    if (code >= 2500) {
      return 'Non-current liabilities';
    }
  }

  if (account.type === 'EQUITY') {
    return "Owner's equity";
  }

  if (account.type === 'INCOME') {
    if (code >= 7000 || name.includes('other income')) {
      return 'Other income';
    }
    return 'Income';
  }

  if (account.type === 'EXPENSE') {
    if ((code >= 5000 && code < 6000) || name.includes('cost of') || name.includes('cogs') || name.includes('material') || name.includes('labor')) {
      return 'Cost of sales';
    }
    if (code >= 8000 || name.includes('other expense')) {
      return 'Other expense';
    }
    return 'Expenses';
  }

  return (
    COA_DETAIL_TYPES.find(
      (detail) => detail.type === account.type && code >= detail.codeMin && code <= detail.codeMax,
    )?.label ?? COA_DETAIL_TYPES.find((detail) => detail.type === account.type)?.label ?? account.type
  );
}

function asDisplayDate(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
}

function iconFor(type: AccountType) {
  const icon = TYPE_META[type].icon;
  if (icon === 'minus') return <Minus className="h-4 w-4 text-white" />;
  if (icon === 'equal') return <Equal className="h-4 w-4 text-white" />;
  return <Plus className="h-4 w-4 text-white" />;
}

function ToggleSwitch({ checked, disabled, onToggle }: { checked: boolean; disabled?: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        'relative inline-flex h-4 w-8 rounded-full transition-colors',
        checked ? 'bg-[#00798a]' : 'bg-[#dcebef]',
        disabled && 'opacity-50',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-all',
          checked ? 'left-[18px]' : 'left-0.5',
        )}
      />
    </button>
  );
}

function TypeDropdown({
  selected,
  onToggle,
}: {
  selected: Set<string>;
  onToggle: (label: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex h-8 w-[230px] items-center justify-between rounded border border-[#00829a] bg-white px-3 text-left text-xs shadow-sm">
          <span className={cn(selected.size === 0 && 'text-slate-400')}>
            {selected.size ? `${selected.size} selected` : 'Select Account'}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-[#00758a]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[255px] w-[230px] overflow-y-auto rounded-sm p-0">
        {COA_DETAIL_TYPES.map((detail) => (
          <DropdownMenuItem
            key={detail.label}
            onSelect={(event) => {
              event.preventDefault();
              onToggle(detail.label);
            }}
            className={cn(
              'gap-2 rounded-none px-3 py-2 text-xs',
              selected.has(detail.label) && 'bg-[#e4f0f2]',
            )}
          >
            <span className="h-4 w-4 rounded-[2px] border border-slate-300 bg-white">
              {selected.has(detail.label) && <span className="block h-full w-full bg-[#00758a]" />}
            </span>
            {detail.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AccountActions({
  id,
  canWrite,
  onDelete,
}: {
  id: string;
  canWrite: boolean;
  onDelete: (id: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 border border-transparent p-0 text-[#00758a] hover:border-[#00758a]">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        {canWrite && (
          <DropdownMenuItem asChild>
            <Link href={`/coa/${id}`}>Edit account</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href={`/coa/${id}/history`}>View history</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/accounts/ledger?accountId=${id}`}>View ledger</Link>
        </DropdownMenuItem>
        {canWrite && (
          <DropdownMenuItem onSelect={() => onDelete(id)} className="text-red-600 focus:text-red-600">
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CreateAccountModal({
  open,
  onOpenChange,
  accounts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: FlatAccount[];
}) {
  const [selectedLabel, setSelectedLabel] = useState<string>(COA_DETAIL_TYPES[0]!.label);
  const [makeSubaccount, setMakeSubaccount] = useState(false);
  const [state, formAction, pending] = useActionState<CoaFormState, FormData>(createChartAccountAction, undefined);
  const selected = DETAIL_BY_LABEL.get(selectedLabel) ?? COA_DETAIL_TYPES[0]!;
  const parentOptions = accounts.filter((account) => account.type === selected.type && account.isPosting);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[645px] gap-0 rounded-[18px] p-0" showCloseButton>
        <form action={formAction}>
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="text-lg font-semibold">Create account</DialogTitle>
          </DialogHeader>

          <div className="grid gap-x-3 gap-y-4 px-6 py-5 md:grid-cols-2">
            <input type="hidden" name="type" value={selected.type} />
            <input type="hidden" name="normalSide" value={selected.normalSide} />
            <input type="hidden" name="currency" value="BDT" />
            <input type="hidden" name="isPosting" value="on" />
            <input type="hidden" name="isActive" value="on" />

            <div className="space-y-2">
              <Label className="text-xs font-medium text-[#003044]">Account Type <span className="text-red-500">*</span></Label>
              <select
                value={selectedLabel}
                onChange={(event) => setSelectedLabel(event.target.value)}
                className="h-9 w-full rounded border border-[#00829a] bg-white px-2 text-xs outline-none"
              >
                {COA_DETAIL_TYPES.map((detail) => (
                  <option key={detail.label} value={detail.label}>
                    {detail.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-[#003044]">Name <span className="text-red-500">*</span></Label>
              <Input name="name" required placeholder="Name" className="h-9 text-xs" />
              {state?.fieldErrors?.name?.[0] && <p className="text-xs text-red-600">{state.fieldErrors.name[0]}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-[#003044]">Detail type <span className="text-red-500">*</span></Label>
              <select name="detailType" className="h-9 w-full rounded border border-input bg-white px-2 text-xs outline-none">
                <option value={selected.defaultDetail}>{selected.defaultDetail}</option>
              </select>
            </div>

            <label className="mt-7 flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={makeSubaccount}
                onChange={(event) => setMakeSubaccount(event.target.checked)}
                className="h-5 w-5 rounded border-slate-300"
              />
              Make this a subaccount
            </label>

            <div className="row-span-4 min-h-[248px] bg-slate-100 p-3 text-sm leading-5 text-slate-600">
              {selected.description}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-[#003044]">Balance</Label>
              <Input name="openingBalance" type="number" step="0.01" placeholder="balance" className="h-9 text-xs" />
            </div>

            {makeSubaccount && (
              <div className="space-y-2 md:col-start-2">
                <Label className="text-xs font-medium text-[#003044]">Parent account</Label>
                <select name="parentId" className="h-9 w-full rounded border border-input bg-white px-2 text-xs outline-none">
                  <option value="">Select parent</option>
                  {parentOptions.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2 md:col-start-2">
              <Label className="text-xs font-medium text-[#003044]">As of date</Label>
              <Input name="openingBalanceDate" type="date" defaultValue={today} className="h-9 text-xs" />
            </div>

            <div className="space-y-2 md:col-start-2">
              <Label className="text-xs font-medium text-[#003044]">
                Code (min: {selected.codeMin.toLocaleString('en-US')} - max: {selected.codeMax.toLocaleString('en-US')}) <span className="text-red-500">*</span>
              </Label>
              <Input name="code" required placeholder="code" className="h-9 text-xs" />
              {state?.fieldErrors?.code?.[0] && <p className="text-xs text-red-600">{state.fieldErrors.code[0]}</p>}
            </div>
          </div>

          {state?.error && <p className="px-6 pb-2 text-xs text-red-600">{state.error}</p>}

          <DialogFooter className="px-6 pb-4">
            <Button type="button" variant="outline" className="h-9 w-[72px] border-[#00758a] text-[#00758a]" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending} className="h-9 w-[78px] bg-[#00758a] text-white hover:bg-[#006377]">
              {pending ? 'Saving' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CoaClient({
  accounts,
  canWrite,
  branches = [],
  selectedBranchId = '',
}: {
  accounts: FlatAccount[];
  canWrite: boolean;
  branches?: Array<{ id: string; code: string; name: string }>;
  selectedBranchId?: string;
}) {
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [nameFilter, setNameFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [, startTransition] = useTransition();

  const enriched = useMemo(
    () => accounts.map((account) => ({ ...account, detailLabel: accountDetail(account), balance: Number(account.currentBalance) || 0 })),
    [accounts],
  );

  const totals = useMemo(() => {
    const result = new Map<AccountType, number>();
    for (const account of enriched) result.set(account.type, (result.get(account.type) ?? 0) + account.balance);
    return result;
  }, [enriched]);

  const filteredAccounts = enriched.filter((account) => {
    const typeOk = typeFilter.size === 0 || typeFilter.has(account.detailLabel);
    const nameOk = !nameFilter || account.name.toLowerCase().includes(nameFilter.toLowerCase());
    const statusOk = statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? account.isActive : !account.isActive);
    return typeOk && nameOk && statusOk;
  });
  const visibleTypes = TYPE_ORDER.filter((type) => filteredAccounts.some((account) => account.type === type));

  function toggleFilter(label: string) {
    setTypeFilter((current) => {
      const next = new Set(current);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  function resetFilters() {
    setTypeFilter(new Set());
    setNameFilter('');
    setStatusFilter('ALL');
  }

  function toggleCollapse(key: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleToggle(id: string, currentActive: boolean) {
    setPendingIds((current) => new Set(current).add(id));
    startTransition(async () => {
      await toggleActiveAction(id, !currentActive);
      setPendingIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    });
  }

  function handleDelete(id: string) {
    if (!window.confirm('Delete this account?')) return;
    startTransition(async () => {
      const res = await deleteChartAccountAction(id);
      if (res?.error) {
        alert(res.error);
      }
    });
  }

  return (
    <div className="space-y-0 text-[#003044]">
      <h1 className="mb-3 text-[26px] font-medium text-[#006f87]">Chart of accounts</h1>

      <div className="rounded-t-md bg-white px-3 py-5">
        <div className="flex flex-wrap items-end gap-3">
          {branches.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Branch</Label>
              <select
                value={selectedBranchId}
                onChange={(e) => {
                  const url = new URL(window.location.href);
                  if (e.target.value) url.searchParams.set('branchId', e.target.value);
                  else url.searchParams.delete('branchId');
                  window.location.href = url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : '');
                }}
                className="h-8 rounded border border-input bg-white px-2 text-xs"
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} · {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Account Type</Label>
            <TypeDropdown selected={typeFilter} onToggle={toggleFilter} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Name</Label>
            <Input value={nameFilter} onChange={(event) => setNameFilter(event.target.value)} className="h-8 w-[168px] text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Status</Label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-8 w-[90px] rounded border border-input bg-white px-2 text-xs"
            >
              <option value="ALL">All</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
          <Button variant="outline" size="sm" onClick={resetFilters} className="h-8 border-[#00758a] text-xs text-[#00758a]">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          <Button variant="secondary" size="sm" className="h-8 bg-[#e7f1f4] text-xs text-[#00758a]">
            <Filter className="h-3.5 w-3.5" />
            Filter
          </Button>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" className="h-8 border-[#00758a] text-xs text-[#00758a]">
              <CircleHelp className="h-3.5 w-3.5" />
              Help
            </Button>
            {canWrite && (
              <Button size="sm" className="h-8 bg-[#00758a] text-xs text-white hover:bg-[#006377]" onClick={() => setModalOpen(true)}>
                Add new
              </Button>
            )}
          </div>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-3">
          {CARD_ORDER.map((type) => {
            const style = CARD_STYLE[type];
            return (
              <div key={type} className={cn('flex min-w-[230px] items-center gap-3 rounded-md px-5 py-5', style.card)}>
                <span className={cn('flex h-7 w-7 items-center justify-center rounded-full', style.icon)}>
                  {iconFor(type)}
                </span>
                <span>
                  <span className={cn('block text-sm font-bold', style.amount)}>{money(totals.get(type) ?? 0)}</span>
                  <span className="text-xs text-slate-500">{TYPE_META[type].label.replace('Liabilities', 'Liabilities')}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t-4 border-[#00758a] bg-white">
        <table className="w-full table-fixed text-xs">
          <colgroup>
            <col className="w-[24%]" />
            <col className="w-[16%]" />
            <col className="w-[19%]" />
            <col className="w-[11%]" />
            <col className="w-[14%]" />
            <col className="w-[11%]" />
            <col className="w-[5%]" />
          </colgroup>
          <thead className="bg-[#f0f0fa] text-[#003044]">
            <tr>
              <th className="px-4 py-4 text-left font-bold uppercase">Type</th>
              <th className="px-4 py-4 text-left font-bold uppercase">Code</th>
              <th className="px-4 py-4 text-left font-bold uppercase">Detail Type</th>
              <th className="px-4 py-4 text-left font-bold uppercase">Status</th>
              <th className="px-4 py-4 text-left font-bold uppercase">As Of Date</th>
              <th className="px-4 py-4 text-right font-bold uppercase">Balance</th>
              <th className="px-4 py-4 text-center font-bold uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleTypes.map((type) => {
              const meta = TYPE_META[type];
              const typeKey = `type:${type}`;
              const typeCollapsed = collapsed.has(typeKey);
              const details = COA_DETAIL_TYPES.filter((detail) => detail.type === type);
              const typeAccounts = filteredAccounts.filter((account) => account.type === type);

              return [
                <tr key={typeKey} className="border-b bg-[#e8f5f6] font-bold text-[#006f87] shadow-sm">
                  <td className="px-4 py-4">
                    <button className="flex items-center gap-3" onClick={() => toggleCollapse(typeKey)}>
                      <span className="flex h-4 w-4 items-center justify-center rounded-full border border-[#00758a]">
                        {typeCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </span>
                      {meta.label}
                    </button>
                  </td>
                  <td className="px-4 py-4">{codeRange(meta.range[0], meta.range[1])}</td>
                  <td />
                  <td />
                  <td />
                  <td className="px-4 py-4 text-right">{money(totals.get(type) ?? 0)}</td>
                  <td className="px-4 py-4 text-center"><MoreHorizontal className="mx-auto h-4 w-4 text-[#78b5bd]" /></td>
                </tr>,
                !typeCollapsed &&
                  details.map((detail) => {
                    const detailKey = `detail:${detail.label}`;
                    const detailCollapsed = collapsed.has(detailKey);
                    const rows = typeAccounts.filter((account) => account.detailLabel === detail.label);
                    if (typeFilter.size > 0 && !typeFilter.has(detail.label)) return null;
                    if (rows.length === 0 && (nameFilter || statusFilter !== 'ALL')) return null;
                    const detailBalance = rows.reduce((sum, account) => sum + account.balance, 0);
                    return [
                      <tr key={detailKey} className="border-b bg-white font-bold">
                        <td className="px-4 py-4">
                          <button className="flex items-center gap-3 pl-4" onClick={() => toggleCollapse(detailKey)}>
                            <span className="flex h-4 w-4 items-center justify-center rounded-full border border-[#00758a] text-[#00758a]">
                              {detailCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </span>
                            {detail.label}
                          </button>
                        </td>
                        <td className="px-4 py-4">{codeRange(detail.codeMin, detail.codeMax)}</td>
                        <td />
                        <td />
                        <td />
                        <td className="px-4 py-4 text-right">{rows.length ? money(detailBalance) : ''}</td>
                        <td className="px-4 py-4 text-center"><MoreHorizontal className="mx-auto h-4 w-4 text-[#78b5bd]" /></td>
                      </tr>,
                      !detailCollapsed &&
                        rows.map((account) => (
                          <tr key={account.id} className="border-b hover:bg-[#f7fbfc]">
                            <td className="px-4 py-4">
                              <span className="block truncate pl-12">{account.name}</span>
                            </td>
                            <td className="px-4 py-4 font-semibold">{Number(numberCode(account.code)).toLocaleString('en-US') || account.code}</td>
                            <td className="px-4 py-4">
                              <span className="block truncate">{account.detailLabel}</span>
                            </td>
                            <td className="px-4 py-4">
                              <ToggleSwitch
                                checked={account.isActive}
                                disabled={pendingIds.has(account.id)}
                                onToggle={() => handleToggle(account.id, account.isActive)}
                              />
                            </td>
                            <td className="px-4 py-4">{asDisplayDate(account.openingBalanceDate ?? account.createdAt)}</td>
                            <td className="px-4 py-4 text-right font-medium">{money(account.balance)}</td>
                            <td className="px-4 py-4 text-center">
                              <AccountActions id={account.id} canWrite={canWrite} onDelete={handleDelete} />
                            </td>
                          </tr>
                        )),
                    ];
                  }),
              ];
            })}
            {visibleTypes.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                  No chart of accounts found in the database for the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CreateAccountModal open={modalOpen} onOpenChange={setModalOpen} accounts={accounts} />
    </div>
  );
}
