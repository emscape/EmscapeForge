---
description: Security rules — auto-attached when editing auth, API, or security-sensitive files.
# Verify the correct frontmatter field with Augment docs: glob vs globs vs filePattern
glob: "**/auth/**,**/security/**,**/middleware/**,**/api/**,**/routes/**,**/handlers/**"
---

# Security Rules (Auth / API / Middleware)

You are editing security-sensitive code. These rules apply with full force.

If the best approach is unclear or you are unsure, ask Emily before proceeding.

## OWASP Top 10 — Check All That Apply

- [ ] **Injection**: All queries parameterized — no string concatenation into SQL/NoSQL/shell
- [ ] **Broken auth**: Sessions properly invalidated, tokens have expiry, credentials not exposed
- [ ] **Sensitive data**: No secrets/PII in logs, error messages, or responses to untrusted clients
- [ ] **Access control**: Authorization checked at data layer, not just route layer — IDOR prevented
- [ ] **Security misconfiguration**: Secure defaults, debug mode off in production
- [ ] **XSS**: All user-supplied content escaped before rendering in HTML/JS
- [ ] **Insecure deserialization**: Input validated and typed before use
- [ ] **Vulnerable components**: No known CVEs in dependencies for this code path
- [ ] **Logging**: Security events logged with enough context for investigation
- [ ] **SSRF**: External URLs validated against allowlist before fetching

## Mandatory Practices

- Validate all external inputs at system boundaries (never trust user input)
- No hardcoded secrets, API keys, or credentials — use environment variables
- No secrets committed to git — check `.gitignore` before adding new config files
- Fix insecure code immediately when found — do not defer (CL9)

## Security Fix Protocol

When a vulnerability is found:
1. Stop current work
2. Write a failing security test first (CL6)
3. Fix the vulnerability
4. Verify the test now passes
5. Commit: `security(scope): fix <vulnerability type>`
