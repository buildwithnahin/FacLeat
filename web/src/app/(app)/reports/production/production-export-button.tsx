'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ProductionRowItem {
  number: string;
  product: { sku: string; name: string };
  status: string;
  plannedQty: string;
  producedQty: string;
  variance: string;
  yieldPercent: string;
  scrapQty: string;
  scrapCost: string;
}

export function ProductionExportButton({
  orders,
  from,
  to,
}: {
  orders: ProductionRowItem[];
  from: string;
  to: string;
}) {
  const handleExport = () => {
    if (!orders || orders.length === 0) {
      toast.info('No production orders to export in this date range');
      return;
    }

    const headers = [
      'Order #',
      'Product SKU',
      'Product Name',
      'Status',
      'Planned Qty',
      'Produced Qty',
      'Variance',
      'Yield %',
      'Scrap Qty',
      'Scrap Cost (BDT)',
    ];

    const rows = orders.map((o) => [
      `"${o.number.replace(/"/g, '""')}"`,
      `"${o.product?.sku?.replace(/"/g, '""') || ''}"`,
      `"${o.product?.name?.replace(/"/g, '""') || ''}"`,
      `"${o.status}"`,
      Number(o.plannedQty).toFixed(0),
      Number(o.producedQty).toFixed(0),
      Number(o.variance).toFixed(0),
      `${Number(o.yieldPercent).toFixed(1)}%`,
      Number(o.scrapQty).toFixed(0),
      Number(o.scrapCost).toFixed(2),
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `factory-production-${from}-to-${to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${orders.length} production orders to CSV`);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5 shadow-sm text-xs">
      <Download className="h-3.5 w-3.5" /> Export Production CSV
    </Button>
  );
}
