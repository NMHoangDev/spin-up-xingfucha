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
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Firebase (Spin records + Admin)

This app can persist spin records to Firestore and display them at `/admin`.

1. Install deps:
   `npm install`
2. Create `.env.local` from `.env.example` and fill:
   - `NEXT_PUBLIC_FIREBASE_*` (Firebase Web App config)
   - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (Service Account)
3. Ensure Firestore is enabled in your Firebase project.

Notes:
- `FIREBASE_PRIVATE_KEY` should be stored on ONE line with `\n` escapes in `.env.local`.
