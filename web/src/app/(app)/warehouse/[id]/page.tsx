import { notFound } from 'next/navigation';
import { getSession } from '@/server/auth/session';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { WarehouseDashboard, type WarehouseStockData } from './warehouse-dashboard';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: 'Warehouse / Showroom Dashboard' };
}

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

export default async function WarehouseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  let stockData: WarehouseStockData;
  let branches: BranchOption[];

  try {
    const [data, branchesData] = await Promise.all([
      backendFetch<WarehouseStockData>(`/api/mobile/warehouse/warehouses/${id}/stock`),
      backendFetch<BranchOption[]>('/api/mobile/branches?activeOnly=true'),
    ]);
    stockData = data;
    branches = branchesData;
  } catch (err) {
    if (err instanceof BackendApiError && err.status === 404) notFound();
    throw err;
  }

  const canWrite = session?.permissions.includes('inventory:write') ?? false;

  return (
    <WarehouseDashboard
      data={stockData}
      branches={branches}
      canWrite={canWrite}
    />
  );
}
