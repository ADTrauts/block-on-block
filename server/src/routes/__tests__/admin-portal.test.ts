import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../../__tests__/helpers/app';
import { createTestAdminUser, createTestUser, createAuthHeader, cleanupTestUsers } from '../../__tests__/helpers/auth';
import type { User } from '@prisma/client';

describe('Admin Portal Routes', () => {
  const app = createTestApp();
  let adminUser: User;
  let regularUser: User;
  const userIdsToCleanup: string[] = [];

  beforeAll(async () => {
    // Create test users
    adminUser = await createTestAdminUser();
    regularUser = await createTestUser();
    userIdsToCleanup.push(adminUser.id, regularUser.id);
  });

  afterAll(async () => {
    // Clean up test users
    await cleanupTestUsers(userIdsToCleanup);
  });

  describe('Authentication & Authorization', () => {
    it('should allow admin access to test endpoint', async () => {
      const response = await request(app)
        .get('/api/admin-portal/test')
        .set(createAuthHeader(adminUser))
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Admin authentication working!');
      expect(response.body.user).toHaveProperty('id', adminUser.id);
      expect(response.body.user).toHaveProperty('email', adminUser.email);
      expect(response.body.user).toHaveProperty('role', 'ADMIN');
    });

    it('should reject non-admin users', async () => {
      const response = await request(app)
        .get('/api/admin-portal/test')
        .set(createAuthHeader(regularUser))
        .expect(403);

      expect(response.body).toHaveProperty('error', 'Admin access required');
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/admin-portal/test')
        .expect(401);

      // The authenticateJWT middleware returns { message: 'Access token required' }
      expect(response.body).toHaveProperty('message', 'Access token required');
    });

    it('should reject requests with invalid token', async () => {
      // Invalid token results in 403 with message (from authenticateJWT middleware)
      const response = await request(app)
        .get('/api/admin-portal/test')
        .set({ Authorization: 'Bearer invalid-token' })
        .expect(403);

      // The authenticateJWT middleware returns { message: 'Invalid or expired token' }
      expect(response.body).toHaveProperty('message', 'Invalid or expired token');
    });
  });

  describe('Dashboard Stats', () => {
    it('should return dashboard statistics for admin', async () => {
      const response = await request(app)
        .get('/api/admin-portal/dashboard/stats')
        .set(createAuthHeader(adminUser))
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('totalUsers');
      expect(response.body.data).toHaveProperty('totalBusinesses');
      expect(response.body.data).toHaveProperty('monthlyRevenue');
      expect(response.body.data).toHaveProperty('systemHealth');
      expect(response.body.data).toHaveProperty('userGrowthTrend');
      expect(response.body.data).toHaveProperty('businessGrowthTrend');
      expect(response.body.data).toHaveProperty('revenueGrowthTrend');
      
      // Verify types
      expect(typeof response.body.data.totalUsers).toBe('number');
      expect(typeof response.body.data.totalBusinesses).toBe('number');
      expect(typeof response.body.data.monthlyRevenue).toBe('number');
      expect(typeof response.body.data.systemHealth).toBe('number');
    });

    it('should reject dashboard stats for non-admin', async () => {
      const response = await request(app)
        .get('/api/admin-portal/dashboard/stats')
        .set(createAuthHeader(regularUser))
        .expect(403);

      expect(response.body).toHaveProperty('error', 'Admin access required');
    });
  });

  describe('Dashboard Activity', () => {
    it('should return recent activity for admin', async () => {
      const response = await request(app)
        .get('/api/admin-portal/dashboard/activity')
        .set(createAuthHeader(adminUser))
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(Array.isArray(response.body.data)).toBe(true);
      
      // If there are activities, verify structure
      if (response.body.data.length > 0) {
        const activity = response.body.data[0];
        expect(activity).toHaveProperty('id');
        expect(activity).toHaveProperty('action');
        expect(activity).toHaveProperty('timestamp');
      }
    });

    it('should reject activity request for non-admin', async () => {
      const response = await request(app)
        .get('/api/admin-portal/dashboard/activity')
        .set(createAuthHeader(regularUser))
        .expect(403);

      expect(response.body).toHaveProperty('error', 'Admin access required');
    });
  });
});

