'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface TopProductItem {
  sku: string;
  name: string;
  qty: string | number;
  revenue: string | number;
}

export function TopProductsExportButton({
  products,
  from,
  to,
}: {
  products: TopProductItem[];
  from: string;
  to: string;
}) {
  const handleExport = () => {
    if (!products || products.length === 0) {
      toast.info('No products to export in this date range');
      return;
    }

    const headers = [
      'Rank',
      'SKU',
      'Product Name',
      'Quantity Sold',
      'Sales Revenue (BDT)',
      'Avg Realization Price (BDT)',
    ];

    const rows = products.map((p, idx) => {
      const q = Number(p.qty) || 0;
      const rev = Number(p.revenue) || 0;
      const avg = q > 0 ? (rev / q).toFixed(2) : '0.00';

      return [
        idx + 1,
        `"${p.sku.replace(/"/g, '""')}"`,
        `"${p.name.replace(/"/g, '""')}"`,
        q,
        rev.toFixed(2),
        avg,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `top-products-${from}-to-${to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${products.length} top products to CSV`);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5 shadow-sm text-xs">
      <Download className="h-3.5 w-3.5" /> Export CSV
    </Button>
  );
}
