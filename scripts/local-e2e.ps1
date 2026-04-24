param(
  [int]$ApiPort = 8000,
  [int]$WebPort = 5173
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$webRoot = Join-Path $root 'web'
$apiUrl = "http://localhost:$ApiPort"
$webUrl = "http://127.0.0.1:$WebPort"

$apiProcess = $null
$webProcess = $null

function Wait-ForHttpReady {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 60
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }

  throw "Timed out waiting for $Url"
}

try {
  Write-Host "[1/5] Starting FastAPI bridge on port $ApiPort"
  $apiProcess = Start-Process -FilePath 'python' -ArgumentList '-m','minimal_sim_core.server','--port',$ApiPort -WorkingDirectory $root -PassThru

  Write-Host "[2/5] Starting Vite on port $WebPort"
  $webProcess = Start-Process -FilePath 'npm' -ArgumentList 'run','dev','--','--host','127.0.0.1','--port',$WebPort -WorkingDirectory $webRoot -PassThru

  Write-Host "[3/5] Waiting for services"
  Wait-ForHttpReady -Url "$apiUrl/api/schema"
  Wait-ForHttpReady -Url $webUrl

  Write-Host "[4/5] Running hard-gate contract verification"
  python -c "import json, sys, urllib.request; payload={'global_config':{},'unit_config':{'unit_id':'test','base_damage':0,'base_attack_cooldown':1,'crit_chance':0,'max_health':1,'initial_shield':0,'initial_heal_pool':0},'item_configs':[],'skill_configs':[]}; req=urllib.request.Request('$apiUrl/api/simulate', data=json.dumps(payload).encode('utf-8'), headers={'Content-Type':'application/json'}); data=json.loads(urllib.request.urlopen(req).read().decode('utf-8')); version=data.get('protocol_version'); print('✅ Protocol Contract Verified.' if version=='v1.0' else '❌ Contract Mismatch! Backend protocol_version != v1.0'); sys.exit(0 if version=='v1.0' else 1)"

  Write-Host "[5/5] Running Playwright E2E"
  & npm run test:e2e --prefix $webRoot
}
finally {
  if ($apiProcess -and -not $apiProcess.HasExited) {
    Stop-Process -Id $apiProcess.Id -Force
  }
  if ($webProcess -and -not $webProcess.HasExited) {
    Stop-Process -Id $webProcess.Id -Force
  }
}
