<div align="center">

<img src="./assets/reka-bowerbird-mascot.png" alt="Reka, resaikel's bowerbird mascot, carrying packaging made from reclaimed material" width="300" />

# resaikel

### Turn waste into worth.

A circular manufacturing intelligence platform that turns leftover material into products you can actually build, cost out, and match to real market demand.

[Architecture](docs/ARCHITECTURE.md) · [AI pipeline](docs/AI_PIPELINE.md) · [Security](docs/SECURITY.md)

</div>

## About resaikel

resaikel helps users photograph leftover material, confirm its physical condition, and then evaluate the products that could be made from it.

The process runs in sequence:

1. AI describes the material attributes visible in the photo.
2. The user confirms dimensions and physical facts.
3. AI selects candidates from a bounded product catalogue.
4. A deterministic engine checks material, dimensions, tools, process, and cutting layout.
5. A cost engine computes costs using integer minor units.
6. Market and buyer engines assemble opportunities based on the available evidence.
7. A selected opportunity records actual production, cost, sales, and material without altering the original estimates.

The language model does not decide dimensions, production feasibility, cost, or ranking. Those values come from human input and the deterministic domain engine.

## Reka

**Reka** is resaikel's original bowerbird mascot. Bowerbirds are known for carefully collecting and arranging objects. The character represents how resaikel finds new uses for material that is often overlooked.

Reka carries the product's core principle: creative about what's possible, but disciplined about the facts.

The mascot file is available at [`assets/reka-bowerbird-mascot.png`](assets/reka-bowerbird-mascot.png).

## Product principles

- **Measured, never guessed.** Photos are never used to guess dimensions, weight, composition, grade, or structural strength.
- **Catalogue-bound discovery.** AI can only choose from the specifications it is given.
- **Hard gates before scores.** A product that cannot be built is never rescued by a high economic score.
- **Explainable money.** Every cost calculation uses minor currency units and an inspectable basis.
- **Unknown stays unknown.** Missing data is never replaced with an invented number.
- **Consent-aware matching.** A business name is shown only if its owner registered and consented to matching.

## Running the project

### Requirements

- Node.js 20.11 or newer
- A Java runtime for the Firestore emulator

### Installation

```bash
npm install
cp .env.example .env.local
```

Run the services in separate terminals:

```bash
# Terminal 1
npm run emulators

# Terminal 2
npm run seed

# Terminal 3
npm run dev -- --port 3000
```

Open [http://localhost:3000](http://localhost:3000).

Local demo account:

```text
Email: demo@resaikel.test
Password: resaikel-demo
```

A Gemini API key is not required for local development. If `GEMINI_API_KEY` is not available and `AI_MODE=auto`, the app uses a deterministic offline mock adapter that incurs no API cost.

## Key features

- Authentication with Google or email and password
- Secure HTTP-only session cookies and organization-level tenancy
- Multi-photo material upload with client compression and server validation
- AI-assisted material description with field-level confidence
- Human confirmation gate for physical facts
- Curated product catalogue with bounded parameters
- Deterministic feasibility engine and 2D guillotine nesting
- Explainable cost model with eleven cost lines
- Evidence-based market assessment
- Consent-aware buyer matching and capacity shortfall detection
- Hard-gated opportunity ranking
- Estimated-versus-actual production outcome tracking
- Responsive UI using Manrope and the Reka mascot

## Current implementation limits

- Feasibility uses a rectangular 2D model, not structural analysis or a 3D model.
- Cutting layout uses a conservative guillotine approach.
- Defect positions are not yet mapped as coordinates on the sheet.
- Market evidence is still curated sample data, not the result of marketplace scraping.
- Buyer matching works at the category level unless registered demand exists.
- There is no quotation, messaging, payment, or transaction workflow yet.
- There are no carbon-saving claims, because no validated methodology is available yet.

## Repository structure

```text
src/
├── app/          Next.js pages, layouts, and API routes
├── components/   UI primitives and feature components
├── domain/       Pure TypeScript domain engines
├── ai/           Prompts, schemas, client, cache, and mock adapter
├── server/       Authentication, repositories, services, and HTTP boundaries
└── lib/          Shared configuration and utilities

assets/           Brand and mascot assets
docs/             Technical and product documentation
tests/            Domain, AI contract, scenario, and real-photo tests
```

The domain layer does not depend on React, Firebase, the browser, the network, or a language model. This separation keeps the core calculations deterministically testable.

## Quality checks

```bash
npm run check
npm test
npm run test:coverage
npm run build
```

Current baseline: **195 tests passed and 1 optional real-photo case skipped**.

The test suite covers money arithmetic, unit conversion, packing, feasibility gates, costing, market aggregation, buyer matching, ranking, AI schemas, catalogue enforcement, unsafe claims, caching, sample scenarios, and real photograph validation.

## Documentation

- [Product requirements](docs/PRODUCT_REQUIREMENTS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Data model](docs/DATA_MODEL.md)
- [AI pipeline](docs/AI_PIPELINE.md)
- [Feasibility engine](docs/FEASIBILITY_ENGINE.md)
- [Security](docs/SECURITY.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Product audit](docs/PRODUCT_AUDIT.md)
- [Refinement plan](docs/REFINEMENT_PLAN.md)
- [Refinement report](docs/REFINEMENT_REPORT.md)

## Technology

Next.js 15, React 19, TypeScript strict mode, Tailwind CSS v4, Firebase Auth, Firestore, Cloud Storage, Google Gemini, Zod, and Vitest.

No component framework, state-management library, or domain calculation is hidden inside the model.

---

<div align="center">

**Build useful things from what already exists.**

<sub>resaikel · circular manufacturing intelligence</sub>

</div>
