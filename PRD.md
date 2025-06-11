# Product Requirements Document (PRD)

## Project: **miithii** – T3 Chat Cloneathon Entry

---

## 1. **Vision & Overview**

**miithii** aims to be a best-in-class, open-source AI chat application, built for the T3 Chat Cloneathon. It will combine a beautiful, modern UI (shadcn/ui), real-time chat with multiple LLMs (via Vercel AI SDK), and robust, scalable backend (Convex) with OAuth authentication. The goal is to deliver a delightful, fast, and extensible chat experience that stands out in both performance and features.

---

## 2. **Goals & Success Criteria**

- **Win or place in the top 3** of the T3 Chat Cloneathon.
- Deliver all core requirements (multi-LLM, auth, sync, browser-friendly, easy demo).
- Implement several bonus features (attachments, image gen, syntax highlighting, resumable streams, chat sharing, BYOK, etc.).
- Ship a polished, responsive, and accessible UI.
- Ensure the codebase is open source, well-documented, and easy to extend.

---

## 3. **First Impression: BYOK (Bring Your Own Key) Experience**

### 3.1. **Why BYOK is Critical**
- Required by competition rules and essential for production use [[T3 Chat Cloneathon](https://cloneathon.t3.chat/)].
- The very first user interaction: users must enter their API key before chatting.
- Sets the tone for trust, security, and user delight.

### 3.2. **BYOK User Flow**
- **Onboarding modal/page**: Greets users, explains BYOK, and offers provider selection (OpenAI, Anthropic, OpenRouter, etc.).
- **Key input**: Secure, validated input with provider-specific help, tooltips, and "Test Key" option.
- **Privacy assurance**: Clear messaging that keys are stored only in-browser and never sent to the server.
- **Key management**: Users can update, remove, or switch keys at any time.
- **Demo mode**: Optionally, a limited demo for users without a key.
- **Innovative touches**: Animated transitions, provider logos, "paste from clipboard," and a security badge.

### 3.3. **UX Goals for BYOK**
- Fast, beautiful, and frictionless onboarding.
- Maximum trust and transparency.
- Easy for judges and users to test with their own keys.

---

## 4. **Core Features**

### 4.1. **Chat with Various LLMs**
- Support OpenAI, Anthropic, Google, and other providers via Vercel AI SDK.
- Allow users to select or switch models per chat/session.

### 4.2. **Authentication & Sync**
- OAuth login (GitHub, Google, etc.) via Convex Auth.
- User-specific chat history, synced in real-time (Convex DB).

### 4.3. **Browser-Friendly & Easy Demo**
- Fully responsive, works on desktop and mobile browsers.
- Deployed on Vercel with a public demo link.

---

## 5. **Bonus Features**

- **File/Image Attachments**: Upload images, PDFs, and display inline.
- **AI Image Generation**: Generate images from prompts (DALL·E, Gemini, etc.).
- **Syntax Highlighting**: Fast, beautiful code blocks using speed-highlight/core.
- **Resumable Streams**: Continue chat after refresh/disconnect.
- **Chat Branching**: Fork conversations to explore alternatives.
- **Chat Sharing**: Shareable links for conversations.
- **Web Search**: Integrate real-time web search in chat.
- **Bring Your Own Key (BYOK)**: Users can provide their own API keys for LLMs (see above for onboarding priority).
- **PWA/Mobile Support**: Installable, offline-friendly app.

---

## 6. **Tech Stack**

- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Chat Engine**: Vercel AI SDK (`ai` package)
- **Database/Backend**: Convex (real-time DB, functions)
- **Auth**: Convex Auth (OAuth)
- **Syntax Highlighting**: speed-highlight/core
- **Deployment**: Vercel

---

## 7. **User Stories**

### 7.1. **Core**
- As a user, I can sign up/sign in with GitHub or Google.
- As a user, I can start a new chat and select an AI model.
- As a user, I can send and receive messages in real time.
- As a user, I can see my chat history across devices.
- As a user, I must provide my own API key before chatting, and can manage it securely.

### 7.2. **Bonus**
- As a user, I can upload and view images or PDFs in chat.
- As a user, I can generate images from prompts.
- As a user, I can view code with syntax highlighting.
- As a user, I can resume a chat after a disconnect.
- As a user, I can branch a conversation and explore alternatives.
- As a user, I can share a chat with a public link.
- As a user, I can use my own API key for LLMs.
- As a user, I can install the app on my device (PWA).

---

## 8. **UI/UX Requirements**

- Use shadcn/ui for all components (chat, auth, modals, etc.).
- Modern, clean, and accessible design.
- Responsive layout for mobile and desktop.
- Fast rendering for large code blocks and long chats.
- Dark/light mode support.
- Toast notifications for errors, actions, etc.
- Smooth transitions and feedback for user actions.
- BYOK onboarding must be visually delightful and frictionless.

---

## 9. **Milestones & Timeline**

| Phase                | Tasks                                                                 | Target Date      |
|----------------------|-----------------------------------------------------------------------|------------------|
| **1. Setup**         | Repo, project structure, CI/CD, basic landing page                    | Day 1            |
| **2. Core Chat**     | LLM integration, chat UI, message streaming, authentication           | Days 1-2         |
| **3. Sync & Storage**| User chat history, Convex DB integration                              | Day 2            |
| **4. Bonus Features**| Attachments, image gen, syntax highlighting, web search, BYOK         | Days 3-5         |
| **5. Polish & PWA**  | Responsive design, PWA, chat sharing, branching                       | Days 5-6         |
| **6. Testing & Demo**| Bug fixes, deploy demo, write docs, record demo video                 | Day 7            |

---

## 10. **Open Questions & Risks**

- How to best preserve selection in code blocks with speed-highlight/core?
- LLM API cost management (BYOK, rate limits, etc.)
- Ensuring real-time sync is robust for all users
- Handling large file uploads and storage limits
- Accessibility and internationalization
- Security and privacy of BYOK implementation

---

## 11. **References & Resources**

- [Vercel AI SDK Docs](https://ai-sdk.dev/docs/introduction)
- [Vercel Chatbot UI Guide](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot)
- [Convex + Next.js Quickstart](https://docs.convex.dev/quickstart/nextjs)
- [Convex Auth OAuth Guide](https://labs.convex.dev/auth/config/oauth)
- [shadcn/ui](https://ui.shadcn.com/)
- [speed-highlight/core](https://t.co/Wxycc6K2gI)
- [T3 Chat Cloneathon](https://cloneathon.t3.chat/)

---

## 12. **Future Vision & Expansion**

After the Cloneathon, miithii will evolve into a premium, subscription-based product with a focus on advanced AI, automation, and extensibility. Here are some wild and innovative ideas for future development:

### 12.1. **Premium & Subscription Model**
- Single best-in-class LLM provider for reliability and cost control
- Stripe or Lemon Squeezy integration for payments
- Usage-based and tiered plans (Free, Pro, Enterprise)
- Enhanced user profiles, billing, and analytics dashboards

### 12.2. **AI Agents & Tool Calls**
- **Personal AI Agents:**
  - Calendar, reminders, and smart scheduling
  - Researcher (web search, fact-check, summarize, cite sources)
  - Developer agent (code generation, debugging, documentation)
  - Content creator (blog, tweet, LinkedIn post, email drafts)
- **Tool Calls & Automation:**
  - Book flights, hotels, or appointments via chat
  - Post to X (Twitter), LinkedIn, or other social platforms
  - Send emails, schedule meetings, manage tasks
  - Generate/send invoices, proposals, or reports
  - Integrate with Zapier/IFTTT for endless automation
  - Real-time data fetching (weather, stocks, news, etc.)
  - File system agent: search, organize, and summarize files in cloud storage

### 12.3. **Enterprise & Team Features**
- Team chat and shared agent workspaces
- Custom agent workflows and automations
- Audit logs, compliance, and advanced security
- SSO and advanced user management

### 12.4. **Platform Expansion**
- Mobile apps (React Native/Expo)
- Browser extensions (quick chat, context actions)
- Desktop app (Electron/Tauri)
- Voice assistant integration (Siri, Alexa, Google Assistant)

### 12.5. **Ecosystem & Marketplace**
- Plugin/agent marketplace for third-party integrations
- Community-driven features and open-source contributions
- API for developers to build on top of miithii

### 12.6. **Wild Ideas**
- **Conversational App Builder:** Let users build and deploy their own chatbots/agents with natural language prompts (no code, just chat!)
- **AI-powered Knowledge Base:** Auto-build a personal or team knowledge base from chat history, files, and web links
- **Real-time Collaboration:** Multi-user, multi-agent chat rooms for brainstorming, coding, or project management
- **Augmented Reality Chat:** Overlay chat and agent actions in AR for mobile/desktop
- **Emotional Intelligence:** AI that adapts tone, style, and suggestions based on user mood and context
- **Privacy-first AI:** End-to-end encrypted chat and agent actions, with user-owned data vaults

---

**This section is for future reference and inspiration. As miithii grows, revisit and expand these ideas to stay ahead of the curve!**

**This PRD is a living document. Update as requirements evolve or new insights are gained.** 