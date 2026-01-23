/**
 * Query timeout utility for database operations
 * Wraps Prisma queries with a timeout to prevent hanging requests
 */

export async function withQueryTimeout<T>(
  queryPromise: Promise<T>,
  timeoutMs: number = 10000, // Default 10 seconds
  errorMessage: string = 'Database query timeout'
): Promise<T> {
  return Promise.race([
    queryPromise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${errorMessage} after ${timeoutMs}ms`));
      }, timeoutMs);
    })
  ]);
}

/**
 * Helper to add timeout to Prisma queries
 * Usage: await withPrismaTimeout(prisma.user.findMany({...}), 5000)
 */
export const withPrismaTimeout = withQueryTimeout;
