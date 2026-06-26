# Logstack — Documentation

## Reference Docs

| File                                                   | Description                                                                       |
| ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| [API.md](./API.md)                                     | Complete REST API reference — all endpoints, request/response shapes, error codes |
| [BACKEND.md](./BACKEND.md)                             | Go backend architecture, services, workers, WebSocket, and deployment             |
| [SDK.md](./SDK.md)                                     | JavaScript/TypeScript SDK — installation, configuration, framework integrations   |
| [DEPLOYMENT.md](./DEPLOYMENT.md)                       | Docker Compose, cloud, and VPS deployment guides                                  |
| [AWS_PRODUCTION.md](./AWS_PRODUCTION.md)                 | Full API-only EC2 production: domain, TLS, nginx, Route53, deploy                 |
| [CICD.md](./CICD.md)                                   | **Complete CI/CD guide** — CI gates, API auto-deploy, web (Vercel), SDK publish   |
| [GITHUB_AUTO_DEPLOY.md](./GITHUB_AUTO_DEPLOY.md)       | API auto-deploy quick reference (see CICD.md for full guide)                    |
| [AWS_EC2_DOCKER_DEPLOY.md](./AWS_EC2_DOCKER_DEPLOY.md) | Quick deploy/update guide for an existing Docker API on AWS EC2                   |
| [FCM_SETUP.md](./FCM_SETUP.md)                         | Firebase Cloud Messaging setup for push notifications                             |
| [CONTRIBUTING.md](./CONTRIBUTING.md)                   | How to contribute — setup, coding standards, PR process                           |

## Project Health

| File                         | Description                                           |
| ---------------------------- | ----------------------------------------------------- |
| [progress.md](./progress.md) | Real-time progress tracker — what's done, what's next |

> The earlier planning/review docs (`poor.md`, `complete_plan.md`, `product_update.md`,
> `VIBECODERS.md`) were removed once their items were addressed; see git history if you need
> the original audit. Engineering conventions live in [`../CLAUDE.md`](../CLAUDE.md) and the
> `go-and-typescript` skill.
