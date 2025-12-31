import dotenv from 'dotenv';
import path from 'path';
import { createServer } from 'http';
import { execSync } from 'child_process';

// Explicitly load .env from the server directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import passport, { issueJWT, registerUser } from './auth';
import jwt from 'jsonwebtoken';
import type { User, Role } from '@prisma/client';
import { prisma } from './lib/prisma';
import dashboardRouter from './routes/dashboard';
import widgetRouter from './routes/widget';
import fileRouter from './routes/file';
import folderRouter from './routes/folder';
import driveRouter from './routes/drive';
import todoRouter from './routes/todo';
import chatRouter from './routes/chat';
import businessRouter from './routes/business';
import educationalRouter from './routes/educational';
import householdRouter from './routes/household';
import ssoRouter from './routes/sso';
import googleOAuthRouter from './routes/googleOAuth';
import healthRouter from './routes/health';
import cors from 'cors';
import bcrypt from 'bcrypt';
import { 
  createRefreshToken, 
  validateRefreshToken, 
  deleteRefreshToken,
  createPasswordResetToken,
  validatePasswordResetToken,
  deletePasswordResetToken,
  createEmailVerificationToken,
  validateEmailVerificationToken,
  deleteEmailVerificationToken,
  deleteAllUserRefreshTokens
} from './utils/tokenUtils';
import { 
  sendVerificationEmail, 
  sendPasswordResetEmail, 
  sendWelcomeEmail 
} from './services/emailService';
import { startCleanupJob } from './services/cleanupService';
import { initializeChatSocketService } from './services/chatSocketService';
import { registerBuiltInModulesOnStartup } from './startup/registerBuiltInModules';
import { seedHRModuleOnStartup } from './startup/seedHRModule';
import { seedTodoModuleOnStartup } from './startup/seedTodoModule';
import cron from 'node-cron';
import { dispatchDueReminders } from './services/reminderService';
import type { JwtPayload } from 'jsonwebtoken';
import userRouter from './routes/user';
import memberRouter from './routes/member';
import searchRouter from './routes/search';
import trashRouter from './routes/trash';
import moduleRouter from './routes/module';
import analyticsRouter from './routes/analytics';
import auditRouter from './routes/audit';
import privacyRouter from './routes/privacy';
import retentionRouter from './routes/retention';
import notificationRouter from './routes/notification';
import pushNotificationRouter from './routes/pushNotification';
import emailNotificationRouter from './routes/emailNotification';
// import advancedNotificationRouter from './routes/advancedNotification'; // Temporarily disabled - functions not implemented
import governanceRouter from './routes/governance';
import aiRouter from './routes/ai';
import aiAutonomyRouter from './routes/ai-autonomy';
import aiIntelligenceRouter from './routes/ai-intelligence';
import aiCentralizedRouter from './routes/ai-centralized';
import aiAutonomousRouter from './routes/ai/autonomous';
import aiStatsRouter from './routes/ai-stats';
import aiPersonalityRouter from './routes/ai-personality';
import aiPatternsRouter from './routes/ai-patterns';
import aiUserContextRouter from './routes/ai-user-context';
import billingRouter from './routes/billing';
import featureGatingRouter from './routes/featureGating';
import featuresRouter from './routes/features';
import paymentRouter from './routes/payment';
import developerPortalRouter from './routes/developerPortal';
import locationRouter from './routes/location';
import adminRouter from './routes/admin';
import adminPortalRouter from './routes/admin-portal';
import calendarRouter from './routes/calendar';
import orgChartRouter from './routes/org-chart';
import businessAIRouter from './routes/businessAI';
import adminBusinessAIRouter from './routes/adminBusinessAI';
import aiContextDebugRouter from './routes/ai-context-debug';
import aiConversationsRouter from './routes/aiConversations';
import profilePhotosRouter from './routes/profilePhotos';
import adminSetupRouter from './routes/admin-setup';
import contentReportsRouter from './routes/contentReports';
import adminSeedModulesRouter from './routes/admin-seed-modules';
import moduleAIContextRouter from './routes/moduleAIContext';
import businessFrontPageRouter from './routes/businessFrontPage';
import { adminLogsRouter } from './routes/admin-logs';
import adminPortalTestingRouter from './routes/admin-portal-testing';
import hrRouter from './routes/hr';
import schedulingRouter from './routes/scheduling';
import debugModulesRouter from './routes/debug-modules';
import debugDatabaseRouter from './routes/debug-database';
import debugBusinessTierRouter from './routes/debug-business-tier';
import adminOverrideRouter from './routes/admin-override';
import adminHRSetupRouter from './routes/admin-hr-setup';
import adminFixHRRouter from './routes/admin-fix-hr';
import adminCreateHRTablesRouter from './routes/admin-create-hr-tables';
import adminFixSubscriptionsRouter from './routes/admin-fix-subscriptions';
import { authenticateJWT } from './middleware/auth';
import { logger } from './lib/logger';



