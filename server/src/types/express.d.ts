// Extend Express types to include the full Prisma User type
import { User as PrismaUser } from '@prisma/client';

declare global {
  namespace Express {
    interface User extends PrismaUser {
      // The User interface now includes all Prisma User fields:
      // id, name, email, password, role, userNumber, etc.
    }
    
    interface Request {
      user?: User;
      originalUser?: User;
      impersonation?: {
        id: string;
        adminId: string;
        targetUserId: string;
        businessId?: string | null;
        context?: string | null;
        startedAt: Date;
        expiresAt?: Date | null;
      };
    }
  }
}

export {};