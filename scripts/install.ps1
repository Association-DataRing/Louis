#Requires -Version 5
<#
  Louis — installeur une commande (Windows / PowerShell)

    irm https://raw.githubusercontent.com/Association-DataRing/Louis/main/scripts/install.ps1 | iex

  Ce script :
    1. installe Docker Desktop s'il manque (téléchargement officiel, WSL2),
       le démarre s'il est arrêté ;
    2. crée un dossier .\louis avec le docker-compose de production ;
    3. génère les secrets (.env) — jamais écrasés s'ils existent déjà ;
    4. télécharge les images et démarre la stack ;
    5. attend que l'app réponde puis ouvre l'assistant de premier lancement.

  Variables d'environnement optionnelles (mêmes que la version bash) :
    LOUIS_DIR, LOUIS_PORT, LOUIS_VERSION, LOUIS_REPO_RAW

  Relancer le script est sans danger : il est idempotent et vaut mise à jour.
#>
$ErrorActionPreference = "Stop"

$LouisDir    = if ($env:LOUIS_DIR)      { $env:LOUIS_DIR }      else { "louis" }
$LouisPort   = if ($env:LOUIS_PORT)     { $env:LOUIS_PORT }     else { "3000" }
$RepoRaw     = if ($env:LOUIS_REPO_RAW) { $env:LOUIS_REPO_RAW } else { "https://raw.githubusercontent.com/Association-DataRing/Louis/main" }
$ComposeFile = "docker-compose.prod.yml"

function Bold($m) { Write-Host $m -ForegroundColor White }
function Info($m) { Write-Host "  $m" }
function Ok($m)   { Write-Host "  [OK] $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  [!] $m" -ForegroundColor Yellow }
function Die($m)  { Write-Host "  [X] $m" -ForegroundColor Red; exit 1 }

# Secret cryptographique base64 (32 octets).
function New-Secret {
  $bytes = New-Object 'System.Byte[]' 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return [Convert]::ToBase64String($bytes)
}
# Variante alphanumérique (sûre dans une URL de connexion Postgres / clé S3).
function New-AlnumSecret {
  return ((New-Secret) -replace '[/+=]', '').Substring(0, 32)
}

function Test-Docker {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { return $false }
  & docker info *> $null
  return ($LASTEXITCODE -eq 0)
}

