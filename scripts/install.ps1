#Requires -Version 5
<#
  Louis — lanceur de l'installeur interactif (Windows / PowerShell)

    irm https://raw.githubusercontent.com/Association-DataRing/Louis/main/scripts/install.ps1 | iex

  Ce fichier n'est plus qu'un raccourci : il vérifie Node >= 18 puis lance
  l'installeur TUI publié via npx. Toute la logique (Docker, configuration,
  compte administrateur, cle IA, demarrage) vit dans l'installeur :

    packages/create-louis  ->  npx -y github:Association-DataRing/Louis#installer
#>
$ErrorActionPreference = "Stop"

$Installer = if ($env:LOUIS_INSTALLER) { $env:LOUIS_INSTALLER } else { "github:Association-DataRing/Louis#installer" }

function Test-NodeOk {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { return $false }
  try {
    $major = (& node -e "process.stdout.write(String(parseInt(process.versions.node)))")
    return ([int]$major -ge 18)
  } catch { return $false }
}

if (-not (Test-NodeOk)) {
  Write-Host "Louis a besoin de Node.js >= 18 pour son installeur." -ForegroundColor Red
  Write-Host ""
  Write-Host "Installez Node (LTS) puis relancez cette commande :" -ForegroundColor Red
  Write-Host "  - winget install OpenJS.NodeJS.LTS" -ForegroundColor Red
  Write-Host "  - ou https://nodejs.org/" -ForegroundColor Red
  exit 1
}

# La console PowerShell (y compris sous `irm | iex`) est un vrai TTY :
# l'installeur interactif lit stdin sans plomberie supplementaire.
& npx -y $Installer @args
exit $LASTEXITCODE
