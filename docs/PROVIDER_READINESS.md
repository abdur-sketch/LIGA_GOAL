# Provider Readiness — Phase 18

Status seluruh provider: **candidate only / NOT INTEGRATED**. Tidak ada akun, credential, transaksi, email nyata, domain, project, atau billing yang dibuat.

| Fungsi | Candidate | Sandbox/readiness | Credential | Estimasi | Security/approval |
|---|---|---|---|---|---|
| Payment | Midtrans primary; Xendit alternative | Midtrans sandbox gratis dan terpisah dari production; Xendit Test Mode mendukung mock transaction | server key/test key, webhook secret, merchant/project ID | Fee production wajib quote resmi | Legal entity/KYC, fee, refund/SLA, webhook IP/signature, owner approval |
| Transactional email | Local adapter/Mailpit untuk UAT; Resend candidate staging | Resend menyediakan test recipients untuk delivered/bounce/complaint | scoped API key, verified sender domain, webhook secret | Free/paid tier harus dikonfirmasi | DPA, residency, suppression, DKIM/SPF/DMARC, redacted logs |
| Object storage | Cloudflare R2 atau DigitalOcean Spaces | S3-compatible; perlu bucket staging dan lifecycle test | scoped access key, endpoint, bucket/region | R2 Standard USD 0,015/GB-month plus operations; Spaces estimate Phase 12 USD 5 base | Private default, three buckets, versioning, retention, CORS, separate backup account |
| Hosting/DB | DigitalOcean hybrid/App Platform candidate | Belum dibuat | deploy token, DB roles/certs, secret manager access | Staging USD 74–150+ total planning | Region/DPA, VPC, PITR, spend alert, least privilege |
| Monitoring | Sentry candidate + provider metrics; self-hosted alternative | Belum diuji | DSN, alert webhook/token | Free/paid tier TBD | Enable scrubbers, scrub IP/PII, retention and region approval |
| Domain/DNS | Cloudflare DNS candidate | Belum ada zone | scoped DNS token, registrar access via owner | Domain/plan TBD | DNSSEC, registrar lock, MFA, split staging subdomain, change audit |
| Backup storage | R2/Spaces account or project terpisah | Local encrypted drill PASS; remote NOT TESTED | write-only backup role, restore role separated | Usage based | Immutability, retention, deletion protection, restore sampling |

Official evidence checked 13 October 2026:

- [Midtrans sandbox](https://docs.midtrans.com/docs/testing-payment-on-sandbox) states sandbox transactions are not real payments and use a simulator.
- [Xendit Test Mode](https://docs.xendit.co/docs/testing-xenplatform-features) supports mock transactions, with documented feature differences from live mode.
- [Resend test addresses](https://resend.com/changelog/sending-test-emails) simulate delivered, bounced, and complained events; API calls should use idempotency keys.
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/) lists Standard storage and operation-based billing; using R2 requires an account/subscription, so owner approval is mandatory.
- [Cloudflare DNS setup](https://developers.cloudflare.com/dns/zone-setups/) and [DNSSEC guidance](https://developers.cloudflare.com/dns/zone-setups/subdomain-setup/dnssec/) require controlled zone/DS changes.
- [Sentry organization settings](https://docs.sentry.io/api/organizations/update-an-organization/) expose data scrubbing and IP scrubbing controls that must be enabled/reviewed before sending telemetry.

## Provider acceptance tests

For each selected provider: credential isolation, secret rotation, retry/timeout/circuit behavior, idempotency, signature verification, replay, duplicate/out-of-order event, outage fallback, quota/spend alert, audit log, deletion/export, and contract/DPA review. Payment production activation and real email recipients remain prohibited until a separate owner gate.
