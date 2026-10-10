# Database certificate verification plan - October 10, 2026

Gary Best Consulting. Gary confirmed production DATABASE_URL hostname aws-0-us-west-1.pooler.supabase.com, port 6543, database postgres and no URL options. No username, password or full URL recorded here. Available storage.ts source chooses ssl.rejectUnauthorized=false when sslmode is absent. Certificate-verification hardening is therefore required for that source path, but no production patch is made in this batch.

First test: one PostgreSQL SSLRequest and a strict Node TLS handshake to the confirmed endpoint. No authentication, password, startup database message or SQL is sent. Require trusted certificate chain and matching hostname; never retry with verification disabled. Record public certificate metadata or a bounded failure code/message.

The runner uses Node 22 default trust. A pass does not establish Render's installed Node/trust configuration, its environment overrides, or an authenticated application connection. A failure does not automatically mean the certificate is invalid; network reachability or a missing trusted CA may be responsible. Review evidence before configuring an approved CA or preparing the exact connection patch. Production NODE_TLS_REJECT_UNAUTHORIZED and custom-CA settings remain unconfirmed.

No merge, deployment, credential change, SSL-enforcement setting or database reboot. Result pending. This repository record does not update the separate project wiki.
