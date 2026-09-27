<#
  Install / update GonyBarReplay on IIS (Windows Server 2012 R2 or newer, PowerShell 4+).
  Run in an elevated PowerShell next to gony-bar-replay-iis.zip:

    powershell -ExecutionPolicy Bypass -File .\install-iis.ps1
    powershell -ExecutionPolicy Bypass -File .\install-iis.ps1 -Port 8080
    powershell -ExecutionPolicy Bypass -File .\install-iis.ps1 -HostName replay.example.com

  First run: installs the IIS role, creates the site folder and an IIS site bound to -Port (default 80).
  Later runs: replace the site files with the new zip (the IIS site is kept).
#>
param(
  [string]$Zip = (Join-Path $PSScriptRoot 'gony-bar-replay-iis.zip'),
  [string]$SiteName = 'GonyBarReplay',
  [string]$SitePath = 'C:\inetpub\gony-bar-replay',
  [int]$Port = 80,
  [string]$HostName = '',
  # Stop the IIS "Default Web Site" when it would clash with this site's binding.
  [switch]$StopDefaultSite
)
$ErrorActionPreference = 'Stop'

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Run this script in an elevated (Administrator) PowerShell.'
}
if (-not (Test-Path $Zip)) { throw "Package not found: $Zip (build it with deploy/package-windows.sh)" }

# 1. IIS role with static content + static compression (idempotent).
Import-Module ServerManager
$features = 'Web-Server', 'Web-Static-Content', 'Web-Default-Doc', 'Web-Http-Errors', 'Web-Stat-Compression', 'Web-Mgmt-Console'
$missing = $features | Where-Object { -not (Get-WindowsFeature $_).Installed }
if ($missing) {
  Write-Host "Installing IIS features: $($missing -join ', ')"
  Install-WindowsFeature -Name $missing | Out-Null
}
Import-Module WebAdministration

# 2. Unpack into a fresh folder, then swap it in (PowerShell 4 has no Expand-Archive).
Add-Type -AssemblyName System.IO.Compression.FileSystem
$staging = "$SitePath.new"
if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
[System.IO.Compression.ZipFile]::ExtractToDirectory((Resolve-Path $Zip).Path, $staging)
if (-not (Test-Path (Join-Path $staging 'index.html'))) { throw 'The zip does not contain index.html' }

$site = Get-Website -Name $SiteName -ErrorAction SilentlyContinue
if ($site) { Stop-Website -Name $SiteName }
if (Test-Path $SitePath) { Remove-Item $SitePath -Recurse -Force }
Move-Item $staging $SitePath

# 3. IIS site (first run only). Static files need no .NET: use a "No Managed Code" app pool.
if (-not $site) {
  if (-not (Test-Path "IIS:\AppPools\$SiteName")) {
    New-WebAppPool -Name $SiteName | Out-Null
    Set-ItemProperty "IIS:\AppPools\$SiteName" -Name managedRuntimeVersion -Value ''
  }
  if ($StopDefaultSite -and (Get-Website -Name 'Default Web Site' -ErrorAction SilentlyContinue)) {
    Stop-Website -Name 'Default Web Site'
    Set-ItemProperty 'IIS:\Sites\Default Web Site' -Name serverAutoStart -Value $false
  }
  New-Website -Name $SiteName -PhysicalPath $SitePath -Port $Port -HostHeader $HostName -ApplicationPool $SiteName | Out-Null
  if (-not (Get-NetFirewallRule -DisplayName "GonyBarReplay HTTP $Port" -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName "GonyBarReplay HTTP $Port" -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow | Out-Null
  }
}
Start-Website -Name $SiteName

$hostPart = if ($HostName) { $HostName } else { 'localhost' }
$url = if ($Port -eq 80) { "http://$hostPart/" } else { "http://${hostPart}:$Port/" }
try {
  $r = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 10
  Write-Host "OK: $url -> HTTP $($r.StatusCode)"
} catch {
  Write-Warning "Site created but $url did not respond: $($_.Exception.Message). Another site may already use port $Port (try -StopDefaultSite or -Port 8080)."
}
