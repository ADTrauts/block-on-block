/**
 * HR MODULE API ROUTES
 * 
 * Three-tier access structure:
 * 1. Admin routes: /hr/admin/* - Full HR management (business admins only)
 * 2. Manager routes: /hr/team/* - Team management (managers with direct reports)
 * 3. Employee routes: /hr/me/* - Self-service (all employees)
 * 4. AI routes: /hr/ai/* - AI context providers (authenticated users)
 * 
 * All routes require:
 * - Authentication (authenticateJWT)
 * - Business Advanced or Enterprise tier (checkBusinessAdvancedOrHigher)
 * - HR module installed (checkHRModuleInstalled)
 */

import express from 'express';
import multer from 'multer';
import { authenticateJWT } from '../middleware/auth';
import { 
  checkHRAdmin, 
  checkManagerAccess, 
  checkEmployeeAccess 
} from '../middleware/hrPermissions';
import {
  checkBusinessAdvancedOrHigher,
  checkHRFeature,
  checkHRModuleInstalled
} from '../middleware/hrFeatureGating';
import * as hrController from '../controllers/hrController';

// Configure multer for CSV uploads
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

const router: express.Router = express.Router();

// ============================================================================
// GLOBAL MIDDLEWARE (Applied to all HR routes)
// ============================================================================
router.use(authenticateJWT);  // Must be logged in
router.use(checkBusinessAdvancedOrHigher);  // Business Advanced or Enterprise tier
router.use(checkHRModuleInstalled);  // HR module must be installed

// ============================================================================
// ADMIN ROUTES (Business Admin Dashboard)
// Route: /api/hr/admin/*
// Access: Business owners and admins only
// ============================================================================

// Employee Management (Available on Business Advanced+)
router.get('/admin/employees', checkHRAdmin, hrController.getAdminEmployees);
router.get('/admin/employees/filter-options', checkHRAdmin, hrController.getEmployeeFilterOptions);
router.get('/admin/employees/:id', checkHRAdmin, hrController.getAdminEmployee);
router.get('/admin/employees/:id/audit-logs', checkHRAdmin, hrController.getEmployeeAuditLogs);
router.post('/admin/employees', checkHRAdmin, hrController.createEmployee);
router.put('/admin/employees/:id', checkHRAdmin, hrController.updateEmployee);
router.delete('/admin/employees/:id', checkHRAdmin, hrController.deleteEmployee);
router.post('/admin/employees/:id/terminate', checkHRAdmin, hrController.terminateEmployee);

// Time-off calendar (admin view)
router.get('/admin/time-off/calendar', checkHRAdmin, hrController.getTimeOffCalendar);

// Time-off reports (admin view)
router.get('/admin/time-off/reports', checkHRAdmin, hrController.getTimeOffReports);

// Employee Import/Export (Available on Business Advanced+)
router.post('/admin/employees/import', 
  checkHRAdmin, 
  csvUpload.single('file'),
  hrController.importEmployeesCSV
);
router.get('/admin/employees/export', checkHRAdmin, hrController.exportEmployeesCSV);

// HR Settings (Available on Business Advanced+)
router.get('/admin/settings', checkHRAdmin, hrController.getHRSettings);
router.put('/admin/settings', checkHRAdmin, hrController.updateHRSettings);

// Onboarding (Business Advanced+ pilot)
router.get(
  '/admin/onboarding/templates',
  checkHRFeature('onboarding'),
  checkHRAdmin,
  hrController.getOnboardingTemplates
);
router.post(
  '/admin/onboarding/templates',
  checkHRFeature('onboarding'),
  checkHRAdmin,
  hrController.createOnboardingTemplate
);
router.put(
  '/admin/onboarding/templates/:templateId',
  checkHRFeature('onboarding'),
  checkHRAdmin,
  hrController.updateOnboardingTemplate
);
router.delete(
  '/admin/onboarding/templates/:templateId',
  checkHRFeature('onboarding'),
  checkHRAdmin,
  hrController.deleteOnboardingTemplate
);
router.get(
  '/admin/onboarding/journeys',
  checkHRFeature('onboarding'),
  checkHRAdmin,
  hrController.getOnboardingJourneys
);
router.post(
  '/admin/onboarding/journeys/start',
  checkHRFeature('onboarding'),
  checkHRAdmin,
  hrController.startOnboardingJourney
);
router.post(
  '/admin/onboarding/tasks/:taskId/complete',
  checkHRFeature('onboarding'),
  checkHRAdmin,
  hrController.completeOnboardingTask
);

// Attendance (Phase 3 rollout)
router.get(
  '/admin/attendance/overview',
  checkHRFeature('attendance'),
  checkHRAdmin,
  hrController.getAttendanceOverview
);
router.get(
  '/admin/attendance/policies',
  checkHRFeature('attendance'),
  checkHRAdmin,
  hrController.getAttendancePolicies
);
router.post(
  '/admin/attendance/policies',
  checkHRFeature('attendance'),
  checkHRAdmin,
  hrController.createAttendancePolicy
);
router.put(
  '/admin/attendance/policies/:id',
  checkHRFeature('attendance'),
  checkHRAdmin,
  hrController.updateAttendancePolicy
);

// ============================================================================
// ENTERPRISE-ONLY ADMIN ROUTES
// Route: /api/hr/admin/*
// Access: Business admins on Enterprise tier only
// ============================================================================

