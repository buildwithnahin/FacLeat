import Link from 'next/link';
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight } from 'lucide-react';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import {
  INVENTORY_SECTION_META,
  INVENTORY_SECTION_SLUGS,
  parseInventorySection,
  type InventorySectionSlug,
} from '@/lib/inventory-sections';
import { StockTable, type StockRow } from './stock-table';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Stock balance' };

type StockBalancePageProps = {
  searchParams: Promise<{ section?: string }>;
};

export default async function StockBalancePage({ searchParams }: StockBalancePageProps) {
  const session = await getSession();
  const sp = await searchParams;
  const section = parseInventorySection(sp.section);
  const branchId = session?.activeBranchId || session?.defaultBranchId || undefined;

  const qs = new URLSearchParams();
  if (section) qs.set('section', section);
  if (branchId) qs.set('branchId', branchId);
  const qsStr = qs.toString();
  const allRows = await backendFetch<StockRow[]>(`/api/mobile/inventory/stock${qsStr ? `?${qsStr}` : ''}`);

  const pageTitle = section
    ? `${INVENTORY_SECTION_META[section].label} Stock Balance`
    : 'All Stock Balance';
  const pageDescription = section
    ? INVENTORY_SECTION_META[section].description
    : 'Live inventory balance across all warehouses and production stages.';

  return (
    <div>
      <PageHeader title={pageTitle} description={pageDescription}>
        <Button variant="outline" asChild>
          <Link href="/warehouse/receive">
            <ArrowDownToLine className="h-4 w-4" />
            Stock In
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/warehouse/issue">
            <ArrowUpFromLine className="h-4 w-4" />
            Stock Out
          </Link>
        </Button>
        <Button asChild>
          <Link href="/warehouse/transfer">
            <ArrowLeftRight className="h-4 w-4" />
            Transfer
          </Link>
        </Button>
      </PageHeader>

      <div className="space-y-6">
        <SectionLinks activeSection={section} page="stock" />
        <StockTable
          title={pageTitle}
          description={pageDescription}
          rows={allRows}
          emptyLabel={`No ${section ? INVENTORY_SECTION_META[section].label.toLowerCase() : 'inventory'} stock balance recorded yet.`}
        />
      </div>
    </div>
  );
}

function SectionLinks({
  activeSection,
  page,
}: {
  activeSection: InventorySectionSlug | null;
  page: 'stock' | 'ledger' | 'products';
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant={!activeSection ? 'default' : 'outline'} asChild>
        <Link href={`/inventory/${page}`}>All Categories</Link>
      </Button>
      {INVENTORY_SECTION_SLUGS.map((slug) => (
        <Button key={slug} variant={activeSection === slug ? 'default' : 'outline'} asChild>
          <Link href={`/inventory/${page}?section=${slug}`}>
            {INVENTORY_SECTION_META[slug].label}
          </Link>
        </Button>
      ))}
    </div>
  );
}
