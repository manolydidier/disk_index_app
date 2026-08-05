# Launched by the "DiskIndexer-AutoStart" scheduled task at user logon.
# Starts the production server and the local scan agent, each logging to
# its own file so failures can be diagnosed without an attached terminal.

$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $projectDir 'logs'

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

# Give the network/filesystem a moment to settle right after logon before
# the agent tries to enumerate drives and the server tries to reach Postgres.
Start-Sleep -Seconds 15

Set-Location $projectDir

$serverLog = Join-Path $logDir 'server.log'
$agentLog = Join-Path $logDir 'agent.log'

Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', 'start' `
  -WorkingDirectory $projectDir `
  -RedirectStandardOutput $serverLog -RedirectStandardError "$serverLog.err" `
  -WindowStyle Hidden

Start-Sleep -Seconds 10

Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', 'agent:start' `
  -WorkingDirectory $projectDir `
  -RedirectStandardOutput $agentLog -RedirectStandardError "$agentLog.err" `
  -WindowStyle Hidden
