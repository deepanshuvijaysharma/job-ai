# JobHunter AI — Personal Job Search & Recruiter Outreach Agent

**JobHunter AI** is an AI-powered job search, match prioritization, recruiter discovery, and intelligent outreach platform designed for tech job seekers. It transforms job hunting from low-conversion volume spamming into a high-probability, data-driven workflow.

---

## Core Value Proposition

> **Find better jobs → identify the right recruiter → personalize the application/outreach → track everything → follow up → learn what works → increase interview probability.**

---

## Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS (Dark SaaS UI Theme) + Lucide Icons
- **State & Data**: TanStack Query (React Query) + Axios

### Backend
- **Framework**: Node.js + Express.js + TypeScript
- **Security**: JWT Auth, bcryptjs, Helmet, CORS, Zod validation
- **AI Abstraction**: Pluggable provider system supporting **OpenAI**, **Anthropic**, or **Local LLM (Ollama)** with JSON Schema enforcement

### Database & Workers
- **Database**: PostgreSQL with Prisma ORM
- **Queueing**: Redis + BullMQ for background job ingestion, deduplication, match evaluation, and follow-up matrix reminders

---

## Features Implemented (Phase 1 Complete)

1. **Candidate Profile & Multi-Resume Manager**:
   - Store target roles, skills graph, preferred locations, salary expectations, notice period.
   - Upload PDF/DOCX resumes with AI parser extraction of skills, projects, marketable skills, and weak/missing skills analysis.

2. **Normalized Job Ingestion & Deduplication Engine**:
   - Deduplicate across canonical URL, company + title + location signatures, and semantic hashes.
   - Import jobs from public URLs with user control.

3. **AI Precision Matching Engine (0–100 Score)**:
   - 10-metric breakdown: Skill Match, Role Match, Experience, Location, Salary, Resume Keywords, Projects, Education.
   - Priority categorization: `🔥 APPLY NOW` (90-100), `🟢 STRONG MATCH` (80-89), `🟡 POSSIBLE` (65-79), `🔴 LOW MATCH` (<65).
   - Explanations: "Why you match" vs "Potential weaknesses".

4. **"Best Jobs Today" Morning Dashboard**:
   - Daily prioritized top 20 job recommendations & high-probability action plan.

5. **Application Pipeline Kanban Board**:
   - Track applications across 6 stages: `Discovered`, `Shortlisted`, `Applied`, `Recruiter Contacted`, `Interview Scheduled`, `Offer Received`.

6. **Application Preparation Assistant**:
   - Recommends best resume version, emphasizes keywords, drafts custom Q&A answers, and generates cover letters.

7. **Analytics & Funnel Yield Dashboard**:
   - Empirical tracking of Application → Response Rate, Application → Interview Rate, and yield breakdown by role & job source.

---

## Getting Started

### Prerequisites
- Node.js 18+ & npm
- PostgreSQL & Redis (or Docker)

### Installation & Local Setup

```bash
# 1. Install dependencies across monorepo workspace
npm install

# 2. Copy environment file
cp .env.example .env

# 3. Generate Prisma client & database push
npm run db:generate

# 4. Start local development backend & frontend
npm run dev
```

The application will be accessible at:
- **Frontend SPA**: `http://localhost:3000`
- **Backend API**: `http://localhost:5000`

---

## Running Docker Stack

```bash
docker-compose up --build
```

---

## Testing

```bash
npm run test --workspace=apps/api
```
