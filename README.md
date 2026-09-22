# medik8s PR Radar

Open PR dashboard for medik8s and OpenShift teams. One table with CI status, bot reviews, peer comments, and author filters.

**Live:** https://pr-radar-web-lac.vercel.app

## What it shows

| Column | Description |
|--------|-------------|
| State | PR state: open, draft, or closed/merged |
| Author | PR author (GitHub handle) |
| Repo | Shortened org/repo with full name on hover |
| PR | Number linking to GitHub |
| Title | PR title |
| CI | Default CI checks as colored dots (green/red/yellow) |
| E2E | Periodic `pj-rehearse` / e2e job status |
| Qodo | Qodo AI review: clean, open items, thinking, or rate-limited |
| CR | CodeRabbit review: same states |
| Comments | Human review threads: unreplied comments and unresolved/total inline threads |
| Reviews | Approvals (✓) and changes-requested (✗) |
| Commits | Commit count |
| Labels | GitHub labels with color-coded categories (approval, blocker, size, area) |

## Filters

- **Smart filters:** "Needs attention" (failing CI / open bot items / unresolved comments) and "Ready to merge"
- **State:** open / draft / closed (multi-select)
- **Repo:** per-repository (multi-select, with custom org/repo input)
- **Authors:** multi-select from configured team members; PRs are always filtered to configured authors even when "all" is selected

## Default repos and authors

Configured in `packages/core/src/config/default.ts`:

**Repos (9):** medik8s/fence-agents-remediation, medik8s/self-node-remediation, medik8s/node-healthcheck-operator, medik8s/machine-deletion-remediation, medik8s/node-maintenance-operator, medik8s/storage-based-remediation, medik8s/common, medik8s/system-tests, openshift/release

**Authors (21):** The union of approvers and reviewers from the tracked medik8s repositories' OWNERS and OWNERS\_ALIASES files, plus contributor exceptions.

All configured authors' PRs are fetched on load via one GitHub GraphQL query per repository. Author filtering is applied entirely in the browser.

## Design

Uses a shared dark theme with the [medik8s CI Dashboard](https://github.com/medik8s/ci-dashboard), defined via Tailwind v4 `@theme` design tokens in `packages/web/src/app/globals.css`. Surfaces, text, accent, border, and status colors are all centralized as CSS custom properties.

## Stack

```
packages/
  core/   — GitHub GraphQL API, Upstash Redis cache, config, types
  web/    — Next.js 15, TanStack Table, Clerk auth, Tailwind v4
  cli/    — Terminal table output (tsx packages/cli/src/index.ts)
```

- **Auth:** Clerk (GitHub OAuth; custom medik8s OAuth App with `public_repo` and `read:org` scopes)
- **Cache:** Upstash Redis, keyed per repository, 15-min freshness with 24-hour stale fallback
- **Hosting:** Vercel (auto-deploy from `main`)

## Local dev

```bash
pnpm install

# Copy env template and fill in values
cp .env.example packages/web/.env.local

pnpm dev   # → http://localhost:3000
```

Required env vars (see `.env.example`):

| Variable | Source |
|----------|--------|
| `GITHUB_TOKEN` | GitHub PAT or `gh auth token` (optional; falls back to Clerk OAuth token) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk dashboard |
| `CLERK_SECRET_KEY` | Clerk dashboard |
| `KV_REST_API_URL` | Upstash console |
| `KV_REST_API_TOKEN` | Upstash console |

Note: a local production build (`pnpm build`) requires Clerk environment variables; without them, compilation succeeds but Clerk prerendering fails.

## CLI

```bash
# Uses GITHUB_TOKEN or gh auth token
pnpm --filter cli dev

# Add extra repos at runtime
pnpm --filter cli dev -- org/repo
```

## Adding a new default repo

Edit `packages/core/src/config/default.ts`:

```ts
{
  repo: "your-org/your-repo",
  ciPatterns: {
    e2e: ["pj-rehearse*", "*e2e*"],
    ignore: [],
  },
}
```

CI job names matching `e2e` patterns go in the E2E column; everything else goes in the CI column.

## Updating default authors

Re-read the tracked medik8s repositories' root `OWNERS` and `OWNERS_ALIASES` files, update `DEFAULT_AUTHORS` in `packages/core/src/config/default.ts`, and preserve only explicitly approved contributor exceptions. Increment the `pr-radar:authorFilter:vN` key in `packages/web/src/components/PrTable.tsx` when existing browsers must receive a changed default list.