const app: express.Application = express();
const port = process.env.PORT || 5000;



// Helper function to create user response
function createUserResponse(user: User) {
  const { password, ...userWithoutPassword } = user;
  return {
    ...userWithoutPassword,
    emailVerified: !!user.emailVerified,
  };
}

// Helper to wrap async route handlers for Express
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function asyncHandler(fn: (...args: any[]) => Promise<any>): RequestHandler {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

console.log('Starting server...');

// CATCH-ALL logger - logs EVERY request before anything else
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'POST' && req.originalUrl.includes('/api/scheduling/me/availability')) {
    console.log('🔥 [EXPRESS ENTRY] POST request reached Express:', {
      method: req.method,
      originalUrl: req.originalUrl,
      path: req.path,
      url: req.url,
      headers: {
        'content-type': req.headers['content-type'],
        'content-length': req.headers['content-length'],
        'authorization': req.headers.authorization ? 'present' : 'missing'
      }
    });
  }
  next();
});

app.use(express.json());
app.use(passport.initialize() as express.RequestHandler);

// Global request logger for debugging POST requests to scheduling
// This MUST be after body parser but before routes
app.use((req: Request, res: Response, next: NextFunction) => {
  // Log ALL POST requests to /api/scheduling to help debug
  if (req.method === 'POST' && req.originalUrl.includes('/api/scheduling')) {
    console.log('🌐 [GLOBAL] POST request to /api/scheduling received:', {
      method: req.method,
      originalUrl: req.originalUrl,
      path: req.path,
      url: req.url,
      baseUrl: req.baseUrl,
      query: req.query,
      hasBody: !!req.body,
      bodyKeys: req.body ? Object.keys(req.body) : [],
      bodyPreview: req.body ? JSON.stringify(req.body).substring(0, 200) : null,
      contentType: req.headers['content-type'],
      authorization: req.headers.authorization ? 'present' : 'missing',
      contentLength: req.headers['content-length']
    });
  }
  // Also log ALL requests that match /api/scheduling/me/availability regardless of method
  if (req.originalUrl.includes('/api/scheduling/me/availability')) {
    console.log('🚨 [GLOBAL] Request to /api/scheduling/me/availability:', {
      method: req.method,
      originalUrl: req.originalUrl,
      path: req.path,
      url: req.url
    });
  }
  next();
});
const corsOptions = {
  origin: [
    process.env.FRONTEND_URL || 'https://vssyl.com',
    'https://vssyl.com',
    'https://vssyl-web-235369681725.us-central1.run.app' // Cloud Run web service
  ],
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Add general request logging with structured logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Log the incoming request
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.logApiRequest(
      req.method,
      req.originalUrl,
      (req as any).user?.id,
      duration,
      res.statusCode,
      {
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      }
    );
  });
  
  next();
});

