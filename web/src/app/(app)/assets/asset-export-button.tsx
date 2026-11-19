'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface AssetExportItem {
  code: string;
  name: string;
  category?: string;
  branch: string;
  location?: string;
  assignedTo?: string;
  purchaseCost: string | number;
  bookValue: string | number;
  status: string;
}

interface AssetExportButtonProps {
  assets: AssetExportItem[];
}

export function AssetExportButton({ assets }: AssetExportButtonProps) {
  const handleExport = () => {
    if (!assets || assets.length === 0) {
      toast.info('No assets to export with current filters');
      return;
    }

    const headers = [
      'Asset Code',
      'Asset Name',
      'Category',
      'Branch',
      'Location',
      'Assigned To',
      'Purchase Cost (BDT)',
      'Net Book Value (BDT)',
      'Accumulated Depreciation (BDT)',
      'Status',
    ];

    const rows = assets.map((a) => {
      const pCost = Number(a.purchaseCost) || 0;
      const bValue = Number(a.bookValue) || 0;
      const accumDep = Math.max(0, pCost - bValue);

      return [
        `"${a.code.replace(/"/g, '""')}"`,
        `"${a.name.replace(/"/g, '""')}"`,
        `"${(a.category || '').replace(/"/g, '""')}"`,
        `"${a.branch.replace(/"/g, '""')}"`,
        `"${(a.location || '').replace(/"/g, '""')}"`,
        `"${(a.assignedTo || '').replace(/"/g, '""')}"`,
        pCost.toFixed(2),
        bValue.toFixed(2),
        accumDep.toFixed(2),
        `"${a.status}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `fixed-asset-register-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${assets.length} fixed assets to CSV`);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5 shadow-sm text-xs">
      <Download className="h-3.5 w-3.5" /> Export Register (CSV)
    </Button>
  );
}
