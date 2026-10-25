#!/usr/bin/env bash
# ==============================================================================
# FM Workspace — 1-Click Interactive Terminal Installer for macOS & Linux
# Usage: curl -fsSL https://raw.githubusercontent.com/gochee-nhdk/fm-workspace/main/scripts/install.sh | bash
# ==============================================================================
set -e

# ANSI Color Codes
GOLD='\033[38;2;250;196;38m'
GREEN='\033[38;2;52;199;89m'
BLUE='\033[38;2;0;136;255m'
CYAN='\033[38;2;41;151;255m'
WHITE='\033[38;2;255;255;255m'
GRAY='\033[38;2;160;160;165m'
RED='\033[38;2;255;59;48m'
BOLD='\033[1m'
RESET='\033[0m'

clear 2>/dev/null || true
echo -e "${GOLD}${BOLD}"
echo "  ╔══════════════════════════════════════════════════════════════════════════╗"
echo "  ║                                                                          ║"
echo "  ║   🌾 FARMERS MARKET WORKSPACE — 1-CLICK TERMINAL INSTALLER               ║"
echo "  ║         Hệ Thống Trợ Lý Thu Mua & Quản Trị Cục Bộ (macOS / Linux)        ║"
echo "  ║                                                                          ║"
echo "  ╚══════════════════════════════════════════════════════════════════════════╝"
echo -e "${RESET}"
echo -e "  ${GRAY}Thiết kế theo chuẩn Apple Liquid Glass • Local-First SQLite • 100% Riêng Tư${RESET}\n"

write_step() {
    local step="$1"
    local title="$2"
    echo -e "\n${CYAN}${BOLD}[${step}]${WHITE} ${title}${RESET}"
    echo -e "${GRAY}  ──────────────────────────────────────────────────────────────────────${RESET}"
}

write_success() { echo -e "  ${GREEN}✔ $1${RESET}"; }
write_warn()    { echo -e "  ${GOLD}⚠ $1${RESET}"; }
write_err()     { echo -e "  ${RED}✖ $1${RESET}"; }

# ── [1/5] Kiểm tra môi trường hệ thống ─────────────────────────────────────────
write_step "1/5" "Kiểm tra môi trường hệ thống (Node.js & Công cụ)..."

if ! command -v node >/dev/null 2>&1; then
    write_warn "Chưa phát hiện Node.js trên máy tính!"
    if [[ "$OSTYPE" == "darwin"* ]] && command -v brew >/dev/null 2>&1; then
        echo -ne "  ${CYAN}? Bạn có muốn tự động cài Node.js qua Homebrew không? (Y/n): ${RESET}"
        read -r ans
        if [[ -z "$ans" || "$ans" =~ ^[Yy]$ ]]; then
            echo -e "  ${GRAY}Đang cài đặt Node.js qua Homebrew...${RESET}"
            brew install node
        else
            write_err "Cần có Node.js v18+ để vận hành FM Workspace. Tải tại: https://nodejs.org"
            exit 1
        fi
    else
        write_err "Vui lòng cài Node.js LTS (v18+) từ https://nodejs.org rồi chạy lại lệnh này."
        exit 1
    fi
fi

NODE_VER=$(node -v)
NODE_MAJOR=$(node -v | sed 's/v\([0-9]*\).*/\1/')
write_success "Đã phát hiện Node.js: ${BOLD}${NODE_VER}${RESET}"

if [ "$NODE_MAJOR" -lt 18 ]; then
    write_warn "Node.js ${NODE_VER} đã cũ. FM Workspace khuyến nghị v18+."
fi

HAS_GIT=false
if command -v git >/dev/null 2>&1; then
    HAS_GIT=true
    write_success "Đã phát hiện Git: $(git --version)"
fi

# ── [2/5] Tương tác chọn ổ đĩa & thư mục cài đặt ──────────────────────────────
write_step "2/5" "Chọn vị trí cài đặt trên ổ đĩa..."

DEFAULT_PATH="$HOME/FM-Workspace"
echo -e "  ${WHITE}Không gian lưu trữ khả dụng trên hệ thống:${RESET}"
df -h "$HOME" | awk 'NR==2 {print "    ▶ Ổ đĩa chính: Khả dụng " $4 " (Điểm gắn: " $6 ")"}'

echo -e "\n  ${WHITE}Vị trí cài đặt đề xuất:${BOLD} ${DEFAULT_PATH}${RESET}"
echo -e "  ${GRAY}(Nhấn [ENTER] để cài vào thư mục mặc định, hoặc nhập đường dẫn khác)${RESET}"
echo -ne "  ${CYAN}? Nhập đường dẫn thư mục cài đặt: ${RESET}"
read -r CUSTOM_PATH

