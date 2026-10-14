# BÁO CÁO KIỂM CHỨNG BẢO MẬT ĐỘC LẬP (SECURITY VERIFICATION REPORT)
**Dự án**: FM Workspace  
**Giai đoạn**: Post-Remediation Verification Gate (Kiểm chứng độc lập sau sửa lỗi P0)  
**Thời gian thực hiện**: 2026-10-14  
**Trạng thái kiểm tra**: **PASS (ĐẠT YÊU CẦU BẢO MẬT P0)**

---

## 1. Trạng thái Repository & Kiểm tra Git

- **Branch hiện tại**: `main` (Ahead of `origin/main` by 1 commit).
- **Commit gần nhất**: `14bb2977dd191df4b5da336b5948ac73294e2fdb` (*fix(motion): complete Apple liquid glass animations, modal unmount safety and lightbox stage isolation*).
- **Trạng thái các file P0 vừa sửa**:
  - **Chưa commit** (`Changes not staged for commit`): Toàn bộ mã sửa P0 đang nằm an toàn ở Working Directory, sẵn sàng để review và commit nguyên khối (atomic commit).
  - **Danh sách file đã sửa**:
    - `server/src/routes/sync.ts` (Modified)
    - `server/src/routes/ai.ts` (Modified)
    - `server/src/routes/notifications.ts` (Modified)
    - `client/src/services/backupService.ts` (Modified)
    - `server/package.json` (Modified)
    - `server/src/__tests__/security-access-control.test.ts` (Untracked - New test suite)
- **Cam kết thực thi**: Không có bất kỳ thay đổi nào bị ghi đè hay mất mát; không có hành động deploy production.

---

## 2. Audit độc lập các Endpoint Bảo mật (Code-Level Verification)

Đối chiếu trực tiếp mã nguồn của 4 file core:

