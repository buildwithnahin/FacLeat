import { NextRequest } from 'next/server';
import { getSession } from '@/server/auth/session';
import { reportsService } from '@/server/services/reports.service';
import { csvResponse, toCsv } from '@/lib/csv';
import { parseInventorySection } from '@/lib/inventory-sections';

export async function GET(req: NextRequest) {
  const session = await getSession();
  const branchId = req.nextUrl.searchParams.get('branchId') ?? undefined;
  const data = await reportsService.inventoryValuation(session, { branchId });

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
    r.qty.toString(),
    r.reorderLevel.toString(),
    r.cost.toString(),
    r.value.toString(),
    r.belowReorder ? 'Y' : '',
  ]);

  return csvResponse(`inventory-valuation${branchId ? `-${branchId}` : ''}.csv`, toCsv(headers, rows));
}
