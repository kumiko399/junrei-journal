param(
  [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $OutputPath) {
  $OutputPath = Join-Path $projectRoot "THIRD_PARTY_LICENSES.txt"
} elseif (-not [IO.Path]::IsPathRooted($OutputPath)) {
  $OutputPath = Join-Path $projectRoot $OutputPath
}

$sections = [Collections.Generic.List[string]]::new()
$sections.Add("巡礼手账第三方依赖许可证")
$sections.Add("Generated from package-lock.json and src-tauri/Cargo.lock. Do not edit manually.")

function Add-PackageLicense {
  param(
    [string]$Ecosystem,
    [string]$Name,
    [string]$Version,
    [string]$License,
    [string]$PackageDirectory
  )

  $sections.Add("")
  $sections.Add(("=" * 78))
  $sections.Add("$Ecosystem package: $Name $Version")
  $sections.Add("Declared license: $(if ($License) { $License } else { "UNKNOWN" })")

  $licenseFiles = @()
  if (Test-Path -LiteralPath $PackageDirectory) {
    $licenseFiles = @(Get-ChildItem -LiteralPath $PackageDirectory -File | Where-Object {
      $_.Name -match '^(LICENSE|LICENCE|COPYING|NOTICE)(\..*)?$'
    } | Sort-Object Name)
  }

  if (-not $licenseFiles.Count) {
    $sections.Add("No top-level license text was found in the installed package.")
    return
  }

  foreach ($file in $licenseFiles) {
    $sections.Add("")
    $sections.Add("--- $($file.Name) ---")
    $licenseText = [IO.File]::ReadAllText($file.FullName)
    $licenseText = [Text.RegularExpressions.Regex]::Replace(
      $licenseText,
      '[ \t]+(?=\r?$)',
      '',
      [Text.RegularExpressions.RegexOptions]::Multiline
    )
    $sections.Add($licenseText)
  }
}

$packageLockPath = Join-Path $projectRoot "package-lock.json"
$packageLock = Get-Content -Raw -LiteralPath $packageLockPath | ConvertFrom-Json -AsHashtable
foreach ($entry in $packageLock.packages.GetEnumerator() | Sort-Object Key) {
  if (-not $entry.Key.StartsWith("node_modules/")) { continue }
  $packageDirectory = Join-Path $projectRoot $entry.Key
  $packageJsonPath = Join-Path $packageDirectory "package.json"
  if (-not (Test-Path -LiteralPath $packageJsonPath)) { continue }
  $packageJson = Get-Content -Raw -LiteralPath $packageJsonPath | ConvertFrom-Json
  Add-PackageLicense -Ecosystem "npm" -Name ([string]$packageJson.name) -Version ([string]$packageJson.version) -License ([string]$packageJson.license) -PackageDirectory $packageDirectory
}

$cargoManifest = Join-Path $projectRoot "src-tauri/Cargo.toml"
$metadataJson = & cargo metadata --manifest-path $cargoManifest --locked --format-version 1
if ($LASTEXITCODE -ne 0) { throw "cargo metadata failed with exit code $LASTEXITCODE" }
$metadata = $metadataJson | ConvertFrom-Json
foreach ($package in $metadata.packages | Where-Object { $_.name -ne "junrei-journal" } | Sort-Object name, version) {
  $packageDirectory = Split-Path -Parent ([string]$package.manifest_path)
  Add-PackageLicense -Ecosystem "Cargo" -Name ([string]$package.name) -Version ([string]$package.version) -License ([string]$package.license) -PackageDirectory $packageDirectory
}

[IO.File]::WriteAllText($OutputPath, ($sections -join [Environment]::NewLine), [Text.UTF8Encoding]::new($false))
Write-Host "Wrote $OutputPath"
