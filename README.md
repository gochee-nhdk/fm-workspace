# 🌿 Farmers Market — FM Workspace OS v2.0

> **Hệ thống Trợ Lý Thu Mua, Tính Toán Thông Minh & Quản Trị Tác Nghiệp Nội Bộ**  
> Thiết kế chuẩn **Apple Liquid Glass (Glassmorphism)**, bảo mật cao đa tầng (Anti-Hacker, CSP, Zero-Cloud Leak), tích hợp **Math Notes** và **Google Gemini AI**.

---

## 🌟 Tính Năng Chính

### 1. 📝 Quick Note & Apple Math Notes (iPadOS 18 / macOS Sequoia Style)
- Ghi chú nhanh dạng cửa sổ nổi Liquid Glass hoặc toàn màn hình.
- **Math Notes tự động**: Tính toán biểu thức số học ngay khi gõ dấu `=` (ví dụ: `150k + 30k = 180,000`, `2.5tr * 15% = 375,000`) kèm **hiệu ứng animation phát sáng nảy nhẹ**.
- **Interactive Checklist**: Danh sách công việc thông minh, gạch ngang khi hoàn thành, đồng bộ tỷ lệ tiến độ.
- **Cài đặt nhắc nhở & hẹn giờ (Reminder)**: Hỗ trợ nhắc việc màn hình và gửi email cảnh báo thông qua SMTP.
- **Bảo mật ghi chú bằng mã PIN 6 số**: Khóa riêng tư từng ghi chú, tự động ẩn nội dung nhạy cảm.

### 2. 🛡️ Account Vault (Két Mật Khẩu Tác Nghiệp)
- Quản lý tập trung tài khoản tác nghiệp: **SAP, POS, Bravo, DMS, KiotViet, Tiki, Shopee, Lazada...**
- Tự động ẩn mật khẩu với cơ chế Reveal/Hide.
- **Tự hủy Clipboard sau 45s**: Xóa bộ nhớ đệm sau khi sao chép để chống đánh cắp dữ liệu.
- Lưu trữ cục bộ an toàn trong IndexedDB của máy tính nội bộ.

### 3. ⚡ Links & Danh Mục Cửa Hàng
- Quản lý liên kết nhanh các cổng nội bộ, ghim liên kết yêu thích.
- Tra cứu danh bạ cửa hàng, địa chỉ, số hotline, mở bản đồ chỉ đường Google Maps 1 chạm.

### 4. 🤖 AI Procurement Copilot & Gemini Writing Tools
- Trợ lý AI phân tích dữ liệu tồn kho, đề xuất đặt hàng theo công thức chuỗi cung ứng: Days of Cover (DoC), Safety Stock, Reorder Point, Recommended Order Quantity.
- Hỗ trợ công cụ biên tập văn bản thông minh (Sửa chính tả, tóm tắt, viết lại chuyên nghiệp).

---

## 🔒 Kiến Trúc Bảo Mật (Anti-Hacker Shield)

- **Content Security Policy (CSP)** & Anti-Clickjacking (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`).
- **Mã hóa mật khẩu chuẩn Argon2id** (chuẩn khuyến nghị OWASP cao cấp).
- **Phòng chống Brute-Force**: Giới hạn tần suất đăng nhập (Rate Limit 5 lượt/phút).
- **100% Parameterized SQL Statements**: Loại trừ triệt để nguy cơ SQL Injection.
- **Bảo vệ Secrets**: Khóa API và mật khẩu email được che giấu (`••••••••`), không bao giờ lọt vào client hay commit Git.

---

## 🚀 Hướng Dẫn Cài Đặt & Sử Dụng (Dành Cho Máy Cá Nhân)

### 👉 Cách 1: Cài đặt 1-Click trên Windows
1. Tải repo này về máy tính (bấm **Code -> Download ZIP** rồi giải nén).
2. Nhấn đúp chuột vào file:
   ```text
   CAI_DAT_APP.bat
   ```
3. Chương trình sẽ tự động cài đặt toàn bộ gói cần thiết, tạo cơ sở dữ liệu SQLite cục bộ, tạo biểu tượng **FM Workspace** trên màn hình Desktop và **gán sẵn phím tắt toàn hệ thống: `Ctrl + Alt + F`**.
4. Khi muốn mở ứng dụng, bạn chỉ cần nhấn **`Ctrl + Alt + F`** hoặc bấm đúp vào biểu tượng trên Desktop!
5. Khi muốn tắt ứng dụng, nhấn đúp vào `DUNG_APP.bat`. Để sao lưu dữ liệu cá nhân, nhấn đúp vào `SAO_LUU_DU_LIEU.bat`.

---

### 👉 Cách 2: Cài đặt 1-Click trên macOS & Linux
Mở Terminal tại thư mục dự án và chạy:
```bash
./install.sh    # Tự động cài đặt 1 chạm và cấu hình môi trường
./start.sh      # Khởi động ứng dụng và tự động mở trình duyệt
./stop.sh       # Dừng ứng dụng và giải phóng cổng mạng
```

---

### 👉 Cách 3: Dành cho lập trình viên (Terminal / Developer Setup)

#### Bước 1: Tải mã nguồn
```bash
git clone https://github.com/gochee-nhdk/fm-workspace.git
cd fm-workspace
```

#### Bước 2: Cài đặt tự động toàn bộ ứng dụng (1 Lệnh duy nhất)
```bash
npm run setup
```
> Lệnh này sẽ tự động cài đặt thư viện cho Client & Server và khởi tạo cơ sở dữ liệu SQLite cục bộ với hệ thống chỉ mục tăng tốc.

#### Bước 3: Khởi chạy môi trường phát triển
```bash
npm run dev
```
Hệ thống sẽ đồng thời khởi chạy cả Backend (cổng `3000`) và Frontend (cổng `5173`).  
👉 Mở trình duyệt và truy cập: **`http://localhost:5173`**

---

## 🛠️ Các Lệnh Thao Tác Hữu Ích

| Lệnh | Ý nghĩa |
|---|---|
| `npm run dev` | Khởi chạy đồng thời Backend và Frontend |
| `npm run setup` | Cài đặt toàn bộ dependencies và khởi tạo cơ sở dữ liệu |
| `npm run build` | Đóng gói toàn bộ ứng dụng sẵn sàng deploy production |
| `npm --prefix server run test` | Chạy toàn bộ 40 test suites kiểm thử thuật toán và dữ liệu |
| `npm --prefix server run db:init` | Khởi tạo bảng và 17 composite indexes cho SQLite |
| `npm --prefix server run db:seed` | Tạo lại dữ liệu mẫu (Master Data) |

---

## 🌐 Hướng Dẫn Triển Khai Lên Mây (Deployment)

- **Frontend (Vercel):**
  - Kết nối kho GitHub `gochee-nhdk/fm-workspace`.
  - Cấu hình Environment Variable: `VITE_API_URL` trỏ tới URL backend (ví dụ: `https://fm-workspace-2.onrender.com`).
- **Backend (Render):**
  - Tạo Web Service từ repo, Build command: `npm --prefix server install && npm --prefix server run build`, Start command: `npm --prefix server run start`.

---

## ⌨️ Phím Tắt Tiện Ích
- `Ctrl + K` (hoặc `⌘ + K`): Mở tìm kiếm nhanh Spotlight.
- Gõ phép tính toán trong Note + `=`: Tự động tính nhẩm ngay lập tức.
