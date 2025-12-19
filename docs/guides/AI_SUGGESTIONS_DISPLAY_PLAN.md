# AI Suggestions Display Plan

## Overview
This document outlines the plan for displaying AI-generated suggestions and recommendations to users in the AI Control Center. The system already generates various types of intelligent recommendations, but there's no unified UI to display them.

## Current State

### Existing Systems
1. **IntelligentRecommendationsEngine** - Generates 6 types of recommendations:
   - Productivity Optimization
   - Communication Enhancement
   - Organization Optimization
   - Learning Enhancement
   - Wellness Optimization
   - Efficiency Optimization

2. **Autonomous Actions** - Shows actionable suggestions that can be executed
   - Already has a UI component (`AutonomousActions.tsx`)
   - Shows suggestions, pending approvals, and history

3. **API Endpoints**:
   - `POST /api/ai/intelligence/recommendations/generate` - Generate recommendations
   - `GET /api/ai/intelligence/dashboard` - Get comprehensive intelligence data
   - `POST /api/ai/autonomous/suggest` - Generate action suggestions

### What's Missing
- No unified display for all recommendation types
- Recommendations are generated but not prominently shown to users
- No way to track which recommendations have been viewed/applied
- No categorization or filtering of recommendations

## Proposed Solution

### Option A: New "Suggestions" Tab in AI Control Center (RECOMMENDED)

**Location**: Add as a 6th tab in `/ai` page, between "Custom Context" and "Autonomous Actions"

**Features**:
1. **Unified Recommendations Display**
   - Show all types of recommendations in one place
   - Categorized by type (Productivity, Communication, Organization, etc.)
   - Filterable by category, priority, and status

2. **Recommendation Cards**
   - Each recommendation displayed as a card with:
     - Category badge (color-coded)
     - Title and description
     - Confidence score
     - Priority indicator
     - Action buttons (Apply, Dismiss, Learn More)
     - Timestamp

3. **Status Tracking**
   - New (unread)
   - Viewed
   - Applied
   - Dismissed
   - Expired

4. **Smart Grouping**
   - Group by category
   - Show high-priority recommendations first
   - Collapsible sections for each category

5. **Quick Actions**
   - "Apply All" for low-risk recommendations
   - Bulk dismiss
   - Mark as read

**UI Structure**:
```
Suggestions Tab
├── Header
│   ├── Total recommendations count
│   ├── Filter dropdown (All, Productivity, Communication, etc.)
│   └── Refresh button
├── Priority Section (High Priority)
│   └── Recommendation cards
├── Category Sections (Collapsible)
│   ├── Productivity
│   ├── Communication
│   ├── Organization
│   ├── Learning
│   ├── Wellness
│   └── Efficiency
└── Footer
    └── "Load More" or pagination
```

### Option B: Enhanced Overview Tab

**Location**: Add a "Recommendations" section to the existing Overview tab

**Features**:
- Show top 5-10 recommendations
- Link to full suggestions page
- Quick preview cards
- Less detailed than Option A

**Pros**: No new tab needed, integrated with existing overview
**Cons**: Limited space, less comprehensive

### Option C: Dedicated Suggestions Page

**Location**: New page at `/ai/suggestions`

**Features**: Same as Option A but as a separate page

**Pros**: More space, can be more detailed
**Cons**: Less discoverable, requires navigation

## Recommended Implementation: Option A

### Component Structure

```
web/src/components/ai/
├── Suggestions.tsx (Main component)
├── RecommendationCard.tsx (Individual recommendation display)
├── RecommendationCategory.tsx (Category section with collapsible)
└── RecommendationFilters.tsx (Filter controls)
```

### Data Flow

1. **Load Recommendations**
   - Call `POST /api/ai/intelligence/recommendations/generate` on component mount
   - Store in component state
   - Cache for 5-10 minutes

2. **User Interactions**
   - Apply: Execute recommendation action (if applicable)
   - Dismiss: Mark as dismissed, hide from view
   - Learn More: Show detailed explanation modal
   - Track interactions in database

3. **Status Updates**
   - Update recommendation status via API
   - Persist to database for future reference

### API Requirements

**New Endpoints Needed**:
1. `GET /api/ai/recommendations` - Get user's recommendations with status
2. `POST /api/ai/recommendations/:id/apply` - Apply a recommendation
3. `POST /api/ai/recommendations/:id/dismiss` - Dismiss a recommendation
4. `POST /api/ai/recommendations/:id/view` - Mark as viewed
5. `GET /api/ai/recommendations/stats` - Get recommendation statistics

