#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const MODULES_DIR = path.join(__dirname, '../prisma/modules');
const OUTPUT_FILE = path.join(__dirname, '../prisma/schema.prisma');
const MAIN_SCHEMA_HEADER = path.join(__dirname, '../prisma/schema-header.prisma');

// Prisma schema header (generator, datasource, enums)
const SCHEMA_HEADER = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================================
// ENUMS
// ============================================================================

enum Role {
  USER
  ADMIN
}

enum HouseholdType {
  PRIMARY    // Family unit
  SECONDARY  // Roommates, etc.
}

enum HouseholdRole {
  OWNER
  ADMIN
  ADULT
  TEEN
  CHILD
  TEMPORARY_GUEST
}

enum ConversationType {
  DIRECT
  GROUP
  CHANNEL
}

enum MessageType {
  TEXT
  FILE
  SYSTEM
  REACTION
}

enum ThreadType {
  MESSAGE
  TOPIC
  PROJECT
  DECISION
  DOCUMENTATION
}

enum ParticipantRole {
  OWNER
  ADMIN
  MODERATOR
  MEMBER
  GUEST
}

enum BusinessRole {
  EMPLOYEE
  ADMIN
  MANAGER
}

enum InstitutionType {
  UNIVERSITY
  COLLEGE
  HIGH_SCHOOL
  ELEMENTARY_SCHOOL
}

enum InstitutionRole {
  STUDENT
  FACULTY
  STAFF
}

enum RelationshipStatus {
  PENDING
  ACCEPTED
  DECLINED
  BLOCKED
}

enum RelationshipType {
  REGULAR
  COLLEAGUE
}

enum ModuleStatus {
  DRAFT
  PENDING
  APPROVED
  REJECTED
  SUSPENDED
}

enum ModuleCategory {
  PRODUCTIVITY
  COMMUNICATION
  ANALYTICS
  DEVELOPMENT
  ENTERTAINMENT
  EDUCATION
  FINANCE
  HEALTH
  OTHER
}

enum AIRequestStatus {
  PENDING
  APPROVED
  REJECTED
  EXPIRED
  EXECUTED
}

enum AIInteractionType {
  QUERY
  ACTION_REQUEST
  LEARNING
  FEEDBACK
  CORRECTION
}

enum CalendarType {
  LOCAL
  EXTERNAL
  RESOURCE
  SUBSCRIPTION
}

enum CalendarContextType {
  PERSONAL
  BUSINESS
  HOUSEHOLD
}

enum EventStatus {
  CONFIRMED
  TENTATIVE
  CANCELED
}

enum ReminderMethod {
  APP
  EMAIL
}

// ============================================================================
// MODULE SCHEMAS
// ============================================================================

`;

// Function to read and concatenate module files
function buildSchema() {
  console.log('🔨 Building Prisma schema from modules...');
  
  let schema = SCHEMA_HEADER;
  
  // Read all module files in order
  const moduleOrder = [
    'auth',
    'chat',
    'business',
    'ai',
    'billing',
    'calendar',
    'drive',
    'admin',
    'support',
    'hr',
    'scheduling'
  ];
  
  for (const moduleName of moduleOrder) {
    const moduleDir = path.join(MODULES_DIR, moduleName);
    
    if (fs.existsSync(moduleDir)) {
      console.log(`📁 Processing module: ${moduleName}`);
      
      // Read all .prisma files in the module directory
      const files = fs.readdirSync(moduleDir)
        .filter(file => file.endsWith('.prisma'))
        .sort(); // Ensure consistent ordering
      
      for (const file of files) {
        const filePath = path.join(moduleDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Add module header
        schema += `\n// ============================================================================\n`;
        schema += `// ${moduleName.toUpperCase()} MODULE\n`;
        schema += `// ============================================================================\n\n`;
        
        // Add file content
        schema += content;
        schema += '\n';
        
        console.log(`  ✅ Added: ${file}`);
      }
    }
  }
  
  // Write the combined schema
  fs.writeFileSync(OUTPUT_FILE, schema);
  console.log(`\n🎉 Schema built successfully!`);
  console.log(`📄 Output: ${OUTPUT_FILE}`);
  console.log(`📊 Total size: ${(schema.length / 1024).toFixed(1)} KB`);
}

// Run the build
if (require.main === module) {
  try {
    buildSchema();
  } catch (error) {
    console.error('❌ Error building schema:', error);
    process.exit(1);
  }
}

module.exports = { buildSchema };
