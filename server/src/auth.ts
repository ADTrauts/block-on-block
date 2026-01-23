import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User, Prisma } from '@prisma/client';
import { prisma } from './lib/prisma';
import { geolocationService } from './services/geolocationService';
import { userNumberService } from './services/userNumberService';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined in the environment variables');
}

// Configure local strategy
passport.use(new LocalStrategy(
  { usernameField: 'email' },
  async (email, password, done) => {
    try {
      // Test database connection first
      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch (dbError) {
        const dbErrorMsg = dbError instanceof Error ? dbError.message : 'Unknown database error';
        console.error('❌ [LOGIN] Database connection test failed:', dbErrorMsg);
        // Return a specific error that can be caught by the login handler
        return done(new Error('Database connection failed'), false, { message: 'Database temporarily unavailable. Please try again.' });
      }
      
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          password: true,
          name: true,
          role: true,
          emailVerified: true,
          userNumber: true,
          createdAt: true,
          updatedAt: true,
          image: true,
          personalPhoto: true,
          businessPhoto: true,
          personalPhotoId: true,
          businessPhotoId: true,
          stripeCustomerId: true,
          countryId: true,
          regionId: true,
          townId: true,
          locationDetectedAt: true,
          locationUpdatedAt: true
        }
      });

      if (!user) {
        return done(null, false, { message: 'Incorrect email.' });
      }

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return done(null, false, { message: 'Incorrect password.' });
      }

      return done(null, user);
    } catch (error) {
      // Check if it's a database connection error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('Can\'t reach database') || 
          errorMessage.includes('connection pool') ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('PrismaClientInitializationError') ||
          (typeof error === 'object' && error && 'code' in error && 
           ((error as Record<string, unknown>).code === 'P1001' || 
            (error as Record<string, unknown>).code === 'P1002'))) {
        console.error('❌ [LOGIN] Database error during authentication:', errorMessage);
        return done(new Error('Database connection failed'), false, { message: 'Database temporarily unavailable. Please try again.' });
      }
      // For other errors, log and return generic error
      console.error('❌ [LOGIN] Authentication error:', errorMessage);
      return done(error);
    }
  }
));

// JWT token generation
export function issueJWT(user: User) {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };

  const signedToken = jwt.sign(payload, JWT_SECRET!, { expiresIn: '24h' });

  return signedToken;
}

// Enhanced user registration with user number generation
export async function registerUser(
  email: string, 
  password: string, 
  name?: string, 
  clientIP?: string
): Promise<User> {
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // Detect user location with error handling
  let location;
  try {
    location = await geolocationService.detectUserLocation(clientIP);
  } catch (error) {
    console.error('Geolocation error during registration, using default location:', error);
    // Use default location if geolocation fails
    location = {
      country: 'United States',
      region: 'New York',
      city: 'New York',
      countryCode: '1',
      regionCode: '06'
    };
  }
  
  // Generate user number with error handling
  let userNumberData: { userNumber: string; countryId: string; regionId: string; townId: string } | null = null;
  try {
    userNumberData = await userNumberService.generateUserNumber(location);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('User number generation error during registration:', errorMessage);
    
    // If database error, try to continue without location data
    // This allows registration to work even if location tables aren't set up
    if (errorMessage.includes('database') || errorMessage.includes('connection') || errorMessage.includes('empty host') || errorMessage.includes('Invalid')) {
      console.warn('⚠️  User number generation failed, continuing without location data. Registration will proceed with minimal user setup.');
      // userNumberData remains null - we'll handle this below
    } else {
      // Re-throw non-database errors
      throw error;
    }
  }
  
  // Build user data with or without location
  const userData: Prisma.UserCreateInput = {
    email,
    password: hashedPassword,
    name,
    ...(userNumberData ? {
      userNumber: userNumberData.userNumber,
      country: { connect: { id: userNumberData.countryId } },
      region: { connect: { id: userNumberData.regionId } },
      town: { connect: { id: userNumberData.townId } },
      locationDetectedAt: new Date()
    } : {
      // Fallback: create user without location if userNumber generation failed
      // Note: userNumber, countryId, regionId, townId are optional in schema
      // We'll skip userNumber for now - it can be generated later when the database is fixed
      // userNumber will be null, which is allowed by the schema
    })
  };

  return prisma.user.create({
    data: userData,
    select: {
      id: true,
      email: true,
      password: true,
      name: true,
      role: true,
      emailVerified: true,
      userNumber: true,
      image: true,
      personalPhoto: true,
      businessPhoto: true,
      personalPhotoId: true,
      businessPhotoId: true,
      stripeCustomerId: true,
      createdAt: true,
      updatedAt: true,
      countryId: true,
      regionId: true,
      townId: true,
      locationDetectedAt: true,
      locationUpdatedAt: true
    }
  });
}

export default passport; 