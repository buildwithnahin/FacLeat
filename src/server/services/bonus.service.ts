import { prisma } from '@/server/db';
import { Prisma, BonusStatus } from '@prisma/client';
import { BonusFormValues } from '../validators/bonus';

export class BonusService {
  static async getDashboardStats() {
    const pendingBonus = await prisma.bonus.count({
      where: { status: { in: ['SUBMITTED', 'PENDING_HR', 'PENDING_MANAGEMENT'] } },
    });
    
    const approvedBonus = await prisma.bonus.count({
      where: { status: 'APPROVED' },
    });
    
    // Get current month stats (naive approach)
    const currentMonth = new Date().toISOString().substring(0, 7);
    const thisMonthBonuses = await prisma.bonus.findMany({
      where: { effectivePayrollMonth: currentMonth, status: { in: ['APPROVED', 'PUBLISHED', 'PAID'] } },
      include: { employeeBonuses: true },
    });
    
    const thisMonthAmount = thisMonthBonuses.reduce((acc, bonus) => {
      return acc + bonus.employeeBonuses.reduce((sum, eb) => sum + Number(eb.amount), 0);
    }, 0);
    
    const eligibleEmployees = thisMonthBonuses.reduce((acc, bonus) => acc + bonus.employeeBonuses.length, 0);

    return {
      pendingBonus,
      approvedBonus,
      thisMonthAmount,
      eligibleEmployees,
    };
  }

  static async getBonuses(where?: Prisma.BonusWhereInput) {
    return prisma.bonus.findMany({
      where,
      include: {
        _count: {
          select: { employeeBonuses: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getBonusById(id: string) {
    return prisma.bonus.findUnique({
      where: { id },
      include: {
        employeeBonuses: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                code: true,
                basicSalary: true,
                salaryStructureAssignments: {
                  where: {
                    status: 'ACTIVE'
                  },
                  include: {
                    salaryStructure: true
                  },
                  take: 1
                }
              }
            }
          }
        }
      },
    });
  }

  static async calculateBonusAmountForEmployee(bonus: BonusFormValues, employee: any): Promise<number> {
    if (bonus.calculationMethod === 'FIXED_AMOUNT') {
      return Number(bonus.amount) || 0;
    }
    
    if (bonus.calculationMethod === 'PERCENTAGE' && bonus.percentage) {
      let baseAmount = 0;
      
      if (bonus.basedOn === 'BASIC_SALARY') {
        baseAmount = Number(employee.basicSalary) || 0;
      } else if (bonus.basedOn === 'GROSS_SALARY' || bonus.basedOn === 'NET_SALARY') {
        // Fallback to active salary structure if needed
        const activeStructure = employee.salaryStructureAssignments?.[0]?.salaryStructure;
        if (activeStructure) {
          baseAmount = bonus.basedOn === 'GROSS_SALARY' ? Number(activeStructure.grossSalary) : Number(activeStructure.netSalary || activeStructure.grossSalary);
        } else {
          // If no structure, fallback to basic salary
          baseAmount = Number(employee.basicSalary) || 0;
        }
      }
      
      return (baseAmount * Number(bonus.percentage)) / 100;
    }
    
    return 0;
  }

  static async createBonus(data: BonusFormValues) {
    const { employeeIds, ...bonusData } = data;
    
    return prisma.$transaction(async (tx) => {
      // 1. Create Bonus
      const bonus = await tx.bonus.create({
        data: {
          ...bonusData,
          status: 'DRAFT',
        },
      });

      // 2. Fetch employees to calculate specific amounts
      const employees = await tx.employee.findMany({
        where: { id: { in: employeeIds } },
        include: {
          salaryStructureAssignments: {
            where: { status: 'ACTIVE' },
            include: { salaryStructure: true },
            take: 1
          }
        }
      });

      // 3. Create EmployeeBonuses
      for (const employee of employees) {
        const amount = await this.calculateBonusAmountForEmployee(data, employee);
        
        await tx.employeeBonus.create({
          data: {
            bonusId: bonus.id,
            employeeId: employee.id,
            amount: amount,
          }
        });
      }

      return bonus;
    });
  }

  static async updateBonus(id: string, data: BonusFormValues) {
    const { employeeIds, ...bonusData } = data;

    return prisma.$transaction(async (tx) => {
      // 1. Update Bonus
      const bonus = await tx.bonus.update({
        where: { id },
        data: {
          ...bonusData,
        },
      });

      // 2. Delete existing EmployeeBonuses
      await tx.employeeBonus.deleteMany({
        where: { bonusId: id }
      });

      // 3. Fetch employees and re-calculate
      const employees = await tx.employee.findMany({
        where: { id: { in: employeeIds } },
        include: {
          salaryStructureAssignments: {
            where: { status: 'ACTIVE' },
            include: { salaryStructure: true },
            take: 1
          }
        }
      });

      for (const employee of employees) {
        const amount = await this.calculateBonusAmountForEmployee(data, employee);
        
        await tx.employeeBonus.create({
          data: {
            bonusId: bonus.id,
            employeeId: employee.id,
            amount: amount,
          }
        });
      }

      return bonus;
    });
  }
  
  static async updateStatus(id: string, status: BonusStatus, remarks?: string) {
    const data: Prisma.BonusUpdateInput = { status };
    
    if (remarks) {
      if (status === 'APPROVED') {
        data.remarks = remarks;
        data.hrApprovalStatus = 'APPROVED';
        data.managementDecision = 'APPROVED';
      } else if (status === 'REJECTED') {
        data.remarks = remarks;
      }
    }
    
    return prisma.bonus.update({
      where: { id },
      data,
    });
  }

  static async deleteBonus(id: string) {
    return prisma.bonus.delete({
      where: { id },
    });
  }
}
