<p align="center">
  <img src="https://raw.githubusercontent.com/your-org/logstack/main/docs/logo.svg" alt="Logstack Logo" width="120" />
</p>

<h1 align="center">Logstack</h1>

<p align="center">
  <strong>Production-Ready Log Management Platform</strong>
</p>

<p align="center">
  Real-time streaming • Smart alerts • Beautiful dashboard • Self-hostable
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/logstack-js"><img src="https://img.shields.io/npm/v/logstack-js.svg?style=flat-square" alt="npm version" /></a>
  <a href="https://github.com/mosesedem/logstack/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License" /></a>
  <a href="https://github.com/mosesedem/logstack/actions"><img src="https://img.shields.io/github/actions/workflow/status/your-org/logstack/ci.yml?style=flat-square" alt="Build Status" /></a>
  <a href="https://discord.gg/logstack"><img src="https://img.shields.io/discord/1234567890?style=flat-square&logo=discord&logoColor=white" alt="Discord" /></a>
</p>

<p align="center">
  <a href="https://logstack.tech/docs">Documentation</a> •
  <a href="https://logstack.tech/docs/quickstart">Quick Start</a> •
  <a href="https://logstack.tech/docs/deployment/overview">Self-Hosting</a> •
  <a href="https://discord.gg/logstack">Discord</a>
</p>

---

## Why Logstack?

Logstack is a **complete log management solution** designed for modern applications. Unlike complex enterprise tools, Logstack is simple to set up, easy to self-host, and built with developers in mind.

| Feature             | Logstack | Datadog | Logtail | Self-built |
| ------------------- | -------- | ------- | ------- | ---------- |
| Real-time streaming | ✅       | ✅      | ✅      | ❌         |
| Smart alerting      | ✅       | ✅      | ✅      | ❌         |
| Mobile app          | ✅       | ❌      | ❌      | ❌         |
| Self-hostable       | ✅       | ❌      | ❌      | ✅         |
| Open source         | ✅       | ❌      | ❌      | ✅         |
| Free tier           | ✅       | Limited | Limited | ✅         |
| Setup time          | 5 min    | 30 min  | 15 min  | Days       |

## Features

- **📡 Real-time Streaming** — WebSocket-powered live log streaming to dashboard and mobile
- **🔔 Smart Alerts** — Pattern matching with cooldowns, email & push notifications
- **📊 Beautiful Dashboard** — Search, filter, and analyze logs with an intuitive interface
- **📱 Mobile Apps** — iOS & Android apps with offline support
- **🔌 Easy Integration** — TypeScript SDK with framework integrations (Express, Next.js, Fastify, NestJS)
- **🏠 Self-Hostable** — Deploy on your infrastructure with Docker Compose
- **🔒 Secure** — JWT authentication, rate limiting, CORS protection

## Quick Start

### 1. Install the SDK

```bash
npm install logstack-js
```

### 2. Start Logging

```typescript
import { createLogStack } from "logstack-js";

const logstack = createLogStack({
  apiKey: process.env.LOGSTACK_API_KEY,
});

// Send structured logs
logstack.info("User signed up", { userId: "user_123", plan: "pro" });
logstack.warn("Rate limit approaching", { current: 90, limit: 100 });
logstack.error("Payment failed", {
  orderId: "order_456",
  error: "Card declined",
});
logstack.critical("Database connection lost", { host: "db.example.com" });

// Graceful shutdown
process.on("SIGTERM", () => logstack.close());
```

### 3. View Your Logs

Open the [Logstack dashboard](https://logstack.tech) to see your logs streaming in real-time.

## Self-Hosting

Deploy Logstack on your own infrastructure in minutes:

```bash
# Clone the repository
git clone https://github.com/mosesedem/logstack.git
cd logstack

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start all services
docker-compose up -d

# Verify deployment
curl http://localhost:8080/health
```

See the [Self-Hosting Guide](https://logstack.tech/docs/deployment/overview) for detailed instructions.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
├──────────────────────┬──────────────────────┬───────────────────┤
│  NPM Package         │  Next.js Dashboard   │  Flutter App      │
│  (logstack-js)       │  (Web Interface)     │  (iOS/Android)    │
└──────────┬───────────┴──────────┬───────────┴───────┬───────────┘
           │                      │                   │
           └──────────────────────┼───────────────────┘
                                  │
                         ┌────────▼─────────┐
                         │   Load Balancer  │
                         └────────┬─────────┘
                                  │
    ┌──────────────────────────────┼──────────────────────────────┐
    │                              │                              │
┌───▼────┐                 ┌───────▼────────┐            ┌───────▼────────┐
│ Go API │                 │   WebSocket    │            │  Worker Pool   │
│ Server │                 │   Server       │            │  (Alerts)      │
└───┬────┘                 └───────┬────────┘            └───────┬────────┘
    │                              │                              │
    └──────────────────────────────┼──────────────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
       ┌──────▼──────┐      ┌──────▼──────┐     ┌───────▼───────┐
       │ PostgreSQL  │      │    Redis    │     │ Resend / FCM  │
       └─────────────┘      └─────────────┘     └───────────────┘
```

## Project Structure

```
logstack/
├── packages/
│   ├── logstack-js/        # JavaScript/TypeScript SDK
│   ├── logstack-go/        # Go backend API server
│   └── shared-types/       # Shared TypeScript types
├── apps/
│   ├── web/                # Next.js dashboard
│   └── mobile/             # Flutter mobile app
├── docs/                   # Documentation (Markdown)
└── infra/                  # Infrastructure configs
```

## Documentation

- **[Quick Start](https://logstack.tech/docs/quickstart)** — Get up and running in 5 minutes
- **[SDK Reference](https://logstack.tech/docs/sdk/overview)** — Complete JavaScript/TypeScript SDK guide
- **[API Reference](https://logstack.tech/docs/api/overview)** — REST API endpoints and authentication
- **[Self-Hosting](https://logstack.tech/docs/deployment/overview)** — Deploy Logstack on your infrastructure
- **[Production Checklist](https://logstack.tech/docs/deployment/production-checklist)** — Security and performance best practices

## Development

### Prerequisites

- Node.js 18+
- Go 1.21+
- Docker & Docker Compose
- Flutter 3.10+ (for mobile)
- pnpm 8+

### Setup

```bash
# Clone and install dependencies
git clone https://github.com/mosesedem/logstack.git
cd logstack
pnpm install

# Start infrastructure
docker-compose -f docker-compose.dev.yml up -d

# Start Go backend
cd packages/logstack-go
go run cmd/server/main.go

# Start web dashboard (new terminal)
cd apps/web
pnpm dev

# Start mobile app (new terminal)
cd apps/mobile
flutter run
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](docs/CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Community

- **[Discord](https://discord.gg/logstack)** — Chat with the community
- **[GitHub Discussions](https://github.com/mosesedem/logstack/discussions)** — Ask questions and share ideas
- **[Twitter](https://twitter.com/logstackio)** — Follow for updates

## License

Logstack is open source software licensed under the [MIT License](LICENSE).

---

<p align="center">
  Made with ❤️ by the Logstack team
</p>
