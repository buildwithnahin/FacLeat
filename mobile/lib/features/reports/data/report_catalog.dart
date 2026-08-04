/// Static catalog of report types exposed by the mobile reports API.
///
/// These lists are hardcoded (per the backend contract) rather than
/// discovered at runtime — there is no "list report types" endpoint.
class ReportItem {
  const ReportItem(this.type, this.label);
  final String type;
  final String label;
}

class ReportCategory {
  const ReportCategory(this.key, this.label, this.items);
  final String key;
  final String label;
  final List<ReportItem> items;
}

/// `GET /reports/general/:type`
const List<ReportItem> generalReports = [
  ReportItem('sales-summary', 'Sales Summary'),
  ReportItem('top-products', 'Top Products'),
  ReportItem('purchase-summary', 'Purchase Summary'),
  ReportItem('inventory-valuation', 'Inventory Valuation'),
  ReportItem('hr-summary', 'HR Summary'),
  ReportItem('dashboard-kpis', 'Dashboard KPIs'),
  ReportItem('cash-flow', 'Cash Flow'),
  ReportItem('production-summary', 'Production Summary'),
];

/// `GET /reports/financials/:type`
const List<ReportItem> financialReports = [
  ReportItem('trial-balance', 'Trial Balance'),
  ReportItem('balance-sheet', 'Balance Sheet'),
  ReportItem('income-statement', 'Income Statement'),
  ReportItem('cash-flow-statement', 'Cash Flow Statement'),
  ReportItem('changes-in-equity', 'Changes in Equity'),
  ReportItem('notes', 'Notes to Accounts'),
];

/// `GET /reports/hr/:category/:type`
const List<ReportCategory> hrReportCategories = [
  ReportCategory('payroll', 'Payroll', [
    ReportItem('PAYROLL_SUMMARY', 'Payroll Summary'),
    ReportItem('SALARY_REGISTER', 'Salary Register'),
    ReportItem('PAYSLIP', 'Payslip'),
    ReportItem('BONUS', 'Bonus'),
    ReportItem('LOAN_ADVANCE', 'Loan & Advance'),
    ReportItem('PAYROLL_ADJUSTMENT', 'Payroll Adjustment'),
    ReportItem('PAYROLL_COMPARISON', 'Payroll Comparison'),
    ReportItem('SALARY_COST_CENTER', 'Salary Cost Center'),
    ReportItem('PAYROLL_AUDIT', 'Payroll Audit'),
  ]),
  ReportCategory('recruitment', 'Recruitment', [
    ReportItem('OPEN_POSITIONS', 'Open Positions'),
    ReportItem('CANDIDATE_PIPELINE', 'Candidate Pipeline'),
    ReportItem('TIME_TO_HIRE', 'Time to Hire'),
    ReportItem('OFFER_STATUS', 'Offer Status'),
    ReportItem('SOURCE_EFFECTIVENESS', 'Source Effectiveness'),
  ]),
  ReportCategory('lifecycle', 'Lifecycle', [
    ReportItem('NEW_JOINERS', 'New Joiners'),
    ReportItem('CONFIRMATIONS', 'Confirmations'),
    ReportItem('PROMOTIONS', 'Promotions'),
    ReportItem('TRANSFERS', 'Transfers'),
    ReportItem('EXITS', 'Exits'),
    ReportItem('ATTRITION', 'Attrition'),
  ]),
  ReportCategory('leave', 'Leave', [
    ReportItem('LEAVE_BALANCE', 'Leave Balance'),
    ReportItem('LEAVE_REQUESTS', 'Leave Requests'),
    ReportItem('LEAVE_UTILIZATION', 'Leave Utilization'),
    ReportItem('HOLIDAY_CALENDAR', 'Holiday Calendar'),
  ]),
  ReportCategory('employee', 'Employee', [
    ReportItem('EMPLOYEE_DIRECTORY', 'Employee Directory'),
    ReportItem('EMPLOYEE_DEMOGRAPHICS', 'Employee Demographics'),
    ReportItem('DOCUMENT_EXPIRY', 'Document Expiry'),
    ReportItem('HEADCOUNT_BY_DEPARTMENT', 'Headcount by Department'),
  ]),
  ReportCategory('attendance', 'Attendance', [
    ReportItem('ATTENDANCE_SUMMARY', 'Attendance Summary'),
    ReportItem('LATE_ARRIVALS', 'Late Arrivals'),
    ReportItem('OVERTIME', 'Overtime'),
    ReportItem('SHIFT_COVERAGE', 'Shift Coverage'),
    ReportItem('ABSENTEEISM', 'Absenteeism'),
  ]),
];

/// Humanizes a raw type/category slug when it isn't found in the catalog
/// (e.g. a deep link with an unknown type) — falls back to title-casing the
/// slug itself rather than showing a raw kebab/SCREAMING_SNAKE string.
String _fallbackLabel(String slug) {
  final spaced = slug.replaceAll('_', ' ').replaceAll('-', ' ').toLowerCase();
  final words = spaced.split(' ').where((w) => w.isNotEmpty);
  return words.map((w) => w[0].toUpperCase() + w.substring(1)).join(' ');
}

String generalReportLabel(String type) =>
    generalReports.firstWhere((r) => r.type == type, orElse: () => ReportItem(type, _fallbackLabel(type))).label;

String financialReportLabel(String type) =>
    financialReports.firstWhere((r) => r.type == type, orElse: () => ReportItem(type, _fallbackLabel(type))).label;

String hrReportLabel(String category, String type) {
  final cat = hrReportCategories.firstWhere(
    (c) => c.key == category,
    orElse: () => ReportCategory(category, _fallbackLabel(category), const []),
  );
  final item = cat.items.firstWhere((r) => r.type == type, orElse: () => ReportItem(type, _fallbackLabel(type)));
  return '${cat.label} · ${item.label}';
}
