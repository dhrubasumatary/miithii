# Miithii 🇮🇳

**Chat with AI in Assamese**

Miithii (मिथि - "to understand" in Bodo) is an AI-powered chat application that speaks native Assamese. Built by Prompt Mafia Inc.

![Miithii Screenshot](./screenshot.png)

## Features

- 🗣️ **Native Assamese** - Street-level Guwahati dialect, not textbook Sahitya Sabha
- ⚡ **Gemini 2.5 Pro** - Powered by Google's most capable model with thinking/reasoning
- 🖼️ **Image Analysis** - Upload images for AI analysis
- 🛠️ **Built-in Tools** - Calculator, time zones, unit converter, code runner
- 🌙 **Beautiful Dark UI** - Terminal-inspired glass morphism design

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS v4
- **AI**: Vercel AI SDK v5 + AI Gateway
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
# Clone the repo
git clone https://github.com/promptmafia/miithii.git
cd miithii

# Install dependencies
pnpm install

# Copy environment variables
cp .env.local.example .env.local

# Add your Vercel AI Gateway API key to .env.local
```

### Development

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

### Production

```bash
pnpm build
pnpm start
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway API key | Yes |

## Project Structure

```
src/app/
├── api/miithii/     # Chat API route
├── miithii/         # Main chat page
├── contact/         # Contact page
├── terms/           # Terms & conditions
├── refund/          # Refund policy
├── globals.css      # Design system
├── layout.tsx       # Root layout
└── page.tsx         # Landing page
```

## Roadmap

- [ ] User authentication
- [ ] Chat history persistence
- [ ] Bodo language support
- [ ] Voice input/output
- [ ] Mobile app

## Contributing

We're looking for young talent to help build a foundational AI model for low-resource languages. Interested? Email us at [support@miithii.com](mailto:support@miithii.com)

## License

Proprietary - © 2025 Prompt Mafia Inc.

---

Made with ☕ in Guwahati

