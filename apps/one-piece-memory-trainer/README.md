# One Piece Memory Trainer

Learn One Piece Card Game effects with the **Bruno/Dicsone memory-palace method**: you pick a familiar route (your kitchen: Stove → Sink → Table → Fridge → Door), turn each card effect into a short, absurd, emotional image, and place it on a stop along the route. Then you walk the route, drill random cues, and do 2-second speed flashes until you know every effect on sight.

**Stack:** Next.js 14 (App Router) · React 18 · Tailwind CSS · Supabase (auth, Postgres, storage) · Stripe (subscriptions) · Vitest

---

## Features

| | Free | Pro |
|---|---|---|
| Memory paths | 1 | Unlimited |
| Cards placed | 20 | Unlimited |
| Live card database + photo uploads | ✓ | ✓ |
| One-click "Suggest image" | ✓ | ✓ |
| Review / Drill / Speed modes | ✓ | ✓ |
| Dashboard: cards mastered, daily streak, weak loci | ✓ | ✓ |
| Spaced-repetition **Due** queue (SM-2) | – | ✓ |
| Export / import (JSON) | – | ✓ |
| Analytics: 30-day activity, due forecast, per-locus accuracy | – | ✓ |

**Training modes**

- **Add**: search the card database (name, code, effect text, color, set) or upload a photo of a card front. Hit **Suggest image** to get a Bruno-style scene built from the card's effect keywords, edit it, and place the card on a locus.
- **Review**: walk the path in order. You see the locus, then the image, then the effect, and grade yourself Again / Hard / Good / Easy. Keyboard: Space reveals, 1–4 grades.
- **Drill**: random locus cue ("what lives at the Fridge?") or random card cue ("where is this card and what does it do?"). Cards you get wrong come up more often. Pro adds the SRS **Due** queue across all paths.
- **Speed**: the card flashes for 2 seconds, then you pick its effect from 4 choices or type it. Typed answers are scored on how many of the effect's key terms they cover.

**How "Suggest image" works** (`lib/suggest.ts`): it's deterministic and runs offline. Effect keywords (`[On Play]`, `[Blocker]`, `[DON!! x1]`, draw N, K.O. cost ≤ N, ±power, bounce, rest, trash, Life…) map to vivid action fragments. Numbers use the **number-shape system** (1 = candle, 2 = swan, 3 = handcuffs, 4 = sailboat…; 2000 = "a hissing swan made of gold coins"). Each fragment is anchored at the chosen locus and ends with an emotional beat. **Suggest another** cycles through variants.

**Mastery and streaks**: a card counts as *mastered* after 3 correct recalls in a row. The *daily streak* counts consecutive days with at least one review. *Weak loci* are the stops on the active path with the lowest recall accuracy.

---

## Quick start (local mode, no accounts)

```bash
cd apps/one-piece-memory-trainer
npm install
npm run dev            # http://localhost:3000
```

If no Supabase variables are set, the app runs in **local mode**: no login, and all data lives in the browser's `localStorage`. Uploaded images are shrunk to small JPEGs so they fit there. Local mode is useful for development and demos. Billing needs the hosted setup below.

To try Pro features locally, add `NEXT_PUBLIC_LOCAL_PRO=true` to `.env.local` and restart. It only affects local mode.

```bash
npm test               # unit tests (card parsing, SRS, image suggestions, stats, limits, export/import)
npm run typecheck
npm run lint
npm run build
```

---

## Environment variables

Copy `.env.example` to `.env.local` and fill it in.

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | client + server | Public URL, used for Stripe redirect URLs. |
| `NEXT_PUBLIC_SUPABASE_URL` | client | Supabase project URL. Leave empty for local mode. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | Supabase anon key. |
| `NEXT_PUBLIC_PRO_PRICE_LABEL` | client | Price text on the pricing page, e.g. `$5/month`. |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Used by the Stripe routes to check users and set `is_pro`. Never expose it to the browser. |
| `STRIPE_SECRET_KEY` | **server only** | Stripe secret key. |
| `STRIPE_WEBHOOK_SECRET` | **server only** | Signing secret of the webhook endpoint. |
| `STRIPE_PRO_PRICE_ID` | **server only** | Price ID of the recurring Pro price (`price_…`). |
| `CARD_API_URL` | server | Card list in optcgapi.com format. Default: `https://optcgapi.com/api/allSetCards/` |
| `CARD_API_ST_URL` | server | Starter-deck card list. Default: `https://optcgapi.com/api/allSTCards/` |
| `NEXT_PUBLIC_LOCAL_PRO` | client | `true` unlocks Pro in local mode (development only). |

---

## Card data

`GET /api/cards?q=&color=&set=&type=&limit=&offset=` searches the catalogue on the server and returns `{ total, results, sets, source, fetchedAt }`.

