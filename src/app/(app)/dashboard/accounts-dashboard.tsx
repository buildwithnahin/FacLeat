import Link from 'next/link';
import { Prisma } from '@prisma/client';
import { Banknote, BarChart3, HandCoins, Landmark, Receipt, Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/money';
import type { AppSession } from '@/server/auth/session';
import { prisma } from '@/server/db';
import { KpiCard } from '@/components/shared/kpi-card';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ZERO = new Prisma.Decimal(0);

const CARDS = [
  { key: 'cashBalance', label: 'Cash Balance', href: '/accounts/ledger', icon: Wallet, tone: 'primary' as const },
  { key: 'bankBalance', label: 'Bank Balance', href: '/accounts/ledger', icon: Landmark, tone: 'primary' as const },
  { key: 'todayReceipt', label: 'Today Receipt', href: '/accounts/cash-flow', icon: Receipt, tone: 'default' as const },
  { key: 'todayPayment', label: 'Today Payment', href: '/accounts/cash-flow', icon: Banknote, tone: 'default' as const },
  { key: 'payable', label: 'Payable', href: '/reports/purchase', icon: HandCoins, tone: 'warning' as const },
  { key: 'receivable', label: 'Receivable', href: '/reports/sales', icon: BarChart3, tone: 'warning' as const },
];

const TASKS = [
  { key: 'voucher-approval', primary: 'Voucher Approval', secondary: 'Review journal entries and posting readiness', href: '/accounts/journals' },
  { key: 'supplier-payment', primary: 'Supplier Payment', secondary: 'Monitor bills and supplier settlements', href: '/purchase/invoices' },
  { key: 'customer-collection', primary: 'Customer Collection', secondary: 'Review due collections and open invoices', href: '/reports/sales' },
  { key: 'bank-recon', primary: 'Bank Reconciliation', secondary: 'Reconcile posted entries and bank balances', href: '/accounts/ledger' },
];

const REPORTS = [
  { key: 'ledger-report', primary: 'Ledger Report', secondary: 'General ledger and account movement', href: '/accounts/ledger' },
  { key: 'trial-balance', primary: 'Trial Balance', secondary: 'Posted balance snapshot by account', href: '/accounts/trial-balance' },
  { key: 'profit-loss', primary: 'Profit & Loss', secondary: 'Income and expense summary', href: '/accounts/income-statement' },
  { key: 'balance-sheet', primary: 'Balance Sheet', secondary: 'Asset, liability, and equity view', href: '/accounts/balance-sheet' },
];

export async function AccountsDashboard({ session }: { session: AppSession }) {
  const branch = session.activeBranchId
    ? await prisma.branch.findUnique({
        where: { id: session.activeBranchId },
        select: { code: true, name: true },
      })
    : null;

  const today = startOfDay();
  const monthStart = startOfMonth();
  const branchId = session.activeBranchId ?? undefined;

  const [cashBalance, bankBalance, sales, purchase, todayReceipts, todayPayments] = await Promise.all([
    getPositiveBalanceByKeyword(branchId, ['cash']),
    getPositiveBalanceByKeyword(branchId, ['bank']),
    getSalesTotals(branchId, monthStart, new Date()),
    getPurchaseTotals(branchId),
    getTodayReceipts(branchId, today),
    getTodayPayments(branchId, today),
  ]);

  const metrics = {
    cashBalance: formatCurrency(cashBalance),
    bankBalance: formatCurrency(bankBalance),
    todayReceipt: formatCurrency(todayReceipts),
    todayPayment: formatCurrency(todayPayments),
    payable: formatCurrency(purchase.openPayable),
    receivable: formatCurrency(sales.outstanding),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts Dashboard"
        description={`Cash, bank, receivable, payable, and statutory reporting visibility. Scoped to ${branch?.name ?? branch?.code ?? 'active branch'}.`}
      >
        <Badge variant="outline">Accounts</Badge>
        <Badge variant="secondary">{session.roles.join(', ')}</Badge>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((card) => (
          <Link key={card.key} href={card.href} className="block">
            <KpiCard
              label={card.label}
              value={metrics[card.key as keyof typeof metrics]}
              icon={card.icon}
              tone={card.tone}
              className="h-full transition-colors hover:border-primary"
            />
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <SimplePanel title="Tasks" rows={TASKS} emptyText="No task shortcuts available." />
        <SimplePanel title="Reports" rows={REPORTS} emptyText="No report shortcuts available." />
        <SimplePanel title="Notes" rows={[{ key: 'notes', primary: 'Balance source', secondary: 'Cash and bank balances are derived from posted ledger accounts using account-name matching.', href: '/accounts/ledger' }]} emptyText="No notes." />
      </div>
    </div>
  );
}

function SimplePanel({
  title,
  rows,
  emptyText,
}: {
  title: string;
  rows: Array<{ key: string; primary: string; secondary: string; href: string }>;
  emptyText: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          rows.map((row) => (
            <Link key={row.key} href={row.href} className="block rounded-md border p-3 hover:border-primary">
              <p className="font-medium">{row.primary}</p>
              <p className="text-sm text-muted-foreground">{row.secondary}</p>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function startOfDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

async function getPositiveBalanceByKeyword(branchId: string | undefined, keywords: string[]) {
  const normalized = keywords.map((keyword) => keyword.toLowerCase());
  const accounts = await prisma.chartAccount.findMany({
    where: {
      OR: normalized.flatMap((keyword) => [
        { name: { contains: keyword, mode: 'insensitive' } },
        { code: { contains: keyword, mode: 'insensitive' } },
      ]),
    },
    select: { id: true },
  });

  if (accounts.length === 0) return ZERO;

  const rows = await prisma.journalEntryLine.groupBy({
    by: ['accountId'],
    where: {
      accountId: { in: accounts.map((account) => account.id) },
      entry: {
        status: 'POSTED',
        ...(branchId ? { branchId } : {}),
      },
    },
    _sum: { debit: true, credit: true },
  });

  return rows.reduce((sum, row) => {
    const balance = (row._sum.debit ?? ZERO).minus(row._sum.credit ?? ZERO);
    return balance.greaterThan(0) ? sum.plus(balance) : sum;
  }, ZERO);
}

async function getSalesTotals(branchId: string | undefined, from: Date, to: Date) {
  const [pos, wholesale, corporate] = await Promise.all([
    prisma.posSale.aggregate({
      where: {
        saleDate: { gte: from, lte: to },
        status: { not: 'VOIDED' },
        ...(branchId ? { branchId } : {}),
      },
      _sum: { paidTotal: true },
    }),
    prisma.wholesaleInvoice.aggregate({
      where: {
        invoiceDate: { gte: from, lte: to },
        status: { notIn: ['VOIDED'] },
        ...(branchId ? { branchId } : {}),
      },
      _sum: { balanceDue: true },
    }),
    prisma.corporateInvoice.aggregate({
      where: {
        invoiceDate: { gte: from, lte: to },
        ...(branchId ? { branchId } : {}),
      },
      _sum: { balanceDue: true },
    }),
  ]);

  return {
    paid: pos._sum.paidTotal ?? ZERO,
    outstanding: (wholesale._sum.balanceDue ?? ZERO).plus(corporate._sum.balanceDue ?? ZERO),
  };
}

async function getPurchaseTotals(branchId: string | undefined) {
  const unpaidAgg = await prisma.purchaseInvoice.aggregate({
    where: {
      status: { notIn: ['PAID', 'CANCELLED'] },
      ...(branchId ? { branchId } : {}),
    },
    _sum: { grandTotal: true, paidAmount: true },
  });

  return {
    openPayable: (unpaidAgg._sum.grandTotal ?? ZERO).minus(unpaidAgg._sum.paidAmount ?? ZERO),
  };
}

async function getTodayReceipts(branchId: string | undefined, today: Date) {
  const [pos, wholesale, corporate] = await Promise.all([
    prisma.posSale.aggregate({
      where: {
        saleDate: { gte: today },
        status: { not: 'VOIDED' },
        ...(branchId ? { branchId } : {}),
      },
      _sum: { paidTotal: true },
    }),
    prisma.wholesalePayment.aggregate({
      where: {
        paidAt: { gte: today },
        invoice: branchId ? { branchId } : undefined,
      },
      _sum: { amount: true },
    }),
    prisma.corporateInvoicePayment.aggregate({
      where: {
        paidAt: { gte: today },
        invoice: branchId ? { branchId } : undefined,
      },
      _sum: { amount: true },
    }),
  ]);

  return (pos._sum.paidTotal ?? ZERO)
    .plus(wholesale._sum.amount ?? ZERO)
    .plus(corporate._sum.amount ?? ZERO);
}

async function getTodayPayments(branchId: string | undefined, today: Date) {
  const supplierPayments = await prisma.supplierPayment.aggregate({
    where: {
      paymentDate: { gte: today },
      ...(branchId ? { branchId } : {}),
    },
    _sum: { amount: true },
  });
  return supplierPayments._sum.amount ?? ZERO;
}
