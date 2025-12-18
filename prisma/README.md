# Prisma Schema Organization

⚠️ **IMPORTANT: Always use the modular system!** ⚠️

This directory contains the organized Prisma schema files for the Block on Block platform. The schema is split into logical modules for better maintainability and organization.

🗂️ **Legacy/backup schema files have been moved to `archive/` directory**

## Structure

```
prisma/
├── schema.prisma          # Generated main schema (DO NOT EDIT DIRECTLY)
├── modules/               # Source schema modules
│   ├── auth/             # Authentication & User Management
│   │   └── user.prisma
│   ├── chat/             # Chat & Communication
│   │   └── conversations.prisma
│   ├── business/         # Business & Enterprise Features
│   │   ├── business.prisma
│   │   ├── dashboard.prisma
│   │   ├── household.prisma
│   │   ├── modules.prisma
│   │   └── org-chart.prisma
│   ├── ai/               # AI & Machine Learning
│   │   ├── ai-models.prisma
│   │   ├── analytics.prisma
│   │   └── enterprise-ai.prisma
│   ├── billing/          # Billing & Subscriptions
│   │   └── subscriptions.prisma
│   ├── calendar/         # Calendar & Events
│   │   └── calendars.prisma
│   ├── drive/            # File Management
│   │   └── files.prisma
│   └── admin/            # Admin Portal & Security
│       ├── admin-portal.prisma
│       └── security.prisma
└── README.md             # This file
```

## Module Descriptions

### Auth Module (`modules/auth/`)
- **User Management**: Core user models, authentication tokens, preferences
- **Privacy & Consent**: GDPR compliance, data deletion requests, privacy settings
- **Location System**: User numbering system with country/region/town hierarchy

### Chat Module (`modules/chat/`)
- **Conversations**: Chat rooms, direct messages, group chats
- **Messages**: Text, file references, reactions, read receipts
- **Threads**: Nested conversation threads with participants

### Business Module (`modules/business/`)
- **Business Management**: Company profiles, departments, jobs, SSO configs
- **Dashboard System**: User dashboards with widgets and compliance settings
- **Household Management**: Family/roommate organization structures
- **Module Marketplace**: Third-party module system with reviews and submissions
- **Org Chart**: Organizational hierarchy with positions and permissions

### AI Module (`modules/ai/`)
- **AI Models**: Personality profiles, autonomy settings, approval workflows
- **Analytics Platform**: Real-time metrics, predictive intelligence, business insights
- **Enterprise AI**: Business-specific AI digital twins with learning capabilities

### Billing Module (`modules/billing/`)
- **Subscriptions**: Core platform tiers and module-specific subscriptions
- **Usage Tracking**: API calls, storage, AI requests, message counts
- **Revenue Management**: Developer payouts, platform revenue tracking

### Calendar Module (`modules/calendar/`)
- **Calendars**: Multi-context calendars (personal, business, household)
- **Events**: Recurring events, attendees, reminders, attachments
- **Integration**: External calendar provider support

### Drive Module (`modules/drive/`)
- **File Management**: Files, folders, permissions, activity tracking
- **Organization**: Hierarchical folder structure with drag-and-drop ordering
- **Sharing**: Granular file permissions and access control

### Admin Module (`modules/admin/`)
- **Content Moderation**: User reports, content filtering, review workflows
- **System Monitoring**: Metrics, configuration, security events
- **Security & Compliance**: SSO providers, compliance frameworks, audit logs

## Development Workflow

### 1. Making Schema Changes
**Never edit `schema.prisma` directly!** Instead:

1. **Edit the appropriate module file** in `prisma/modules/[module]/`
2. **Run the build script** to regenerate the main schema:
   ```bash
   npm run prisma:build
   ```
3. **Generate the Prisma client**:
   ```bash
   npm run prisma:generate
   ```

### 2. Adding New Models
1. **Identify the appropriate module** for your new model
2. **Add the model** to the corresponding `.prisma` file
3. **Update relationships** in other models if needed
4. **Run the build script** to regenerate the schema

### 3. Database Migrations
After making schema changes:

