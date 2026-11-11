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
import { LedgerTable, type MovementRow } from './ledger-table';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Inventory ledger' };

type LedgerPageProps = {
  searchParams: Promise<{ section?: string }>;
};

export default async function LedgerPage({ searchParams }: LedgerPageProps) {
  const session = await getSession();
  const sp = await searchParams;
  const section = parseInventorySection(sp.section);
  const branchId = session?.activeBranchId || session?.defaultBranchId || undefined;

  const qs = new URLSearchParams({ limit: '500' });
  if (section) qs.set('section', section);
  if (branchId) qs.set('branchId', branchId);
  const rows = await backendFetch<MovementRow[]>(`/api/mobile/inventory/movements?${qs.toString()}`);

  const pageTitle = section
    ? `${INVENTORY_SECTION_META[section].label} Ledger`
    : 'All Stock Movements Ledger';
  const pageDescription = section
    ? `Every ${INVENTORY_SECTION_META[section].label.toLowerCase()} stock movement in the inventory ledger.`
    : 'Comprehensive real-time audit trail of all stock in, stock out, transfers, and adjustments.';

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
        <SectionLinks activeSection={section} />
        <LedgerTable
          rows={rows}
          emptyLabel={`No ${section ? INVENTORY_SECTION_META[section].label.toLowerCase() : 'inventory'} movements found.`}
        />
      </div>
    </div>
  );
}

function SectionLinks({ activeSection }: { activeSection: InventorySectionSlug | null }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant={!activeSection ? 'default' : 'outline'} asChild>
        <Link href="/inventory/ledger">All Categories</Link>
      </Button>
      {INVENTORY_SECTION_SLUGS.map((slug) => (
        <Button key={slug} variant={activeSection === slug ? 'default' : 'outline'} asChild>
          <Link href={`/inventory/ledger?section=${slug}`}>
            {INVENTORY_SECTION_META[slug].label}
          </Link>
        </Button>
      ))}
    </div>
  );
}
