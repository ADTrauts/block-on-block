/**
 * HR MODULE PERMISSION MIDDLEWARE
 * 
 * Handles permission checks for HR module access
 * Three levels of access:
 * 1. HR Admin - Full access to all HR features
 * 2. Manager - Team-level access
 * 3. Employee - Self-service only
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

// Extend Express Request to include HR-specific data
declare global {
  namespace Express {
    interface Request {
      hrTier?: string;
      hrFeatures?: Record<string, unknown>;
    }
  }
}

/**
 * Check if user has HR admin access in the business
 * HR admin can manage all employees and access all HR features
 */
export async function checkHRAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = req.user;
    // Validate businessId from query or body
    const businessIdParam = req.query.businessId;
    const businessIdBody = req.body?.businessId;
    
    let businessId: string | undefined;
    if (businessIdParam) {
      if (typeof businessIdParam !== 'string') {
        return res.status(400).json({ error: 'businessId query parameter must be a string' });
      }
      businessId = businessIdParam;
    } else if (businessIdBody) {
      if (typeof businessIdBody !== 'string') {
        return res.status(400).json({ error: 'businessId body parameter must be a string' });
      }
      businessId = businessIdBody;
    }
    
    if (!user || !businessId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Check if user is business owner or has HR admin role
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { 
        members: {
          where: { userId: user.id, isActive: true }
        }
      }
    });
    
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }
    
    const member = business.members[0];
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this business' });
    }
    
    // Business owners and admins have HR admin access
    const isOwnerOrAdmin = member.role === 'ADMIN' || member.role === 'MANAGER';
    
    if (!isOwnerOrAdmin) {
      // TODO: Check for explicit hr:admin permission in org chart
      // For now, only owners and admins have HR access
      return res.status(403).json({ 
        error: 'HR admin access required',
        message: 'Only business owners and admins can access HR administration'
      });
    }
    
    next();
  } catch (error) {
    console.error('HR admin permission check error:', error);
    return res.status(500).json({ error: 'Permission check failed' });
  }
}

/**
 * Check if user has manager access (can view/manage team)
 * Managers can see their direct reports' HR data
 */
export async function checkManagerAccess(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = req.user;
    // Validate businessId from query or body
    const businessIdParam = req.query.businessId;
    const businessIdBody = req.body?.businessId;
    
    let businessId: string | undefined;
    if (businessIdParam) {
      if (typeof businessIdParam !== 'string') {
        return res.status(400).json({ error: 'businessId query parameter must be a string' });
      }
      businessId = businessIdParam;
    } else if (businessIdBody) {
      if (typeof businessIdBody !== 'string') {
        return res.status(400).json({ error: 'businessId body parameter must be a string' });
      }
      businessId = businessIdBody;
    }
    
    if (!user || !businessId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Check if user has any direct reports (is a manager)
    const employeePosition = await prisma.employeePosition.findFirst({
      where: {
        userId: user.id,
        businessId,
        active: true
      },
      include: {
        position: {
          include: {
            directReports: true  // Positions that report to this position
          }
        }
      }
    });
    
    if (!employeePosition) {
      return res.status(403).json({ 
        error: 'Not assigned to a position in this business' 
      });
    }
    
    const hasDirectReports = employeePosition.position.directReports.length > 0;
    
    if (!hasDirectReports) {
      return res.status(403).json({ 
        error: 'Manager access required',
        message: 'You must have direct reports to access team HR features'
      });
    }
    
    // TODO: Check for explicit hr:team:view permission
    
    next();
  } catch (error) {
    console.error('Manager access check error:', error);
    return res.status(500).json({ error: 'Permission check failed' });
  }
}

/**
 * Check if user has employee self-service access
 * All business members can view their own HR data
 */
export async function checkEmployeeAccess(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = req.user;
    // Validate businessId from query or body
    const businessIdParam = req.query.businessId;
    const businessIdBody = req.body?.businessId;
    
    let businessId: string | undefined;
    if (businessIdParam) {
      if (typeof businessIdParam !== 'string') {
        return res.status(400).json({ error: 'businessId query parameter must be a string' });
      }
      businessId = businessIdParam;
    } else if (businessIdBody) {
      if (typeof businessIdBody !== 'string') {
        return res.status(400).json({ error: 'businessId body parameter must be a string' });
      }
      businessId = businessIdBody;
    }
    
    if (!user || !businessId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Check if user is a member of the business
    const member = await prisma.businessMember.findFirst({
      where: {
        userId: user.id,
        businessId,
        isActive: true
      }
    });
    
    if (!member) {
      return res.status(403).json({ 
        error: 'Not a member of this business' 
      });
    }
    
    next();
  } catch (error) {
    console.error('Employee access check error:', error);
    return res.status(500).json({ error: 'Permission check failed' });
  }
}

/**
 * Helper: Get user's HR access level for a business
 * Returns: 'admin' | 'manager' | 'employee' | null
 */
export async function getHRAccessLevel(
  userId: string,
  businessId: string
): Promise<'admin' | 'manager' | 'employee' | null> {
  try {
    // Check business membership
    const member = await prisma.businessMember.findFirst({
      where: { userId, businessId, isActive: true }
    });
    
    if (!member) {
      return null;
    }
    
    // Admins and managers are HR admins
    if (member.role === 'ADMIN') {
      return 'admin';
    }
    
    // Check if user is a manager (has direct reports)
    const employeePosition = await prisma.employeePosition.findFirst({
      where: { userId, businessId, active: true },
      include: {
        position: {
          include: { directReports: true }
        }
      }
    });
    
    if (employeePosition && employeePosition.position.directReports.length > 0) {
      return 'manager';
    }
    
    // Default: employee access
    return 'employee';
  } catch (error) {
    console.error('Error getting HR access level:', error);
    return null;
  }
}

