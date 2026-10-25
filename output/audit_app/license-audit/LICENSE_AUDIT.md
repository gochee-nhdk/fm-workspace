# License Robustness Audit — `D:\trợ lý thu mua\output\audit_app\electron-unpacked`

_Defensive review of the license/entitlement validation surface. No bypass or keygen is produced — weaknesses are described so they can be fixed._

## 1. Validation surface
License-related logic found in 8 file(s):
- `D:\trợ lý thu mua\output\audit_app\electron-unpacked\app_asar\client\dist\assets\vendor-excel-DLNWaC59.js`
- `D:\trợ lý thu mua\output\audit_app\electron-unpacked\app_asar\client\dist\assets\vendor-excel-style-c2bl9r4f.js`
- `D:\trợ lý thu mua\output\audit_app\electron-unpacked\app_asar\client\dist\assets\vendor-icons-BPcbZ_bO.js`
- `D:\trợ lý thu mua\output\audit_app\electron-unpacked\app_asar\client\dist\assets\vendor-query-BpcW3wda.js`
- `D:\trợ lý thu mua\output\audit_app\electron-unpacked\app_asar\client\dist\assets\vendor-react-DN4eRG7x.js`
- `D:\trợ lý thu mua\output\audit_app\electron-unpacked\app_asar\client\dist\assets\vendor-utils-rcEgvU25.js`
- `D:\trợ lý thu mua\output\audit_app\electron-unpacked\app_asar\electron\dist\main.js`
- `D:\trợ lý thu mua\output\audit_app\electron-unpacked\app_asar\server\dist\index.js`

**Server-side validation signal:** detected (good)

## 2. Weaknesses (abuse-case view)
**By severity:** high: 35

### [HIGH] Client-side validation gate  (35×)
- **Why it's abusable:** A boolean check that lives in the client can be observed and tampered; an attacker forces it true without the real secret.
- **Hardening fix:** Move the authoritative check server-side; the client should only render the server's signed allow/deny decision.
- **Locations:**
  - `D:\trợ lý thu mua\output\audit_app\electron-unpacked\app_asar\client\dist\assets\vendor-query-BpcW3wda.js:17` — `*/var Ne=Mt,Ge=Symbol.for("react.element"),Be=Symbol.for("react.fragment"),Ve=Object.prototype.hasOwnProperty,ze=Ne.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE`
  - `D:\trợ lý thu mua\output\audit_app\electron-unpacked\app_asar\client\dist\assets\vendor-react-DN4eRG7x.js:35` — `Please change the parent <Route path="${f}"> to <Route path="${f==="/"?"*":`${f}/*`}">.`)}let d=Ue(),p;if(t){let f=typeof t=="string"?vn(t):t;A(a==="/"||((C=f.p`
  - `D:\trợ lý thu mua\output\audit_app\electron-unpacked\app_asar\server\dist\index.js:81` — `is_active INTEGER DEFAULT 1,`
  - `D:\trợ lý thu mua\output\audit_app\electron-unpacked\app_asar\server\dist\index.js:108` — `is_active INTEGER DEFAULT 1,`
  - `D:\trợ lý thu mua\output\audit_app\electron-unpacked\app_asar\server\dist\index.js:135` — `is_active INTEGER DEFAULT 1,`
  - `D:\trợ lý thu mua\output\audit_app\electron-unpacked\app_asar\server\dist\index.js:150` — `is_active INTEGER DEFAULT 1,`
  - `D:\trợ lý thu mua\output\audit_app\electron-unpacked\app_asar\server\dist\index.js:591` — `SELECT id, email, role, full_name, is_active FROM users`
  - `D:\trợ lý thu mua\output\audit_app\electron-unpacked\app_asar\server\dist\index.js:592` — `WHERE role = 'admin' AND is_active = 1`
  - … 27 more

## 3. Hardening plan
1. **Authoritative check server-side.** The client shows a decision; it never *makes* it.
2. **Signed, short-lived entitlements.** Server issues an Ed25519/RSA-PSS token (user, features, expiry); client verifies signature and fails closed.
3. **No secrets in the client.** Keep signing keys server-side; rotate on leak.
4. **Bind to account/device server-side** for trial/activation state; local files are cache only.
5. **Tamper-evidence & telemetry.** Log verification failures and anomalies for detection; don't rely on silent client checks.
6. **Fail closed.** Any error in the license path denies access, never grants it.

## 4. Allow/deny test plan
Prove the legitimate path behaves correctly (a generated scaffold is written to `test_license_behavior.py`):
- valid entitlement → access granted
- expired entitlement → denied
- tampered/invalid signature → denied
- missing/malformed license → denied (fail closed)
- server unreachable → denied or documented offline-grace policy
