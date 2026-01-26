#!/usr/bin/env node
/**
 * Check migration coverage - verify all schema models have corresponding migrations
 */

const fs = require('fs');
const path = require('path');

// Read schema
const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
const schema = fs.readFileSync(schemaPath, 'utf8');

// Extract models and their table mappings
const models = [];
let currentModel = null;
let currentMap = null;

schema.split('\n').forEach(line => {
  const modelMatch = line.match(/^model\s+(\w+)/);
  if (modelMatch) {
    if (currentModel) {
      models.push({ 
        name: currentModel, 
        tableName: currentMap || currentModel.toLowerCase()
      });
    }
    currentModel = modelMatch[1];
    currentMap = null;
  }
  const mapMatch = line.match(/@@map\(['\"]([^'\"]+)['\"]\)/);
  if (mapMatch) {
    currentMap = mapMatch[1];
  }
});
if (currentModel) {
  models.push({ 
    name: currentModel, 
    tableName: currentMap || currentModel.toLowerCase()
  });
}

// Extract tables from migrations
const migrationsDir = path.join(__dirname, '../prisma/migrations');
const migrationTables = new Set();

fs.readdirSync(migrationsDir, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory() && /^\d/.test(dirent.name))
  .forEach(dir => {
    const migrationFile = path.join(migrationsDir, dir.name, 'migration.sql');
    if (fs.existsSync(migrationFile)) {
      const migration = fs.readFileSync(migrationFile, 'utf8');
      const tableMatches = migration.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?([^"'\s(]+)["']?/gi);
      for (const match of tableMatches) {
        migrationTables.add(match[1]);
      }
    }
  });

// Find missing migrations
const missing = models.filter(model => {
  // Check both the model name (lowercase) and the mapped table name
  const modelNameLower = model.name.toLowerCase();
  const tableName = model.tableName;
  
  return !migrationTables.has(modelNameLower) && 
         !migrationTables.has(tableName) &&
         !migrationTables.has(model.name);
});

console.log('='.repeat(80));
console.log('MIGRATION COVERAGE ANALYSIS');
console.log('='.repeat(80));
console.log(`\nTotal models in schema: ${models.length}`);
console.log(`Total tables in migrations: ${migrationTables.size}`);
console.log(`\nPotentially missing migrations: ${missing.length}`);

if (missing.length > 0) {
  console.log('\n⚠️  Models that may not have migrations:');
  missing.slice(0, 50).forEach(m => {
    console.log(`  - ${m.name} (table: ${m.tableName})`);
  });
  if (missing.length > 50) {
    console.log(`  ... and ${missing.length - 50} more`);
  }
} else {
  console.log('\n✅ All models appear to have migrations!');
}

// Show some examples of what's in migrations
console.log('\n' + '='.repeat(80));
console.log('Sample tables found in migrations:');
Array.from(migrationTables).slice(0, 20).forEach(t => console.log(`  - ${t}`));
