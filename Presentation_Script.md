# MarkIt — Presentation Script

**Total time:** ~12 minutes (≈3 minutes per member)
**Deck:** `MarkIt_Attendance_System_Presentation.pptx` (16 slides)

| Member | Slides | Section |
|---|---|---|
| Mirazul Momen Miraz | 1–4, 16 | Opening, Team & Vision |
| Ratul Hassan Joy | 5–8 | Technology, Architecture & Security |
| Md. Sadakin Sanjid | 9–11 | Core Features |
| Bushra Basher | 12–15 | Roles, Impact, Deployment & Roadmap |

---

## 🎤 Member 1: Mirazul Momen Miraz — Opening & Vision
**(Slides 1–4 + Slide 16 closing) | ~3 min**

### Slide 1 — Title

> Good morning everyone. We are Team MarkIt, and today we're going to show you a problem every university teacher knows by heart — attendance.
>
> Our project is called **MarkIt** — smart attendance tracking for modern classrooms. It's a complete web-based attendance management system built for university departments.

### Slide 2 — Team

> Before we dive in, meet the four builders behind MarkIt: myself, Mirazul Momen Miraz; Ratul Hassan Joy; Md. Sadakin Sanjid; and Bushra Basher. Each of us owned a core area of the system — and we'll each walk you through our parts in the next few minutes.

### Slide 3 — The Problem

> Let's start with the problem. Think about a typical class of sixty students. The teacher calls out roll numbers one by one, students answer "present," and the teacher marks a paper register. That simple ritual takes **ten to fifteen minutes of every class** — that's roughly ten full class periods lost per semester, just taking attendance.
>
> And it gets worse:
> - Paper can't verify identity — if your friend answers "present" for you, nobody catches it.
> - Records get lost, smudged, or miscounted before they ever become reports.
> - Monthly summaries mean hours of manual tallying.
> - And a teacher only discovers a student is chronically absent when it's already too late to help.

### Slide 4 — Our Solution

> That's why we built MarkIt. Four ideas drive it:
>
> **First**, speed — attendance takes under thirty seconds.
> **Second**, integrity — every mark is tied to an exact student ID, so proxy attendance has nothing to cling to.
> **Third**, zero paperwork — history, summaries, and PDF/CSV exports are generated automatically.
> And **fourth**, it works everywhere — any phone, any classroom, light or dark mode.
>
> Now Ratul will show you what's under the hood. → *(hand over)*

---

## 🎤 Member 2: Ratul Hassan Joy — Technology, Architecture & Security
**(Slides 5–8) | ~3 min**

### Slide 5 — Technology Stack

> Thank you, Mirazul. MarkIt is a full-stack application, and we chose technologies that are proven, well-documented, and industry-standard.
>
> On the **frontend**, we used React 18 with Vite for a fast single-page app, React Router for navigation, and TanStack React Query to keep the screen perfectly in sync with the database without manual refreshing. TailwindCSS gives us our clean glassmorphism design system.
>
> On the **backend**, it's Node.js with Express, structured as a layered REST API. Data lives in MongoDB Atlas, accessed through Mongoose. Authentication uses JSON Web Tokens, passwords are hashed with bcrypt, and PDF reports are generated server-side with PDFKit.
>
> The whole thing deploys on **Vercel as serverless functions** — no servers to maintain.

### Slide 6 — System Architecture

> Here's how a request flows through the system. You click a button in the React app → Axios sends the request with secure httpOnly cookies → middleware verifies the JWT token → the controller executes business logic → Mongoose queries MongoDB Atlas → JSON comes back to the UI.
>
> Notice the backend is strictly layered: routes, middleware, controllers, models, and services each live in their own module. This separation is what made it easy for four of us to build different parts at the same time without stepping on each other.

### Slide 7 — Authentication Flow

> Let me highlight one piece of engineering we're proud of — the session lifecycle.
>
> When you sign in, you get two cookies: a short-lived **access token valid for 15 minutes**, and a long-lived **refresh token valid for 7 days**. Both are httpOnly — meaning JavaScript can never read them, which makes token theft through XSS ineffective.
>
> When the access token expires, our Axios interceptor catches the 401 response, queues any parallel requests, silently refreshes the session once, and retries. The user never notices. Refresh tokens also **rotate on every use** — and we added a grace window so having two tabs open doesn't accidentally log you out.

### Slide 8 — Security Features

> Beyond authentication, security was designed in from day one — nine concrete measures:
>
> Passwords hashed with bcrypt cost-factor 12. Brute-force lockout after five failed attempts. Rate limiting on every route. Input validation everywhere, plus NoSQL injection sanitization and HTTP parameter pollution protection. Helmet security headers and restricted CORS.
>
> And my favorite policy: **role separation with separation of duties** — admins manage accounts but are completely blocked from editing attendance records. The people who control access can never quietly rewrite teaching data.
>
> Now Sadakin will demonstrate what teachers actually do all day. → *(hand over)*

---

