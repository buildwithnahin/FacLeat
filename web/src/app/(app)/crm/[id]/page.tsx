import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Edit, ArrowLeft, Phone, Mail, MapPin, BookOpen } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/shared/pill';
import { KpiCard } from '@/components/shared/kpi-card';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { formatCurrency, d } from '@/lib/money';
import type { CurrencyCode } from '@/lib/money';
import { InteractionPanel } from './interaction-panel';

export const dynamic = 'force-dynamic';

interface Interaction {
  id: string;
  type: string;
  subject: string;
  body: string | null;
  followUpAt: string | null;
  createdAt: string;
}

interface CustomerDetail {
  id: string;
  code: string;
  name: string;
  type: string;
  status: string;
  currency: string;
  creditLimit: string;
  creditDays: number;
  branch: { name: string };
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  taxId: string | null;
  category: { name: string } | null;
  loyaltyPoints: number;
  notes: string | null;
  interactions: Interaction[];
}

interface CustomerDetailResponse {
  customer: CustomerDetail;
  totalSales: string | null;
  totalDue: string | null;
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let data: CustomerDetailResponse;
  try {
    data = await backendFetch<CustomerDetailResponse>(`/api/mobile/crm/${id}`);
  } catch (e) {
    if (e instanceof BackendApiError && e.status === 404) notFound();
    throw e;
  }
  const { customer, totalSales, totalDue } = data;
  const currency = customer.currency as CurrencyCode;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/crm">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>
      <PageHeader
        title={customer.name}
        description={`${customer.code} · ${customer.branch.name} · ${customer.type.toLowerCase()}`}
      >
        <Button variant="outline" asChild>
          <Link href={`/crm/${customer.id}/ledger`}>
            <BookOpen className="h-4 w-4" />
            Ledger
          </Link>
        </Button>
        <Button variant="dark" asChild>
          <Link href={`/crm/${customer.id}/edit`}>
            <Edit className="h-4 w-4" />
            Edit
          </Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Status"
          value={
            <Pill
              tone={
                customer.status === 'ACTIVE'
                  ? 'black'
                  : customer.status === 'BLOCKED'
                    ? 'red'
                    : 'grey'
              }
            >
              {customer.status.toLowerCase()}
            </Pill>
          }
          description={customer.type.toLowerCase()}
        />
        <KpiCard
          label="Total Sales"
          value={formatCurrency(totalSales ?? 0, currency)}
          description="Lifetime debit"
        />
        <KpiCard
          label="Outstanding Due"
          value={formatCurrency(totalDue ?? 0, currency)}
          tone={totalDue && d(totalDue).gt(0) ? 'danger' : 'success'}
          description="Unpaid balance"
        />
        <KpiCard
          label="Credit Limit"
          value={formatCurrency(customer.creditLimit, currency)}
          description={`${customer.creditDays} day${customer.creditDays === 1 ? '' : 's'}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardContent className="p-6 space-y-4 text-sm">
            <p className="text-sm font-semibold">Contact information</p>
            {customer.contactPerson && (
              <div>
                <p className="text-xs text-muted-foreground">Contact person</p>
                <p>{customer.contactPerson}</p>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>{customer.phone}</span>
              </div>
            )}
            {customer.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>{customer.email}</span>
              </div>
            )}
            {(customer.address || customer.city || customer.country) && (
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5" />
                <span>
                  {[customer.address, customer.city, customer.country]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </div>
            )}
            {customer.taxId && (
              <div>
                <p className="text-xs text-muted-foreground">Tax / VAT ID</p>
                <p className="tabular">{customer.taxId}</p>
              </div>
            )}
            {customer.category && (
              <div>
                <p className="text-xs text-muted-foreground">Category</p>
                <p>{customer.category.name}</p>
              </div>
            )}
            {customer.loyaltyPoints > 0 && (
              <div>
                <p className="text-xs text-muted-foreground">Loyalty points</p>
                <p className="tabular">{customer.loyaltyPoints}</p>
              </div>
            )}
            {customer.notes && (
              <div>
                <p className="text-xs text-muted-foreground">Notes</p>
                <p className="text-sm">{customer.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <InteractionPanel
            customerId={customer.id}
            interactions={customer.interactions.map((i) => ({
              id: i.id,
              type: i.type,
              subject: i.subject,
              body: i.body,
              followUpAt: i.followUpAt,
              createdAt: i.createdAt,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