app.post('/api/auth/register', asyncHandler(async (req: Request, res: Response) => {
  const { email, password, name } = req.body;
  if (!email || !password) {
    res.status(400).json({ message: 'Email and password are required' });
    return;
  }
  try {
    // Get client IP for location detection
    const clientIP = req.headers['x-forwarded-for'] || 
                    req.connection.remoteAddress || 
                    req.socket.remoteAddress;
    
    const user = await registerUser(email, password, name, clientIP as string);
    
    // Log successful registration
    await logger.logUserAction(user.id, 'user_registered', {
      email: user.email,
      ipAddress: clientIP as string,
      userAgent: req.get('user-agent')
    });
    
    // Send verification email if SMTP is configured, otherwise auto-verify
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      // Create and send verification email
      const verificationToken = await createEmailVerificationToken(user.id);
      await sendVerificationEmail(user.email, verificationToken);
      
      // Send welcome email
      await sendWelcomeEmail(user.email, user.name || 'there');
    } else {
      // Auto-verify email if SMTP is not configured
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() }
      });
    }
    
    const token = issueJWT(user);
    const refreshToken = await createRefreshToken(user.id);

    // Ensure a personal main calendar exists named after the first tab (use "My Dashboard" as fallback)
    try {
      // Find or create the user's first personal dashboard name
      const personalDash = await prisma.dashboard.findFirst({
        where: { userId: user.id, businessId: null, institutionId: null, householdId: null },
        orderBy: { createdAt: 'asc' }
      });
      const mainName = personalDash?.name || 'My Dashboard';
      const existingCal = await prisma.calendar.findFirst({ where: { contextType: 'PERSONAL', contextId: user.id, isPrimary: true } });
      if (!existingCal) {
        await prisma.calendar.create({
          data: {
            name: mainName,
            contextType: 'PERSONAL',
            contextId: user.id,
            isPrimary: true,
            isSystem: true,
            isDeletable: false,
            defaultReminderMinutes: 10,
            members: { create: { userId: user.id, role: 'OWNER' } }
          }
        });
        await logger.info('Created personal primary calendar during registration', {
          operation: 'register_user',
          context: { userId: user.id, email: user.email, calendarName: mainName },
        });
      }
    } catch (e: unknown) {
      const err = e as Error;
      await logger.error('Failed to ensure personal main calendar on register', {
        operation: 'register_user',
        error: { message: err.message, stack: err.stack },
        context: { userId: user.id, email: user.email },
      });
      // Don't fail registration if calendar creation fails - it will be created when dashboard is created
    }

    res.status(201).json({ 
      token,
      refreshToken,
      user: createUserResponse(user)
    });
  } catch (err: unknown) {
    // Log registration error
    await logger.error('User registration failed', {
      operation: 'user_registration',
      email: email,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      error: {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined
      }
    });
    
    if (typeof err === 'object' && err && 'code' in err && (err as Record<string, unknown>).code === 'P2002') {
      res.status(409).json({ message: 'Email already in use' });
      return;
    }
    
    // Handle database connection errors
    if (typeof err === 'object' && err && 'message' in err) {
      const errorMessage = (err as Record<string, unknown>).message as string;
      if (errorMessage.includes('connection pool') || errorMessage.includes('timeout')) {
        res.status(503).json({ message: 'Database temporarily unavailable. Please try again.' });
        return;
      }
    }
    
    res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
}));

app.post('/api/auth/login', (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('local', { session: false }, async (err: unknown, user: User | false, info: { message?: string } | undefined) => {
    if (err || !user) {
      // Log failed login attempt
      await logger.logSecurityEvent('login_failed', 'medium', {
        operation: 'user_login',
        email: req.body.email,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        reason: info?.message || 'Invalid credentials'
      });
      
      return res.status(401).json({ message: info?.message || 'Unauthorized' });
    }
    
    // Log successful login
    await logger.logUserAction(user.id, 'user_login', {
      email: user.email,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    const token = issueJWT(user);
    const refreshToken = await createRefreshToken(user.id);
    
    return res.json({ 
      token,
      refreshToken,
      user: createUserResponse(user)
    });
  })(req, res, next);
});

app.post('/api/auth/refresh', asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token is required' });
  }

  const user = await validateRefreshToken(refreshToken);
  if (!user) {
    return res.status(401).json({ message: 'Invalid refresh token' });
  }

  // Delete the used refresh token
  await deleteRefreshToken(refreshToken);

  // Create new tokens
  const newToken = issueJWT(user);
  const newRefreshToken = await createRefreshToken(user.id);

  res.json({
    token: newToken,
    refreshToken: newRefreshToken,
    user: createUserResponse(user)
  });
}));

app.post('/api/auth/forgot-password', asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  const user = await prisma.user.findUnique({ 
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true
    }
  });
  if (!user) {
    // Don't reveal that the email doesn't exist
    return res.json({ message: 'If an account exists, a password reset email will be sent' });
  }

  const resetToken = await createPasswordResetToken(user.id);
  await sendPasswordResetEmail(user.email, resetToken);

  res.json({ message: 'If an account exists, a password reset email will be sent' });
}));

