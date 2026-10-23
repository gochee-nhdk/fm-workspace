# 🌾 FM Workspace — Trợ Lý Thu Mua Farmers Market

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-0071e3?style=for-the-badge&logo=apple&logoColor=white" />
  <img src="https://img.shields.io/badge/UI-Apple%20Liquid%20Glass-0088ff?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Performance-120%20FPS-34c759?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Data-Local--First%20%7C%20SQLite-ff9500?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Security-SHA--256%20%7C%20Argon2id-af52de?style=for-the-badge" />
</p>

> Hệ thống quản lý thu mua, tính toán thông minh & quản trị tác nghiệp nội bộ — thiết kế theo tiêu chuẩn **Apple Liquid Glass (macOS 26 & iPadOS 18)**, chạy hoàn toàn **cục bộ** (Local-First), không cần Internet.

---

## 💻 Ứng Dụng Desktop Độc Lập (Khuyến Nghị Cho Người Dùng)

Bạn có thể sử dụng FM Workspace như một ứng dụng máy tính độc lập (Native Desktop App) hoàn toàn không cần trình duyệt:

- **Tải file cài đặt:** `FM Workspace Setup 1.0.0.exe` (trong thư mục `dist-electron`)
- **Cài đặt 1 chạm:** Nhấp đúp chuột vào file `.exe`, ứng dụng tự động cài đặt và tạo biểu tượng **FM Workspace** trên Desktop và Start Menu.
- **Tự đóng gói lại từ mã nguồn:** Nhấp đúp vào `DONG_GOI_APP_EXE.bat` để tự tạo bản cài đặt mới nhất.

---

## ⚡ Cài Đặt Bản Web / Source Code (Dành Cho Lập Trình Viên)

### Yêu cầu duy nhất: [Node.js v18+](https://nodejs.org)

#### 🪟 Windows

```
1. Tải về và giải nén mã nguồn
2. Nhấp đúp vào:  CAI_DAT_APP.bat
3. Chờ khoảng 2-3 phút
4. Xong! Biểu tượng [FM Workspace] xuất hiện trên Desktop
```

#### 🍎 macOS / Linux

```bash
git clone https://github.com/gochee-nhdk/fm-workspace.git
cd fm-workspace
chmod +x install.sh && ./install.sh
```

---

## 🚀 Khởi Động Nhanh (Sau khi đã cài)

| Cách mở | Mô tả |
|---|---|
| **`Ctrl + Alt + F`** | Phím tắt toàn cục — Mở ngay từ mọi nơi (Windows) |
| Nhấp đúp Desktop | Biểu tượng **FM Workspace** trên màn hình |
| `./start.sh` | Dòng lệnh (macOS / Linux) |

> App tự động kiểm tra xem server đang chạy chưa. Nếu chưa → tự khởi động, chờ ready, rồi mở trình duyệt mặc định.

---

## ✨ Tính Năng Nổi Bật

### 📝 Apple Math Notes & Ghi Chú Nhanh
- Gõ bất kỳ phép tính kết thúc bằng `=` → Tự động ra kết quả ngay trong ghi chú
- Cửa sổ nổi tự do (Free Floating Window) — Di chuyển mượt mà **120 FPS**
- Interactive Checklist, đính kèm file & ảnh, xem trước PowerPoint (.pptx)
- Lịch nhắc nhở thông minh với bộ chọn ngày giờ Apple Liquid Glass

### 🔐 Két Mật Khẩu Tác Nghiệp (Account Vault)
- Quản lý tập trung mọi tài khoản nội bộ: SAP, POS, Bravo, KiotViet, Portal nhà cung cấp...
- **Tự hủy Clipboard sau 45 giây** — Bảo vệ chống đánh cắp dữ liệu
- Kéo thả (Drag & Drop) sắp xếp thứ tự ưu tiên

