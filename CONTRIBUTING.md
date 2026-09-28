# Hướng Dẫn Đóng Góp (Contributing Guide)

Cảm ơn bạn đã quan tâm và đóng góp cho dự án **FM Workspace (Farmers Market)**!

## Quy trình đóng góp mã nguồn
1. **Fork** repository về tài khoản GitHub của bạn.
2. Tạo một branch mới cho tính năng hoặc bản sửa lỗi:
   ```bash
   git checkout -b feature/ten-tinh-nang
   ```
3. Cài đặt môi trường và kiểm tra mã nguồn:
   ```bash
   npm run setup
   npm --prefix server run test
   npm --prefix client run lint
   ```
4. Thực hiện thay đổi, tuân thủ nguyên tắc:
   - Thiết kế giao diện tuân theo ngôn ngữ **Apple Liquid Glass (Glassmorphism)**.
   - Luôn sử dụng Parameterized Queries khi truy vấn cơ sở dữ liệu.
   - Không commit thông tin nhạy cảm (API Keys, email cá nhân, mật khẩu).
5. Tạo commit với thông điệp rõ ràng theo chuẩn Conventional Commits:
   ```bash
   git commit -m "feat(procurement): add incoming po stock calculation"
   ```
6. Push lên remote branch và tạo **Pull Request (PR)** vào nhánh `main`.
