# Security Policy
FM Workspace (Farmers Market Procurement Assistant)

## Supported Versions
| Version | Supported          |
| ------- | ------------------ |
| 2.x     | :white_check_mark: |
| < 2.0   | :x:                |

## Security Controls Implemented
1. **Zero Hardcoded Secrets**: Secrets such as `JWT_SECRET` must be set in `.env` in production. The server will fail fast if a default development key is detected in production.
2. **Access Control**: Administrative operations (SMTP credentials, global configuration) are strictly restricted to users with `admin` role.
3. **Data Scoping (Anti-IDOR)**: User-specific data and notification feeds are filtered by `user_id`.
4. **Input Sanitization**:
   - Spreadsheets are sanitized against prototype pollution (`__proto__`, `constructor`, `prototype`).
   - Cell contents are checked against CSV/Excel formula injection (`=, +, -, @`).
5. **Memory Safety**: Temporary file uploads are bounded by TTL and maximum entries to prevent denial of service (DoS).
6. **Password Hashing**: Argon2id password hashing is enforced across all user credentials.

## Reporting a Vulnerability
If you discover a security vulnerability within this repository, please do not open a public issue. Instead, send an email to the repository owner or submit a private security advisory through GitHub.
