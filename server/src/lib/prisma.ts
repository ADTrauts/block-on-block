import { PrismaClient } from '@prisma/client';

declare global {
  var prisma: PrismaClient | undefined;
}

// Check if database URL is configured
const isDatabaseConfigured = (): boolean => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return false;
  
  // Check if it's a valid PostgreSQL URL
  // A URL is configured if it has a database name (not just a placeholder)
  try {
    const url = new URL(dbUrl);
    const pathname = url.pathname;
    
    // Check if it looks like a valid database URL:
    // - Has a pathname that looks like a database name (not empty, not just "/")
    // - Or is a Cloud SQL connection
    const hasDatabaseName = pathname && pathname.length > 1 && pathname !== '/';
    
    return dbUrl.includes('/cloudsql/') || hasDatabaseName;
  } catch {
    // If URL parsing fails, assume it might be configured (let Prisma handle it)
    return true;
  }
};

// Configure Prisma client for Cloud SQL Unix socket connection
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaConfig: any = {
  // In development, only log queries/info/warn if database is configured
  // Suppress error logs for connection issues when database isn't configured
  log: process.env.NODE_ENV === 'development' 
    ? (isDatabaseConfigured() ? ['query', 'info', 'warn', 'error'] : ['warn'])
    : ['error'],
};

// If using Cloud SQL Unix socket connection, configure the client accordingly
if (process.env.DATABASE_URL?.includes('/cloudsql/')) {
  // URL encode the password in the DATABASE_URL to handle special characters
  const url = new URL(process.env.DATABASE_URL);
  if (url.password) {
    url.password = encodeURIComponent(url.password);
  }
  const encodedUrl = url.toString();
  
  prismaConfig.datasources = {
    db: {
      url: encodedUrl + '?connection_limit=5&pool_timeout=20&connect_timeout=60'
    }
  };
}
// Note: No special handling needed for localhost - it's a valid database URL

// Store flag for whether database is configured (for use in startup messages)
export const DATABASE_CONFIGURED = isDatabaseConfigured();

// In development, suppress Prisma connection errors when database isn't configured
if (process.env.NODE_ENV === 'development' && !DATABASE_CONFIGURED) {
  // Intercept stderr to filter Prisma connection errors
  // This prevents noisy error output when running without a database
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  process.stderr.write = function(chunk: any, encoding?: any, cb?: any): boolean {
    const message = typeof chunk === 'string' ? chunk : chunk.toString();
    
    // Check if this is a Prisma connection error
    const isPrismaConnectionError = 
      message.includes("Can't reach database server") ||
      message.includes('localhost:5432') ||
      (message.includes('Invalid `prisma.') && message.includes('invocation'));
    
    // Suppress Prisma connection errors - they're expected when DB isn't running
    if (isPrismaConnectionError) {
      // Return success without writing - suppresses the error
      // Handle callback if provided (encoding might be callback in some cases)
      if (typeof encoding === 'function') {
        encoding();
        return true;
      }
      if (cb && typeof cb === 'function') {
        cb();
        return true;
      }
      return true;
    }
    
    // Write all other stderr output normally
    // Handle different call signatures
    if (cb !== undefined) {
      return originalStderrWrite(chunk, encoding, cb);
    } else if (encoding !== undefined) {
      return originalStderrWrite(chunk, encoding);
    } else {
      return originalStderrWrite(chunk);
    }
  };
  
  // Log a helpful message explaining that database errors are expected
  process.nextTick(() => {
    const dbUrl = process.env.DATABASE_URL || 'not set';
    console.log('\n⚠️  Database not configured (DATABASE_URL is missing or invalid)');
    console.log('   Database connection errors are expected and have been suppressed.');
    console.log('   Database-dependent features will be skipped gracefully.');
    console.log(`   Current DATABASE_URL: ${dbUrl === 'not set' ? 'not set' : 'set but invalid'}`);
    console.log('   To use database features, set a valid DATABASE_URL in server/.env\n');
  });
}

export const prisma = global.prisma || new PrismaClient(prismaConfig);

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
} 