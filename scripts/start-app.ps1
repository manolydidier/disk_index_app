# Launched by the "DiskIndexer-AutoStart" scheduled task at user logon.
# Starts the local scan agent, logging to its own file so failures can be
# diagnosed without an attached terminal.
#
# The web server used to be started here too, but it now runs in Docker on
# a separate machine (see docker-compose.yml) — starting it natively here
# as well would fight the container for port 3000. This machine is a client:
# only the agent runs locally, pointed at the server via AGENT_SERVER_URL.

$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $projectDir 'logs'

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

# Give the network/filesystem a moment to settle right after logon before
# the agent tries to enumerate drives and reach the server.
Start-Sleep -Seconds 15

Set-Location $projectDir

$agentLog = Join-Path $logDir 'agent.log'

Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', 'agent:start' `
  -WorkingDirectory $projectDir `
  -RedirectStandardOutput $agentLog -RedirectStandardError "$agentLog.err" `
  -WindowStyle Hidden
