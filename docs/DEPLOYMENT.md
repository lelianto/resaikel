# Deployment

The application targets **Firebase App Hosting**, which runs a Next.js app on
Google infrastructure and reads secrets from Secret Manager. Nothing in this
document has been executed against a live project.

## 1. Google Cloud and Firebase prerequisites

```bash
gcloud services enable \
  firebaseapphosting.googleapis.com \
  firestore.googleapis.com \
  storage.googleapis.com \
  generativelanguage.googleapis.com \
  secretmanager.googleapis.com
```

1. Create a Firebase project, and a **web app** inside it, to obtain the client
   configuration
2. Create a Firestore database (Native mode) in a region close to your users
3. Create a Cloud Storage bucket for material photography
4. Enable **Google** and **Email/Password** in Firebase Authentication
5. Add your App Hosting domain to Authentication → Settings → Authorised domains
6. Create a Gemini API key in Google AI Studio for the Generative Language API

## 2. Environment

Copy `.env.example` and set the production values. The behaviour-changing ones:

```bash
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false   # critical: turns the emulators off

NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<project>.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<project>
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<project>.appspot.com
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...

FIREBASE_PROJECT_ID=<project>
FIREBASE_CLIENT_EMAIL=...        # service account, server-side only
FIREBASE_PRIVATE_KEY=...         # with literal \n escapes

GEMINI_API_KEY=...               # server-side only; never NEXT_PUBLIC_
AI_MODE=live                     # pin the mode in production
GEMINI_MATERIAL_MODEL=gemini-2.5-flash-lite
GEMINI_DISCOVERY_MODEL=gemini-2.5-flash
GEMINI_EXPLANATION_MODEL=gemini-2.5-flash

NEXT_PUBLIC_DEFAULT_CURRENCY=IDR
NEXT_PUBLIC_DEFAULT_COUNTRY=ID
NEXT_PUBLIC_DEFAULT_LOCALE=id-ID
```

Store the service-account key, the Gemini key and the session secret in **Secret
Manager**, not in the repository. `assertProductionEnv()` throws on boot if the
service account or the public Firebase config is missing, so a misconfigured
deployment fails loudly rather than denying every request.

### Choosing models

Verify availability and pricing against current Google documentation before
pinning model ids. The defaults favour cost: a Flash-Lite tier multimodal model for
photograph analysis, and a Flash tier model for the lower-volume discovery and
explanation calls.

## 3. Deploy the security rules and indexes

```bash
npx firebase-tools login
npx firebase-tools use <project>

npx firebase-tools deploy --only firestore:rules,firestore:indexes,storage
```

Deploy the rules **before** the application, so a window never exists in which the
app is live against permissive defaults.

## 4. Deploy the application

```bash
npx firebase-tools init apphosting     # once, to connect the repository
```

App Hosting builds on push to the connected branch. The required configuration:

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Runtime | Node 20 or later |
| Secrets | `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `GEMINI_API_KEY`, session secret |

`next.config.ts` sets `serverExternalPackages: ['firebase-admin']`, which App
Hosting honours.

## 5. Seed the reference data

`market_evidence` and `product_templates` must exist for pricing and discovery.
The seed script targets the emulators by default; against a real project, write the
same rows once with the Admin SDK (or extend the script with a
`--project` flag) and verify the count:

```bash
# Emulator, for reference:
npm run seed
```

The sample evidence set is flagged `isSampleData: true`. If you replace it with
real observations, keep that flag accurate — the UI discloses sample data to the
user, and setting it wrongly would make the disclosure a lie.

## 6. Post-deploy verification

1. Register a new account and complete onboarding; confirm the organisation and
   `IDR`/`ID` defaults
2. Upload a photograph; confirm compression, upload, and that the analysis runs
3. Confirm a material; confirm that discovery is refused before confirmation
4. Run discovery; confirm at least one candidate is rejected **with a reason**
5. Check that a `--` appears where a value is genuinely unknown (not `0`)
6. Open a photograph URL directly in another browser profile: it must 401, proving
   the proxy is enforcing the session
7. Swap a document id in a URL for another organisation's id: it must 404, not 403
8. Enable App Check in monitoring mode before enforcing it

## Rollback

App Hosting keeps previous revisions: roll back from the console. Rolling back the
*application* does not roll back the rules, so deploy rules deliberately and
separately.

## Cost notes

The dominant variable cost is Gemini inference. The mitigations, in order of
impact:

1. Client-side compression reduces uploaded bytes by roughly an order of magnitude
2. Analysis caching means identical photographs are never re-billed
3. Four-photograph cap per analysis
4. Explanations are generated for the top three candidates only
5. A per-user daily AI allowance
6. Firestore cost is small at this data volume: indexed point reads and small
   queries, with no collection scans

## Local development without Java

The Firestore emulator is a JVM application, so `npm run emulators` needs a Java
runtime installed. Without one:

- `npm run check` and `npm test` still work in full — the domain, AI and sample
  scenario suites need no database
- `npm run build` still works
- The seeded demo and the live UI need the emulators (or a real project)

## Deferred infrastructure

The async analysis job currently uses `after()` with a transactional claim and
stale-claim recovery. Cloud Tasks is the upgrade path when request-lifetime work is
no longer enough; `docs/ARCHITECTURE.md` describes the boundary at which that
becomes necessary. Cloud Run workers, Redis and a message broker are all
deliberately absent: none of them is justified at this scale.
