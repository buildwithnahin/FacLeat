import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Account history' };

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
  name: string;
}

function money(value: string | number) {
  const n = Number(value);
  if (!n) return '';
  const sign = n < 0 ? '- ' : '';
  return `${sign}BDT ${Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateText(iso: string) {
  const date = new Date(iso);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

export default async function AccountHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let ledger: AccountLedgerDto;
  let account: ChartAccountDto;
  try {
    [ledger, account] = await Promise.all([
      backendFetch<AccountLedgerDto>(`/api/mobile/accounts/ledger?accountId=${id}`),
      backendFetch<ChartAccountDto>(`/api/mobile/coa/${id}`),
    ]);
  } catch (e) {
    if (e instanceof BackendApiError && e.status === 404) notFound();
    throw e;
  }

  const rows = [...ledger.rows].reverse();

  return (
    <div className="text-[#003044] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-medium text-[#006f87]">Account history</h1>
          <p className="mt-1 text-sm text-slate-500">
            Account head / <span className="font-semibold text-[#006f87]">{account.name}</span>
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
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-t-lg border bg-white">
        <table className="min-w-[1040px] w-full text-xs">
          <thead className="bg-[#f0f0fa] text-[#003044]">
            <tr>
              <th className="px-3 py-4 text-left font-bold uppercase">Date</th>
              <th className="px-3 py-4 text-left font-bold uppercase">Ref No.</th>
              <th className="px-3 py-4 text-left font-bold uppercase">Type</th>
              <th className="px-3 py-4 text-left font-bold uppercase">Payee</th>
              <th className="px-3 py-4 text-left font-bold uppercase">Description</th>
              <th className="px-3 py-4 text-right font-bold uppercase">Credit</th>
              <th className="px-3 py-4 text-right font-bold uppercase">Debit</th>
              <th className="px-3 py-4 text-left font-bold uppercase">Tax</th>
              <th className="px-3 py-4 text-right font-bold uppercase">Balance</th>
              <th className="px-3 py-4 text-center font-bold uppercase">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                  No posted transactions found for this account.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const balance = Number(row.balance.toString());
              return (
                <tr key={row.id} className="border-b hover:bg-[#f7fbfc]">
                  <td className="px-3 py-3 font-semibold text-[#006f87]">{dateText(row.date)}</td>
                  <td className="px-3 py-3 font-semibold text-[#006f87]">
                    <Link href={`/accounts/journals/${row.entryId}`} className="hover:underline">
                      {row.number}
                    </Link>
                  </td>
                  <td className="px-3 py-3 font-semibold text-[#006f87]">{row.reference || 'Journal'}</td>
                  <td className="px-3 py-3 font-semibold text-[#006f87]">{row.branchCode}</td>
                  <td className="max-w-[170px] truncate px-3 py-3 font-semibold text-[#006f87]">{row.memo}</td>
                  <td className="px-3 py-3 text-right font-semibold text-[#006f87]">{money(row.credit)}</td>
                  <td className="px-3 py-3 text-right font-semibold text-[#006f87]">{money(row.debit)}</td>
                  <td className="px-3 py-3" />
                  <td className={balance < 0 ? 'px-3 py-3 text-right font-semibold text-red-500' : 'px-3 py-3 text-right font-semibold text-[#006f87]'}>
                    {money(row.balance)}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded border border-transparent text-[#00758a] hover:border-[#00758a]">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-28">
                        <DropdownMenuItem asChild>
                          <Link href={`/accounts/journals/${row.entryId}`}>Edit</Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between bg-white px-4 py-5 text-xs">
        <span>1-{rows.length} ( Total: {rows.length} )</span>
        <div className="flex items-center overflow-hidden rounded border">
          <span className="px-3 py-2 text-slate-300">Prev</span>
          <span className="bg-[#e7f1f4] px-3 py-2 font-semibold text-[#006f87]">1</span>
          <span className="px-3 py-2 text-slate-300">Next</span>
        </div>
      </div>
    </div>
  );
}
