# 🍏 Hướng Dẫn Cài Đặt FM Workspace
### Dành cho mọi người dùng — Dễ hiểu, Trực quan, Hoàn tất trong 3 phút

> **Chào bạn!** Đừng lo lắng nếu bạn không rành về máy tính hay công nghệ. Tài liệu này được biên soạn từng bước cụ thể nhất, có sẵn liên kết tải trực tiếp để bạn chỉ cần làm theo là ứng dụng sẽ hoạt động ngay lập tức trên máy tính của bạn!

---

## 🧭 Lựa chọn hệ điều hành của bạn

- [👉 Hướng dẫn dành cho máy tính Windows (10 / 11)](#-phan-1-huong-dan-cho-may-tinh-windows-10--11)
- [👉 Hướng dẫn dành cho máy tính Apple macOS (MacBook, iMac, Mac mini)](#-phan-2-huong-dan-cho-may-tinh-apple-macos)
- [👉 Câu hỏi thường gặp & Khắc phục sự cố (FAQ)](#-cau-hoi-thuong-gap--khac-phuc-su-co-faq)

---

## 🪟 PHẦN 1: Hướng dẫn cho máy tính WINDOWS (10 / 11)

Quy trình cài đặt trên Windows chỉ gồm **3 bước siêu đơn giản**:

```
[Bước 1: Tải công cụ phụ trợ Node.js] ➔ [Bước 2: Tải ứng dụng về máy] ➔ [Bước 3: Bấm cài đặt 1-Click]
```

### 🔹 Bước 1: Cài đặt công cụ nền tảng Node.js (Chỉ cần làm 1 lần duy nhất)
Ứng dụng cần môi trường nhỏ tên là **Node.js** để chạy mượt mà ngay trên máy của bạn (hoàn toàn an toàn, miễn phí từ tổ chức mã nguồn mở quốc tế).

1. Nhấp chuột vào đường link chính thức sau để tải file cài đặt về máy:  
   👉 **[Tải Node.js bản ổn định cho Windows (Bản chính thức từ NodeJS.org)](https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi)**
2. Khi tải xong, nhấp đúp chuột vào file vừa tải (thường tên là `node-v20...msi` nằm trong thư mục **Downloads**).
3. Một cửa sổ cài đặt hiện lên: Bạn chỉ cần bấm nút **Next** liên tục ➔ bấm **Install** ➔ cuối cùng bấm **Finish**.  
   *(Không cần thay đổi bất kỳ tùy chọn nào cả)*.

---

### 🔹 Bước 2: Tải thư mục ứng dụng FM Workspace về máy
1. Tại trang GitHub của ứng dụng, bạn nhìn lên góc trên bên phải, bấm vào nút màu xanh lá cây có chữ **`Code`**.
2. Trong menu hiện ra, bấm chọn dòng cuối cùng: **`Download ZIP`**.
3. Sau khi tải xong, bạn mở thư mục **Downloads** trên máy tính:
   - Nhấp chuột phải vào file nén **`fm-workspace-main.zip`** vừa tải.
   - Chọn **Extract All...** (hoặc **Giải nén tại đây**) rồi bấm **Extract**.
   - Bạn sẽ có một thư mục tên là `fm-workspace-main`. Bạn có thể để thư mục này ở ổ đĩa `D:\` hoặc `C:\` tùy ý.

---

### 🔹 Bước 3: Cài đặt tự động bằng 1 cú nhấp chuột (1-Click)
1. Mở thư mục `fm-workspace-main` vừa giải nén ra.
2. Tìm file có tên:
   ```text
   CAI_DAT_APP.bat
   ```
   *(Biểu tượng file có hình 2 bánh răng)*.
3. **Nhấp đúp chuột vào file này** để chạy.
4. Một màn hình cài đặt tự động sẽ chạy trong khoảng 1–2 phút:
   - Tự động thiết lập thư viện và cơ sở dữ liệu lưu trữ nội bộ.
   - Tự động tạo biểu tượng **FM Workspace** ngoài màn hình chính (Desktop).
   - Tự động tạo phím tắt toàn năng: **`Ctrl + Alt + F`**.
5. Khi màn hình hiện chữ:
   ```text
   ==============================================================================
   [HOÀN TẤT] CÀI ĐẶT THÀNH CÔNG 100%!
   ==============================================================================
   Bạn có muốn khởi chạy ứng dụng ngay bây giờ không? (y/n):
   ```
   Bạn gõ chữ **`y`** rồi nhấn phím **Enter**. Trình duyệt web sẽ tự động mở lên trang chủ của ứng dụng!

---

### 🚀 Cách mở và tắt ứng dụng hàng ngày trên Windows

- **Khi muốn MỞ app**: Bạn có 2 cách cực kỳ nhanh:
  - Cách 1: Bấm tổ hợp phím **`Ctrl + Alt + F`** trên bàn phím.
  - Cách 2: Nhấp đúp vào biểu tượng **FM Workspace** ngoài màn hình Desktop.
- **Khi muốn TẮT app**: Nhấp đúp vào file `DUNG_APP.bat` trong thư mục ứng dụng để tắt hoàn toàn và giải phóng bộ nhớ RAM.

---
---

## 🍎 PHẦN 2: Hướng dẫn cho máy tính APPLE macOS

Ứng dụng hỗ trợ tối đa cho dòng chip Apple Silicon (M1/M2/M3/M4) và chip Intel với giao diện chuẩn macOS Liquid Glass.

### 🔹 Bước 1: Cài đặt Node.js cho macOS
1. Nhấp vào link chính thức sau để tải bộ cài đặt dành cho máy Mac:  
   👉 **[Tải Node.js cho macOS (Gói cài đặt .pkg chính thức)](https://nodejs.org/dist/v20.18.0/node-v20.18.0.pkg)**
2. Nhấp đúp vào file `.pkg` vừa tải trong thư mục **Downloads**.
3. Bấm **Tiếp tục (Continue)** ➔ Nhập mật khẩu máy Mac của bạn khi được hỏi ➔ Bấm **Cài đặt**.

---

### 🔹 Bước 2: Tải mã nguồn ứng dụng
1. Bấm nút màu xanh **`Code`** trên trang GitHub ➔ chọn **`Download ZIP`**.
2. Nhấp đúp vào file `.zip` vừa tải để giải nén thành thư mục `fm-workspace-main`.

---

### 🔹 Bước 3: Khởi chạy 1-Click trên macOS
1. Mở ứng dụng **Terminal** trên máy Mac (Bấm tổ hợp `Cmd + Space`, gõ `Terminal` rồi nhấn Enter).
2. Kéo thư mục `fm-workspace-main` thả thẳng vào cửa sổ Terminal, sau đó gõ:
   ```bash
   chmod +x *.sh && ./install.sh
   ```
   rồi nhấn **Enter**.
3. Quá trình cài đặt sẽ tự động hoàn tất trong 1–2 phút.
4. Để mở ứng dụng bất cứ lúc nào, bạn chỉ cần mở Terminal và gõ:
   ```bash
   ./start.sh
   ```
   Ứng dụng sẽ tự động mở trong trình duyệt Safari hoặc Chrome với giao diện Liquid Glass siêu mượt mà!
5. Khi không dùng nữa, bạn gõ `./stop.sh` để tắt ứng dụng.

---
---

## ❓ Câu Hỏi Thường Gặp & Khắc Phục Sự Cố (FAQ)

### 1. Windows hiện thông báo "Windows protected your PC" (SmartScreen)?
> **Cách xử lý**: Đây là thông báo an toàn thông thường của Windows đối với file kịch bản tự tạo (`.bat`). Bạn chỉ cần:
> 1. Bấm vào dòng chữ nhỏ **More info** (Thông tin khác).
> 2. Bấm vào nút **Run anyway** (Vẫn chạy).

### 2. Dữ liệu của tôi được lưu ở đâu? Có bị mất khi tắt máy không?
> **Trả lời**: Toàn bộ dữ liệu của bạn được lưu **trực tiếp 100% trên ổ cứng máy tính của bạn** (trong bộ nhớ IndexedDB của trình duyệt và file cơ sở dữ liệu `server/data/app.db`).
> - **Không gửi bất kỳ dữ liệu nào lên Internet** (hoàn toàn riêng tư, bảo mật tuyệt đối).
> - Bạn có thể bấm tắt máy, khởi động lại, bật/tắt trình duyệt thoải mái mà dữ liệu vẫn nguyên vẹn 100%.

### 3. Làm thế nào để chuyển toàn bộ dữ liệu sang máy tính khác?
> **Trả lời cực kỳ đơn giản**:
> 1. Trên máy cũ: Vào mục **Cài đặt & Dữ liệu** ➔ Tìm mục **Sao Lưu & Phục Hồi Toàn Diện** ➔ Bấm nút **"Xuất Toàn Bộ (.fmbackup)"**. Bạn sẽ tải về 1 file duy nhất đuôi `.fmbackup`.
> 2. Trên máy mới: Cài đặt app theo hướng dẫn ở trên ➔ Vào **Cài đặt & Dữ liệu** ➔ Bấm **"Nhập Backup (.fmbackup)"** và chọn file backup vừa tải.
> 3. Toàn bộ Links, Tài khoản, Cửa hàng, mọi Ghi chú (kể cả hình ảnh và file đính kèm) sẽ lập tức xuất hiện đầy đủ 100%!

### 4. Máy tính không có kết nối Internet (Offline) có dùng được không?
> **Trả lời**: **CÓ 100%!** Sau khi cài đặt xong lần đầu, ứng dụng hoạt động hoàn toàn độc lập ngoại tuyến (Offline), không cần mạng Internet vẫn mở lên làm việc, tính toán Math Notes và tra cứu tài khoản bình thường.

---

Chúc bạn có những trải nghiệm làm việc thật mượt mà, tiện lợi và an toàn cùng **FM Workspace**! 🌿