**Database Schema** (if not exists):
```prisma
model AIRecommendation {
  id          String   @id @default(uuid())
  userId      String
  category    String   // productivity, communication, etc.
  title       String
  description String
  priority    String   // high, medium, low
  confidence  Float
  status      String   // new, viewed, applied, dismissed
  metadata    Json?    // Additional data
  createdAt   DateTime @default(now())
  viewedAt    DateTime?
  appliedAt   DateTime?
  dismissedAt DateTime?
  
  user        User     @relation(fields: [userId], references: [id])
  
  @@index([userId, status])
  @@index([category])
  @@map("ai_recommendations")
}
```

### UI/UX Considerations

1. **Visual Hierarchy**
   - High-priority recommendations at top
   - Use color coding for categories
   - Clear action buttons

2. **Progressive Disclosure**
   - Show summary by default
   - Expand for details
   - Modal for "Learn More"

3. **Feedback**
   - Toast notifications when applying
   - Confirmation for dismissals
   - Loading states for actions

4. **Empty States**
   - Friendly message when no recommendations
   - Suggest generating new recommendations
   - Link to other AI features

5. **Accessibility**
   - Keyboard navigation
   - Screen reader support
   - Clear focus indicators

### Integration Points

1. **Autonomous Actions Tab**
   - Some recommendations might be actionable
   - Link between suggestions and actions
   - Show which actions came from recommendations

2. **Custom Context Tab**
   - Recommendations might suggest adding context
   - Quick action to add context from recommendation

3. **Overview Tab**
   - Show recommendation count
   - Link to suggestions tab
   - Show top 3 recommendations

### Implementation Phases

**Phase 1: Basic Display** (MVP)
- [ ] Create `Suggestions.tsx` component
- [ ] Add "Suggestions" tab to AI Control Center
- [ ] Fetch and display recommendations
- [ ] Basic card layout
- [ ] Category grouping

**Phase 2: Interactions**
- [ ] Apply functionality
- [ ] Dismiss functionality
- [ ] View tracking
- [ ] Status persistence

**Phase 3: Enhanced Features**
- [ ] Filtering and sorting
- [ ] Search functionality
- [ ] Bulk actions
- [ ] Recommendation analytics

**Phase 4: Advanced Features**
- [ ] Recommendation explanations (AI-generated)
- [ ] Related recommendations
- [ ] Recommendation history
- [ ] Personalized prioritization

### Example Recommendation Types

1. **Productivity**
   - "You typically work best in the morning. Consider scheduling important tasks before noon."
   - "You have 5 unread messages. Would you like to batch respond?"

2. **Communication**
   - "You haven't responded to messages from [Name] in 3 days. Consider following up."
   - "Your response time has improved 20% this week. Great job!"

3. **Organization**
   - "You have 15 files in your Downloads folder. Would you like to organize them?"
   - "Consider creating a folder structure for your project files."

4. **Learning**
   - "You've been using the Calendar module frequently. Here are some advanced features."
   - "Based on your activity, you might benefit from the HR module."

5. **Wellness**
   - "You've been working for 4 hours straight. Consider taking a break."
   - "Your work-life balance looks good this week!"

6. **Efficiency**
   - "You manually create similar tasks weekly. Consider creating a template."
   - "You can automate this workflow with our automation feature."

### Success Metrics

- User engagement with recommendations
- Application rate (how many are applied)
- Dismissal rate (to improve recommendation quality)
- Time to action (how quickly users act on recommendations)
- User satisfaction with recommendations

## Next Steps

1. **Review and Approve Plan** - Get stakeholder approval
2. **Create Database Schema** - Add `AIRecommendation` model if needed
3. **Build API Endpoints** - Create recommendation management endpoints
4. **Build UI Components** - Start with Phase 1 (Basic Display)
5. **Test and Iterate** - Gather user feedback and improve

## Questions to Consider

1. Should recommendations expire after a certain time?
2. How many recommendations should we show at once?
3. Should we allow users to customize which recommendation types they see?
4. Should recommendations be personalized based on personality profile?
5. How do we prevent recommendation fatigue?
6. Should recommendations be contextual (only show when relevant)?

