import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, Role } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import bcrypt from 'bcrypt';

/**
 * Create a test admin user in the database
 */
export async function createTestAdminUser(overrides?: Partial<User>): Promise<User> {
  const hashedPassword = await bcrypt.hash('test-password-123', 10);
  // Use crypto.randomUUID() for truly unique emails to avoid collisions in parallel tests
  const uniqueId = crypto.randomUUID();
  
  return await prisma.user.create({
    data: {
      email: overrides?.email || `admin-test-${uniqueId}@test.com`,
      password: hashedPassword,
      name: 'Test Admin',
      role: 'ADMIN',
      emailVerified: new Date(),
      ...overrides,
    },
  });
}

/**
 * Create a test regular user in the database
 */
export async function createTestUser(overrides?: Partial<User>): Promise<User> {
  const hashedPassword = await bcrypt.hash('test-password-123', 10);
  // Use crypto.randomUUID() for truly unique emails to avoid collisions in parallel tests
  const uniqueId = crypto.randomUUID();
  
  return await prisma.user.create({
    data: {
      email: overrides?.email || `user-test-${uniqueId}@test.com`,
      password: hashedPassword,
      name: 'Test User',
      role: 'USER',
      emailVerified: new Date(),
      ...overrides,
    },
  });
}

/**
 * Generate a JWT token for a user
 * Note: JWT payload uses 'sub' for user ID to match authenticateJWT middleware
 */
export function generateJWTToken(user: User): string {
  const jwtSecret = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only';
  
  return jwt.sign(
    {
      sub: user.id, // JWT standard uses 'sub' for subject (user ID)
      email: user.email,
      role: user.role,
    },
    jwtSecret,
    { expiresIn: '1h' }
  );
}

/**
 * Create an authenticated request header with JWT token
 */
export function createAuthHeader(user: User): { Authorization: string } {
  const token = generateJWTToken(user);
  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Clean up test users
 * Note: Must clean up related records first due to foreign key constraints
 */
export async function cleanupTestUsers(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;

  try {
    // Clean up related records first
    await prisma.auditLog.deleteMany({
      where: { userId: { in: userIds } }
    });
    
    await prisma.adminImpersonation.deleteMany({
      where: {
        OR: [
          { adminId: { in: userIds } },
          { targetUserId: { in: userIds } }
        ]
      }
    });

    // Then delete users
    await prisma.user.deleteMany({
      where: {
        id: { in: userIds },
      },
    });
  } catch (error) {
    // Log but don't throw - cleanup failures shouldn't break tests
    console.warn('Cleanup warning:', error);
  }
}

