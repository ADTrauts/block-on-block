import express from 'express';
import { authenticateJWT } from '../middleware/auth';
import orgChartService from '../services/orgChartService';
import permissionService from '../services/permissionService';
import employeeManagementService from '../services/employeeManagementService';

const router: express.Router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateJWT);

// ============================================================================
// ORGANIZATIONAL TIERS
// ============================================================================

/**
 * GET /api/org-chart/tiers
 * Get all organizational tiers for a business
 */
router.get('/tiers/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    const tiers = await orgChartService.getOrganizationalTiers(businessId);
    res.json(tiers);
  } catch (error) {
    console.error('Error fetching organizational tiers:', error);
    res.status(500).json({ error: 'Failed to fetch organizational tiers' });
  }
});

/**
 * POST /api/org-chart/tiers
 * Create a new organizational tier
 */
router.post('/tiers', async (req, res) => {
  try {
    const tierData = req.body;
    const tier = await orgChartService.createOrganizationalTier(tierData);
    res.status(201).json(tier);
  } catch (error) {
    console.error('Error creating organizational tier:', error);
    res.status(500).json({ error: 'Failed to create organizational tier' });
  }
});

/**
 * PUT /api/org-chart/tiers/:id
 * Update an organizational tier
 */
router.put('/tiers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const tier = await orgChartService.updateOrganizationalTier(id, updateData);
    res.json(tier);
  } catch (error) {
    console.error('Error updating organizational tier:', error);
    res.status(500).json({ error: 'Failed to update organizational tier' });
  }
});

/**
 * DELETE /api/org-chart/tiers/:id
 * Delete an organizational tier
 */
router.delete('/tiers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await orgChartService.deleteOrganizationalTier(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting organizational tier:', error);
    res.status(500).json({ error: 'Failed to delete organizational tier' });
  }
});

// ============================================================================
// DEPARTMENTS
// ============================================================================

/**
 * GET /api/org-chart/departments
 * Get all departments for a business
 */
router.get('/departments/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    const { hierarchy } = req.query;
    
    if (hierarchy === 'true') {
      const departments = await orgChartService.getDepartmentHierarchy(businessId);
      res.json(departments);
    } else {
      const departments = await orgChartService.getDepartments(businessId);
      res.json(departments);
    }
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

/**
 * POST /api/org-chart/departments
 * Create a new department
 */
router.post('/departments', async (req, res) => {
  try {
    const departmentData = req.body;
    const department = await orgChartService.createDepartment(departmentData);
    res.status(201).json(department);
  } catch (error) {
    console.error('Error creating department:', error);
    res.status(500).json({ error: 'Failed to create department' });
  }
});

/**
 * PUT /api/org-chart/departments/:id
 * Update a department
 */
router.put('/departments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const department = await orgChartService.updateDepartment(id, updateData);
    res.json(department);
  } catch (error) {
    console.error('Error updating department:', error);
    res.status(500).json({ error: 'Failed to update department' });
  }
});

/**
 * DELETE /api/org-chart/departments/:id
 * Delete a department
 */
router.delete('/departments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await orgChartService.deleteDepartment(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting department:', error);
    res.status(500).json({ error: 'Failed to delete department' });
  }
});

// ============================================================================
// POSITIONS
// ============================================================================

/**
 * GET /api/org-chart/positions
 * Get all positions for a business
 */
router.get('/positions/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    const { hierarchy } = req.query;
    
    if (hierarchy === 'true') {
      const positions = await orgChartService.getPositionHierarchy(businessId);
      res.json(positions);
    } else {
      const positions = await orgChartService.getPositions(businessId);
      res.json(positions);
    }
  } catch (error) {
    console.error('Error fetching positions:', error);
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

/**
 * POST /api/org-chart/positions
 * Create a new position
 */
router.post('/positions', async (req, res) => {
  try {
    const positionData = req.body;
    const position = await orgChartService.createPosition(positionData);
    res.status(201).json(position);
  } catch (error) {
    console.error('Error creating position:', error);
    res.status(500).json({ error: 'Failed to create position' });
  }
});

/**
 * PUT /api/org-chart/positions/:id
 * Update a position
 */
router.put('/positions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const position = await orgChartService.updatePosition(id, updateData);
    res.json(position);
  } catch (error) {
    console.error('Error updating position:', error);
    res.status(500).json({ error: 'Failed to update position' });
  }
});

