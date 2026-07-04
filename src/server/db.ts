import { PrismaClient } from '../generated/prisma';

declare global {
  var __prisma: PrismaClient | undefined;
}

function createClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

type RuntimeModelClient = PrismaClient & {
  _runtimeDataModel?: {
    models?: {
      User?: {
        fields?: Array<{ name?: string; kind?: string }>;
      };
    };
  };
};

function hasWorkflowDelegates(client: PrismaClient | undefined): client is PrismaClient {
  if (!client) return false;
  const userFields = (client as RuntimeModelClient)._runtimeDataModel?.models?.User?.fields;
  const hasUserEmployeeRelation =
    Array.isArray(userFields) &&
    userFields.some((field: { name?: string; kind?: string }) => field.name === 'employee' && field.kind === 'object');
  return (
    hasUserEmployeeRelation &&
    'customerReturn' in client &&
    typeof client.customerReturn === 'object' &&
    'damageReport' in client &&
    typeof client.damageReport === 'object' &&
    'hrMasterData' in client &&
    typeof client.hrMasterData === 'object' &&
    'hrWorkflowRecord' in client &&
    typeof client.hrWorkflowRecord === 'object' &&
    'employeePromotion' in client &&
    typeof client.employeePromotion === 'object' &&
    'employeeIncrement' in client &&
    typeof client.employeeIncrement === 'object' &&
    'employeeResignation' in client &&
    typeof client.employeeResignation === 'object' &&
    'employeeExitClearance' in client &&
    typeof client.employeeExitClearance === 'object' &&
    'attendanceAdjustment' in client &&
    typeof client.attendanceAdjustment === 'object' &&
    'leaveBalanceAdjustment' in client &&
    typeof client.leaveBalanceAdjustment === 'object' &&
    'leavePolicy' in client &&
    typeof client.leavePolicy === 'object' &&
    'leavePolicyRule' in client &&
    typeof client.leavePolicyRule === 'object' &&
    'leaveType' in client &&
    typeof client.leaveType === 'object' &&
    'employeeLeavePolicy' in client &&
    typeof client.employeeLeavePolicy === 'object' &&
    'employeeSalaryHistory' in client &&
    typeof client.employeeSalaryHistory === 'object' &&
    'employeeTransfer' in client &&
    typeof client.employeeTransfer === 'object' &&
    'salaryComponent' in client &&
    typeof client.salaryComponent === 'object' &&
    'salaryStructure' in client &&
    typeof client.salaryStructure === 'object' &&
    'employeeSalaryStructureAssignment' in client &&
    typeof client.employeeSalaryStructureAssignment === 'object' &&
    'payrollPeriod' in client &&
    typeof client.payrollPeriod === 'object' &&
    'loanRequest' in client &&
    typeof client.loanRequest === 'object' &&
    'loanRepaymentSchedule' in client &&
    typeof client.loanRepaymentSchedule === 'object' &&
    'bonus' in client &&
    typeof client.bonus === 'object' &&
    'employeeBonus' in client &&
    typeof client.employeeBonus === 'object' &&
    'payrollAdjustment' in client &&
    typeof client.payrollAdjustment === 'object' &&
    'finalSettlement' in client &&
    typeof client.finalSettlement === 'object'
  );
}

export const prisma = hasWorkflowDelegates(globalThis.__prisma)
  ? globalThis.__prisma
  : createClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}
