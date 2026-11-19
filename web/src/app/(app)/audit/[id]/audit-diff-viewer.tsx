'use client';

import { useState } from 'react';
import { Copy, Check, Eye, Code, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface DiffField {
  key: string;
  status: 'added' | 'removed' | 'modified' | 'unchanged';
  beforeVal: unknown;
  afterVal: unknown;
}

function parseVal(val: unknown): Record<string, unknown> | null {
  if (!val) return null;
  if (typeof val === 'object' && val !== null) {
    return val as Record<string, unknown>;
  }
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function formatPrimitive(val: unknown): string {
  if (val === undefined) return '—';
  if (val === null) return 'null';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function computeDiff(beforeObj: Record<string, unknown> | null, afterObj: Record<string, unknown> | null): DiffField[] {
  const b = beforeObj ?? {};
  const a = afterObj ?? {};
  const allKeys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)])).sort();

  return allKeys.map((k) => {
    const hasB = Object.prototype.hasOwnProperty.call(b, k);
    const hasA = Object.prototype.hasOwnProperty.call(a, k);

    if (!hasB && hasA) {
      return { key: k, status: 'added', beforeVal: undefined, afterVal: a[k] };
    }
    if (hasB && !hasA) {
      return { key: k, status: 'removed', beforeVal: b[k], afterVal: undefined };
    }
    const bStr = JSON.stringify(b[k]);
    const aStr = JSON.stringify(a[k]);
    if (bStr !== aStr) {
      return { key: k, status: 'modified', beforeVal: b[k], afterVal: a[k] };
    }
    return { key: k, status: 'unchanged', beforeVal: b[k], afterVal: a[k] };
  });
}

export function AuditDiffViewer({
  before,
  after,
}: {
  before: unknown;
  after: unknown;
}) {
  const [mode, setMode] = useState<'visual' | 'raw'>('visual');
  const [onlyChanged, setOnlyChanged] = useState(true);
  const [copiedBefore, setCopiedBefore] = useState(false);
  const [copiedAfter, setCopiedAfter] = useState(false);

  const beforeObj = parseVal(before);
  const afterObj = parseVal(after);

  const diffFields = computeDiff(beforeObj, afterObj);
  const displayFields = onlyChanged
    ? diffFields.filter((f) => f.status !== 'unchanged')
    : diffFields;

  const copyToClipboard = (text: string, isBefore: boolean) => {
    navigator.clipboard.writeText(text);
    if (isBefore) {
      setCopiedBefore(true);
      setTimeout(() => setCopiedBefore(false), 2000);
    } else {
      setCopiedAfter(true);
      setTimeout(() => setCopiedAfter(false), 2000);
    }
  };

  const beforeJson = before ? JSON.stringify(beforeObj ?? before, null, 2) : 'null';
  const afterJson = after ? JSON.stringify(afterObj ?? after, null, 2) : 'null';

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-muted rounded-lg text-xs">
          <button
            type="button"
            onClick={() => setMode('visual')}
            className={`px-3 py-1 rounded font-medium transition-colors flex items-center gap-1.5 ${
              mode === 'visual' ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Eye className="h-3.5 w-3.5" /> Visual Diff
          </button>
          <button
            type="button"
            onClick={() => setMode('raw')}
            className={`px-3 py-1 rounded font-medium transition-colors flex items-center gap-1.5 ${
              mode === 'raw' ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Code className="h-3.5 w-3.5" /> Raw JSON
          </button>
        </div>

        {mode === 'visual' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlyChanged(!onlyChanged)}
              className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                onlyChanged
                  ? 'bg-blue-50 text-blue-700 border-blue-200 font-medium'
                  : 'bg-white text-muted-foreground border-border'
              }`}
            >
              {onlyChanged ? 'Showing changed fields only' : 'Showing all fields'}
            </button>
          </div>
        )}
      </div>

      {/* Visual Diff View */}
      {mode === 'visual' && (
        <Card className="p-0 overflow-hidden border border-border">
          <div className="bg-muted/40 px-4 py-3 border-b flex items-center justify-between">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Field Comparison ({displayFields.length} {displayFields.length === 1 ? 'field' : 'fields'})
            </h3>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Added</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Modified</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Removed</span>
            </div>
          </div>

          {displayFields.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {diffFields.length === 0 ? 'No payload data recorded for this entry.' : 'No field changes detected between before and after states.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/20 border-b text-muted-foreground">
                    <th className="text-left px-4 py-2 font-medium w-1/4">Field</th>
                    <th className="text-left px-4 py-2 font-medium w-5/12">Previous Value</th>
                    <th className="w-8"></th>
                    <th className="text-left px-4 py-2 font-medium w-5/12">Updated Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {displayFields.map((f) => (
                    <tr
                      key={f.key}
                      className={
                        f.status === 'added'
                          ? 'bg-emerald-50/50 hover:bg-emerald-50'
                          : f.status === 'removed'
                          ? 'bg-red-50/50 hover:bg-red-50'
                          : f.status === 'modified'
                          ? 'bg-amber-50/40 hover:bg-amber-50/70'
                          : 'hover:bg-muted/20'
                      }
                    >
                      <td className="px-4 py-2.5 font-mono font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              f.status === 'added'
                                ? 'bg-emerald-500'
                                : f.status === 'removed'
                                ? 'bg-red-500'
                                : f.status === 'modified'
                                ? 'bg-amber-500'
                                : 'bg-gray-300'
                            }`}
                          />
                          <span>{f.key}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-muted-foreground break-all">
                        {f.status === 'added' ? (
                          <span className="italic text-gray-400">None</span>
                        ) : (
                          <span className={f.status === 'removed' ? 'text-red-700 bg-red-100 px-1 py-0.5 rounded' : f.status === 'modified' ? 'text-amber-800' : ''}>
                            {formatPrimitive(f.beforeVal)}
                          </span>
                        )}
                      </td>
                      <td className="text-center text-muted-foreground px-1">
                        <ArrowRight className="h-3 w-3 opacity-40 inline" />
                      </td>
                      <td className="px-4 py-2.5 font-mono break-all font-medium">
                        {f.status === 'removed' ? (
                          <span className="italic text-gray-400">Deleted</span>
                        ) : (
                          <span className={f.status === 'added' ? 'text-emerald-700 bg-emerald-100 px-1 py-0.5 rounded' : f.status === 'modified' ? 'text-emerald-800' : 'text-foreground'}>
                            {formatPrimitive(f.afterVal)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Raw JSON View */}
      {mode === 'raw' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4 border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground">BEFORE PAYLOAD</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(beforeJson, true)}
                className="h-7 text-xs flex items-center gap-1"
              >
                {copiedBefore ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                {copiedBefore ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <pre className="text-xs bg-muted/40 rounded p-3 overflow-x-auto whitespace-pre-wrap font-mono max-h-96">
              {beforeJson}
            </pre>
          </Card>
          <Card className="p-4 border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground">AFTER PAYLOAD</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(afterJson, false)}
                className="h-7 text-xs flex items-center gap-1"
              >
                {copiedAfter ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                {copiedAfter ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <pre className="text-xs bg-muted/40 rounded p-3 overflow-x-auto whitespace-pre-wrap font-mono max-h-96">
              {afterJson}
            </pre>
          </Card>
        </div>
      )}
    </div>
  );
}
