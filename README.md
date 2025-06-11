# miithii

> **A modern, open-source AI chat app for the T3 Chat Cloneathon**

![miithii banner](public/og-miithii.png)

---

## 🚀 Overview
miithii is a next-generation, developer-centric AI chat application built for the [T3 Chat Cloneathon](https://cloneathon.t3.chat/). It features a beautiful, fast, and extensible UI, real-time chat with multiple LLMs, and a robust backend. Designed for both hackers and end-users, miithii is open source and ready for your next conversation.

---

## ✨ Features
- **Multi-LLM Chat**: Connect to OpenAI, Anthropic, OpenRouter, and more (BYOK)
- **Authentication**: OAuth login (GitHub, Google, etc.)
- **Real-time Sync**: Chat history synced across devices (Convex)
- **Modern UI**: shadcn/ui, Tailwind CSS, custom palette, dark mode
- **File & Image Attachments**
- **AI Image Generation**
- **Syntax Highlighting**: Blazingly fast code blocks
- **Resumable Streams**: Continue after refresh
- **Chat Branching & Sharing**
- **Web Search Integration**
- **PWA/Mobile Ready**
- **Developer Experience**: pnpm, TypeScript, modular codebase

---

## 🛠️ Tech Stack
- **Framework:** Next.js (App Router, TypeScript)
- **Styling:** Tailwind CSS, shadcn/ui
- **Icons:** lucide-react
- **Fonts:** Satoshi, Space Grotesk, Inter (@fontsource)
- **Backend/DB:** Convex
- **AI/Chat Engine:** Vercel AI SDK
- **Animations:** tailwindcss-animate

---

## 📦 Getting Started

### 1. Clone the repo
```bash
pnpm create next-app miithii
cd miithii
```

### 2. Install dependencies
```bash
pnpm install
```

### 3. Start the development server
```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

---

## 📝 Project Structure
```
miithii/
├─ src/
│  ├─ app/           # Next.js app directory
│  ├─ components/    # Reusable UI components
│  ├─ lib/           # Utilities, hooks, helpers
│  └─ ...
├─ public/           # Static assets
├─ tailwind.config.js
├─ README.md
└─ ...
```

---

## ⚡ Commands
- `pnpm dev` – Start dev server
- `pnpm build` – Build for production
- `pnpm lint` – Run linter
- `pnpm add <package>` – Add dependencies

---

## 🤝 Contributing
Contributions, issues, and feature requests are welcome!<br>
See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines (coming soon).

---

## 📄 License
[MIT](LICENSE)

---

## 🌐 Links
- [T3 Chat Cloneathon](https://cloneathon.t3.chat/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Convex](https://convex.dev/)
- [Vercel AI SDK](https://ai-sdk.dev/docs/introduction)

---

**This project is for the T3 Chat Cloneathon. For future plans and wild ideas, see PRD.md.**
