# miithii - fast. clean. multilingual. This is the prod build with pipelines.

**Core Purpose:** To provide a super-fast, minimalist, and knowledgeable AI chat experience focused on learning and information exchange, with unique support for English, Assamese, and Bodo.

**Target Audience:** University students and working professionals, particularly those benefiting from multi-language support.

**Repository Focus:** This repository hosts the codebase for the Miithii production application. It is primarily used with CI/CD pipelines for automated builds, previews, and production deployments via Vercel.

---

## Core Architectural Principles

* **SPEED IS PRIORITY #1:** Every implementation choice is evaluated for its impact on perceived speed (instant UI feedback, real-time streaming) and actual speed (low-latency backend processing).
* **Minimalism & Aesthetics:** Clean, spacious, non-generic UI with no persistent headers/sidebars. Focus on content, typography, and subtle polish.
* **Multi-Language Focus:** Core design for English, Assamese, and Bodo, with an intuitive first-contact language clarification flow.
* **Simplified User Data Management:** User-specific data (plan, token count, language, theme) is managed via Clerk's user metadata to simplify the database schema.

---

## Technology Stack (MVP)

* **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS, Shadcn UI
* **State Management & API Client:** React Query, tRPC client
* **Backend:** Next.js (API Routes/Server Functions), tRPC
* **Authentication:** Clerk (handles user management & core user metadata)
* **AI Integration:** Google Gemini API (via streaming)
* **Real-Time Communication:** WebSockets (for AI response streaming & UI signals)
* **Database (for conversations & anonymous sessions):** Supabase (PostgreSQL)
* **ORM:** Drizzle ORM
* **Hosting & CI/CD:** Vercel
* **Package Manager:** pnpm

---

## Core Building Blocks (MVP Development Plan)

The application is being developed incrementally through the following core building blocks. Each block aims to be deployable for preview.

1.  **Core App Setup:** Next.js project, Vercel deployment, Clerk authentication, and Clerk user metadata initialization.
2.  **Chat UI & tRPC Basics:** Minimalist chat interface (Shadcn UI), tRPC setup, basic API communication, and modals for settings/history.
3.  **Database & Gating (Supabase, Drizzle, Clerk Metadata):**
    * Supabase/Drizzle for `conversations` and `anonymous_sessions` tables.
    * Gating logic implemented using `token_count` and `plan_type` from Clerk user metadata and `anonymous_sessions`.
4.  **Gemini Integration & Streaming (WebSockets):** Connecting to Gemini API, implementing WebSocket server for real-time streaming of AI responses, and updating frontend for chunk display.
5.  **Language Clarification Flow:** Backend logic for `language_needed` signal, frontend language picker UI, and updating Clerk metadata with user's chosen language.
6.  **Polish & History:** Fully functional settings modal (language/theme updates via Clerk metadata with plan restrictions), conversation history listing (from Supabase), and usage limit alert toasts.

---

## CI/CD Pipeline

* **Source Control:** GitHub.
* **Deployment Platform:** Vercel.
* **Process:**
    1.  Code is pushed to feature branches on GitHub.
    2.  Vercel automatically generates preview deployments for these branches and for Pull Requests.
    3.  After testing and review, code is merged into the `main` branch.
    4.  Merges to `main` trigger production deployments on Vercel.
* **Key Focus:** Ensuring each building block and subsequent changes build successfully and deploy cleanly to Vercel previews before merging to production. Vercel build logs are primary for diagnosing deployment issues.

---

*This README is intended to provide an overview of the Miithii project's architecture and development flow for team members and for CI/CD understanding.*