- **Source**: the community-maintained [optcgapi.com](https://optcgapi.com) JSON API. The normalizer (`lib/cards.ts`) also accepts apitcg-style `{ data: [...] }` payloads, so you can point `CARD_API_URL` at another database.
- **Caching**: the full list is kept in memory and in a temp file, and refreshed every 24 hours. The response also sends `s-maxage=3600` so Vercel's CDN caches searches.
- **Fallback chain**: live API → stale cache → `data/cards.snapshot.json` → a few clearly-labelled fictional demo cards. The UI tells the user when it is showing demo data.
- **Snapshot**: run `npm run cards:sync` to download the full list into `data/cards.snapshot.json`. Commit that file if you want deploys to work even when the API is down. A daily GitHub Action or Vercel Cron that runs it keeps the snapshot fresh.
- **Duplicates**: alternate-art printings are merged by card code, and the base printing wins.
- **Uploads**: users can photograph or upload a card front and type its name and effect. Images are resized in the browser before upload. They are stored in Supabase Storage at `card-uploads/<user-id>/…`, or as data URLs in local mode.

---

## Deploying (Vercel + Supabase + Stripe)

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste `supabase/migrations/0001_init.sql` and run it. (Or `supabase link` then `supabase db push`.) It creates:
   - the tables `profiles`, `paths`, `loci`, `assignments`, `user_cards` and `review_logs`, with **row-level security** so each user can only access their own rows;
   - a trigger that creates a profile row for each new user;
   - **Free-tier limits enforced inside the database** (1 path, 20 cards), so they can't be bypassed from the browser;
   - the public `card-uploads` storage bucket, where each user can only write to their own folder.
3. **Authentication → Providers**: email is on by default (magic links). For Google, enable the Google provider and paste an OAuth client ID and secret from Google Cloud Console. Add `https://<project>.supabase.co/auth/v1/callback` as an authorised redirect URI there.
4. **Authentication → URL Configuration**: set **Site URL** to your production URL and add `https://<your-domain>/app` (and `http://localhost:3000/app`) to the redirect URLs.
5. From **Project Settings → API**, copy the URL, the anon key and the service-role key.

### 2. Stripe

1. **Products → Add product** "Pro" with a **recurring** price. Copy the price ID (`price_…`).
2. **Settings → Billing → Customer portal**: turn it on so Pro users can cancel or update their card.
3. **Developers → Webhooks → Add endpoint** at `https://<your-domain>/api/stripe/webhook` with these events:
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
   Copy the signing secret (`whsec_…`).
4. To test locally: `stripe listen --forward-to localhost:3000/api/stripe/webhook`, then use card `4242 4242 4242 4242`.

The webhook is the **only** thing that sets `profiles.is_pro`. Users can read their profile but can't change it (RLS). A subscription that is cancelled or unpaid turns Pro off automatically.

### 3. Vercel

1. Import the repository in Vercel and set **Root Directory** to `apps/one-piece-memory-trainer`. The framework is detected as Next.js.
2. Add every variable from the table above in **Project → Settings → Environment Variables**.
3. Deploy, then set `NEXT_PUBLIC_SITE_URL` to the final domain and redeploy.
4. Smoke test: sign up → place a card → drill → **Upgrade** → pay with a Stripe test card → you land back on `/app?upgrade=1`, and Pro unlocks within a few seconds once the webhook arrives.

---

## Project layout

```
app/
  page.tsx                  Landing page: method, modes, pricing
  app/                      The trainer (client-side, wrapped in WorkspaceProvider)
    page.tsx                Dashboard: mastery, streak, weak loci, Pro analytics
    paths/                  Path and locus editor (add / rename / reorder / delete)
    add/                    Add mode: card database search, uploads, assign panel
    review/ drill/ speed/   Training modes
    settings/               Plan, billing, export/import
  api/cards/                Cached card catalogue search
  api/stripe/               checkout, portal, webhook
components/
  workspace.tsx             State + optimistic updates + auth; enforces plan limits in the UI
  …                         UI components
lib/
  backend.ts                Backend interface: LocalBackend (localStorage) / SupabaseBackend
  cards.ts                  Card normalisation, search, demo cards
  cardSource.server.ts      Live fetch, 24h cache, fallbacks
  suggest.ts                Bruno-style image generator + number-shape system
  srs.ts                    SM-2 spaced repetition (4-button)
  stats.ts                  Mastery, streaks, weak loci, activity, forecast
  match.ts                  Scoring of typed recall answers
  plans.ts                  Free / Pro limits and feature lists
  portable.ts               Export / import with validation and id remapping
supabase/migrations/        Database schema, RLS, limit triggers, storage policies
scripts/sync-cards.mjs      Downloads the card snapshot
tests/                      Vitest unit tests
```

---

## Before you sell this: IP and legal

This is an **unofficial fan tool**. One Piece and the One Piece Card Game are owned by Eiichiro Oda / Shueisha / Toei Animation / Bandai. Before charging money:

- **Card images and text** are copyrighted. The app links to images hosted by the card database and doesn't redistribute them, and the landing page carries a non-affiliation notice. Selling a subscription built on someone else's IP still carries legal risk. Talk to a lawyer, and consider positioning Pro as paying for the *training tools* (SRS, analytics, unlimited paths) rather than for card content. A sensible extra safeguard: by default, only show official images to signed-in users.
- **Card data API**: check the terms of the card database you use. If they disallow commercial use, set `CARD_API_URL` to a source you're licensed to use, or rely on user uploads.
- **Product name**: "One Piece" in the product name may conflict with the trademark. A neutral brand ("Grand Line Memory", "Pirate TCG Trainer") lowers the risk. The UI already brands itself "MemoryTrainer · One Piece TCG".
- Add a privacy policy and terms of service. Supabase stores email addresses, and Stripe handles payment data.
