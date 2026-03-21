<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/e60509fe-9ef0-403b-9eea-413c8b01b645

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

## Firebase (Spin records + Admin)

This app can persist spin records to Firestore and display them at `/admin`.

This app persists spin records to Firestore and displays them at `/admin`.

Configuration is hardcoded (no `.env` / no environment variables):
- Firebase Web config is in `lib/firebase/client.ts`
- Firebase Admin (server) reads the service account JSON from the project root via `lib/firebase/admin.ts`

Ensure Firestore is enabled in your Firebase project.
