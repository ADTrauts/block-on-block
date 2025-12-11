import express from 'express';
import { authenticateJWT } from '../middleware/auth';
import { checkSchedulingModuleInstalled } from '../middleware/schedulingFeatureGating';
import {
  checkSchedulingAdmin,
  checkSchedulingManagerAccess,
  checkSchedulingEmployeeAccess,
  checkSchedulingSelfAccess
} from '../middleware/schedulingPermissions';
import * as schedulingController from '../controllers/schedulingController';
import { asyncHandler } from '../index';

const router: express.Router = express.Router();

// Debug logging for ALL requests BEFORE any middleware
router.use((req, res, next) => {
  console.log('🔍 [SCHEDULING ROUTER] ALL requests - BEFORE middleware', {
    method: req.method,
    path: req.path,
    url: req.url,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    query: req.query,
    hasBody: !!req.body,
    bodyKeys: req.body ? Object.keys(req.body) : []
  });
  next();
});

// Apply base middleware for all scheduling routes
router.use(authenticateJWT);
router.use(checkSchedulingModuleInstalled);

// Debug logging for all scheduling routes AFTER middleware
router.use((req, res, next) => {
  if (req.method === 'POST' && (req.path.includes('/me/availability') || req.url.includes('/me/availability'))) {
    console.log('🔍 [SCHEDULING ROUTER] POST /me/availability request received', {
      method: req.method,
      path: req.path,
      url: req.url,
      originalUrl: req.originalUrl,
      baseUrl: req.baseUrl,
      query: req.query,
      hasBody: !!req.body,
      bodyKeys: req.body ? Object.keys(req.body) : [],
      businessId: req.query.businessId || req.body?.businessId,
      hasUser: !!req.user,
      userId: req.user?.id
    });
  }
  next();
});

// ============================================================================
// ADMIN ROUTES
// Access: Business owners and admins
// ============================================================================

// Schedules
router.get('/admin/schedules', checkSchedulingAdmin, schedulingController.getSchedules);
router.post('/admin/schedules', checkSchedulingAdmin, schedulingController.createSchedule);
router.get('/admin/schedules/:id', checkSchedulingAdmin, schedulingController.getScheduleById);
router.put('/admin/schedules/:id', checkSchedulingAdmin, schedulingController.updateSchedule);
router.delete('/admin/schedules/:id', checkSchedulingAdmin, schedulingController.deleteSchedule);
router.post('/admin/schedules/:id/publish', checkSchedulingAdmin, schedulingController.publishSchedule);

// Shifts
router.get('/admin/shifts', checkSchedulingAdmin, schedulingController.getShifts);
router.post('/admin/shifts', checkSchedulingAdmin, schedulingController.createShift);
router.get('/admin/shifts/:id', checkSchedulingAdmin, schedulingController.getShiftById);
router.put('/admin/shifts/:id', checkSchedulingAdmin, schedulingController.updateShift);
router.delete('/admin/shifts/:id', checkSchedulingAdmin, schedulingController.deleteShift);

// Shift Templates
router.get('/admin/templates', checkSchedulingAdmin, schedulingController.getShiftTemplates);
router.post('/admin/templates', checkSchedulingAdmin, schedulingController.createShiftTemplate);
router.get('/admin/templates/:id', checkSchedulingAdmin, schedulingController.getShiftTemplateById);
router.put('/admin/templates/:id', checkSchedulingAdmin, schedulingController.updateShiftTemplate);
router.delete('/admin/templates/:id', checkSchedulingAdmin, schedulingController.deleteShiftTemplate);

// Schedule Templates
router.get('/admin/schedule-templates', checkSchedulingAdmin, schedulingController.getScheduleTemplates);
router.post('/admin/schedule-templates', checkSchedulingAdmin, schedulingController.createScheduleTemplate);
router.get('/admin/schedule-templates/:id', checkSchedulingAdmin, schedulingController.getScheduleTemplateById);
router.put('/admin/schedule-templates/:id', checkSchedulingAdmin, schedulingController.updateScheduleTemplate);
router.delete('/admin/schedule-templates/:id', checkSchedulingAdmin, schedulingController.deleteScheduleTemplate);

// Employee Availability (Admin view all)
router.get('/admin/availability', checkSchedulingAdmin, schedulingController.getAllEmployeeAvailability);
router.put('/admin/availability/:id', checkSchedulingAdmin, schedulingController.updateEmployeeAvailabilityAdmin);

// Shift Swap Requests (Admin view all and manage)
router.get('/admin/swaps', checkSchedulingAdmin, schedulingController.getAllShiftSwapRequests);
router.put('/admin/swaps/:id/approve', checkSchedulingAdmin, schedulingController.approveShiftSwapAdmin);
router.put('/admin/swaps/:id/deny', checkSchedulingAdmin, schedulingController.denyShiftSwapAdmin);

// Business Stations
router.get('/admin/stations', checkSchedulingAdmin, schedulingController.getBusinessStations);
router.post('/admin/stations', checkSchedulingAdmin, schedulingController.createBusinessStation);
router.get('/admin/stations/:id', checkSchedulingAdmin, schedulingController.getBusinessStationById);
router.put('/admin/stations/:id', checkSchedulingAdmin, schedulingController.updateBusinessStation);
router.delete('/admin/stations/:id', checkSchedulingAdmin, schedulingController.deleteBusinessStation);

