---
name: feedback-no-dev-seeding
description: Never seed or mutate the dev Liveblocks environment — use isolated E2E/Playwright tests instead
metadata:
  type: feedback
---

Never seed, delete, or recreate rooms in the dev Liveblocks environment for testing purposes.

**Why:** User considers dev environment state precious and doesn't want test data polluting it.

**How to apply:** When visual/integration testing is needed, use Playwright E2E with a test harness page that renders components with fixture data — no real Liveblocks backend. Extract presentational components that accept data props so they can be tested without Liveblocks hooks. Related: [[feedback_update_issues]]
