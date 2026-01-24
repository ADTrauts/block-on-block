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
    const hasDatabaseName = !!(pathname && pathname.length > 1 && pathname !== '/');
    
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

// Process DATABASE_URL - always set datasources to ensure Prisma uses our config
// This is critical for both Unix socket and IP address connections
let originalDatabaseUrl: string | undefined;
if (process.env.DATABASE_URL) {
  let dbUrl = process.env.DATABASE_URL.trim();
  originalDatabaseUrl = process.env.DATABASE_URL;
  
  // Validate DATABASE_URL format before using it
  if (!dbUrl || dbUrl.length === 0) {
    console.error('❌ [PRISMA] DATABASE_URL is empty or whitespace only');
    throw new Error('DATABASE_URL environment variable is empty. Please set a valid database connection string.');
  }
  
  // Check for common malformed URL patterns (only for non-Cloud SQL URLs)
  // Cloud SQL Unix socket format has @/ but includes /cloudsql/ in the host parameter
  // Skip validation if it's clearly a Cloud SQL connection
  const isCloudSQL = dbUrl.includes('/cloudsql/') || dbUrl.includes('?host=/cloudsql/') || dbUrl.includes('&host=/cloudsql/');
  if (!isCloudSQL && dbUrl.includes('@/') && !dbUrl.includes('host=')) {
    console.error('❌ [PRISMA] DATABASE_URL appears to be malformed (empty host):', dbUrl.substring(0, 50) + '...');
    throw new Error('DATABASE_URL has an empty host. For Cloud SQL, use format: postgresql://user:pass@/db?host=/cloudsql/project:region:instance');
  }
  
  // For Cloud SQL Unix socket connections, ensure connection pool parameters are present
  if (dbUrl.includes('/cloudsql/')) {
    // Use higher connection limit for production workloads (20 connections)
    // Development can use lower limit (5 connections) to save resources
    const connectionLimit = process.env.NODE_ENV === 'production' ? 20 : 5;
    
    // Check if URL already has connection parameters
    const hasParams = dbUrl.includes('?');
    const separator = hasParams ? '&' : '?';
    
    // Add connection pool parameters if not already present
    if (!dbUrl.includes('connection_limit=')) {
      dbUrl = `${dbUrl}${separator}connection_limit=${connectionLimit}&pool_timeout=20&connect_timeout=60`;
    }
  } else {
    // For IP address connections, validate the URL format
    // Only validate if it's clearly not a Cloud SQL connection
    if (!isCloudSQL) {
      try {
        const url = new URL(dbUrl);
        if (!url.hostname || url.hostname.length === 0) {
          console.error('❌ [PRISMA] DATABASE_URL has empty hostname:', dbUrl.substring(0, 50) + '...');
          throw new Error('DATABASE_URL has an empty hostname. Please check your connection string format.');
        }
      } catch (urlError) {
        // If URL parsing fails and it's not Cloud SQL, that's an error
        console.error('❌ [PRISMA] DATABASE_URL format is invalid:', dbUrl.substring(0, 50) + '...');
        throw new Error(`DATABASE_URL format is invalid: ${urlError instanceof Error ? urlError.message : 'Unknown error'}`);
      }
    }
    // If it's Cloud SQL but in the else block, that's fine - Prisma will handle it
  }
  
  // CRITICAL: Always set datasources config BEFORE creating PrismaClient
  // For Unix socket connections, the URL format must be:
  // postgresql://user:pass@localhost/db?host=/cloudsql/project:region:instance
  // The 'localhost' is required by Prisma but ignored - the actual connection uses the host parameter
  prismaConfig.datasources = {
    db: {
      url: dbUrl
    }
  };
  
  // Log the connection type (in both dev and production for debugging)
  const connectionType = dbUrl.includes('/cloudsql/') ? 'Unix socket' : 'IP address';
  console.log(`🔌 [PRISMA] Using ${connectionType} connection`);
  if (process.env.NODE_ENV === 'development') {
    console.log(`   Connection string: ${dbUrl.substring(0, 60)}...`);
  } else {
    // In production, log a sanitized version (no passwords)
    const sanitized = dbUrl.replace(/:([^:@]+)@/, ':****@');
    console.log(`   Connection string: ${sanitized.substring(0, 80)}...`);
  }
} else {
  // In production, DATABASE_URL must be set
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ [PRISMA] DATABASE_URL is not set in production environment');
    throw new Error('DATABASE_URL environment variable is required in production. Please set it in Cloud Run environment variables.');
  }
}

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

// Restore original DATABASE_URL to process.env after PrismaClient is created
// (in case other code needs it, though Prisma will use datasources.url)
if (typeof originalDatabaseUrl !== 'undefined') {
  process.env.DATABASE_URL = originalDatabaseUrl;
}

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
} 