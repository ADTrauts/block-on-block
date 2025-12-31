import express, { Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { authenticateJWT } from '../middleware/auth';
import { logger } from '../lib/logger';

const execAsync = promisify(exec);
const router: express.Router = express.Router();

// Middleware to require admin role
const requireAdmin = (req: Request, res: Response, next: () => void) => {
  const user = req.user;
  if (!user || user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

/**
 * GET /api/admin-portal/testing/status
 * Get current test status and summary
 */
router.get('/status', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const serverDir = path.resolve(__dirname, '../..');
    
    // Try to get test status by running a quick test check
    try {
      const { stdout } = await execAsync('pnpm test -- --run --reporter=json', {
        cwd: serverDir,
        timeout: 30000, // 30 second timeout
        env: { ...process.env, CI: 'true' }
      });
      
      // Parse test results
      let testResults;
      try {
        testResults = JSON.parse(stdout);
      } catch {
        // If JSON parsing fails, try to extract info from stdout
        const lines = stdout.split('\n');
        const testLine = lines.find(line => line.includes('Test Files') || line.includes('Tests'));
        testResults = { raw: stdout, summary: testLine };
      }
      
      res.json({
        success: true,
        data: {
          status: 'completed',
          results: testResults,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      // Test run failed or timed out
      res.json({
        success: true,
        data: {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      });
    }
  } catch (error) {
    await logger.error('Failed to get test status', {
      operation: 'admin_testing_status',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to get test status' });
  }
});

/**
 * POST /api/admin-portal/testing/run
 * Run tests and return results
 */
router.post('/run', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { testFile, watch } = req.body;
    const serverDir = path.resolve(__dirname, '../..');
    
    // Build test command
    let command = 'pnpm test -- --run --reporter=json';
    if (testFile) {
      command += ` ${testFile}`;
    }
    
    // Log the test run
    await logger.info('Admin initiated test run', {
      operation: 'admin_testing_run',
      testFile: testFile || 'all',
      watch: watch || false
    });
    
    // Run tests with timeout
    const timeout = watch ? 300000 : 60000; // 5 min for watch, 1 min for single run
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: serverDir,
        timeout,
        env: { ...process.env, CI: 'true' }
      });
      
      // Try to parse JSON results
      let testResults;
      try {
        testResults = JSON.parse(stdout);
      } catch {
        // Fallback: return raw output
        testResults = {
          raw: stdout,
          stderr: stderr,
          summary: extractTestSummary(stdout)
        };
      }
      
      res.json({
        success: true,
        data: {
          status: 'completed',
          results: testResults,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      const execError = error as { stdout?: string; stderr?: string; message?: string };
      
      res.json({
        success: true,
        data: {
          status: 'error',
          error: execError.message || 'Test execution failed',
          stdout: execError.stdout,
          stderr: execError.stderr,
          timestamp: new Date().toISOString()
        }
      });
    }
  } catch (error) {
    await logger.error('Failed to run tests', {
      operation: 'admin_testing_run',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to run tests' });
  }
});

/**
 * GET /api/admin-portal/testing/coverage
 * Get test coverage report
 */
router.get('/coverage', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const serverDir = path.resolve(__dirname, '../..');
    
    try {
      const { stdout } = await execAsync('pnpm test:coverage', {
        cwd: serverDir,
        timeout: 120000, // 2 minute timeout
        env: { ...process.env, CI: 'true' }
      });
      
      res.json({
        success: true,
        data: {
          coverage: extractCoverageInfo(stdout),
          raw: stdout,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      res.json({
        success: true,
        data: {
          status: 'error',
          error: error instanceof Error ? error.message : 'Failed to generate coverage',
          timestamp: new Date().toISOString()
        }
      });
    }
  } catch (error) {
    await logger.error('Failed to get test coverage', {
      operation: 'admin_testing_coverage',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to get test coverage' });
  }
});

/**
 * GET /api/admin-portal/testing/list
 * List all available test files
 */
router.get('/list', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const serverDir = path.resolve(__dirname, '../..');
    const testDir = path.join(serverDir, 'src');
    
    try {
      const { stdout } = await execAsync(`find ${testDir} -name "*.test.ts" -type f`, {
        cwd: serverDir,
        timeout: 5000
      });
      
      const testFiles = stdout
        .split('\n')
        .filter(line => line.trim())
        .map(file => ({
          path: file,
          relativePath: path.relative(serverDir, file),
          name: path.basename(file)
        }));
      
      res.json({
        success: true,
        data: {
          testFiles,
          count: testFiles.length
        }
      });
    } catch (error) {
      res.json({
        success: true,
        data: {
          testFiles: [],
          count: 0,
          error: error instanceof Error ? error.message : 'Failed to list test files'
        }
      });
    }
  } catch (error) {
    await logger.error('Failed to list test files', {
      operation: 'admin_testing_list',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to list test files' });
  }
});

// Helper function to extract test summary from stdout
function extractTestSummary(stdout: string): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  
  // Try to extract test counts
  const testFilesMatch = stdout.match(/Test Files\s+(\d+)\s+(?:passed|failed)\s+\((\d+)\)/);
  if (testFilesMatch) {
    summary.testFiles = {
      passed: parseInt(testFilesMatch[1]),
      total: parseInt(testFilesMatch[2])
    };
  }
  
  const testsMatch = stdout.match(/Tests\s+(\d+)\s+(?:passed|failed)\s+\|\s+(\d+)\s+(?:passed|failed)\s+\((\d+)\)/);
  if (testsMatch) {
    summary.tests = {
      passed: parseInt(testsMatch[1]),
      failed: parseInt(testsMatch[2]),
      total: parseInt(testsMatch[3])
    };
  }
  
  return summary;
}

// Helper function to extract coverage info from stdout
function extractCoverageInfo(stdout: string): Record<string, unknown> {
  const coverage: Record<string, unknown> = {};
  
  // Try to extract coverage percentages
  const coverageMatch = stdout.match(/All files\s+\|\s+(\d+\.\d+)\s+\|\s+(\d+\.\d+)\s+\|\s+(\d+\.\d+)/);
  if (coverageMatch) {
    coverage.overall = {
      statements: parseFloat(coverageMatch[1]),
      branches: parseFloat(coverageMatch[2]),
      functions: parseFloat(coverageMatch[3])
    };
  }
  
  return coverage;
}

export default router;

