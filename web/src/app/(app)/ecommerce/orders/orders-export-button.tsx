'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface OrderExportData {
  id: string;
  number: string;
  externalId: string;
  orderDate: string;
  channelName: string;
  customerName: string;
  customerPhone: string;
  shipToAddress: string;
  grandTotal: string | number;
  paidTotal: string | number;
  status: string;
  courier?: string | null;
  trackingNo?: string | null;
  itemCount: number;
}

interface OrdersExportButtonProps {
  orders: OrderExportData[];
}

export function OrdersExportButton({ orders }: OrdersExportButtonProps) {
  const handleExport = () => {
    if (!orders || orders.length === 0) {
      toast.info('No orders to export with current filters');
      return;
    }

    const headers = [
      'Order Number',
      'External Order ID',
      'Order Date',
      'Sales Channel',
      'Customer Name',
      'Customer Phone',
      'Shipping Address',
      'Items Count',
      'Grand Total (BDT)',
      'Paid Total (BDT)',
      'Balance / COD (BDT)',
      'Status',
      'Courier',
      'Tracking Number',
    ];

    const rows = orders.map((o) => {
      const gTotal = Number(o.grandTotal) || 0;
      const pTotal = Number(o.paidTotal) || 0;
      const codBalance = Math.max(0, gTotal - pTotal);

      return [
        `"${o.number.replace(/"/g, '""')}"`,
        `"${(o.externalId || '').replace(/"/g, '""')}"`,
        `"${new Date(o.orderDate).toISOString().slice(0, 10)}"`,
        `"${(o.channelName || '').replace(/"/g, '""')}"`,
        `"${(o.customerName || '').replace(/"/g, '""')}"`,
        `"${(o.customerPhone || '').replace(/"/g, '""')}"`,
        `"${(o.shipToAddress || '').replace(/"/g, '""')}"`,
        o.itemCount,
        gTotal.toFixed(2),
        pTotal.toFixed(2),
        codBalance.toFixed(2),
        `"${o.status}"`,
        `"${(o.courier || '').replace(/"/g, '""')}"`,
        `"${(o.trackingNo || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ecommerce-orders-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${orders.length} orders successfully`);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
      <Download className="h-4 w-4" /> Export CSV
    </Button>
  );
}
