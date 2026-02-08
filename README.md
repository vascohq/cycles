# 🌀 Cycles

A project management tool built to support the [Shape Up](https://basecamp.com/shapeup) methodology, helping teams work in focused cycles with clear outcomes and visual progress tracking.

## Core Principles

**No Backlog, No Noise**
Only work that has been properly shaped and prioritized moves forward. No endless backlog of tasks cluttering your view.

**Keep the Slate Clean**
Each cycle starts fresh, with no unfinished work carried over. This ensures that every new cycle is focused and deliberate.

**Autonomy and Responsibility**
Teams have the autonomy to decide how to solve problems, and the responsibility to deliver outcomes within the cycle.

**Outcome-Driven Development**
Focus on the outcomes you want to achieve, not the specific tasks or implementations.

**Clear, Visual Progress**
Tools like hill charts provide clear visibility into progress, helping teams manage work and communicate status without unnecessary meetings.

**Focus on Real Work, Not Estimates**
Emphasis is on doing the work rather than spending time on detailed estimates, promoting practical and efficient project delivery.

## Requirements

- **Node.js** 18.x or higher
- **Yarn** (this project uses yarn, not npm)

## Getting Started

1. **Install dependencies:**

```bash
yarn install
```

2. **Set up environment variables:**

Copy the `.env.example` file to `.env.local` and configure your environment:

```bash
cp .env.example .env.local
```

3. **Run the development server:**

```bash
yarn dev
```

4. **Open your browser:**

Navigate to [http://localhost:3000](http://localhost:3000) to see the application.

## Built With

- [Next.js 15](https://nextjs.org/) - React framework
- [React 19](https://react.dev/) - UI library
- [TypeScript](https://www.typescriptlang.org/) - Type safety

## Shape Up Resources

- [Shape Up Book](https://basecamp.com/shapeup) - The complete guide to the Shape Up methodology
- [Hill Charts](https://basecamp.com/features/hill-charts) - Understanding progress visualization
