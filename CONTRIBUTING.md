# Contributing to ZodForge Cloud API

Thank you for your interest in contributing to ZodForge Cloud API! This document provides guidelines and instructions for contributing.

---

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Commit Message Conventions](#commit-message-conventions)
- [Pull Request Process](#pull-request-process)
- [Project Structure](#project-structure)

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inspiring community for all. Please be respectful and constructive in your interactions.

### Our Standards

- ✅ Use welcoming and inclusive language
- ✅ Be respectful of differing viewpoints
- ✅ Accept constructive criticism gracefully
- ✅ Focus on what is best for the community

---

## Getting Started

### Prerequisites

- **Node.js**: 20.x or higher
- **npm**: 10.x or higher
- **Git**: Latest version
- **TypeScript**: 5.x (installed via npm)
- **API Keys**:
  - OpenAI API key (required)
  - Anthropic API key (optional)
  - Supabase project (optional for usage tracking)

### Initial Setup

1. **Fork the repository** on GitHub

2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/zodforge-api.git
   cd zodforge-api
   ```

3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/MerlijnW70/zodforge-api.git
   ```

4. **Install dependencies**:
   ```bash
   npm install
   ```

5. **Set up environment variables**:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your API keys:
   ```bash
   OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE
   ZODFORGE_API_KEY=zf_YOUR_GENERATED_KEY_HERE
   ```

   Generate a ZodForge API key:
   ```bash
   node -e "console.log('zf_' + require('crypto').randomBytes(32).toString('hex'))"
   ```

6. **Verify installation**:
   ```bash
   npm run type-check  # TypeScript compilation
   npm test            # Run test suite
   ```

---

## Development Workflow

### 1. Create a Branch

Always create a new branch for your changes:

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

### 2. Make Changes

- Write clean, readable code
- Follow existing code style
- Add tests for new features
- Update documentation as needed

### 3. Run Tests Locally

```bash
# Type checking
npm run type-check

# Run all tests
npm test

# Watch mode (for development)
npm run test:watch

# Coverage report
npm run test:coverage
```

### 4. Commit Your Changes

Follow our [commit message conventions](#commit-message-conventions).

### 5. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

### 6. Create a Pull Request

- Go to GitHub and create a PR from your fork
- Fill out the PR template
- Link any related issues

---

## Coding Standards

### TypeScript Guidelines

1. **Use strict TypeScript**:
   - No `any` types (use `unknown` instead)
   - Enable strict mode in `tsconfig.json`
   - Explicitly type all function parameters and return types

2. **Naming Conventions**:
   - **Files**: `kebab-case.ts` (e.g., `openai-provider.ts`)
   - **Classes**: `PascalCase` (e.g., `OpenAIProvider`)
   - **Functions**: `camelCase` (e.g., `refineSchema`)
   - **Constants**: `UPPER_SNAKE_CASE` (e.g., `TIER_LIMITS`)
   - **Interfaces**: `PascalCase` (e.g., `RefinementRequest`)

3. **Code Organization**:
   ```typescript
   // ✅ Good: Explicit types
   function buildPrompt(request: RefinementRequest): string {
     return `Analyze this schema...`;
   }

   // ❌ Bad: Implicit any
   function buildPrompt(request) {
     return `Analyze this schema...`;
   }
   ```

### Fastify Best Practices

1. **Route Organization**:
   - Keep routes in separate files under `src/routes/`
   - Use Fastify plugins for modularity
   - Register routes with proper prefixes

2. **Error Handling**:
   ```typescript
   // ✅ Good: Proper error handling
   try {
     const result = await riskyOperation();
     return reply.code(200).send({ success: true, result });
   } catch (error) {
     const sanitized = sanitizeError(error);
     return reply.code(500).send({
       success: false,
       error: sanitized
     });
   }
   ```

### Security Guidelines

1. **Never log sensitive data**:
   ```typescript
   // ✅ Good
   console.log('API key:', maskApiKey(apiKey));

   // ❌ Bad
   console.log('API key:', apiKey);
   ```

2. **Sanitize all errors**:
   - Use `sanitizeError()` for production error messages
   - Never expose stack traces in API responses

3. **Validate all inputs**:
   - Use Zod schemas for request validation
   - Check content-type headers
   - Enforce request size limits

---

## Testing Guidelines

### Test Structure

Tests are organized under `src/__tests__/`:
```
src/__tests__/
├── routes/           # API route tests
├── lib/              # Library function tests
│   ├── providers/    # AI provider tests
│   └── security.test.ts
├── middleware/       # Middleware tests
└── integration/      # End-to-end tests
```

### Writing Tests

1. **Use Vitest syntax**:
   ```typescript
   import { describe, it, expect } from 'vitest';

   describe('Feature Name', () => {
     it('should do something specific', () => {
       const result = myFunction();
       expect(result).toBe(expected);
     });
   });
   ```

2. **Test both success and failure cases**:
   ```typescript
   describe('validateApiKey', () => {
     it('should accept valid OpenAI keys', () => {
       expect(validateApiKey('sk-proj-...')).toBe(true);
     });

     it('should reject short keys', () => {
       expect(validateApiKey('sk-short')).toBe(false);
     });
   });
   ```

3. **Use descriptive test names**:
   - ✅ `should reject missing Authorization header (401)`
   - ❌ `test 1`

### Test Coverage Requirements

- **Minimum**: All new code must have tests
- **Target**: 70% coverage for new files
- **Current**: 41.24% overall coverage

Run coverage report:
```bash
npm run test:coverage
```

---

## Commit Message Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `security`: Security improvements

### Examples

```bash
# Feature
feat(providers): Add Google Gemini AI provider

# Bug fix
fix(auth): Validate API key format before hashing

# Documentation
docs: Update deployment guide for Vercel

# Tests
test: Add coverage for usage tracker edge cases

# Chore
chore: Bump dependencies to latest versions
```

### Commit Body (Optional)

Add more context if needed:
```
feat(providers): Add Google Gemini AI provider

Added Gemini 1.5 Pro as a third fallback option for schema refinement.
Includes provider health checks and automatic failover logic.

Closes #42
```

---

## Pull Request Process

### Before Submitting

1. ✅ All tests pass (`npm test`)
2. ✅ Type checking passes (`npm run type-check`)
3. ✅ Coverage doesn't decrease (`npm run test:coverage`)
4. ✅ Code follows style guidelines
5. ✅ Commit messages follow conventions
6. ✅ Documentation updated (if needed)

### PR Title Format

Use the same format as commit messages:
```
feat(providers): Add Google Gemini AI provider
```

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] All tests pass locally
- [ ] Added new tests for this change
- [ ] Coverage increased/maintained

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings introduced
```

### Review Process

1. **Automated Checks**: GitHub Actions will run tests and type checking
2. **Code Review**: Maintainer will review your code
3. **Revisions**: Address any requested changes
4. **Approval**: Once approved, maintainer will merge

---

## Project Structure

```
zodforge-api/
├── src/
│   ├── __tests__/         # Test files
│   │   ├── routes/        # Route tests
│   │   ├── lib/           # Library tests
│   │   ├── middleware/    # Middleware tests
│   │   └── integration/   # E2E tests
│   ├── config/            # Configuration
│   │   └── env.ts         # Environment variables
│   ├── lib/               # Shared utilities
│   │   ├── providers/     # AI providers
│   │   │   ├── base.ts
│   │   │   ├── openai-provider.ts
│   │   │   ├── anthropic-provider.ts
│   │   │   └── factory.ts
│   │   └── security.ts    # Security utilities
│   ├── middleware/        # Fastify middleware
│   │   ├── auth.ts
│   │   └── usage-tracker.ts
│   ├── routes/            # API routes
│   │   ├── health.ts
│   │   ├── refine.ts
│   │   └── usage.ts
│   ├── types/             # TypeScript types
│   │   └── index.ts
│   └── server.ts          # Main server file
├── dist/                  # Compiled output
├── .env.example           # Environment template
├── .gitignore
├── CHANGELOG.md
├── CONTRIBUTING.md
├── DEPLOYMENT.md
├── LICENSE
├── package.json
├── README.md
├── SECURITY.md
├── TESTING.md
├── tsconfig.json
└── vitest.config.ts
```

---

## Getting Help

### Documentation

- [README.md](README.md) - API documentation
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide
- [SECURITY.md](SECURITY.md) - Security documentation
- [TESTING.md](TESTING.md) - Testing guide

### Questions?

- **Issues**: [GitHub Issues](https://github.com/MerlijnW70/zodforge-api/issues)
- **Discussions**: [GitHub Discussions](https://github.com/MerlijnW70/zodforge-api/discussions)

---

## Recognition

Contributors will be recognized in:
- GitHub Contributors page
- Release notes
- CHANGELOG.md

---

Thank you for contributing to ZodForge Cloud API! 🚀
