<!--
Drive Product Context
See README for the modular context pattern.
-->

# Drive Product Context

## 1. Header & Purpose

**Purpose:**  
The Drive module is the core file management and storage solution for the Block on Block platform. It enables users to securely upload, organize, share, and collaborate on files and folders within a unified workspace. Drive is designed to support both individual and team workflows, providing granular permissions, real-time updates, and seamless integration with other modules (e.g., Chat for file sharing, Dashboard for widgets, Marketplace for module attachments). The Drive module prioritizes accessibility, extensibility, and a user experience inspired by leading cloud storage platforms.

**Cross-References:**  
- See also:  
  - [chatProductContext.md] (file sharing and references)
  - [dashboardProductContext.md] (Drive widgets and integration)
  - [marketplaceProductContext.md] (future: module attachments)
  - [systemPatterns.md] (navigation, modular context)
  - [designPatterns.md] (UI/UX, sidebar, and layout patterns)
  - [databaseContext.md] (data model and relationships)

## 2. Problem Space
- Users face fragmented navigation and lack a unified workspace for file management in traditional ERP/LRM systems.
- Switching between folders or modules disrupts workflow and reduces productivity.
- There is a need for persistent access to files, folders, sharing, and permissions regardless of where users are in the app.
- Personalization and quick access to frequently used files/folders are often missing in legacy file systems.

## 3. User Experience Goals
- Consistent, accessible UI across devices.
- Robust search and filtering for quick file access.
- Clear feedback for all actions (uploads, sharing, errors, etc.).
- Personalization: users can organize folders, star files, and manage their own Drive layout.

## 3a. Panel-Based Layout & Navigation

The Drive module uses a panel-based layout for file and folder navigation, preview, and management. Typical layout structure:
- **Left Panel/Sidebar:** Folder tree, quick access, starred/recent/trash
- **Main Panel:** File/folder grid or list view, file previews
- **Side Panels (optional):** File details, sharing settings, activity log
- **Panel Features:**
  - Panels are resizable and collapsible
  - Drag-and-drop file/folder operations
  - Responsive design for desktop and mobile

## 4. Core Features & Requirements
- File/folder navigation (grid/list view, breadcrumbs, sidebar).
- File/folder upload, download, rename, move, delete, and restore from trash.
- File/folder sharing with granular permissions (view, edit, share).
- **Folder permissions**: Complete permission system matching file permissions (canRead, canWrite).
- **Share links**: Automatic generation for non-registered users with user-friendly modal.
- **Direct link access**: Share links (`/drive/shared?file=xxx` or `?folder=xxx`) display specific items.
- File/folder preview (images, documents, etc.).
- Real-time updates via sockets for collaborative changes.
- Search and filter functionality.
- Activity log for file/folder actions.
- Modular, type-safe UI components.
- Integration with other modules (e.g., file sharing in Chat).
- Responsive design for desktop and mobile.
- Secure, role-based access control.

## 4a. Feature Checklist (Implementation Status)