```bash
# Build the schema
npm run prisma:build

# Create and apply migration
npm run prisma:migrate

# Generate updated client
npm run prisma:generate
```

> **Tip:** Run these commands from the repository root so they can find `prisma/schema.prisma`. Workspace package scripts (e.g. `pnpm --filter vssyl-server prisma:migrate`) now call the root build step automatically and pass the explicit `--schema ../prisma/schema.prisma` flag.

## Build Script

The `scripts/build-prisma-schema.js` script:

1. **Reads all module files** in the correct order
2. **Concatenates them** into a single schema file
3. **Adds module headers** for clear separation
4. **Generates the final schema** in `prisma/schema.prisma`

### Module Order
The build script processes modules in this specific order to ensure proper dependency resolution:

1. `auth` - Core user models
2. `chat` - Communication models
3. `business` - Business and enterprise models
4. `ai` - AI and analytics models
5. `billing` - Subscription and billing models
6. `calendar` - Calendar and event models
7. `drive` - File management models
8. `admin` - Admin and security models

## Benefits of This Organization

✅ **Easier Navigation** - Find models quickly by domain  
✅ **Better Team Collaboration** - Different developers can work on different modules  
✅ **Cleaner Git Diffs** - Changes are isolated to specific modules  
✅ **Easier Testing** - Test specific domains in isolation  
✅ **Better Documentation** - Each module can have its own README  
✅ **Easier Migrations** - Understand what changed in each domain  
✅ **Reduced Merge Conflicts** - Less chance of conflicts when working on different modules  

## Package.json Scripts

The following npm scripts are available:

- `npm run prisma:build` - Build the schema from modules
- `npm run prisma:generate` - Build schema and generate Prisma client
- `npm run prisma:migrate` - Build schema and run migrations
- `npm run prisma:studio` - Build schema and open Prisma Studio

## Troubleshooting

### Build Errors
- Ensure all module files have valid Prisma syntax
- Check that model relationships are properly defined
- Verify that all referenced models exist

### Migration Issues
- Always run `npm run prisma:build` before migrations
- Check that the generated schema is valid
- Verify that all required models are present

#### Non-empty databases (baseline required)

If you point Prisma at an existing database that already has tables, `_prisma_migrations` may be empty and `prisma migrate deploy` will error with `P3005`. To baseline that environment:

```bash
# Mark historical migrations as already applied (no SQL is executed)
pnpm --filter vssyl-server exec prisma migrate resolve \
  --schema ../prisma/schema.prisma \
  --applied <migration_folder_name>

# Example for the HR schedule calendar migration
pnpm --filter vssyl-server exec prisma migrate resolve \
  --schema ../prisma/schema.prisma \
  --applied 20251107_add_hr_schedule_calendar

# Then deploy new migrations normally
pnpm --filter vssyl-server exec prisma migrate deploy --schema ../prisma/schema.prisma
```

Only baseline databases you trust already contain the schema changes; otherwise apply migrations against a fresh database instead.

### Client Generation Issues
- Ensure the schema builds successfully first
- Check for syntax errors in module files
- Verify that all model relationships are valid

## Best Practices

1. **Keep models focused** - Each model should have a single responsibility
2. **Use clear naming** - Model and field names should be descriptive
3. **Document relationships** - Add comments explaining complex relationships
4. **Group related models** - Keep related models in the same module file
5. **Test changes** - Always test schema changes before committing
6. **NEVER edit migration files after they've been applied** - ⚠️ **CRITICAL RULE**
   - Once a migration is applied to any database (dev, staging, or production), it becomes **immutable**
   - Editing migrations causes schema drift and requires database resets
   - ✅ **If you need changes**: Create a new migration instead
   - ❌ **Never do this**: Edit files in `prisma/migrations/[migration-name]/migration.sql`
   - **Why**: Migrations are historical records. Changing them breaks the migration history and causes drift between environments.

## Future Enhancements

- **Module-specific READMEs** - Detailed documentation for each module
- **Schema validation** - Automated checks for schema consistency
- **Migration helpers** - Tools for complex schema migrations
- **Visual documentation** - ERD diagrams for each module
