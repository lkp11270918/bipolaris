# BiPolaris Privacy Compliance Pack

Last updated: 2026-07-01

This document summarizes the privacy, security, and legal-review work needed
before a public launch. It is an implementation and review checklist, not a
lawyer's legal opinion.

## What Is Now Implemented

- Public privacy policy page: `/privacy`
- Public user agreement page: `/terms`
- Public data security page: `/security`
- Product links from onboarding and settings to those pages
- User data deletion for:
  - mood logs
  - user settings
  - event logs
- First-party analytics with sensitive-key filtering
- Backend privacy audit script:
  - `python -m backend.scripts.privacy_audit`
- Optional admin metrics token:
  - `ADMIN_METRICS_TOKEN`
- Optional application-level field encryption:
  - `DATA_ENCRYPTION_KEY`

## Field-Level Encryption

When `DATA_ENCRYPTION_KEY` is configured in production, the backend encrypts
these fields before database writes:

- mood log notes
- display name
- age range
- diagnosis status
- emergency contact name
- emergency contact phone
- emergency contact relation

Encrypted values are stored with the prefix:

```text
enc:v1:
```

Existing plaintext rows remain readable. New rows are encrypted after the key is
configured.

## Production Environment Requirements

Render backend environment variables:

```text
OPENAI_API_KEY=...
DATABASE_URL=...
ADMIN_METRICS_TOKEN=...
DATA_ENCRYPTION_KEY=...
```

Generate a strong `DATA_ENCRYPTION_KEY` with a password manager or a command
such as:

```bash
openssl rand -base64 32
```

Do not commit `.env` files or secrets to GitHub.

## Analytics Data-Minimization Rules

Analytics events must not store:

- full chat messages
- full assistant replies
- phone numbers
- emergency contact details
- free-text mood notes
- detailed self-harm or harm-to-others plans

Allowed analytics fields include:

- message length
- risk level
- BD state
- RAG hit source and score
- response time
- booleans such as `has_notes` or `has_emergency_contact`
- event counts

## Log Audit

Run:

```bash
.venv/bin/python -m backend.scripts.privacy_audit
```

The audit checks:

- event log properties for forbidden keys
- event log properties for phone/email/ID-like patterns
- interaction logs for unexpected keys
- interaction logs for obvious sensitive identifiers

Known limitation: automated scans do not replace manual review.

## Legal Review Checklist

Before public launch, ask legal counsel to review:

- Privacy policy
- User agreement
- Medical disclaimer language
- Crisis intervention copy
- Data deletion process
- Data retention policy
- Whether the product may be regulated as medical software in target markets
- Whether minors can use the product and what guardian consent is required
- Cross-border data transfer implications if using OpenAI, Vercel, Render, or other vendors
- Whether additional consent is needed for sensitive health-related data

## Clinical/Safety Review Checklist

Ask a psychiatrist, licensed therapist, or clinical safety advisor to review:

- Crisis workflow
- Hotline wording
- Medication-boundary behavior
- Mania/mixed-state guidance
- Badcase reports
- Benchmark coverage
- Whether any reply style could increase dependency or delay professional help

## Remaining Gaps

- No full legal review has been completed yet.
- No clinician sign-off has been completed yet.
- No formal data retention schedule is enforced automatically.
- No role-based admin dashboard access control beyond token-based protection.
- Existing plaintext production rows, if any, need a migration pass after
  `DATA_ENCRYPTION_KEY` is configured.
