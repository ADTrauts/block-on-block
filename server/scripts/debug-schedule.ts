import { getScheduleById, getShifts } from '../src/controllers/schedulingController';
import { prisma } from '../src/lib/prisma';

interface MockReq {
  user?: { id: string };
  params?: Record<string, string>;
  query?: Record<string, string>;
}

interface MockRes {
  status: (code: number) => MockRes;
  json: (data: unknown) => void;
}

function createRes(label: string): MockRes {
  return {
    status(code: number) {
      console.log(`[${label}] status:`, code);
      return this;
    },
    json(data: unknown) {
      console.log(`[${label}] json:`, JSON.stringify(data, null, 2));
    }
  };
}

async function main(): Promise<void> {
  const scheduleId = process.env.DEBUG_SCHEDULE_ID;
  const businessId = process.env.DEBUG_BUSINESS_ID;
  const userId = process.env.DEBUG_USER_ID;

  if (!scheduleId || !businessId || !userId) {
    console.error('Missing required env vars DEBUG_SCHEDULE_ID, DEBUG_BUSINESS_ID, DEBUG_USER_ID');
    process.exit(1);
  }

  const reqSchedule: MockReq = {
    user: { id: userId },
    params: { id: scheduleId },
    query: { businessId }
  };

  const resSchedule = createRes('schedule');

  console.log('=== Debug getScheduleById ===');
  await getScheduleById(reqSchedule as any, resSchedule as any);

  const reqShifts: MockReq = {
    user: { id: userId },
    query: { businessId, scheduleId }
  };

  const resShifts = createRes('shifts');
  console.log('=== Debug getShifts ===');
  await getShifts(reqShifts as any, resShifts as any);

  await prisma.$disconnect();
}

main().catch(error => {
  console.error('Debug script failed', error);
  prisma.$disconnect();
  process.exit(1);
});

