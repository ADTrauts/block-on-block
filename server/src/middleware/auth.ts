import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

// Define the authenticated user interface that matches what we set in the middleware
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  name?: string | null;
  emailVerified?: Date | null;
  image?: string | null;
  stripeCustomerId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  userNumber?: string | null;
  countryId?: string | null;
  regionId?: string | null;
  townId?: string | null;
  locationDetectedAt?: Date | null;
  locationUpdatedAt?: Date | null;
}

// Extend Express Request type to include our custom properties
// @ts-ignore - Express Request has any types in its definition
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  originalUser?: AuthenticatedUser;
  impersonation?: {
    id: string;
    adminId: string;
    targetUserId: string;
    businessId?: string | null;
    context?: string | null;
    startedAt: Date;
    expiresAt?: Date | null;
  };
}

// JWT Payload interface
interface JWTPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

// Helper function to safely get user properties
export function getUserFromRequest(req: Request): AuthenticatedUser | null {
  return (req as AuthenticatedRequest).user || null;
}

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined in the environment variables');
}

export async function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  const impersonationToken = req.headers['x-impersonation-token'] as string | undefined;

  await logger.debug('Authentication attempt', { 
    operation: 'auth_attempt',
    hasAuthHeader: !!authHeader,
    tokenLength: token?.length,
    method: req.method,
    path: req.path,
    ipAddress: req.ip
  });

  if (!token) {
    await logger.logSecurityEvent('auth_no_token', 'low', {
      operation: 'auth_missing_token',
      method: req.method,
      path: req.path,
      ipAddress: req.ip
    });
    if (process.env.NODE_ENV === 'development') {
      console.log('❌ [AUTH] No token provided:', {
        path: req.path,
        method: req.method,
        hasAuthHeader: !!authHeader
      });
    }
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    // Additional logging in development for token verification errors
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 [AUTH] Attempting to verify token:', {
        tokenLength: token.length,
        tokenPrefix: token.substring(0, 20) + '...',
        path: req.path,
        method: req.method,
        hasJWTSecret: !!JWT_SECRET,
        jwtSecretLength: JWT_SECRET?.length
      });
    }
    const decoded = jwt.verify(token, JWT_SECRET!) as JWTPayload;
    await logger.debug('JWT token decoded successfully', { 
      operation: 'auth_token_decoded',
      userId: decoded.sub,
      email: decoded.email,
      role: decoded.role
    });
    
    // Additional logging in development
    if (process.env.NODE_ENV === 'development') {
      console.log('🔐 [AUTH] Token verified successfully:', {
        userId: decoded.sub,
        email: decoded.email,
        role: decoded.role,
        path: req.path,
        method: req.method
      });
    }
    
    // Fetch full user data from database
    const userSelect = {
      id: true,
      email: true,
      role: true,
      name: true,
      emailVerified: true,
      image: true,
      stripeCustomerId: true,
      createdAt: true,
      updatedAt: true,
      userNumber: true,
      countryId: true,
      regionId: true,
      townId: true,
      locationDetectedAt: true,
      locationUpdatedAt: true
    } as const;

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: userSelect
    });
    
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    const authRequest = req as AuthenticatedRequest;
    authRequest.user = user;

    // Handle impersonation if present
    if (impersonationToken && user.role === 'ADMIN') {
      const impersonationTokenHash = crypto.createHash('sha256').update(impersonationToken).digest('hex');

      const impersonation = await prisma.adminImpersonation.findFirst({
        where: {
          adminId: user.id,
          endedAt: null,
          sessionTokenHash: impersonationTokenHash
        },
        include: {
          targetUser: {
            select: userSelect
          }
        }
      });

      if (impersonation) {
        const now = new Date();
        if (impersonation.expiresAt && impersonation.expiresAt < now) {
          await prisma.adminImpersonation.update({
            where: { id: impersonation.id },
            data: {
              endedAt: now,
              sessionTokenHash: null
            }
          });
          await logger.warn('Impersonation token expired', {
            operation: 'auth_impersonation_expired',
            adminId: user.id,
            impersonationId: impersonation.id
          });
        } else if (impersonation.targetUser) {
          await logger.debug('Applying impersonation context', {
            operation: 'auth_impersonation_applied',
            adminId: user.id,
            impersonatedUserId: impersonation.targetUserId,
            impersonationId: impersonation.id,
            businessId: impersonation.businessId ?? undefined,
            impersonationContext: impersonation.context ?? undefined
          });

          authRequest.originalUser = user;
          authRequest.user = impersonation.targetUser;
          authRequest.impersonation = {
            id: impersonation.id,
            adminId: user.id,
            targetUserId: impersonation.targetUserId,
            businessId: impersonation.businessId ?? undefined,
            context: impersonation.context ?? undefined,
            startedAt: impersonation.startedAt,
            expiresAt: impersonation.expiresAt ?? undefined
          };
        }
      }
    }
    
    next();
  } catch (error) {
    await logger.logSecurityEvent('auth_token_verification_failed', 'medium', {
      operation: 'auth_token_verify_failed',
      method: req.method,
      path: req.path,
      ipAddress: req.ip,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
}

/**
 * Middleware to require a specific role
 * Must be used after authenticateJWT
 */
export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;
    
    if (!user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    if (user.role !== role) {
      return res.status(403).json({ message: `Access denied. ${role} role required.` });
    }
    
    next();
  };
} 