| Feature                                 | Status      | Notes/Location (if implemented)                |
|------------------------------------------|-------------|-----------------------------------------------|
| Data Model & API Foundations             | ✅          | Backend implemented (CRUD, sharing, permissions) |
| Core UI & Navigation                     | ✅          | Implemented in `web/src/app/drive/page.tsx` and `DriveSidebar.tsx` |
| File/Folder Operations                   | ✅          | Backend API and UI implemented (upload, rename, delete, move) |
| Sharing & Permissions                    | ✅          | Backend API and UI fully implemented with granular permissions (files AND folders) |
| Folder Permissions                       | ✅          | Complete folder-level permission system matching file permissions |
| Share Links                              | ✅          | Auto-generated share links with ShareLinkModal for non-users |
| File Previews & Details                  | ✅          | Basic preview component implemented with PDF.js support |
| Search & Filter                          | 🟡 Partial | Basic search implemented; needs advanced filtering |
| Activity Log                            | ✅          | Activity tracking implemented in backend and Recent page |
| Real-time Updates                       | 🟡 Partial | Basic socket integration; needs more features |
| Mobile Responsiveness                   | ✅          | Fully responsive with touch-friendly UI |
| Accessibility                           | 🟡 Partial | Basic support; needs more testing |
| Integration with Dashboard              | ✅          | Integrated with global layout and navigation |
| Integration with Chat                   | 🟡 Partial | Basic file sharing; needs more features |
| Authentication Integration               | ✅          | Fully integrated with NextAuth across all pages |
| View Toggle Persistence                 | ✅          | localStorage persistence across all Drive pages |
| Auto-Deletion Service                   | ✅          | Scheduled cleanup for trash items older than 30 days |
| Recent Page                             | ✅          | Implemented with activity tracking and UI |
| Shared Page                             | ✅          | Implemented with API endpoint and UI |
| Starred Page                            | ✅          | Implemented with star/unstar functionality |
| Trash Page                              | ✅          | Implemented with restore and permanent delete |
| Design System Consistency               | ✅          | Centralized theme and consistent styling across all pages |
| Empty States                            | ✅          | Reusable EmptyState component implemented |
| Hover Effects                           | ✅          | Consistent hover states across all components |
| **NEW**: Drive Page Layout Redesign     | ✅          | Google Drive-inspired layout with separate folder/file sections |
| **NEW**: Enhanced FolderCard            | ✅          | Updated with star indicators, click handlers, and improved styling |
| **NEW**: FileGrid List/Grid Views       | ✅          | Support for both list and grid view modes with proper table layout |
| **NEW**: File Download Functionality   | ✅          | Fixed path handling, file existence checks, proper error logging |
| **NEW**: Pinned Items (formerly Starred)| ✅          | Renamed from "Starred" to "Pinned" with Pin icon, persistence across dashboards |
| **NEW**: Sharing & Download Options    | ✅          | ShareModal integration, download with proper path handling |
| **NEW**: Folder Permissions            | ✅          | Complete folder permission system with CRUD operations |
| **NEW**: Share Link System             | ✅          | Auto-generated links for non-users with ShareLinkModal |
| **NEW**: Direct Link Access            | ✅          | Share links display specific items in shared page |
| **NEW**: Smart File Download           | ✅          | Automatic GCS/local detection from file URL |

## 5. Technical Implementation

### Layout Components
- `DriveLayout.tsx`: Integration with global dashboard layout
- `DrivePage.tsx`: Main drive content with separate folder and file sections
- `DriveSidebar.tsx`: Folder navigation and quick access
- `FolderCard.tsx`: Enhanced folder display with star indicators and interactions
- `FileGrid.tsx`: File/folder grid and list views with view mode support
- `FilePreview.tsx`: File preview and details panel

### State Management
- React state for UI interactions
- Local storage for view preferences
- Real-time updates via WebSocket
- File operation state management
- **NEW**: Separated `folders` and `files` state arrays for better organization
- **NEW**: Share link state management for non-user sharing flows

### Integration Points
- Dashboard layout integration
- Chat module file sharing
- Activity logging system
- Search and filter system
- File preview system
- **NEW**: DndContext integration for drag-and-drop operations
- **NEW**: ShareModal integration for both files and folders
- **NEW**: ShareLinkModal for non-user email sharing
- **NEW**: Permission system integration (files and folders)

## 6. Future Considerations
- Advanced file previews
- Enhanced sharing features (link expiration, password protection)
- Better mobile experience
- Performance optimizations
- Advanced accessibility features
- Integration with more modules
- **NEW**: Complete drag-and-drop implementation between folders and files
- **NEW**: Bulk operations with multi-select functionality

## 7. Update History
- **2024-06:** Integrated with global dashboard layout
- **2024-06:** Implemented responsive design and touch-friendly UI
- **2024-06:** Added basic file operations and preview
- **2024-06:** Implemented sharing and permissions backend
- **2024-12:** **Comprehensive Enhancement Phase - Complete**
  - **Authentication & API Integration**: Fixed JWT secret issues, refactored frontend to use NextAuth session tokens, resolved 403 errors
  - **UI/UX Design System**: Implemented consistent "Inter" font, lucide-react icons, centralized theme, hover effects, empty states
  - **New Pages**: Implemented Recent, Shared, Starred, and enhanced Trash pages with full functionality
  - **View Toggle Persistence**: Added localStorage persistence for view mode preferences across all Drive pages
  - **Auto-Deletion Service**: Implemented scheduled cleanup for trash items older than 30 days
  - **Design Consistency**: Refactored all authentication pages to use centralized theme and consistent styling
