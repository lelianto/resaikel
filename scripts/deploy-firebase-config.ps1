[CmdletBinding()]
param(
  [string]$ProjectId = 'project-335e22ef-e3a3-4044-813',
  [string]$DatabaseId = '(default)',
  [string]$StorageBucket = 'project-335e22ef-e3a3-4044-813.firebasestorage.app'
)

$ErrorActionPreference = 'Stop'
$token = (& gcloud auth print-access-token).Trim()
if ($LASTEXITCODE -ne 0 -or -not $token) { throw 'Could not obtain a gcloud access token.' }
$headers = @{
  Authorization = "Bearer $token"
  'Content-Type' = 'application/json'
  'x-goog-user-project' = $ProjectId
}

function Publish-Rules {
  param([string]$Path, [string]$ReleaseName)

  $source = @{
    source = @{
      files = @(@{
        name = [IO.Path]::GetFileName($Path)
        content = Get-Content -LiteralPath $Path -Raw
      })
    }
  } | ConvertTo-Json -Depth 8 -Compress

  $testUri = "https://firebaserules.googleapis.com/v1/projects/$ProjectId`:test"
  $test = Invoke-RestMethod -Method Post -Uri $testUri -Headers $headers -Body $source
  $errors = @($test.issues | Where-Object severity -eq 'ERROR')
  if ($errors.Count -gt 0) { throw "Rules validation failed for $Path`: $($errors.description -join '; ')" }

  $ruleset = Invoke-RestMethod -Method Post -Uri "https://firebaserules.googleapis.com/v1/projects/$ProjectId/rulesets" -Headers $headers -Body $source
  $releasePath = [Uri]::EscapeDataString($ReleaseName).Replace('%2F', '/')
  $releaseUri = "https://firebaserules.googleapis.com/v1/projects/$ProjectId/releases/$releasePath"
  $releaseBody = @{ release = @{ name = "projects/$ProjectId/releases/$ReleaseName"; rulesetName = $ruleset.name } } | ConvertTo-Json -Depth 5 -Compress
  try {
    Invoke-RestMethod -Method Patch -Uri $releaseUri -Headers $headers -Body $releaseBody | Out-Null
  } catch {
    $createBody = @{ name = "projects/$ProjectId/releases/$ReleaseName"; rulesetName = $ruleset.name } | ConvertTo-Json -Depth 5 -Compress
    Invoke-RestMethod -Method Post -Uri "https://firebaserules.googleapis.com/v1/projects/$ProjectId/releases" -Headers $headers -Body $createBody | Out-Null
  }
  Write-Host "Published $Path to $ReleaseName"
}

Publish-Rules -Path 'firestore.rules' -ReleaseName 'cloud.firestore'
Publish-Rules -Path 'storage.rules' -ReleaseName "firebase.storage/$StorageBucket"

$indexConfig = Get-Content -LiteralPath 'firestore.indexes.json' -Raw | ConvertFrom-Json
foreach ($index in $indexConfig.indexes) {
  $collection = [Uri]::EscapeDataString($index.collectionGroup)
  $uri = "https://firestore.googleapis.com/v1/projects/$ProjectId/databases/$([Uri]::EscapeDataString($DatabaseId))/collectionGroups/$collection/indexes"
  $body = @{ queryScope = $index.queryScope; fields = $index.fields } | ConvertTo-Json -Depth 8 -Compress
  try {
    Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -Body $body | Out-Null
    Write-Host "Created index for $($index.collectionGroup)"
  } catch {
    if ($_.ErrorDetails.Message -notmatch 'already exists|ALREADY_EXISTS') { throw }
    Write-Host "Index already exists for $($index.collectionGroup)"
  }
}
