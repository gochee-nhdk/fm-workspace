# Hướng Dẫn Cài Đặt & Sử Dụng FM Workspace (Dành Cho Máy Cá Nhân)

Ứng dụng **FM Workspace** được thiết kế theo triết lý **Local-First**: Toàn bộ dữ liệu (ghi chú, mật khẩu tài khoản, danh mục liên kết, danh sách cửa hàng, bảng tính) đều được lưu trữ **100% cục bộ trên máy tính của bạn** thông qua cơ sở dữ liệu SQLite và IndexedDB của trình duyệt. 

Không có bất kỳ dữ liệu nhạy cảm nào bị gửi lên đám mây hay máy chủ bên ngoài.

---

## 🚀 Cài Đặt Siêu Tốc (1-Click Setup)

### Yêu Cầu Trước Khi Cài Đặt:
- Máy tính chạy hệ điều hành **Windows 10 / 11**.
- Đã cài đặt **Node.js** (Khuyên dùng bản LTS từ trang chủ [nodejs.org](https://nodejs.org) hoặc gõ `winget install OpenJS.NodeJS.LTS` trong PowerShell).

### Các Bước Cài Đặt:
1. Tải toàn bộ mã nguồn về máy tính (hoặc bấm **Code -> Download ZIP** trên GitHub rồi giải nén ra một thư mục cố định).
2. Nhấn đúp chuột vào file:
   ```text
   CAI_DAT_APP.bat
   ```
3. Chương trình sẽ tự động:
   - Cài đặt đầy đủ các gói phụ thuộc.
   - Khởi tạo cơ sở dữ liệu SQLite tại chỗ.
   - Tạo biểu tượng **FM Workspace** ngoài màn hình chính (Desktop).
   - **Gán sẵn phím tắt toàn hệ thống: `Ctrl + Alt + F`**.

---

## ⚡ Cách Khởi Chạy Ứng Dụng Hàng Ngày

Khi đã cài đặt xong, bạn có thể mở ứng dụng bất cứ lúc nào với 2 cách cực kỳ tiện lợi:

1. **Bấm phím tắt**: Nhấn tổ hợp phím **`Ctrl + Alt + F`** trên bàn phím.
2. **Bấm đúp chuột**: Nhấn vào icon **FM Workspace** trên màn hình Desktop (hoặc chạy file `KHOI_CHAY_APP.vbs`).

> Ứng dụng sẽ chạy hoàn toàn ẩn (không xuất hiện màn hình đen dòng lệnh khó chịu) và tự động bật trình duyệt web tới địa chỉ `http://localhost:5173`.

---

## 🛑 Các Tiện Ích Bổ Trợ

- **Tắt ứng dụng**: Khi làm việc xong và muốn giải phóng RAM, bạn chỉ cần nhấn đúp vào file `DUNG_APP.bat`.
- **Sao lưu dữ liệu cá nhân**: Nhấn đúp vào file `SAO_LUU_DU_LIEU.bat`. Hệ thống sẽ tự động sao chép toàn bộ cơ sở dữ liệu `app.db` vào thư mục `backups/` có ghi rõ ngày giờ sao lưu.

---

## 🛡️ Cam Kết Quyền Riêng Tư & Bảo Mật

- **Không lưu trữ trên Cloud**: Mọi tài khoản, mật khẩu, liên kết và ghi chú đều nằm trực tiếp trên ổ đĩa của bạn (`server/data/app.db`).
- **Hoạt động Offline**: Bạn hoàn toàn có thể sử dụng ứng dụng ngay cả khi máy tính bị mất kết nối Internet.