app.post('/api/auth/reset-password', asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ message: 'Token and password are required' });
  }

  const user = await validatePasswordResetToken(token);
  if (!user) {
    return res.status(400).json({ message: 'Invalid or expired reset token' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword }
  });

  await deletePasswordResetToken(token);
  await deleteAllUserRefreshTokens(user.id);

  res.json({ message: 'Password has been reset successfully' });
}));

app.post('/api/auth/verify-email', asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ message: 'Token is required' });
  }

  const user = await validateEmailVerificationToken(token);
  if (!user) {
    return res.status(400).json({ message: 'Invalid or expired verification token' });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: new Date() }
  });

  await deleteEmailVerificationToken(token);

  res.json({ message: 'Email verified successfully' });
}));

app.post('/api/auth/resend-verification', asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  const user = await prisma.user.findUnique({ 
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      emailVerified: true,
    }
  });
  
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  if (user.emailVerified) {
    return res.status(400).json({ message: 'Email is already verified' });
  }

  const verificationToken = await createEmailVerificationToken(user.id);
  await sendVerificationEmail(user.email, verificationToken);

  res.json({ message: 'Verification email sent' });
}));

// NextAuth.js internal logging endpoint
app.post('/api/auth/_log', (req: Request, res: Response) => {
  // Just return success for NextAuth.js internal logging
  res.status(200).json({ success: true });
});

// Temporary endpoint to list users (for debugging)
app.get('/api/debug/users', async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        userNumber: true,
        role: true,
        emailVerified: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json({
      count: users.length,
      users: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// JWT authentication middleware - using imported function from middleware/auth

// Temporarily disabled due to type conflicts
// function requireRole(role: string) {
//   return (req: Request, res: Response, next: NextFunction) => {
//     if (req.user && req.user.role === role) {
//       next();
//     } else {
//       res.status(403).json({ message: 'Forbidden' });
//     }
//   };
// }

// Example of a protected route
app.get('/api/profile', authenticateJWT, (req, res) => {
  res.json({ user: req.user });
});

// Example of an admin-only route
// Temporarily disabled due to type conflicts
// app.get('/api/admin', authenticateJWT, requireRole('ADMIN'), (req, res) => {
//   res.json({ message: 'Welcome, admin!' });
// });

// Public health endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'vssyl-server',
    version: '1.0.0'
  });
});

// Health check routes (no authentication required)
app.use('/api', healthRouter);

