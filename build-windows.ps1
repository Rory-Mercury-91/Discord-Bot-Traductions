# Script de build pour generer l'executable Windows
# Nettoie les caches et build l'application Electron

Write-Host "Nettoyage des caches et dossiers de build..." -ForegroundColor Cyan

# Nettoyer le dossier dist du frontend
if (Test-Path ".\dist") {
    Remove-Item ".\dist" -Recurse -Force
    Write-Host "  dist/ supprime" -ForegroundColor Green
}

# Nettoyer le dossier release (build Electron)
if (Test-Path ".\release") {
    Remove-Item ".\release" -Recurse -Force
    Write-Host "  release/ supprime" -ForegroundColor Green
}

# Nettoyer les caches Electron
$electronCache = "$env:LOCALAPPDATA\electron\Cache"
if (Test-Path $electronCache) {
    Remove-Item $electronCache -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  Cache Electron supprime" -ForegroundColor Green
}

# Nettoyer electron-builder cache
$builderCache = "$env:LOCALAPPDATA\electron-builder\Cache"
if (Test-Path $builderCache) {
    Remove-Item $builderCache -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  Cache electron-builder supprime" -ForegroundColor Green
}

# Nettoyer le cache node_modules
if (Test-Path ".\node_modules\.cache") {
    Remove-Item ".\node_modules\.cache" -Recurse -Force
    Write-Host "  node_modules/.cache supprime" -ForegroundColor Green
}

# Nettoyer le cache frontend
if (Test-Path ".\frontend\node_modules\.cache") {
    Remove-Item ".\frontend\node_modules\.cache" -Recurse -Force
    Write-Host "  frontend/node_modules/.cache supprime" -ForegroundColor Green
}

Write-Host ""
Write-Host "Build du frontend React..." -ForegroundColor Cyan
npm --prefix frontend run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Erreur lors du build du frontend" -ForegroundColor Red
    exit 1
}
Write-Host "  Frontend builde avec succes" -ForegroundColor Green

Write-Host ""
Write-Host "Packaging de l'application Electron..." -ForegroundColor Cyan
npm run pack
if ($LASTEXITCODE -ne 0) {
    Write-Host "Erreur lors du packaging" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Build termine avec succes !" -ForegroundColor Green
Write-Host "L'executable se trouve dans le dossier: .\release" -ForegroundColor Yellow
Write-Host ""

# Afficher les fichiers generes
if (Test-Path ".\release") {
    Write-Host "Fichiers generes:" -ForegroundColor Cyan
    Get-ChildItem ".\release" -Filter "*.exe" | ForEach-Object {
        Write-Host "  $($_.Name) ($([math]::Round($_.Length / 1MB, 2)) MB)" -ForegroundColor White
    }
}
