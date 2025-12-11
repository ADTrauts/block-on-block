# Calendar Product Context

## Purpose
Advanced, tab-bound calendar system that unifies personal, work, and household scheduling. Calendars mirror tab names, auto-provision per context, support combined overlays, and integrate with Drive, Chat, Notifications, and AI systems.

## Why It Matters
- Single source for life/work/household scheduling
- Context-correct permissions (business roles; household child protections)
- Powerful views and parity with leading calendars; consistent UX across the platform

## Core UX & Navigation
- Routes: `calendar` with subviews Day, Week, Month, Year
- Sidebar grouped by tabs (Personal, Work/Business, Household, Subscriptions)
- Per-calendar color and visibility toggles; drag to reorder; quick-add
- Combined overlay defaults to **All Tabs**; toggle to Current Tab
- New events default to the active tab’s primary calendar (override with calendar picker)
- Icons align with Drive; use global font preferences

## Tab-Bound Calendars
- Personal: Main calendar (undeletable), mirrors first tab name; created at signup (isSystem=true, isPrimary=true, isDeletable=false)
- Work/Business: Auto-provision primary calendar on connect/join; name mirrors business tab; roles map from business roles
- Household: Auto-provision shared calendar on create/join; name mirrors household tab; child protections enforced
  - Default permissions: Owner/Admin/Adult = edit; Teen/Child = read-only; Temporary Guest = time-limited read

## Views and Interactions (Phase 1)
- Views: Day, Week, Month, Year
- Drag/move/resize events with conflict highlighting
- Event drawer: title, description, location, online meeting link, attendees, reminders, attachments (Drive)
- Timezone-aware rendering; DST-safe logic; keyboard shortcuts (N/D/W/M/Y)

## Features by Phase
- Phase 1 (Core + Tabs binding): ✅ **COMPLETED**
  - Context-bound calendars with auto-provisioning; names mirror tabs
  - Day/Week/Month/Year; combined overlay (default All Tabs)
  - Event CRUD, reminders (defaults: timed=calendar minutes; all-day=9:00 AM same-day), Drive attachments, notifications
- Phase 2 (Recurrence + Sharing): ✅ **COMPLETED - Phase 2f**
  - RRULE/EXDATE with exceptions (recurrenceRule persisted; exceptions via parentEventId); calendar sharing; attendees/RSVP; public/link calendars
  - **Advanced Month View**: Overlap stacking, continuation chevrons, drag-to-resize, enhanced event display
  - **Find Time Feature**: Free-busy checking, automatic slot suggestions, conflict resolution
  - **Advanced Filters & Search**: Debounced search, multi-criteria filtering, persistence
  - **ICS Import/Export**: Enhanced export with VTIMEZONE, import functionality, recurrence support
  - **Real-Time Collaboration**: Socket.io integration, live updates, collaborative editing
  - **RSVP Token System**: Secure public RSVP, email integration, response tracking
  - **RSVP UI Improvements (December 2025)**: ✅ Personal calendar modal now includes Accept/Maybe/Decline buttons in Attendees section
    - Buttons only appear when current user is an attendee
    - Visual feedback with color-coded highlighting (green=accepted, red=declined, yellow=tentative)
    - User-friendly status labels ("Pending Response" instead of "NEEDS_ACTION")
    - Auto-refresh of event list after RSVP response
  - **Module-Driven Architecture**: Tab-bound calendars with auto-provisioning
- Phase 3 (Availability + Assistant): 🎯 **NEXT PRIORITY**
  - Free-busy, multi-user availability, suggestions; working hours/focus/OOO; travel time
- Phase 4 (Integrations + Booking): 📋 **PLANNED**
  - Google/Microsoft sync (OAuth, webhooks), ICS subscriptions; booking links; resource calendars
- Phase 5 (AI, Analytics, Polish): 📋 **PLANNED**
  - Natural language creation; conflict hints; year analytics/heatmap; print/export; mobile polish

## Data Model (Outline)
- Calendar
  - `id`, `name` (mirrors tab), `color`, `type: LOCAL|EXTERNAL|RESOURCE|SUBSCRIPTION`
  - `contextType: 'personal'|'business'|'household'`, `contextId: string`
  - `defaultReminderMinutes`, `isPrimary`, `isSystem`, `isDeletable` (Main=false), `visibility`
- CalendarMember
  - `calendarId`, `userId`, `role: OWNER|ADMIN|EDITOR|READER|FREE_BUSY`
- Event
  - `id`, `calendarId`, `title`, `description`, `location`, `onlineMeetingLink`
  - `startAt`, `endAt`, `allDay`, `timezone`, `status: CONFIRMED|TENTATIVE|CANCELED`
  - `recurrenceRule` (RRULE), `recurrenceEndAt`, `parentEventId` (exceptions)
  - `createdBy`, `updatedBy`
- EventAttendee: `eventId`, `userId|email`, `response: NEEDS_ACTION|ACCEPTED|DECLINED|TENTATIVE`
- Reminder: `eventId`, `method: APP|EMAIL`, `minutesBefore`
- EventComment: `eventId`, `userId`, `content`, `createdAt`, `updatedAt`
- CalendarConnection: `userId`, `provider: GOOGLE|MICROSOFT|ICLOUD_ICS`, encrypted tokens, sync state
- ExternalMapping: `localId`, `externalId`, `provider`, `etag`, `lastSyncAt`
- Resource: `name`, `type`, `capacity`, `bookingPolicy`
- SubscriptionFeed: `url`, `refreshCadence`, `lastFetchedAt`
- EventAttachment: `eventId`, `driveFileId|externalUrl`

## APIs (High-Level)
- Calendars: CRUD, membership, color/visibility, auto-provision by context
- Events: CRUD, recurrence (RRULE persisted; exceptions planned), attendees, reminders, attachments; RSVP and comments endpoints; responses include `occurrenceStartAt`/`occurrenceEndAt` for expanded instances
- Availability: free-busy range; suggestions API
- Integrations: OAuth connect/disconnect, webhooks, ICS import/export/subscriptions; basic ICS export and free-busy available
- Booking/Resources (later phases)
- Realtime: socket channels for calendar/event updates and editing presence

## Permissions & Privacy
- Business roles map to calendar roles; enforce at controller and UI layers
- Household protections: Teen/Child read-only by default; Temporary Guest time-limited
- Free-busy masking when viewer lacks detail permissions
- Full audit logging of calendar/event actions

## Integrations
- Drive: event attachments and quick attach from drawer
- Chat: propose times from a thread; send invites; post summaries
- Notifications: reminders and change notifications with preferences
- Provider sync: Google/Microsoft; ICS import/export
- AI (later): natural language creation, conflict warnings, summaries

## Feature Gating (Billing)
- Free: Main personal calendar, basic CRUD, Day/Week/Month
- Standard: sharing, reminders, ICS, combined overlays
- Premium: provider sync, scheduling assistant, booking links, resources, Year analytics

## Acceptance Criteria (Phase 1)
- Main personal calendar exists (undeletable), named after first tab
- Business/Household tabs auto-provision calendars; names mirror tabs; child protections enforced
- Combined overlay defaults to All Tabs; toggle to Current Tab works
- Accurate Day/Week/Month/Year rendering; drag/move/resize with conflict feedback
- Reminders trigger via in-app notifications; snooze/dismiss (snooze planned)
- Drive attachments from event drawer; ESLint clean; strict typing

## Open Decision
- Default reminders (proposed): 10 minutes before start; all-day events at 9:00 AM (per-calendar override and per-event customization). Awaiting confirmation.

