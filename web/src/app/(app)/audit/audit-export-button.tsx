'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface AuditExportRow {
  id: string;
  createdAt: string;
  actor: { name: string | null; email: string | null } | null;
  module: string;
  action: string;
  entityType: string;
  entityId: string | null;
  branch: { name: string } | null;
}

export function AuditExportButton({ rows }: { rows: AuditExportRow[] }) {
  const handleExport = () => {
    if (!rows.length) return;

    const headers = [
      'Timestamp (UTC)',
      'Actor Name',
      'Actor Email',
      'Module',
      'Action',
      'Entity Type',
      'Entity ID',
      'Branch',
    ];

    const csvLines = rows.map((r) => [
      `"${new Date(r.createdAt).toISOString()}"`,
      `"${(r.actor?.name ?? '').replace(/"/g, '""')}"`,
      `"${(r.actor?.email ?? '').replace(/"/g, '""')}"`,
      `"${(r.module ?? '').replace(/"/g, '""')}"`,
      `"${(r.action ?? '').replace(/"/g, '""')}"`,
      `"${(r.entityType ?? '').replace(/"/g, '""')}"`,
      `"${(r.entityId ?? '').replace(/"/g, '""')}"`,
      `"${(r.branch?.name ?? '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...csvLines.map((line) => line.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `audit-log-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={rows.length === 0}
      className="flex items-center gap-1.5"
    >
      <Download className="h-3.5 w-3.5" />
      <span>Export CSV ({rows.length})</span>
    </Button>
  );
}
