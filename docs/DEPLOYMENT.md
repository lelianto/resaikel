# Cloud Run deployment

Production runs as a container on Cloud Run. Every push to `main` runs the full
quality suite before GitHub Actions can deploy a new revision.

## Architecture

- GitHub Actions authenticates through Workload Identity Federation
- Artifact Registry stores images tagged with the Git commit SHA
- Cloud Run uses a dedicated runtime service account
- Firebase Authentication handles Google and email sign-in
- Firestore and Cloud Storage hold application data and private photos
- Secret Manager injects `GEMINI_API_KEY` at runtime
- Firebase Admin uses Application Default Credentials from Cloud Run

No service-account JSON or private key belongs in GitHub or the image.

## Google Cloud bootstrap

Run the parameterized script with a globally unique project ID:

```powershell
./scripts/bootstrap-gcp.ps1 `
  -ProjectId YOUR_UNIQUE_PROJECT_ID `
  -BillingAccount YOUR_BILLING_ACCOUNT_ID `
  -Region us-central1 `
  -GitHubRepository lelianto/resaikel
```

It creates the project, links billing, enables APIs, creates Artifact Registry,
deploy and runtime identities, least-purpose IAM roles, GitHub OIDC trust, and the
Gemini secret container. It prints the GitHub variables needed by the workflow.

To reuse a verified empty project, add `-UseExistingProject`. The script renames
its display name to `Resaikel Production`; Google Cloud project IDs are immutable.

Add the Gemini key as a Secret Manager version without committing it:

```powershell
$geminiKey = Read-Host -AsSecureString 'Gemini API key'
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($geminiKey)
try {
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  $plain | gcloud secrets versions add GEMINI_API_KEY --data-file=- --project YOUR_PROJECT_ID
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  Remove-Variable plain -ErrorAction SilentlyContinue
}
```

## Firebase and Google sign-in

Add Firebase and create a web app:

```powershell
npx firebase-tools login
npx firebase-tools projects:addfirebase YOUR_PROJECT_ID
npx firebase-tools apps:create WEB resaikel --project YOUR_PROJECT_ID
npx firebase-tools apps:list --project YOUR_PROJECT_ID
npx firebase-tools apps:sdkconfig WEB FIREBASE_APP_ID --project YOUR_PROJECT_ID
```

Then:

1. Create Firestore in Native mode in the chosen region
2. Create the default Cloud Storage bucket
3. Enable Google and Email/Password in Firebase Authentication
4. Choose the support email shown during Google sign-in
5. Add the deployed Cloud Run hostname to Authentication Authorized domains
6. Deploy Firestore indexes, Firestore rules, and Storage rules

Provider activation and the support email are explicit product choices. Verify
them before accepting real users.

## GitHub configuration

The production project, WIF provider, service-account identifiers, and Firebase
web configuration are committed in the workflow. These are public identifiers,
not credentials. No GitHub secret is required while `AI_MODE=mock`.

When real Gemini calls are intentionally enabled, add a secret version to
`GEMINI_API_KEY`, change the workflow to `AI_MODE=live`, and bind the secret to
Cloud Run. Keeping mock mode initially prevents accidental AI usage charges.

The workflow is `.github/workflows/deploy-cloud-run.yml`. A GitHub `production`
environment can optionally require manual approval.

Security rules and indexes are intentionally not deployed by the application
deployer. Deploy them separately through an owner-authorized `gcloud` session:

```powershell
./scripts/deploy-firebase-config.ps1
```

## Pipeline

The pipeline:

1. installs locked dependencies
2. runs type-checking, linting, and tests
3. obtains a short-lived GitHub OIDC credential
4. builds a non-root standalone Next.js container
5. pushes SHA and `latest` tags to Artifact Registry
6. deploys the SHA tag to Cloud Run

The Cloud Run baseline mirrors Workalaw: `us-central1`, 2 vCPU, 2 GiB memory,
concurrency 80, min instances 0, max instances 3, CPU throttling, and startup CPU
boost. Scale-to-zero is the main idle-cost control.

Cloud Run accepts public HTTP traffic because the landing and sign-in pages are
public. Application routes remain protected by Firebase session cookies.

## Rollback

```powershell
gcloud run revisions list --service resaikel --region YOUR_REGION --project YOUR_PROJECT_ID
gcloud run services update-traffic resaikel --to-revisions REVISION_NAME=100 --region YOUR_REGION --project YOUR_PROJECT_ID
```

Application rollback does not roll back Firestore indexes or security rules.
