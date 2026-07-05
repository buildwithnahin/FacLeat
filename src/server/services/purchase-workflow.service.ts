import { prisma } from '@/server/db';
import { AppSession, authorize } from '@/server/auth/session';
import { PurchaseInvoiceStatus, PurchaseInvoiceMatch, SupplierLedgerEntryType, DebitNoteStatus } from '@/generated/prisma';
import { ApiError } from '@/lib/errors';

export const purchaseWorkflowService = {
  /**
   * 1. Purchase Invoice Workflow & 2. Three-Way Matching
   * Create an invoice and match it against PO and GRN.
   */
  async createAndMatchInvoice(session: AppSession, data: any) {
    authorize(session, 'purchase:invoice-create');

    return await prisma.$transaction(async (tx) => {
      // Fetch PO and GRN
      const po = await tx.purchaseOrder.findUnique({
        where: { id: data.purchaseOrderId },
        include: { items: true }
      });
      const grn = await tx.goodsReceiving.findUnique({
        where: { id: data.grnId },
        include: { items: true }
      });

      if (!po || !grn) throw new ApiError('PO or GRN not found', 404);

      let matchingStatus = PurchaseInvoiceMatch.MATCHED;
      let invoiceStatus = PurchaseInvoiceStatus.SUBMITTED;

      // 3-Way Match Verification
      for (const item of data.items) {
        const poItem = po.items.find(i => i.productId === item.productId);
        const grnItem = grn.items.find(i => i.productId === item.productId);

        if (!poItem || !grnItem) {
          matchingStatus = PurchaseInvoiceMatch.MISMATCH;
          break;
        }

        // Matching Rules
        // 1. Invoice Qty cannot exceed GRN Qty
        if (Number(item.invoiceQty) > Number(grnItem.receivedQty)) {
          matchingStatus = PurchaseInvoiceMatch.MISMATCH;
        }
        // 2. Invoice Rate should closely match PO Rate
        if (Math.abs(Number(item.unitPrice) - Number(poItem.unitCost)) > 0.1) {
          matchingStatus = PurchaseInvoiceMatch.MISMATCH;
        }
      }

      if (matchingStatus === PurchaseInvoiceMatch.MISMATCH) {
        invoiceStatus = PurchaseInvoiceStatus.ON_HOLD;
      }

      // Create Invoice
      const invoice = await tx.purchaseInvoice.create({
        data: {
          number: data.number || `INV-${Date.now()}`,
          branchId: session.activeBranchId!,
          supplierId: data.supplierId,
          purchaseOrderId: data.purchaseOrderId,
          grnId: data.grnId,
          status: invoiceStatus,
          matching: matchingStatus,
          dueDate: new Date(data.dueDate),
          subtotal: data.subtotal,
          taxTotal: data.taxTotal,
          discountTotal: data.discountTotal,
          grandTotal: data.grandTotal,
          notes: matchingStatus === PurchaseInvoiceMatch.MISMATCH ? "System Hold: Mismatch found in Qty or Price." : undefined,
          createdById: session.userId,
          items: {
            create: data.items.map((i: any) => ({
              productId: i.productId,
              quantity: i.invoiceQty,
              unitPrice: i.unitPrice,
              total: Number(i.invoiceQty) * Number(i.unitPrice)
            }))
          }
        }
      });

      return invoice;
    });
  },

  /**
   * 3. Supplier Ledger Workflow - Post Approved Invoice to Accounts Payable
   */
  async postInvoiceToLedger(session: AppSession, invoiceId: string) {
    authorize(session, 'accounts:payable-create');

    return await prisma.$transaction(async (tx) => {
      const invoice = await tx.purchaseInvoice.findUnique({ where: { id: invoiceId } });
      if (!invoice || invoice.status !== PurchaseInvoiceStatus.APPROVED) {
        throw new ApiError('Invoice must be approved before posting', 400);
      }

      // Debit Inventory (Already handled by GRN usually, but we register payable here)
      // Credit Supplier Payable
      await tx.supplierLedger.create({
        data: {
          branchId: session.activeBranchId!,
          supplierId: invoice.supplierId,
          entryType: SupplierLedgerEntryType.PURCHASE,
          refType: 'PURCHASE_INVOICE',
          refId: invoice.id,
          description: `Invoice Posting ${invoice.number}`,
          debit: invoice.grandTotal, // In accounts payable, Purchases increase the liability
          credit: 0,
          createdById: session.userId
        }
      });

      return await tx.purchaseInvoice.update({
        where: { id: invoiceId },
        data: { status: PurchaseInvoiceStatus.POSTED }
      });
    });
  },

  /**
   * 4. Supplier Payment Workflow
   */
  async processPayment(session: AppSession, data: any) {
    authorize(session, 'accounts:payment-create');

    return await prisma.$transaction(async (tx) => {
      const payment = await tx.supplierPayment.create({
        data: {
          voucherNo: `PAY-${Date.now()}`,
          branchId: session.activeBranchId!,
          supplierId: data.supplierId,
          amount: data.paidAmount,
          method: data.method,
          reference: data.reference,
          note: data.note,
          createdById: session.userId,
          invoiceId: data.invoiceId // Connect if paying specific invoice
        }
      });

      // Update Ledger (Reduces Liability)
      await tx.supplierLedger.create({
        data: {
          branchId: session.activeBranchId!,
          supplierId: data.supplierId,
          entryType: SupplierLedgerEntryType.PAYMENT,
          refType: 'PAYMENT_VOUCHER',
          refId: payment.id,
          description: `Payment ${payment.voucherNo}`,
          debit: 0,
          credit: data.paidAmount, // Credit reduces the liability
          createdById: session.userId
        }
      });

      if (data.invoiceId) {
        const invoice = await tx.purchaseInvoice.findUnique({ where: { id: data.invoiceId } });
        if (invoice) {
          const newPaid = Number(invoice.paidAmount) + Number(data.paidAmount);
          const isFullyPaid = newPaid >= Number(invoice.grandTotal);
          
          await tx.purchaseInvoice.update({
            where: { id: data.invoiceId },
            data: {
              paidAmount: newPaid,
              status: isFullyPaid ? PurchaseInvoiceStatus.PAID : PurchaseInvoiceStatus.PARTIALLY_PAID
            }
          });
        }
      }

      return payment;
    });
  },

  /**
   * 6. Debit Note / Purchase Return Workflow
   */
  async createDebitNote(session: AppSession, data: any) {
    authorize(session, 'purchase:return');

    return await prisma.$transaction(async (tx) => {
      const debitNote = await tx.debitNote.create({
        data: {
          number: `DN-${Date.now()}`,
          branchId: session.activeBranchId!,
          supplierId: data.supplierId,
          invoiceId: data.invoiceId,
          grnId: data.grnId,
          status: DebitNoteStatus.POSTED, // Auto-posting for this example
          totalAmount: data.totalAmount,
          reason: data.reason,
          createdById: session.userId,
          items: {
            create: data.items.map((i: any) => ({
              productId: i.productId,
              returnedQty: i.returnedQty,
              unitPrice: i.unitPrice,
              total: Number(i.returnedQty) * Number(i.unitPrice),
              reason: i.reason
            }))
          }
        },
        include: { items: true }
      });

      // Adjust Ledger (Reduces Liability because we returned goods)
      await tx.supplierLedger.create({
        data: {
          branchId: session.activeBranchId!,
          supplierId: data.supplierId,
          entryType: SupplierLedgerEntryType.ADJUSTMENT,
          refType: 'DEBIT_NOTE',
          refId: debitNote.id,
          description: `Purchase Return ${debitNote.number}`,
          debit: 0,
          credit: debitNote.totalAmount, // Credit to reduce liability
          createdById: session.userId
        }
      });

      // Reduce Inventory
      for (const item of debitNote.items) {
        // Find warehouse from GRN or pass directly
        const grnItem = await tx.goodsReceivingItem.findFirst({
          where: { grnId: data.grnId, productId: item.productId },
          include: { grn: true }
        });

        if (grnItem) {
          await tx.inventoryLedger.create({
            data: {
              branchId: session.activeBranchId!,
              productId: item.productId,
              warehouseId: grnItem.grn.warehouseId,
              direction: 'OUT',
              quantity: item.returnedQty,
              refType: 'DEBIT_NOTE',
              refId: debitNote.id,
              date: new Date()
            }
          });
        }
      }

      return debitNote;
    });
  }
};
