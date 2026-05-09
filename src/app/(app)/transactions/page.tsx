'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Filter, MoreHorizontal, Plus, X, ImageIcon, Building2, Info } from 'lucide-react';
import {
  getDailyCashFlowAction,
  getDailyCashFlowDetailsAction,
  createCashTransferAction,
  listCashTransfersAction,
  listBranchesAction,
  createCashInAction,
  listCashInAction,
  getCashInSummaryAction,
  createCashOutAction,
  listCashOutAction,
  getCashOutSummaryAction,
  listContactsAction,
  listSuppliersAction,
  getNextVoucherNumberAction,
} from '@/server/actions/accounts';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Tab = 'cash-flow' | 'cash-transfer' | 'cash-in' | 'cash-out';

const TABS: { value: Tab; label: string }[] = [
  { value: 'cash-flow', label: 'Cash flow' },
  { value: 'cash-transfer', label: 'Cash transfer' },
  { value: 'cash-in', label: 'Cash in' },
  { value: 'cash-out', label: 'Cash out' },
];

export default function TransactionsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('cash-flow');
  const [cashInPrefillDate, setCashInPrefillDate] = useState<string | null>(null);
  const [cashOutPrefillDate, setCashOutPrefillDate] = useState<string | null>(null);

  const openCashEntryForm = useCallback((tab: 'cash-in' | 'cash-out', date: string) => {
    if (tab === 'cash-in') {
      setCashInPrefillDate(date);
      setActiveTab('cash-in');
      return;
    }
    setCashOutPrefillDate(date);
    setActiveTab('cash-out');
  }, []);

  return (
    <div className="p-6">
      <div className="flex gap-0 border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <label
            key={tab.value}
            className={`relative flex items-center gap-2 px-4 py-2.5 cursor-pointer text-sm font-medium transition-colors select-none whitespace-nowrap
              ${activeTab === tab.value
                ? 'text-blue-600 border-b-2 border-blue-600 -mb-px'
                : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <input
              type="radio"
              name="transaction-tab"
              value={tab.value}
              checked={activeTab === tab.value}
              onChange={() => setActiveTab(tab.value)}
              className="sr-only"
            />
            {tab.label}
          </label>
        ))}
      </div>

      <div>
        {activeTab === 'cash-flow' && <CashFlowPanel onOpenCashEntry={openCashEntryForm} />}
        {activeTab === 'cash-transfer' && <CashTransferPanel />}
        {activeTab === 'cash-in' && <CashInPanel prefillDate={cashInPrefillDate} />}
        {activeTab === 'cash-out' && <CashOutPanel prefillDate={cashOutPrefillDate} />}
      </div>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type DailyCashFlowRow = {
  date: string;
  openingBalance: string;
  totalIn: string;
  totalOut: string;
  netBalance: string;
  closingBalance: string;
  countIn: number;
  countOut: number;
};

type DailyCashFlowData = {
  userName: string;
  summary: { openingBalance: string; totalIn: string; totalOut: string; netBalance: string };
  rows: DailyCashFlowRow[];
};

type CashFlowDetailItem = {
  id: string;
  dateTime: string;
  direction: 'IN' | 'OUT';
  module: string;
  number: string;
  partyName: string | null;
  reference: string | null;
  method: string | null;
  notes: string | null;
  amount: string;
};

type CashFlowDayDetails = {
  date: string;
  summary: {
    totalIn: string;
    totalOut: string;
    netBalance: string;
    countIn: number;
    countOut: number;
  };
  items: CashFlowDetailItem[];
};

type CashTransferRow = {
  id: string;
  number: string;
  transferDate: string;
  fromBranch: string;
  toBranch: string;
  amount: string;
  transferVia: string;
  reference: string;
  remarks: string;
  imageUrl: string;
  status: string;
};

type BranchOption = { id: string; name: string; code: string };

type CashInRow = {
  id: string;
  number: string;
  date: string;
  amount: string;
  totalAmount: string;
  taxAmount: string | null;
  contactName: string | null;
  contactType: string | null;
  receiveMode: string;
  category: string;
  reference: string | null;
  projectName: string | null;
  remarks: string | null;
  branchName: string;
  sourceModule: string | null;
  sourceRefId: string | null;
  imageUrl: string | null;
};

type CashInSummary = {
  openingBalance: string;
  totalIn: string;
  totalOut: string;
  count: number;
  netBalance?: string;
};

type ContactOption = {
  id: string;
  name: string;
  type: string;
  code: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(val: string | number | undefined, opts?: { preserveSign?: boolean }): string {
  const raw = Number(val ?? 0);
  const n = opts?.preserveSign ? raw : Math.abs(raw);
  return `BDT ${n.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${fmtDate(iso)} ${h}:${m}`;
}

function monthToDateRange(month: string): { from: string; to: string } {
  const parts = month.split('-').map(Number);
  const year = parts[0] ?? new Date().getFullYear();
  const mo = parts[1] ?? 1;
  const from = `${year}-${String(mo).padStart(2, '0')}-01`;
  const lastDay = new Date(year, mo, 0).getDate();
  const to = `${year}-${String(mo).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

function cashFlowDateRange(fromMonth: string, toMonth: string): { from: string; to: string } {
  const from = monthToDateRange(fromMonth).from;
  const monthRange = monthToDateRange(toMonth);
  const today = new Date();
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  if (toMonth === currentMonthKey) {
    const to = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return { from, to };
  }

  return { from, to: monthRange.to };
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function prevMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
}

function nowDateTimeLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function dateToDateTimeLocal(date: string): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${date}T${hours}:${minutes}`;
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function isActualMonthEnd(iso: string): boolean {
  const [year, month, day] = iso.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return day === lastDay;
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({ icon, iconBg, amount, label, cardBg }: {
  icon: string; iconBg: string; amount: string; label: string; cardBg: string;
}) {
  return (
    <div className={`rounded-xl border p-4 flex items-start gap-3 ${cardBg}`}>
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div>
        <p className="text-base font-semibold text-gray-800">{amount}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ─── Count Badge ──────────────────────────────────────────────────────────────

function CountBadge({ count, color }: { count: number; color: 'green' | 'red' }) {
  const cls = color === 'green' ? 'bg-teal-100 text-teal-700' : 'bg-red-100 text-red-600';
  return (
    <span className={`ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded text-[10px] font-bold ${cls}`}>
      {String(count).padStart(2, '0')}
    </span>
  );
}

// ─── Row Action Menu ──────────────────────────────────────────────────────────

type RowActionItem = {
  label: string;
  onSelect?: () => void;
};

function RowActions({
  items = [{ label: 'Transaction details' }],
}: {
  items?: Array<string | RowActionItem>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-8 h-8 flex items-center justify-center rounded border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition-colors">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {items.map((item) => {
          const action = typeof item === 'string' ? { label: item } : item;
          return (
            <DropdownMenuItem key={action.label} onSelect={action.onSelect}>
              {action.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Error Banner ─────────────────────────────────────────────────────────────

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {msg}
    </div>
  );
}

// ─── Cash Flow Panel ──────────────────────────────────────────────────────────

function CashFlowPanel({ onOpenCashEntry }: { onOpenCashEntry: (tab: 'cash-in' | 'cash-out', date: string) => void }) {
  const [fromMonth, setFromMonth] = useState(prevMonth());
  const [toMonth, setToMonth] = useState(currentMonth());
  const [data, setData] = useState<DailyCashFlowData | null>(null);
  const [dayDetails, setDayDetails] = useState<CashFlowDayDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (from: string, to: string) => {
    setLoading(true);
    setError(null);
    try {
      const range = cashFlowDateRange(from, to);
      const result = await getDailyCashFlowAction(range);
      setData(result as DailyCashFlowData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cash flow data');
    } finally {
      setLoading(false);
    }
  }, []);

  const openDayDetails = useCallback(async (date: string) => {
    setDetailsLoading(true);
    setDetailsError(null);
    setDayDetails(null);
    try {
      const result = await getDailyCashFlowDetailsAction({ date });
      setDayDetails(result as CashFlowDayDetails);
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : 'Failed to load transaction history');
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  useEffect(() => { load(fromMonth, toMonth); }, [fromMonth, load, toMonth]);

  return (
    <div className="space-y-5">
      <div className="flex items-end gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">From</span>
          <input type="month" value={fromMonth} onChange={(e) => setFromMonth(e.target.value)}
            className="h-9 border border-gray-200 rounded-md px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">To</span>
          <input type="month" value={toMonth} onChange={(e) => setToMonth(e.target.value)}
            className="h-9 border border-gray-200 rounded-md px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button onClick={() => load(fromMonth, toMonth)}
          className="h-9 flex items-center gap-2 px-4 border border-gray-200 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition-colors">
          <Filter className="h-3.5 w-3.5" /> Filter
        </button>
      </div>

      {error && <ErrorBanner msg={error} />}

      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard icon="+" iconBg="bg-teal-400" amount={fmt(data.summary.openingBalance)} label="Opening balance" cardBg="bg-teal-50 border-teal-100" />
          <SummaryCard icon="+" iconBg="bg-teal-500" amount={fmt(data.summary.totalIn)} label="Total in" cardBg="bg-teal-50 border-teal-100" />
          <SummaryCard icon="−" iconBg="bg-amber-400" amount={fmt(data.summary.totalOut)} label="Total out" cardBg="bg-amber-50 border-amber-100" />
          <SummaryCard icon="=" iconBg="bg-gray-400" amount={fmt(data.summary.netBalance, { preserveSign: true })} label="Net balance" cardBg="bg-gray-50 border-gray-200" />
        </div>
      )}

      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Date', 'Opening Balance', 'Total In', 'Total Out', 'Net Balance', 'Closing Balance', 'Action'].map((h, i) => (
                  <th key={h} className={`px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wide ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">Loading…</td></tr>}
              {!loading && data?.rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">No transactions found for this period.</td></tr>}
              {!loading && data?.rows.map((row, index) => (
                (() => {
                  const currentMonth = monthKey(row.date);
                  const prevMonth = index > 0 ? monthKey(data.rows[index - 1].date) : null;
                  const nextMonth = index < data.rows.length - 1 ? monthKey(data.rows[index + 1].date) : null;
                  const showMonthEndClosing = prevMonth !== currentMonth && isActualMonthEnd(row.date);
                  const showMonthStartOpening = nextMonth !== currentMonth;

                  return (
                    <tr key={row.date} className="border-b border-gray-100 hover:bg-gray-50/70">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openDayDetails(row.date)}
                          className="text-blue-600 font-medium hover:underline"
                        >
                          {fmtDate(row.date)}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 tabular-nums whitespace-nowrap">
                        {showMonthStartOpening ? fmt(row.openingBalance) : ''}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                        <span className="text-gray-700">{fmt(row.totalIn)}</span>
                        <CountBadge count={row.countIn} color="green" />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                        <span className="text-gray-700">{fmt(row.totalOut)}</span>
                        <CountBadge count={row.countOut} color="red" />
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 tabular-nums whitespace-nowrap">{fmt(row.netBalance, { preserveSign: true })}</td>
                      <td className="px-4 py-3 text-right text-gray-700 tabular-nums whitespace-nowrap">
                        {showMonthEndClosing ? fmt(row.closingBalance) : ''}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <RowActions
                          items={[
                            { label: 'Cash in', onSelect: () => onOpenCashEntry('cash-in', row.date) },
                            { label: 'Cash out', onSelect: () => onOpenCashEntry('cash-out', row.date) },
                            { label: 'Transaction details', onSelect: () => openDayDetails(row.date) },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })()
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(detailsLoading || detailsError || dayDetails) && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Transaction history</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {dayDetails ? fmtDate(dayDetails.date) : detailsLoading ? 'Loading day details…' : 'Unable to load details'}
                </p>
              </div>
              <button
                onClick={() => {
                  setDayDetails(null);
                  setDetailsError(null);
                  setDetailsLoading(false);
                }}
                className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {detailsError && <ErrorBanner msg={detailsError} />}

              {detailsLoading && !dayDetails && (
                <div className="py-10 text-center text-sm text-gray-400">Loading transaction history…</div>
              )}

              {dayDetails && (
                <>
                  <div className="rounded-lg border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            {['Time', 'Type', 'Module', 'Reference', 'Party', 'Method', 'Notes', 'Amount'].map((h) => (
                              <th key={h} className="px-4 py-3 text-left font-semibold text-gray-500 uppercase text-xs tracking-wide">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {dayDetails.items.length === 0 && (
                            <tr>
                              <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">
                                No transactions found for this day.
                              </td>
                            </tr>
                          )}
                          {dayDetails.items.map((item) => (
                            <tr key={item.id} className="border-b border-gray-100 last:border-b-0">
                              <td className="px-4 py-3 whitespace-nowrap text-gray-600">{fmtDateTime(item.dateTime).split(' ')[1]}</td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                  item.direction === 'IN' ? 'bg-teal-100 text-teal-700' : 'bg-red-100 text-red-600'
                                }`}>
                                  {item.direction === 'IN' ? 'Cash in' : 'Cash out'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{item.module}</td>
                              <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{item.number || item.reference || '—'}</td>
                              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{item.partyName || '—'}</td>
                              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{item.method || '—'}</td>
                              <td className="px-4 py-3 text-gray-500 max-w-[280px] truncate">{item.notes || item.reference || '—'}</td>
                              <td className="px-4 py-3 text-right tabular-nums font-medium whitespace-nowrap">{fmt(item.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Cash Transfer Panel ──────────────────────────────────────────────────────

const TRANSFER_VIA_OPTIONS = ['Cash', 'Bank Transfer', 'Mobile Banking', 'Cheque', 'Online Transfer'];

function CashTransferPanel() {
  const [fromMonth, setFromMonth] = useState(prevMonth());
  const [toMonth, setToMonth] = useState(currentMonth());
  const [direction, setDirection] = useState<'SENT' | 'RECEIVED'>('SENT');
  const [rows, setRows] = useState<CashTransferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DailyCashFlowData['summary'] | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [branches, setBranches] = useState<BranchOption[]>([]);

  // Form state
  const [toBranchId, setToBranchId] = useState('');
  const [transferDate, setTransferDate] = useState(nowDateTimeLocal());
  const [amount, setAmount] = useState('');
  const [transferVia, setTransferVia] = useState('');
  const [reference, setReference] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const transferFileRef = useRef<HTMLInputElement>(null);

  const loadTransfers = useCallback(async (from: string, to: string, dir: 'SENT' | 'RECEIVED') => {
    setLoading(true);
    setError(null);
    try {
      const result = await listCashTransfersAction({ direction: dir, from: monthToDateRange(from).from, to: monthToDateRange(to).to });
      setRows(result as CashTransferRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transfers');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSummary = useCallback(async (from: string, to: string) => {
    try {
      const result = await getDailyCashFlowAction({ from: monthToDateRange(from).from, to: monthToDateRange(to).to });
      setSummary((result as DailyCashFlowData).summary);
    } catch {
      // summary is optional, don't block
    }
  }, []);

  useEffect(() => {
    loadTransfers(fromMonth, toMonth, direction);
    loadSummary(fromMonth, toMonth);
    listBranchesAction().then((b) => setBranches(b as BranchOption[])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyFilter() {
    loadTransfers(fromMonth, toMonth, direction);
    loadSummary(fromMonth, toMonth);
  }

  function handleDirectionChange(dir: 'SENT' | 'RECEIVED') {
    setDirection(dir);
    loadTransfers(fromMonth, toMonth, dir);
  }

  function openModal() {
    setToBranchId('');
    setTransferDate(nowDateTimeLocal());
    setAmount('');
    setTransferVia('');
    setReference('');
    setRemarks('');
    if (transferFileRef.current) transferFileRef.current.value = '';
    setFormError(null);
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!toBranchId) { setFormError('Please select a destination branch'); return; }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { setFormError('Enter a valid amount'); return; }
    if (!remarks.trim()) { setFormError('Remarks is required'); return; }

    setSubmitting(true);
    setFormError(null);
    try {
      const formData = new FormData();
      formData.set('toBranchId', toBranchId);
      formData.set('amount', amount);
      formData.set('transferDate', transferDate);
      formData.set('transferVia', transferVia);
      formData.set('reference', reference);
      formData.set('remarks', remarks);
      const image = transferFileRef.current?.files?.[0];
      if (image) formData.set('image', image);
      await createCashTransferAction(formData);
      setShowModal(false);
      if (transferFileRef.current) transferFileRef.current.value = '';
      loadTransfers(fromMonth, toMonth, direction);
      loadSummary(fromMonth, toMonth);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save transfer');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Date filter */}
      <div className="flex items-end gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">From</span>
          <input type="month" value={fromMonth} onChange={(e) => setFromMonth(e.target.value)}
            className="h-9 border border-gray-200 rounded-md px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">To</span>
          <input type="month" value={toMonth} onChange={(e) => setToMonth(e.target.value)}
            className="h-9 border border-gray-200 rounded-md px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button onClick={applyFilter}
          className="h-9 flex items-center gap-2 px-4 border border-gray-200 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition-colors">
          <Filter className="h-3.5 w-3.5" /> Filter
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard icon="+" iconBg="bg-teal-400" amount={fmt(summary.openingBalance)} label="Opening balance" cardBg="bg-teal-50 border-teal-100" />
          <SummaryCard icon="+" iconBg="bg-teal-500" amount={fmt(summary.totalIn)} label="Total in" cardBg="bg-teal-50 border-teal-100" />
          <SummaryCard icon="−" iconBg="bg-amber-400" amount={fmt(summary.totalOut)} label="Total out" cardBg="bg-amber-50 border-amber-100" />
          <SummaryCard icon="=" iconBg="bg-gray-400" amount={fmt(summary.netBalance, { preserveSign: true })} label="Net balance" cardBg="bg-gray-50 border-gray-200" />
        </div>
      )}

      {error && <ErrorBanner msg={error} />}

      {/* Table header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm font-semibold text-gray-800">
          {direction === 'SENT' ? 'Sent cash transfer' : 'Received cash transfer'}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Filter by</span>
          <select
            value={direction}
            onChange={(e) => handleDirectionChange(e.target.value as 'SENT' | 'RECEIVED')}
            className="h-9 border border-gray-200 rounded-md px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[100px]"
          >
            <option value="SENT">Sent</option>
            <option value="RECEIVED">Received</option>
          </select>
          <button
            onClick={openModal}
            className="h-9 flex items-center gap-1.5 px-4 rounded-md text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: '#0f6b6b' }}
          >
            <Plus className="h-4 w-4" />
            Add cash transfer
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wide">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wide">
                  {direction === 'SENT' ? 'Cash Transfer To' : 'Cash Transfer From'}
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wide">Attachments</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wide">Amount</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wide">Remarks</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wide">Transfer via</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wide">Status</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">Loading…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <Building2 className="h-10 w-10 opacity-30" />
                      <p className="text-sm">No data</p>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && rows.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/70">
                  <td className="px-4 py-3 text-blue-600 font-medium whitespace-nowrap">{fmtDateTime(row.transferDate)}</td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      {direction === 'SENT' ? row.toBranch : row.fromBranch}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {row.imageUrl ? (
                      <a href={row.imageUrl} target="_blank" rel="noreferrer"
                        className="text-blue-500 hover:underline flex items-center gap-1">
                        <ImageIcon className="h-3 w-3" /> View
                      </a>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-800 whitespace-nowrap">
                    {fmt(row.amount)}
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{row.remarks}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{row.transferVia || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      row.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                      row.status === 'CANCELLED' ? 'bg-red-100 text-red-600' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {row.status.charAt(0) + row.status.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center"><RowActions /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Cash Transfer Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 rounded-t-xl" style={{ backgroundColor: '#0f6b6b' }}>
              <h2 className="text-white font-semibold text-base">Add cash transfer</h2>
              <button onClick={() => setShowModal(false)}
                className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Modal form */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {formError && <ErrorBanner msg={formError} />}

              {/* Cash transfer to */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Cash transfer to <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <select
                    value={toBranchId}
                    onChange={(e) => setToBranchId(e.target.value)}
                    required
                    className="w-full h-10 border border-gray-200 rounded-md pl-9 pr-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none bg-white"
                  >
                    <option value="">Select branch…</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date & time */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Date &amp; time <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  required
                  className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Amount */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  Amount <span className="text-red-500">*</span>
                  <span className="ml-auto w-5 h-5 rounded-full bg-teal-100 text-teal-700 text-xs flex items-center justify-center font-bold">i</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500">BDT</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full h-10 border border-gray-200 rounded-md pl-10 pr-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                {amount && <p className="text-xs text-gray-400">= BDT {Number(amount || 0).toFixed(2)}</p>}
              </div>

              {/* Transfer via */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Transfer via</label>
                <select
                  value={transferVia}
                  onChange={(e) => setTransferVia(e.target.value)}
                  className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none bg-white"
                >
                  <option value="">Transfer via</option>
                  {TRANSFER_VIA_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>

              {/* Reference */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Reference</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Remarks */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Remarks <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                  required
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                />
              </div>

              {/* Voucher image */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Voucher image</label>
                <div
                  className="border-2 border-dashed border-gray-200 rounded-lg p-6 flex flex-col items-center gap-2 text-gray-400 cursor-pointer hover:border-gray-300 transition-colors"
                  onClick={() => transferFileRef.current?.click()}
                >
                  <input ref={transferFileRef} type="file" accept="image/*" className="sr-only" />
                  <ImageIcon className="h-8 w-8 opacity-40" />
                  <p className="text-xs text-center">Drag/drop image or click to upload</p>
                  <p className="text-[10px]">Max size 2MB</p>
                </div>
              </div>

              {/* Save button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-10 rounded-md text-white text-sm font-medium transition-colors disabled:opacity-60"
                style={{ backgroundColor: '#0f6b6b' }}
              >
                {submitting ? 'Saving…' : 'Save'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Cash In Panel ────────────────────────────────────────────────────────────

const RECEIVE_MODES = ['Cash', 'Bank', 'Mobile Banking', 'Cheque', 'Online Transfer'];
const CASH_IN_CATEGORIES = [
  'Receive payment',
  'Sales income',
  'Service income',
  'Interest income',
  'Rental income',
  'Commission income',
  'Refund received',
  'Opening balance',
  'Other income',
];

function CashInPanel({ prefillDate }: { prefillDate?: string | null }) {
  const [fromMonth, setFromMonth] = useState(prevMonth());
  const [toMonth, setToMonth] = useState(currentMonth());
  const [summary, setSummary] = useState<CashInSummary | null>(null);
  const [rows, setRows] = useState<CashInRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<CashInRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<ContactOption[]>([]);

  // Form state
  const [date, setDate] = useState(nowDateTimeLocal());
  const [voucherNumber, setVoucherNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [taxPercent, setTaxPercent] = useState('');
  const [contactId, setContactId] = useState('');
  const [receiveMode, setReceiveMode] = useState('');
  const [category, setCategory] = useState('');
  const [reference, setReference] = useState('');
  const [projectName, setProjectName] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const taxAmount = amount && taxPercent
    ? (Number(amount) * Number(taxPercent) / 100).toFixed(2)
    : null;
  const totalAmount = amount
    ? (Number(amount) + (taxAmount ? Number(taxAmount) : 0)).toFixed(2)
    : '0.00';

  const loadData = useCallback(async (from: string, to: string) => {
    setLoading(true);
    setError(null);
    try {
      const [rows, summary] = await Promise.all([
        listCashInAction({ from: monthToDateRange(from).from, to: monthToDateRange(to).to }),
        getCashInSummaryAction({ from: monthToDateRange(from).from, to: monthToDateRange(to).to }),
      ]);
      setRows(rows as CashInRow[]);
      setSummary(summary as CashInSummary);
      if ((rows as CashInRow[]).length > 0 && !selectedRow) {
        setSelectedRow((rows as CashInRow[])[0] ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadData(fromMonth, toMonth);
    listContactsAction().then((c) => setContacts(c as ContactOption[])).catch(() => {});
    getNextVoucherNumberAction().then((n) => setVoucherNumber(n)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!prefillDate) return;
    setDate(dateToDateTimeLocal(prefillDate));
    setFromMonth(monthKey(prefillDate));
    setToMonth(monthKey(prefillDate));
    setFormError(null);
    setFormSuccess(false);
  }, [prefillDate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(false);

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setFormError('Enter a valid amount');
      return;
    }
    if (!receiveMode) { setFormError('Receive mode is required'); return; }
    if (!category) { setFormError('Category is required'); return; }

    setSubmitting(true);
    try {
      const selectedContact = contacts.find((c) => c.id === contactId);
      const formData = new FormData();
      formData.set('date', date);
      formData.set('amount', amount);
      formData.set('taxPercent', taxPercent);
      formData.set('contactId', contactId);
      formData.set('contactName', selectedContact?.name ?? '');
      formData.set('receiveMode', receiveMode);
      formData.set('category', category);
      formData.set('reference', reference);
      formData.set('projectName', projectName);
      formData.set('remarks', remarks);
      const image = fileRef.current?.files?.[0];
      if (image) formData.set('image', image);
      const result = await createCashInAction(formData);

      setFormSuccess(true);
      setAmount('');
      setTaxPercent('');
      setContactId('');
      setReceiveMode('');
      setCategory('');
      setReference('');
      setProjectName('');
      setRemarks('');
      if (fileRef.current) fileRef.current.value = '';

      const newRow: CashInRow = {
        id: (result as { id: string }).id,
        number: (result as { number: string }).number,
        date: (result as { date: string }).date,
        amount: (result as { amount: string }).amount,
        totalAmount: (result as { totalAmount: string }).totalAmount,
        taxAmount: (result as { taxAmount: string | null }).taxAmount,
        contactName: (result as { contactName: string | null }).contactName,
        contactType: (result as { contactType: string | null }).contactType,
        receiveMode: (result as { receiveMode: string }).receiveMode,
        category: (result as { category: string }).category,
        reference: (result as { reference: string | null }).reference,
        projectName: (result as { projectName: string | null }).projectName,
        remarks: (result as { remarks: string | null }).remarks,
        branchName: (result as { branchName: string }).branchName,
        sourceModule: null,
        sourceRefId: null,
        imageUrl: (result as { imageUrl: string | null }).imageUrl,
      };
      setRows((prev) => [newRow, ...prev]);
      setSelectedRow(newRow);

      // refresh voucher number and summary
      getNextVoucherNumberAction().then((n) => setVoucherNumber(n)).catch(() => {});
      getCashInSummaryAction({ from: monthToDateRange(fromMonth).from, to: monthToDateRange(toMonth).to })
        .then((s) => setSummary(s as CashInSummary)).catch(() => {});
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save entry');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Date filter + summary */}
      <div className="flex items-end gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">From</span>
          <input type="month" value={fromMonth} onChange={(e) => setFromMonth(e.target.value)}
            className="h-9 border border-gray-200 rounded-md px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">To</span>
          <input type="month" value={toMonth} onChange={(e) => setToMonth(e.target.value)}
            className="h-9 border border-gray-200 rounded-md px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button onClick={() => loadData(fromMonth, toMonth)}
          className="h-9 flex items-center gap-2 px-4 border border-gray-200 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition-colors">
          <Filter className="h-3.5 w-3.5" /> Filter
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard icon="+" iconBg="bg-teal-400" amount={fmt(summary.openingBalance)} label="Opening balance" cardBg="bg-teal-50 border-teal-100" />
          <SummaryCard icon="+" iconBg="bg-teal-500" amount={fmt(summary.totalIn)} label="Total in" cardBg="bg-teal-50 border-teal-100" />
          <SummaryCard icon="−" iconBg="bg-amber-400" amount={fmt(summary.totalOut)} label="Total out" cardBg="bg-amber-50 border-amber-100" />
          <SummaryCard icon="=" iconBg="bg-gray-400" amount={fmt(summary.netBalance, { preserveSign: true })} label="Net balance" cardBg="bg-gray-50 border-gray-200" />
        </div>
      )}

      {error && <ErrorBanner msg={error} />}

      {/* Split layout: form left, recent transactions right */}
      <div className="flex gap-5">
        {/* ── Left: Add cash in entry form ── */}
        <div className="flex-1 min-w-0">
          <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-800">Add cash in entry</h3>

            {formError && <ErrorBanner msg={formError} />}
            {formSuccess && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Cash in entry saved successfully.
              </div>
            )}

            {/* Row 1: Date & time + Voucher number */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  Date &amp; time <span className="text-red-500">*</span>
                  <span className="ml-auto w-5 h-5 rounded-full bg-teal-100 text-teal-700 text-xs flex items-center justify-center font-bold">
                    <Info className="h-3 w-3" />
                  </span>
                </label>
                <input
                  type="datetime-local"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Voucher number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={`#${voucherNumber}`}
                  readOnly
                  className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm text-gray-500 bg-gray-50 cursor-not-allowed"
                />
              </div>
            </div>

            {/* Row 2: Amount + Tax */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  Amount (without tax) <span className="text-red-500">*</span>
                  <span className="ml-auto w-5 h-5 rounded-full bg-teal-100 text-teal-700 text-xs flex items-center justify-center font-bold">
                    <Info className="h-3 w-3" />
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500 pointer-events-none">BDT</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full h-10 border border-gray-200 rounded-md pl-12 pr-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p className="text-xs text-gray-400">= BDT {Number(amount || 0).toFixed(2)}</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Tax (%)</label>
                <div className="relative">
                  <select
                    value={taxPercent}
                    onChange={(e) => setTaxPercent(e.target.value)}
                    className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
                  >
                    <option value="">Select…</option>
                    <option value="5">5%</option>
                    <option value="7.5">7.5%</option>
                    <option value="10">10%</option>
                    <option value="15">15%</option>
                  </select>
                </div>
                {taxAmount && (
                  <p className="text-xs text-gray-400">Tax: BDT {taxAmount} → Total: BDT {totalAmount}</p>
                )}
              </div>
            </div>

            {/* Row 3: Contact + Receive mode */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Contact</label>
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
                >
                  <option value="">Contact</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Receive mode <span className="text-red-500">*</span>
                </label>
                <select
                  value={receiveMode}
                  onChange={(e) => setReceiveMode(e.target.value)}
                  required
                  className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
                >
                  <option value="">Receive mode</option>
                  {RECEIVE_MODES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 4: Category + Reference */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                  className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
                >
                  <option value="">Category</option>
                  {CASH_IN_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Reference</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Project */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Project</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Project name (optional)"
                className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Remarks */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Remarks</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={4}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Voucher image */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Voucher image</label>
              <div
                className="border-2 border-dashed border-gray-200 rounded-lg p-6 flex flex-col items-center gap-2 text-gray-400 cursor-pointer hover:border-gray-300 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" accept="image/*" className="sr-only" />
                <ImageIcon className="h-8 w-8 opacity-40" />
                <p className="text-xs text-center">Drag/drop image or click to upload</p>
                <p className="text-[10px]">Max size 2MB</p>
              </div>
            </div>

            {/* Save */}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="h-10 px-6 rounded-md text-white text-sm font-medium transition-colors disabled:opacity-60"
                style={{ backgroundColor: '#0f6b6b' }}
              >
                {submitting ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAmount(''); setTaxPercent(''); setContactId(''); setReceiveMode('');
                  setCategory(''); setReference(''); setProjectName(''); setRemarks('');
                  setFormError(null); setFormSuccess(false);
                }}
                className="h-10 px-4 rounded-md text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Reset
              </button>
            </div>
          </form>
        </div>

        {/* ── Right: Recent transactions ── */}
        <div className="w-72 shrink-0">
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-700">Recent transactions</h3>
            </div>

            {/* List of recent entries */}
            <div className="divide-y divide-gray-100 max-h-44 overflow-y-auto">
              {loading && (
                <div className="px-4 py-8 text-center text-sm text-gray-400">Loading…</div>
              )}
              {!loading && rows.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-gray-400">No entries yet.</div>
              )}
              {!loading && rows.map((row) => (
                <button
                  key={row.id}
                  onClick={() => setSelectedRow(row)}
                  className={`w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors ${selectedRow?.id === row.id ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-blue-600 truncate">#{row.number}</span>
                    <span className="text-xs text-gray-500 whitespace-nowrap">{fmtDate(row.date)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-xs text-gray-600 truncate">{row.category}</span>
                    <span className="text-xs font-semibold text-teal-700 tabular-nums whitespace-nowrap">{fmt(row.totalAmount)}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Detail of selected entry */}
            {selectedRow && (
              <div className="border-t border-gray-200 divide-y divide-gray-100">
                {[
                  { label: 'Date', value: fmtDateTime(selectedRow.date) },
                  { label: 'Voucher number', value: `#${selectedRow.number}` },
                  { label: 'Type', value: <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-teal-600 text-white">Cash in</span> },
                  { label: 'Amount', value: fmt(selectedRow.totalAmount) },
                  { label: 'Contact', value: selectedRow.contactName ? (
                    <span className="flex items-center gap-1">
                      <span>{selectedRow.contactName}</span>
                      {selectedRow.contactType && (
                        <span className="text-[10px] px-1 rounded bg-gray-100 text-gray-500">{selectedRow.contactType}</span>
                      )}
                    </span>
                  ) : '—' },
                  { label: 'Category', value: selectedRow.category },
                  { label: 'Receive mode', value: selectedRow.receiveMode },
                  { label: 'Branch', value: selectedRow.branchName },
                  { label: 'Reference', value: selectedRow.reference || '—' },
                  { label: 'Project', value: selectedRow.projectName || '—' },
                  { label: 'Remarks', value: selectedRow.remarks || '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="px-4 py-2 flex items-start gap-2">
                    <span className="text-xs text-gray-500 w-28 shrink-0">{label}:</span>
                    <span className="text-xs text-gray-800 text-right flex-1">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Cash Out Panel ───────────────────────────────────────────────────────────

type CashOutRow = {
  id: string;
  number: string;
  date: string;
  amount: string;
  totalAmount: string;
  taxAmount: string | null;
  contactName: string | null;
  contactType: string | null;
  payMode: string;
  category: string;
  reference: string | null;
  projectName: string | null;
  remarks: string | null;
  branchName: string;
  sourceModule: string | null;
  sourceRefId: string | null;
  imageUrl: string | null;
};

const PAY_MODES = ['Cash', 'Bank', 'Mobile Banking', 'Cheque', 'Online Transfer'];
const CASH_OUT_CATEGORIES = [
  'Supplier payment',
  'Purchase expense',
  'Salary & wages',
  'Rent expense',
  'Utility expense',
  'Transport expense',
  'Office expense',
  'Marketing expense',
  'Maintenance expense',
  'Tax payment',
  'Loan repayment',
  'Refund issued',
  'Other expense',
];

function CashOutPanel({ prefillDate }: { prefillDate?: string | null }) {
  const [fromMonth, setFromMonth] = useState(prevMonth());
  const [toMonth, setToMonth] = useState(currentMonth());
  const [summary, setSummary] = useState<CashInSummary | null>(null);
  const [rows, setRows] = useState<CashOutRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<CashOutRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<ContactOption[]>([]);

  // Form state
  const [date, setDate] = useState(nowDateTimeLocal());
  const [voucherNumber, setVoucherNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [taxPercent, setTaxPercent] = useState('');
  const [contactId, setContactId] = useState('');
  const [payMode, setPayMode] = useState('');
  const [category, setCategory] = useState('');
  const [reference, setReference] = useState('');
  const [projectName, setProjectName] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const taxAmount = amount && taxPercent
    ? (Number(amount) * Number(taxPercent) / 100).toFixed(2)
    : null;
  const totalAmount = amount
    ? (Number(amount) + (taxAmount ? Number(taxAmount) : 0)).toFixed(2)
    : '0.00';

  const loadData = useCallback(async (from: string, to: string) => {
    setLoading(true);
    setError(null);
    try {
      const [rowData, summaryData] = await Promise.all([
        listCashOutAction({ from: monthToDateRange(from).from, to: monthToDateRange(to).to }),
        getCashOutSummaryAction({ from: monthToDateRange(from).from, to: monthToDateRange(to).to }),
      ]);
      setRows(rowData as CashOutRow[]);
      setSummary(summaryData as CashInSummary);
      if ((rowData as CashOutRow[]).length > 0 && !selectedRow) {
        setSelectedRow((rowData as CashOutRow[])[0] ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadData(fromMonth, toMonth);
    listSuppliersAction().then((c) => setContacts(c as ContactOption[])).catch(() => {});
    getNextVoucherNumberAction().then((n) => setVoucherNumber(n)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!prefillDate) return;
    setDate(dateToDateTimeLocal(prefillDate));
    setFromMonth(monthKey(prefillDate));
    setToMonth(monthKey(prefillDate));
    setFormError(null);
    setFormSuccess(false);
  }, [prefillDate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(false);

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setFormError('Enter a valid amount');
      return;
    }
    if (!payMode) { setFormError('Pay mode is required'); return; }
    if (!category) { setFormError('Category is required'); return; }

    setSubmitting(true);
    try {
      const selectedContact = contacts.find((c) => c.id === contactId);
      const formData = new FormData();
      formData.set('date', date);
      formData.set('amount', amount);
      formData.set('taxPercent', taxPercent);
      formData.set('contactName', selectedContact?.name ?? '');
      formData.set('contactType', selectedContact?.type ?? '');
      formData.set('payMode', payMode);
      formData.set('category', category);
      formData.set('reference', reference);
      formData.set('projectName', projectName);
      formData.set('remarks', remarks);
      const image = fileRef.current?.files?.[0];
      if (image) formData.set('image', image);
      const result = await createCashOutAction(formData);

      setFormSuccess(true);
      setAmount('');
      setTaxPercent('');
      setContactId('');
      setPayMode('');
      setCategory('');
      setReference('');
      setProjectName('');
      setRemarks('');
      if (fileRef.current) fileRef.current.value = '';

      const newRow: CashOutRow = {
        id: (result as { id: string }).id,
        number: (result as { number: string }).number,
        date: (result as { date: string }).date,
        amount: (result as { amount: string }).amount,
        totalAmount: (result as { totalAmount: string }).totalAmount,
        taxAmount: (result as { taxAmount: string | null }).taxAmount,
        contactName: (result as { contactName: string | null }).contactName,
        contactType: (result as { contactType: string | null }).contactType,
        payMode: (result as { payMode: string }).payMode,
        category: (result as { category: string }).category,
        reference: (result as { reference: string | null }).reference,
        projectName: (result as { projectName: string | null }).projectName,
        remarks: (result as { remarks: string | null }).remarks,
        branchName: (result as { branchName: string }).branchName,
        sourceModule: null,
        sourceRefId: null,
        imageUrl: (result as { imageUrl: string | null }).imageUrl,
      };
      setRows((prev) => [newRow, ...prev]);
      setSelectedRow(newRow);

      getNextVoucherNumberAction().then((n) => setVoucherNumber(n)).catch(() => {});
      getCashOutSummaryAction({ from: monthToDateRange(fromMonth).from, to: monthToDateRange(toMonth).to })
        .then((s) => setSummary(s as CashInSummary)).catch(() => {});
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save entry');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Date filter + summary */}
      <div className="flex items-end gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">From</span>
          <input type="month" value={fromMonth} onChange={(e) => setFromMonth(e.target.value)}
            className="h-9 border border-gray-200 rounded-md px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">To</span>
          <input type="month" value={toMonth} onChange={(e) => setToMonth(e.target.value)}
            className="h-9 border border-gray-200 rounded-md px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button onClick={() => loadData(fromMonth, toMonth)}
          className="h-9 flex items-center gap-2 px-4 border border-gray-200 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition-colors">
          <Filter className="h-3.5 w-3.5" /> Filter
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard icon="+" iconBg="bg-teal-400" amount={fmt(summary.openingBalance)} label="Opening balance" cardBg="bg-teal-50 border-teal-100" />
          <SummaryCard icon="+" iconBg="bg-blue-400" amount={fmt(summary.totalIn)} label="Total in" cardBg="bg-blue-50 border-blue-100" />
          <SummaryCard icon="−" iconBg="bg-amber-400" amount={fmt(summary.totalOut)} label="Total out" cardBg="bg-amber-50 border-amber-100" />
          <SummaryCard icon="=" iconBg="bg-gray-400"
            amount={fmt(summary.netBalance ?? String(Number(summary.openingBalance) + Number(summary.totalIn) - Number(summary.totalOut)), { preserveSign: true })}
            label="Net balance" cardBg="bg-gray-50 border-gray-200" />
        </div>
      )}

      {error && <ErrorBanner msg={error} />}

      {/* Split layout: form left, recent transactions right */}
      <div className="flex gap-5">
        {/* ── Left: Add cash out entry form ── */}
        <div className="flex-1 min-w-0">
          <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-800">Add cash out entry</h3>

            {formError && <ErrorBanner msg={formError} />}
            {formSuccess && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Cash out entry saved successfully.
              </div>
            )}

            {/* Row 1: Date & time + Voucher number */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  Date &amp; time <span className="text-red-500">*</span>
                  <span className="ml-auto w-5 h-5 rounded-full bg-red-100 text-red-600 text-xs flex items-center justify-center font-bold">
                    <Info className="h-3 w-3" />
                  </span>
                </label>
                <input
                  type="datetime-local"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Voucher number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={`#${voucherNumber}`}
                  readOnly
                  className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm text-gray-500 bg-gray-50 cursor-not-allowed"
                />
              </div>
            </div>

            {/* Row 2: Amount + Tax */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  Amount (without tax) <span className="text-red-500">*</span>
                  <span className="ml-auto w-5 h-5 rounded-full bg-red-100 text-red-600 text-xs flex items-center justify-center font-bold">
                    <Info className="h-3 w-3" />
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500 pointer-events-none">BDT</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full h-10 border border-gray-200 rounded-md pl-12 pr-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p className="text-xs text-gray-400">= BDT {Number(amount || 0).toFixed(2)}</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Tax (%)</label>
                <select
                  value={taxPercent}
                  onChange={(e) => setTaxPercent(e.target.value)}
                  className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
                >
                  <option value="">Select…</option>
                  <option value="5">5%</option>
                  <option value="7.5">7.5%</option>
                  <option value="10">10%</option>
                  <option value="15">15%</option>
                </select>
                {taxAmount && (
                  <p className="text-xs text-gray-400">Tax: BDT {taxAmount} → Total: BDT {totalAmount}</p>
                )}
              </div>
            </div>

            {/* Row 3: Contact + Pay mode */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Contact</label>
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
                >
                  <option value="">Contact</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Pay mode <span className="text-red-500">*</span>
                </label>
                <select
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value)}
                  required
                  className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
                >
                  <option value="">Pay mode</option>
                  {PAY_MODES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 4: Category + Reference */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                  className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
                >
                  <option value="">Category</option>
                  {CASH_OUT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Reference</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Project */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Project</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Project name (optional)"
                className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Remarks */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Remarks</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={4}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Voucher image */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Voucher image</label>
              <div
                className="border-2 border-dashed border-gray-200 rounded-lg p-6 flex flex-col items-center gap-2 text-gray-400 cursor-pointer hover:border-gray-300 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" accept="image/*" className="sr-only" />
                <ImageIcon className="h-8 w-8 opacity-40" />
                <p className="text-xs text-center">Drag/drop image or click to upload</p>
                <p className="text-[10px]">Max size 2MB</p>
              </div>
            </div>

            {/* Save */}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="h-10 px-6 rounded-md text-white text-sm font-medium transition-colors disabled:opacity-60 bg-red-600 hover:bg-red-700"
              >
                {submitting ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAmount(''); setTaxPercent(''); setContactId(''); setPayMode('');
                  setCategory(''); setReference(''); setProjectName(''); setRemarks('');
                  setFormError(null); setFormSuccess(false);
                }}
                className="h-10 px-4 rounded-md text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Reset
              </button>
            </div>
          </form>
        </div>

        {/* ── Right: Recent transactions ── */}
        <div className="w-72 shrink-0">
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-700">Recent transactions</h3>
            </div>

            <div className="divide-y divide-gray-100 max-h-44 overflow-y-auto">
              {loading && (
                <div className="px-4 py-8 text-center text-sm text-gray-400">Loading…</div>
              )}
              {!loading && rows.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-gray-400">No entries yet.</div>
              )}
              {!loading && rows.map((row) => (
                <button
                  key={row.id}
                  onClick={() => setSelectedRow(row)}
                  className={`w-full text-left px-4 py-2.5 hover:bg-red-50 transition-colors ${selectedRow?.id === row.id ? 'bg-red-50' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-blue-600 truncate">#{row.number}</span>
                    <span className="text-xs text-gray-500 whitespace-nowrap">{fmtDate(row.date)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-xs text-gray-600 truncate">{row.category}</span>
                    <span className="text-xs font-semibold text-red-600 tabular-nums whitespace-nowrap">{fmt(row.totalAmount)}</span>
                  </div>
                </button>
              ))}
            </div>

            {selectedRow && (
              <div className="border-t border-gray-200 divide-y divide-gray-100">
                {[
                  { label: 'Date', value: fmtDateTime(selectedRow.date) },
                  { label: 'Voucher number', value: `#${selectedRow.number}` },
                  { label: 'Type', value: <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-600 text-white">Cash out</span> },
                  { label: 'Amount', value: fmt(selectedRow.totalAmount) },
                  { label: 'Contact', value: selectedRow.contactName ? (
                    <span className="flex items-center gap-1">
                      <span>{selectedRow.contactName}</span>
                      {selectedRow.contactType && (
                        <span className="text-[10px] px-1 rounded bg-gray-100 text-gray-500">{selectedRow.contactType}</span>
                      )}
                    </span>
                  ) : '—' },
                  { label: 'Category', value: selectedRow.category },
                  { label: 'Pay mode', value: selectedRow.payMode },
                  { label: 'Branch', value: selectedRow.branchName },
                  { label: 'Reference', value: selectedRow.reference || '—' },
                  { label: 'Project', value: selectedRow.projectName || '—' },
                  { label: 'Remarks', value: selectedRow.remarks || '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="px-4 py-2 flex items-start gap-2">
                    <span className="text-xs text-gray-500 w-28 shrink-0">{label}:</span>
                    <span className="text-xs text-gray-800 text-right flex-1">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
