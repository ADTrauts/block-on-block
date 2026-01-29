import express, { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import * as bcrypt from 'bcrypt';

const router: express.Router = express.Router();

// Special endpoint to create Andrew's admin account in production
// This is a one-time setup endpoint that should be removed after use
router.post('/create-andrew-admin', async (req: Request, res: Response) => {
  try {
    console.log('🚀 Creating Andrew admin user in production...');
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: 'Andrew.Trautman@Vssyl.con' },
      select: { id: true, email: true, name: true, role: true }
    });

    if (existingUser) {
      if (existingUser.role === 'ADMIN') {
        return res.json({
          success: true,
          message: 'User is already an admin',
          user: {
            email: existingUser.email,
            name: existingUser.name,
            role: existingUser.role
          }
        });
      } else {
        // Promote to admin
        const updatedUser = await prisma.user.update({
          where: { email: 'Andrew.Trautman@Vssyl.con' },
          data: { role: 'ADMIN' },
          select: { id: true, email: true, name: true, role: true }
        });
        
        return res.json({
          success: true,
          message: 'User promoted to admin successfully',
          user: {
            email: updatedUser.email,
            name: updatedUser.name,
            role: updatedUser.role
          }
        });
      }
    } else {
      // Create new admin user
      const password = 'VssylAdmin2025!';
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const newUser = await prisma.user.create({
        data: {
          email: 'Andrew.Trautman@Vssyl.con',
          password: hashedPassword,
          name: 'Andrew Trautman',
          role: 'ADMIN',
          emailVerified: new Date(),
        },
      });

      return res.json({
        success: true,
        message: 'Admin user created successfully',
        user: {
          email: newUser.email,
          name: newUser.name,
          role: newUser.role
        },
        credentials: {
          email: newUser.email,
          password: password
        }
      });
    }

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create admin user',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update admin user password
router.post('/update-andrew-password', async (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required'
      });
    }

    console.log('🔐 Updating Andrew admin password...');
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const updatedUser = await prisma.user.update({
      where: { email: 'Andrew.Trautman@Vssyl.con' },
      data: { password: hashedPassword },
      select: { id: true, email: true, name: true, role: true }
    });

    return res.json({
      success: true,
      message: 'Admin password updated successfully',
      user: {
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role
      }
    });

  } catch (error) {
    console.error('❌ Error updating admin password:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update admin password',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Check if user exists and promote to admin
router.post('/promote-existing-user', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    console.log(`🔍 Looking for existing user: ${email}`);
    
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true, createdAt: true }
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (existingUser.role === 'ADMIN') {
      return res.json({
        success: true,
        message: 'User is already an admin',
        user: {
          email: existingUser.email,
          name: existingUser.name,
          role: existingUser.role,
          createdAt: existingUser.createdAt
        }
      });
    }

    // Promote to admin
    const updatedUser = await prisma.user.update({
      where: { email },
      data: { role: 'ADMIN' },
      select: { id: true, email: true, name: true, role: true, createdAt: true }
    });

    return res.json({
      success: true,
      message: 'User promoted to admin successfully',
      user: {
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        createdAt: updatedUser.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Error promoting user:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to promote user',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete duplicate admin account
router.delete('/delete-duplicate-admin', async (req: Request, res: Response) => {
  try {
    console.log('🗑️ Deleting duplicate admin account...');
    
    const deletedUser = await prisma.user.delete({
      where: { email: 'Andrew.Trautman@Vssyl.con' },
      select: { id: true, email: true, name: true, role: true, createdAt: true }
    });

    return res.json({
      success: true,
      message: 'Duplicate admin account deleted successfully',
      deletedUser
    });

  } catch (error) {
    console.error('❌ Error deleting duplicate admin:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete duplicate admin',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get current admin users
router.get('/admin-users', async (req: Request, res: Response) => {
  try {
    const adminUsers = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { email: true, name: true, role: true, createdAt: true }
    });

    return res.json({
      success: true,
      adminUsers
    });

  } catch (error) {
    console.error('❌ Error fetching admin users:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch admin users'
    });
  }
});

// Get all users (for debugging)
router.get('/all-users', async (req: Request, res: Response) => {
  try {
    const allUsers = await prisma.user.findMany({
      select: { email: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' }
    });

    return res.json({
      success: true,
      totalUsers: allUsers.length,
      users: allUsers
    });

  } catch (error) {
    console.error('❌ Error fetching all users:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch all users'
    });
  }
});

// TEMPORARY: Fix failed migrations (remove after use)
router.get('/fix-migrations', async (req: Request, res: Response) => {
  try {
    console.log('🔧 Checking migration status...');
    
    // Get current migration status
    const migrations = await prisma.$queryRaw<Array<{
      id: string;
      migration_name: string;
      started_at: Date;
      finished_at: Date | null;
    }>>`
      SELECT id, migration_name, started_at, finished_at
      FROM "_prisma_migrations"
      ORDER BY started_at DESC;
    `;

    const failedMigrations = migrations.filter(m => !m.finished_at);

    return res.json({
      success: true,
      totalMigrations: migrations.length,
      failedCount: failedMigrations.length,
      migrations: migrations.map(m => ({
        name: m.migration_name,
        status: m.finished_at ? 'applied' : 'failed',
        startedAt: m.started_at,
        finishedAt: m.finished_at
      })),
      failedMigrations: failedMigrations.map(m => m.migration_name)
    });

  } catch (error) {
    console.error('❌ Error checking migrations:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check migrations',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// TEMPORARY: Mark failed migrations as applied (remove after use)
router.post('/fix-migrations', async (req: Request, res: Response) => {
  try {
    console.log('🔧 Fixing failed migrations...');
    
    // Find failed migrations (WHERE finished_at IS NULL)
    const failedMigrations = await prisma.$queryRaw<Array<{
      id: string;
      migration_name: string;
    }>>`
      SELECT id, migration_name
      FROM "_prisma_migrations"
      WHERE finished_at IS NULL;
    `;

    if (failedMigrations.length === 0) {
      return res.json({
        success: true,
        message: 'No failed migrations found',
        fixed: []
      });
    }

    // Mark each failed migration as applied
    const fixed: string[] = [];
    for (const migration of failedMigrations) {
      await prisma.$executeRaw`
        UPDATE "_prisma_migrations"
        SET finished_at = NOW(),
            logs = COALESCE(logs, '') || E'\n[SETUP FIX] Marked as applied at ' || NOW()::text
        WHERE id = ${migration.id};
      `;
      fixed.push(migration.migration_name);
      console.log(`✅ Fixed migration: ${migration.migration_name}`);
    }

    return res.json({
      success: true,
      message: `Fixed ${fixed.length} failed migration(s)`,
      fixed
    });

  } catch (error) {
    console.error('❌ Error fixing migrations:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fix migrations',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// TEMPORARY: Delete duplicate migration records (remove after use)
router.delete('/fix-migrations/duplicates', async (req: Request, res: Response) => {
  try {
    console.log('🧹 Cleaning up duplicate migration records...');
    
    // Find duplicates (same migration_name, keep the successful one)
    const duplicates = await prisma.$queryRaw<Array<{
      id: string;
      migration_name: string;
      finished_at: Date | null;
    }>>`
      SELECT m1.id, m1.migration_name, m1.finished_at
      FROM "_prisma_migrations" m1
      WHERE EXISTS (
        SELECT 1 FROM "_prisma_migrations" m2 
        WHERE m2.migration_name = m1.migration_name 
        AND m2.id != m1.id
      )
      ORDER BY migration_name, finished_at DESC NULLS LAST;
    `;

    // Group by migration name and keep only the first (successful) one
    const toDelete: string[] = [];
    const seen = new Set<string>();
    
    for (const dup of duplicates) {
      if (seen.has(dup.migration_name)) {
        // This is a duplicate - delete it
        toDelete.push(dup.id);
        console.log(`🗑️ Marking for deletion: ${dup.migration_name} (id: ${dup.id})`);
      } else {
        // First occurrence - keep it
        seen.add(dup.migration_name);
        console.log(`✅ Keeping: ${dup.migration_name} (id: ${dup.id})`);
      }
    }

    if (toDelete.length === 0) {
      return res.json({
        success: true,
        message: 'No duplicate migrations found',
        deleted: []
      });
    }

    // Delete duplicates
    for (const id of toDelete) {
      await prisma.$executeRaw`
        DELETE FROM "_prisma_migrations" WHERE id = ${id};
      `;
    }

    return res.json({
      success: true,
      message: `Deleted ${toDelete.length} duplicate migration record(s)`,
      deletedIds: toDelete
    });

  } catch (error) {
    console.error('❌ Error cleaning duplicates:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to clean duplicates',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;