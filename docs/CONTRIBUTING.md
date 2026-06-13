# Contributing to Logstack

Thank you for your interest in contributing to Logstack! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a welcoming, inclusive, and harassment-free environment for everyone.

## How to Contribute

### Reporting Bugs

1. **Check existing issues** — Search [GitHub Issues](https://github.com/mosesedem/logstack/issues) to see if the bug has already been reported.

2. **Create a new issue** — If not, create a new issue with:
   - Clear, descriptive title
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node.js version, etc.)
   - Relevant logs or screenshots

### Suggesting Features

1. **Check existing discussions** — Search [GitHub Discussions](https://github.com/mosesedem/logstack/discussions) for similar ideas.

2. **Start a discussion** — Describe your feature request with:
   - Use case and problem it solves
   - Proposed solution
   - Alternatives considered

### Pull Requests

1. **Fork the repository**

   ```bash
   git clone https://github.com/your-username/logstack.git
   cd logstack
   ```

2. **Create a feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Follow the coding standards below
   - Add tests for new functionality
   - Update documentation as needed

4. **Commit your changes**

   ```bash
   git commit -m "feat: add amazing feature"
   ```

   Follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` New feature
   - `fix:` Bug fix
   - `docs:` Documentation changes
   - `style:` Code style changes (formatting, etc.)
   - `refactor:` Code refactoring
   - `test:` Adding or updating tests
   - `chore:` Maintenance tasks

5. **Push and create PR**

   ```bash
   git push origin feature/your-feature-name
   ```

   Then create a Pull Request on GitHub.

## Development Setup

### Prerequisites

### Getting Started

```bash
# Clone your fork
git clone https://github.com/your-username/logstack.git
cd logstack

# Install dependencies
pnpm install

# Copy environment configuration
cp .env.example .env

# Start infrastructure
docker-compose -f docker-compose.dev.yml up -d

# Start backend
cd packages/logstack-go
go run cmd/server/main.go

# Start web (new terminal)
cd apps/web
pnpm dev
```

### Running Tests

```bash
# Go backend tests
cd packages/logstack-go
go test ./...

# JavaScript SDK tests
cd packages/logstack-js
pnpm test

# Web app tests
cd apps/web
pnpm test

# E2E tests
pnpm test:e2e
```

### Linting

```bash
# Lint all packages
pnpm lint

# Fix auto-fixable issues
pnpm lint:fix
```

## Coding Standards

### TypeScript / JavaScript

```typescript
// ✅ Good
export async function createProject(name: string): Promise<Project> {
  const project = await db.projects.create({ name });
  return project;
}

// ❌ Avoid
export function createProject(name, callback) {
  db.projects.create({ name }, callback);
}
```

### Go

```go
// ✅ Good
func (s *ProjectService) Create(ctx context.Context, name string) (*Project, error) {
    if name == "" {
        return nil, ErrEmptyName
    }
    // ...
}

// ❌ Avoid
func (s *ProjectService) Create(name string) *Project {
    // ...
}
```

### Flutter / Dart

## Project Structure

```
logstack/
├── packages/
│   ├── logstack-js/        # JavaScript SDK
│   │   ├── src/            # Source code
│   │   └── tests/          # Unit tests
│   ├── logstack-go/        # Go backend
│   │   ├── cmd/            # Entry points
│   │   ├── internal/       # Private packages
│   │   └── migrations/     # Database migrations
│   └── shared-types/       # Shared TypeScript types
├── apps/
│   ├── web/                # Next.js dashboard
│   │   ├── src/app/        # App router pages
│   │   ├── src/components/ # React components
│   │   └── content/        # MDX documentation
│   └── mobile/             # Flutter app
├── docs/                   # Legacy markdown docs
└── infra/                  # Infrastructure configs
```

## Documentation

## Questions?

Thank you for contributing! 🎉
