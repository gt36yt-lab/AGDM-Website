# AG Daily Motivation

A small public site that shows **one motivational quote per day**, plus a private admin area where you schedule quotes in advance.

## What visitors see

- Open `/` — today&apos;s quote (timezone defaults to **Asia/Manila**, configurable).
- If you haven&apos;t posted for today yet, they see your **most recent** quote with a short note.

## What you see (admin)

- Go to `/admin` and sign in with your password.
- Pick a **date** and **quote text** — one quote per day.
- Review or delete scheduled quotes.

## Run locally

**You need [Node.js](https://nodejs.org/) (LTS) installed.** It wasn&apos;t detected on this machine when the project was created.

```bash
cd Projects/ag-daily-motivation
copy .env.example .env
# Edit .env: set ADMIN_PASSWORD and SESSION_SECRET
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Admin: [http://localhost:3000/admin](http://localhost:3000/admin).

## Environment

| Variable | Purpose |
|----------|---------|
| `ADMIN_PASSWORD` | Your secret login password |
| `SESSION_SECRET` | Random string for secure cookies (16+ chars) |
| `QUOTE_TIMEZONE` | IANA timezone for &quot;today&quot; (default `Asia/Manila`) |

## Deploying

Quotes are stored in `data/quotes.json`. Use a host with a **persistent disk** (Railway, Render, Fly.io, a VPS), not plain serverless without storage.

After deploy, set the same env vars and keep the `data/` volume so quotes survive restarts.

## Project layout

- `src/app/page.tsx` — public daily quote
- `src/app/admin/` — login + scheduler
- `src/lib/db.ts` — quote storage (`data/quotes.json`)
- `src/app/api/` — auth and quote APIs
