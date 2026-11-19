import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import { getScopedBranchIds } from '@/server/auth/data-scope';
import type { AppSession } from '@/server/auth/session';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { nextDocumentNumber } from '@/lib/document-number';
import type {
  CreateTradeOrderInput,
  UpdateTradeOrderStatusInput,
  CreateShipmentInput,
  UpdateShipmentStatusInput,
  CreateLCInput,
  UpdateLCStatusInput,
  CreateLCAmendmentInput,
  AmendmentDecisionInput,
  CreateLCDrawdownInput,
  DrawdownDecisionInput,
  RecordDrawdownPaymentInput,
  CreateTradePaymentInput,
} from '@/server/validators/trade';

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

function nextTradeOrderNumber(year: number, count: number, type: 'EXPORT' | 'IMPORT') {
  const prefix = type === 'EXPORT' ? 'EXP' : 'IMP';
  return nextDocumentNumber(prefix, year, count);
}

export const tradeService = {
  // ─── Trade Orders ───────────────────────────────────────────────────────────

  async listOrders(
    session: AppSession | null,
    filters: {
      branchId?: string;
      type?: string;
      status?: string;
      from?: Date;
      to?: Date;
      search?: string;
    } = {},
  ) {
    await authorize(session, 'trade:read');
    const branchIds = await getScopedBranchIds(session, filters.branchId);
    return prisma.tradeOrder.findMany({
      where: {
        ...(branchIds ? { branchId: { in: branchIds } } : {}),
        type: filters.type as 'EXPORT' | 'IMPORT' | undefined,
        status: filters.status as Prisma.EnumTradeOrderStatusFilter['equals'] | undefined,
        createdAt: filters.from || filters.to ? { gte: filters.from, lte: filters.to } : undefined,
        OR: filters.search
          ? [
              { number: { contains: filters.search } },
              { contractRef: { contains: filters.search } },
              { customer: { name: { contains: filters.search } } },
              { customer: { code: { contains: filters.search } } },
              { supplier: { name: { contains: filters.search } } },
              { supplier: { code: { contains: filters.search } } },
            ]
          : undefined,
      },
      include: {
        customer: { select: { id: true, name: true, code: true } },
        supplier: { select: { id: true, name: true, code: true } },
        lc: { select: { id: true, number: true, status: true, lcAmount: true, currency: true } },
        _count: { select: { shipments: true, items: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getOrder(session: AppSession | null, id: string) {
    await authorize(session, 'trade:read');
    const order = await prisma.tradeOrder.findUnique({
      where: { id },
      include: {
        items: { include: { product: { select: { id: true, sku: true, name: true } } } },
        shipments: true,
        lc: {
          include: {
            amendments: { orderBy: { amendmentNumber: 'asc' } },
            drawdowns: { orderBy: { drawdownNumber: 'asc' } },
          },
        },
        payments: true,
        customer: { select: { id: true, name: true, code: true, email: true, phone: true } },
        supplier: { select: { id: true, name: true, code: true, email: true, phone: true } },
      },
    });
    if (!order) throw new NotFoundError('Trade order not found');
    return order;
  },

  async createOrder(session: AppSession | null, input: CreateTradeOrderInput) {
    const actor = await authorize(session, 'trade:write');

    const totalValue = input.items.reduce((sum, it) => {
      return sum.plus(D(it.quantity).mul(D(it.unitPrice)));
    }, new Prisma.Decimal(0));

    return prisma.$transaction(async (tx) => {
      const year = new Date().getFullYear();
      const count = await tx.tradeOrder.count({
        where: { type: input.type, createdAt: { gte: new Date(`${year}-01-01`) } },
      });

      const created = await tx.tradeOrder.create({
        data: {
          number: nextTradeOrderNumber(year, count, input.type),
          branchId: input.branchId,
          type: input.type,
          customerId: input.customerId || null,
          supplierId: input.supplierId || null,
          contractRef: input.contractRef || null,
          currency: input.currency,
          exchangeRate: D(input.exchangeRate),
          totalValue,
          localValue: totalValue.mul(D(input.exchangeRate)),
          portOfLoading: input.portOfLoading || null,
          portOfDischarge: input.portOfDischarge || null,
          incoterms: input.incoterms || null,
          latestShipDate: input.latestShipDate ?? null,
          expectedArrival: input.expectedArrival ?? null,
          goodsDescription: input.goodsDescription || null,
          notes: input.notes || null,
          createdById: actor.userId,
          items: {
            create: input.items.map((it) => ({
              productId: it.productId || null,
              description: it.description,
              hsCode: it.hsCode || null,
              quantity: D(it.quantity),
              unit: it.unit,
              unitPrice: D(it.unitPrice),
              lineTotal: D(it.quantity).mul(D(it.unitPrice)),
            })),
          },
        },
      });
      await recordAudit({
        actorId: actor.userId,
        branchId: input.branchId,
        module: 'trade',
        action: 'CREATE_ORDER',
        entityType: 'TradeOrder',
        entityId: created.id,
        after: created,
      }, tx);
      return created;
    });
  },

  async updateOrderStatus(session: AppSession | null, input: UpdateTradeOrderStatusInput) {
    const actor = await authorize(session, 'trade:write');
    const order = await prisma.tradeOrder.findUnique({ where: { id: input.orderId } });
    if (!order) throw new NotFoundError('Trade order not found');

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.tradeOrder.update({
        where: { id: input.orderId },
        data: { status: input.status, updatedById: actor.userId },
      });
      await recordAudit({
        actorId: actor.userId,
        branchId: order.branchId,
        module: 'trade',
        action: 'UPDATE_ORDER_STATUS',
        entityType: 'TradeOrder',
        entityId: order.id,
        before: { status: order.status },
        after: { status: input.status },
      }, tx);
      return u;
    });
    return updated;
  },

  // ─── Shipments ───────────────────────────────────────────────────────────────

  async createShipment(session: AppSession | null, input: CreateShipmentInput) {
    const actor = await authorize(session, 'trade:shipment');
    const order = await prisma.tradeOrder.findUnique({ where: { id: input.tradeOrderId } });
    if (!order) throw new NotFoundError('Trade order not found');

    return prisma.$transaction(async (tx) => {
      const count = await tx.tradeShipment.count({ where: { tradeOrderId: input.tradeOrderId } });

      const shipment = await tx.tradeShipment.create({
        data: {
          tradeOrderId: input.tradeOrderId,
          sequence: count + 1,
          carrierName: input.carrierName || null,
          vesselName: input.vesselName || null,
          voyageNumber: input.voyageNumber || null,
          blNumber: input.blNumber || null,
          blDate: input.blDate ?? null,
          bookingRef: input.bookingRef || null,
          portOfLoading: input.portOfLoading || null,
          portOfDischarge: input.portOfDischarge || null,
          etd: input.etd ?? null,
          eta: input.eta ?? null,
          actualDeparture: input.actualDeparture ?? null,
          actualArrival: input.actualArrival ?? null,
          containerNumbers: input.containerNumbers || null,
          sealNumbers: input.sealNumbers || null,
          grossWeight: input.grossWeight != null ? D(input.grossWeight) : null,
          netWeight: input.netWeight != null ? D(input.netWeight) : null,
          volume: input.volume != null ? D(input.volume) : null,
          packages: input.packages ?? null,
          freightCost: input.freightCost != null ? D(input.freightCost) : null,
          insuranceCost: input.insuranceCost != null ? D(input.insuranceCost) : null,
          notes: input.notes || null,
          createdById: actor.userId,
        },
      });
      await recordAudit({
        actorId: actor.userId,
        branchId: order.branchId,
        module: 'trade',
        action: 'CREATE_SHIPMENT',
        entityType: 'TradeShipment',
        entityId: shipment.id,
        after: shipment,
      }, tx);
      return shipment;
    });
  },

  async updateShipmentStatus(session: AppSession | null, input: UpdateShipmentStatusInput) {
    const actor = await authorize(session, 'trade:shipment');
    const shipment = await prisma.tradeShipment.findUnique({
      where: { id: input.shipmentId },
      include: { tradeOrder: { select: { branchId: true } } },
    });
    if (!shipment) throw new NotFoundError('Shipment not found');

    return prisma.$transaction(async (tx) => {
      const updated = await tx.tradeShipment.update({
        where: { id: input.shipmentId },
        data: {
          status: input.status,
          customsClearedAt: input.customsClearedAt ?? null,
        },
      });
      await recordAudit({
        actorId: actor.userId,
        branchId: shipment.tradeOrder.branchId,
        module: 'trade',
        action: 'UPDATE_SHIPMENT_STATUS',
        entityType: 'TradeShipment',
        entityId: shipment.id,
        before: { status: shipment.status },
        after: { status: input.status },
      }, tx);
      return updated;
    });
  },

  // ─── Letter of Credit ────────────────────────────────────────────────────────

  async listLCs(
    session: AppSession | null,
    filters: { branchId?: string; status?: string; from?: Date; to?: Date; search?: string } = {},
  ) {
    await authorize(session, 'trade:read');
    const branchIds = await getScopedBranchIds(session, filters.branchId);
    return prisma.letterOfCredit.findMany({
      where: {
        ...(branchIds ? { branchId: { in: branchIds } } : {}),
        status: filters.status as Prisma.EnumLCStatusFilter['equals'] | undefined,
        issueDate: filters.from || filters.to ? { gte: filters.from, lte: filters.to } : undefined,
        OR: filters.search
          ? [
              { number: { contains: filters.search } },
              { applicantName: { contains: filters.search } },
              { beneficiaryName: { contains: filters.search } },
              { issuingBank: { contains: filters.search } },
              { tradeOrder: { number: { contains: filters.search } } },
            ]
          : undefined,
      },
      include: {
        tradeOrder: { select: { id: true, number: true, type: true } },
        _count: { select: { drawdowns: true, amendments: true } },
      },
      orderBy: { issueDate: 'desc' },
    });
  },

  async getLC(session: AppSession | null, id: string) {
    await authorize(session, 'trade:read');
    const lc = await prisma.letterOfCredit.findUnique({
      where: { id },
      include: {
        tradeOrder: {
          include: {
            items: true,
            customer: { select: { id: true, name: true, code: true } },
            supplier: { select: { id: true, name: true, code: true } },
          },
        },
        amendments: { orderBy: { amendmentNumber: 'asc' } },
        drawdowns: { orderBy: { drawdownNumber: 'asc' } },
      },
    });
    if (!lc) throw new NotFoundError('LC not found');
    return lc;
  },

  async createLC(session: AppSession | null, input: CreateLCInput) {
    const actor = await authorize(session, 'trade:lc-issue');

    const order = await prisma.tradeOrder.findUnique({ where: { id: input.tradeOrderId } });
    if (!order) throw new NotFoundError('Trade order not found');

    const existing = await prisma.letterOfCredit.findUnique({
      where: { tradeOrderId: input.tradeOrderId },
    });
    if (existing) throw new ValidationError('This trade order already has an LC');

    const lcAmount = D(input.lcAmount);

    return prisma.$transaction(async (tx) => {
      const year = new Date().getFullYear();
      const count = await tx.letterOfCredit.count({
        where: { createdAt: { gte: new Date(`${year}-01-01`) } },
      });

      const lc = await tx.letterOfCredit.create({
        data: {
          number: nextDocumentNumber('LC', year, count),
          tradeOrderId: input.tradeOrderId,
          branchId: input.branchId,
          type: input.type,
          paymentMode: input.paymentMode,
          applicantName: input.applicantName,
          beneficiaryName: input.beneficiaryName,
          issuingBank: input.issuingBank,
          issuingBankSwift: input.issuingBankSwift || null,
          advisingBank: input.advisingBank || null,
          advisingBankSwift: input.advisingBankSwift || null,
          confirmingBank: input.confirmingBank || null,
          currency: input.currency,
          lcAmount,
          tolerancePlus: D(input.tolerancePlus),
          toleranceMinus: D(input.toleranceMinus),
          availableAmount: lcAmount,
          issueDate: input.issueDate,
          expiryDate: input.expiryDate,
          expiryPlace: input.expiryPlace || null,
          latestShipDate: input.latestShipDate ?? null,
          presentationDays: input.presentationDays,
          partialShipment: input.partialShipment,
          transhipmentAllowed: input.transhipmentAllowed,
          portOfLoading: input.portOfLoading || null,
          portOfDischarge: input.portOfDischarge || null,
          airPortOfLoading: input.airPortOfLoading || null,
          airPortOfDestination: input.airPortOfDestination || null,
          flightNumber: input.flightNumber || null,
          airlineName: input.airlineName || null,
          shipPortOfLoading: input.shipPortOfLoading || input.portOfLoading || null,
          shipPortOfDischarge: input.shipPortOfDischarge || input.portOfDischarge || null,
          vesselName: input.vesselName || null,
          voyageNumber: input.voyageNumber || null,
          goodsDescription: input.goodsDescription || null,
          specialConditions: input.specialConditions || null,
          swiftMt700Ref: input.swiftMt700Ref || null,
          createdById: actor.userId,
          issuedById: actor.userId,
        },
      });
      await recordAudit({
        actorId: actor.userId,
        branchId: input.branchId,
        module: 'trade',
        action: 'CREATE_LC',
        entityType: 'LetterOfCredit',
        entityId: lc.id,
        after: lc,
      }, tx);
      return lc;
    });
  },

  async updateLCStatus(session: AppSession | null, input: UpdateLCStatusInput) {
    const actor = await authorize(session, 'trade:lc-issue');
    const lc = await prisma.letterOfCredit.findUnique({ where: { id: input.lcId } });
    if (!lc) throw new NotFoundError('LC not found');

    // Validate transitions
    const TERMINAL = ['FULLY_UTILIZED', 'EXPIRED', 'CLOSED', 'CANCELLED'];
    if (TERMINAL.includes(lc.status)) {
      throw new ValidationError(`LC in ${lc.status} state cannot be changed`);
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.letterOfCredit.update({
        where: { id: input.lcId },
        data: { status: input.status, updatedById: actor.userId },
      });
      await recordAudit({
        actorId: actor.userId,
        branchId: lc.branchId,
        module: 'trade',
        action: 'UPDATE_LC_STATUS',
        entityType: 'LetterOfCredit',
        entityId: lc.id,
        before: { status: lc.status },
        after: { status: input.status },
      }, tx);
      return updated;
    });
  },

  // ─── LC Amendments ───────────────────────────────────────────────────────────

  async createAmendment(session: AppSession | null, input: CreateLCAmendmentInput) {
    const actor = await authorize(session, 'trade:lc-amend');
    const lc = await prisma.letterOfCredit.findUnique({ where: { id: input.lcId } });
    if (!lc) throw new NotFoundError('LC not found');

    const AMEND_ALLOWED = ['ISSUED', 'ADVISED', 'CONFIRMED', 'ACTIVE'];
    if (!AMEND_ALLOWED.includes(lc.status)) {
      throw new ValidationError(`LC in ${lc.status} status cannot be amended`);
    }

    const lastAmendment = await prisma.lCAmendment.findFirst({
      where: { lcId: input.lcId },
      orderBy: { amendmentNumber: 'desc' },
    });

    return prisma.$transaction(async (tx) => {
      const amendment = await tx.lCAmendment.create({
        data: {
          lcId: input.lcId,
          amendmentNumber: (lastAmendment?.amendmentNumber ?? 0) + 1,
          newExpiryDate: input.newExpiryDate ?? null,
          newLcAmount: input.newLcAmount != null ? D(input.newLcAmount) : null,
          newLatestShipDate: input.newLatestShipDate ?? null,
          newSpecialConditions: input.newSpecialConditions || null,
          reason: input.reason,
          requestedById: actor.userId,
        },
      });
      await tx.letterOfCredit.update({
        where: { id: input.lcId },
        data: { status: 'AMENDED' },
      });
      await recordAudit({
        actorId: actor.userId,
        branchId: lc.branchId,
        module: 'trade',
        action: 'CREATE_LC_AMENDMENT',
        entityType: 'LetterOfCredit',
        entityId: amendment.id,
        after: amendment,
      }, tx);
      return amendment;
    });
  },

  async decideAmendment(session: AppSession | null, input: AmendmentDecisionInput) {
    const actor = await authorize(session, 'trade:lc-amend');
    const amendment = await prisma.lCAmendment.findUnique({
      where: { id: input.amendmentId },
      include: { lc: true },
    });
    if (!amendment) throw new NotFoundError('Amendment not found');
    if (amendment.status !== 'PENDING') {
      throw new ValidationError('Amendment is not in PENDING state');
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.lCAmendment.update({
        where: { id: input.amendmentId },
        data: {
          status: input.decision,
          approvedById: input.decision === 'APPROVED' ? (actor.userId) : null,
          approvedAt: input.decision === 'APPROVED' ? new Date() : null,
          rejectedById: input.decision === 'REJECTED' ? (actor.userId) : null,
          rejectionNote: input.decision === 'REJECTED' ? (input.note || null) : null,
        },
      });

      // Apply amendment changes to LC when approved
      if (input.decision === 'APPROVED') {
        await tx.letterOfCredit.update({
          where: { id: amendment.lcId },
          data: {
            status: 'ACTIVE',
            expiryDate: amendment.newExpiryDate ?? amendment.lc.expiryDate,
            lcAmount: amendment.newLcAmount ?? amendment.lc.lcAmount,
            latestShipDate: amendment.newLatestShipDate ?? amendment.lc.latestShipDate,
            specialConditions: amendment.newSpecialConditions ?? amendment.lc.specialConditions,
          },
        });
      } else {
        // Revert to ACTIVE if rejected
        await tx.letterOfCredit.update({
          where: { id: amendment.lcId },
          data: { status: 'ACTIVE' },
        });
      }

      await recordAudit({
        actorId: actor.userId,
        branchId: amendment.lc.branchId,
        module: 'trade',
        action: 'DECIDE_LC_AMENDMENT',
        entityType: 'LetterOfCredit',
        entityId: amendment.id,
        before: { status: amendment.status },
        after: { status: input.decision },
      }, tx);
      return updated;
    });
  },

  // ─── LC Drawdowns ────────────────────────────────────────────────────────────

  async createDrawdown(session: AppSession | null, input: CreateLCDrawdownInput) {
    const actor = await authorize(session, 'trade:lc-drawdown');
    const lc = await prisma.letterOfCredit.findUnique({ where: { id: input.lcId } });
    if (!lc) throw new NotFoundError('LC not found');

    if (!['ISSUED', 'ADVISED', 'CONFIRMED', 'ACTIVE', 'PARTIALLY_UTILIZED'].includes(lc.status)) {
      throw new ValidationError(`LC in ${lc.status} status does not allow drawdowns`);
    }

    const amount = D(input.amount);
    // Check tolerance-adjusted max available
    const maxDraw = lc.availableAmount.mul(D(1).plus(lc.tolerancePlus.div(100)));
    if (amount.gt(maxDraw)) {
      throw new ValidationError(
        `Drawdown amount ${amount} exceeds available amount ${lc.availableAmount} (with tolerance ${lc.tolerancePlus}%)`,
      );
    }

    const lastDd = await prisma.lCDrawdown.findFirst({
      where: { lcId: input.lcId },
      orderBy: { drawdownNumber: 'desc' },
    });

    // Compute BL presentation deadline
    const documentsDueBy = new Date(
      new Date(input.presentationDate).getTime() + lc.presentationDays * 86400000,
    );

    return prisma.$transaction(async (tx) => {
      const drawdown = await tx.lCDrawdown.create({
        data: {
          lcId: input.lcId,
          drawdownNumber: (lastDd?.drawdownNumber ?? 0) + 1,
          status: 'DOCUMENTS_SUBMITTED',
          presentationDate: input.presentationDate,
          documentsDueBy,
          amount,
          commercialInvoiceRef: input.commercialInvoiceRef || null,
          blRef: input.blRef || null,
          packingListRef: input.packingListRef || null,
          certificateOfOrigin: input.certificateOfOrigin,
          inspectionCert: input.inspectionCert,
          otherDocs: input.otherDocs || null,
          notes: input.notes || null,
          createdById: actor.userId,
        },
      });

      // Update LC utilized / available — availableAmount is always derived from
      // lcAmount - utilizedAmount (not incrementally adjusted) so it stays
      // self-consistent even when a drawdown uses tolerance headroom.
      const newUtilized = lc.utilizedAmount.plus(amount);
      const newAvailableRaw = lc.lcAmount.minus(newUtilized);
      const newAvailable = newAvailableRaw.gt(D(0)) ? newAvailableRaw : D(0);
      const newStatus = newAvailable.lte(D(0)) ? 'FULLY_UTILIZED' : 'PARTIALLY_UTILIZED';

      await tx.letterOfCredit.update({
        where: { id: input.lcId },
        data: {
          utilizedAmount: newUtilized,
          availableAmount: newAvailable,
          status: newStatus,
        },
      });

      await recordAudit({
        actorId: actor.userId,
        branchId: lc.branchId,
        module: 'trade',
        action: 'CREATE_LC_DRAWDOWN',
        entityType: 'LetterOfCredit',
        entityId: drawdown.id,
        after: { ...drawdown, newAvailable: newAvailable.toString() },
      }, tx);
      return drawdown;
    });
  },

  async decideDrawdown(session: AppSession | null, input: DrawdownDecisionInput) {
    const actor = await authorize(session, 'trade:lc-drawdown');
    const drawdown = await prisma.lCDrawdown.findUnique({
      where: { id: input.drawdownId },
      include: { lc: true },
    });
    if (!drawdown) throw new NotFoundError('Drawdown not found');
    if (drawdown.status !== 'DOCUMENTS_SUBMITTED') {
      throw new ValidationError('Drawdown is not in DOCUMENTS_SUBMITTED state');
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.lCDrawdown.update({
        where: { id: input.drawdownId },
        data: {
          status: input.decision,
          paymentDueDate: input.decision === 'DOCUMENTS_ACCEPTED' ? (input.paymentDueDate ?? null) : null,
          discrepancyNote: input.discrepancyNote || null,
          updatedById: actor.userId,
        },
      });

      // If rejected, release the amount back to LC. availableAmount is re-derived
      // from lcAmount - utilizedAmount (not incremented by the raw drawdown amount)
      // so it can't drift above the LC's real remaining balance when the original
      // drawdown had been clamped for exceeding tolerance-adjusted availability.
      if (input.decision === 'REJECTED') {
        const newUtilized = drawdown.lc.utilizedAmount.minus(drawdown.amount);
        const newAvailableRaw = drawdown.lc.lcAmount.minus(newUtilized);
        const newAvailable = newAvailableRaw.gt(D(0)) ? newAvailableRaw : D(0);
        await tx.letterOfCredit.update({
          where: { id: drawdown.lcId },
          data: {
            utilizedAmount: newUtilized,
            availableAmount: newAvailable,
            status: newUtilized.lte(D(0)) ? 'ACTIVE' : 'PARTIALLY_UTILIZED',
          },
        });
      }

      await recordAudit({
        actorId: actor.userId,
        branchId: drawdown.lc.branchId,
        module: 'trade',
        action: 'DECIDE_LC_DRAWDOWN',
        entityType: 'LetterOfCredit',
        entityId: drawdown.id,
        before: { status: drawdown.status },
        after: { status: input.decision },
      }, tx);
      return updated;
    });
  },

  async recordDrawdownPayment(session: AppSession | null, input: RecordDrawdownPaymentInput) {
    const actor = await authorize(session, 'trade:lc-drawdown');
    const drawdown = await prisma.lCDrawdown.findUnique({
      where: { id: input.drawdownId },
      include: { lc: { include: { tradeOrder: true } } },
    });
    if (!drawdown) throw new NotFoundError('Drawdown not found');
    if (drawdown.status !== 'DOCUMENTS_ACCEPTED') {
      throw new ValidationError('Drawdown must be in DOCUMENTS_ACCEPTED state to record payment');
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.lCDrawdown.update({
        where: { id: input.drawdownId },
        data: {
          status: 'PAYMENT_RECEIVED',
          paymentReceivedAt: input.paymentReceivedAt,
          bankCharges: D(input.bankCharges),
          updatedById: actor.userId,
        },
      });

      // Automatically record TradePayment voucher for this settled drawdown
      if (drawdown.lc.tradeOrder) {
        const order = drawdown.lc.tradeOrder;
        const year = new Date().getFullYear();
        const count = await tx.tradePayment.count({
          where: { createdAt: { gte: new Date(`${year}-01-01`) } },
        });
        const amount = D(drawdown.amount);
        const exchangeRate = order.exchangeRate ? D(order.exchangeRate) : D(1);
        const localAmount = amount.mul(exchangeRate);

        await tx.tradePayment.create({
          data: {
            number: nextDocumentNumber('TRP', year, count),
            tradeOrderId: order.id,
            branchId: order.branchId,
            status: 'PAID',
            currency: drawdown.lc.currency,
            amount,
            exchangeRate,
            localAmount,
            bankName: drawdown.lc.advisingBank || drawdown.lc.issuingBank || 'LC Settlement Bank',
            bankReference: `Drawdown #${drawdown.drawdownNumber} (${drawdown.lc.number})`,
            swiftRef: drawdown.lc.swiftMt700Ref || null,
            paymentDate: input.paymentReceivedAt ?? new Date(),
            notes: `Settled via LC Drawdown #${drawdown.drawdownNumber} on ${drawdown.lc.number}`,
            createdById: actor.userId,
          },
        });
      }

      await recordAudit({
        actorId: actor.userId,
        branchId: drawdown.lc.branchId,
        module: 'trade',
        action: 'DRAWDOWN_PAYMENT_RECEIVED',
        entityType: 'LetterOfCredit',
        entityId: drawdown.id,
        after: { paymentReceivedAt: input.paymentReceivedAt, bankCharges: input.bankCharges },
      }, tx);
      return updated;
    });
  },

  // ─── Trade Payments ──────────────────────────────────────────────────────────

  async createPayment(session: AppSession | null, input: CreateTradePaymentInput) {
    const actor = session?.permissions.includes('trade:payment')
      ? await authorize(session, 'trade:payment')
      : await authorize(session, 'trade:write');
    const order = await prisma.tradeOrder.findUnique({ where: { id: input.tradeOrderId } });
    if (!order) throw new NotFoundError('Trade order not found');

    const year = new Date().getFullYear();
    const count = await prisma.tradePayment.count({
      where: { createdAt: { gte: new Date(`${year}-01-01`) } },
    });

    const amount = D(input.amount);
    const localAmount = amount.mul(D(input.exchangeRate));

    return prisma.$transaction(async (tx) => {
      const payment = await tx.tradePayment.create({
        data: {
          number: nextDocumentNumber('TRP', year, count),
          tradeOrderId: input.tradeOrderId,
          branchId: input.branchId,
          currency: input.currency,
          amount,
          exchangeRate: D(input.exchangeRate),
          localAmount,
          bankName: input.bankName || null,
          bankReference: input.bankReference || null,
          swiftRef: input.swiftRef || null,
          paymentDate: input.paymentDate,
          valueDate: input.valueDate ?? null,
          notes: input.notes || null,
          createdById: actor.userId,
        },
      });
      await recordAudit({
        actorId: actor.userId,
        branchId: input.branchId,
        module: 'trade',
        action: 'CREATE_TRADE_PAYMENT',
        entityType: 'TradePayment',
        entityId: payment.id,
        after: payment,
      }, tx);
      return payment;
    });
  },

  // ─── Payments & Shipments listing ────────────────────────────────────────────
  // Ported from the web (app)/trade/payments and /trade/shipments pages, which
  // queried prisma directly before the backend/web split — no equivalent
  // service method existed yet.

  async listPayments(session: AppSession | null, branchId?: string) {
    await authorize(session, 'trade:read');
    const branchIds = await getScopedBranchIds(session, branchId);

    // Auto-sync any PAYMENT_RECEIVED drawdowns that haven't created a TradePayment record yet
    const unrecordedDrawdowns = await prisma.lCDrawdown.findMany({
      where: {
        status: 'PAYMENT_RECEIVED',
        lc: { ...(branchIds ? { branchId: { in: branchIds } } : {}) },
      },
      include: { lc: { include: { tradeOrder: true } } },
    });

    for (const dd of unrecordedDrawdowns) {
      if (!dd.lc.tradeOrder) continue;
      const ref = `Drawdown #${dd.drawdownNumber} (${dd.lc.number})`;
      const existing = await prisma.tradePayment.findFirst({
        where: { tradeOrderId: dd.lc.tradeOrderId, bankReference: ref },
      });
      if (!existing) {
        const year = new Date().getFullYear();
        const count = await prisma.tradePayment.count({
          where: { createdAt: { gte: new Date(`${year}-01-01`) } },
        });
        const order = dd.lc.tradeOrder;
        const amount = D(dd.amount);
        const exchangeRate = order.exchangeRate ? D(order.exchangeRate) : D(1);
        const localAmount = amount.mul(exchangeRate);
        await prisma.tradePayment.create({
          data: {
            number: nextDocumentNumber('TRP', year, count),
            tradeOrderId: order.id,
            branchId: order.branchId,
            status: 'PAID',
            currency: dd.lc.currency,
            amount,
            exchangeRate,
            localAmount,
            bankName: dd.lc.advisingBank || dd.lc.issuingBank || 'LC Settlement Bank',
            bankReference: ref,
            swiftRef: dd.lc.swiftMt700Ref || null,
            paymentDate: dd.paymentReceivedAt || new Date(),
            notes: `Settled via LC Drawdown #${dd.drawdownNumber} on ${dd.lc.number}`,
          },
        });
      }
    }

    return prisma.tradePayment.findMany({
      where: { ...(branchIds ? { branchId: { in: branchIds } } : {}) },
      include: { tradeOrder: { select: { id: true, number: true, type: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  },

  async listShipments(session: AppSession | null, branchId?: string) {
    await authorize(session, 'trade:read');
    const branchIds = await getScopedBranchIds(session, branchId);
    return prisma.tradeShipment.findMany({
      where: { tradeOrder: { ...(branchIds ? { branchId: { in: branchIds } } : {}) } },
      include: { tradeOrder: { select: { id: true, number: true, type: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  },

  // ─── Form option lookups ─────────────────────────────────────────────────────
  // Ported from (app)/trade/orders/new and /trade/lc/new, which queried prisma
  // directly for dropdown data before the backend/web split.

  async getOrderFormOptions(session: AppSession | null) {
    await authorize(session, 'trade:read');
    const [branches, customers, suppliers, products] = await Promise.all([
      prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true } }),
      prisma.customer.findMany({
        where: { status: 'ACTIVE', type: { in: ['EXPORT', 'CORPORATE'] } },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      prisma.supplier.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      prisma.product.findMany({
        where: { isActive: true },
        select: {
          id: true,
          sku: true,
          name: true,
          unit: true,
          sellPrice: true,
          costPrice: true,
          type: true,
        },
        orderBy: { name: 'asc' },
      }),
    ]);
    return { branches, customers, suppliers, products };
  },

  async getLCFormOptions(session: AppSession | null, branchId?: string) {
    await authorize(session, 'trade:read');
    const branchIds = await getScopedBranchIds(session, branchId);
    const [orders, branches] = await Promise.all([
      prisma.tradeOrder.findMany({
        where: {
          lc: null,
          status: { notIn: ['CANCELLED', 'COMPLETED'] },
          ...(branchIds ? { branchId: { in: branchIds } } : {}),
        },
        select: {
          id: true, number: true, type: true, currency: true, totalValue: true,
          portOfLoading: true, portOfDischarge: true, goodsDescription: true, latestShipDate: true,
          customer: { select: { name: true } },
          supplier: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    ]);
    return { orders, branches };
  },

  // ─── Dashboard stats ─────────────────────────────────────────────────────────

  async getStats(session: AppSession | null, branchId?: string) {
    await authorize(session, 'trade:read');
    const branchIds = await getScopedBranchIds(session, branchId);
    const branchFilter = branchIds ? { branchId: { in: branchIds } } : {};

    const [
      totalOrders,
      exportOrders,
      importOrders,
      activeLCs,
      expiringLCs,
      pendingDrawdowns,
    ] = await Promise.all([
      prisma.tradeOrder.count({ where: { ...branchFilter, status: { not: 'CANCELLED' } } }),
      prisma.tradeOrder.count({ where: { ...branchFilter, type: 'EXPORT', status: { not: 'CANCELLED' } } }),
      prisma.tradeOrder.count({ where: { ...branchFilter, type: 'IMPORT', status: { not: 'CANCELLED' } } }),
      prisma.letterOfCredit.count({
        where: { ...branchFilter, status: { in: ['ACTIVE', 'PARTIALLY_UTILIZED', 'ISSUED', 'ADVISED', 'CONFIRMED'] } },
      }),
      prisma.letterOfCredit.count({
        where: {
          ...branchFilter,
          status: { in: ['ACTIVE', 'ISSUED', 'CONFIRMED'] },
          expiryDate: { lte: new Date(Date.now() + 30 * 86400000) },
        },
      }),
      prisma.lCDrawdown.count({
        where: {
          status: 'DOCUMENTS_SUBMITTED',
          lc: branchIds ? { branchId: { in: branchIds } } : undefined,
        },
      }),
    ]);

    return { totalOrders, exportOrders, importOrders, activeLCs, expiringLCs, pendingDrawdowns };
  },
};
