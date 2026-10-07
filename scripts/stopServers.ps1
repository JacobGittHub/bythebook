<#
.SYNOPSIS
  Stops local dev servers and watchers: every node process that listens on a TCP port or
  runs something from a node_modules folder (next dev, Playwright, Vitest, npm scripts),
  together with its child processes.

.DESCRIPTION
  Works for any project on the machine, not only this one. It leaves alone the processes
  that started it, Claude Code, and node programs installed outside a node_modules folder
  that listen on no port (such as Adobe's background helper).

.PARAMETER List
  Shows what would be stopped, and stops nothing.

.EXAMPLE
  npm run dev:stop
  npm run dev:stop -- -List
  powershell -ExecutionPolicy Bypass -File C:\path\to\stopServers.ps1
#>
param([switch]$List)

# The processes that started this script (npm, its shell): stopping them would stop it too.
$ancestors = @()
$current = Get-CimInstance Win32_Process -Filter "ProcessId = $PID"
while ($current -and $current.ParentProcessId -and $ancestors -notcontains $current.ParentProcessId) {
  $ancestors += $current.ParentProcessId
  $current = Get-CimInstance Win32_Process -Filter "ProcessId = $($current.ParentProcessId)"
}

$ports = @{}
foreach ($connection in Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue) {
  $ports[[int]$connection.OwningProcess] += @($connection.LocalPort)
}

$targets = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object {
  $commandLine = "$($_.CommandLine)"
  ($ports.ContainsKey([int]$_.ProcessId) -or $commandLine -match 'node_modules') -and
    $commandLine -notmatch 'claude' -and
    $ancestors -notcontains $_.ProcessId
})

if ($targets.Count -eq 0) {
  Write-Output "No dev servers or watchers are running."
  exit 0
}

foreach ($process in $targets) {
  $id = [int]$process.ProcessId
  $listening = if ($ports.ContainsKey($id)) { "port $(($ports[$id] | Sort-Object -Unique) -join ', ')" } else { "no port" }
  $commandLine = ("$($process.CommandLine)" -replace '\s+', ' ')
  if ($commandLine.Length -gt 110) { $commandLine = $commandLine.Substring(0, 110) + "..." }
  Write-Output ("{0,6}  {1,-12}  {2}" -f $id, $listening, $commandLine)
}

if ($List) {
  Write-Output "Listed only. Run without -List to stop them."
  exit 0
}

# Stop the top of each tree; /T takes its children with it.
$ids = @($targets | ForEach-Object { [int]$_.ProcessId })
foreach ($process in $targets | Where-Object { $ids -notcontains [int]$_.ParentProcessId }) {
  & taskkill.exe /PID $process.ProcessId /T /F 2>&1 | Out-Null
}

Start-Sleep -Milliseconds 500
$left = @($ids | Where-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue })
if ($left.Count -gt 0) {
  Write-Output "Still running: $($left -join ', ')"
  exit 1
}
Write-Output "Stopped $($ids.Count) process(es)."
