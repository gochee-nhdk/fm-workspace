# 🌿 Farmers Market — FM Workspace OS v2.0

> **Hệ thống Trợ Lý Thu Mua & Quản Trị Tác Nghiệp Nội Bộ**  
> Thiết kế chuẩn **Kính Lỏng 3D (Liquid Glass)** với công nghệ lưu trữ cục bộ bảo mật cao (Zero-Cloud Privacy).

---

## 🌟 Tính Năng Nổi Bật

### 1. 🛡️ Account Vault (Bảo Mật Tối Đa)
- Quản lý tập trung tài khoản **SAP, POS, Bravo, DMS, KiotViet, Tiki, Shopee, Lazada**.
- **Tự động che giấu mật khẩu** theo mặc định với cơ chế Reveal/Hide trực quan.
- **Tự hủy Clipboard sau 45s**: Khi sao chép mật khẩu, hệ thống tự động xóa bộ nhớ đệm clipboard của hệ điều hành để chống đánh cắp dữ liệu.
- **Zero Cloud Leak**: Không truyền bất kỳ thông tin nhạy cảm nào ra internet. Dữ liệu lưu 100% trong IndexedDB của máy tính nội bộ.

### 2. ⚡ Quick Links (Phím Tắt Tác Nghiệp)
- Danh bạ liên kết thao tác nhanh các cổng nội bộ, hệ thống đơn hàng, báo cáo kinh doanh.
- Ghim liên kết yêu thích (Favorite) và sắp xếp linh hoạt theo danh mục hoặc thứ tự ưu tiên (STT).
- Hỗ trợ xem dạng lưới thẻ 3D (Grid) hoặc danh sách chi tiết (List).

### 3. 🏪 Danh Mục Cửa Hàng (Store Directory)
- Quản trị toàn bộ mạng lưới chi nhánh Farmers Market.
- Tra cứu nhanh mã cửa hàng, địa chỉ, số điện thoại hotline, phân loại quy mô (Flagship / Standard / Express / Hub).
- Tích hợp 1 chạm mở trực tiếp **Google Maps Navigation**.

### 4. 📊 Trung Tâm Quản Lý Dữ Liệu & Excel Engine
- **Import / Export 2 chiều**: Tương thích hoàn hảo với file Excel mẫu nội bộ gồm 3 sheets: `LINK`, `ACCOUNT`, `DS CH`.
- **Chống Spreadsheet Formula Injection**: Tự động chuẩn hóa và bảo vệ trước các ký tự nguy hiểm (`=`, `+`, `-`, `@`).
- **Làm đẹp & căn chỉnh ô Excel tự động**: Header màu thương hiệu FM, border mảnh, font Segoe UI, tự tính độ rộng cột.
- **Tự động sửa chữa IndexedDB (Self-Healing)**: Tự động khôi phục kết nối cơ sở dữ liệu nếu trình duyệt gặp gián đoạn.

### 5. 🎨 Giao Diện Kính Lỏng 3D (Liquid Glass) Thế Hệ Mới
- Hiệu ứng khúc xạ ánh sáng động (Dynamic Optical Refraction & Specular Bevel) sang trọng.
- **Hỗ trợ Chế độ Sáng / Tối hoàn hảo** (Light Mode / Dark Mode) tự động lưu sở thích người dùng.
- **Command Palette Spotlight (`Ctrl+K` / `⌘K`)**: Tìm kiếm tức thì từ bất kỳ màn hình nào.

---

## 🏗️ Công Nghệ Sử Dụng

| Tầng | Công nghệ | Mô tả |
|---|---|---|
| **Client** | React 18, Vite 5, TypeScript | Nhanh, mượt, tối ưu kích thước bundle |
| **Styling** | Tailwind CSS, `@liqui-design/glass` | Hiệu ứng Liquid Glass 3D, Spring Motion |
| **State** | Zustand (với LocalStorage Persist) | Quản lý state gọn gàng, không re-render thừa |
| **Storage** | Native IndexedDB + Self-Healing | Bền vững, không mất khi tắt mở trình duyệt |
| **Excel** | ExcelJS, SheetJS (xlsx) | Xử lý file bảng tính chuyên nghiệp |
| **Backend** | Fastify, SQLite (better-sqlite3) | Tốc độ xử lý cao, bảo mật API |

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### Yêu cầu tiên quyết:
- **Node.js** >= 18.0.0
- **npm** >= 9.0.0

### 1. Cài đặt thư viện:
```bash
# Cài đặt cho giao diện Client
cd client
npm install

# Cài đặt cho Backend Server
cd ../server
npm install
```

### 2. Khởi chạy ứng dụng:
```bash
# Terminal 1: Chạy Server (Cổng 3000)
cd server
npm run dev

# Terminal 2: Chạy Client (Cổng 5173)
cd client
npm run dev
```

Mở trình duyệt truy cập: **`http://localhost:5173`**

### 3. Phím tắt hữu ích:
- `Ctrl + K` (hoặc `⌘ + K`): Mở thanh tìm kiếm nhanh Spotlight toàn hệ thống.
- Nhấp biểu tượng góc trên bên phải để đổi giao diện **Sáng / Tối**.

---

## 🔒 Bản Quyền & Bảo Mật

- Dự án phục vụ công việc tác nghiệp nội bộ **Farmers Market**.
- Mọi dữ liệu tài khoản và liên kết được mã hóa và cô lập cục bộ trên thiết bị của nhân sự phụ trách.
