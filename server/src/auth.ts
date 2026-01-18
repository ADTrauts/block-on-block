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
  
  // Detect user location
  const location = await geolocationService.detectUserLocation(clientIP);
  
  // Generate user number
  const userNumberData = await userNumberService.generateUserNumber(location);
  
  const userData: Prisma.UserCreateInput = {
    email,
    password: hashedPassword,
    name,
    userNumber: userNumberData.userNumber,
    country: { connect: { id: userNumberData.countryId } },
    region: { connect: { id: userNumberData.regionId } },
    town: { connect: { id: userNumberData.townId } },
    locationDetectedAt: new Date()
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