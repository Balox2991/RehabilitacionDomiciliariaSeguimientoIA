# Levanta TODO el sistema para la demostración con un solo comando:
#   .\iniciar-demo.ps1            instala lo que falte, crea los datos de demostración si no existen y arranca todo
#   .\iniciar-demo.ps1 -SinPose   sin el servicio de pose (RTMPose); el análisis de video usa solo el navegador
#   .\iniciar-demo.ps1 -Reiniciar borra y recrea los datos de demostración (contraseña nueva)
# Para detener todo: Ctrl+C en esta ventana.
param([switch]$SinPose, [switch]$Reiniciar, [switch]$NoAbrirNavegador)
$ErrorActionPreference = "Stop"
# Los programas externos (npm, pip) escriben avisos en stderr: no deben detener el script; se revisa $LASTEXITCODE.
function Run($what, [scriptblock]$cmd) { $old = $ErrorActionPreference; $ErrorActionPreference = "Continue"; & $cmd 2>&1 | Out-Null; $code = $LASTEXITCODE; $ErrorActionPreference = $old; if ($code -ne 0) { throw "Falló: $what (código $code)." } }
$root = $PSScriptRoot
$backend = Join-Path $root "apps\backend"
$web = Join-Path $root "apps\web"
$pose = Join-Path $root "apps\pose-service"
$procs = @()

function Need($cmd, $hint) { if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "Falta '$cmd'. $hint" } }
function Say($m) { Write-Host "» $m" -ForegroundColor Cyan }
function WaitUrl($url, $name, $seconds = 60) {
  $end = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $end) {
    try { Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 | Out-Null; return } catch { Start-Sleep -Milliseconds 500 }
  }
  throw "$name no respondió en $seconds s ($url). Revisa los registros en la carpeta logs\."
}

Need node "Instala Node.js 22.5 o superior."
$nodeMajor = [int](node -p "process.versions.node.split('.')[0]")
if ($nodeMajor -lt 22) { throw "Se necesita Node 22.5 o superior (tienes $(node -v))." }

New-Item -ItemType Directory -Force (Join-Path $root "logs") | Out-Null

foreach ($app in @($backend, $web)) {
  if (-not (Test-Path (Join-Path $app "node_modules"))) { Say "npm install en $(Split-Path $app -Leaf)…"; Push-Location $app; Run "npm install en $app" { npm install --no-audit --no-fund }; Pop-Location }
}

if (-not $SinPose) {
  $venvPy = Join-Path $pose ".venv\Scripts\python.exe"
  if (-not (Test-Path $venvPy)) {
    Need python "Instala Python 3.10 o superior (o usa -SinPose)."
    Say "Creando el entorno de Python del servicio de pose (la primera vez tarda unos minutos)…"
    Run "crear el entorno de Python" { python -m venv (Join-Path $pose ".venv") }
    Run "instalar las dependencias de Python" { & $venvPy -m pip install --quiet -r (Join-Path $pose "requirements.txt") }
  }
}

$db = Join-Path $backend "data\telerehab.db"
if ($Reiniciar -or -not (Test-Path $db)) {
  Say "Creando los datos de demostración (ficticios)…"
  Push-Location $backend; Run "sembrar los datos de demostración" { npm run seed -- --reset }; Pop-Location
}

try {
  if (-not $SinPose) {
    Say "Servicio de pose (puerto 8000)…"
    $procs += Start-Process -FilePath $venvPy -ArgumentList "-m uvicorn app.main:app --port 8000" -WorkingDirectory $pose -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $root "logs\pose.log") -RedirectStandardError (Join-Path $root "logs\pose.err.log")
    $env:POSE_SERVICE_URL = "http://127.0.0.1:8000"
  } else { Remove-Item Env:POSE_SERVICE_URL -ErrorAction SilentlyContinue }

  Say "API (puerto 3001)…"
  $procs += Start-Process -FilePath "node" -ArgumentList "src/server.js" -WorkingDirectory $backend -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $root "logs\backend.log") -RedirectStandardError (Join-Path $root "logs\backend.err.log")

  Say "Web (puerto 5173)…"
  $viteCmd = Join-Path $web "node_modules\.bin\vite.cmd"
  $procs += Start-Process -FilePath $viteCmd -ArgumentList "--port 5173 --strictPort" -WorkingDirectory $web -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $root "logs\web.log") -RedirectStandardError (Join-Path $root "logs\web.err.log")

  WaitUrl "http://localhost:3001/health" "La API"
  if (-not $SinPose) { WaitUrl "http://127.0.0.1:8000/health" "El servicio de pose" }
  WaitUrl "http://localhost:5173/" "La web"

  Write-Host ""
  Write-Host "Todo listo → http://localhost:5173" -ForegroundColor Green
  $creds = Join-Path $backend "data\demo-credentials.txt"
  if (Test-Path $creds) { Write-Host ""; Get-Content $creds -Encoding UTF8 | ForEach-Object { Write-Host "  $_" } }
  if (-not $SinPose) { Write-Host "`n  Servicio de pose activo: la primera vez que se use descarga los modelos (~140 MB)." }
  Write-Host "`nCtrl+C para detener todo." -ForegroundColor Yellow
  if (-not $NoAbrirNavegador) { Start-Process "http://localhost:5173" }
  while ($true) { Start-Sleep -Seconds 2; if ($procs | Where-Object { $_.HasExited }) { throw "Un servicio se detuvo. Revisa la carpeta logs\." } }
}
finally {
  Say "Deteniendo…"
  foreach ($p in $procs) { if ($p -and -not $p.HasExited) { & taskkill /F /T /PID $p.Id 2>$null | Out-Null } }
}