app.use('/api/dashboard', authenticateJWT, dashboardRouter);
app.use('/api/widget', authenticateJWT, widgetRouter);
console.log('[DEBUG] Registering /api/drive route');
app.use('/api/drive', driveRouter);
app.use('/api/todo', todoRouter);
app.use('/api/folder', folderRouter);
app.use('/api/chat', authenticateJWT, chatRouter);
app.use('/api/business', authenticateJWT, businessRouter);
app.use('/api/business-front', authenticateJWT, businessFrontPageRouter);
app.use('/api/educational', authenticateJWT, educationalRouter);
app.use('/api/household', authenticateJWT, householdRouter);
app.use('/api/sso', ssoRouter);
app.use('/api/google-oauth', googleOAuthRouter);
app.use('/api/user', authenticateJWT, userRouter);
app.use('/api/member', memberRouter);
app.use('/api/search', authenticateJWT, searchRouter);
app.use('/api/trash', authenticateJWT, trashRouter);
app.use('/api/modules', authenticateJWT, moduleRouter);
app.use('/api/analytics', authenticateJWT, analyticsRouter);
app.use('/api/audit', authenticateJWT, auditRouter);
app.use('/api/privacy', authenticateJWT, privacyRouter);
app.use('/api/retention', authenticateJWT, retentionRouter);
app.use('/api/notifications', authenticateJWT, notificationRouter);
app.use('/api/push-notifications', authenticateJWT, pushNotificationRouter);
app.use('/api/email-notifications', authenticateJWT, emailNotificationRouter);
// app.use('/api/advanced-notifications', authenticateJWT, advancedNotificationRouter); // Temporarily disabled - functions not implemented
app.use('/api/governance', authenticateJWT, governanceRouter);
app.use('/api/ai', authenticateJWT, aiRouter);
app.use('/api/ai/autonomy', authenticateJWT, aiAutonomyRouter);
app.use('/api/ai/intelligence', authenticateJWT, aiIntelligenceRouter);
app.use('/api/ai/autonomous', authenticateJWT, aiAutonomousRouter);
app.use('/api/ai-stats', authenticateJWT, aiStatsRouter);
app.use('/api/ai/personality', authenticateJWT, aiPersonalityRouter);
app.use('/api/ai/patterns', authenticateJWT, aiPatternsRouter);
app.use('/api/ai/context', authenticateJWT, aiUserContextRouter);
app.use('/api/centralized-ai', authenticateJWT, aiCentralizedRouter);
app.use('/api/billing', authenticateJWT, billingRouter);
app.use('/api/feature-gating', authenticateJWT, featureGatingRouter);
app.use('/api/features', featuresRouter);
app.use('/api/payment', authenticateJWT, paymentRouter);
app.use('/api/developer', authenticateJWT, developerPortalRouter);
app.use('/api/location', locationRouter);
app.use('/api/admin', adminRouter);
app.use('/api/admin-portal', adminPortalRouter);
app.use('/api/admin-portal/testing', adminPortalTestingRouter);
app.use('/api/org-chart', orgChartRouter);
app.use('/api/calendar', authenticateJWT, calendarRouter);
app.use('/api/business-ai', businessAIRouter);
app.use('/api/admin/business-ai', adminBusinessAIRouter);
app.use('/api/ai-context-debug', aiContextDebugRouter);
app.use('/api/ai-conversations', authenticateJWT, aiConversationsRouter);
app.use('/api/profile-photos', profilePhotosRouter);
app.use('/api/admin-setup', adminSetupRouter);
app.use('/api/content-reports', contentReportsRouter);
app.use('/api/admin/seed', authenticateJWT, adminSeedModulesRouter);
app.use('/api', moduleAIContextRouter);
app.use('/api/admin/logs', authenticateJWT, adminLogsRouter);
app.use('/api/hr', hrRouter); // HR module routes (includes own auth checks)
app.use('/api/scheduling', (req, res, next) => {
  // Log ALL requests to scheduling routes for debugging
  console.log('🔍 [INDEX] Request to /api/scheduling - Mount point reached', {
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    url: req.url,
    baseUrl: req.baseUrl,
    query: req.query,
    hasBody: !!req.body,
    contentType: req.headers['content-type'],
    authorization: req.headers.authorization ? 'present' : 'missing',
    bodyKeys: req.body ? Object.keys(req.body) : []
  });
  next();
}, schedulingRouter); // Scheduling module routes (includes own auth checks)

