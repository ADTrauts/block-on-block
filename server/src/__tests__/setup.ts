import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { prisma } from '../lib/prisma';

// Clean up database before each test
beforeEach(async () => {
  // Clean up test data if needed
  // Note: In a real scenario, you might want to use a test database
  // For now, we'll rely on proper test isolation
});

// Close Prisma connection after all tests
afterAll(async () => {
  await prisma.$disconnect();
});

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-key-for-testing-only';

