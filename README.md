# Ledger — Student Attendance Management System

A professional, security-first attendance system for university teachers. Teachers sign up, manage
student rosters by **Department → Batch → Section**, take attendance with a checkbox roster, and
export attendance summaries as PDF.

**Stack:** Node.js + Express · MongoDB (Mongoose) · React (Vite) + Tailwind CSS · JWT auth (httpOnly cookies)

---

## Project Structure

```
attendance-system/
├── backend/     Express API, MongoDB models, auth, PDF generation
└── frontend/    React + Tailwind single-page app ("Ledger" theme)
```

---

## 1. Prerequisites

- Node.js 18+ and npm
- A MongoDB instance — local (`mongod`) or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster

---

## 2. Backend Setup

```bash
cd backend
cp .env.example .env
```

Edit `.env`:
- `MONGO_URI` — your MongoDB connection string
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — generate two long random strings, e.g.:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- `CLIENT_ORIGIN` — the frontend URL (default `http://localhost:5173`)
- In production, set `COOKIE_SECURE=true` and serve over HTTPS

Install and run:

```bash
npm install
npm run dev      # nodemon, auto-restarts on change
# or: npm start
```

The API starts on `http://localhost:5000`. Puppeteer (used for PDF generation) downloads a bundled
Chromium on first `npm install` — this needs normal internet access to `googleapis.com`/Chrome's CDN.

Health check: `GET http://localhost:5000/api/health`

---

## 3. Frontend Setup

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Opens on `http://localhost:5173`. Update `VITE_API_URL` in `.env` if your backend runs elsewhere.

---

## 4. First-Time Use

1. Go to `/signup`, create a teacher account (password needs 8+ chars, an uppercase letter, and a number).
2. Sign in.
3. Enroll students individually (**Enroll Student**) or in bulk via CSV paste — headers:
   `studentId,name,department,batch,section,email,phone`
4. Go to **Take Attendance**, pick department/batch/section/date, check off who's present, submit.
5. Go to **Summary & Reports** to see per-student present/absent/percentage and download a PDF.

---

## 5. Security Notes

- Passwords hashed with bcrypt (cost 12); never stored or logged in plaintext.
- Auth uses short-lived JWT access tokens + rotating refresh tokens, both in `httpOnly`, `SameSite=Strict`
  cookies — never exposed to JS, so they can't be stolen via XSS.
- Login attempts are rate-limited and accounts lock temporarily after 5 failed attempts.
- All inputs are validated server-side (`express-validator`) and sanitized against NoSQL injection
  (`express-mongo-sanitize`) and HTTP parameter pollution (`hpp`).
- `helmet` sets strict security headers (CSP, HSTS, frame-ancestors none, etc.).
- CORS is locked to the configured `CLIENT_ORIGIN` only, with credentials.
- Deleting a student is a **soft delete** (`isActive: false`) — historical attendance records are preserved.

**Before deploying to production:**
- Set real, unique values for `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`
- Set `COOKIE_SECURE=true` and serve both frontend and backend over HTTPS
- Consider adding email verification on signup (scaffolded via `isVerified` on the Teacher model, not yet wired to an email provider)
- Put the API behind a process manager (pm2) or containerize it; add a reverse proxy (nginx) in front

---

## 6. Design

The frontend deliberately avoids a generic dashboard look — it uses a "ledger" aesthetic: deep forest
green + warm parchment cream + brass gold accents, with a Fraunces serif display font paired with IBM
Plex Sans for body text. All theme tokens live in `frontend/tailwind.config.js` and `frontend/src/index.css`
if you want to restyle it.

---

## 7. API Overview

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/signup` | Register a teacher |
| POST | `/api/auth/signin` | Sign in |
| POST | `/api/auth/signout` | Sign out (auth required) |
| POST | `/api/auth/refresh-token` | Rotate access/refresh tokens |
| GET | `/api/auth/me` | Current teacher (auth required) |
| GET/POST | `/api/students` | List / enroll students |
| POST | `/api/students/bulk` | Bulk enroll via array |
| PUT/DELETE | `/api/students/:id` | Edit / soft-delete a student |
| POST | `/api/attendance` | Submit (or overwrite) a session |
| GET | `/api/attendance/session` | Fetch an existing session |
| GET | `/api/attendance/summary` | Aggregated present/absent/% |
| GET | `/api/reports/summary/pdf` | Download summary as PDF |
| GET | `/api/meta/departments`, `/batches`, `/sections` | Dropdown values |

All routes except `/api/auth/signup`, `/signin`, and `/refresh-token` require authentication via cookie.
