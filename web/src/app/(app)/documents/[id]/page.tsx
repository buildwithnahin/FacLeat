import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Download, ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/shared/data-table';
import { Pill } from '@/components/shared/pill';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { LinkForm, UnlinkButton, DeleteDocumentButton } from './link-controls';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Document' };

function getEntityLinkUrl(entityType: string, entityId: string): string | null {
  switch (entityType) {
    case 'PurchaseOrder':
      return `/purchase/orders/${entityId}`;
    case 'PurchaseInvoice':
      return `/purchase/invoices/${entityId}`;
    case 'PurchaseRequisition':
      return `/purchase/requisitions/${entityId}`;
    case 'GoodsReceiving':
      return `/purchase/grn/${entityId}`;
    case 'DamageReport':
      return `/warehouse/faulty/${entityId}`;
    case 'Supplier':
      return `/suppliers/${entityId}`;
    case 'Customer':
      return `/crm/${entityId}`;
    case 'Employee':
      return `/hr/employees/${entityId}`;
    case 'Candidate':
      return `/hr/candidates/${entityId}`;
    case 'Asset':
      return `/assets/${entityId}`;
    case 'ProductionOrder':
      return `/factory/${entityId}`;
    default:
      return null;
  }
}

interface DocumentLink {
  id: string;
  entityType: string;
  entityId: string;
  note: string | null;
  createdAt: string;
}

interface DocumentDetail {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  category: string | null;
  tags: string[];
  expiresAt: string | null;
  createdAt: string;
  notes: string | null;
  links: DocumentLink[];
}

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let doc: DocumentDetail;
  try {
    doc = await backendFetch<DocumentDetail>(`/api/mobile/documents/${id}`);
  } catch (e) {
    if (e instanceof BackendApiError && e.status === 404) notFound();
    throw e;
  }

  return (
    <div className="space-y-6">
      <PageHeader title={doc.originalName} description={doc.mimeType}>
        <Button variant="outline" asChild>
          <Link href="/documents">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
        <Button variant="dark" asChild>
          <a href={`/api/documents/${doc.id}`} target="_blank" rel="noreferrer">
            <Download className="h-4 w-4" /> Download
          </a>
        </Button>
        {doc.links.length === 0 && <DeleteDocumentButton documentId={doc.id} />}
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        <div className="space-y-6">
          <Card className="p-6 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground text-xs">Size</div>
              <div className="tabular font-medium">{(doc.size / 1024).toFixed(1)} KB</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Category</div>
              <div className="font-medium">{doc.category ?? '—'}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Expires</div>
              <div className="tabular font-medium">
                {doc.expiresAt ? new Date(doc.expiresAt).toISOString().slice(0, 10) : '—'}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Uploaded</div>
              <div className="tabular">{new Date(doc.createdAt).toISOString().slice(0, 10)}</div>
            </div>
            <div className="md:col-span-2">
              <div className="text-muted-foreground text-xs">Tags</div>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {doc.tags.length === 0 ? (
                  '—'
                ) : (
                  doc.tags.map((t) => (
                    <Pill key={t} tone="neutral">
                      {t}
                    </Pill>
                  ))
                )}
              </div>
            </div>
            {doc.notes && (
              <div className="md:col-span-3 pt-3 border-t text-muted-foreground">{doc.notes}</div>
            )}
          </Card>

          {doc.mimeType.startsWith('image/') && (
            <Card className="p-4">
              <div className="text-xs font-medium text-muted-foreground mb-2">Image preview</div>
              {/* eslint-disable-next-line @next/next/no-img-element -- proxied binary route */}
              <img
                src={`/api/documents/${doc.id}`}
                alt={doc.originalName}
                className="max-h-96 mx-auto rounded shadow-sm border"
              />
            </Card>
          )}

          {doc.mimeType === 'application/pdf' && (
            <Card className="p-4">
              <div className="text-xs font-medium text-muted-foreground mb-2">PDF preview</div>
              <iframe
                src={`/api/documents/${doc.id}`}
                title={doc.originalName}
                className="w-full h-[600px] rounded border"
              />
            </Card>
          )}

          <Card className="p-0">
            <div className="px-4 py-3 border-b text-sm font-medium">
              Linked entities ({doc.links.length})
            </div>
            <DataTable
              rows={doc.links}
              rowKey={(r) => r.id}
              empty="Not linked to anything yet. Use the form on the right to link this document to an order, invoice, or employee."
              columns={[
                { key: 'type', header: 'Entity type', cell: (r) => r.entityType },
                {
                  key: 'id',
                  header: 'Entity ID',
                  cell: (r) => {
                    const targetUrl = getEntityLinkUrl(r.entityType, r.entityId);
                    return targetUrl ? (
                      <Link
                        href={targetUrl}
                        target="_blank"
                        className="tabular text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                      >
                        {r.entityId}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      <span className="tabular text-xs">{r.entityId}</span>
                    );
                  },
                },
                { key: 'note', header: 'Note', cell: (r) => r.note ?? '—' },
                {
                  key: 'when',
                  header: 'Linked',
                  cell: (r) => (
                    <span className="tabular text-xs">
                      {new Date(r.createdAt).toISOString().slice(0, 10)}
                    </span>
                  ),
                },
                {
                  key: 'action',
                  header: '',
                  cell: (r) => <UnlinkButton documentId={doc.id} linkId={r.id} />,
                },
              ]}
            />
          </Card>
        </div>

        <LinkForm documentId={doc.id} />
      </div>
    </div>
  );
}
