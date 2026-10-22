# Forward to the robust dynamic creator
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$targetScript = Join-Path $scriptDir "scripts\create_shortcut.ps1"
if (Test-Path $targetScript) {
    & $targetScript
}
