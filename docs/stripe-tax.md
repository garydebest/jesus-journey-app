# Stripe Tax (GST/HST) — live October 6, 2026

- Seller: Gary Best Consulting, Stripe account `acct_1TikIzRrufl7GGLb` ("Gary Best Consulting / Coaching").
- Stripe Tax Basic (pay as you go, 0.5% per taxed transaction). Tax Complete, filing and registration services are NOT enabled.
- Head office: Chilliwack, BC (set in Stripe Tax settings).
- Registration: `taxreg_1UNkJuRrufl7GGLbzjoZRAoy` — Canada, type `standard` (federal GST/HST, normal regime), active from Oct 7 2026 02:51 UTC. No PST/QST/US/UK/EU registrations.
- Seller tax ID: `txi_1UNkJuRrufl7GGLbJMe4c9zL` (ca_gst_hst 704203017RT0001), shown on post-payment invoices.
- Product tax code (per line item only; account default unset): `txcd_20060048` Consulting Services — "The provision of expertise or strategic advice that is presented for consideration and decision-making."

## Checkout
`automatic_tax.enabled=true`, `billing_address_collection=required`, `tax_behavior=exclusive` (tax added on top of the unchanged base price), explicit tax code, `invoice_creation` (0.4% per invoice, max US$2) with the seller tax ID. No shipping address, no Customer objects (customer_email only), no customer_update.
- Payment verification compares `amount_subtotal` + currency with the wave's `price_cents`; a mismatch is logged and not auto-activated.
- Unpaid sessions created before tax (no `automatic_tax.enabled`) are not offered for resume.
- If Stripe cannot calculate tax, checkout is refused (no untaxed fallback).

## Verified (live sessions, no payment, then expired)
CAD 499: BC/AB/QC/MB/SK/YT/NT/NU GST 5% → 523.95; ON HST 13% → 563.87; NS 14% → 568.86; NB/NL/PE 15% → 573.85. USA/UK/Eurozone: tax 0.00 (no registrations there).

## Open
- Quebec QST and provincial PST (BC/SK/MB) on the bundled software component are not configured; needs accountant review.
- No completed real payment has been made through the taxed checkout.

## Rollback
Revert this PR and redeploy on Render. To stop collecting in Stripe, expire the CA registration (`POST /v1/tax/registrations/{id}` with `expires_at=now`).