- **2024-12:** **Drive Page Layout Redesign - Complete**
  - **Google Drive-Inspired Layout**: Redesigned main Drive page with separate folder and file sections
  - **Enhanced Components**: Updated FolderCard and FileGrid with improved styling and functionality
  - **Drag & Drop Foundation**: Set up DndContext wrapper for future drag-and-drop operations
  - **Type Safety**: Resolved all TypeScript errors and ensured proper type checking
  - **Build System**: Fixed Next.js cache issues and ensured clean builds
- **2024-12:** **File Download & Dashboard Fixes - Complete**
  - **File Download Path Handling**: Fixed to use `file.path` from database instead of parsing URLs
  - **File Existence Validation**: Added proper checks before attempting downloads
  - **Error Logging Enhanced**: Improved error messages with detailed context
  - **Dashboard Page Errors**: Fixed SSR context issues by converting to client component
  - **Pinned Items**: Renamed from "Starred" to "Pinned" with Pin icon, cross-dashboard persistence
  - **Sharing Integration**: ShareModal fully integrated with user search and permission management
- **2024-12:** **Folder Permissions & Sharing System - Complete**
  - **Folder Permission Model**: Added `FolderPermission` to database schema with `canRead`/`canWrite` permissions
  - **Backend Implementation**: Complete `folderPermissionController.ts` with CRUD operations
  - **Permission Integration**: All folder operations (create, update, delete, move) respect permissions
  - **Shared Folders**: Folders with permissions appear in "Shared" section alongside files
  - **Share Link Generation**: Automatic link creation when sharing with non-registered emails
  - **ShareLinkModal Component**: User-friendly modal displaying share links with copy functionality
  - **Direct Link Access**: Share links (`/drive/shared?file=xxx` or `?folder=xxx`) display specific items
  - **Smart File Download**: Enhanced download logic to auto-detect GCS vs local storage from URL
  - **Frontend Integration**: Folder sharing enabled in DriveModule with ShareModal support

## 8. Recent Enhancements (December 2024)

### Folder Permissions & Sharing System (Latest - December 2024)
- **Folder Permission System**: Complete implementation matching file permissions
  - Database schema: `FolderPermission` model with `canRead` and `canWrite` boolean fields
  - Backend controller: Full CRUD operations for folder permissions
  - Permission checks: Integrated into all folder operations (create, update, delete, move, reorder)
  - Shared folders: Appear in "Shared" section with permission levels displayed
- **Share Link System**: Automatic generation for non-user email sharing
  - When sharing with non-registered email, system generates shareable link
  - `ShareLinkModal` component displays link with copy functionality
  - Link format: `/drive/shared?file=xxx` or `/drive/shared?folder=xxx`
  - Direct access: Share links display specific item details in shared page
- **Smart File Download**: Enhanced download logic
  - Auto-detects file location from URL (GCS vs local storage)
  - Uses direct URL if file is in GCS (redirects to public URL)
  - Falls back to local file system if file is stored locally
  - Improved error handling with detailed logging
- **UI Enhancements**: 
  - Folder sharing enabled in DriveModule via ShareModal
  - ShareModal supports both files and folders with conditional API calls
  - ShareLinkModal provides user-friendly interface for non-user sharing
  - Shared page handles query parameters for direct item access

### File Download & Dashboard Fixes (Previous - December 2024)
- **File Download Path Handling**: Fixed download function to prioritize `file.path` from database over `file.url`
- **File Existence Validation**: Added `fs.existsSync()` checks before attempting downloads
- **URL Path Extraction**: Added fallback logic to extract paths from URLs for legacy files
- **Error Logging**: Enhanced error messages showing file path, URL, and database path for debugging
- **Storage Provider Support**: Proper handling for both GCS (redirect) and local storage (direct download)
- **Dashboard Page Errors**: Fixed SSR context issues by converting dashboard page to client component
- **Authentication Flow**: Moved authentication checks to `useEffect` to prevent SSR errors
- **Pinned Items**: Renamed from "Starred" to "Pinned" with Pin icon from lucide-react, cross-dashboard persistence
- **Sharing Integration**: ShareModal fully integrated with user search, business members, and permission management

