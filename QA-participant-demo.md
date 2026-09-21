# Participant demo QA

## Scope and safety

Reserved code: `GRACEDEMO`. Uses the existing church participant flow, not the individual survey. The demo is not a database wave and needs no login or payment. Existing Grace history remains closed. Demo completion clears component state without sending answers; the server also rejects direct demo submissions before storage access.

## Signoff inventory

- Code entry and direct demo URL open the Grace participant introduction.
- All 63 instrument items, pre/post maturity questions, change question, demographics and optional comments use the existing components.
- Persistent demo notice remains visible; no production privacy/submission claims are shown at demo introduction or completion.
- Finish demo reaches the completion screen without a response request; restart clears all answers.
- Back navigation retains answers while completing the survey; refreshing discards them.
- Desktop and 375px mobile introduction, question, comment and completion remain readable without horizontal overflow.
- Off-path: lowercase code works; unknown and closed codes retain their entry restrictions.
- Server tests reject direct demo submission without any storage calls.
- Normal live survey rendering/submission remains unchanged.

## Verification

- TypeScript check and production build passed September 21, 2026. Existing build warnings remain (chunk size, PostCSS and CommonJS import.meta); no build errors.
- Isolated HTTP tests passed: demo metadata, case/whitespace handling, direct-submit rejection, zero demo storage calls, and closed/unpaid/unknown/live entry restrictions.
- Browser completed every demo step (63 statements and nine demographic screens) including optional comment. No response request and no runtime errors. Back retained the selected item; restart and refresh cleared answers.
- Code-field entry and lowercase direct URL passed. Desktop introduction and 375px mobile question, comment and completion screenshots inspected. No horizontal overflow.
- A second complete browser run used a mocked ordinary church wave and intercepted submission. It retained the normal button, no demo banner, a 63-item/nine-demographic payload, and normal Thank you screen. No real survey response was created.
- Production release verification is recorded in the Project deployment wiki and handoff.
