[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-z][a-z0-9-]{4,28}[a-z0-9]$')]
  [string]$ProjectId,
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9A-F]{6}-[0-9A-F]{6}-[0-9A-F]{6}$')]
  [string]$BillingAccount,
  [string]$Region = 'us-central1',
  [string]$GitHubRepository = 'lelianto/resaikel',
  [switch]$UseExistingProject
)

$ErrorActionPreference = 'Stop'

function Invoke-Gcloud {
  & gcloud @args
  if ($LASTEXITCODE -ne 0) { throw "gcloud failed: gcloud $($args -join ' ')" }
}

$deployServiceAccount = "resaikel-deployer@$ProjectId.iam.gserviceaccount.com"
$runtimeServiceAccount = "resaikel-runtime@$ProjectId.iam.gserviceaccount.com"
$pool = 'github-actions'
$provider = 'github'

if ($UseExistingProject) {
  Write-Host "Using existing Google Cloud project $ProjectId"
  Invoke-Gcloud projects update $ProjectId --name='Resaikel Production'
} else {
  Write-Host "Creating Google Cloud project $ProjectId"
  Invoke-Gcloud projects create $ProjectId --name='Resaikel Production'
}
Invoke-Gcloud billing projects link $ProjectId --billing-account=$BillingAccount
Invoke-Gcloud config set project $ProjectId

Invoke-Gcloud services enable artifactregistry.googleapis.com run.googleapis.com iamcredentials.googleapis.com sts.googleapis.com secretmanager.googleapis.com firebase.googleapis.com identitytoolkit.googleapis.com firestore.googleapis.com storage.googleapis.com firebasestorage.googleapis.com generativelanguage.googleapis.com --project=$ProjectId

Invoke-Gcloud artifacts repositories create resaikel --repository-format=docker --location=$Region --description='Resaikel production images' --project=$ProjectId
Invoke-Gcloud iam service-accounts create resaikel-deployer --display-name='Resaikel GitHub deployer' --project=$ProjectId
Invoke-Gcloud iam service-accounts create resaikel-runtime --display-name='Resaikel Cloud Run runtime' --project=$ProjectId

foreach ($role in @('roles/artifactregistry.writer', 'roles/run.admin')) {
  Invoke-Gcloud projects add-iam-policy-binding $ProjectId --member="serviceAccount:$deployServiceAccount" --role=$role --condition=None
}
Invoke-Gcloud iam service-accounts add-iam-policy-binding $runtimeServiceAccount --member="serviceAccount:$deployServiceAccount" --role='roles/iam.serviceAccountUser' --project=$ProjectId

foreach ($role in @('roles/datastore.user', 'roles/firebaseauth.admin', 'roles/storage.objectAdmin', 'roles/secretmanager.secretAccessor')) {
  Invoke-Gcloud projects add-iam-policy-binding $ProjectId --member="serviceAccount:$runtimeServiceAccount" --role=$role --condition=None
}

Invoke-Gcloud iam workload-identity-pools create $pool --location=global --display-name='GitHub Actions' --project=$ProjectId
Invoke-Gcloud iam workload-identity-pools providers create-oidc $provider --location=global --workload-identity-pool=$pool --display-name='GitHub lelianto/resaikel' --issuer-uri='https://token.actions.githubusercontent.com' --attribute-mapping='google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref' --attribute-condition="assertion.repository == '$GitHubRepository' && assertion.ref == 'refs/heads/main'" --project=$ProjectId

$projectNumber = (& gcloud projects describe $ProjectId --format='value(projectNumber)').Trim()
if ($LASTEXITCODE -ne 0 -or -not $projectNumber) { throw 'Could not resolve project number.' }
$principal = "principalSet://iam.googleapis.com/projects/$projectNumber/locations/global/workloadIdentityPools/$pool/attribute.repository/$GitHubRepository"
Invoke-Gcloud iam service-accounts add-iam-policy-binding $deployServiceAccount --member=$principal --role='roles/iam.workloadIdentityUser' --project=$ProjectId

Invoke-Gcloud secrets create GEMINI_API_KEY --replication-policy=automatic --project=$ProjectId

$providerName = "projects/$projectNumber/locations/global/workloadIdentityPools/$pool/providers/$provider"
Write-Host "GCP_PROJECT_ID=$ProjectId"
Write-Host "GCP_REGION=$Region"
Write-Host "GCP_WORKLOAD_IDENTITY_PROVIDER=$providerName"
Write-Host "GCP_DEPLOY_SERVICE_ACCOUNT=$deployServiceAccount"
Write-Host "GCP_RUNTIME_SERVICE_ACCOUNT=$runtimeServiceAccount"
Write-Host 'Next: configure Firebase, add a Gemini secret version, and set the GitHub variables documented in docs/DEPLOYMENT.md.'
