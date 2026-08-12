# 🌟 AG Daily Motivation

A quiet, intentional digital corner designed to share daily inspiration, grounded reflections, and words to live by.

---

## 🍃 Why This Exists

This project started as my personal safe space—a daily journal of the mindset, quotes, and reflections guiding me through each day. 

Life moves fast, and it’s easy to get overwhelmed. **AG Daily Motivation** was created to be a gentle pause in the routine. While it serves as my personal grounding tool, it is open to anyone looking for a daily spark of encouragement, perspective, or quiet reassurance.

> *"One quote a day—simple, intentional, and real."*

---

## ✨ For Visitors & Readers

* **A Single Daily Focus:** No infinite scrolling or noise. Just one meaningful quote for the day to reflect on.
* **Always Present:** If today’s quote isn't up yet, the space gently defaults to the most recent inspiration so you never walk away empty-handed.
* **Localized Time:** Mindful of time zones (defaulted to `Asia/Manila`), ensuring today's message aligns with your day.

---

## 🛠️ Built With

Designed to be lightweight, fast, and self-contained:

* **Framework:** Next.js (App Router)
* **Storage:** File-based JSON storage (`data/quotes.json`)
* **Styling & UI:** Clean, distraction-free interface
* **Authentication:** Password-protected admin route for scheduling and managing quotes

---

## 🚀 Quickstart & Setup

If you'd like to host your own instance or run it locally:

### 1. Prerequisites
Ensure you have **Node.js (LTS)** installed.

### 2. Local Setup
```bash
# Clone and enter the repository
cd ag-daily-motivation

# Set up environment variables
cp .env.example .env

# Install dependencies and run locally
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the site, or visit [http://localhost:3000/admin](http://localhost:3000/admin) to manage quotes.

### 3. Environment Variables

| Variable | Description |
| :--- | :--- |
| `ADMIN_PASSWORD` | Secret password for admin access |
| `SESSION_SECRET` | Random secure string for cookie sessions (16+ chars) |
| `QUOTE_TIMEZONE` | IANA timezone (Defaults to `Asia/Manila`) |

---

## 📦 Deployment Note

Because quotes are stored locally in `data/quotes.json`, deploy using a platform that supports **persistent disk storage** (e.g., Railway, Render, Fly.io, or a private VPS) to ensure your scheduled quotes persist across restarts.