// Job Locations
router.get('/admin/job-locations', checkSchedulingAdmin, schedulingController.getBusinessJobLocations);
router.post('/admin/job-locations', checkSchedulingAdmin, schedulingController.createBusinessJobLocation);
router.put('/admin/job-locations/:id', checkSchedulingAdmin, schedulingController.updateBusinessJobLocation);
router.delete('/admin/job-locations/:id', checkSchedulingAdmin, schedulingController.deleteBusinessJobLocation);

// Recommendations
router.get('/recommendations', checkSchedulingAdmin, schedulingController.getSchedulingRecommendations);

// ============================================================================
// AI-POWERED SCHEDULING
// ============================================================================

// AI Schedule Generation
router.post('/ai/generate-schedule', checkSchedulingAdmin, schedulingController.generateAISchedule);
router.post('/ai/suggest-assignments', checkSchedulingAdmin, schedulingController.suggestShiftAssignments);

// ============================================================================
// MANAGER ROUTES
// Access: Managers with direct reports
// ============================================================================

// Team Schedules
router.get('/team/schedules', checkSchedulingManagerAccess, schedulingController.getTeamSchedules);
router.post('/team/schedules/:id/publish', checkSchedulingManagerAccess, schedulingController.publishTeamSchedule);

// Team Shifts
router.get('/team/shifts/open', checkSchedulingManagerAccess, schedulingController.getOpenShiftsForTeam);
router.post('/team/shifts/:id/assign', checkSchedulingManagerAccess, schedulingController.assignEmployeeToShift);

// Team Availability
router.get('/team/availability', checkSchedulingManagerAccess, schedulingController.getTeamAvailability);

// Shift Swap Requests (Manager approvals)
router.get('/team/swaps/pending', checkSchedulingManagerAccess, schedulingController.getPendingShiftSwapRequestsForTeam);
router.put('/team/swaps/:id/approve', checkSchedulingManagerAccess, schedulingController.approveShiftSwapManager);
router.put('/team/swaps/:id/deny', checkSchedulingManagerAccess, schedulingController.denyShiftSwapManager);

// ============================================================================
// EMPLOYEE ROUTES
// Access: All business employees
// ============================================================================

// Own Schedule
router.get('/me/schedule', checkSchedulingEmployeeAccess, checkSchedulingSelfAccess, schedulingController.getOwnSchedule);

// Own Availability
// IMPORTANT: POST must be before GET to ensure proper matching in some Express configurations
router.post('/me/availability', 
  // Debug middleware - logs when route matches
  (req, res, next) => {
    console.log('✅ [ROUTE MATCH] POST /me/availability route handler matched!', {
      method: req.method,
      path: req.path,
      url: req.url,
      originalUrl: req.originalUrl,
      baseUrl: req.baseUrl,
      query: req.query,
      hasBody: !!req.body,
      businessId: req.query.businessId || req.body?.businessId,
      hasUser: !!req.user,
      userId: req.user?.id
    });
    next();
  },
  // Permission middleware
  checkSchedulingEmployeeAccess,
  checkSchedulingSelfAccess,
  // Controller - wrapped in asyncHandler for proper error handling
  asyncHandler(schedulingController.setOwnAvailability)
);
router.get('/me/availability', checkSchedulingEmployeeAccess, checkSchedulingSelfAccess, schedulingController.getOwnAvailability);
router.put('/me/availability/:id', checkSchedulingEmployeeAccess, checkSchedulingSelfAccess, schedulingController.updateOwnAvailability);
router.delete('/me/availability/:id', checkSchedulingEmployeeAccess, checkSchedulingSelfAccess, schedulingController.deleteOwnAvailability);

// Shift Swaps
router.post('/me/shifts/:id/swap/request', checkSchedulingEmployeeAccess, checkSchedulingSelfAccess, schedulingController.requestShiftSwap);
router.get('/me/swaps', checkSchedulingEmployeeAccess, checkSchedulingSelfAccess, schedulingController.getOwnShiftSwapRequests);
router.post('/me/swap-requests/:id/cancel', checkSchedulingEmployeeAccess, checkSchedulingSelfAccess, schedulingController.cancelSwapRequest);

// Claim Open Shifts
router.get('/me/open-shifts', checkSchedulingEmployeeAccess, checkSchedulingSelfAccess, schedulingController.getOwnOpenShifts);
router.post('/me/shifts/:id/claim', checkSchedulingEmployeeAccess, checkSchedulingSelfAccess, schedulingController.claimOpenShift);

// ============================================================================
// AI CONTEXT ROUTES
// Access: Authenticated users with Scheduling access
// ============================================================================

router.get('/ai/context/overview', checkSchedulingEmployeeAccess, schedulingController.getSchedulingOverviewForAI);
router.get('/ai/context/coverage', checkSchedulingEmployeeAccess, schedulingController.getCoverageStatusForAI);
router.get('/ai/context/conflicts', checkSchedulingEmployeeAccess, schedulingController.getSchedulingConflictsForAI);

// Log all registered routes on module load - ALWAYS log in development
console.log('✅ Scheduling routes registered on startup:', {
  postAvailability: 'POST /me/availability',
  getAvailability: 'GET /me/availability',
  putAvailability: 'PUT /me/availability/:id',
  deleteAvailability: 'DELETE /me/availability/:id',
  totalRoutes: router.stack?.length || 0,
  hasPostRoute: router.stack.some((layer: any) => 
    layer.route?.methods?.post && layer.route?.path === '/me/availability'
  )
});

export default router;
