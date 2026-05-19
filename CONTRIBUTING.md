# Contributing to Minder Nexus

Thank you for your interest in contributing to Minder Nexus! This document outlines the guidelines and steps to help you get started with contributing to this Obsidian plugin.

## Developer Guidelines

To ensure code quality and consistency, please follow these guidelines:

### Setup instructions

1. Clone this repository.
2. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```
3. Start the compilation watcher:
   ```bash
   npm run dev
   ```

### Code Style & Verification

We adhere strictly to the Obsidian Developer Policies. Before submitting code, please ensure:

* All UI texts, titles, descriptions, and placeholders use **Sentence case** (e.g., "Semantic engine" instead of "Semantic Engine").
* Run ESLint/TypeScript check to ensure there are no formatting or policy issues.
* Test your changes locally inside Obsidian to verify they do not introduce memory leaks or unexpected exceptions.

### Pull Request Process

1. Create a branch named `feature/<your-feature>` or `fix/<your-fix>`.
2. Commit your changes using Conventional Commits guidelines (e.g., `feat(visualizer): add custom relation colors`).
3. Open a Pull Request targeting the `main` branch.
