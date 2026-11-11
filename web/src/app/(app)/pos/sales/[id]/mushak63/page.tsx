import { notFound } from 'next/navigation';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { computeMushak63, VAT_MODE_LABELS, type VatMode } from '@/lib/mushak63';
import { PrintButton } from '@/components/shared/print-button';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Mushak 6.3 Tax Invoice' };

const COPIES = [
  { id: 'customer', label: 'Customer Copy', bn: 'ক্রেতার কপি', bg: '#fff' },
  { id: 'government', label: 'Government / NBR Copy', bn: 'সরকার / এনবিআর কপি', bg: '#fffdf0' },
  { id: 'owner', label: 'Owner / Accounts Copy', bn: 'মালিক / হিসাব কপি', bg: '#f0f8ff' },
] as const;

function fmt(n: number): string {
  return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

interface InvoiceData {
  saleNumber: string;
  invoiceDate: string;
  invoiceTime: string;
  customerLabel: string;
  branchName: string;
  branchAddress?: string | null;
  branchPhone?: string | null;
  branchEmail?: string | null;
  branchVatNumber?: string | null;
  mode: VatMode;
  result: ReturnType<typeof computeMushak63>;
}

interface MushakSaleItem {
  product: { sku: string; name: string; unit: string };
  quantity: string;
  unitPrice: string;
  discountRate: string;
  taxRate: string;
}

interface MushakSale {
  number: string;
  saleDate: string;
  customer: { code: string; name: string } | null;
  items: MushakSaleItem[];
}

interface MushakBranch {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  vatNumber: string | null;
}

function InvoiceCopy({
  data,
  copyLabel,
  copyBn,
  copyBg,
  isLast,
}: {
  data: InvoiceData;
  copyLabel: string;
  copyBn: string;
  copyBg: string;
  isLast: boolean;
}) {
  const { result, mode } = data;
  const modeInfo = VAT_MODE_LABELS[mode];

  return (
    <div
      className="mushak-copy"
      style={{
        width: '210mm',
        minHeight: '297mm',
        padding: '12mm 15mm',
        backgroundColor: copyBg,
        fontFamily: 'Arial, sans-serif',
        fontSize: '10pt',
        color: '#000',
        pageBreakAfter: isLast ? 'auto' : 'always',
        breakAfter: isLast ? 'auto' : 'page',
        position: 'relative',
      }}
    >
      {/* Copy label banner */}
      <div
        style={{
          border: '2px solid #333',
          borderRadius: '3px',
          padding: '3px 8px',
          textAlign: 'center',
          fontWeight: 'bold',
          fontSize: '9pt',
          marginBottom: '10px',
          background: '#333',
          color: '#fff',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        {copyLabel} &nbsp;|&nbsp; {copyBn}
      </div>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '10px' }}>
        <div style={{ fontSize: '14pt', fontWeight: 'bold', textTransform: 'uppercase' }}>
          {data.branchName}
        </div>
        {data.branchAddress && (
          <div style={{ fontSize: '9pt' }}>{data.branchAddress}</div>
        )}
        {(data.branchPhone || data.branchEmail) && (
          <div style={{ fontSize: '9pt' }}>
            {data.branchPhone && <>Tel: {data.branchPhone}</>}
            {data.branchPhone && data.branchEmail && ' | '}
            {data.branchEmail && <>Email: {data.branchEmail}</>}
          </div>
        )}
        <div style={{ fontSize: '9pt' }}>
          BIN: {data.branchVatNumber ?? '___________________'}
        </div>
      </div>

      {/* Title */}
      <div
        style={{
          borderTop: '2px solid black',
          borderBottom: '2px solid black',
          padding: '4px 0',
          textAlign: 'center',
          marginBottom: '10px',
        }}
      >
        <div style={{ fontSize: '12pt', fontWeight: 'bold' }}>মূসক-৬.৩ / MUSHAK 6.3</div>
        <div style={{ fontSize: '10pt' }}>কর চালানপত্র / Tax Invoice</div>
      </div>

      {/* Invoice meta */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '10px',
          fontSize: '9pt',
        }}
      >
        <div style={{ lineHeight: '1.6' }}>
          <div>
            <strong>Buyer:</strong> {data.customerLabel}
          </div>
          <div>
            <strong>VAT Method:</strong> Option {mode} — {modeInfo.title}
          </div>
          <div>
            <strong>Formula:</strong> {modeInfo.formula}
          </div>
        </div>
        <div style={{ textAlign: 'right', lineHeight: '1.6' }}>
          <div>
            <strong>Invoice No:</strong> {data.saleNumber}
          </div>
          <div>
            <strong>Date:</strong> {data.invoiceDate}
          </div>
          <div>
            <strong>Time:</strong> {data.invoiceTime}
          </div>
        </div>
      </div>

      {/* Line items */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5pt', marginBottom: '8px' }}>
        <thead>
          <tr style={{ background: '#e8e8e8' }}>
            <th style={thS}>S/N</th>
            <th style={{ ...thS, textAlign: 'left' }}>Description / SKU</th>
            <th style={{ ...thS, textAlign: 'right' }}>Qty</th>
            <th style={{ ...thS, textAlign: 'right' }}>Unit</th>
            <th style={{ ...thS, textAlign: 'right' }}>Gross Value</th>
            <th style={{ ...thS, textAlign: 'right' }}>Discount</th>
            <th style={{ ...thS, textAlign: 'right' }}>Taxable Base</th>
            <th style={{ ...thS, textAlign: 'right' }}>VAT %</th>
            <th style={{ ...thS, textAlign: 'right' }}>VAT Amount</th>
            <th style={{ ...thS, textAlign: 'right', fontWeight: 'bold' }}>Line Total</th>
          </tr>
        </thead>
        <tbody>
          {result.lines.map((line, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
              <td style={tdS}>{idx + 1}</td>
              <td style={tdS}>
                <div>{line.description}</div>
                <div style={{ fontSize: '7.5pt', color: '#666' }}>{line.sku}</div>
              </td>
              <td style={{ ...tdS, textAlign: 'right' }}>{line.quantity}</td>
              <td style={{ ...tdS, textAlign: 'right' }}>{line.unit}</td>
              <td style={{ ...tdS, textAlign: 'right' }}>{fmt(line.grossValue)}</td>
              <td style={{ ...tdS, textAlign: 'right' }}>
                {line.discount > 0 ? fmt(line.discount) : '—'}
              </td>
              <td style={{ ...tdS, textAlign: 'right' }}>{fmt(line.baseValue)}</td>
              <td style={{ ...tdS, textAlign: 'right' }}>{line.vatRate}%</td>
              <td style={{ ...tdS, textAlign: 'right' }}>{fmt(line.vatAmount)}</td>
              <td style={{ ...tdS, textAlign: 'right', fontWeight: 'bold' }}>
                {fmt(line.lineTotal)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '2px solid black', fontWeight: 'bold', background: '#f5f5f5' }}>
            <td colSpan={6} style={{ ...tdS, textAlign: 'right' }}>
              Total
            </td>
            <td style={{ ...tdS, textAlign: 'right' }}>{fmt(result.subtotalBase)}</td>
            <td style={tdS} />
            <td style={{ ...tdS, textAlign: 'right' }}>{fmt(result.totalVat)}</td>
            <td style={{ ...tdS, textAlign: 'right' }}>{fmt(result.grandTotal)}</td>
          </tr>
        </tfoot>
      </table>

      {/* Grand total in words */}
      <div
        style={{
          border: '1px solid #bbb',
          padding: '4px 8px',
          marginBottom: '14px',
          fontSize: '9pt',
        }}
      >
        <strong>Grand Total (in words):</strong> Taka {amountInWords(result.grandTotal)} only
      </div>

      {/* Summary box */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: '14px',
        }}
      >
        <table style={{ fontSize: '9pt', borderCollapse: 'collapse', minWidth: '220px' }}>
          <tbody>
            <tr>
              <td style={{ padding: '2px 8px', color: '#555' }}>Taxable Base:</td>
              <td style={{ padding: '2px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                {fmt(result.subtotalBase)}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '2px 8px', color: '#555' }}>Total VAT ({mode === 'C' ? '0%' : 'see above'}):</td>
              <td style={{ padding: '2px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                {fmt(result.totalVat)}
              </td>
            </tr>
            <tr style={{ borderTop: '2px solid #333', fontWeight: 'bold' }}>
              <td style={{ padding: '3px 8px' }}>Grand Total:</td>
              <td style={{ padding: '3px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                {fmt(result.grandTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Signatures */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '32px',
          fontSize: '9pt',
        }}
      >
        <div style={{ textAlign: 'center', width: '160px' }}>
          <div style={{ borderTop: '1px solid black', paddingTop: '4px' }}>
            Receiver&apos;s Signature
          </div>
        </div>
        <div style={{ textAlign: 'center', width: '160px' }}>
          <div style={{ borderTop: '1px solid black', paddingTop: '4px' }}>
            Authorised Signatory
          </div>
          <div style={{ fontSize: '8pt', color: '#666' }}>{data.branchName}</div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: '20px',
          fontSize: '7.5pt',
          color: '#888',
          textAlign: 'center',
          borderTop: '1px solid #eee',
          paddingTop: '6px',
        }}
      >
        Computer-generated tax invoice under NBR Mushak 6.3 format · VAT Mode: Option {mode} ·{' '}
        {copyLabel}
      </div>
    </div>
  );
}

export default async function Mushak63Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { id } = await params;
  const { mode: rawMode } = await searchParams;

  const mode: VatMode =
    rawMode === 'A' || rawMode === 'B' || rawMode === 'C' ? rawMode : 'A';

  let sale: MushakSale;
  let branch: MushakBranch | null;
  try {
    const data = await backendFetch<{ sale: MushakSale; branch: MushakBranch | null }>(
      `/api/mobile/pos/sales/${id}/mushak63`,
    );
    sale = data.sale;
    branch = data.branch;
  } catch (e) {
    if (e instanceof BackendApiError && e.status === 404) notFound();
    throw e;
  }

  const result = computeMushak63(
    sale.items.map((i) => ({
      sku: i.product.sku,
      description: i.product.name,
      quantity: Number(i.quantity),
      unit: i.product.unit,
      unitPrice: Number(i.unitPrice),
      discountRate: Number(i.discountRate),
      taxRate: Number(i.taxRate),
    })),
    mode,
  );

  const saleDate = new Date(sale.saleDate);
  const data: InvoiceData = {
    saleNumber: sale.number,
    invoiceDate: saleDate.toLocaleDateString('en-BD', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    invoiceTime: saleDate.toLocaleTimeString('en-BD', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    customerLabel: sale.customer
      ? `${sale.customer.code} — ${sale.customer.name}`
      : 'Walk-in Customer',
    branchName: branch?.name ?? 'Company Name',
    branchAddress: branch?.address,
    branchPhone: branch?.phone,
    branchEmail: branch?.email,
    branchVatNumber: branch?.vatNumber,
    mode,
    result,
  };

  const modeInfo = VAT_MODE_LABELS[mode];

  return (
    <>
      {/* Screen controls — hidden on print */}
      <div className="no-print flex flex-wrap items-center gap-3 px-4 py-3 bg-white border-b sticky top-0 z-10">
        <div className="text-sm text-muted-foreground">
          Mode: <strong>{mode}</strong> — {modeInfo.title}
        </div>
        <div className="text-xs text-muted-foreground">{modeInfo.formula}</div>
        <div className="flex gap-1">
          {(['A', 'B', 'C'] as VatMode[]).map((m) => (
            <a
              key={m}
              href={`/pos/sales/${id}/mushak63?mode=${m}`}
              className={`px-3 py-1 rounded border text-sm transition ${
                m === mode
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-300 hover:border-blue-400'
              }`}
            >
              Option {m}
            </a>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span className="hidden sm:inline">
            3 copies will print: Customer · Government/NBR · Owner
          </span>
          <PrintButton
            label="Print 3 Copies"
            className="px-4 py-1.5 bg-gray-800 text-white text-sm rounded border border-gray-800 hover:bg-gray-700"
          />
        </div>
      </div>

      {/* Summary totals on screen */}
      <div className="no-print flex items-center gap-6 px-4 py-2 bg-blue-50 border-b text-sm">
        <span className="text-muted-foreground">
          Taxable base: <strong className="text-foreground tabular">{fmt(result.subtotalBase)}</strong>
        </span>
        <span className="text-muted-foreground">
          VAT: <strong className="text-foreground tabular">{fmt(result.totalVat)}</strong>
        </span>
        <span className="text-muted-foreground">
          Grand total: <strong className="text-blue-700 tabular text-base">{fmt(result.grandTotal)}</strong>
        </span>
        <span className="text-muted-foreground">
          Method: <strong className="text-foreground">{modeInfo.totalsLabel}</strong>
        </span>
      </div>

      {/* 3 Invoice copies */}
      <div className="bg-gray-200 py-6 space-y-6 flex flex-col items-center print:bg-white print:p-0 print:space-y-0">
        {COPIES.map((copy, idx) => (
          <InvoiceCopy
            key={copy.id}
            data={data}
            copyLabel={copy.label}
            copyBn={copy.bn}
            copyBg={copy.bg}
            isLast={idx === COPIES.length - 1}
          />
        ))}
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; margin: 0; padding: 0; }
          .mushak-copy {
            margin: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
        }
        @media screen {
          .mushak-copy {
            box-shadow: 0 2px 12px rgba(0,0,0,0.12);
            border-radius: 4px;
          }
        }
      `}</style>
    </>
  );
}

const thS: React.CSSProperties = {
  border: '1px solid #999',
  padding: '4px 5px',
  fontWeight: 'bold',
  textAlign: 'center',
  whiteSpace: 'nowrap',
};

const tdS: React.CSSProperties = {
  border: '1px solid #ccc',
  padding: '3px 5px',
  verticalAlign: 'top',
};

function amountInWords(amount: number): string {
  const n = Math.floor(amount);
  if (n === 0) return 'Zero';
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function below100(num: number): string {
    if (num < 20) return ones[num] ?? '';
    return (tens[Math.floor(num / 10)] ?? '') + (num % 10 !== 0 ? ' ' + (ones[num % 10] ?? '') : '');
  }
  function below1000(num: number): string {
    if (num < 100) return below100(num);
    return (
      (ones[Math.floor(num / 100)] ?? '') +
      ' Hundred' +
      (num % 100 !== 0 ? ' ' + below100(num % 100) : '')
    );
  }

  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;

  const parts: string[] = [];
  if (crore > 0) parts.push(below1000(crore) + ' Crore');
  if (lakh > 0) parts.push(below1000(lakh) + ' Lakh');
  if (thousand > 0) parts.push(below1000(thousand) + ' Thousand');
  if (rest > 0) parts.push(below1000(rest));

  return parts.join(' ');
}
