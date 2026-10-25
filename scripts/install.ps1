<#
.SYNOPSIS
    FM Workspace — 1-Click Interactive Terminal Installer for Windows
    Usage: irm https://raw.githubusercontent.com/gochee-nhdk/fm-workspace/main/scripts/install.ps1 | iex
#>

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "FM Workspace — 1-Click Terminal Setup"

# ANSI Color Codes
$e = [char]27
$GOLD   = "$e[38;2;250;196;38m"
$GREEN  = "$e[38;2;52;199;89m"
$BLUE   = "$e[38;2;0;136;255m"
$CYAN   = "$e[38;2;41;151;255m"
$WHITE  = "$e[38;2;255;255;255m"
$GRAY   = "$e[38;2;160;160;165m"
$RED    = "$e[38;2;255;59;48m"
$BOLD   = "$e[1m"
$RESET  = "$e[0m"

function Print-Banner {
    Clear-Host
    Write-Host "$GOLD$BOLD"
    Write-Host "  ╔══════════════════════════════════════════════════════════════════════════╗"
    Write-Host "  ║                                                                          ║"
    Write-Host "  ║   🌾 FARMERS MARKET WORKSPACE — 1-CLICK TERMINAL INSTALLER               ║"
    Write-Host "  ║         Hệ Thống Trợ Lý Thu Mua & Quản Trị Cục Bộ (Local OS)             ║"
    Write-Host "  ║                                                                          ║"
    Write-Host "  ╚══════════════════════════════════════════════════════════════════════════╝"
    Write-Host "$RESET"
    Write-Host "  $GRAY  Thiết kế theo chuẩn Apple Liquid Glass • Local-First SQLite • 100% Riêng Tư$RESET`n"
}

function Write-Step ($step, $title) {
    Write-Host "`n$CYAN$BOLD[$step]$WHITE $title$RESET"
    Write-Host "$GRAY  ──────────────────────────────────────────────────────────────────────$RESET"
}

function Write-Success ($msg) {
    Write-Host "  $GREEN✔ $msg$RESET"
}

function Write-Warn ($msg) {
    Write-Host "  $GOLD⚠ $msg$RESET"
}

function Write-Err ($msg) {
    Write-Host "  $RED✖ $msg$RESET"
}

Print-Banner

# ── [1/6] Kiểm tra môi trường ──────────────────────────────────────────────────
Write-Step "1/6" "Kiểm tra môi trường hệ thống (Node.js & Git)..."

$nodeInstalled = $false
try {
    $nodeVer = (node -v 2>$null)
    if ($nodeVer) {
        $nodeInstalled = $true
        Write-Success "Đã phát hiện Node.js: $BOLD$nodeVer$RESET"
    }
} catch {}

if (-not $nodeInstalled) {
    Write-Warn "Chưa phát hiện Node.js trên máy tính!"
    Write-Host "  $CYAN? Bạn có muốn tự động cài đặt Node.js LTS qua winget ngay bây giờ không? (Y/n): $RESET" -NoNewline
    $ans = Read-Host
    if ($ans -eq '' -or $ans -match '^[Yy]') {
        Write-Host "  $GRAY Đang tải và cài đặt Node.js LTS tự động qua Windows Package Manager...$RESET"
        winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        $nodeVer = (node -v 2>$null)
        if ($nodeVer) {
            Write-Success "Cài đặt Node.js thành công: $nodeVer"
        } else {
            Write-Err "Vui lòng khởi động lại Terminal hoặc tải Node.js từ https://nodejs.org rồi chạy lại lệnh."
            exit 1
        }
    } else {
        Write-Err "Cần có Node.js v18+ để vận hành FM Workspace. Tải miễn phí tại https://nodejs.org"
        exit 1
    }
}

$hasGit = $false
try {
    if (Get-Command git -ErrorAction SilentlyContinue) {
        $hasGit = $true
        $gitVer = (git --version 2>$null)
        Write-Success "Đã phát hiện Git: $gitVer"
    }
} catch {}
if (-not $hasGit) {
    Write-Warn "Không tìm thấy Git (Sẽ tự động tải kho lưu trữ ZIP trực tiếp từ GitHub)"
}

# ── [2/6] Tương tác chọn ổ đĩa & thư mục cài đặt ──────────────────────────────
Write-Step "2/6" "Chọn vị trí cài đặt trên ổ đĩa..."

$systemDrive = $env:SystemDrive
if (-not $systemDrive) { $systemDrive = "C:" }

# Lấy danh sách ổ đĩa cục bộ
$drives = Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Free -gt 0 }
Write-Host "  $WHITE Danh sách ổ đĩa khả dụng trên máy của bạn:$RESET"
foreach ($d in $drives) {
    $freeGb = [math]::Round($d.Free / 1GB, 1)
    $isSys = if ($d.Name -eq $systemDrive.TrimEnd(':')) { "$GOLD(Ổ chứa Hệ Điều Hành - Khuyên dùng)$RESET" } else { "" }
    Write-Host "    $CYAN▶ Ổ [$($d.Name):]$RESET  Trống: $freeGb GB  $isSys"
}

$defaultInstallPath = Join-Path $systemDrive "FM-Workspace"
Write-Host "`n  $WHITE Vị trí cài đặt đề xuất:$BOLD $defaultInstallPath$RESET"
Write-Host "  $GRAY  (Nhấn [ENTER] để đồng ý cài vào ổ đĩa hệ điều hành, hoặc nhập đường dẫn khác)$RESET"
Write-Host "  $CYAN? Nhập đường dẫn thư mục cài đặt: $RESET" -NoNewline
$customPath = Read-Host

