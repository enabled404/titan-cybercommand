# Security Policy & Responsible Vulnerability Disclosure

Titan Cyber Command is committed to ensuring the security, integrity, and privacy of our software, users, and the open-source community.

---

## 1. Reporting a Vulnerability

If you discover a security vulnerability within Titan Cyber Command, please report it responsibly. We appreciate your efforts to responsibly disclose findings before public release.

### How to Report:
* **Email**: Send details of the vulnerability to `security@enabled404.dev` or open a confidential security advisory directly on GitHub at [GitHub Security Advisories](https://github.com/enabled404/titan-cybercommand/security/advisories/new).
* **PGP Key**: If reporting sensitive exploit data, please request our PGP public key prior to transmission.

Please include:
1. Detailed description of the vulnerability and its potential impact.
2. Step-by-step reproduction instructions or proof-of-concept (PoC).
3. Any suggested remediation steps or patches.

We strive to acknowledge receipt of all vulnerability reports within **48 hours** and provide regular progress updates as we investigate and remediate the issue.

---

## 2. Safe Harbor & Research Protections

We consider security research conducted under this policy to be:
* **Authorized**: Conducted with our explicit authorization concerning any applicable anti-hacking laws (such as the Computer Fraud and Abuse Act (CFAA), 18 U.S.C. § 1030).
* **Exempt from Legal Action**: We will not initiate or pursue legal action against security researchers for accidental or good-faith violations of this policy.
* **Lawful**: Conducted in good faith to enhance internet security.

### Researcher Guidelines:
* Do not access, modify, or delete user data that does not belong to you.
* Do not execute denial of service (DoS) attacks against our infrastructure or upstream data providers.
* Do not perform social engineering, phishing, or physical attacks against maintainers or contributors.
* Provide us reasonable time to resolve the issue before public disclosure.

---

## 3. Scope

### In-Scope:
* The core Titan Cyber Command web application repository (`enabled404/titan-cybercommand`).
* Client-side audio engines, canvas ballistic engines, and client-side simulation modules.
* Server-side API endpoints (`/api/mcp`, `/api/check`, `/api/snapshot`, `/api/brief`, `/api/cron/*`).

### Out-of-Scope:
* Third-party data providers and upstream APIs (CISA, NVD, FIRST, Georgia Tech IODA, SEC EDGAR, Cloudflare DNS).
* Attacks requiring physical access to an unlocked device.
* Missing security headers that do not lead to direct exploitable vulnerabilities.

---

## 4. Software Dependencies & Upstream Vulnerabilities

Titan Cyber Command automates vulnerability auditing for open-source software via OSV and CISA KEV feeds. If you discover a vulnerability in an underlying library or dependency (e.g. Next.js, Mapbox GL, React), please report it directly to the respective upstream maintainers.
