# Logstack — Documentation

## Reference Docs

| File                                                   | Description                                                                       |
| ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| [API.md](./API.md)                                     | Complete REST API reference — all endpoints, request/response shapes, error codes |
| [BACKEND.md](./BACKEND.md)                             | Go backend architecture, services, workers, WebSocket, and deployment             |
| [SDK.md](./SDK.md)                                     | **All SDKs** — JavaScript (`logstack-js`), Go (`logstack-go-sdk`), Python (`logstack-py`) |
| [DEPLOYMENT.md](./DEPLOYMENT.md)                       | Docker Compose, cloud, and VPS deployment guides                                  |
| [AWS_PRODUCTION.md](./AWS_PRODUCTION.md)               | Full API-only EC2 production: domain, TLS, nginx, Route53, deploy                 |
| [CICD.md](./CICD.md)                                   | **Complete CI/CD guide** — CI gates, API auto-deploy, web (Vercel), SDK publish   |
| [GITHUB_AUTO_DEPLOY.md](./GITHUB_AUTO_DEPLOY.md)       | API auto-deploy quick reference (see CICD.md for full guide)                      |
| [AWS_EC2_DOCKER_DEPLOY.md](./AWS_EC2_DOCKER_DEPLOY.md) | Quick deploy/update guide for an existing Docker API on AWS EC2                   |
| [FCM_SETUP.md](./FCM_SETUP.md)                         | Firebase Cloud Messaging setup for push notifications                             |
| [CONTRIBUTING.md](./CONTRIBUTING.md)                   | How to contribute — setup, coding standards, PR process                           |

## Product docs (fumadocs)

Published site content lives under `apps/web/content/docs/`:

| Path | Topic |
| --- | --- |
| `sdk/overview.mdx` | Multi-language SDK hub |
| `sdk/javascript.mdx` | logstack-js |
| `sdk/go.mdx` | logstack-go-sdk |
| `sdk/python.mdx` | logstack-py |
| `sdk/configuration.mdx` | JS configuration deep-dive |
| `sdk/logging.mdx` | Levels & metadata (all languages) |
| `sdk/frameworks.mdx` | Express, Next, Nest, Django, FastAPI, Go net/http |

## Project Health

| File                         | Description                                           |
| ---------------------------- | ----------------------------------------------------- |
| [progress.md](./progress.md) | Real-time progress tracker — what's done, what's next |

> Engineering conventions live in [`../CLAUDE.md`](../CLAUDE.md) and the
> `go-and-typescript` skill.
