import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../../__tests__/helpers/app';
import { createTestAdminUser, createTestUser, createAuthHeader, cleanupTestUsers } from '../../__tests__/helpers/auth';
import type { User, ContentReport } from '@prisma/client';
import { prisma } from '../../lib/prisma';

/**
 * Integration tests for complete content moderation flows
 * These tests verify end-to-end workflows that span multiple endpoints
 */
describe('Admin Portal - Content Moderation Integration', () => {
  const app = createTestApp();
  let adminUser: User;
  let reporterUser: User;
  const userIdsToCleanup: string[] = [];
  const reportIdsToCleanup: string[] = [];

  beforeAll(async () => {
    adminUser = await createTestAdminUser();
    reporterUser = await createTestUser({
      email: `reporter-${Date.now()}@test.com`,
      name: 'Reporter User'
    });
    userIdsToCleanup.push(adminUser.id, reporterUser.id);
  });

  afterAll(async () => {
    // Clean up content reports FIRST (before users due to foreign key constraints)
    if (reportIdsToCleanup.length > 0) {
      try {
        await prisma.contentReport.deleteMany({
          where: { id: { in: reportIdsToCleanup } }
        });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    // Then clean up users (which will also clean up any remaining reports via cascade or manual cleanup)
    await cleanupTestUsers(userIdsToCleanup);
  });

  describe('Complete Content Moderation Flow', () => {
    it('should complete full moderation flow: create report, review, take action', async () => {
      // Step 1: User creates a content report (simulated via direct database creation)
      // In real flow, this would come through /api/content-reports endpoint
      const testReport = await prisma.contentReport.create({
        data: {
          reporterId: reporterUser.id,
          contentType: 'message',
          contentId: `test-content-${Date.now()}`,
          reason: 'spam',
          status: 'pending',
        }
      });
      reportIdsToCleanup.push(testReport.id);

      // Step 2: Admin views reported content
      const listResponse = await request(app)
        .get('/api/admin-portal/moderation/reported')
        .set(createAuthHeader(adminUser))
        .expect(200);

      expect(listResponse.body).toHaveProperty('reports');
      expect(Array.isArray(listResponse.body.reports)).toBe(true);

      const foundReport = listResponse.body.reports.find((r: { id: string }) => r.id === testReport.id);
      expect(foundReport).toBeDefined();
      expect(foundReport.status).toBe('pending');

      // Step 3: Admin reviews and approves the report
      const approveResponse = await request(app)
        .patch(`/api/admin-portal/moderation/reports/${testReport.id}`)
        .set(createAuthHeader(adminUser))
        .send({
          status: 'approved',
          action: 'remove',
          reason: 'Integration test approval'
        })
        .expect(200);

      expect(approveResponse.body).toHaveProperty('status', 'approved');
      expect(approveResponse.body).toHaveProperty('action', 'remove');
      expect(approveResponse.body).toHaveProperty('reviewedBy', adminUser.id);
      expect(approveResponse.body.reviewedAt).toBeDefined();

      // Step 4: Verify report is updated in database
      const updatedReport = await prisma.contentReport.findUnique({
        where: { id: testReport.id }
      });

      expect(updatedReport?.status).toBe('approved');
      expect(updatedReport?.action).toBe('remove');
      expect(updatedReport?.reviewedBy).toBe(adminUser.id);
      expect(updatedReport?.reviewedAt).not.toBeNull();
    });

    it('should handle report rejection flow', async () => {
      // Create a test report
      const testReport = await prisma.contentReport.create({
        data: {
          reporterId: reporterUser.id,
          contentType: 'post',
          contentId: `test-content-reject-${Date.now()}`,
          reason: 'inappropriate',
          status: 'pending'
        }
      });
      reportIdsToCleanup.push(testReport.id);

      // Admin rejects the report
      const rejectResponse = await request(app)
        .patch(`/api/admin-portal/moderation/reports/${testReport.id}`)
        .set(createAuthHeader(adminUser))
        .send({
          status: 'rejected',
          action: 'no_action',
          reason: 'Integration test rejection - false positive'
        })
        .expect(200);

      expect(rejectResponse.body).toHaveProperty('status', 'rejected');
      expect(rejectResponse.body).toHaveProperty('action', 'no_action');

      // Verify in database
      const rejectedReport = await prisma.contentReport.findUnique({
        where: { id: testReport.id }
      });

      expect(rejectedReport?.status).toBe('rejected');
      expect(rejectedReport?.reviewedBy).toBe(adminUser.id);
    });

    it('should filter reports by status correctly', async () => {
      // Create reports with different statuses
      const pendingReport = await prisma.contentReport.create({
        data: {
          reporterId: reporterUser.id,
          contentType: 'message',
          contentId: `test-pending-${Date.now()}`,
          reason: 'spam',
          status: 'pending',
        }
      });

      const approvedReport = await prisma.contentReport.create({
        data: {
          reporterId: reporterUser.id,
          contentType: 'message',
          contentId: `test-approved-${Date.now()}`,
          reason: 'spam',
          status: 'approved',
          action: 'remove',
          reviewedBy: adminUser.id,
          reviewedAt: new Date(),
        }
      });

      reportIdsToCleanup.push(pendingReport.id, approvedReport.id);

      // Filter by pending status
      const pendingResponse = await request(app)
        .get('/api/admin-portal/moderation/reported?status=pending')
        .set(createAuthHeader(adminUser))
        .expect(200);

      const pendingReports = pendingResponse.body.reports;
      const foundPending = pendingReports.find((r: { id: string }) => r.id === pendingReport.id);
      expect(foundPending).toBeDefined();
      expect(foundPending.status).toBe('pending');

      // Filter by approved status
      const approvedResponse = await request(app)
        .get('/api/admin-portal/moderation/reported?status=approved')
        .set(createAuthHeader(adminUser))
        .expect(200);

      const approvedReports = approvedResponse.body.reports;
      const foundApproved = approvedReports.find((r: { id: string }) => r.id === approvedReport.id);
      expect(foundApproved).toBeDefined();
      expect(foundApproved.status).toBe('approved');
    });
  });

  describe('Bulk Moderation Actions', () => {
    it('should perform bulk moderation actions on multiple reports', async () => {
      // Create multiple test reports
      const report1 = await prisma.contentReport.create({
        data: {
          reporterId: reporterUser.id,
          contentType: 'message',
          contentId: `bulk-1-${Date.now()}`,
          reason: 'spam',
          status: 'pending',
        }
      });

      const report2 = await prisma.contentReport.create({
        data: {
          reporterId: reporterUser.id,
          contentType: 'message',
          contentId: `bulk-2-${Date.now()}`,
          reason: 'spam',
          status: 'pending',
        }
      });

      const report3 = await prisma.contentReport.create({
        data: {
          reporterId: reporterUser.id,
          contentType: 'message',
          contentId: `bulk-3-${Date.now()}`,
          reason: 'spam',
          status: 'pending',
        }
      });

      reportIdsToCleanup.push(report1.id, report2.id, report3.id);

      // Perform bulk action
      const bulkResponse = await request(app)
        .post('/api/admin-portal/moderation/bulk-action')
        .set(createAuthHeader(adminUser))
        .send({
          reportIds: [report1.id, report2.id, report3.id],
          action: 'approve'
        })
        .expect(200);

      // Verify bulk action response
      expect(bulkResponse.body).toBeDefined();
      // Response structure depends on AdminService.bulkModerationAction implementation

      // Verify reports were updated
      const updatedReports = await prisma.contentReport.findMany({
        where: {
          id: { in: [report1.id, report2.id, report3.id] }
        }
      });

      // All reports should be processed (exact status depends on implementation)
      expect(updatedReports.length).toBe(3);
      // Verify they were reviewed by admin
      updatedReports.forEach(report => {
        expect(report.reviewedBy).toBe(adminUser.id);
        expect(report.reviewedAt).not.toBeNull();
      });
    });
  });

  describe('Moderation Statistics Flow', () => {
    it('should retrieve moderation statistics', async () => {
      // Create reports with different statuses for statistics
      await prisma.contentReport.create({
        data: {
          reporterId: reporterUser.id,
          contentType: 'message',
          contentId: `stats-pending-${Date.now()}`,
          reason: 'spam',
          status: 'pending',
        }
      });

      // Get moderation stats
      const statsResponse = await request(app)
        .get('/api/admin-portal/moderation/stats')
        .set(createAuthHeader(adminUser))
        .expect(200);

      expect(statsResponse.body).toBeDefined();
      // Stats structure depends on AdminService.getModerationStats implementation
    });
  });
});

