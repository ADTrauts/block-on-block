#!/bin/bash

# Script to seed pricing data from hardcoded config to database

echo "🌱 Seeding pricing configurations..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: Must run from project root"
  exit 1
fi

# Run the seed script using node
cd server/src/scripts
node -r ts-node/register seedPricing.ts

if [ $? -eq 0 ]; then
  echo "✅ Pricing seeding completed successfully!"
else
  echo "❌ Pricing seeding failed"
  exit 1
fi

