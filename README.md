# Nuxt-based Simpler Work-log

This project is a Nuxt 3 + Tailwind 4 + daisyUI single-page app that helps engineers submit Jira work-logs faster.

Key features

• Calendar month grid with colour feedback per-day
• Quick-Add presets & "My Active Issues" picker
• Smart merge/offset algorithm (09:00 base) and business-rule validation
• 100 % client-side – credentials stored in browser `localStorage`
• Serverless Jira proxy (Nitro → Cloudflare Function)
• CI/CD to Cloudflare Pages via GitHub Actions

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Install dependencies once:

```bash
corepack enable   # enables pnpm via Corepack (Node ≥ 16)
pnpm install
```

### Local dev

```bash
pnpm dev    # http://localhost:3000
```

### Unit-less Cloudflare proxy test

```bash
pnpm build && pnpm preview  # serves SSR build inc. local /api/jira/* proxy
```

---

## Deployment – Cloudflare Pages

The repository ships with a ready-to-use GitHub Actions workflow (`.github/workflows/cloudflare-pages.yml`).

Prerequisites (GitHub → Settings → Secrets and variables → *Actions*):

| Secret | Description |
| ------ | ----------- |
| `CF_API_TOKEN` | Pages API token with *Edit* perms |
| `CF_ACCOUNT_ID` | Your Cloudflare account ID |

On push to *main* the workflow will:

1. Install deps via pnpm
2. Build with `NITRO_PRESET=cloudflare-pages` (outputs to `.output/public`)
3. Upload artefact to your Pages project `simpler-worklog`

> Custom project name? – edit `projectName` in the workflow file.

---

## Jira credentials

On first visit the app prompts for **e-mail** + **API token** then stores them in `localStorage`. Tokens are **never** sent to Cloudflare; all requests are proxied server-side.

---

## Repo scripts

| Script | Purpose |
| ------ | ------- |
| `pnpm dev` | Dev server + HMR |
| `pnpm build` | Production build (`.output/`) |
| `pnpm preview` | Preview built artefact |

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```