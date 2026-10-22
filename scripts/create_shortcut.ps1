# ==============================================================================
# FM WORKSPACE - DYNAMIC DESKTOP SHORTCUT CREATOR
# Creates a 1-click desktop shortcut with Ctrl+Alt+F hotkey on any Windows PC
# ==============================================================================

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$rootDir = (Resolve-Path (Join-Path $scriptDir "..")).Path

$vbsLauncher = Join-Path $rootDir "KHOI_CHAY_APP.vbs"
$icoPath = Join-Path $rootDir "logo.ico"
if (-not (Test-Path $icoPath)) {
    $icoPath = Join-Path $rootDir "client\public\favicon.ico"
}

$wscript = Join-Path $env:SystemRoot "System32\wscript.exe"

# Candidate desktop directories
$candidateDesktops = @(
    [Environment]::GetFolderPath('Desktop'),
    (Join-Path $env:USERPROFILE "Desktop"),
    (Join-Path $env:USERPROFILE "OneDrive\Desktop"),
    (Join-Path $env:USERPROFILE "OneDrive\Máy tính")
)

try {
    $regVal = (Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders" -Name "Desktop" -ErrorAction SilentlyContinue).Desktop
    if ($regVal) {
        $expanded = [Environment]::ExpandEnvironmentVariables($regVal)
        $candidateDesktops += $expanded
    }
} catch {}

$validDesktops = $candidateDesktops | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique

$ws = New-Object -ComObject WScript.Shell
$createdCount = 0

foreach ($desktop in $validDesktops) {
    try {
        $shortcutPath = Join-Path $desktop "FM Workspace.lnk"
        $sc = $ws.CreateShortcut($shortcutPath)
        $sc.TargetPath = $wscript
        $sc.Arguments = "`"$vbsLauncher`""
        $sc.WorkingDirectory = $rootDir
        if (Test-Path $icoPath) {
            $sc.IconLocation = "$icoPath,0"
        }
        $sc.Description = "FM Workspace - Tro Ly Thu Mua Farmers Market"
        $sc.Hotkey = "Ctrl+Alt+F"
        $sc.WindowStyle = 7
        $sc.Save()
        Write-Host "[OK] Da tao shortcut Desktop tai: $shortcutPath" -ForegroundColor Green
        $createdCount++
    } catch {
        Write-Warning "Khong the tao shortcut tai $desktop : $_"
    }
}

if ($createdCount -gt 0) {
    Write-Host "[THANH CONG] Phim tat toan cuc [Ctrl + Alt + F] da san sang!" -ForegroundColor Cyan
} else {
    Write-Warning "Khong tim thay thu muc Desktop hop le de tao shortcut."
}