### 🔍 Tìm Kiểm Đa Năng Spotlight (`Ctrl+K`)
- Tìm nhanh liên kết, tài khoản, mã cửa hàng (`FM09`, `FM18`) trong <10ms
- Dùng phím **Tab** để chuyển đổi phạm vi lọc tức thì

### 🤖 Trợ Lý Soạn Thảo AI (Google Gemini)
- 9 công cụ xử lý ngôn ngữ: Tóm tắt, Rút ra ý chính, Viết lại chuyên nghiệp, Dịch thuật thương mại...

### 💾 Sao Lưu & Phục Hồi (.fmbackup)
- Xuất toàn bộ dữ liệu ra 1 file duy nhất, xác thực bằng **SHA-256**
- Nhập lại bất kỳ lúc nào, không mất dữ liệu

---

## 🛡️ Kiến Trúc: Local-First & Zero-Cloud Leak

```
┌─────────────────────────────────────────────────────────┐
│               MÁY TÍNH CÁ NHÂN (LOCAL)                 │
│                                                         │
│   ┌──────────────────┐         ┌──────────────────┐    │
│   │  Trình duyệt Web │◄──────►│  Node.js Server  │    │
│   │  (React 120 FPS) │  IPC   │  (SQLite cục bộ) │    │
│   └──────────────────┘         └──────────────────┘    │
│                                                         │
│         KHÔNG CÓ DỮ LIỆU NÀO BỊ GỬI LÊN CLOUD         │
└─────────────────────────────────────────────────────────┘
```

- **100% Cục bộ**: Ghi chú, tài khoản, mật khẩu lưu trong SQLite (`server/data/`)
- **Offline hoàn toàn**: Không cần Internet sau khi cài đặt
- **Không phụ thuộc đám mây**: Tránh hoàn toàn nguy cơ rò rỉ dữ liệu

---

## 🔑 Phím Tắt Phổ Biến

| Phím tắt | Chức năng |
|---|---|
| `Ctrl + Alt + F` | Mở/Khởi động FM Workspace từ Desktop |
| `Ctrl + K` | Mở tìm kiếm nhanh Spotlight |
| `Alt + N` / `Ctrl + J` | Bật/Tắt cửa sổ Ghi chú nhanh |
| `Ctrl + \` | Mở rộng/Thu gọn Sidebar |
| Gõ phép tính + `=` | Tính toán tự động trong ghi chú |
| `Esc` | Đóng hộp thoại hoặc cửa sổ ghi chú |

---

## 🛠️ Phát Triển (Dành cho Developer)

```bash
# Clone & cài đặt
git clone https://github.com/gochee-nhdk/fm-workspace.git
cd fm-workspace
npm run setup

# Chạy môi trường development (Port 5173 client + 3000 server)
npm run dev

# Build production
npm run build

# Chạy production
node server/dist/index.js
```

### Cấu trúc dự án

```
fm-workspace/
├── client/          # React + TypeScript + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/   # UI Components (Apple Liquid Glass)
│   │   ├── pages/        # Các trang chính
│   │   └── hooks/        # Custom React hooks
│   └── dist/        # Production build (sau khi npm run build)
├── server/          # Node.js + Express + SQLite
│   └── src/
│       ├── routes/  # REST API endpoints
│       └── db/      # Database queries & migrations
├── scripts/         # Launch scripts
├── CAI_DAT_APP.bat  # Windows 1-click setup
├── install.sh       # macOS/Linux 1-click setup
├── start.sh         # macOS/Linux launcher
└── KHOI_CHAY_APP.vbs # Windows silent launcher
```

---

## 📄 Giấy Phép

Phát triển bởi đội ngũ kỹ thuật nội bộ dành cho chuỗi bán lẻ thực phẩm sạch **Farmers Market Việt Nam**.  
Mã nguồn mở theo giấy phép **MIT License** — Tự do sử dụng, tùy biến và triển khai cho doanh nghiệp của bạn. 🌾