### Drive Page Layout Redesign (Previous)
- **Folder/File Separation**: Redesigned main Drive page to display folders and files in separate sections
- **Google Drive-Inspired Layout**: Implemented folder grid at top, files section below with view toggles
- **Enhanced FolderCard**: Updated component with proper styling, star indicators, and click handlers
- **FileGrid Improvements**: Added list/grid view support with proper table layout for list mode
- **Drag & Drop Foundation**: Set up DndContext wrapper for future drag-and-drop functionality
- **Type Safety**: Resolved all TypeScript errors and ensured proper type checking
- **Build System**: Fixed Next.js cache issues and ensured clean builds

### Authentication & API Integration Fixes
- **JWT Secret Issues**: Fixed incorrect JWT secret usage in both token signing and verification
- **Frontend Authentication**: Refactored API client to use NextAuth session tokens instead of localStorage
- **Token Expiration**: Increased JWT token expiration from 1h to 24h for better user experience
- **API Integration**: Fixed all Drive API endpoints to properly authenticate with backend
- **Error Resolution**: Resolved persistent 403 Forbidden errors across all Drive operations

### UI/UX Design System Implementation
- **Global Font**: Implemented consistent "Inter" font across all Drive pages
- **Icon Unification**: Standardized on lucide-react icons throughout the application
- **Layout Correction**: Created proper right-hand sidebar for quick access icons
- **Theme Consistency**: Applied official color palette from design system to all components
- **Hover Effects**: Added consistent hover states to FileGrid and FolderCard components
- **Empty States**: Created reusable EmptyState component and integrated across Drive pages

### New Drive Pages Implementation
- **Recent Page**: Implemented activity tracking backend and frontend UI for recent file operations
- **Shared Page**: Created API endpoint and UI for items shared with current user
- **Starred Page**: Enhanced with view toggle functionality and improved UI
- **Trash Page**: Fixed layout issues, route ordering bugs, and added view toggle

### View Toggle Persistence
- **localStorage Integration**: Added persistent view mode preferences across all Drive pages
- **Page Coverage**: Implemented view toggles on main Drive, Trash, Shared, and Starred pages
- **Consistent UX**: Standardized toggle button design and behavior across all pages
- **SSR Safety**: Added proper browser environment checks for localStorage operations

### Auto-Deletion Service
- **Scheduled Cleanup**: Implemented using node-cron to run daily at midnight
- **Database Integration**: Properly queries and deletes old trashed files and folders
- **Server Integration**: Added to main server file for automatic startup
- **User Experience**: Maintains the 30-day trash retention promise shown in UI

### Technical Architecture Improvements
- **Centralized Theme**: Created `shared/src/styles/theme.ts` with official COLORS object
- **Component Reusability**: Implemented reusable EmptyState component
- **Build System**: Resolved all TypeScript and ESLint issues
- **Dependency Management**: Added node-cron for scheduled tasks
- **Code Organization**: Improved file structure and component separation
- **State Management**: Separated folder and file state for better organization
- **Type Safety**: Enhanced type checking and null safety across all components

# Cloud Storage Support (Google Cloud Storage) [2024-06]

## Product Requirements
- The Drive module must support Google Cloud Storage (GCS) as a backend for all file and folder operations (upload, download, delete, preview).
- The storage backend is selected via environment variable (`STORAGE_PROVIDER`).
- All user-facing file operations must work seamlessly whether using local or GCS storage.
- File URLs and previews must be compatible with GCS (e.g., use signed URLs for private files).
- User avatars and other file assets should also be stored in GCS when enabled.

## User Experience Implications
- No change in user workflow; all file operations remain the same from the user's perspective.
- Improved reliability, scalability, and performance for file storage when using GCS.
- File sharing and previews in Chat and other modules must work with GCS URLs.

## Developer Notes
- All file storage logic must use the storage abstraction layer.
- Test all file operations in both local and GCS modes.