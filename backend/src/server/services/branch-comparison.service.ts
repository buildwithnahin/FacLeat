import 'server-only';
import { authorize } from '@/server/auth/authorize';
import type { AppSession } from '@/server/auth/session';
import { branchService } from '@/server/services/branch.service';
import { reportsService } from '@/server/services/reports.service';

export interface BranchComparisonFilter {
  from?: Date;
  to?: Date;
}

export const branchComparisonService = {
  /**
   * Side-by-side KPI breakdown per branch, for the mobile "compare all
   * branches" screen. Runs reportsService.dashboardKpis(...) once per
   * branch, in parallel, scoped with branchId so each entry reflects that
   * branch alone (not the combined/all-branch view dashboardKpis returns
   * when branchId is omitted).
   */
  async compare(session: AppSession | null, filters: BranchComparisonFilter = {}) {
    await authorize(session, 'reports:read');

    const branches = await branchService.listAll(session);

    const rows = await Promise.all(
      branches.map(async (branch) => {
        const kpis = await reportsService.dashboardKpis(session, {
          ...filters,
          branchId: branch.id,
        });

        return {
          branchId: branch.id,
          branchName: branch.name,
          branchCode: branch.code,
          salesGross: kpis.salesGross.toNumber(),
          salesCount: kpis.salesCount,
          salesOutstanding: kpis.salesOutstanding.toNumber(),
          purchaseTotal: kpis.purchaseTotal.toNumber(),
          purchaseOutstanding: kpis.purchaseOutstanding.toNumber(),
          inventoryValue: kpis.inventoryValue.toNumber(),
          pendingApprovals: kpis.pendingApprovals,
          lowStockProducts: kpis.lowStockProducts,
          activeProducts: kpis.activeProducts,
        };
      }),
    );

    return rows.sort((a, b) => a.branchName.localeCompare(b.branchName));
  },
};