function Start-DockerDesktop {
  foreach ($p in @(
    (Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Docker\Docker\Docker Desktop.exe")
  )) {
    if ($p -and (Test-Path $p)) { Start-Process $p | Out-Null; return }
  }
}

function Wait-Docker {
  Info "Attente du démarrage de Docker (jusqu'à 3 min)..."
  for ($i = 0; $i -lt 90; $i++) {
    if (Test-Docker) { return $true }
    Start-Sleep -Seconds 2
  }
  return $false
}

function Install-DockerWindows {
  Bold "Docker n'est pas installé — installation de Docker Desktop (~600 Mo)..."
  $installer = Join-Path $env:TEMP "DockerDesktopInstaller.exe"
  $url = "https://desktop.docker.com/win/main/amd64/Docker Desktop Installer.exe"
  try {
    Invoke-WebRequest -Uri $url -OutFile $installer -UseBasicParsing
  } catch {
    Die "Téléchargement de Docker échoué. Installez-le manuellement : https://docs.docker.com/desktop/install/windows-install/"
  }
  Info "Installation silencieuse (peut demander des droits administrateur)..."
  $proc = Start-Process -FilePath $installer -ArgumentList @("install", "--quiet", "--accept-license") -Wait -PassThru -Verb RunAs
  if ($proc.ExitCode -ne 0) {
    Die ("Installation de Docker Desktop échouée (code {0}). Installez-le manuellement : https://docs.docker.com/desktop/install/windows-install/" -f $proc.ExitCode)
  }
  Ok "Docker Desktop installé"
}

function Ensure-Docker {
  if (Test-Docker) { Ok "Docker opérationnel"; return }

  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Install-DockerWindows
  }
  Start-DockerDesktop
  Info "Si une fenêtre Docker s'ouvre, cliquez « Accept » pour finaliser."
  if (-not (Wait-Docker)) {
    Die @"
Docker ne répond pas encore. Sur une machine fraîche, WSL2 nécessite souvent
un redémarrage de Windows pour se finaliser.
  -> Redémarrez Windows, puis relancez cette commande.
(Ou lancez « Docker Desktop » manuellement, attendez l'icône fixe, et relancez.)
"@
  }
  & docker compose version *> $null
  if ($LASTEXITCODE -ne 0) { Die "Docker Compose v2 absent. Mettez Docker Desktop à jour (il l'inclut)." }
  Ok "Docker opérationnel"
}

# ─────────────────────────────────────────────────────────────────────────────
Bold "Louis — installation (Windows)"

# 1. Docker (installé/démarré automatiquement)
Ensure-Docker

# 2. Dossier + compose (toujours rafraîchi : ré-exécuter = mise à jour)
New-Item -ItemType Directory -Force -Path $LouisDir | Out-Null
Set-Location $LouisDir
try {
  Invoke-WebRequest -Uri "$RepoRaw/$ComposeFile" -OutFile $ComposeFile -UseBasicParsing
} catch {
  Die "Téléchargement de $ComposeFile impossible depuis $RepoRaw"
}
Ok "$ComposeFile à jour"

# Script de mise à jour pratique déposé dans le dossier.
@'
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
Write-Host "Mise a jour de Louis..."
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
Write-Host "Louis est a jour."
'@ | Set-Content -Path "update.ps1" -Encoding ascii

# 3. Secrets (.env) — jamais écrasés (ENCRYPTION_KEY est irremplaçable)
if (-not (Test-Path ".env")) {
  $lines = @(
    "# Secrets Louis - NE PAS PARTAGER. ENCRYPTION_KEY est irremplacable.",
    ("POSTGRES_PASSWORD={0}"     -f (New-AlnumSecret)),
    ("S3_SECRET_ACCESS_KEY={0}"  -f (New-AlnumSecret)),
    ("AUTH_SECRET={0}"           -f (New-Secret)),
    ("ENCRYPTION_KEY={0}"        -f (New-Secret)),
    ("LOUIS_PORT={0}"            -f $LouisPort)
  )
  if ($env:LOUIS_VERSION) { $lines += ("LOUIS_VERSION={0}" -f $env:LOUIS_VERSION) }
  # UTF-8 sans BOM pour ne pas polluer la 1re variable lue par docker compose.
  [System.IO.File]::WriteAllText(
    (Join-Path (Get-Location) ".env"),
    (($lines -join "`n") + "`n"),
    (New-Object System.Text.UTF8Encoding($false))
  )
  Ok "Secrets générés dans $LouisDir\.env (à sauvegarder précieusement)"
} else {
  Ok ".env déjà présent (conservé)"
}

# 4. Démarrage
Bold "Téléchargement des images (premier lancement : quelques minutes)..."
& docker compose -f $ComposeFile pull
& docker compose -f $ComposeFile up -d
Ok "Stack démarrée"

# 5. Attente de l'app
Info "Démarrage de Louis..."
$healthy = $false
for ($i = 0; $i -lt 90; $i++) {
  try {
    $r = Invoke-WebRequest -Uri ("http://localhost:{0}/api/health" -f $LouisPort) -UseBasicParsing -TimeoutSec 3
    if ($r.StatusCode -eq 200) { $healthy = $true; break }
  } catch {}
  Start-Sleep -Seconds 2
}

if (-not $healthy) {
  Die ("Louis ne répond pas après ~3 min. Diagnostic : cd {0}; docker compose -f {1} logs app migrate" -f $LouisDir, $ComposeFile)
}

Write-Host ""
Bold "Installation terminée."
Write-Host ("  Ouvrez http://localhost:{0} — l'assistant de premier lancement vous guide." -f $LouisPort)
Write-Host ("  (compte administrateur, clé IA, et c'est prêt)")
Write-Host ""
Write-Host ("  Mettre à jour : relancez cette commande, ou exécutez {0}\update.ps1" -f $LouisDir)
Write-Host ("  Arrêt :         cd {0}; docker compose -f {1} down" -f $LouisDir, $ComposeFile)
Start-Process ("http://localhost:{0}" -f $LouisPort) | Out-Null