/**
 * DELETE /api/org-chart/positions/:id
 * Delete a position
 */
router.delete('/positions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await orgChartService.deletePosition(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting position:', error);
    res.status(500).json({ error: 'Failed to delete position' });
  }
});

// ============================================================================
// COMPLETE ORG CHART STRUCTURE
// ============================================================================

/**
 * GET /api/org-chart/structure/:businessId
 * Get complete org chart structure for a business
 */
router.get('/structure/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    
    if (!businessId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Business ID is required' 
      });
    }
    
    const structure = await orgChartService.getOrgChartStructure(businessId);
    
    // Transform the response to match frontend expectations
    const response = {
      success: true,
      data: {
        tiers: structure.tiers,
        departments: structure.departments,
        positions: structure.positions,
        hierarchy: {
          departments: structure.departments,
          positions: structure.positions
        }
      }
    };
    
    res.json(response);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error fetching org chart structure:', {
      error: err.message,
      stack: err.stack,
      businessId: req.params.businessId
    });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch org chart structure',
      message: err.message
    });
  }
});

/**
 * POST /api/org-chart/structure/:businessId/default
 * Create default org chart structure for a new business
 */
router.post('/structure/:businessId/default', async (req, res) => {
  try {
    const { businessId } = req.params;
    const { industry } = req.body;
    
    if (!businessId) {
      return res.status(400).json({ error: 'Business ID is required' });
    }
    
    await orgChartService.createDefaultOrgChart(businessId, industry);
    res.status(201).json({ 
      success: true,
      message: 'Default org chart structure created successfully' 
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error creating default org chart structure:', {
      businessId: req.params.businessId,
      error: err.message,
      stack: err.stack,
    });
    
    // Provide more specific error messages
    if (err.message.includes('not found')) {
      return res.status(404).json({ 
        success: false,
        error: err.message 
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to create default org chart structure',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

/**
 * GET /api/org-chart/validate/:businessId
 * Validate org chart structure
 */
router.get('/validate/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    const validation = await orgChartService.validateOrgChartStructure(businessId);
    res.json(validation);
  } catch (error) {
    console.error('Error validating org chart structure:', error);
    res.status(500).json({ error: 'Failed to validate org chart structure' });
  }
});

// ============================================================================
// PERMISSIONS
// ============================================================================

/**
 * GET /api/org-chart/permissions
 * Get all permissions
 */
router.get('/permissions', async (req, res) => {
  try {
    const { moduleId, category } = req.query;
    
    let permissions;
    if (moduleId) {
      permissions = await permissionService.getPermissionsByModule(moduleId as string);
    } else if (category) {
      permissions = await permissionService.getPermissionsByCategory(category as string);
    } else {
      permissions = await permissionService.getAllPermissions();
    }
    
    res.json(permissions);
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

/**
 * GET /api/org-chart/permissions/:businessId
 * Get all permissions for a business
 */
router.get('/permissions/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    const permissions = await permissionService.getAllPermissions();
    res.json({ success: true, data: permissions });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch permissions' });
  }
});

/**
 * GET /api/org-chart/permissions/check
 * Check if a user has a specific permission
 */
router.get('/permissions/check', async (req, res) => {
  try {
    const { userId, businessId, moduleId, featureId, action } = req.query;
    
    if (!userId || !businessId || !moduleId || !featureId || !action) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const result = await permissionService.checkUserPermission(
      userId as string,
      businessId as string,
      moduleId as string,
      featureId as string,
      action as string
    );
    
    res.json(result);
  } catch (error) {
    console.error('Error checking permission:', error);
    res.status(500).json({ error: 'Failed to check permission' });
  }
});

/**
 * GET /api/org-chart/permissions/user/:userId/:businessId
 * Get all permissions for a user
 */
router.get('/permissions/user/:userId/:businessId', async (req, res) => {
  try {
    const { userId, businessId } = req.params;
    const permissions = await permissionService.getUserPermissions(userId, businessId);
    res.json(permissions);
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    res.status(500).json({ error: 'Failed to fetch user permissions' });
  }
});

// ============================================================================
// PERMISSION SETS
// ============================================================================

/**
 * GET /api/org-chart/permission-sets/:businessId
 * Get all permission sets for a business
 */
router.get('/permission-sets/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    const permissionSets = await permissionService.getPermissionSets(businessId);
    res.json(permissionSets);
  } catch (error) {
    console.error('Error fetching permission sets:', error);
    res.status(500).json({ error: 'Failed to fetch permission sets' });
  }
});

/**
 * GET /api/org-chart/permission-sets/templates
 * Get template permission sets
 */
router.get('/permission-sets/templates', async (req, res) => {
  try {
    const templates = await permissionService.getTemplatePermissionSets();
    res.json(templates);
  } catch (error) {
    console.error('Error fetching template permission sets:', error);
    res.status(500).json({ error: 'Failed to fetch template permission sets' });
  }
});

/**
 * POST /api/org-chart/permission-sets
 * Create a new permission set
 */
router.post('/permission-sets', async (req, res) => {
  try {
    const permissionSetData = req.body;
    const permissionSet = await permissionService.createPermissionSet(permissionSetData);
    res.status(201).json(permissionSet);
  } catch (error) {
    console.error('Error creating permission set:', error);
    res.status(500).json({ error: 'Failed to create permission set' });
  }
});

/**
 * PUT /api/org-chart/permission-sets/:id
 * Update a permission set
 */
router.put('/permission-sets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const permissionSet = await permissionService.updatePermissionSet(id, updateData);
    res.json(permissionSet);
  } catch (error) {
    console.error('Error updating permission set:', error);
    res.status(500).json({ error: 'Failed to update permission set' });
  }
});

/**
 * DELETE /api/org-chart/permission-sets/:id
 * Delete a permission set
 */
router.delete('/permission-sets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await permissionService.deletePermissionSet(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting permission set:', error);
    res.status(500).json({ error: 'Failed to delete permission set' });
  }
});

