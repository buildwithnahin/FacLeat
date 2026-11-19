import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  MoreHorizontal,
  Printer,
  Scale,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Pill } from '@/components/shared/pill';
import { PrintButton } from '@/components/shared/print-button';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Account History & Ledger' };

interface LedgerRowDto {
  id: string;
  date: string;
  entryId: string;
  number: string;
  branchCode: string;
  memo: string;
  reference: string;
  debit: string;
  credit: string;
  balance: string;
}

interface AccountLedgerDto {
  account: { name: string };
  opening: string;
  rows: LedgerRowDto[];
  closing: string;
}

interface ChartAccountDto {
  id: string;
  code: string;
  name: string;
  type: string;
  normalSide: 'DEBIT' | 'CREDIT';
  currency: string;
  openingBalance: string;
  detailType: string | null;
}

function money(value: string | number | undefined) {
  const n = Number(value ?? 0);
  if (!n && n !== 0) return 'BDT 0.00';
  const sign = n < 0 ? '- ' : '';
  return `${sign}BDT ${Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateText(iso: string) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '—';
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

export default async function AccountHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let ledger: AccountLedgerDto;
  let account: ChartAccountDto;
  try {
    [ledger, account] = await Promise.all([
      backendFetch<AccountLedgerDto>(`/api/mobile/accounts/ledger?accountId=${id}`).catch(() => ({
        account: { name: '' },
        opening: '0',
        rows: [],
        closing: '0',
      })),
      backendFetch<ChartAccountDto>(`/api/mobile/coa/${id}`),
    ]);
  } catch (e) {
    if (e instanceof BackendApiError && e.status === 404) notFound();
    throw e;
  }

  const rows = [...(ledger.rows ?? [])].reverse();

  const totalDebit = rows.reduce((acc, r) => acc + (Number(r.debit) || 0), 0);
  const totalCredit = rows.reduce((acc, r) => acc + (Number(r.credit) || 0), 0);
  const openingVal = Number(ledger.opening ?? account.openingBalance ?? 0);
  const closingVal = Number(ledger.closing ?? (account.normalSide === 'DEBIT' ? openingVal + totalDebit - totalCredit : openingVal + totalCredit - totalDebit));

  return (
    <div className="text-[#003044] space-y-5">
      {/* Top Navigation & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[26px] font-medium text-[#006f87]">Account History</h1>
            <Pill tone="blue" className="font-semibold text-xs">
              {account.code}
            </Pill>
            <Pill tone="neutral" className="text-xs">
              {account.type} ({account.normalSide})
            </Pill>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Account Title: <span className="font-semibold text-slate-900">{account.name}</span>
            {account.detailType && <span className="ml-2 text-xs text-slate-400">({account.detailType})</span>}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/coa">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Accounts
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/accounts/ledger?accountId=${id}`}>View in Ledger</Link>
          </Button>
          <PrintButton label="Print Statement" className="px-3 py-1.5 bg-white border hover:bg-slate-50 text-xs font-medium rounded-md flex items-center gap-1 shadow-sm transition-colors text-[#00758a]" />
        </div>
      </div>

      {/* Account Turnover & Balance Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-slate-50/80 border-slate-200">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mb-1">
            <Calendar className="h-3.5 w-3.5" /> Opening Balance
          </div>
          <div className="text-base font-bold text-slate-900 tabular-nums">
            {money(openingVal)}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Initial period position</p>
        </Card>

        <Card className="p-4 bg-emerald-50/60 border-emerald-200">
          <div className="flex items-center gap-2 text-xs text-emerald-700 font-medium mb-1">
            <TrendingDown className="h-3.5 w-3.5" /> Total Debits
          </div>
          <div className="text-base font-bold text-emerald-800 tabular-nums">
            {money(totalDebit)}
          </div>
          <p className="text-[11px] text-emerald-600 mt-0.5">
            {account.normalSide === 'DEBIT' ? 'Increases balance' : 'Decreases balance'}
          </p>
        </Card>

        <Card className="p-4 bg-sky-50/60 border-sky-200">
          <div className="flex items-center gap-2 text-xs text-sky-700 font-medium mb-1">
            <TrendingUp className="h-3.5 w-3.5" /> Total Credits
          </div>
          <div className="text-base font-bold text-sky-800 tabular-nums">
            {money(totalCredit)}
          </div>
          <p className="text-[11px] text-sky-600 mt-0.5">
            {account.normalSide === 'CREDIT' ? 'Increases balance' : 'Decreases balance'}
          </p>
        </Card>

        <Card className="p-4 bg-teal-50/80 border-teal-300">
          <div className="flex items-center gap-2 text-xs text-teal-800 font-medium mb-1">
            <Wallet className="h-3.5 w-3.5" /> Net Closing Balance
          </div>
          <div className={`text-base font-bold tabular-nums ${closingVal < 0 ? 'text-red-600' : 'text-teal-900'}`}>
            {money(closingVal)}
          </div>
          <p className="text-[11px] text-teal-700 mt-0.5">Current ledger position</p>
        </Card>
      </div>

      {/* Transaction History Table */}
      <div className="rounded-lg border bg-white overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b text-xs font-semibold text-slate-700 bg-slate-50 flex items-center justify-between">
          <span>Posted Journal Entries &amp; Vouchers ({rows.length})</span>
          <span className="text-slate-400 font-normal">Sorted chronologically</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#f0f0fa] text-[#003044] border-b">
              <tr>
                <th className="px-4 py-3 text-left font-bold uppercase">Date</th>
                <th className="px-4 py-3 text-left font-bold uppercase">Entry / Ref #</th>
                <th className="px-4 py-3 text-left font-bold uppercase">Type</th>
                <th className="px-4 py-3 text-left font-bold uppercase">Branch</th>
                <th className="px-4 py-3 text-left font-bold uppercase">Memo / Description</th>
                <th className="px-4 py-3 text-right font-bold uppercase">Debit</th>
                <th className="px-4 py-3 text-right font-bold uppercase">Credit</th>
                <th className="px-4 py-3 text-right font-bold uppercase">Running Balance</th>
                <th className="px-4 py-3 text-center font-bold uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                    No posted transactions found for this account.
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                const balance = Number(row.balance.toString());
                return (
                  <tr key={row.id} className="hover:bg-[#f7fbfc] transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">{dateText(row.date)}</td>
                    <td className="px-4 py-3 font-semibold text-[#006f87] whitespace-nowrap">
                      <Link href={`/accounts/journals/${row.entryId}`} className="hover:underline">
                        {row.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{row.reference || 'Journal'}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{row.branchCode || '—'}</td>
                    <td className="max-w-[240px] truncate px-4 py-3 text-slate-700">{row.memo || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800 tabular-nums whitespace-nowrap">
                      {row.debit && Number(row.debit) > 0 ? money(row.debit) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800 tabular-nums whitespace-nowrap">
                      {row.credit && Number(row.credit) > 0 ? money(row.credit) : '—'}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold tabular-nums whitespace-nowrap ${balance < 0 ? 'text-red-500' : 'text-[#006f87]'}`}>
                      {money(row.balance)}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-[#00758a]">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-32">
                          <DropdownMenuItem asChild>
                            <Link href={`/accounts/journals/${row.entryId}`}>View Entry</Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-bold text-slate-900">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-right uppercase tracking-wider text-[11px] text-slate-600">
                    Period Total:
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-800 font-bold">
                    {money(totalDebit)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-sky-800 font-bold">
                    {money(totalCredit)}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums font-bold ${closingVal < 0 ? 'text-red-600' : 'text-teal-900'}`}>
                    {money(closingVal)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="flex items-center justify-between bg-white px-4 py-3 border-t text-xs text-slate-500">
          <span>Showing {rows.length} {rows.length === 1 ? 'transaction' : 'transactions'}</span>
          <span>Currency: <strong>{account.currency || 'BDT'}</strong></span>
        </div>
      </div>
    </div>
  );
}