### 2.1. Router Sao lưu (`server/src/routes/sync.ts`)
| Endpoint | Phương thức | Middleware áp dụng | Cơ chế trích xuất User Identity | Đánh giá & Bằng chứng mã nguồn |
| :--- | :---: | :--- | :--- | :--- |
| Toàn bộ router `/api/sync` | ALL | `fastify.addHook('preHandler', verifyToken)` | JWT payload (`request.user.id`) | **Verified**: Đã loại bỏ hoàn toàn `optionalAuth`. Mọi request không token hoặc token hỏng đều bị chặn ở cấp 401. [sync.ts:28-29](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/sync.ts#L28-L29) |
| `/api/sync/backup` | `POST` | Kế thừa `verifyToken` | Bắt buộc `request.user?.id` (Không fallback) | **Verified**: Bỏ fallback `default_user`. Ngăn chặn spoofing: `userId` lưu vào SQLite và Disk Vault lấy từ danh tính server xác thực, bỏ qua hoàn toàn `userId` gửi trong body. [sync.ts:53-60](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/sync.ts#L53-L60) |
| `/api/sync/latest` | `GET` | Kế thừa `verifyToken` | `WHERE user_id = request.user.id` | **Verified**: Bỏ fallback `default_user`. Chỉ lấy backup thuộc sở hữu của chính user gọi API. [sync.ts:137-147](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/sync.ts#L137-L147) |
| `/api/sync/history` | `GET` | Kế thừa `verifyToken` | `WHERE user_id = request.user.id` | **Verified**: Giới hạn nghiêm ngặt theo `request.user.id`. [sync.ts:201-210](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/sync.ts#L201-L210) |
| `/api/sync/download/:id` | `GET` | Kế thừa `verifyToken` | `WHERE id = ? AND (user_id = ? OR ? = 'admin')` | **Verified**: Chống IDOR triệt để. User A gọi ID backup của User B sẽ nhận `404 Not Found`. [sync.ts:244-255](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/sync.ts#L244-L255) |

---

### 2.2. Router Trí tuệ Nhân tạo (`server/src/routes/ai.ts`)
| Endpoint | Phương thức | Middleware áp dụng | Rate Limiting | Đánh giá & Bằng chứng mã nguồn |
| :--- | :---: | :--- | :--- | :--- |
| `/api/ai/writing-tool` | `POST` | `preHandler: verifyToken` | `max: 30`, `timeWindow: '1 minute'` | **Verified**: Bắt buộc đăng nhập. Thêm rate limit 30 req/phút ngăn chặn hành vi brute-force hoặc cạn kiệt quota Gemini. [ai.ts:11-24](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/ai.ts#L11-L24) |
| `/api/ai/verify-key` | `POST` | `preHandler: verifyToken` | `max: 10`, `timeWindow: '1 minute'` | **Verified**: Bắt buộc đăng nhập. Giới hạn 10 req/phút ngăn lạm dụng kiểm tra key nặc danh. [ai.ts:112-126](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/ai.ts#L112-L126) |
| `/api/ai/chat` | `POST` | `preHandler: verifyToken` | Kế thừa global rate-limit (200 req/min) | **Verified**: Bảo lưu kiểm tra quyền sở hữu cuộc trò chuyện (`existingConv.user_id === request.user.id`). [ai.ts:140-155](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/ai.ts#L140-L155) |

---

### 2.3. Router Thông báo & Gửi Mail (`server/src/routes/notifications.ts`)
| Endpoint | Phương thức | Middleware áp dụng | Quyền hạn (Role) | Đánh giá & Bằng chứng mã nguồn |
| :--- | :---: | :--- | :--- | :--- |
| `/api/notifications/smtp-config` | `POST` | `preHandler: requireRole('admin')` | **Chỉ Admin** | **Verified**: Loại bỏ `optionalAuth`. User thường nhận `403 Forbidden`, nặc danh nhận `401 Unauthorized`. [notifications.ts:98](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/notifications.ts#L98) |
| `/api/notifications/smtp-disconnect` | `POST` | `preHandler: requireRole('admin')` | **Chỉ Admin** | **Verified**: Chỉ tài khoản quản trị mới có quyền ngắt kết nối cấu hình SMTP hệ thống. [notifications.ts:179](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/notifications.ts#L179) |
| `/api/notifications/test-email` | `POST` | `preHandler: requireRole('admin')` | **Chỉ Admin** (`max: 5 / min`) | **Verified**: Ngăn chặn kẻ xấu dùng server làm công cụ phát tán thư rác; rate limit chặt 5 lần/phút. [notifications.ts:569-583](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/notifications.ts#L569-L583) |
| `/api/notifications/send-reminder-email` | `POST` | `preHandler: verifyToken` | Authenticated User (`max: 20 / min`) | **Verified**: Yêu cầu đăng nhập, giới hạn 20 email nhắc việc/phút. [notifications.ts:196-210](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/notifications.ts#L196-L210) |
| `/api/notifications/smtp-status` | `GET` | `preHandler: verifyToken` | Authenticated User | **Verified**: Yêu cầu đăng nhập, che mờ địa chỉ email (`maskedUser`). [notifications.ts:80-86](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/notifications.ts#L80-L86) |

---

## 3. Kiểm tra An toàn Backup & Bảo vệ Dữ liệu Nhạy cảm (Client & Server)

Đối chiếu chi tiết [backupService.ts](file:///d:/trợ%20lý%20thu%20mua/client/src/services/backupService.ts):
1. **Lọc bỏ Mật khẩu dạng rõ trong Tác vụ Nền (Background Backup)**:
   - Tại `generateBackupPayload()`, đối tượng `accounts` được xử lý tách riêng trường `password` trước khi đưa vào JSON payload:
     ```typescript
     const sanitizedAccounts = accounts.map((acc) => {
       const { password, ...safeAcc } = acc;
       return safeAcc as AccountItem;
     });
     ```
   - **Bằng chứng**: [backupService.ts:574-583](file:///d:/trợ%20lý%20thu%20mua/client/src/services/backupService.ts#L574-L583).
   - **Kết luận**: Gói tin tự động đẩy lên server `/api/sync/backup` hoàn toàn **không chứa plaintext passwords** của các tài khoản công việc.
2. **Khôi phục an toàn (Safe Restore & Merge Logic)**:
   - Khi khôi phục từ bản backup của server (nơi trường `password` đã được lược bỏ):
     ```typescript
     const restoredPassword = acc.password !== undefined && acc.password !== null && acc.password !== '' 
       ? acc.password 
       : dup.password;
     await idbPut<AccountItem>(STORES.ACCOUNTS, { ...acc, password: restoredPassword, id: dup.id, updatedAt: now });
     ```
   - **Bằng chứng**: [backupService.ts:400-410](file:///d:/trợ%20lý%20thu%20mua/client/src/services/backupService.ts#L400-L410).
   - **Kết luận**: Mật khẩu cục bộ lưu trong IndexedDB của người dùng **không bị xóa hoặc ghi đè rỗng** khi đồng bộ tải về từ server.
3. **Tính tương thích của Bản sao lưu Cũ & Xuất file thủ công**:
   - Khi người dùng chủ động tải về file sao lưu `.fmbackup`, họ vẫn có thể nhập Passphrase để mã hóa toàn bộ dữ liệu bằng thuật toán quân sự **AES-GCM-256 + PBKDF2** ([backupService.ts:186-192](file:///d:/trợ%20lý%20thu%20mua/client/src/services/backupService.ts#L186-L192)).
   - Các file sao lưu cũ vẫn giải mã và import bình thường với đầy đủ cơ chế lọc mã độc HTML (`sanitizeNoteHTML`).

---

## 4. Đánh giá Độ tin cậy của Bộ Test (Test Suite Audit)

Đã kiểm tra cấu trúc mã nguồn tệp [server/src/__tests__/security-access-control.test.ts](file:///d:/trợ%20lý%20thu%20mua/server/src/__tests__/security-access-control.test.ts):
- **Tính xác thực (Authentic Execution)**:
  - **Không dùng Mock Handler**: Test sử dụng Fastify instance thật (`fastify()`), load trực tiếp module route nguyên bản (`syncRoutes`, `aiRoutes`, `notificationsRoutes`) và plugin rate limit (`@fastify/rate-limit`).
  - **Chạy chuỗi middleware thật**: Test phát sinh request qua cơ chế `app.inject()`. Request đi qua đúng quy trình xác thực JWT (`jwt.verify()`), kiểm tra user trong SQLite (`SELECT id, is_active FROM users`), thực thi hooks `preHandler` (`verifyToken`, `requireRole`), và các route handlers thực tế.
- **Bao phủ các ca kiểm thử bảo mật (16/16 Passed)**:
  - Nhóm 1: Request nặc danh không token bị từ chối với mã 401 trên mọi endpoint nhạy cảm (1.1, 1.2, 1.3).
  - Nhóm 2: Token giả mạo/sai chữ ký bị từ chối 401 (2.1).
  - Nhóm 3: Cô lập dữ liệu đa người dùng & chống IDOR: User A không thể đọc hoặc tải backup của User B (3.1, 3.2, 3.3, 3.4, 3.5).
  - Nhóm 4: Chống giả mạo danh tính: Gửi payload cố tình chèn `userId` của nạn nhân bị server bỏ qua, server chỉ lấy ID từ JWT token đã xác thực (4.1, 4.2).
  - Nhóm 5: RBAC: User thường gọi endpoint admin bị chặn 403 Forbidden (5.1, 5.2, 5.3).
  - Nhóm 6: AI Protection: Endpoint xử lý AI bắt buộc token xác thực (6.1, 6.2).

### Kết quả chạy lại toàn bộ Test Suite:
```
=== BẮT ĐẦU CHẠY KIỂM THỬ THUẬT TOÁN THU MUA (PROCUREMENT ENGINE TESTS) ===
[PASS] 17/17 tests passed
=== BẮT ĐẦU KIỂM THỬ PIPELINE DỮ LIỆU EXCEL & DATA QUALITY ===
[PASS] 14/14 tests passed
=== RUNNING E2E ISOLATED WORKFLOW INTEGRATION TESTS ===
[PASS] 9/9 tests passed
=== FM WORKSPACE — P0 SECURITY ACCESS-CONTROL TESTS ===
[PASS] 16/16 tests passed
TỔNG CỘNG: 56/56 TESTS PASSED (0 FAILED)
```

### Kết quả Build & Strict Type Check:
- **Server**: `npm --prefix server run build` (`tsup src/index.ts --format esm --clean`) $\rightarrow$ **Thành công (195.73 KB, 0 errors)**.
- **Client**: `npm --prefix client run build` (`tsc && vite build`) $\rightarrow$ **Thành công (8697 modules transformed, 0 type errors)**.

---

## 5. Bảng Danh mục Findings & Đối chiếu Mã nguồn

| Mã số Finding | Phân loại | Mô tả | File & Dòng code bằng chứng | Kết quả kiểm chứng |
| :--- | :---: | :--- | :--- | :---: |
| **SEC-01** | **VERIFIED** | Lỗ hổng Broken Access Control tại `/api/sync` đã được vá triệt để bằng `verifyToken`. | [server/src/routes/sync.ts:28](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/sync.ts#L28) | **RESOLVED** |
| **SEC-02** | **VERIFIED** | Loại bỏ hoàn toàn fallback `userId = 'default_user'`. | [server/src/routes/sync.ts:53](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/sync.ts#L53), [sync.ts:137](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/sync.ts#L137), [sync.ts:201](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/sync.ts#L201), [sync.ts:235](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/sync.ts#L235) | **RESOLVED** |
| **SEC-03** | **VERIFIED** | Ngăn chặn rò rỉ Plaintext Password trong background backup sync. | [client/src/services/backupService.ts:574-583](file:///d:/trợ%20lý%20thu%20mua/client/src/services/backupService.ts#L574-L583) | **RESOLVED** |
| **SEC-04** | **VERIFIED** | Bảo lưu mật khẩu cục bộ khi khôi phục từ bản backup của server. | [client/src/services/backupService.ts:400-410](file:///d:/trợ%20lý%20thu%20mua/client/src/services/backupService.ts#L400-L410) | **RESOLVED** |
| **SEC-05** | **VERIFIED** | Endpoint cấu hình SMTP `/smtp-config`, `/smtp-disconnect` và `/test-email` yêu cầu quyền `admin`. | [server/src/routes/notifications.ts:98](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/notifications.ts#L98), [notifications.ts:179](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/notifications.ts#L179), [notifications.ts:570](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/notifications.ts#L570) | **RESOLVED** |
| **SEC-06** | **VERIFIED** | Endpoint AI `/writing-tool` và `/verify-key` bắt buộc xác thực và áp dụng Rate Limiting. | [server/src/routes/ai.ts:11-24](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/ai.ts#L11-L24), [ai.ts:112-126](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/ai.ts#L112-L126) | **RESOLVED** |

---

## 6. Vấn đề còn tồn tại & Khuyến nghị tiếp theo (Non-blocking for P0)

1. **Client-Side Storage Encryption at Rest (P1 Item)**:
   - *Hiện trạng*: Trong IndexedDB tại trình duyệt của người dùng cá nhân, mật khẩu trong bảng `accounts` vẫn là chuỗi plaintext trên máy cục bộ (mặc dù đã được bảo vệ không gửi qua mạng trong tác vụ nền).
   - *Khuyến nghị*: Triển khai Master PIN để mã hóa AES-GCM các record mật khẩu trước khi ghi vào IndexedDB.
2. **Multi-tenancy Database Schema cho Danh mục Mua hàng (P2 Item)**:
   - *Hiện trạng*: Các bảng SQLite nghiệp vụ (`products`, `suppliers`, `stores`) hiện tại hoạt động theo mô hình single-tenant chia sẻ cho mọi user đăng nhập vào hệ thống.
   - *Khuyến nghị*: Bổ sung cột `organization_id` nếu hệ thống mở rộng phục vụ nhiều doanh nghiệp/tổ chức độc lập cùng chia sẻ một backend instance.

---

## 7. Đánh giá Mức độ Sẵn sàng Triển khai (Deploy Readiness Assessment)

- **Trạng thái**: **READY FOR ATOMIC COMMIT & STAGING DEPLOYMENT**
- **Độ tin cậy của mã nguồn**: Cao. Tất cả thay đổi đều tuân thủ nguyên tắc thay đổi tối thiểu (minimal diff), không làm thay đổi database schema của ứng dụng, không phá vỡ UI/UX hiện có, và 100% test suite tự động vượt qua.
- **Khuyến nghị bước kế tiếp**: Tiến hành stage các file đã chỉnh sửa và commit với thông điệp:
  `fix(security): remediate P0 access control, enforce strict backup ownership and protect secrets from network exposure`.