if ([string]::IsNullOrWhiteSpace($customPath)) {
    $installPath = $defaultInstallPath
} else {
    $installPath = $customPath.Trim()
    # Nếu người dùng chỉ gõ tên ổ đĩa như "D" hoặc "D:"
    if ($installPath -match '^[a-zA-Z]:?$') {
        $cleanDrive = $installPath.TrimEnd(':') + ":"
        $installPath = Join-Path $cleanDrive "FM-Workspace"
    }
}

Write-Success "Thư mục cài đặt đã chọn: $BOLD$installPath$RESET"

if (-not (Test-Path $installPath)) {
    New-Item -ItemType Directory -Path $installPath -Force | Out-Null
}

# ── [3/6] Tải mã nguồn từ GitHub ──────────────────────────────────────────────
Write-Step "3/6" "Tải mã nguồn FM Workspace mới nhất từ GitHub..."

$repoUrl = "https://github.com/gochee-nhdk/fm-workspace.git"
$zipUrl = "https://github.com/gochee-nhdk/fm-workspace/archive/refs/heads/main.zip"

if ($hasGit) {
    if (Test-Path (Join-Path $installPath ".git")) {
        Write-Host "  $GRAY Đang cập nhật mã nguồn mới nhất bằng Git...$RESET"
        Push-Location $installPath
        git pull origin main
        Pop-Location
    } else {
        Write-Host "  $GRAY Đang clone mã nguồn từ GitHub vào $installPath...$RESET"
        git clone --depth 1 $repoUrl $installPath
    }
    Write-Success "Đã tải mã nguồn thành công qua Git."
} else {
    $tempZip = Join-Path $env:TEMP "fm-workspace-main.zip"
    Write-Host "  $GRAY Đang tải gói nén ZIP từ GitHub...$RESET"
    
    # Download with progress
    $webClient = New-Object System.Net.WebClient
    $webClient.DownloadFile($zipUrl, $tempZip)
    Write-Success "Tải gói nén hoàn tất. Đang giải nén..."
    
    $extractTemp = Join-Path $env:TEMP "fm-extract-temp"
    if (Test-Path $extractTemp) { Remove-Item $extractTemp -Recurse -Force }
    Expand-Archive -Path $tempZip -DestinationPath $extractTemp -Force
    
    $innerDir = Join-Path $extractTemp "fm-workspace-main"
    Copy-Item -Path "$innerDir\*" -Destination $installPath -Recurse -Force
    Remove-Item $tempZip -Force -ErrorAction SilentlyContinue
    Remove-Item $extractTemp -Recurse -Force -ErrorAction SilentlyContinue
    Write-Success "Đã giải nén mã nguồn vào: $installPath"
}

Push-Location $installPath

# ── [4/6] Thiết lập cấu hình & Cài đặt Packages ──────────────────────────────
Write-Step "4/6" "Cài đặt packages & khởi tạo cơ sở dữ liệu SQLite..."

if (-not (Test-Path "client\.env") -and (Test-Path "client\.env.example")) {
    Copy-Item "client\.env.example" "client\.env" -Force
}
if (-not (Test-Path "server\.env") -and (Test-Path "server\.env.example")) {
    Copy-Item "server\.env.example" "server\.env" -Force
}

Write-Host "  $GRAY Đang chạy npm install (khoảng 1-2 phút)...$RESET"
cmd /c "npm install && npm --prefix server install && npm --prefix client install --legacy-peer-deps"

Write-Host "  $GRAY Khởi tạo cơ sở dữ liệu SQLite cục bộ (app.db)...$RESET"
cmd /c "npm --prefix server run db:init"
Write-Success "Cài đặt thư viện và khởi tạo CSDL SQLite hoàn tất!"

# ── [5/6] Biên dịch Web App Production ────────────────────────────────────────
Write-Step "5/6" "Biên dịch Web App Production (Client & Server)..."

Write-Host "  $GRAY Đang tối ưu hóa mã nguồn tĩnh để chạy mượt mà nhất...$RESET"
cmd /c "npm run build:all"
Write-Success "Biên dịch thành công! Giao diện Apple Liquid Glass đã sẵn sàng."

# ── [6/6] Tạo phím tắt Desktop & Khởi động ─────────────────────────────────────
Write-Step "6/6" "Tạo biểu tượng Desktop & Khởi động ứng dụng..."

# Gọi script tạo shortcut
cmd /c "node scripts/create_shortcut.cjs"

Write-Host "`n$GOLD$BOLD"
Write-Host "  ╔══════════════════════════════════════════════════════════════════════════╗"
Write-Host "  ║                       ✅ CÀI ĐẶT THÀNH CÔNG 100%!                        ║"
Write-Host "  ╚══════════════════════════════════════════════════════════════════════════╝$RESET"
Write-Host "  $GREEN✔ Biểu tượng [FM Workspace] đã xuất hiện trên màn hình Desktop của bạn.$RESET"
Write-Host "  $CYAN▶ Phím tắt toàn cục:    $BOLD[Ctrl + Alt + F]$RESET"
Write-Host "  $CYAN▶ Nhấp đúp:            Biểu tượng [FM Workspace] trên Desktop$RESET"
Write-Host "  $CYAN▶ Địa chỉ truy cập:     http://localhost:3000$RESET"
Write-Host "  $GRAY  (Dữ liệu lưu 100% trên SQLite tại $installPath\server\data\app.db)$RESET`n"

Write-Host "  $WHITE Đang tự động mở FM Workspace trên trình duyệt mặc định của bạn...$RESET"

# Khởi chạy ứng dụng ngầm
cscript //nologo (Join-Path $installPath "KHOI_CHAY_APP.vbs")

Pop-Location
