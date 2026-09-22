$ws = New-Object -ComObject WScript.Shell

$desktopPaths = @(
    [Environment]::GetFolderPath('Desktop'),
    [System.IO.Path]::Combine($env:USERPROFILE, "Desktop")
) | Select-Object -Unique

# Tim bieu tuong Microsoft Edge
$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

foreach ($desktop in $desktopPaths) {
    if (Test-Path $desktop) {
        $shortcutPath = [System.IO.Path]::Combine($desktop, "Tro Ly Thu Mua - Farmers Market.lnk")
        $shortcut = $ws.CreateShortcut($shortcutPath)
        $shortcut.TargetPath = "powershell.exe"
        $shortcut.Arguments = "-WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -Command `"Start-Process 'http://localhost:5173/'; Set-Location -LiteralPath 'D:\trợ lý thu mua'; node .\security-guardian.cjs`""
        $shortcut.WorkingDirectory = "D:\trợ lý thu mua"
        $shortcut.WindowStyle = 7 # Minimized
        $shortcut.Description = "Mo Tro Ly Thu Mua Farmers Market tren Trinh Duyet Mac Dinh"
        
        if (Test-Path $edgePath) {
            $shortcut.IconLocation = "$edgePath, 0"
        }
        $shortcut.Save()
        Write-Host "   Da tao thanh cong: $shortcutPath" -ForegroundColor Green
    }
}

Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "   DA CAP NHAT PHIM TAT 1-CHAM NGOAI MAN HINH (DESKTOP)!" -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "Tu bay gio, ban chi can NHAP DUP CHUOT vao bieu tuong la vao thang App tren trinh duyet mac dinh!"
