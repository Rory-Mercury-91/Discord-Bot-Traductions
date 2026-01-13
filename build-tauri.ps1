#!/usr/bin/env pwsh
# Script de build Tauri avec Python portable et dependances

Write-Host "Build Tauri - Generateur de publication" -ForegroundColor Cyan
Write-Host ""

# Verification de Python portable
if (-not (Test-Path "python-portable\python.exe")) {
    Write-Host "Erreur: Python portable non trouve dans python-portable/" -ForegroundColor Red
    Write-Host "Executez d'abord: .\build-standalone.ps1" -ForegroundColor Yellow
    exit 1
}

# Verification des dependances Python
Write-Host "Verification des dependances Python..." -ForegroundColor Yellow
$pipCheck = & .\python-portable\python.exe -c "import aiohttp, discord, dotenv; print('OK')" 2>&1
if ($pipCheck -ne "OK") {
    Write-Host "Installation des dependances Python..." -ForegroundColor Yellow
    & .\python-portable\python.exe -m pip install aiohttp discord.py python-dotenv
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Erreur lors de l'installation des dependances" -ForegroundColor Red
        exit 1
    }
}
Write-Host "Dependances Python OK" -ForegroundColor Green

# Build frontend
Write-Host ""
Write-Host "Build du frontend React..." -ForegroundColor Yellow
npm --prefix frontend run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Erreur lors du build frontend" -ForegroundColor Red
    exit 1
}
Write-Host "Frontend compile" -ForegroundColor Green

# Build Tauri
Write-Host ""
Write-Host "Build Tauri (Rust + bundle)..." -ForegroundColor Yellow
npm run tauri build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Erreur lors du build Tauri" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Build termine avec succes !" -ForegroundColor Green
Write-Host ""
Write-Host "Fichiers generes:" -ForegroundColor Cyan
Write-Host "   - Installeur NSIS: src-tauri\target\release\bundle\nsis\PublicationGenerator_1.0.0_x64-setup.exe" -ForegroundColor White
Write-Host "   - Portable MSI:    src-tauri\target\release\bundle\msi\PublicationGenerator_1.0.0_x64_en-US.msi" -ForegroundColor White
Write-Host ""

# Taille du fichier
$exePath = "src-tauri\target\release\bundle\nsis\PublicationGenerator_1.0.0_x64-setup.exe"
if (Test-Path $exePath) {
    $size = (Get-Item $exePath).Length / 1MB
    Write-Host "Taille installeur: $([math]::Round($size, 2)) MB" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Pret a distribuer !" -ForegroundColor Green