/**
 * POST /api/org-chart/permission-sets/:id/copy
 * Copy a permission set as a template
 */
router.post('/permission-sets/:id/copy', async (req, res) => {
  try {
    const { id } = req.params;
    const { businessId, newName } = req.body;
    
    if (!businessId || !newName) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const permissionSet = await permissionService.copyPermissionSetAsTemplate(
      id,
      businessId,
      newName
    );
    
    res.status(201).json(permissionSet);
  } catch (error) {
    console.error('Error copying permission set:', error);
    res.status(500).json({ error: 'Failed to copy permission set' });
  }
});

// ============================================================================
// EMPLOYEE MANAGEMENT
// ============================================================================

/**
 * GET /api/org-chart/employees/:businessId/vacant
 * Get vacant positions for a business
 * NOTE: This route must come before /employees/:businessId to avoid route conflicts
 */
router.get('/employees/:businessId/vacant', async (req, res) => {
  try {
    const { businessId } = req.params;
    const vacantPositions = await employeeManagementService.getVacantPositions(businessId);
    res.json({ success: true, data: vacantPositions });
  } catch (error) {
    console.error('Error fetching vacant positions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch vacant positions' });
  }
});

/**
 * GET /api/org-chart/employees/:businessId
 * Get all employees for a business
 */
router.get('/employees/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    const employees = await employeeManagementService.getBusinessEmployees(businessId);
    res.json({ success: true, data: employees });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch employees' });
  }
});

/**
 * GET /api/org-chart/employees/department/:businessId/:departmentId
 * Get employees by department
 */
router.get('/employees/department/:businessId/:departmentId', async (req, res) => {
  try {
    const { businessId, departmentId } = req.params;
    const employees = await employeeManagementService.getEmployeesByDepartment(businessId, departmentId);
    res.json(employees);
  } catch (error) {
    console.error('Error fetching employees by department:', error);
    res.status(500).json({ error: 'Failed to fetch employees by department' });
  }
});

/**
 * GET /api/org-chart/employees/tier/:businessId/:tierId
 * Get employees by organizational tier
 */
router.get('/employees/tier/:businessId/:tierId', async (req, res) => {
  try {
    const { businessId, tierId } = req.params;
    const employees = await employeeManagementService.getEmployeesByTier(businessId, tierId);
    res.json(employees);
  } catch (error) {
    console.error('Error fetching employees by tier:', error);
    res.status(500).json({ error: 'Failed to fetch employees by tier' });
  }
});

/**
 * GET /api/org-chart/employees/user/:userId/:businessId
 * Get employee's current positions
 */