## 🎤 Member 3: Md. Sadakin Sanjid — Core Features
**(Slides 9–11) | ~3 min**

### Slide 9 — Student Roster Management

> Thanks, Ratul. Everything starts with the student roster, so we made managing it effortless.
>
> Admins can enroll students individually or **bulk-import up to 500 students in a single request** — a whole new batch in seconds. Filtering uses cascading dropdowns — pick a department, then batch, then section — and because all filtering happens client-side, results appear instantly with zero extra network requests. There's live search by name or roll ID, inline editing, and both single and bulk delete — with confirmation dialogs protecting against accidents.

### Slide 10 — Taking Attendance + Quick Select

> Now the feature we demo'd this whole project for — taking attendance itself.
>
> The roll-call list shows every student with a one-tap checkbox. There's an "All Present" shortcut if most of the class showed up, live Present/Absent/Total counters, and if the teacher already submitted today's attendance, it reloads pre-filled for safe corrections.
>
> But here's the magic: **Quick Select**. Instead of tapping sixty checkboxes, the teacher just types the *last digits* of roll numbers — like "1, 2, 33, 45" — hits enter, and those students instantly flip to present. The engine is batch-aware: for batch 68, typing just "33" resolves to the full ID 2024-110680-33. Zero-padded or not, it matches.
>
> A sixty-student class goes from fifteen minutes of roll-call to **under thirty seconds**.

### Slide 11 — Reports, History & Analytics

> After the marks are in, MarkIt pays you back. Every historical session is browsable by course and day — open any one to see exactly who was present. Summaries aggregate per class or per student across any date range.
>
> Teachers export professional **PDF reports** generated server-side, or raw **CSV files** for Excel. No calculator, no evening lost at the end of the month.
>
> Handing over to Bushra, who'll cover permissions and what this means in practice. → *(hand over)*

---

## 🎤 Member 4: Bushra Basher — Roles, Impact, Deployment & Roadmap
**(Slides 12–15) | ~3 min**

### Slide 12 — Roles & Permissions

> Thank you, Sadakin. MarkIt has two roles with least-privilege access.
>
> **Admins** see university-wide stats, create academic sessions like Summer-26, assign courses to teachers, and manage the official student roster — including bulk operations.
>
> **Teachers** see only their own assigned sections, take attendance there, keep optional private course rosters that admins can view but never edit — and both roles manage their own profile and password. As Ratul mentioned, neither side can do the other's job.

### Slide 13 — What Changes for Teachers

> Let's put real numbers on the impact.
>
> Roll-call drops from ten-to-fifteen minutes to under thirty seconds. Proxy prevention goes from an honor system to ID-matched digital marking. Records move from loose paper sheets to permanent cloud history. Monthly reports go from hours of tallying to one click. At-risk students surface live instead of being discovered too late. And it all works on the phone already in the teacher's pocket.

### Slide 14 — Deployment & Scalability

> On the deployment side, everything ships from git — push to deploy.
>
> The frontend builds to static files served from Vercel's CDN worldwide. The backend runs as a single serverless function — it scales to zero when idle, so a quiet department at 3 AM costs nothing, and enrollment-week spikes are absorbed automatically. MongoDB Atlas handles the database with managed backups. All secrets — database URI, JWT keys, cookie flags — live in environment variables, never in source code.

### Slide 15 — Future Enhancements

> And we're not done. Our roadmap includes QR-code check-in where students scan a rotating classroom code, automatic SMS alerts to guardians after repeated absences, analytics dashboards with early-warning flags, biometric verification for labs and exams, a React Native mobile app with offline marking, and a timetable engine with clash detection.
>
> The architecture is modular, so each of these plugs into the same core attendance model.



## 🎤 Member 1 returns: Mirazul — Slide 16 — Thank You / Q&A (~30 sec)

> So, that's MarkIt. Same old attendance task — reimagined to take thirty seconds instead of fifteen minutes, with records you can actually trust and reports you don't have to build.
>
> Thank you for listening. We'd love to take your questions — and if you'd like, we have a live demo ready: sign-in, Quick Select, and a PDF export, end to end.

---

## ⏱️ Timing Summary

| Segment | Target |
|---|---|
| Mirazul opening (slides 1–3) | ~2.5 min |
| Ratul tech & security (slides 4–7) | ~3 min |
| Sadakin features (slides 8–10) | ~3 min |
| Bushra impact & roadmap (slides 11–15) | ~3 min |
| Mirazul closing (slide 16) | ~0.5 min |
| **Total** | **~12 min** |

## ✅ Rehearsal Tips

1. Practice hand-over sentences out loud — smooth transitions score high in viva/evaluations.
2. If a live demo is possible, rehearse Quick Select beforehand (type `1, 2, 33, 45` on the take-attendance page).
3. Each member should be able to answer basic questions about *any* slide, not just their own.
4. Likely examiner questions: "Why MongoDB over SQL?", "How does JWT refresh work?", "What stops a teacher marking a friend present remotely?" — prepare short answers.
