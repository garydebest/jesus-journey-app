# Database certificate verification plan - October 10, 2026

Gary Best Consulting. Gary confirmed production DATABASE_URL hostname aws-0-us-west-1.pooler.supabase.com, port 6543, database postgres and no URL options. No username, password or full URL recorded here. Available storage.ts source chooses ssl.rejectUnauthorized=false when sslmode is absent. Certificate-verification hardening is therefore required for that source path, but no production patch is made in this batch.

First test: one PostgreSQL SSLRequest and a strict Node TLS handshake to the confirmed endpoint. No authentication, password, startup database message or SQL is sent. Require trusted certificate chain and matching hostname; never retry with verification disabled. Record public certificate metadata or a bounded failure code/message.

The runner uses Node 22 default trust. A pass does not establish Render's installed Node/trust configuration, its environment overrides, or an authenticated application connection. A failure does not automatically mean the certificate is invalid; network reachability or a missing trusted CA may be responsible. Review evidence before configuring an approved CA or preparing the exact connection patch. Production NODE_TLS_REJECT_UNAUTHORIZED and custom-CA settings remain unconfirmed.

No merge, deployment, credential change, SSL-enforcement setting or database reboot. Result pending. This repository record does not update the separate project wiki.

## Result and prepared change (October 10, 2026)

The first probe failed under Node default trust (SELF_SIGNED_CERT_IN_CHAIN). Gary then supplied the official Supabase CA from the dashboard (prod-ca-2021.crt, CN=Supabase Root 2021 CA, expires 2031-04-26, SHA-256 80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA). Strict chain and hostname verification passed on ports 6543 and 5432 using that CA, with no login or SQL sent.

Prepared on this branch only: server/database-ssl.ts makes the pool verify Supabase hosts (*.supabase.com / *.supabase.co) against the bundled CA (server/supabase-ca.ts) with rejectUnauthorized true and hostname checks. URLs with an explicit sslmode and non-Supabase hosts keep previous behaviour. script/database-ssl-qa.ts covers configuration choices, pg rejection of untrusted chains and wrong hostnames, and (with LIVE_PROBE=1) a live no-login handshake. Not merged or deployed; no Render or Supabase settings changed. Before deploy, confirm Render does not set NODE_TLS_REJECT_UNAUTHORIZED or a sslmode-bearing DATABASE_URL override.