router.get('/employees/user/:userId/:businessId', async (req, res) => {
  try {
    const { userId, businessId } = req.params;
    const positions = await employeeManagementService.getEmployeePositions(userId, businessId);
    res.json(positions);
  } catch (error) {
    console.error('Error fetching employee positions:', error);
    res.status(500).json({ error: 'Failed to fetch employee positions' });
  }
});

/**
 * GET /api/org-chart/employees/history/:userId/:businessId
 * Get employee assignment history
 */
router.get('/employees/history/:userId/:businessId', async (req, res) => {
  try {
    const { userId, businessId } = req.params;
    const history = await employeeManagementService.getEmployeeAssignmentHistory(userId, businessId);
    res.json(history);
  } catch (error) {
    console.error('Error fetching employee assignment history:', error);
    res.status(500).json({ error: 'Failed to fetch employee assignment history' });
  }
});

/**
 * POST /api/org-chart/employees/assign
 * Assign an employee to a position
 */
router.post('/employees/assign', async (req, res) => {
  try {
    const assignmentData = req.body;
    const assignment = await employeeManagementService.assignEmployeeToPosition(assignmentData);
    res.status(201).json(assignment);
  } catch (error) {
    console.error('Error assigning employee:', error);
    res.status(500).json({ error: 'Failed to assign employee' });
  }
});

/**
 * DELETE /api/org-chart/employees/remove
 * Remove an employee from a position
 */
router.delete('/employees/remove', async (req, res) => {
  try {
    const { userId, positionId, businessId } = req.body;
    await employeeManagementService.removeEmployeeFromPosition(userId, positionId, businessId);
    res.status(204).send();
  } catch (error) {
    console.error('Error removing employee:', error);
    res.status(500).json({ error: 'Failed to remove employee' });
  }
});

/**
 * POST /api/org-chart/employees/transfer
 * Transfer an employee to a different position
 */
router.post('/employees/transfer', async (req, res) => {
  try {
    const { userId, fromPositionId, toPositionId, businessId, transferredById, effectiveDate } = req.body;
    const transfer = await employeeManagementService.transferEmployee(
      userId,
      fromPositionId,
      toPositionId,
      businessId,
      transferredById,
      effectiveDate ? new Date(effectiveDate) : undefined
    );
    res.status(201).json(transfer);
  } catch (error) {
    console.error('Error transferring employee:', error);
    res.status(500).json({ error: 'Failed to transfer employee' });
  }
});

/**
 * GET /api/org-chart/employees/summary/:businessId
 * Get business employee summary
 */
router.get('/employees/summary/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    const summary = await employeeManagementService.getBusinessEmployeeSummary(businessId);
    res.json(summary);
  } catch (error) {
    console.error('Error fetching employee summary:', error);
    res.status(500).json({ error: 'Failed to fetch employee summary' });
  }
});

/**
 * GET /api/org-chart/employees/capacity/:businessId
 * Get positions with available capacity
 */
router.get('/employees/capacity/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    const positionsWithCapacity = await employeeManagementService.getPositionsWithCapacity(businessId);
    res.json(positionsWithCapacity);
  } catch (error) {
    console.error('Error fetching positions with capacity:', error);
    res.status(500).json({ error: 'Failed to fetch positions with capacity' });
  }
});

/**
 * POST /api/org-chart/employees/validate
 * Validate employee assignment
 */
router.post('/employees/validate', async (req, res) => {
  try {
    const { userId, positionId, businessId } = req.body;
    const validation = await employeeManagementService.validateEmployeeAssignment(userId, positionId, businessId);
    res.json(validation);
  } catch (error) {
    console.error('Error validating employee assignment:', error);
    res.status(500).json({ error: 'Failed to validate employee assignment' });
  }
});

/**
 * GET /api/org-chart/:businessId
 * Get complete org chart structure for a business (alias for structure endpoint)
 * NOTE: This route must be placed at the end to avoid conflicts with more specific routes
 */
router.get('/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    
    if (!businessId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Business ID is required' 
      });
    }
    
    const structure = await orgChartService.getOrgChartStructure(businessId);
    
    // Transform the response to match frontend expectations
    const response = {
      success: true,
      tiers: structure.tiers,
      departments: structure.departments,
      positions: structure.positions,
      hierarchy: {
        departments: structure.departments,
        positions: structure.positions
      }
    };
    
    res.json(response);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error fetching org chart:', {
      error: err.message,
      stack: err.stack,
      businessId: req.params.businessId
    });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch org chart',
      message: err.message
    });
  }
});

export default router;
