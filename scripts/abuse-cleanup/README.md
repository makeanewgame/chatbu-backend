# Signup-abuse cleanup (2026-09)

Bots registered en masse with the display **name** set to spam / phishing copy
(`✨Claim 70K Lira ... https://bit.ly/xxxx ✨`) so the activation email — which
greets the recipient by name — would deliver that payload to an arbitrary `to:`
address. This bloats `User`/`Team` and burns our SES sender reputation.

Code-side prevention shipped alongside this (name content validation +
per-IP throttle on `/auth/register`, `/auth/lost-password`,
`/auth/resend-verification-by-email` + disposable-email domain block). These
scripts clean up the rows already created.

## How to run

```bash
# 1. Port-forward prod Postgres (separate terminal)
./scripts/port-forward-k8s-postgres.sh postgresql chatbu-postgres-rw 15432

# 2. Get the connection string (host swapped to localhost:15432)
./scripts/sync-k8s-env.sh chatbu backend-secrets .env.k8s.local
DB_URL=$(grep '^DATABASE_URL=' .env.k8s.local | cut -d= -f2- \
  | sed -E 's#@[^/]+/#@localhost:15432/#')

# 3. ALWAYS run the diagnosis first and eyeball the output
psql "$DB_URL" -f scripts/abuse-cleanup/01-diagnose.sql

# 4. Reversible: block the matched accounts (safe, instant)
psql "$DB_URL" -f scripts/abuse-cleanup/02-block.sql

# 5. Destructive: back up + delete. Review 01 output first.
psql "$DB_URL" -f scripts/abuse-cleanup/03-delete.sql
```

## Detection predicate

A row is considered abuse only when **all** of:
- `emailVerified = false`
- `role = 'USER'`
- no `ACTIVE` / `TRIALING` / `PAST_DUE` subscription
- owns no non-deleted bot
- their owned team has no *other* active member

…**and at least one** of these name signals fires:
- contains a URL / short-link / messenger handle
- contains a run of 5+ digits
- contains no letter in any script
- contains an ASCII control character (newline, etc.)
- contains a promo emoji (`✨ 🎁 💰 🔥 🎉 👉 ⭐ 💵 🤑`)

Tune the pattern in `_spam_users` (defined identically in all three files)
after reading the diagnosis.
