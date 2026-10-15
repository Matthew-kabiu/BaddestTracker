# Frontend UI and Motion Tooling Standard

**Status:** Active  
**Effective:** 2026-08-08  
**Owner:** Matthew Kabiu Makundi  
**Applies to:** Every Triffix Innovations (rebranded from SpookieLabsInc — https://triffixsolutions.co.ke) web application with a browser UI

## Governing Rule

At the start of every web application build, redesign, or material UI change, Jarvis and Tyronne must read the current applicable build template and consult the current official documentation for Kokonut UI, Motion, Anime.js, and BkLit before selecting components or animation APIs.

This document authorizes these tools as the standard frontend UI and motion toolchain. Authorization does not mean every dependency must be installed in every project. Install only the parts the approved design and feature scope actually use.

A project may also decline a lane outright, not merely defer installing it. Where a project records an architecture adoption contract that refuses one of these tools with a stated reason, that refusal governs that project and is not a deviation to be corrected. The usual case is an internal operations tool whose users are a handful of named operators doing repetitive work: a motion engine or a chart library there is dependency added for a requirement that does not exist.

Two things survive any such refusal, because they are accessibility and correctness rather than toolchain: `prefers-reduced-motion` must be respected wherever motion exists at all, and every interactive control must be keyboard reachable with a visible focus state and an accessible name.

## Canonical Documentation

- Kokonut UI Pro documentation supplied by Matt: https://kokonutui.pro/docs
- Kokonut UI free documentation and registry: https://kokonutui.com/docs
- Anime.js documentation: https://animejs.com/documentation/
- Motion documentation: https://motion.dev/docs
- BkLit installation: https://bklit.com/docs/installation
- BkLit components: https://bklit.com/docs/components

Do not rely on memory, copied snippets, or old package APIs when these official pages can be checked. Re-check the relevant page before first use, dependency upgrades, or implementation of an unfamiliar API.

## Kokonut Plan Decision

Triffix Innovations uses the **free, open-source Kokonut UI plan** by default.

- Use https://kokonutui.com and the `@kokonutui` free registry.
- Do not configure `@kokonutui-pro`.
- Do not request, create, store, or reference `KOKO_PRO_TOKEN`.
- Do not copy paid-only components from the Pro documentation.
- A future move to Pro requires Matt's explicit approval and a separate secret-handling decision.

The Pro documentation URL may be consulted for product orientation, but it is not authorization to use paid components.

## Tool Lanes

### Kokonut UI Free

Role: high-quality React and Next.js components built around shadcn/ui and Tailwind CSS v4.

Use it for component candidates and high-level UI blocks. Install only required components, then adapt their copied source to the project's tokens, accessibility requirements, design read, and architecture. Never ship a registry component unchanged simply because it renders.

### Motion

Role: the default React interaction engine.

Use `motion/react` for component enter and exit, state transitions, layout animations, gestures, scroll-linked interactions, and springs. Use CSS for simple self-contained hover or color transitions when a runtime library adds no value.

### Anime.js v4

Role: advanced sequencing and effects.

Use Anime.js for coordinated timelines, SVG work, text splitting, drag behavior, complex staggering, and effects that are awkward in declarative React animation. In React, use `createScope()` inside a client-side effect and call `scope.revert()` during cleanup.

Use current named imports. Do not use legacy Anime.js v3 default-import APIs.

### BkLit

Role: the standard chart and quantitative-visualization source for shadcn-compatible React applications.

Install charts from the `@bklit` registry and wrap each vendored chart behind a project-owned component. Every chart must provide loading, empty, error, responsive, accessible, and reduced-motion behavior.

## Registry Setup

Initialize shadcn/ui if the project has not already done so:

```bash
npx shadcn@latest init
```

Add the free registries to `components.json`:

```json
{
  "registries": {
    "@kokonutui": "https://kokonutui.com/r/{name}.json",
    "@bklit": "https://ui.bklit.com/r/{name}.json"
  }
}
```

Install the shared Kokonut utility when required:

```bash
npx shadcn@latest add https://kokonutui.com/r/utils.json
```

Example free Kokonut component:

```bash
npx shadcn@latest add @kokonutui/particle-button
```

Example BkLit chart:

```bash
npx shadcn@latest add @bklit/area-chart
```

For pnpm projects, replace `npx` with `pnpm dlx`. For Bun projects, follow the current official Kokonut documentation. Do not convert package-manager commands by guesswork.

## Runtime Installation

npm:

```bash
npm install motion animejs
```

pnpm:

```bash
pnpm add motion animejs
```

Canonical imports:

```tsx
import { motion, useReducedMotion } from "motion/react";
```

```ts
import { animate, createScope, createTimeline, stagger } from "animejs";
import { splitText } from "animejs/text";
```

`splitText` is available from the text subpath in current Anime.js releases. Check the current documentation and installed version before using it.

## React and Next.js Rules

- Motion and Anime.js code belongs in isolated client-leaf components.
- Server Components render static structure and data; they do not import browser animation runtimes.
- Centralize Motion variants and spring tokens rather than scattering arbitrary values.
- Place Anime.js work in project-owned hooks or `components/fx/*` modules.
- Never let Motion and Anime.js control the same element property at the same time.
- Every effect must clean up on unmount.
- Honor `prefers-reduced-motion` for every non-trivial animation.
- Default to animating `transform` and `opacity`; justify any layout-affecting animation.
- Lazy-load heavy, below-the-fold interaction islands where practical.

## Component and Icon Rules

Kokonut components may install Lucide because it is part of the upstream component dependency. This is permitted for vendored Kokonut components, but icons must use a consistent light stroke and be adapted to the project's chosen icon policy. Do not mix icon families casually.

Registry source is project-owned after installation. Review it for:

- accessibility and keyboard behavior
- semantic HTML
- project token usage
- responsive behavior
- reduced motion
- dependency necessity
- security and data handling
- loading, empty, error, and success states

## Stack Mapping

#### Next.js

Use the current Next.js build template. Keep animation code in client leaves, use `motion/react`, and use Kokonut or BkLit registry components only after reviewing generated files and dependencies.

#### Vite and React

Use the Vite build template. The same registry and runtime rules apply, but there are no React Server Components. Keep effects scoped and centralized.

#### Prohibited Stack: Lander

Do not use Lander for new builds, redesigns, migrations, or implementation work. The former Lander/pnpm template is archived for historical reference only. Choose the current Next.js or Vite/React template instead, based on project requirements.

#### Backend and Go Templates

Backend-only code does not install frontend dependencies. When a Node, Convex, or Go project includes a companion browser UI, pair the backend template with the appropriate frontend template and this standard.

#### Unsupported or Non-React Frontends

Do not force React-only libraries into an incompatible stack. Record the incompatibility, use the framework's official equivalent, and continue to apply this standard's accessibility, performance, reduced-motion, and documentation-verification principles.

## Verification Gate

Before completion, verify:

- [ ] The applicable build template was read.
- [ ] Current official docs were consulted for every selected tool.
- [ ] Kokonut usage is free-plan only, with no Pro registry or token.
- [ ] Only needed components and dependencies were installed.
- [ ] Generated registry source was reviewed and adapted.
- [ ] `motion/react` imports are current.
- [ ] Anime.js uses current v4 named imports and scoped cleanup.
- [ ] BkLit charts are wrapped behind project-owned components.
- [ ] Motion and Anime.js do not fight over the same properties.
- [ ] Reduced motion, keyboard use, responsive behavior, and UI states were tested.
- [ ] Type checks, lint, tests, build, and dependency audit pass.
- [ ] The root `CHANGELOG.md` records first adoption or material upgrades.

## Precedence

1. Matt's current instruction.
2. Security, accessibility, framework constraints, and production safety.
3. The project's selected build template.
4. The project's architecture adoption contract, where one exists, for whether a lane applies to that project at all.
5. This tooling standard.
6. Official current documentation for exact package APIs.
7. Design skills and project-specific visual direction.

When exact API guidance in a template conflicts with current official documentation, the official documentation wins for the API detail. Update the stale template in the same change.
