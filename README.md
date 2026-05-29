# Ours — A Private Space For Two

A highly advanced, feature-rich private social space for two people. This app features real-time multiplayer syncing, end-to-end encryption, AI-generated daily questions, and a fully functional progressive web app (PWA) architecture.

## 🚀 Features
- **Real-Time Multiplayer:** Built with Liveblocks and Supabase Realtime for instant synchronization.
- **End-to-End Encryption (E2EE):** Private notes, dictionary entries, and board cards are encrypted client-side using `libsodium` before they ever touch the database.
- **AI-Powered Prompts:** Uses Google's Gemini API in Edge Functions to generate daily personalized questions.
- **Web Push Notifications:** Fully integrated Service Workers with VAPID keys for native push notifications.

---

## 💻 Local Setup Guide

Follow these steps to run the app entirely on your local machine.

### 1. Prerequisites
- **Node.js** (v18 or higher)
- **pnpm** installed globally (`npm install -g pnpm`)
- **Docker Desktop** (required to run the local Supabase database)

### 2. Clone the Repository
```bash
git clone https://github.com/your-username/ours.git
cd ours
```

### 3. Install Dependencies
```bash
pnpm install
```

### 4. Setup Environment Variables
Copy the example environment file:
```bash
cp .env.example .env.local
```
Ask the project owner for the `.env.local` values. You will need keys for Supabase, Liveblocks, Gemini, and VAPID.

### 5. Start the Database (Two Options)

**Option A: Cloud Database (Easiest - No Docker Required)**
If the project owner provided you with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` that point to a cloud hosted Supabase project, you can skip this step entirely! Just proceed to step 6.

**Option B: Local Database (Requires Docker)**
If you want to run a completely isolated local database instead of using the cloud one, ensure Docker Desktop is running and execute:
```bash
npx supabase start
```
*Copy the `API URL` and `anon key` from the terminal output and paste them into your `.env.local` file as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.*

### 6. Start the Development Server
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. 

---

## 🛠️ Testing Locally
Because this app is designed for two people, the best way to test it locally is to open **two different browsers** (e.g., Chrome and Firefox) or one normal window and one Incognito window.

1. Sign up on Browser A and create a space.
2. Copy the Invite Code.
3. Sign up on Browser B and join the space using the code.
4. You can now test the real-time features side-by-side!
