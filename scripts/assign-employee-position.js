// Quick script to assign user to a position for scheduling availability
// Usage: node scripts/assign-employee-position.js <userId> <businessId>

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function assignEmployeePosition(userId, businessId) {
  try {
    console.log(`\n🔍 Checking positions for business ${businessId}...`);
    
    // Get existing positions
    const positions = await prisma.position.findMany({
      where: { businessId },
      include: { tier: true }
    });
    
    console.log(`Found ${positions.length} existing positions`);
    
    let positionId;
    
    if (positions.length === 0) {
      console.log('\n📋 No positions found. Creating default structure...');
      
      // Create a default tier
      const tier = await prisma.organizationalTier.upsert({
        where: {
          businessId_name: {
            businessId,
            name: 'Employee'
          }
        },
        update: {},
        create: {
          businessId,
          name: 'Employee',
          level: 5,
          description: 'Default tier for employees'
        }
      });
      
      console.log(`✅ Created tier: ${tier.name} (level ${tier.level})`);
      
      // Create a default position
      const position = await prisma.position.create({
        data: {
          businessId,
          title: 'Employee',
          tierId: tier.id,
          maxOccupants: 100
        }
      });
      
      positionId = position.id;
      console.log(`✅ Created position: ${position.title} (${position.id})`);
    } else {
      // Use first available position
      positionId = positions[0].id;
      console.log(`\n✅ Using existing position: ${positions[0].title} (${positionId})`);
    }
    
    // Check if user already has an active position
    const existing = await prisma.employeePosition.findFirst({
      where: {
        userId,
        businessId,
        active: true
      }
    });
    
    if (existing) {
      console.log(`\n⚠️  User already has an active position: ${existing.id}`);
      console.log(`   Position: ${existing.positionId}`);
      console.log(`   This should work for scheduling availability!`);
      return;
    }
    
    // Assign user to position
    console.log(`\n👤 Assigning user ${userId} to position ${positionId}...`);
    
    const assignment = await prisma.employeePosition.create({
      data: {
        userId,
        positionId,
        businessId,
        assignedById: userId, // Self-assigned
        startDate: new Date(),
        active: true
      },
      include: {
        position: { include: { tier: true } },
        user: { select: { id: true, name: true, email: true } }
      }
    });
    
    console.log(`\n✅ Successfully assigned user to position!`);
    console.log(`   User: ${assignment.user.name} (${assignment.user.email})`);
    console.log(`   Position: ${assignment.position.title}`);
    console.log(`   Tier: ${assignment.position.tier.name} (level ${assignment.position.tier.level})`);
    console.log(`   EmployeePosition ID: ${assignment.id}`);
    console.log(`\n🎉 You can now set availability for scheduling!`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code === 'P2002') {
      console.error('   This user is already assigned to this position.');
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

const userId = process.argv[2];
const businessId = process.argv[3];

if (!userId || !businessId) {
  console.error('Usage: node scripts/assign-employee-position.js <userId> <businessId>');
  console.error('Example: node scripts/assign-employee-position.js 46a817d0-fe60-4379-866c-1888a215481d 4f310a85-4a47-451e-8286-1470f364605b');
  process.exit(1);
}

assignEmployeePosition(userId, businessId).catch(console.error);