// Payroll (Enterprise only)
router.get('/admin/payroll', 
  checkHRFeature('payroll'),
  checkHRAdmin, 
  (req, res) => {
    res.json({ 
      message: 'Payroll dashboard - framework stub',
      tier: req.hrTier,
      note: 'Feature implementation pending'
    });
  }
);

// Recruitment/ATS (Enterprise only)
router.get('/admin/recruitment',
  checkHRFeature('recruitment'),
  checkHRAdmin,
  (req, res) => {
    res.json({ 
      message: 'Recruitment dashboard - framework stub',
      tier: req.hrTier,
      note: 'Feature implementation pending'
    });
  }
);

// Performance Management (Enterprise only)
router.get('/admin/performance',
  checkHRFeature('performance'),
  checkHRAdmin,
  (req, res) => {
    res.json({ 
      message: 'Performance management - framework stub',
      tier: req.hrTier,
      note: 'Feature implementation pending'
    });
  }
);

// Benefits Administration (Enterprise only)
router.get('/admin/benefits',
  checkHRFeature('benefits'),
  checkHRAdmin,
  (req, res) => {
    res.json({ 
      message: 'Benefits administration - framework stub',
      tier: req.hrTier,
      note: 'Feature implementation pending'
    });
  }
);

// ============================================================================
// MANAGER ROUTES (Team Management)
// Route: /api/hr/team/*
// Access: Managers with direct reports
// ============================================================================

// View team members
router.get('/team/employees', checkManagerAccess, hrController.getTeamEmployees);

// Approve team time-off (framework stub)
router.get('/team/time-off/pending',
  checkManagerAccess,
  hrController.getPendingTeamTimeOff
);

router.post('/team/time-off/:id/approve',
  checkManagerAccess,
  hrController.approveTeamTimeOff
);

router.get(
  '/team/onboarding/tasks',
  checkHRFeature('onboarding'),
  checkManagerAccess,
  hrController.getTeamOnboardingTasks
);
router.post(
  '/team/onboarding/tasks/:taskId/complete',
  checkHRFeature('onboarding'),
  checkManagerAccess,
  hrController.completeTeamOnboardingTask
);

router.get(
  '/team/attendance/exceptions',
  checkHRFeature('attendance'),
  checkManagerAccess,
  hrController.getTeamAttendanceExceptions
);

router.post(
  '/team/attendance/exceptions/:id/resolve',
  checkHRFeature('attendance'),
  checkManagerAccess,
  hrController.resolveTeamAttendanceException
);

// Time-off calendar (admins and managers)
router.get('/team/time-off/calendar',
  checkManagerAccess,
  hrController.getTimeOffCalendar
);

// ============================================================================
// EMPLOYEE ROUTES (Self-Service)
// Route: /api/hr/me/*
// Access: All business employees
// ============================================================================

// View own HR data
router.get('/me', checkEmployeeAccess, hrController.getOwnHRData);

// Update own HR data (limited fields)
router.put('/me', checkEmployeeAccess, hrController.updateOwnHRData);

// Attendance (self-service)
router.get(
  '/me/attendance/records',
  checkHRFeature('attendance'),
  checkEmployeeAccess,
  hrController.getMyAttendanceRecords
);
router.post(
  '/me/attendance/punch-in',
  checkHRFeature('attendance.clockInOut'),
  checkEmployeeAccess,
  hrController.recordSelfAttendancePunchIn
);
router.post(
  '/me/attendance/punch-out',
  checkHRFeature('attendance.clockInOut'),
  checkEmployeeAccess,
  hrController.recordSelfAttendancePunchOut
);

// Request time off (framework stub)
router.post('/me/time-off/request',
  checkEmployeeAccess,
  hrController.requestTimeOff
);

// View own time-off balance (framework stub)
router.get('/me/time-off/balance',
  checkEmployeeAccess,
  hrController.getTimeOffBalance
);

// List own time-off requests
router.get('/me/time-off/requests',
  checkEmployeeAccess,
  hrController.getMyTimeOffRequests
);

router.post('/me/time-off/:id/cancel',
  checkEmployeeAccess,
  hrController.cancelTimeOffRequest
);

router.get(
  '/me/onboarding/journeys',
  checkHRFeature('onboarding'),
  checkEmployeeAccess,
  hrController.getMyOnboardingJourneys
);
router.post(
  '/me/onboarding/tasks/:taskId/complete',
  checkHRFeature('onboarding'),
  checkEmployeeAccess,
  hrController.completeMyOnboardingTask
);

// View own pay stubs (framework stub)
router.get('/me/pay-stubs',
  checkEmployeeAccess,
  (req, res) => {
    res.json({ 
      message: 'Pay stubs - framework stub',
      payStubs: [],
      note: 'Feature implementation pending'
    });
  }
);

// ============================================================================
// AI CONTEXT PROVIDERS (Required for AI integration)
// Route: /api/hr/ai/*
// Access: Authenticated users with HR access
// ============================================================================

router.get('/ai/context/overview', hrController.getHROverviewContext);
router.get('/ai/context/headcount', hrController.getHeadcountContext);
router.get('/ai/context/time-off', hrController.getTimeOffContext);

// ============================================================================
// HEALTH CHECK
// ============================================================================

router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    module: 'hr',
    version: '1.0.0',
    tier: req.hrTier,
    features: req.hrFeatures
  });
});

export default router;

