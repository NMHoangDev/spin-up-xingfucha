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

## MySQL (Spin records + Admin)

This app now persists spin records to MySQL and displays them at `/admin`.

Setup:

1. Copy `.env.example` to `.env.local` and fill in your MySQL connection.
2. Run `database/mysql-schema.sql` on your MySQL server.
3. Run `npm run dev`.

Notes:
- `app/api/spin`, `app/api/spins`, `app/api/settings`, and `app/api/export` all use MySQL.
- Admin can set the voucher activation delay in minutes at `/admin`.
- Each voucher spin stores its own `voucher_usable_from`, so changing the admin setting only affects future spins.
- Client-side Firebase remains optional and is only used for analytics in `lib/firebase/client.ts`.
