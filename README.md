# resaikel

**Turn waste into worth.** An AI-powered circular manufacturing and commerce
intelligence platform: photograph leftover material, get it identified, and find
out what can actually be built from it — what it costs, what it might sell for,
and who might buy it.

---

## What this is

resaikel connects five kinds of intelligence, in this order, and each layer may
only use what the layer before it established:

| Layer | Question | How it is answered |
|---|---|---|
| Material | What is this? | Vision model describes what it can see; a person confirms the physical facts |
| Product | What could be made? | The model selects from a curated catalogue of validated specifications |
| Manufacturing | Can it actually be made? | Deterministic gates plus 2D guillotine nesting with real kerf |
| Market | What is it worth? | Labelled price evidence, aggregated with its quality and freshness stated |
| Buyer | Who wants it? | Categories of buyer, plus registered demand whose owner consented |

The design rule throughout: **report what can be substantiated, and label what
cannot.** A photograph cannot establish a dimension, so resaikel asks for one
instead of guessing. No evidence means "Insufficient Market Data" instead of an
invented price. No registered buyer means a category of buyer, never a named
brand.

## Quick start

Requires **Node 20.11+**. The Firebase Emulator Suite additionally requires a
**Java runtime** (the Firestore emulator is a JVM application).

```bash
npm install
cp .env.example .env.local     # defaults are tuned for the emulators; no secrets needed
npm run emulators              # terminal 1 — Auth :9099, Firestore :8080, Storage :9199
npm run seed                   # terminal 2 — sample data, real photographs, a demo account
npm run dev                    # terminal 3 — http://localhost:3000
```

The seed creates a working demo account:

```
demo@resaikel.test  /  resaikel-demo
```

Sign in with it and you will find three materials already confirmed, real
photographs attached, and a completed discovery run for each.

**No Gemini key is required to run this.** With `AI_MODE=auto` and no
`GEMINI_API_KEY`, the deterministic mock adapter is used: everything works,
nothing is billed, and the UI says so on every result. Add a key to
`.env.local` and material analysis switches to the live model.

## Verification

```bash
npm run check      # tsc --noEmit + eslint + vitest
npm test           # 187 tests, no network, no API cost
npm run build      # production build
```

The suite covers the deterministic engines (integer money, unit conversion,
guillotine nesting, every feasibility gate, cost build-up, market aggregation,
buyer matching, ranking), the AI contract (schema rejection, prompt-injection
handling, cache keys, the catalogue-boundary check), and the sample scenarios the
landing page renders.

`tests/ai/real-photos.test.ts` runs **real photographs** — downloaded from
Wikimedia Commons, not synthesised — through the same byte-level upload
validation the routes use. See `tests/fixtures/photos/README.md`.

## What is in this release

- Authentication: Google and email/password, email verification, password reset,
  httpOnly session cookies
- Onboarding: role selection, organisation, country and currency (defaults to
  Indonesia and IDR)
- Materials: multi-photo upload with client-side compression, server-side
  byte-level validation, private storage, inventory, provenance tracking
- Material intelligence: camera analysis with per-field confidence, explicit
  unknown handling, and a human confirmation gate
- Product discovery: curated catalogue, parameterised inside declared bounds,
  with anything unsubstantiated rejected before evaluation
- Feasibility: ordered hard gates and a deterministic 2D nesting engine
- Cost intelligence: eleven explainable lines, integer minor units, editable
  assumptions, revenue scenarios, break-even
- Market intelligence: labelled evidence, quality and freshness scoring, an
  explicit insufficient-data state
- Buyer intelligence: matched factors shown, shortfalls flagged, consent
  respected
- Ranking: hard gates first, configurable weights, unknown dimensions left
  unknown
- Landing page and workflow preview driven by the real engines

## What is deliberately not in this release

| Deferred | Why |
|---|---|
| Request for quotation, quotations, project messaging | Commerce is a large surface; half of it would be worse than none |
| Payment processing | Out of scope, and no transaction is implied anywhere in the UI |
| Production outcome tracking | Schema and rules are in place; the UI is not |
| Sustainability metrics | No documented methodology for a carbon figure exists yet, so none is shown |
| Full buyer and manufacturer marketplace, reverse discovery | Deferred with the commerce layer |
| Playwright end-to-end suite | The Vitest suite covers the engines and contracts; browser E2E is the next step |

## Known limitations

These are stated in the product itself, not only here:

- Feasibility is a **flat, rectangular, 2D** model. No 3D, no structural
  analysis, no machine nesting file.
- Cutting yield assumes a **guillotine** layout and errs toward over-counting
  waste.
- Defect positions are not recorded as coordinates, so defects reduce expected
  yield rather than being excluded from the layout.
- Market evidence is a **curated sample set**. Nothing is scraped from a
  marketplace.
- Buyer matching is **category-level**. Only registered, consented demand counts
  as verified.
- The AI reads photographs. It cannot verify weight, grade, composition or
  certification, and it is instructed never to try.

## Repository map

```
src/
  domain/       pure TypeScript — money, units, catalogue, feasibility, cost,
                market, buyers, ranking, demo scenarios. No Firebase, no React.
  ai/           Gemini client, Zod contracts, prompts, mock adapter, cache
  server/       Firebase Admin, auth, HTTP envelope, repos, services
  app/          route groups: (marketing), (auth), (app), plus /api routes
  components/   ui primitives, layout, and feature components
docs/           architecture, data model, AI pipeline, feasibility engine,
                security, deployment
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Data model](docs/DATA_MODEL.md)
- [AI pipeline](docs/AI_PIPELINE.md)
- [Feasibility engine](docs/FEASIBILITY_ENGINE.md)
- [Security](docs/SECURITY.md)
- [Deployment](docs/DEPLOYMENT.md)

## Stack

Next.js 15 (App Router) · React 19 · TypeScript in strict mode ·
Tailwind CSS v4 · Firebase Auth, Firestore and Cloud Storage ·
Google Gemini via `@google/genai` · Zod · Vitest

No other backend. No state-management library. No component framework. Domain
logic is plain TypeScript so it can be tested without a database, a browser or a
model.
