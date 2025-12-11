/**
 * HR AI Context Provider Controller
 * 
 * Provides context data about HR system to the AI.
 * These endpoints are called by the CrossModuleContextEngine when processing AI queries.
 */

import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

/**
 * GET /api/hr/ai/context/overview
 * 
 * Returns HR system overview and statistics
 * Used by AI to understand overall HR metrics and status
 */
export async function getHROverviewContext(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id || (req as any).user?.sub;
    const { businessId } = req.query;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    if (!businessId || typeof businessId !== 'string') {
      return res.status(400).json({ 
        success: false, 
        message: 'businessId is required' 
      });
    }

    // Verify user has access to this business
    const member = await prisma.businessMember.findUnique({
      where: {
        businessId_userId: {
          businessId,
          userId,
        },
      },
    });

    if (!member || !member.isActive) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied to this business' 
      });
    }

    // Get employee counts
    const [
      totalEmployees,
      activeEmployees,
      fullTimeCount,
      partTimeCount,
      contractCount
    ] = await Promise.all([
      prisma.employeeHRProfile.count({
        where: { businessId }
      }),
      prisma.employeeHRProfile.count({
        where: { 
          businessId,
          terminationDate: null
        }
      }),
      prisma.employeeHRProfile.count({
        where: { 
          businessId,
          employeeType: 'FULL_TIME',
          terminationDate: null
        }
      }),
      prisma.employeeHRProfile.count({
        where: { 
          businessId,
          employeeType: 'PART_TIME',
          terminationDate: null
        }
      }),
      prisma.employeeHRProfile.count({
        where: { 
          businessId,
          employeeType: 'CONTRACT',
          terminationDate: null
        }
      })
    ]);

    // Get recent hires (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentHires = await prisma.employeeHRProfile.count({
      where: {
        businessId,
        hireDate: {
          gte: thirtyDaysAgo
        }
      }
    });

    // Get time-off stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      employeesOffToday,
      pendingTimeOffRequests
    ] = await Promise.all([
      prisma.timeOffRequest.count({
        where: {
          businessId,
          status: 'APPROVED',
          startDate: { lte: today },
          endDate: { gte: today }
        }
      }),
      prisma.timeOffRequest.count({
        where: {
          businessId,
          status: 'PENDING'
        }
      })
    ]);

    // Format for AI consumption
    const context = {
      employees: {
        total: totalEmployees,
        active: activeEmployees,
        terminated: totalEmployees - activeEmployees,
        byType: {
          fullTime: fullTimeCount,
          partTime: partTimeCount,
          contract: contractCount,
          other: activeEmployees - fullTimeCount - partTimeCount - contractCount
        },
        recentHires: {
          count: recentHires,
          period: 'last 30 days'
        }
      },
      timeOff: {
        employeesOffToday,
        pendingRequests: pendingTimeOffRequests,
        status: employeesOffToday === 0 ? 'full-staff' : 
                employeesOffToday > 5 ? 'low-staff' : 
                'normal'
      },
      summary: {
        headcount: activeEmployees,
        staffingLevel: employeesOffToday === 0 ? '100%' : 
                       `${Math.round((activeEmployees - employeesOffToday) / activeEmployees * 100)}%`,
        hasPendingActions: pendingTimeOffRequests > 0
      }
    };
    
    res.json({
      success: true,
      context,
      metadata: {
        provider: 'hr',
        endpoint: 'overview',
        businessId,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error in getHROverviewContext:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch HR overview context',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * GET /api/hr/ai/context/headcount
 * 
 * Returns employee headcount breakdown by department/position
 * Used by AI to answer "how many employees" questions
 */
export async function getEmployeeHeadcountContext(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id || (req as any).user?.sub;
    const { businessId } = req.query;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    if (!businessId || typeof businessId !== 'string') {
      return res.status(400).json({ 
        success: false, 
        message: 'businessId is required' 
      });
    }

    // Verify access
    const member = await prisma.businessMember.findUnique({
      where: {
        businessId_userId: {
          businessId,
          userId,
        },
      },
    });

    if (!member || !member.isActive) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    // Get employee positions with department info
    const employees = await prisma.employeePosition.findMany({
      where: {
        businessId,
        active: true
      },
      include: {
        position: {
          select: {
            title: true,
            department: {
              select: {
                name: true
              }
            }
          }
        },
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    // Group by department
    const byDepartment = new Map<string, number>();
    const byPosition = new Map<string, number>();

    employees.forEach(emp => {
      const deptName = emp.position?.department?.name || 'Unassigned';
      const posTitle = emp.position?.title || 'Unassigned';

      byDepartment.set(deptName, (byDepartment.get(deptName) || 0) + 1);
      byPosition.set(posTitle, (byPosition.get(posTitle) || 0) + 1);
    });

    // Format for AI consumption
    const context = {
      headcount: {
        total: employees.length,
        byDepartment: Array.from(byDepartment.entries())
          .map(([name, count]) => ({ department: name, count }))
          .sort((a, b) => b.count - a.count),
        byPosition: Array.from(byPosition.entries())
          .map(([title, count]) => ({ position: title, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10), // Top 10 positions
        largestDepartment: {
          name: Array.from(byDepartment.entries()).sort((a, b) => b[1] - a[1])[0]?.[0],
          count: Array.from(byDepartment.entries()).sort((a, b) => b[1] - a[1])[0]?.[1]
        }
      },
      summary: {
        totalEmployees: employees.length,
        departmentCount: byDepartment.size,
        positionCount: byPosition.size,
        averagePerDepartment: Math.round(employees.length / byDepartment.size)
      }
    };
    
    res.json({
      success: true,
      context,
      metadata: {
        provider: 'hr',
        endpoint: 'headcount',
        businessId,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error in getEmployeeHeadcountContext:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch headcount context',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * GET /api/hr/ai/context/time-off
 * 
 * Returns time-off summary (who's off today/this week)
 * Used by AI to answer "who's off" questions
 */
export async function getTimeOffSummaryContext(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id || (req as any).user?.sub;
    const { businessId } = req.query;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    if (!businessId || typeof businessId !== 'string') {
      return res.status(400).json({ 
        success: false, 
        message: 'businessId is required' 
      });
    }

    // Verify access
    const member = await prisma.businessMember.findUnique({
      where: {
        businessId_userId: {
          businessId,
          userId,
        },
      },
    });

    if (!member || !member.isActive) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get this week's date range (Sunday to Saturday)
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    // Get time-off requests
    const [
      offToday,
      offThisWeek,
      pendingRequests
    ] = await Promise.all([
      prisma.timeOffRequest.findMany({
        where: {
          businessId,
          status: 'APPROVED',
          startDate: { lte: today },
          endDate: { gte: today }
        },
        include: {
          employeePosition: {
            include: {
              user: {
                select: {
                  name: true,
                  email: true
                }
              },
              position: {
                select: {
                  title: true
                }
              }
            }
          }
        }
      }),
      prisma.timeOffRequest.findMany({
        where: {
          businessId,
          status: 'APPROVED',
          startDate: { lt: weekEnd },
          endDate: { gte: weekStart }
        },
        include: {
          employeePosition: {
            include: {
              user: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      }),
      prisma.timeOffRequest.findMany({
        where: {
          businessId,
          status: 'PENDING'
        },
        include: {
          employeePosition: {
            include: {
              user: {
                select: {
                  name: true
                }
              }
            }
          }
        },
        take: 5
      })
    ]);

    // Format for AI consumption
    const context = {
      today: {
        date: today.toISOString().split('T')[0],
        employeesOff: offToday.map(req => ({
          employeeName: req.employeePosition?.user?.name || 'Unknown',
          position: req.employeePosition?.position?.title || 'Unknown',
          type: req.type,
          startDate: req.startDate.toISOString().split('T')[0],
          endDate: req.endDate.toISOString().split('T')[0]
        })),
        count: offToday.length
      },
      thisWeek: {
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0],
        totalRequests: offThisWeek.length,
        uniqueEmployees: new Set(offThisWeek.map(r => r.employeePositionId)).size,
        byDay: groupTimeOffByDay(offThisWeek, weekStart, weekEnd)
      },
      pending: {
        count: pendingRequests.length,
        requests: pendingRequests.map(req => ({
          employeeName: req.employeePosition?.user?.name || 'Unknown',
          type: req.type,
          startDate: req.startDate.toISOString().split('T')[0],
          endDate: req.endDate.toISOString().split('T')[0],
          requestedAt: req.createdAt.toISOString()
        }))
      },
      summary: {
        offToday: offToday.length,
        offThisWeek: new Set(offThisWeek.map(r => r.employeePositionId)).size,
        pendingApprovals: pendingRequests.length,
        status: offToday.length === 0 ? 'full-staff' : 
                offToday.length > 5 ? 'low-staff' : 'normal',
        requiresAction: pendingRequests.length > 0
      }
    };
    
    res.json({
      success: true,
      context,
      metadata: {
        provider: 'hr',
        endpoint: 'timeOff',
        businessId,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error in getTimeOffSummaryContext:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch time-off summary context',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Helper function to group time-off requests by day
function groupTimeOffByDay(requests: any[], weekStart: Date, weekEnd: Date): any[] {
  const byDay: any[] = [];
  const currentDate = new Date(weekStart);
  
  while (currentDate < weekEnd) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const count = requests.filter(req => {
      const start = new Date(req.startDate);
      const end = new Date(req.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      const checkDate = new Date(currentDate);
      checkDate.setHours(0, 0, 0, 0);
      return checkDate >= start && checkDate <= end;
    }).length;
    
    byDay.push({
      date: dateStr,
      dayOfWeek: currentDate.toLocaleDateString('en-US', { weekday: 'short' }),
      employeesOff: count
    });
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return byDay;
}

