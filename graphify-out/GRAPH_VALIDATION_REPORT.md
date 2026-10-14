# BÁO CÁO KIỂM ĐỊNH GRAPHIFY & AUDIT LUỒNG DỮ LIỆU (GRAPH VALIDATION REPORT)
**Dự án**: FM Workspace  
**Vai trò thực hiện**: Senior Software Architect & Application Security Engineer  
**Thời gian hoàn thành**: 2026-10-14  
**Phạm vi**: Kiểm tra kết quả Graphify (`graphify-out/`), đối chiếu mã nguồn thực tế, phân tích kiến trúc hub/chu trình và thẩm định bảo mật hai luồng dữ liệu trọng yếu (Password Vault & QuickNote/IndexedDB) cùng hệ thống API Authorization.

---

## 1. Executive Summary

Báo cáo này đối chiếu kết quả trích xuất tự động từ Graphify (với 921 nodes, 2.096 edges và 51 communities) với mã nguồn TypeScript/React và Fastify/SQLite thực tế của dự án FM Workspace.

### Điểm nổi bật & Kết luận chính:
1. **Kiến trúc dữ liệu Offline-First / Client-Driven**:
   - Dự án ứng dụng kiến trúc kết hợp: Toàn bộ dữ liệu tác nghiệp cá nhân như QuickNotes, To-Do, Workspace Accounts (mật khẩu/tài khoản) và Links được lưu trữ chính tại **IndexedDB phía trình duyệt** (`client/src/services/storage/indexedDb.ts`).
   - Server Fastify đóng vai trò quản lý danh mục dùng chung (nhà cung cấp, sản phẩm, kho hàng, mua hàng) qua SQLite và làm đích đến cho dịch vụ sao lưu (`/api/sync/backup`).
2. **Thực trạng bảo mật Password Vault (Độ lệch nghiêm trọng giữa giả định và mã nguồn)**:
   - **PIN bảo vệ ứng dụng**: Hoàn toàn là cơ chế Client-Side. PIN chỉ dùng để tính mã băm SHA-256 kết hợp muối thiết bị (`deviceSalt`) và lưu trong `localStorage`. **PIN không bao giờ được gửi lên Server**.
   - **Mật khẩu tài khoản (Vault Items)**: Các trường `AccountItem.password` được lưu trữ dưới dạng **PLAINTEXT** trong IndexedDB (`STORES.ACCOUNTS`). Khi cơ chế tự động đồng bộ `autoBackupManager` kích hoạt mà không có mật khẩu mã hóa backup, toàn bộ cơ sở dữ liệu IndexedDB chứa mật khẩu dạng rõ sẽ được gửi qua API `/api/sync/backup` và lưu thành file JSON dạng rõ trên ổ cứng máy chủ.
3. **Lỗ hổng phân quyền API nghiêm trọng (Critical IDOR & Unauthenticated Access)**:
   - Route `server/src/routes/sync.ts` sử dụng `optionalAuth`. Nếu request không có Bearer token, server tự động gán `userId = 'default_user'`. Bất kỳ ai không cần đăng nhập cũng có thể gọi `GET /api/sync/latest` để tải về toàn bộ bản sao lưu của người dùng mặc định (`default_user`), hoặc gọi `POST /api/sync/backup` để ghi đè dữ liệu.
   - Các route như `notifications.ts`, `ai.ts` có tình trạng phân quyền không đồng nhất giữa các endpoint quản trị/cấu hình và endpoint xử lý.
