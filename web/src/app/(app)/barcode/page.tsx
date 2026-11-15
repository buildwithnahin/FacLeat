import Link from 'next/link';
import { Printer, Sparkles, Building2, Store, Search, X, Filter } from 'lucide-react';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { assignBarcodeAction } from '@/server/actions/barcode';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Barcode management' };

interface BarcodeProduct {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  size: string | null;
  unit: string;
  category?: { id: string; name: string } | null;
  sellPrice?: string;
  availableQty?: string;
  company?: { id: string; name: string; code: string } | null;
}

interface BranchDto {
  id: string;
  name: string;
  code: string;
  companyId: string;
}

interface CompanyDto {
  id: string;
  name: string;
  code: string;
}

interface SearchParams {
  search?: string;
  status?: string;
  branchId?: string;
  companyId?: string;
}

export default async function BarcodePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const [session, sp] = await Promise.all([
    getSession(),
    searchParams ? await searchParams : ({} as SearchParams),
  ]);

  // Determine effective company and branch:
  // Query param override > session active value > default value
  const activeCompanyId = sp.companyId || session?.activeCompanyId || session?.defaultCompanyId || undefined;
  const activeBranchId = sp.branchId || session?.activeBranchId || session?.defaultBranchId || undefined;

  // Build query string for backend API
  const qs = new URLSearchParams();
  if (activeCompanyId && activeCompanyId !== 'ALL') qs.set('companyId', activeCompanyId);
  if (activeBranchId && activeBranchId !== 'ALL') qs.set('branchId', activeBranchId);
  if (sp.search && sp.search.trim()) qs.set('search', sp.search.trim());
  if (sp.status && sp.status !== 'ALL') qs.set('status', sp.status);

  const [products, branches, companies] = await Promise.all([
    backendFetch<BarcodeProduct[]>(`/api/mobile/barcode/products?${qs.toString()}`),
    backendFetch<BranchDto[]>('/api/mobile/branches').catch(() => [] as BranchDto[]),
    backendFetch<CompanyDto[]>('/api/mobile/companies').catch(() => [] as CompanyDto[]),
  ]);

  const canGen = session?.permissions.includes('barcode:generate') ?? false;

  const missing = products.filter((p) => !p.barcode);
  const withCodes = products.filter((p) => !!p.barcode);
  const totalStockUnits = products.reduce((acc, p) => acc + (Number(p.availableQty) || 0), 0);

  const selectedCompany = companies.find((c) => c.id === activeCompanyId) ?? null;
  const selectedBranch = branches.find((b) => b.id === activeBranchId) ?? null;

  // Filter branch dropdown based on selected company if applicable
  const availableBranches = activeCompanyId && activeCompanyId !== 'ALL'
    ? branches.filter((b) => b.companyId === activeCompanyId)
    : branches;

  const hasFilter = Boolean(
    sp.search ||
    (sp.status && sp.status !== 'ALL') ||
    (sp.branchId && sp.branchId !== session?.activeBranchId) ||
    (sp.companyId && sp.companyId !== session?.activeCompanyId)
  );

  const printParams = new URLSearchParams();
  if (activeCompanyId && activeCompanyId !== 'ALL') printParams.set('companyId', activeCompanyId);
  if (activeBranchId && activeBranchId !== 'ALL') printParams.set('branchId', activeBranchId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Barcode management"
        description="Assign scanner-friendly codes to products and print label sheets."
      >
        <Button asChild>
          <Link href={`/barcode/print${printParams.toString() ? `?${printParams.toString()}` : ''}`}>
            <Printer className="h-4 w-4" />
            Print labels
          </Link>
        </Button>
      </PageHeader>

      {/* Active Scope Badges */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-muted/60 border text-xs text-muted-foreground font-medium">
          <Building2 className="h-3.5 w-3.5 text-primary" />
          <span>Company:</span>
          <span className="font-semibold text-foreground">
            {selectedCompany ? selectedCompany.name : (activeCompanyId ? 'Active Company' : 'All Companies')}
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-muted/60 border text-xs text-muted-foreground font-medium">
          <Store className="h-3.5 w-3.5 text-primary" />
          <span>Branch:</span>
          <span className="font-semibold text-foreground">
            {selectedBranch ? `${selectedBranch.name} (${selectedBranch.code})` : (activeBranchId ? 'Active Branch' : 'All Branches')}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <form className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-3 items-end">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Search</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                name="search"
                placeholder="Search by SKU, product name, or barcode…"
                defaultValue={sp.search ?? ''}
                className="pl-8"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Company</label>
            <select
              name="companyId"
              defaultValue={activeCompanyId ?? 'ALL'}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="ALL">All Companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Branch</label>
            <select
              name="branchId"
              defaultValue={activeBranchId ?? 'ALL'}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="ALL">All Branches</option>
              {availableBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Barcode Status</label>
            <select
              name="status"
              defaultValue={sp.status ?? 'ALL'}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="ALL">All Statuses</option>
              <option value="BARCODED">Barcoded only</option>
              <option value="MISSING">Missing barcode only</option>
            </select>
          </div>

          <div className="flex gap-2">
            <Button type="submit" variant="outline">
              <Filter className="h-4 w-4" /> Filter
            </Button>
            {hasFilter && (
              <Button type="button" variant="ghost" asChild>
                <Link href="/barcode">
                  <X className="h-4 w-4" /> Clear
                </Link>
              </Button>
            )}
          </div>
        </form>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total products</p>
          <p className="text-2xl font-semibold tabular-nums mt-1">{products.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Barcoded</p>
          <p className="text-2xl font-semibold tabular-nums mt-1 text-emerald-600">
            {withCodes.length}
            <span className="text-xs text-muted-foreground font-normal ml-1">
              ({products.length > 0 ? Math.round((withCodes.length / products.length) * 100) : 0}%)
            </span>
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Missing barcode</p>
          <p className="text-2xl font-semibold tabular-nums mt-1 text-amber-600">
            {missing.length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Branch stock units</p>
          <p className="text-2xl font-semibold tabular-nums mt-1 text-primary">
            {totalStockUnits.toLocaleString()}
          </p>
        </Card>
      </div>

      {/* Products Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left font-semibold px-4 py-3">SKU</th>
                <th className="text-left font-semibold px-4 py-3">Product Name</th>
                <th className="text-left font-semibold px-4 py-3">Category</th>
                <th className="text-right font-semibold px-4 py-3">Branch Stock</th>
                <th className="text-left font-semibold px-4 py-3">Barcode</th>
                <th className="text-right font-semibold px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs font-semibold">{p.sku}</td>
                  <td className="px-4 py-3 font-medium">
                    {p.name}
                    {p.size && (
                      <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                        ({p.size})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {p.category?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={Number(p.availableQty) > 0 ? 'text-emerald-700 font-semibold' : 'text-muted-foreground'}>
                      {Number(p.availableQty ?? 0).toLocaleString()} {p.unit}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {p.barcode ? (
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted/60 border">
                        {p.barcode}
                      </span>
                    ) : (
                      <Badge variant="warning">Missing</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end">
                      {canGen && !p.barcode && (
                        <form action={assignBarcodeAction}>
                          <input type="hidden" name="id" value={p.id} />
                          <Button size="sm" variant="outline" type="submit">
                            <Sparkles className="h-3.5 w-3.5" />
                            Generate
                          </Button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <p className="font-medium">No products found for the selected company / branch.</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Try adjusting the search filter or selecting another branch/company.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
