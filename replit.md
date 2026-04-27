# IIC - Educational Learning Platform

## Overview
An AI-driven Educational Platform and Learning Management System (LMS) tailored for Indian education (CBSE, BSEB, Competitive Exams). Built as a Progressive Web App (PWA).

## Tech Stack
- **Frontend**: React 19 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS (CDN + PostCSS)
- **Backend/DB**: Firebase Firestore + Firebase Realtime Database + Firebase Auth
- **AI**: Groq API (primary), Google Gemini (fallback)
- **PWA**: vite-plugin-pwa

## Architecture
- `App.tsx` - Central entry point with auth, routing logic
- `components/StudentDashboard.tsx` - Main student UI
- `components/AdminDashboard.tsx` - Admin management UI
- `components/SubjectSelection.tsx` - Subject picker
- `services/groq.ts` - AI content generation (fetchChapters)
- `constants.ts` - Subject definitions, feature config
- `types.ts` - TypeScript interfaces
- `firebase.ts` - Firebase setup and helpers

## Key Features
- Competition Mode: Lucent Book, Speedy Science, Speedy Social Science, Sar Sangrah, MCQ Practice
- Class 6-12: Notes / Video / Audio only (MCQ option hidden in lesson action modal)
- Homework System: Admin assigns content by date/title/subject
- Profile: Settings sheet with Light Mode, Recovery, Data
- External Apps: Open inside the app via in-app iframe overlay (not new browser tab)

## Recent Changes (Apr 24)
- Removed MCQ option from per-chapter lesson modal for classes 6-12 (still available in Competition mode and homework)
- Removed "Revision" bottom-nav tab and Revision Hub rendering from student dashboard
- Removed "Study Goal" bottom-nav tab entry (AI Hub page still reachable from catalog overlays)
- Removed "My Marksheets" entry and "Download Report" PDF button from profile/settings sheet
- Removed MonthlyMarksheet full-screen rendering trigger
- Removed "Premium Revision Hub" feature banner from AI Hub event slides

## Recent Changes (Apr 25)
- Removed the "MCQ" tab from the student bottom navigation
- Added a new "Apps" tab (App Store page) after Profile in the bottom navigation
  - New `components/AppStore.tsx` renders the page with search, app cards, and store-specific styling
  - New `DownloadApp` type + `downloadApps` and `appStorePageHidden` fields in `SystemSettings`
  - Supports Play Store, App Store (iOS), Google Drive, MediaFire, and Other links
  - Tapping Download opens the link in a new browser tab (so MediaFire/Drive/Play Store all work natively)
- Added Admin → Advanced Settings → "App Store Page" panel
  - Toggle to hide/show the page for students
  - Add / edit / delete download apps (name, store, URL, icon, version, size, description)
  - Registered as `CONFIG_APP_STORE` in the feature registry

## Running
- Dev: `npm run dev` on port 5000
- Build: `npm run build` → `dist/`

## Deployment
- Static site deployment via Vite build
- Public dir: `dist`