4. **Vấn đề cấu trúc & Phụ thuộc vòng**:
   - Xác nhận chu trình phụ thuộc vòng 3 file: `autoBackupManager.ts` $\rightarrow$ `backupService.ts` $\rightarrow$ `noteService.ts` $\rightarrow$ `autoBackupManager.ts`.
   - File [QuickNoteWindow.tsx](file:///d:/trợ%20lý%20thu%20mua/client/src/components/notes/QuickNoteWindow.tsx) có kích thước khổng lồ (~6.900 dòng), kiêm nhiệm quá nhiều trách nhiệm (UI render, note CRUD, checklist, snipping tool, image lightbox, math solver, attachment processing).

---

## 2. Danh sách Relationships đã xác minh và phân loại

Theo nguyên tắc kiểm định: **Số lượng edges không đồng nghĩa với rủi ro hoặc điểm lỗi**, các cạnh và liên kết được phân loại dựa trên bằng chứng mã nguồn:

| Nguồn (Source Node) | Đích (Target Node) | Loại quan hệ trong Graphify | Phân loại kiểm định | Bằng chứng mã nguồn (File & Dòng) | Ghi chú & Đánh giá |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `LocalLockScreen.tsx` | `security-store.ts` | `imports / calls unlock` | **Verified** | [LocalLockScreen.tsx](file:///d:/trợ%20lý%20thu%20mua/client/src/components/security/LocalLockScreen.tsx#L24-L38) | Gọi `useSecurityStore.getState().unlock(pin)`. |
| `security-store.ts` | `cryptoService.ts` | `imports sha256` | **Verified** | [security-store.ts](file:///d:/trợ%20lý%20thu%20mua/client/src/stores/security-store.ts#L6) | Nhập hàm `sha256` để băm PIN kèm muối thiết bị. |
| `LocalLockScreen.tsx` | `server/src/routes/auth.ts` | `calls /api/auth/pin` | **Incorrect** | [LocalLockScreen.tsx](file:///d:/trợ%20lý%20thu%20mua/client/src/components/security/LocalLockScreen.tsx#L24-L45) | **Graphify suy luận sai**: Không có API PIN nào trên server; PIN được xác thực 100% tại Client. |
| `UnifiedWorkspacePage.tsx` | `dataService.ts` | `calls account operations` | **Verified** | [UnifiedWorkspacePage.tsx](file:///d:/trợ%20lý%20thu%20mua/client/src/features/workspace/UnifiedWorkspacePage.tsx#L38-L45) | Gọi `dataService.getAccounts()`, `createAccount()`, `updateAccount()`. |
| `dataService.ts` | `indexedDb.ts` | `reads/writes STORES.ACCOUNTS` | **Verified** | [dataService.ts](file:///d:/trợ%20lý%20thu%20mua/client/src/services/dataService.ts#L170-L210) | Thao tác trực tiếp với bảng `accounts` trong IndexedDB client. |
| `AccountDrawerForm.tsx` | `cryptoService.ts` | `encrypts password field` | **Incorrect** | [AccountDrawerForm.tsx](file:///d:/trợ%20lý%20thu%20mua/client/src/components/forms/AccountDrawerForm.tsx#L71-L92) | **Giả định sai**: Mật khẩu tài khoản được gửi thẳng vào `dataService` dạng plaintext, không hề qua hàm mã hóa AES-GCM. |
| `QuickNoteWindow.tsx` | `noteService.ts` | `calls note CRUD` | **Verified** | [QuickNoteWindow.tsx](file:///d:/trợ%20lý%20thu%20mua/client/src/components/notes/QuickNoteWindow.tsx#L12) | Gọi các phương thức `saveNote`, `getNotes`, `deleteNote`. |
| `QuickNoteWindow.tsx` | `attachmentService.ts` | `calls attachment handling` | **Verified** | [QuickNoteWindow.tsx](file:///d:/trợ%20lý%20thu%20mua/client/src/components/notes/QuickNoteWindow.tsx#L14) | Gọi `saveAttachment`, `getAttachmentUrl`, `cleanupNoteAttachments`. |
| `attachmentService.ts` | `indexedDb.ts` | `writes Blob into STORES.ATTACHMENTS` | **Verified** | [attachmentService.ts](file:///d:/trợ%20lý%20thu%20mua/client/src/services/attachmentService.ts#L52-L95) | Quản lý bảng `attachments`, chuyển file thành Blob và tạo URL tạm thời via `URL.createObjectURL()`. |
| `autoBackupManager.ts` | `backupService.ts` | `calls generateBackupPayload` | **Verified** | [autoBackupManager.ts](file:///d:/trợ%20lý%20thu%20mua/client/src/services/autoBackupManager.ts#L5) | Gọi hàm tạo payload sao lưu định kỳ. |
| `backupService.ts` | `noteService.ts` | `imports / queries notes` | **Verified** | [backupService.ts](file:///d:/trợ%20lý%20thu%20mua/client/src/services/backupService.ts#L7) | Đọc ghi chú từ `noteService` để gom vào bản backup. |
| `noteService.ts` | `autoBackupManager.ts` | `triggers notifyNoteChange` | **Verified** | [noteService.ts](file:///d:/trợ%20lý%20thu%20mua/client/src/services/noteService.ts#L6) | Báo hiệu có thay đổi dữ liệu ghi chú để đặt lịch backup. **Tạo ra Circular Dependency 3 file**. |
| `backupService.ts` | `/api/sync/backup` | `POST payload` | **Verified** | [backupService.ts](file:///d:/trợ%20lý%20thu%20mua/client/src/services/backupService.ts#L142-L170) | Gửi gói tin backup lên máy chủ qua HTTP POST. |
| `server/src/index.ts` | `server/src/routes/sync.ts` | `registers route` | **Verified** | [index.ts](file:///d:/trợ%20lý%20thu%20mua/server/src/index.ts#L225) | Đăng ký route đồng bộ sao lưu với prefix `/api/sync`. |
| `server/src/routes/sync.ts` | `verifyToken` | `preHandler hook` | **Incorrect** | [sync.ts](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/sync.ts#L29) | **Graphify ban đầu ghi nhận là được bảo vệ**: Thực tế file này dùng `optionalAuth`, cho phép truy cập không cần token. |
| `server/src/routes/analytics.ts` | `verifyToken` | `preHandler hook` | **Verified** | [analytics.ts](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/analytics.ts#L10) | Toàn bộ route analytics được bảo vệ bởi `verifyToken`. |
| `server/src/routes/ai.ts` | `optionalAuth` | `preHandler hook` | **Verified** | [ai.ts](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/ai.ts#L29) | Dùng `optionalAuth` cho root, phân mảnh bảo mật giữa chat và writing tool. |
| `getDb()` | Toàn bộ Route Handlers | `invokes database queries` | **Verified** | [database.ts](file:///d:/trợ%20lý%20thu%20mua/server/src/database.ts#L22) | Đóng vai trò Data Access Hub (58 liên kết trong đồ thị). |

---

## 3. Sơ đồ Mermaid cho các luồng dữ liệu bảo mật

### A. Luồng Password Vault & Bảo mật màn hình khóa (Local PIN & Workspace Accounts)

```mermaid
flowchart TD
    subgraph UI_Layer["Giao diện người dùng (React Client)"]
        A["Người dùng nhập PIN"] -->|onChange / onKeyDown| B["LocalLockScreen.tsx"]
        C["Người dùng tạo/sửa Account"] -->|Submit Form| D["AccountDrawerForm.tsx"]
    end

    subgraph Security_Store["Bảo mật Màn hình khóa (Client-side Only)"]
        B -->|unlock(pin)| E["security-store.ts"]
        E -->|Lấy deviceSalt| F["localStorage: 'fm_device_salt_v1'"]
        E -->|sha256(pin + salt)| G["cryptoService.ts (Web Crypto)"]
        G -->|Đối chiếu Hash| H["localStorage: 'fm_local_security_v1'"]
        H -->|Khớp Hash| I["Set isLocked = false (Unlock App)"]
    end

    subgraph Data_Storage["Lưu trữ Tài khoản Workspace (IndexedDB)"]
        D -->|password dạng PLAINTEXT| J["dataService.ts (createAccount / updateAccount)"]
        J -->|Lưu trực tiếp không mã hóa| K["IndexedDB: STORES.ACCOUNTS ('accounts')"]
        J -.->|Bảo vệ log: 'DO NOT log password'| L["Activity Log (Không ghi mật khẩu)"]
    end

    subgraph Sync_and_Leak["Đồng bộ và Nguy cơ rò rỉ mạng"]
        K -->|Đọc toàn bộ bảng accounts| M["autoBackupManager.ts / backupService.ts"]
        M -->|Gói backup dạng JSON chứa plaintext password| N["HTTP POST /api/sync/backup"]
        N -->|optionalAuth: userId = 'default_user'| O["server/src/routes/sync.ts"]
        O -->|Ghi file JSON dạng rõ| P["Ổ cứng Server: server/data/vaults/<userId>/backup_latest.json"]
    end

    style UI_Layer fill:#f0f7ff,stroke:#0284c7
    style Security_Store fill:#ecfdf5,stroke:#10b981
    style Data_Storage fill:#fffbeb,stroke:#f59e0b
    style Sync_and_Leak fill:#fef2f2,stroke:#ef4444
```

---

### B. Luồng QuickNote và IndexedDB (Offline-First Storage & Attachments)

```mermaid
flowchart TD
    subgraph Client_Interaction["Thao tác người dùng trên QuickNote"]
        A1["Tạo/Sửa Note (HTML content, checklist)"] -->|Debounced AutoSave| B1["QuickNoteWindow.tsx"]
        A2["Kéo thả / Dán ảnh / Đính kèm tệp"] -->|File Event| B2["QuickNoteWindow.tsx"]
    end

    subgraph Local_Storage_Services["Xử lý Dữ liệu Cục bộ (Client Services)"]
        B1 -->|saveNote(noteData)| C1["noteService.ts"]
        C1 -->|IDB Transaction: readwrite| D1["IndexedDB: STORES.NOTES ('fm_quick_notes_v2')"]
        
        B2 -->|saveAttachment(file, noteId)| C2["attachmentService.ts"]
        C2 -->|Chuyển File thành Blob| C3["attachmentService: processFile()"]
        C3 -->|IDB Transaction: readwrite| D2["IndexedDB: STORES.ATTACHMENTS ('fm_note_attachments')"]
        
        D2 -->|getAttachmentUrl(id)| E1["URL.createObjectURL(blob)"]
        E1 -->|Lưu vào bộ nhớ đệm URL| E2["objectUrlCache: Map<string, string>"]
        E2 -->|Render thẻ img / download link| B1
    end

    subgraph Circular_Trigger["Vòng kích hoạt chu trình (Circular Cycle)"]
        C1 -->|notifyNoteChange()| F1["autoBackupManager.ts"]
        F1 -->|triggerAutoBackup()| F2["backupService.ts"]
        F2 -->|Lấy danh sách notes: getNotes()| C1
    end

    subgraph Server_Sync_Flow["Đồng bộ lên Server (Network Flow)"]
        F2 -->|generateBackupPayload()| G1["Đóng gói Notes + Settings + Data"]
        G1 -->|Gửi POST không cần đăng nhập hợp lệ| H1["/api/sync/backup (optionalAuth)"]
        H1 -->|Lưu trữ snapshot| I1["Server Disk: backup_latest.json"]
    end

    style Client_Interaction fill:#f0fdf4,stroke:#22c55e
    style Local_Storage_Services fill:#eff6ff,stroke:#3b82f6
    style Circular_Trigger fill:#fdf4ff,stroke:#d946ef
    style Server_Sync_Flow fill:#fff7ed,stroke:#ea580c
```

---

## 4. Bảng Kiểm định API Authorization (API Authorization Audit Table)

Kiểm toán toàn bộ 18 tệp route trong thư mục `server/src/routes/`:

| Tệp Route | Prefix Endpoint | Middleware áp dụng | Token Verification | Quyền truy cập (Authorization) | Nguy cơ Endpoint không xác thực | Bằng chứng mã nguồn |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| [sync.ts](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/sync.ts) | `/api/sync` | `optionalAuth` (Hook cấp router) | **Không bắt buộc** | **Không có phân quyền**: Fallback về `default_user` khi thiếu token. | **CRITICAL**: Bất kỳ ai cũng có thể đọc/ghi đè bản sao lưu hệ thống qua `/backup` và `/latest`. | [sync.ts:29](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/sync.ts#L29), [sync.ts:53](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/sync.ts#L53), [sync.ts:130](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/sync.ts#L130) |
| [notifications.ts](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/notifications.ts) | `/api/notifications` | `optionalAuth` (Hook cấp router) | **Không bắt buộc** | Không phân quyền Role; các hàm cấu hình SMTP dùng chung. | **MEDIUM**: Kẻ tấn công có thể xem thông tin cấu hình máy chủ gửi thư hoặc kích hoạt gửi email nhắc việc. | [notifications.ts:38](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/notifications.ts#L38), [notifications.ts:106](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/notifications.ts#L106) |
| [ai.ts](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/ai.ts) | `/api/ai` | `optionalAuth` (Router) + `verifyToken` (Route con) | **Không đồng nhất**: `/chat` có verify; `/writing-tool` không có verify. | Người dùng chưa đăng nhập vẫn gọi được AI Writing Tool và tính năng tốn token Gemini. | **MEDIUM**: Nguy cơ cạn kiệt hạn ngạch Gemini API từ các request nặc danh. | [ai.ts:29](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/ai.ts#L29), [ai.ts:173](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/ai.ts#L173) |
| [auth.ts](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/auth.ts) | `/api/auth` | Public (`login`, `register`, `refresh`) + `verifyToken` (`/me`, `/logout`) | Chuẩn theo endpoint | Phân quyền đúng vai trò; kiểm tra Bearer token hợp lệ cho endpoint `/me`. | Không (Các endpoint public là bắt buộc cho authentication). | [auth.ts:182](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/auth.ts#L182) |
| [settings.ts](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/settings.ts) | `/api/settings` | `verifyToken` (Hook cấp router) + `requireRole('admin')` | **Bắt buộc** | RBAC rõ ràng: Chỉ `admin` mới được quản lý User và Gemini API Key. | Không | [settings.ts:13](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/settings.ts#L13), [settings.ts:106](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/settings.ts#L106) |
| [audit.ts](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/audit.ts) | `/api/audit-logs` | `verifyToken` + `requireRole('admin', 'manager')` | **Bắt buộc** | RBAC chuẩn: Người dùng thường không thể đọc nhật ký kiểm toán. | Không | [audit.ts:9](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/audit.ts#L9) |
| [analytics.ts](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/analytics.ts) | `/api/analytics` | `verifyToken` (Hook cấp router) | **Bắt buộc** | Xác thực mọi request; mọi role đăng nhập đều truy cập được. | Không | [analytics.ts:10](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/analytics.ts#L10) |
| [dashboard.ts](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/dashboard.ts) | `/api/dashboard` | `verifyToken` (Hook cấp router) | **Bắt buộc** | Xác thực mọi request vào trang chủ. | Không | [dashboard.ts:10](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/dashboard.ts#L10) |
| [inventory.ts](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/inventory.ts) | `/api/inventory` | `verifyToken` (Hook cấp router) | **Bắt buộc** | Đòi hỏi đăng nhập; tuy nhiên truy vấn thiếu cô lập tenant/user. | Không | [inventory.ts:11](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/inventory.ts#L11) |
| [procurement.ts](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/procurement.ts) | `/api/procurement` | `verifyToken` (Hook cấp router) | **Bắt buộc** | Đòi hỏi đăng nhập cho đơn mua hàng. | Không | [procurement.ts:12](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/procurement.ts#L12) |
| [products.ts](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/products.ts) | `/api/products` | `verifyToken` (Hook cấp router) | **Bắt buộc** | Đòi hỏi đăng nhập cho danh mục hàng hóa. | Không | [products.ts:11](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/products.ts#L11) |
| [reports.ts](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/reports.ts) | `/api/reports` | `verifyToken` (Hook cấp router) | **Bắt buộc** | Đòi hỏi đăng nhập cho báo cáo thống kê. | Không | [reports.ts:10](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/reports.ts#L10) |
| [search.ts](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/search.ts) | `/api/search` | `verifyToken` (Hook cấp router) | **Bắt buộc** | Đòi hỏi đăng nhập cho tìm kiếm toàn cục. | Không | [search.ts:10](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/search.ts#L10) |
| [stores.ts](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/stores.ts) | `/api/stores` | `verifyToken` (Hook cấp router) | **Bắt buộc** | Đòi hỏi đăng nhập cho quản lý cửa hàng. | Không | [stores.ts:10](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/stores.ts#L10) |
| [suppliers.ts](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/suppliers.ts) | `/api/suppliers` | `verifyToken` (Hook cấp router) | **Bắt buộc** | Đòi hỏi đăng nhập cho danh mục NCC. | Không | [suppliers.ts:10](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/suppliers.ts#L10) |
| [transfers.ts](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/transfers.ts) | `/api/transfers` | `verifyToken` (Hook cấp router) | **Bắt buộc** | Đòi hỏi đăng nhập cho luân chuyển kho. | Không | [transfers.ts:10](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/transfers.ts#L10) |
| [imports.ts](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/imports.ts) | `/api/imports` | `verifyToken` (Hook cấp router) | **Bắt buộc** | Đòi hỏi đăng nhập khi import file Excel. | Không | [imports.ts:10](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/imports.ts#L10) |
| [knowledge.ts](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/knowledge.ts) | `/api/knowledge` | `verifyToken` (Hook cấp router) | **Bắt buộc** | Đòi hỏi đăng nhập khi quản lý cơ sở tri thức. | Không | [knowledge.ts:10](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/knowledge.ts#L10) |

---

## 5. Bảng Security Findings (Lỗ hổng, Mức độ nghiêm trọng & Hướng khắc phục)

| Mã số | Lỗ hổng & Mô tả | Mức độ | Bằng chứng mã nguồn | Tác động thực tế | Hướng khắc phục khuyến nghị |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **SEC-01** | **Bypass Xác thực & Chiếm quyền Dữ liệu Sao lưu (Broken Access Control)** | **CRITICAL** | [server/src/routes/sync.ts:29](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/sync.ts#L29)<br>[server/src/routes/sync.ts:53](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/sync.ts#L53)<br>[server/src/routes/sync.ts:130](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/sync.ts#L130) | Kẻ tấn công gọi `GET /api/sync/latest` tải về toàn bộ ghi chú, to-do, tài khoản workspace của `default_user` hoặc gọi `POST /api/sync/backup` ghi đè phá hoại mà không cần token. | Thay thế `fastify.addHook('preHandler', optionalAuth)` bằng `verifyToken`. Loại bỏ hoàn toàn fallback `userId = 'default_user'`. |
| **SEC-02** | **Lưu trữ Mật khẩu Dạng rõ (Plaintext Password Storage at Rest)** | **HIGH** | [client/src/services/dataService.ts:170-210](file:///d:/trợ%20lý%20thu%20mua/client/src/services/dataService.ts#L170-L210)<br>[client/src/components/forms/AccountDrawerForm.tsx:71](file:///d:/trợ%20lý%20thu%20mua/client/src/components/forms/AccountDrawerForm.tsx#L71) | Bất kỳ ai mở DevTools (F12) trên trình duyệt, hoặc mã độc extension, có thể đọc sạch mật khẩu trong IndexedDB (`accounts`). Khi backup tự động sync lên server, mật khẩu cũng nằm dạng rõ trên đĩa cứng server. | Sử dụng `cryptoService.encryptData()` với khóa xuất phát từ mật khẩu chủ (Master Password / PBKDF2) trước khi lưu vào `STORES.ACCOUNTS`. |
| **SEC-03** | **Cấu hình SMTP & Gửi Email không xác thực** | **MEDIUM** | [server/src/routes/notifications.ts:38](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/notifications.ts#L38)<br>[server/src/routes/notifications.ts:106](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/notifications.ts#L106) | Sử dụng `optionalAuth` cho các thao tác cấu hình máy chủ thư và gửi email nhắc việc. Người ngoài có thể spam email hoặc thay đổi trạng thái cấu hình. | Đổi hook của `notifications.ts` thành `verifyToken`, các thao tác cấu hình SMTP yêu cầu `requireRole('admin')`. |
| **SEC-04** | **Lạm dụng Tài nguyên Gemini AI nặc danh** | **MEDIUM** | [server/src/routes/ai.ts:29](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/ai.ts#L29)<br>[server/src/routes/ai.ts:173](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/ai.ts#L173) | Endpoint `/writing-tool` không yêu cầu đăng nhập, cho phép người ngoài gửi request để sử dụng hạn ngạch và tiêu tốn chi phí Gemini API của chủ ứng dụng. | Chuyển `verifyToken` lên làm hook toàn cục cho toàn bộ router `ai.ts`. |
| **SEC-05** | **Thiếu cô lập người dùng theo tài nguyên (Multi-tenancy / IDOR)** | **MEDIUM** | [server/src/routes/products.ts:11](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/products.ts#L11)<br>[server/src/routes/stores.ts:10](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/stores.ts#L10) | Toàn bộ các truy vấn SQLite dùng chung cho tất cả các user đã xác thực (mô hình Single-tenant chia sẻ). Mọi user đăng nhập đều có quyền sửa/xóa bất kỳ sản phẩm hoặc cửa hàng nào. | Bổ sung cột `created_by` hoặc `organization_id` vào schema bảng và đưa vào mệnh đề `WHERE` của SQL nếu muốn cô lập dữ liệu theo người dùng. |

---

## 6. Đánh giá Kiến trúc & Kiến nghị Ưu tiên

### 6.1. Đánh giá các Trung tâm Liên kết (Central Hubs)
- **`getDb()` (58 edges)**: **Thực thể thiết yếu (Essential Single-point of Access)**. `getDb()` cung cấp kết nối SQLite `better-sqlite3`. Việc có nhiều edge phản ánh mô hình kiến trúc trực tiếp (Route Handler gọi thẳng Database). Không phải lỗi kiến trúc, nhưng thiếu tầng Repository/DAO khiến việc mock test hoặc chuyển đổi cơ sở dữ liệu gặp khó khăn.
- **`cn()` (50 edges) & `react` (46 edges)**: **Tiện ích phổ quát (Ubiquitous Utilities)**. Đây là các helper ghép class CSS Tailwind (`clsx` + `tailwind-merge`) và thư viện UI. Số lượng cạnh cao là bình thường trong dự án React hiện đại.
- **`QuickNoteWindow.tsx` (38 edges, ~6.900 dòng code)**: **God Component**. Component này gánh vác quá nhiều chức năng không liên quan trực tiếp:
  - Quản lý ghi chú và danh mục.
  - Xử lý đính kèm tệp và quản lý cache Object URL.
  - Công cụ chụp ảnh màn hình (Snipping/Canvas overlay).
  - Trình xem ảnh phóng to (Lightbox).
  - Trình tính toán biểu thức toán học.
  - Xử lý phím tắt và kéo thả vị trí cửa sổ.
- **`dataService.ts` (29 edges)**: **Facade Module hợp lý**. Tập trung hóa việc đọc ghi IndexedDB cho các danh mục Workspace.

### 6.2. Phụ thuộc vòng (Circular Dependencies)
- **Chu trình 3 tệp đã xác minh**:
  `autoBackupManager.ts` $\rightarrow$ `backupService.ts` $\rightarrow$ `noteService.ts` $\rightarrow$ `autoBackupManager.ts`
  - *Cơ chế hình thành*: `autoBackupManager` gọi `backupService` để tạo file backup $\rightarrow$ `backupService` import `noteService` để đọc ghi chú $\rightarrow$ `noteService` import `notifyNoteChange` từ `autoBackupManager` để kích hoạt hẹn giờ backup sau khi lưu.
  - *Giải pháp*: Sử dụng mô hình Event Emitter hoặc Custom Event trên `window` (`window.dispatchEvent(new CustomEvent('fm:data-changed'))`) để phá vỡ liên kết trực tiếp giữa `noteService` và `autoBackupManager`.

### 6.3. Kiến nghị Kiến trúc theo thứ tự ưu tiên (Prioritized Action Plan)

```
[Mức 1: Khẩn cấp - Bảo mật] ────────> [Mức 2: Tái cấu trúc vòng] ────────> [Mức 3: Chia tách Monolith]
1. Khóa chặt /api/sync/backup          1. Loại bỏ circular dependency      1. Tách QuickNoteWindow thành
   và /api/sync/latest                    giữa autoBackup/backup/note         các sub-component chuyên biệt
2. Mã hóa dữ liệu Account Vault        2. Chuẩn hóa Event Emitter          2. Đưa logic Snipping/Lightbox
   trước khi lưu IndexedDB                                                    ra hook/component độc lập
```

1. **Ưu tiên 1 (Ngay lập tức - P0)**: 
   - Thay `optionalAuth` bằng `verifyToken` trong [server/src/routes/sync.ts](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/sync.ts#L29) và [server/src/routes/ai.ts](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/ai.ts#L29).
   - Xóa bỏ định danh mặc định `default_user` để ngăn chặn việc ghi đè hoặc đọc trộm dữ liệu người khác.
2. **Ưu tiên 2 (P1)**: 
   - Mã hóa AES-GCM cho trường `password` trong `AccountItem` trước khi lưu vào IndexedDB.
   - Khi xuất bản backup qua mạng, bắt buộc client phải mã hóa bằng mật khẩu người dùng trước khi gửi lên endpoint `/api/sync/backup`.
3. **Ưu tiên 3 (P2)**: 
   - Phá vỡ chu trình phụ thuộc vòng `autoBackupManager` $\leftrightarrow$ `noteService` bằng cách dùng Event Bus / Native Event.
4. **Ưu tiên 4 (P3)**: 
   - Tách nhỏ [QuickNoteWindow.tsx](file:///d:/trợ%20lý%20thu%20mua/client/src/components/notes/QuickNoteWindow.tsx) thành: `NoteEditor.tsx`, `NoteAttachments.tsx`, `NoteSnippingTool.tsx`, và `NoteLightbox.tsx`.

---

## 7. Danh mục File và Dòng Code làm Bằng chứng (Evidence Index)

Dưới đây là liên kết trực tiếp tới các vị trí mã nguồn chứng minh các phát hiện trong báo cáo:

1. **Xác thực PIN Client-side**:
   - [client/src/components/security/LocalLockScreen.tsx#L24-L38](file:///d:/trợ%20lý%20thu%20mua/client/src/components/security/LocalLockScreen.tsx#L24-L38): Handler `handleUnlock` nhận PIN và gọi store.
   - [client/src/stores/security-store.ts#L65-L89](file:///d:/trợ%20lý%20thu%20mua/client/src/stores/security-store.ts#L65-L89): Hàm `unlock` tính mã băm SHA-256 đối chiếu với `localStorage`.
2. **Lưu trữ Mật khẩu dạng rõ trong IndexedDB**:
   - [client/src/services/dataService.ts#L170-L210](file:///d:/trợ%20lý%20thu%20mua/client/src/services/dataService.ts#L170-L210): Thao tác ghi trực tiếp vào `STORES.ACCOUNTS`.
   - [client/src/components/forms/AccountDrawerForm.tsx#L71-L92](file:///d:/trợ%20lý%20thu%20mua/client/src/components/forms/AccountDrawerForm.tsx#L71-L92): Form lưu trường `password` dạng string thuần.
   - [client/src/services/dataService.ts#L181](file:///d:/trợ%20lý%20thu%20mua/client/src/services/dataService.ts#L181): Chú thích xác nhận không log mật khẩu nhưng dữ liệu trong DB vẫn là dạng rõ.
3. **Lỗ hổng Xác thực Backup Server**:
   - [server/src/routes/sync.ts#L29](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/sync.ts#L29): Khai báo `fastify.addHook('preHandler', optionalAuth)`.
   - [server/src/routes/sync.ts#L53](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/sync.ts#L53): Fallback `const userId = request.user?.id || 'default_user'`.
   - [server/src/routes/sync.ts#L130](file:///d:/trợ%20lý%20thu%20mua/server/src/routes/sync.ts#L130): Endpoint tải backup nặc danh.
4. **Phụ thuộc vòng 3 tệp**:
   - [client/src/services/autoBackupManager.ts#L5](file:///d:/trợ%20lý%20thu%20mua/client/src/services/autoBackupManager.ts#L5): Import `backupService`.
   - [client/src/services/backupService.ts#L7](file:///d:/trợ%20lý%20thu%20mua/client/src/services/backupService.ts#L7): Import `noteService`.
   - [client/src/services/noteService.ts#L6](file:///d:/trợ%20lý%20thu%20mua/client/src/services/noteService.ts#L6): Import `notifyNoteChange` từ `autoBackupManager`.
5. **Cấu hình Bảo vệ Routes Server**:
   - [server/src/index.ts#L208-L230](file:///d:/trợ%20lý%20thu%20mua/server/src/index.ts#L208-L230): Danh sách đăng ký toàn bộ 18 router của hệ thống.
   - [server/src/middleware/auth.ts#L32-L75](file:///d:/trợ%20lý%20thu%20mua/server/src/middleware/auth.ts#L32-L75): Định nghĩa `verifyToken`, `requireRole`, `optionalAuth`.

---

## 8. Những nội dung không thể xác minh và lý do

1. **Dữ liệu thực tế trong môi trường Production/Runtime**:
   - *Lý do*: Theo ràng buộc kiểm toán an toàn (Safety Constraints), việc kiểm tra chỉ được thực hiện thông qua đọc mã nguồn tĩnh (Static Source Code Analysis), không khởi động server thật, không tạo phiên làm việc với database thực tế, và không gọi đến API Gemini thực.
2. **Hành vi bộ nhớ trình duyệt khi lưu Blob URL**:
   - *Lý do*: Mức độ giải phóng bộ nhớ của `URL.revokeObjectURL()` khi đóng tab hoặc tải nhiều tệp ảnh phụ thuộc vào bộ dọn rác (Garbage Collector) của từng engine trình duyệt (Chromium/Gecko/WebKit), không thể đo lường hoàn toàn chỉ qua code review.
3. **Các lỗ hổng tiềm ẩn trong các thư viện phụ thuộc bên thứ ba (Supply-Chain)**:
   - *Lý do*: Không thực hiện lệnh `npm audit` hoặc quét CVE các gói trong `node_modules` để tuân thủ quy tắc không tự ý chạy các công cụ ngoài phạm vi quy định.