if [ -z "$CUSTOM_PATH" ]; then
    INSTALL_PATH="$DEFAULT_PATH"
else
    # Mở rộng dấu ~ thành thư mục HOME
    INSTALL_PATH="${CUSTOM_PATH/#\~/$HOME}"
fi

write_success "Thư mục cài đặt đã chọn: ${BOLD}${INSTALL_PATH}${RESET}"
mkdir -p "$INSTALL_PATH"

# ── [3/5] Tải mã nguồn từ GitHub ──────────────────────────────────────────────
write_step "3/5" "Tải mã nguồn FM Workspace mới nhất từ GitHub..."

REPO_URL="https://github.com/gochee-nhdk/fm-workspace.git"
ZIP_URL="https://github.com/gochee-nhdk/fm-workspace/archive/refs/heads/main.zip"

if [ "$HAS_GIT" = true ]; then
    if [ -d "$INSTALL_PATH/.git" ]; then
        echo -e "  ${GRAY}Đang cập nhật mã nguồn bằng Git...${RESET}"
        cd "$INSTALL_PATH" && git pull origin main
    else
        echo -e "  ${GRAY}Đang clone mã nguồn từ GitHub vào ${INSTALL_PATH}...${RESET}"
        git clone --depth 1 "$REPO_URL" "$INSTALL_PATH"
    fi
    write_success "Tải mã nguồn qua Git thành công."
else
    echo -e "  ${GRAY}Đang tải gói nén ZIP từ GitHub...${RESET}"
    TEMP_ZIP="/tmp/fm-workspace-main.zip"
    curl -fsSL "$ZIP_URL" -o "$TEMP_ZIP"
    TEMP_EXTRACT="/tmp/fm-extract-temp"
    rm -rf "$TEMP_EXTRACT" && mkdir -p "$TEMP_EXTRACT"
    unzip -q "$TEMP_ZIP" -d "$TEMP_EXTRACT"
    cp -R "$TEMP_EXTRACT/fm-workspace-main/"* "$INSTALL_PATH/"
    rm -f "$TEMP_ZIP" && rm -rf "$TEMP_EXTRACT"
    write_success "Giải nén mã nguồn thành công."
fi

cd "$INSTALL_PATH"

# ── [4/5] Cài đặt dependencies, CSDL SQLite & Build ───────────────────────────
write_step "4/5" "Cài đặt thư viện, khởi tạo CSDL SQLite & Biên dịch Web App..."

[ ! -f "client/.env" ] && [ -f "client/.env.example" ] && cp "client/.env.example" "client/.env"
[ ! -f "server/.env" ] && [ -f "server/.env.example" ] && cp "server/.env.example" "server/.env"

echo -e "  ${GRAY}Cài đặt packages (npm install)...${RESET}"
npm install
npm --prefix server install
npm --prefix client install --legacy-peer-deps

echo -e "  ${GRAY}Khởi tạo cơ sở dữ liệu SQLite cục bộ (app.db)...${RESET}"
npm --prefix server run db:init
write_success "Khởi tạo CSDL SQLite thành công!"

echo -e "  ${GRAY}Biên dịch Web App tĩnh tối ưu hiệu năng (build:all)...${RESET}"
npm run build:all
write_success "Biên dịch Web App thành công!"

# ── [5/5] Cấu hình Desktop Shortcut & Khởi động ───────────────────────────────
write_step "5/5" "Tạo biểu tượng Desktop & Khởi động ứng dụng..."

chmod +x start.sh stop.sh install.sh 2>/dev/null || true
node scripts/create_shortcut.cjs || true

echo -e "\n${GOLD}${BOLD}"
echo "  ╔══════════════════════════════════════════════════════════════════════════╗"
echo "  ║                       ✅ CÀI ĐẶT THÀNH CÔNG 100%!                        ║"
echo "  ╚══════════════════════════════════════════════════════════════════════════╝${RESET}"
echo -e "  ${GREEN}✔ Biểu tượng ứng dụng [FM Workspace] đã xuất hiện trên Desktop của Mac.${RESET}"
echo -e "  ${CYAN}▶ Khởi chạy bằng phím tắt:  Nhấp đúp biểu tượng [FM Workspace] trên Desktop${RESET}"
echo -e "  ${CYAN}▶ Khởi chạy bằng Terminal:  cd \"${INSTALL_PATH}\" && ./start.sh${RESET}"
echo -e "  ${CYAN}▶ Địa chỉ Web App:          http://localhost:3000${RESET}"
echo -e "  ${GRAY}  (Dữ liệu lưu 100% trên SQLite tại ${INSTALL_PATH}/server/data/app.db)${RESET}\n"

echo -e "  ${WHITE}Đang tự động mở FM Workspace trên trình duyệt mặc định...${RESET}"
./start.sh