// Log registered scheduling routes on startup
if (process.env.NODE_ENV === 'development') {
  console.log('✅ Scheduling router mounted at /api/scheduling');
  
  // Detailed route inspection
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const postAvailabilityRoute = schedulingRouter.stack.find((layer: any) => 
    layer.route?.methods?.post && layer.route?.path === '/me/availability'
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getAvailabilityRoute = schedulingRouter.stack.find((layer: any) => 
    layer.route?.methods?.get && layer.route?.path === '/me/availability'
  );
  
  console.log('✅ Available routes:', {
    postAvailability: !!postAvailabilityRoute,
    postAvailabilityDetails: postAvailabilityRoute ? {
      path: (postAvailabilityRoute.route as any)?.path,
      methods: (postAvailabilityRoute.route as any)?.methods,
      stackLength: (postAvailabilityRoute.route as any)?.stack?.length
    } : null,
    getAvailability: !!getAvailabilityRoute,
    totalRoutes: schedulingRouter.stack?.length || 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allRoutes: schedulingRouter.stack.map((layer: any) => ({
      path: layer.route?.path,
      methods: (layer.route as any)?.methods,
      regex: layer.regexp?.toString()
    })).filter((r: any) => r.path)
  });
}
app.use('/api/debug', debugModulesRouter); // Debug endpoints (no auth for troubleshooting)
app.use('/api/debug/database', debugDatabaseRouter); // Database debug endpoints
app.use('/api/debug/business-tier', debugBusinessTierRouter); // Business tier debug
app.use('/api/admin-override', adminOverrideRouter); // Admin override endpoints (requires ADMIN role)
app.use('/api/admin/hr-setup', authenticateJWT, adminHRSetupRouter); // Admin HR setup endpoints (manual seeding & diagnostics)
app.use('/api/admin/fix-hr', authenticateJWT, adminFixHRRouter); // Emergency HR fix endpoints (migrations & raw DB access)
app.use('/api/admin/create-hr-tables', authenticateJWT, adminCreateHRTablesRouter); // Manually create HR tables via raw SQL
app.use('/api/admin/fix-subscriptions', authenticateJWT, adminFixSubscriptionsRouter); // Fix subscriptions table schema

// Schedule cleanup jobs
startCleanupJob();

// Generic catch-all for unhandled routes
app.use((req: Request, res: Response) => {
  // Enhanced logging for scheduling availability routes
  if (req.originalUrl.includes('/scheduling/me/availability') || req.path.includes('/me/availability')) {
    console.log(`🚨 [404 HANDLER] Unhandled scheduling availability route: ${req.method} ${req.originalUrl}`, {
      method: req.method,
      path: req.path,
      originalUrl: req.originalUrl,
      baseUrl: req.baseUrl,
      url: req.url,
      route: req.route?.path,
      headers: {
        'content-type': req.headers['content-type'],
        'authorization': req.headers.authorization ? 'present' : 'missing'
      }
    });
  }
  console.log(`[DEBUG] Unhandled route: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ message: 'Not Found' });
});

const isProd = process.env.NODE_ENV === 'production';

// Centralized error-handling middleware
interface ErrorWithStatus extends Error {
  status?: number;
  code?: string | number;
}

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  // Ensure we always have an Error object to work with
  const error = (err instanceof Error ? err : new Error(String(err))) as ErrorWithStatus;

  const status = error.status || 500;
  const response: { message: string; error?: string; code?: string | number } = {
    message: error.message || 'Internal Server Error',
  };

  if (!isProd && error.stack) {
    response.error = error.stack;
  } else if (error.code) {
    response.code = error.code;
  }
  // Log error in development
  if (!isProd) {
    console.error(err);
  }

  res.status(status).json(response);
});

// Run database migrations in production
if (process.env.NODE_ENV === 'production') {
  console.log('🔄 Running database migrations...');
  console.log('DATABASE_MIGRATE_URL:', process.env.DATABASE_MIGRATE_URL ? 'SET' : 'NOT SET');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
  
  try {
    const { execSync } = require('child_process');
    // Use migration URL without connection pool parameters
    const migrationUrl = process.env.DATABASE_MIGRATE_URL || process.env.DATABASE_URL;
    console.log('Using migration URL:', migrationUrl ? 'SET' : 'NOT SET');
    console.log('Migration URL value:', migrationUrl);
    console.log('Migration URL length:', migrationUrl ? migrationUrl.length : 0);
    
    const migrationEnv = {
      ...process.env,
      DATABASE_URL: migrationUrl
    };

    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      env: migrationEnv
    });
    console.log('✅ Database migrations completed');
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    console.error('⚠️  Continuing without migrations - server will start but database may be out of sync');
    // Don't exit - let the server start so we can investigate the migration issue
    // process.exit(1);
  }
}

// Initialize HTTP server
const httpServer = createServer(app);

// Initialize WebSocket service
initializeChatSocketService(httpServer);

// Create HTTP server and initialize WebSocket service
const server = httpServer.listen(port, () => {
  console.log(`About to listen on port ${port}`);
}).on('listening', async () => {
  console.log(`Server listening on port ${port}`);
  
  // Run pending migrations on startup (auto-repair)
  if (process.env.NODE_ENV === 'production') {
    try {
      console.log('🔄 Running pending migrations...');
      await prisma.$executeRawUnsafe(`SELECT 1`);
      console.log('✅ Database connection verified');
    } catch (e) {
      console.error('⚠️  Database connection warning:', e);
    }
  }
  
  // Seed modules if they don't exist (non-blocking)
  try {
    await seedHRModuleOnStartup();
    await seedTodoModuleOnStartup();
  } catch (e) {
    console.error('Module seed failed (non-critical):', e);
  }
  
  // Register built-in modules if registry is empty (non-blocking)
  try {
    await registerBuiltInModulesOnStartup();
  } catch (e) {
    console.error('Module registration startup failed (non-critical):', e);
  }
  
  // Run reminder dispatcher every minute (MVP)
  try {
    cron.schedule('* * * * *', async () => {
      await dispatchDueReminders(5);
    });
  } catch (e) {
    console.error('Failed to schedule reminder dispatcher:', e);
  }
}).on('error', (err) => {
  console.error('Server startup error:', err);
});

export default app;
