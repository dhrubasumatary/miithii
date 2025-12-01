# Miithii - Product Requirements Document (PRD)

> **Version:** 1.0.0  
> **Last Updated:** December 1, 2025  
> **Status:** Beta  
> **Owner:** Prompt Mafia Inc.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision & Goals](#2-product-vision--goals)
3. [Target Users](#3-target-users)
4. [Technical Architecture](#4-technical-architecture)
5. [Feature Specifications](#5-feature-specifications)
6. [API Design](#6-api-design)
7. [Data Models & Types](#7-data-models--types)
8. [UI/UX Specifications](#8-uiux-specifications)
9. [Design System](#9-design-system)
10. [Security & Privacy](#10-security--privacy)
11. [Performance Requirements](#11-performance-requirements)
12. [Infrastructure & Deployment](#12-infrastructure--deployment)
13. [Roadmap](#13-roadmap)
14. [Success Metrics](#14-success-metrics)
15. [Appendices](#15-appendices)

---

## 1. Executive Summary

### 1.1 Product Overview

**Miithii** (मिथि - "to understand" in Bodo) is an AI-powered conversational platform that enables users to chat with an AI assistant in native Assamese. Unlike generic AI chatbots, Miithii speaks authentic Guwahati street dialect—not formal textbook Assamese—making it relatable and culturally resonant for its target audience.

### 1.2 Problem Statement

Low-resource languages like Assamese lack quality AI tools that understand cultural nuances, local dialects, and code-mixing patterns. Existing solutions:
- Use formal/textbook language that feels unnatural
- Lack support for Romanized Assamese (how people actually type)
- Don't understand regional slang or cultural references
- Provide generic responses without personality

### 1.3 Solution

Miithii wraps Google's Gemini 2.5 Pro with:
- A carefully engineered persona that speaks authentic Guwahati dialect
- Roman script Assamese with natural English code-mixing (Tanglish)
- Built-in tools for calculations, code execution, and utilities
- A modern, terminal-inspired dark UI optimized for mobile

### 1.4 Business Model

| Plan | Price | Status |
|------|-------|--------|
| Beta Access | ₹49/month | Active |
| Free Tier | TBD | Planned |
| Pro Tier | TBD | Planned |

---

## 2. Product Vision & Goals

### 2.1 Vision Statement

> To build the foundational AI infrastructure for low-resource languages, starting with Assamese, and eventually training purpose-built models that truly understand and speak these languages natively.

### 2.2 Strategic Goals

| Goal | Description | Timeline |
|------|-------------|----------|
| **G1: Market Validation** | Validate demand for Assamese AI chat | Q4 2025 |
| **G2: User Acquisition** | Acquire 10,000 beta users | Q1 2026 |
| **G3: Talent Pipeline** | Attract young talent for foundational model development | Ongoing |
| **G4: Language Expansion** | Add Bodo language support | Q1 2026 |
| **G5: Data Collection** | Collect anonymized conversational data for future model training | Ongoing |

### 2.3 Success Criteria (Beta Phase)

- [ ] 1,000+ active monthly users
- [ ] <3s average response time
- [ ] >80% user satisfaction (NPS)
- [ ] <5% churn rate
- [ ] Positive social media sentiment

---

## 3. Target Users

### 3.1 Primary Persona: "Young Assamese Digital Native"

| Attribute | Description |
|-----------|-------------|
| **Age** | 16-35 years |
| **Location** | Guwahati, Assam; metros with Assamese diaspora |
| **Language** | Bilingual (Assamese + English), prefers Romanized typing |
| **Tech Savvy** | Comfortable with AI tools, uses ChatGPT/Gemini |
| **Pain Point** | Existing AI feels foreign; wants culturally relatable assistant |
| **Motivation** | Novelty, cultural pride, practical utility |

### 3.2 Secondary Personas

| Persona | Description | Use Case |
|---------|-------------|----------|
| **Students** | High school/college students | Homework help, explanations in native language |
| **Professionals** | Young professionals in tech/creative fields | Quick calculations, code help, brainstorming |
| **Content Creators** | Social media influencers, writers | Content ideas, Assamese language assistance |
| **NRIs** | Non-resident Assamese | Nostalgia, language practice, cultural connection |

### 3.3 User Stories

```
US-001: As a user, I want to chat with AI in Romanized Assamese so I can type naturally.
US-002: As a user, I want the AI to roast me playfully so conversations feel fun.
US-003: As a user, I want to upload images for analysis with Assamese descriptions.
US-004: As a user, I want quick math calculations without switching apps.
US-005: As a user, I want to see the AI's reasoning process to understand its thinking.
US-006: As a user, I want to copy AI responses easily for sharing.
US-007: As a user, I want suggestion prompts when starting a new chat.
```

---

## 4. Technical Architecture

### 4.1 System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  Next.js 15 App Router (React 19)                               │
│  ├── Landing Page (/)                                           │
│  ├── Chat Interface (/chat)                                     │
│  ├── Static Pages (/contact, /terms, /refund)                   │
│  └── Components (shadcn/ui + custom)                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/Streaming
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│  Next.js API Routes                                             │
│  └── /api/chat (POST)                                           │
│      ├── Message Processing                                     │
│      ├── Tool Execution (Calculator, Code, Time, etc.)          │
│      └── Response Streaming                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ AI Gateway
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         AI LAYER                                │
├─────────────────────────────────────────────────────────────────┤
│  Vercel AI SDK v5                                               │
│  ├── AI Gateway (@ai-sdk/gateway)                               │
│  ├── Streaming (streamText)                                     │
│  ├── Tool Definitions (Zod schemas)                             │
│  └── Reasoning/Thinking Support                                 │
│                                                                 │
│  Model: Google Gemini 2.5 Pro                                   │
│  ├── Multimodal (text + images)                                 │
│  ├── Search Grounding                                           │
│  └── Thinking/Reasoning Mode                                    │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Technology Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Framework** | Next.js | 15.3.5 | Full-stack React framework |
| **Runtime** | React | 19.0.0 | UI rendering |
| **Language** | TypeScript | 5.x | Type safety |
| **Styling** | Tailwind CSS | 4.x | Utility-first CSS |
| **UI Library** | shadcn/ui | Latest | Radix-based components |
| **AI SDK** | Vercel AI SDK | 5.0.11 | AI integration |
| **AI Gateway** | @ai-sdk/gateway | 2.0.17 | Model routing |
| **AI React** | @ai-sdk/react | 2.0.11 | React hooks for AI |
| **Validation** | Zod | 3.25.76 | Schema validation |
| **Icons** | Lucide React | 0.555.0 | Icon library |
| **Toasts** | Sonner | 2.0.7 | Notifications |
| **Theming** | next-themes | 0.4.6 | Dark mode support |
| **Animations** | tw-animate-css | 1.4.0 | CSS animations |

### 4.3 Directory Structure

```
miithii/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── api/
│   │   │   └── chat/
│   │   │       └── route.ts          # Chat API endpoint
│   │   ├── chat/
│   │   │   └── page.tsx              # Chat interface
│   │   ├── contact/
│   │   │   └── page.tsx              # Contact page
│   │   ├── terms/
│   │   │   └── page.tsx              # Terms & conditions
│   │   ├── refund/
│   │   │   └── page.tsx              # Refund policy
│   │   ├── globals.css               # Global styles + design system
│   │   ├── layout.tsx                # Root layout
│   │   └── page.tsx                  # Landing page
│   ├── components/
│   │   ├── chat/
│   │   │   ├── empty-state.tsx       # Welcome screen
│   │   │   ├── message-bubble.tsx    # Message rendering
│   │   │   └── thinking-indicator.tsx # AI reasoning display
│   │   └── ui/
│   │       ├── button.tsx            # Button component
│   │       ├── card.tsx              # Card component
│   │       ├── dialog.tsx            # Dialog component
│   │       ├── dropdown-menu.tsx     # Dropdown component
│   │       ├── input.tsx             # Input component
│   │       ├── navbar.tsx            # Navigation bar
│   │       ├── sheet.tsx             # Sheet/drawer component
│   │       ├── sonner.tsx            # Toast provider
│   │       └── tooltip.tsx           # Tooltip component
│   └── lib/
│       └── utils.ts                  # Utility functions
├── public/
│   └── favicon.ico                   # App icon
├── package.json                      # Dependencies
├── tsconfig.json                     # TypeScript config
├── tailwind.config.ts                # Tailwind config (if separate)
├── next.config.ts                    # Next.js config
├── postcss.config.mjs                # PostCSS config
├── eslint.config.mjs                 # ESLint config
├── components.json                   # shadcn/ui config
└── README.md                         # Project documentation
```

### 4.4 Data Flow

```
User Input → ChatPage Component
                    │
                    ▼
            useChat Hook (AI SDK React)
                    │
                    ▼
            sendMessage({ text, files })
                    │
                    ▼
            POST /api/chat
                    │
                    ├── Parse messages
                    ├── Convert to model format
                    │
                    ▼
            streamText({
                model: Gemini 2.5 Pro,
                system: Miithii Persona,
                messages,
                tools
            })
                    │
                    ├── Model generates response
                    ├── Tools executed if called
                    ├── Reasoning captured
                    │
                    ▼
            toUIMessageStreamResponse()
                    │
                    ▼
            Streamed back to client
                    │
                    ▼
            MessageBubble renders parts:
                ├── text
                ├── reasoning
                ├── file (images)
                └── tool-* (tool results)
```

---

## 5. Feature Specifications

### 5.1 Core Chat Interface

#### 5.1.1 Message Input

| Feature | Specification |
|---------|---------------|
| **Input Type** | Auto-resizing textarea |
| **Max Height** | 160px (then scroll) |
| **Submit** | Enter key (Shift+Enter for newline) |
| **Placeholder** | "Ask anything..." |
| **Caret Color** | Terminal green (#30D158) |
| **Disabled State** | While AI is responding |

#### 5.1.2 Message Display

| Component | Behavior |
|-----------|----------|
| **User Messages** | Right-aligned, dark card with rounded corners |
| **AI Messages** | Left-aligned with avatar, transparent background |
| **AI Avatar** | 32x32px green "M" badge |
| **Timestamp** | "just now" label (static for MVP) |
| **Copy Button** | Appears on hover for AI messages |
| **Animation** | Slide-up with staggered delay |

#### 5.1.3 Message Parts

| Part Type | Rendering |
|-----------|-----------|
| `text` | Whitespace-preserving text block |
| `reasoning` | Collapsible thinking block (expandable) |
| `file` | Image thumbnail with border |
| `tool-*` | Tool execution card with result |

### 5.2 Image Upload

| Feature | Specification |
|---------|---------------|
| **Methods** | Click button, drag & drop |
| **Accepted Types** | `image/*` |
| **Preview** | 64x64px thumbnail with remove button |
| **Drag Overlay** | Full-screen drop zone indicator |
| **Max Size** | TBD (currently unlimited) |

### 5.3 AI Reasoning Display

| Feature | Specification |
|---------|---------------|
| **Visibility** | Shown during streaming when no text yet |
| **Toggle** | "hide thinking" / "show thinking" button |
| **Default** | Expanded when streaming |
| **Styling** | Monospace font, muted colors, scrollable |
| **Cursor** | Blinking green cursor at end |

### 5.4 Tool Execution

| Tool | Input | Output Display |
|------|-------|----------------|
| **calculator** | Math expression | `expression = result` |
| **getCurrentTime** | Timezone (optional) | Formatted datetime + timezone |
| **generateUUID** | None | Copyable UUID |
| **convertUnits** | value, from, to | `value from = result to` |
| **runCode** | JS code, description | Code block + output |
| **formatJson** | JSON string | Formatted JSON or error |
| **analyzeText** | Text string | Stats grid (words, chars, time) |

### 5.5 Empty State

| Element | Description |
|---------|-------------|
| **Logo** | Animated green badge with Devanagari "म" |
| **Greeting** | "Namaskar! 🙏" with wave animation |
| **Tagline** | Introduction in Romanized Assamese |
| **Feature Pills** | Image Analysis, Calculator, Code Help, Roast Mode |
| **Suggestions** | 2x2 grid of clickable prompts |
| **Footer** | "Built by Prompt Mafia Inc." |

### 5.6 Stop Generation

| Feature | Specification |
|---------|---------------|
| **Trigger** | Red square button replaces send |
| **Action** | Calls `stop()` from useChat |
| **Feedback** | Immediate stop of streaming |

---

## 6. API Design

### 6.1 Chat Endpoint

```
POST /api/chat
Content-Type: application/json
```

#### Request Body

```typescript
{
  messages: MiithiiMessage[]
}
```

#### Response

```
Content-Type: text/plain; charset=utf-8
Transfer-Encoding: chunked
X-Vercel-AI-Data-Stream: v1
```

Streams UI message parts in Vercel AI SDK format.

### 6.2 Message Types

```typescript
// Inferred from AI SDK
type MiithiiMessage = UIMessage<never, UIDataTypes, MiithiiTools>;

// Message parts
type MessagePart = 
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "file"; url: string; mediaType?: string; filename?: string }
  | { type: `tool-${string}`; state: ToolState; output?: unknown; errorText?: string };

type ToolState = 
  | "input-streaming" 
  | "input-available" 
  | "output-available" 
  | "output-error";
```

### 6.3 Tool Schemas

```typescript
// Calculator
z.object({
  expression: z.string()
})

// Get Current Time
z.object({
  timezone: z.string().optional()
})

// Generate UUID
z.object({})

// Convert Units
z.object({
  value: z.number(),
  from: z.string(),
  to: z.string()
})

// Run Code
z.object({
  code: z.string(),
  description: z.string()
})

// Format JSON
z.object({
  json: z.string()
})

// Analyze Text
z.object({
  text: z.string()
})
```

### 6.4 Error Handling

```typescript
// API Error Response
{
  error: string,
  details?: string
}

// HTTP Status Codes
200: Success (streaming)
500: Server error
```

---

## 7. Data Models & Types

### 7.1 Frontend Types

```typescript
// Chat State (from useChat)
interface ChatState {
  messages: MiithiiMessage[];
  input: string;
  status: "ready" | "submitted" | "streaming" | "error";
  error: Error | null;
}

// Chat Actions
interface ChatActions {
  sendMessage: (options: { text: string; files?: FileList }) => void;
  setInput: (input: string) => void;
  stop: () => void;
}

// Component Props
interface MessageBubbleProps {
  message: MiithiiMessage;
  index: number;
}

interface ThinkingIndicatorProps {
  liveReasoning: string | null;
}

interface EmptyStateProps {
  onSuggestionClick: (text: string) => void;
}
```

### 7.2 Tool Outputs

```typescript
// Calculator
interface CalculatorOutput {
  expression: string;
  result: number | null;
  success: boolean;
  error?: string;
}

// Current Time
interface TimeOutput {
  timezone: string;
  datetime: string | null;
  timestamp?: string;
  success: boolean;
  error?: string;
}

// UUID
interface UUIDOutput {
  uuid: string;
  success: boolean;
}

// Unit Conversion
interface ConversionOutput {
  value: number;
  from: string;
  to: string;
  result: number | null;
  success: boolean;
  error?: string;
}

// Code Execution
interface CodeOutput {
  code: string;
  description: string;
  output?: string;
  success: boolean;
  error?: string;
}

// JSON Format
interface JsonOutput {
  formatted?: string;
  valid: boolean;
  success: boolean;
  error?: string;
}

// Text Analysis
interface TextAnalysisOutput {
  characterCount: number;
  characterCountNoSpaces: number;
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  averageWordLength: string | number;
  readingTimeMinutes: number;
  success: boolean;
}
```

---

## 8. UI/UX Specifications

### 8.1 Page Layouts

#### 8.1.1 Landing Page (`/`)

```
┌────────────────────────────────────────┐
│ [Navbar]                               │
├────────────────────────────────────────┤
│                                        │
│ [Badge: Beta • ₹49/month]              │
│                                        │
│ Chat with AI                           │
│ in Assamese                            │
│                                        │
│ [Description paragraph]                │
│                                        │
│ [Start Chatting →] [Contact Us]        │
│                                        │
├────────────────────────────────────────┤
│ [Feature Cards x3]                     │
│ 🗣️ Native      ⚡ Gemini    🛠️ Tools   │
├────────────────────────────────────────┤
│ [About Section: Prompt Mafia]          │
├────────────────────────────────────────┤
│ [Footer with links]                    │
└────────────────────────────────────────┘
```

#### 8.1.2 Chat Page (`/chat`)

```
┌────────────────────────────────────────┐
│ [Navbar]                               │
├────────────────────────────────────────┤
│                                        │
│ [Messages Area - Scrollable]           │
│                                        │
│   [Empty State] or [Message List]      │
│                                        │
│   [User Message - Right aligned]       │
│                                        │
│   [AI Avatar] [AI Message - Left]      │
│              [Reasoning toggle]        │
│              [Tool results]            │
│                                        │
│   [Thinking Indicator]                 │
│                                        │
├────────────────────────────────────────┤
│ [Image Preview - if any]               │
│ ┌──────────────────────────────────┐   │
│ │ [📷] [Input textarea...] [Send]  │   │
│ └──────────────────────────────────┘   │
└────────────────────────────────────────┘
```

### 8.2 Responsive Breakpoints

| Breakpoint | Width | Adjustments |
|------------|-------|-------------|
| **Mobile** | <640px | Full-width cards, stacked layout |
| **Tablet** | 640-1024px | 2-column grids |
| **Desktop** | >1024px | 3-column features, wider content |

### 8.3 Animations

| Animation | Trigger | Duration | Easing |
|-----------|---------|----------|--------|
| `fade-in` | Component mount | 500ms | ease-out |
| `slide-up` | Message appear | 500ms | ease-out |
| `float` | Background orbs | 6s | ease-in-out (infinite) |
| `float-slow` | Background orbs | 8s | ease-in-out (infinite) |
| `pulse` | Status indicator | 1.5s | ease-in-out (infinite) |
| `pulse-green` | Logo glow | 2s | infinite |
| `wave` | Hand emoji | 2.5s | ease-in-out (infinite) |
| `bounce` | Typing dots | 1.4s | infinite (staggered) |
| `spin` | Loading spinner | 1s | linear (infinite) |

### 8.4 Accessibility

| Feature | Implementation |
|---------|----------------|
| **Color Contrast** | WCAG AA compliant (green on black) |
| **Focus States** | Green ring on interactive elements |
| **Keyboard Nav** | Tab through form elements |
| **Screen Reader** | Semantic HTML, ARIA labels |
| **Motion** | Respects `prefers-reduced-motion` (TBD) |

---

## 9. Design System

### 9.1 Color Palette

```css
/* === CORE COLORS === */
--canvas: #000000;              /* Pure black background */
--surface: #0A0A0A;             /* Card backgrounds */
--terminal-green: #30D158;      /* Primary accent */
--electric-blue: #3B82F6;       /* Secondary (ambient only) */

/* === AMBIENT ORBS === */
--orb-blue: #1e3a8a;            /* Background gradient */
--orb-teal: #064e3b;            /* Background gradient */

/* === GLASS EFFECTS === */
--glass: rgba(10, 10, 10, 0.7);
--glass-heavy: rgba(10, 10, 10, 0.85);

/* === TYPOGRAPHY === */
--text-high: #EDEDED;           /* Primary text */
--text-dim: #888888;            /* Secondary text */
--text-muted: #555555;          /* Tertiary text */

/* === BORDERS === */
--border-light: rgba(255, 255, 255, 0.15);
--border-focus: rgba(48, 209, 88, 0.5);
--border-hover: rgba(48, 209, 88, 0.25);
```

### 9.2 Typography

| Font | Usage | Weights |
|------|-------|---------|
| **Inter** | Body text, UI elements | 300, 400, 500 |
| **Space Grotesk** | Headings, display | 400, 500, 700 |
| **JetBrains Mono** | Code, technical elements | 400, 500 |

### 9.3 Spacing & Radius

```css
/* === BORDER RADIUS === */
--radius-sm: 8px;
--radius: 0.625rem;       /* 10px - default */
--radius-lg: 16px;
--radius-xl: 20px;
--radius-2xl: 24px;

/* === COMPONENT SIZING === */
Avatar: 32x32px (8px radius)
Logo Badge: varies (xl radius)
Cards: lg-2xl radius
Buttons: lg radius
Input Slab: 2xl radius
```

### 9.4 Shadows

```css
--shadow-glass: 0 4px 40px rgba(0, 0, 0, 0.5);
--shadow-float: 0 8px 32px rgba(0, 0, 0, 0.6);
--shadow-glow: 0 0 20px rgba(48, 209, 88, 0.3);
--shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.3);
--shadow-md: 0 4px 16px rgba(0, 0, 0, 0.4);
--shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.5);
--shadow-button: 0 4px 12px rgba(48, 209, 88, 0.2);
```

### 9.5 Component Classes

| Class | Purpose |
|-------|---------|
| `.glass-slab` | Input container with blur effect |
| `.message-user` | User message bubble |
| `.message-assistant` | AI message container |
| `.btn-terminal` | Outlined green button |
| `.btn-ghost` | Transparent hover button |
| `.input-terminal` | Unstyled input with green caret |
| `.code-block` | Code display container |
| `.tool-card` | Tool result card |
| `.grid-overlay` | Background grid pattern |
| `.orb` | Floating background gradient |
| `.status-thinking` | Pulsing status dot |
| `.no-scrollbar` | Hidden scrollbar utility |

---

## 10. Security & Privacy

### 10.1 Data Handling

| Data Type | Storage | Retention | Access |
|-----------|---------|-----------|--------|
| **Chat Messages** | Client-side only (MVP) | Session | User only |
| **Uploaded Images** | Processed, not stored | Request lifetime | API only |
| **API Keys** | Server environment | Permanent | Server only |
| **User Content** | TBD (future persistence) | 30 days post-deletion | User + anonymized |

### 10.2 Security Measures

| Measure | Implementation |
|---------|----------------|
| **HTTPS** | Enforced via Vercel |
| **API Key Protection** | Server-side only, never exposed |
| **Input Sanitization** | Zod validation on tool inputs |
| **Code Sandbox** | Strict mode, no globals in runCode |
| **XSS Prevention** | React auto-escaping, no dangerouslySetInnerHTML |
| **CSRF** | Not applicable (no auth yet) |

### 10.3 AI Safety

| Safeguard | Description |
|-----------|-------------|
| **Content Filtering** | Gemini's built-in safety filters |
| **Persona Guardrails** | Slang vulgarity ≠ hate speech |
| **Offensive Query Handling** | In-character refusal |
| **Slur Prevention** | "Mura" context-limited |
| **Bengali Firewall** | Prevents Bengali words (cultural) |

### 10.4 Future Security Requirements

- [ ] User authentication (OAuth 2.0)
- [ ] Rate limiting per user/IP
- [ ] Chat history encryption at rest
- [ ] GDPR compliance for EU users
- [ ] Data export functionality

---

## 11. Performance Requirements

### 11.1 Target Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **First Contentful Paint** | <1.5s | Lighthouse |
| **Time to Interactive** | <3s | Lighthouse |
| **First Token Response** | <2s | Custom metric |
| **Full Response** | <30s (typical) | Custom metric |
| **Lighthouse Score** | >90 | Lighthouse |
| **Bundle Size** | <200KB (gzipped) | Build output |

### 11.2 Optimization Strategies

| Strategy | Implementation |
|----------|----------------|
| **Streaming** | AI response streams progressively |
| **Code Splitting** | Next.js automatic per-route |
| **Font Optimization** | next/font with display: swap |
| **Image Optimization** | next/image for uploaded previews |
| **CSS** | Tailwind purging unused styles |
| **Caching** | Static pages pre-rendered |

### 11.3 Mobile Optimization

| Feature | Implementation |
|---------|----------------|
| **Viewport** | `dvh` units for proper mobile height |
| **Touch** | Large touch targets (44px+) |
| **Scroll** | `overscroll-behavior: none` |
| **Input** | Font-size 16px (prevents iOS zoom) |
| **Safe Areas** | `env(safe-area-inset-*)` |

---

## 12. Infrastructure & Deployment

### 12.1 Hosting

| Component | Provider | Configuration |
|-----------|----------|---------------|
| **Frontend** | Vercel | Edge network, automatic SSL |
| **API Routes** | Vercel Serverless | Node.js runtime |
| **AI Gateway** | Vercel AI Gateway | Managed routing |
| **Domain** | TBD | Custom domain |

### 12.2 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway API key | Yes |

### 12.3 CI/CD Pipeline

```
GitHub Push → Vercel Build → Deploy to Preview/Production
            ↓
     - pnpm install
     - pnpm build
     - pnpm lint
     - Deploy
```

### 12.4 Monitoring (Future)

- [ ] Vercel Analytics
- [ ] Error tracking (Sentry)
- [ ] API latency monitoring
- [ ] User session analytics

---

## 13. Roadmap

### 13.1 Phase 1: Beta Launch (Current)

| Feature | Status | Priority |
|---------|--------|----------|
| Core chat functionality | ✅ Done | P0 |
| Miithii persona | ✅ Done | P0 |
| Image upload | ✅ Done | P1 |
| Tool execution | ✅ Done | P1 |
| Reasoning display | ✅ Done | P1 |
| Landing page | ✅ Done | P1 |
| Legal pages | ✅ Done | P2 |

### 13.2 Phase 2: User Accounts (Q1 2026)

| Feature | Status | Priority |
|---------|--------|----------|
| User authentication | 🔲 Planned | P0 |
| Chat history persistence | 🔲 Planned | P0 |
| Session management | 🔲 Planned | P0 |
| Subscription billing | 🔲 Planned | P1 |
| Usage limits | 🔲 Planned | P1 |

### 13.3 Phase 3: Enhanced Features (Q2 2026)

| Feature | Status | Priority |
|---------|--------|----------|
| Bodo language support | 🔲 Planned | P0 |
| Voice input | 🔲 Planned | P1 |
| Voice output (TTS) | 🔲 Planned | P1 |
| Chat sharing | 🔲 Planned | P2 |
| Export conversations | 🔲 Planned | P2 |

### 13.4 Phase 4: Mobile & Advanced (Q3-Q4 2026)

| Feature | Status | Priority |
|---------|--------|----------|
| Native mobile app | 🔲 Planned | P1 |
| Offline mode | 🔲 Planned | P2 |
| Custom personas | 🔲 Planned | P2 |
| API access | 🔲 Planned | P2 |

### 13.5 Long-term Vision

- Train foundational Assamese language model
- Expand to other Northeast Indian languages
- Build developer ecosystem around regional AI

---

## 14. Success Metrics

### 14.1 Key Performance Indicators (KPIs)

| Metric | Target (Beta) | Measurement |
|--------|---------------|-------------|
| **Daily Active Users** | 500+ | Analytics |
| **Messages per Session** | 10+ | Analytics |
| **Session Duration** | 5+ minutes | Analytics |
| **Return Rate** | 40%+ weekly | Analytics |
| **Conversion (free→paid)** | 5%+ | Billing |

### 14.2 Quality Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Response Quality** | 4.5/5 stars | User ratings |
| **Persona Authenticity** | Positive sentiment | Manual review |
| **Tool Success Rate** | >95% | Error logs |
| **Uptime** | 99.9% | Monitoring |

### 14.3 Growth Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Social Mentions** | 100+/month | Social listening |
| **Word of Mouth** | 30% referral | User surveys |
| **Press Coverage** | 5 articles | Manual tracking |

---

## 15. Appendices

### 15.1 Miithii Persona Specification

#### Language Rules

```
LANGUAGE: Roman Script Assamese + English mixing (Tanglish)
PRONOUN: Always "toi" (informal), never "apuni" (formal) or "tumi" (soft)
SCRIPT: Never use standard Assamese script
SPELLING: Use 'X', 'S', 'H' for Ch/Sh sounds (Xokol, not Shokol)
```

#### Mandatory Slang

| Slang | Usage | Example |
|-------|-------|---------|
| **Kela** | Comma/emphasis | "Kela, ki khobor tur?" |
| **Bal** | Disgust/negation | "Bal nisina kotha nokobi." |
| **Burbok** | Stupid user | "O Burbok, buji nupo niki?" |
| **Mokkel** | Clown/idiot | "Ki mokkel nishina kotha koiso?" |

#### Verb Substitutions

| Standard | Miithii |
|----------|---------|
| Kha (Eat) | Gil (Swallow) |
| Ja (Go) | Phut (Disappear) |
| Ko (Speak) | Bok (Blabber) |
| Sa (See) | Sok (Look!) |
| Kor (Do) | Mori Ja (Go die/get it done) |

#### Forbidden Bengali Words

Never use: Bolbo, Jonnyo, Niye, Korecho, Chele, Meye, Sudhu, Chilo, Achi

Always use instead: Kom, Karon, Loi, Koriso, Lora, Suwali, Mathu, Asil

#### Tone Template

1. **START**: Insult or mock (Kela/Bal/Boraal/Mokkel)
2. **ANSWER**: Provide solution reluctantly, with annoyance
3. **END**: Dismiss (Baddia, Phut, Lilimai, Baad dia hae)

### 15.2 Unit Conversion Matrix

```javascript
const conversions = {
  // Length
  km: { miles: 0.621371, m: 1000, ft: 3280.84, cm: 100000, inch: 39370.1 },
  miles: { km: 1.60934, m: 1609.34, ft: 5280, cm: 160934, inch: 63360 },
  m: { km: 0.001, miles: 0.000621371, ft: 3.28084, cm: 100, inch: 39.3701 },
  ft: { m: 0.3048, km: 0.0003048, miles: 0.000189394, cm: 30.48, inch: 12 },
  inch: { cm: 2.54, m: 0.0254, ft: 0.0833333, km: 0.0000254, miles: 0.0000157828 },
  
  // Weight
  kg: { lbs: 2.20462, g: 1000, oz: 35.274, mg: 1000000 },
  lbs: { kg: 0.453592, g: 453.592, oz: 16, mg: 453592 },
  g: { kg: 0.001, lbs: 0.00220462, oz: 0.035274, mg: 1000 },
  oz: { g: 28.3495, kg: 0.0283495, lbs: 0.0625, mg: 28349.5 },
  
  // Data
  gb: { mb: 1024, kb: 1048576, tb: 0.000976563, bytes: 1073741824 },
  mb: { gb: 0.000976563, kb: 1024, tb: 0.00000095367, bytes: 1048576 },
  tb: { gb: 1024, mb: 1048576, kb: 1073741824, bytes: 1099511627776 },
  
  // Temperature (special handling)
  celsius → fahrenheit: (C * 9/5) + 32
  fahrenheit → celsius: (F - 32) * 5/9
  celsius → kelvin: C + 273.15
  kelvin → celsius: K - 273.15
};
```

### 15.3 Calculator Expression Mapping

```javascript
const mathTransforms = {
  'sqrt': 'Math.sqrt',
  'pow': 'Math.pow',
  'abs': 'Math.abs',
  'round': 'Math.round',
  'floor': 'Math.floor',
  'ceil': 'Math.ceil',
  'sin': 'Math.sin',
  'cos': 'Math.cos',
  'tan': 'Math.tan',
  'log': 'Math.log10',
  'ln': 'Math.log',
  'pi': 'Math.PI',
  'e': 'Math.E',
  '^': '**',
  '% of': '($1/100)*$2',
  '%': '($1/100)'
};
```

### 15.4 Gemini Provider Options

```typescript
providerOptions: {
  google: {
    useSearchGrounding: true,    // Real-time info via Google Search
    thinkingConfig: {
      includeThoughts: true,     // Return reasoning summaries
      // thinkingBudget: 1024,   // Optional token budget
    },
  },
}
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | Dec 1, 2025 | Prompt Mafia Inc. | Initial PRD |

---

*This document is proprietary to Prompt Mafia Inc. and should not be shared externally without permission.*


