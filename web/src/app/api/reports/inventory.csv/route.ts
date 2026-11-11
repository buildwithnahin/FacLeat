import { NextRequest } from 'next/server';
import { backendFetch } from '@/lib/backend-client';
import { csvResponse, toCsv } from '@/lib/csv';
import { parseInventorySection } from '@/lib/inventory-sections';

interface InventoryRow {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  type: string;
  qty: string;
  cost: string;
  value: string;
  reorderLevel: string;
  belowReorder: boolean;
}

interface InventoryValuationDto {
  rows: InventoryRow[];
}

export async function GET(req: NextRequest) {
  const branchId = req.nextUrl.searchParams.get('branchId') ?? undefined;
  const qs = new URLSearchParams(branchId ? { branchId } : {});
  const data = await backendFetch<InventoryValuationDto>(`/api/mobile/reports/general/inventory-valuation?${qs.toString()}`);

  const activeSection = parseInventorySection(req.nextUrl.searchParams.get('section'));
  const filteredRows = activeSection
    ? data.rows.filter((r) => {
        if (activeSection === 'raw-material') return r.type === 'RAW_MATERIAL';
        if (activeSection === 'work-in-progress') return r.type === 'WORK_IN_PROGRESS';
        if (activeSection === 'finished-goods') return r.type === 'FINISHED_GOOD';
        return r.type === 'CONSUMABLE' || r.type === 'SERVICE';
      })
    : data.rows;

  const headers = ['SKU', 'Name', 'Type', 'Unit', 'Qty', 'Reorder', 'Cost', 'Value', 'Below reorder'];
  const rows = filteredRows.map((r) => [
    r.sku,
    r.name,
    r.type,
    r.unit,
    r.qty,
    r.reorderLevel,
    r.cost,
    r.value,
    r.belowReorder ? 'Y' : '',
  ]);

  return csvResponse(`inventory-valuation${branchId ? `-${branchId}` : ''}.csv`, toCsv(headers, rows));
}
