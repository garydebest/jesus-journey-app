# Jesus Journey — Church Dashboard Mockup Extraction

Source files (all in `/home/user/workspace/jj-public-site/`):
- `dashboard.html` (1008 lines)
- `dashboard.css` (900 lines)
- `base.css` (82 lines — resets only, no variables)
- `style.css` (560 lines — shared header/footer/brand/button/design-token styles, skimmed for shared chrome)

Mockup banner text present on the page (not part of real app):
> `MOCKUP PREVIEW — Church dashboard concept, not yet live · Content sourced from original 2017 dashboard drafts`

`.mockup-banner` CSS: `background: var(--color-coral); color: #FFF7F3; text-align: center; font-size: var(--text-xs); font-weight: 600; letter-spacing: 0.02em; padding: var(--space-2) var(--space-4);`

---

## 1. Overall Page Structure

### Header
Markup (`dashboard.html` lines 21–38), class `site-header dash-header`:

```html
<header class="site-header dash-header">
  <div class="wrap">
    <a href="#top" class="brand">
      <img class="brand-logo" src="./assets/logo-mark.png" alt="Jesus Journey logo" width="600" height="275" />
      <span class="brand-name">
        <em class="brand-my">my</em>
        <span class="brand-name-stack">
          <span class="brand-name-main">Jesus&nbsp;Journey</span>
          <small>Survey</small>
        </span>
      </span>
    </a>
    <div class="dash-church-id">
      <span class="dash-church-name">Grace Fellowship Church</span>
      <span class="dash-join-code">Join code: <strong>GRACE2026</strong></span>
    </div>
  </div>
</header>
```

**Logo/brand treatment — "my" prefix ("myJesus Journey"):**
- The "my" is a separate `<em class="brand-my">` element, rendered in **cursive script font** — `font-family: 'Allura', cursive;` (loaded from Google Fonts alongside Fraunces and Source Sans 3).
- `.brand-my` CSS (from `style.css` lines 189–200):
  ```css
  .brand-my {
    font-family: 'Allura', cursive;
    font-weight: 400;
    font-style: normal;
    font-size: 0.85em;
    line-height: 1;
    color: var(--color-text-muted);
    margin-right: 0.05em;
    margin-top: 0.05em;
    transform: rotate(-3deg);
    display: inline-block;
  }
  ```
- So "my" is small, muted-gray, hand-lettered-looking script, rotated -3°, sitting just before the bold "Jesus Journey" wordmark — visually like a signature/flourish rather than a plain text prefix.
- "Jesus Journey" itself (`.brand-name-main`): `font-family: var(--font-body)` (Source Sans 3), `font-weight: 700`, `letter-spacing: -0.01em`, normal text color.
- "Survey" sits below as a `<small>` under the stacked name: `font-family: var(--font-body); font-weight: 500; font-size: 0.62em; color: var(--color-text-muted); letter-spacing: 0.08em; text-transform: uppercase;` — centered under "Jesus Journey".
- `.brand-logo` is a 40px-tall image (`height: 40px; width: auto;`) alongside the text lockup.
- No nav links, no sign-out button, and no user/settings menu appear anywhere in the dashboard header. The dashboard header only contains: (1) the brand lockup, and (2) the church identity block (`.dash-church-id`) showing church name + join code, right-aligned.
- `.dash-church-id` block: `Grace Fellowship Church` (bold, `.dash-church-name`: `font-weight: 600; color: var(--color-text); font-size: var(--text-sm);`) and `Join code: GRACE2026` (`.dash-join-code`: `font-size: var(--text-xs); color: var(--color-text-muted);` with the code itself in `<strong>` colored `var(--color-primary)`, `letter-spacing: 0.03em`).
- Header layout: `.dash-header .wrap { display:flex; align-items:center; justify-content:space-between; gap: var(--space-4); }` — logo left, church ID right.
- Note: there is **no sign-in/sign-out control inside the dashboard itself**. A "Church sign in" button (`btn btn-secondary`) exists only on the marketing `index.html` header, not on the dashboard.

### Footer — logo differs from header (missing "my" prefix)
Markup (`dashboard.html` lines 965–973), class `site-footer`:

```html
<footer class="site-footer">
  <div class="wrap footer-wrap">
    <div class="footer-brand">
      <img src="./assets/logo-mark.png" alt="Jesus Journey logo" width="600" height="275" />
      <span>Jesus Journey Survey</span>
    </div>
    <p class="footer-copy">&copy; 2026 Jesus Journey Group. All Rights Reserved.</p>
  </div>
</footer>
```

- **Confirmed: the footer logo is plain text — it does NOT include the `<em class="brand-my">my</em>` cursive prefix that the header uses.** The footer simply reads "Jesus Journey Survey" in one plain span, no script "my," no stacked/centered "Survey" sub-line treatment, no rotation/flourish styling.
- `.footer-brand` CSS (`style.css` line 497): `display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-4); text-decoration: none; color: var(--color-text);`
- `.footer-brand img` CSS: `height: 28px; width: auto;` (smaller than header's 40px logo).
- Footer background: `.site-footer { border-top: 1px solid var(--color-divider); background: var(--color-surface-offset); }`
- Footer copy line: `.footer-copy` — plain paragraph, `© 2026 Jesus Journey Group. All Rights Reserved.`
- **Action item for React port**: decide whether footer should also get the "my" cursive prefix for brand consistency, or whether the plain-text footer treatment is intentional (simpler footer branding is common practice, but flag the inconsistency to design).

### Main layout
- `<main class="dashboard" id="top">` wraps a single `<div class="wrap dash-wrap">` containing, in order:
  1. Status strip (`.status-strip`) — always visible, summarizes the currently-live survey wave.
  2. Tab nav (`.dash-tabs`, `role="tablist"`).
  3. Six tab panels (`.dash-panel`, `role="tabpanel"`), only one visible at a time via `hidden` attribute + tiny JS tab controller at bottom of file:
     - `#panel-your-surveys` (labeled "Your Surveys", default active)
     - `#panel-prepare`
     - `#panel-collect`
     - `#panel-interpret`
     - `#panel-act`
     - `#panel-resources`
- `.dashboard { padding-block: var(--space-8) var(--space-16); }`
- `.dash-wrap { max-width: var(--content-wide); }` (`--content-wide: 1240px`)
- Tab switching JS (vanilla, end of file) toggles `aria-selected` on tabs and `hidden` on panels — a React port should replace this with client-side tab state but keep the `role="tablist"/"tab"/"tabpanel"` a11y pattern.

### Status strip (always visible above tabs)
```html
<section class="status-strip" aria-label="Current survey wave status">
  <div class="status-item">
    <span class="status-label">Survey</span>
    <span class="status-value">Fall 2026 Survey</span>
  </div>
  <div class="status-item">
    <span class="status-label">Status</span>
    <span class="status-value status-pill status-pill--live">Live &middot; Collecting</span>
  </div>
  <div class="status-item">
    <span class="status-label">Responses</span>
    <span class="status-value">184 <span class="status-muted">of 320 invited</span></span>
  </div>
  <div class="status-item status-item--bar">
    <span class="status-label">Response rate <strong>57%</strong> &middot; target 50%</span>
    <div class="progress-track"><div class="progress-fill" style="width:57%"></div></div>
  </div>
</section>
```
CSS: `.status-strip { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: var(--space-6); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: var(--space-5) var(--space-6); margin-bottom: var(--space-6); box-shadow: var(--shadow-sm); }`
Responsive: 2-col grid ≤900px (bar item spans 2 cols), 1-col ≤640px.

---

## 2. "Your Surveys" Tab — The 3-State Card Design (CRITICAL)

This is `#panel-your-surveys`, the first/default tab. It has a heading + intro paragraph, a "Before you begin" callout, then **exactly one of three mutually-exclusive states** renders depending on where the church is in its survey lifecycle. In the mockup a **state switcher exists purely for preview/demo purposes** (`.mockup-state-switch`, explicitly commented `<!-- MOCKUP-ONLY -->` and `/* Mockup-only state switcher (not part of the real app) */`) — this switcher itself should NOT be ported into the real app; only the three states it toggles between matter.

### Panel head + intro (shared across all states)
```html
<div class="panel-head">
  <h1>Your Surveys</h1>
  <p class="panel-sub">Start a new survey, watch responses come in, and download your reports once you're ready to close.</p>
</div>

<article class="callout-card" style="margin-bottom: var(--space-6);">
  <h3>Before you begin</h3>
  <p>Please carefully read all the guiding materials in the <strong>Prepare</strong>, <strong>Collect</strong>, <strong>Interpret</strong>, and <strong>Act</strong> tabs on this dashboard before launching your survey. They are essential to successfully completing the survey and getting the most out of your results.</p>
</article>
```

Each state is wrapped `<div class="survey-state" data-survey-state="none|live|closed" hidden>` (the active one omits `hidden`). Toggled via JS reading `data-state` on `.mockup-state-btn` buttons.

---

### STATE 1 — "none" (no survey yet / before first purchase)

```html
<div class="survey-state" data-survey-state="none" hidden>
  <div class="panel-grid">
    <article class="info-card" style="grid-column: span 2;">
      <div class="info-card-head">
        <span class="info-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M3 9h6"/></svg>
        </span>
        <h2>Start your survey</h2>
      </div>
      <p>Each survey is a one-time purchase for your church &mdash; there's no subscription. When you're ready, you'll choose a start and end date, set your minimum response goal, and complete checkout before the survey opens.</p>
      <button class="btn btn-primary" type="button">Start a new survey</button>
    </article>
    <article class="info-card">
      <div class="info-card-head">
        <span class="info-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/></svg>
        </span>
        <h2>Not sure where to start?</h2>
      </div>
      <p>The <strong>Prepare</strong> tab walks through how to introduce the survey to your leaders and congregation before you launch.</p>
    </article>
  </div>
</div>
```
- Icon 1: rounded-rect with a plus (rect + `M9 3v18M3 9h6`) — "add/start" glyph.
- Icon 2: circle with clock hands (`M12 8v4l3 2`) — "help/info" glyph.
- Layout: `.panel-grid` (3-col grid, `repeat(3, minmax(0,1fr))`, gap `var(--space-5)`); first card spans 2 columns via inline `style="grid-column: span 2;"`, second card takes remaining 1 column.
- Only button here: **"Start a new survey"** (`btn btn-primary`).
- No progress bar, no metrics, no badge/status pill in this state — it's purely two `.info-card`s.

---

### STATE 2 — "live" (in-progress / collecting responses) — the default/active state in the mockup

```html
<div class="survey-state" data-survey-state="live">
  <div class="panel-grid panel-grid--collect">
    <article class="wave-card">
      <div class="wave-card-head">
        <div>
          <span class="wave-label">Fall 2026 Survey</span>
          <span class="status-pill status-pill--live">Live</span>
        </div>
        <span class="wave-dates">Opened Aug 17 &middot; Closes Sep 14</span>
      </div>

      <div class="wave-metrics">
        <div class="wave-metric">
          <span class="wave-metric-value">184</span>
          <span class="wave-metric-label">Responses</span>
        </div>
        <div class="wave-metric">
          <span class="wave-metric-value">57%</span>
          <span class="wave-metric-label">Response rate</span>
        </div>
        <div class="wave-metric">
          <span class="wave-metric-value">160</span>
          <span class="wave-metric-label">Minimum needed</span>
        </div>
      </div>

      <div class="progress-track progress-track--lg"><div class="progress-fill" style="width:57%"></div></div>
      <p class="wave-hint">You're past the 50% minimum — the survey can be closed whenever you're ready, or left open to reach more of the congregation.</p>

      <div class="subgroup-monitor">
        <h3>Monitor by subgroup</h3>
        <div class="subgroup-bars">
          <div class="subgroup-bar"><span>Women</span><div class="progress-track"><div class="progress-fill" style="width:64%"></div></div><span class="subgroup-pct">64%</span></div>
          <div class="subgroup-bar"><span>Men</span><div class="progress-track"><div class="progress-fill" style="width:49%"></div></div><span class="subgroup-pct">49%</span></div>
          <div class="subgroup-bar"><span>Ages 16–29</span><div class="progress-track"><div class="progress-fill" style="width:38%"></div></div><span class="subgroup-pct">38%</span></div>
          <div class="subgroup-bar"><span>Ages 30–49</span><div class="progress-track"><div class="progress-fill" style="width:61%"></div></div><span class="subgroup-pct">61%</span></div>
          <div class="subgroup-bar"><span>Ages 50+</span><div class="progress-track"><div class="progress-fill" style="width:66%"></div></div><span class="subgroup-pct">66%</span></div>
        </div>
      </div>

      <div class="wave-actions">
        <button class="btn btn-secondary" type="button">Send reminder</button>
        <button class="btn btn-primary" type="button">Close survey &amp; run reports</button>
      </div>
    </article>

    <div class="collect-side">
      <article class="info-card">
        <div class="info-card-head">
          <span class="info-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 6l-10 7L2 6"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg>
          </span>
          <h2>What "Send reminder" does</h2>
        </div>
        <p>Sends a one-time nudge to everyone who has <strong>not yet responded</strong> — a short email/text reminding them the survey is open and takes about 10&ndash;15 minutes. People who already completed it are not contacted.</p>
      </article>

      <article class="info-card">
        <div class="info-card-head">
          <span class="info-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/></svg>
          </span>
          <h2>One survey at a time</h2>
        </div>
        <p>A church can only run one survey at a time. Once this one closes and your reports are ready, you'll see the option to start another whenever you're ready to purchase and launch it again.</p>
      </article>
    </div>
  </div>
</div>
```

**Card class**: `.wave-card` (note the internal/legacy jargon term "wave" still lives in the CSS class names — see Section 4 note on "wave" language).

`.wave-card` CSS: `background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: var(--space-7); box-shadow: var(--shadow-md);`

Header row (`.wave-card-head`): flex, `justify-content: space-between`, wraps on small screens; left side groups label + status pill, right side shows the date range.
- `.wave-label`: `font-family: var(--font-display)` (Fraunces), `font-size: var(--text-lg)`, `font-weight: 600`.
- Status pill here reuses `.status-pill.status-pill--live` (see badge section below) — text is just **"Live"** (shorter than the status-strip's "Live · Collecting").
- `.wave-dates`: `font-size: var(--text-sm); color: var(--color-text-muted);` — "Opened Aug 17 · Closes Sep 14".

Metrics row (`.wave-metrics`): 3-column grid, each `.wave-metric` is a centered stat tile:
- `.wave-metric`: `text-align:center; padding: var(--space-3); background: var(--color-surface-2); border-radius: var(--radius-md);`
- `.wave-metric-value`: `font-family: var(--font-display); font-size: var(--text-xl); font-weight:600; color: var(--color-primary); font-variant-numeric: tabular-nums lining-nums;`
- `.wave-metric-label`: `font-size: var(--text-xs); color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em;`
- Three metrics shown: **184 Responses**, **57% Response rate**, **160 Minimum needed**.

Progress bar: `.progress-track.progress-track--lg` (12px tall vs. the 8px default) containing `.progress-fill` set via inline `style="width:57%"`.
- `.progress-track`: `height: 8px; background: var(--color-surface-offset); border-radius: var(--radius-full); overflow:hidden;`
- `.progress-track--lg`: `height: 12px; margin-block: var(--space-3) var(--space-2);`
- `.progress-fill`: `height:100%; background: linear-gradient(90deg, var(--color-primary), var(--color-primary-hover)); border-radius: var(--radius-full); transition: width 600ms cubic-bezier(0.16,1,0.3,1);`

Hint text below bar (`.wave-hint`): *"You're past the 50% minimum — the survey can be closed whenever you're ready, or left open to reach more of the congregation."* — `font-size: var(--text-sm); color: var(--color-text-muted); margin-bottom: var(--space-5);`

Subgroup monitor (`.subgroup-monitor`):
- Heading `<h3>Monitor by subgroup</h3>`: `font-family: var(--font-body); font-size: var(--text-sm); font-weight:700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text); margin-bottom: var(--space-3);`
- Five rows, each `.subgroup-bar` = 3-column grid `90px 1fr 40px` (label / mini progress-track / percentage):
  - Women — 64%
  - Men — 49%
  - Ages 16–29 — 38%
  - Ages 30–49 — 61%
  - Ages 50+ — 66%
- `.subgroup-pct`: `text-align:right; font-variant-numeric: tabular-nums; color: var(--color-text); font-weight:600;`

Action row (`.wave-actions`, `display:flex; gap: var(--space-3); flex-wrap:wrap;`):
- **"Send reminder"** — `btn btn-secondary`
- **"Close survey & run reports"** — `btn btn-primary`

Side column (`.collect-side`, flex column, `gap: var(--space-4)`) has two supporting `.info-card`s explaining what "Send reminder" does and the one-survey-at-a-time policy (copy quoted above verbatim).

Grid: `.panel-grid--collect { grid-template-columns: 1.4fr 1fr; }` (wave card wider than the side column). Collapses to 1 column ≤900px.

---

### STATE 3 — "closed" (survey just closed, reports ready)

```html
<div class="survey-state" data-survey-state="closed" hidden>
  <div class="panel-grid panel-grid--reports">
    <article class="info-card">
      <div class="info-card-head">
        <span class="info-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/></svg>
        </span>
        <h2>Fall 2026 Survey &mdash; closed</h2>
      </div>
      <p>Closed Sep 14 &middot; 198 responses (62% response rate)</p>
      <div class="wave-actions" style="margin-top: var(--space-4);">
        <button class="btn btn-primary" type="button">Download Church Report (PDF)</button>
        <button class="btn btn-secondary" type="button">Download Comments Report (PDF)</button>
      </div>
    </article>
    <article class="info-card">
      <div class="info-card-head">
        <span class="info-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
        </span>
        <h2>Make sense of your results</h2>
      </div>
      <p>Head to the <strong>Interpret</strong> and <strong>Act</strong> tabs for guidance on reading your report and turning it into next steps with your leaders.</p>
    </article>
  </div>

  <p class="survey-again-note">Ready to run this again? Each survey is a separate purchase — <button class="link-btn" type="button" data-goto-survey-state="none">start a new survey</button> whenever you're ready, even if that's next year.</p>
</div>
```
- No status pill, no progress bar in this state — the "closed" fact is conveyed purely through copy: "Fall 2026 Survey — closed" heading + "Closed Sep 14 · 198 responses (62% response rate)".
- Two buttons stacked in `.wave-actions`: **"Download Church Report (PDF)"** (`btn btn-primary`) and **"Download Comments Report (PDF)"** (`btn btn-secondary`).
- Icon 1: file/document glyph (same folded-corner path used elsewhere for "document" cards). Icon 2: clock/history circle glyph, reused from "Not sure where to start?" in state 1.
- Grid: `.panel-grid--reports { grid-template-columns: repeat(2, minmax(0,1fr)); }` — two equal-width cards. Collapses to 1 col ≤900px.
- Below the grid, a centered note (`.survey-again-note`: `margin-top: var(--space-6); font-size: var(--text-sm); color: var(--color-text-muted); text-align:center;`) with an inline text-styled `.link-btn` — **"start a new survey"** — that (per the JS) jumps back to State 1 ("none").
- `.link-btn` CSS: `font: inherit; font-weight:700; color: var(--color-primary); background:none; border:none; padding:0; cursor:pointer; text-decoration: underline;` hover → `var(--color-primary-hover)`.

### Mockup-only state switcher (do NOT port — reference only)
```html
<div class="mockup-state-switch" role="group" aria-label="Preview a Your Surveys state (mockup only)">
  <span class="mockup-state-label">Preview state:</span>
  <button class="mockup-state-btn" data-state="none" type="button">No survey yet</button>
  <button class="mockup-state-btn is-active" data-state="live" type="button">Survey live</button>
  <button class="mockup-state-btn" data-state="closed" type="button">Just closed</button>
</div>
```
This exists solely so a reviewer can click between the three states in the static mockup; the labels "No survey yet" / "Survey live" / "Just closed" are useful shorthand names for the three states but the switcher UI itself has no equivalent in the real product (in the real app, state is derived from actual survey data, not chosen by the church admin).

---

## 3. Tab Structure — Prepare / Collect / Interpret / Act (+ Your Surveys / Resources)

Full tab bar markup (`dashboard.html` lines 65–84):

```html
<nav class="dash-tabs" role="tablist" aria-label="Dashboard sections">
  <button class="dash-tab" role="tab" data-tab="your-surveys" aria-selected="true">
    <span class="tab-num">&#9733;</span> Your Surveys
  </button>
  <button class="dash-tab" role="tab" data-tab="prepare" aria-selected="false">
    <span class="tab-num">1</span> Prepare
  </button>
  <button class="dash-tab" role="tab" data-tab="collect" aria-selected="false">
    <span class="tab-num">2</span> Collect
  </button>
  <button class="dash-tab" role="tab" data-tab="interpret" aria-selected="false">
    <span class="tab-num">3</span> Interpret
  </button>
  <button class="dash-tab" role="tab" data-tab="act" aria-selected="false">
    <span class="tab-num">4</span> Act
  </button>
  <button class="dash-tab" role="tab" data-tab="resources" aria-selected="false">
    <span class="tab-num">5</span> Resources
  </button>
</nav>
```

**Exact tab labels, in order**: `Your Surveys` · `Prepare` · `Collect` · `Interpret` · `Act` · `Resources`

**"Icons"**: not true icons — each tab has a small circular numbered badge (`.tab-num`) instead of an SVG glyph:
- "Your Surveys" uses a star character `★` (HTML entity `&#9733;`), not a number.
- "Prepare" = `1`, "Collect" = `2`, "Interpret" = `3`, "Act" = `4`, "Resources" = `5`.
- These are plain text/HTML-entity characters inside a styled circle span, not inline SVG — trivial to reproduce in React as `<span className="tab-num">★</span>` or `{index}`.

**Content per tab (high level — full copy in Section 4):**
- **Your Surveys**: the live 3-state console described in Section 2 (start/monitor/close/download).
- **Prepare**: 3 info-cards — "Understanding the Survey" (belief/experience/action framework + expandable full doc), "Step-by-Step to Success" (3-step ordered list + expandable full doc), "Keys to Success" (highlighted card, response-rate stat callout + expandable full doc).
- **Collect**: 3 info-cards — "Starting a survey" (soft launch → full launch → paper option, + expandable full doc), "Monitoring & readiness" (response-rate targeting guidance, two expandable full docs: "Journey Survey Monitoring" and "Running Your Survey Reports"), "Paper survey option" (download button + production note + expandable full doc).
- **Interpret**: 2 `.report-card`s side by side — "Church Report" (tagged "Numbers & graphs") and "Comments Report" (tagged "Open-ended answers"), each with a bullet checklist + expandable full doc; followed by a callout card "Guiding principle: numbers are people."
- **Act**: a 4-step numbered timeline (`.act-timeline`) — "Debriefing preparation" (Day 1), "Debriefing leadership sessions" (Day 2), "Engaging the church" (within 1–2 weeks), "Making a plan" (following weeks) — each with a summary paragraph + expandable full doc.
- **Resources**: a 3-card grid — "Small Group Curriculum", "Graphic Templates", "Sample Message Outline" (the last has an expandable full outline "Becoming Like Jesus"), each with a Download button.

**Active vs. inactive tab visual treatment** (CSS, `dashboard.css` lines 142–192):
```css
.dash-tabs {
  display: flex;
  gap: var(--space-2);
  border-bottom: 1px solid var(--color-border);
  margin-bottom: var(--space-8);
  overflow-x: auto;
  scrollbar-width: none;
}
.dash-tab {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.85rem 1.1rem;
  font-family: var(--font-body);
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-text-muted);
  border-bottom: 2px solid transparent;
  white-space: nowrap;
  flex-shrink: 0;
}
.dash-tab .tab-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 50%;
  background: var(--color-surface-offset);
  color: var(--color-text-faint);
  font-size: var(--text-xs);
  font-weight: 700;
}
.dash-tab:hover { color: var(--color-text); }
.dash-tab[aria-selected="true"] {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}
.dash-tab[aria-selected="true"] .tab-num {
  background: var(--color-primary);
  color: var(--color-text-inverse);
}
```
Summary:
- **Inactive tab**: muted gray text (`--color-text-muted`), transparent 2px bottom border, numbered badge has a light neutral background (`--color-surface-offset`) with faint text (`--color-text-faint`).
- **Hover** (inactive): text darkens to `--color-text`.
- **Active tab** (`aria-selected="true"`): text turns primary teal-green (`--color-primary`), bottom border becomes a solid 2px underline in `--color-primary`; the numbered badge itself inverts to a solid primary-color circle with inverse (near-white) text.
- Tab bar sits on a full-width bottom border (`border-bottom: 1px solid var(--color-border)`), horizontally scrollable with hidden scrollbar on overflow (mobile).
- Panel switch has a subtle fade/slide-up entrance animation: `.dash-panel { animation: panel-in 260ms cubic-bezier(0.16,1,0.3,1); }` with keyframes `from { opacity:0; transform: translateY(6px); } to { opacity:1; transform: translateY(0); }`.

---

## 4. Full Copy Inventory (verbatim, by section)

### Page meta
- `<title>`: "Church Dashboard — Jesus Journey Survey"
- Meta description: "Prepare, Collect, Interpret, Act, and access Resources for your church's Jesus Journey Survey — all in one dashboard."
- Mockup banner: "MOCKUP PREVIEW — Church dashboard concept, not yet live · Content sourced from original 2017 dashboard drafts"

### Header
- Brand: "my" (script) + "Jesus Journey" + "Survey" (small caps sub-line)
- Church name: "Grace Fellowship Church"
- Join code label: "Join code: **GRACE2026**"

### Status strip
- Labels: "Survey", "Status", "Responses", "Response rate **57%** · target 50%"
- Values: "Fall 2026 Survey"; "Live · Collecting" (pill); "184 of 320 invited"

### Tabs
"Your Surveys" (★) · "Prepare" (1) · "Collect" (2) · "Interpret" (3) · "Act" (4) · "Resources" (5)

### Your Surveys tab
- H1: "Your Surveys"
- Subhead: "Start a new survey, watch responses come in, and download your reports once you're ready to close."
- Callout "Before you begin": "Please carefully read all the guiding materials in the **Prepare**, **Collect**, **Interpret**, and **Act** tabs on this dashboard before launching your survey. They are essential to successfully completing the survey and getting the most out of your results."

**State: none**
- "Start your survey" / "Each survey is a one-time purchase for your church — there's no subscription. When you're ready, you'll choose a start and end date, set your minimum response goal, and complete checkout before the survey opens." / Button: "Start a new survey"
- "Not sure where to start?" / "The **Prepare** tab walks through how to introduce the survey to your leaders and congregation before you launch."

**State: live**
- Wave label: "Fall 2026 Survey" · Pill: "Live" · Dates: "Opened Aug 17 · Closes Sep 14"
- Metrics: "184 Responses", "57% Response rate", "160 Minimum needed"
- Hint: "You're past the 50% minimum — the survey can be closed whenever you're ready, or left open to reach more of the congregation."
- Subgroup heading: "Monitor by subgroup" — rows: Women 64%, Men 49%, Ages 16–29 38%, Ages 30–49 61%, Ages 50+ 66%
- Buttons: "Send reminder", "Close survey & run reports"
- "What "Send reminder" does" / "Sends a one-time nudge to everyone who has **not yet responded** — a short email/text reminding them the survey is open and takes about 10–15 minutes. People who already completed it are not contacted."
- "One survey at a time" / "A church can only run one survey at a time. Once this one closes and your reports are ready, you'll see the option to start another whenever you're ready to purchase and launch it again."

**State: closed**
- "Fall 2026 Survey — closed" / "Closed Sep 14 · 198 responses (62% response rate)"
- Buttons: "Download Church Report (PDF)", "Download Comments Report (PDF)"
- "Make sense of your results" / "Head to the **Interpret** and **Act** tabs for guidance on reading your report and turning it into next steps with your leaders."
- Footer note: "Ready to run this again? Each survey is a separate purchase — **start a new survey** whenever you're ready, even if that's next year."

### Prepare tab
- H1: "Prepare"
- Subhead: "Getting ready for the Jesus Journey Survey — the steps that make everything after this easier."

**Card: Understanding the Survey**
- Body: "The survey looks at spiritual growth as a three-stranded cord: **belief, experience, and action** — woven into four Journey Goals, each broken into four pathways."
- Bullets:
  - "Starting conversation is the goal — not final answers. Results catalyze discussion, not solutions."
  - "A snapshot, not a movie: this shows where you are right now. Re-survey in ~2 years to see movement."
  - "No comparisons between churches or individuals — every community is at a different stage."
- Expandable doc "Read the full document: Understanding the Jesus Journey Survey" — full multi-section text on Journey Survey structure, belief/experience/behavior, guiding principles ("Becoming Like Jesus is a Journey," "Starting, not stopping, conversation," "Invitation" incl. Jeremiah 29:11 and Psalm 139:23–24 quotes, "A snapshot, not a movie," "No Comparisons," "The Importance of Community"). Source line: "Source: Prepare — Understanding the Jesus Journey Survey. © 2017 Jesus Journey Group. All Rights Reserved." (Full verbatim text preserved in `dashboard.html` lines 254–314; reproduce in full in the React port's content data file rather than re-typed here to avoid transcription drift — treat `dashboard.html` as the source of truth for this long-form legal/doctrinal text.)

**Card: Step-by-Step to Success**
- Ordered list:
  1. "**Early prep** — leadership reviews the dashboard, prays over your church's needs, picks a survey coordinator."
  2. "**Survey prep** — brief elders/deacons, draft announcements & bulletin text, set a 2-week promotion + 2-week collection schedule."
  3. "**Implementation** — announce 2 weeks out, have leaders take it first, launch Sunday, monitor daily, thank everyone at close."
- Expandable doc "Read the full document: Step-by-Step to Success" — "How Can I Best Prepare for the Jesus Journey Survey?" with sections "Early Preparation Tasks," "Survey Preparation Tasks," "Survey Implementation Tasks." Source: "Source: Prepare — Step-by-Step to Success. © 2017 Jesus Journey Group. All Rights Reserved." (Full text at `dashboard.html` lines 329–386.)

**Card: Keys to Success** (highlighted card — `.info-card--highlight`)
- Stat callout: "**50%+ response** is representative and trustworthy. Below 25% is not reliable enough to act on."
- Bullets:
  - "Lead pastor support before, during, and after — non-negotiable."
  - "Everyone 16+ can take it — reassure people their answers are anonymous."
  - "Takes 10–15 minutes; every respondent gets a private personal report."
  - "Reporting back to the church afterward validates their participation — skipping this undermines future surveys."
- Expandable doc "Read the full document: Keys to Success" — sections "Defining Success," "Promotion," "Taking the Survey," "Keys to Making the Information Useful." Source: "Source: Prepare — Keys to Success. © 2017 Jesus Journey Group. All Rights Reserved." (Full text at `dashboard.html` lines 404–444.)

### Collect tab
- H1: "Collect"
- Subhead: "How to launch, promote, and monitor your survey while it's live. For the live console itself, see the **Your Surveys** tab."

**Card: Starting a survey**
- Ordered list (`step-list--tight`):
  1. "**Soft launch** with leaders one week early."
  2. "**Full launch** with the whole church — announce, promote, share the join code."
  3. "**Paper option** for those without easy device access (see below)."
- Expandable doc "Read the full document: Starting Our Jesus Journey Survey" — "Step 1: Initiate with Leaders," "Step 2: Initiate with the Church," "Step 3: Initiate with Those Who Need a Paper Version." Source: "Source: Collect — Starting Our Jesus Journey Survey. © 2017 Jesus Journey Group. All Rights Reserved." (Full text at `dashboard.html` lines 475–497.)

**Card: Monitoring & readiness**
- Body: "Target a **50% response rate** — the denominator is total people invited, not just those who started. Watch subgroups (gender, age band) for gaps."
- Hint: "Reports unlock once you hit your end date *and* the 50% minimum — whichever comes later."
- Two expandable docs: "Read the full document: Journey Survey Monitoring" (sections "Overall Response Rate Monitoring," "Subgroup Response Monitoring"; source "Source: Collect — Journey Survey Monitoring. © 2017 Jesus Journey Group. All Rights Reserved.") and "Read the full document: Running Your Survey Reports" (sections "How Do You Know You Are Ready?," "Run Your Reports"; source "Source: Collect — Running Your Survey Reports. © 2017 Jesus Journey Group. All Rights Reserved."). Full text at `dashboard.html` lines 512–546.

**Card: Paper survey option**
- Body: "For anyone who finds a screen difficult. Every question must be answered by hand, then entered online by a volunteer — blank answers can't be entered."
- Button: "Download paper survey" (`btn-tertiary`)
- Production note (italicized style via `.report-card-note`): "Production note: this needs a properly formatted, print-ready PDF of the full survey before launch — not just the on-screen question text." — **this is a build/engineering note left in the mockup, flag for the real team, not end-user copy.**
- Expandable doc "Read the full document: Using the Supplemental Paper Survey" — "Why Use a Paper Survey?," "Cautions in the Use of the Paper Survey." Source: "Source: Collect — Using the Supplemental Paper Survey. © 2017 Jesus Journey Group. All Rights Reserved." Full text at `dashboard.html` lines 559–576.

### Interpret tab
- H1: "Interpret"
- Subhead: "Understand your two reports — the Church Report's numbers, and the Comments Report's words."

**Card: Church Report** (tag: "Numbers & graphs")
- Bullets:
  - "**Check sample size first** — relative to church size, before drawing any conclusions."
  - "Remember: numbers are people. Every percentage represents someone on a real journey."
  - "Review the 5 stages of spiritual maturity, then the maturity profile by group."
  - "Compare maturity and spiritual change against demographics — but go carefully when a subgroup's sample size is small."
  - "Examine each of the four Journey Goals — Trusting, Experiencing, Reflecting, and Serving Jesus — through the lens of the maturity stages."
  - "Finish by naming your **three greatest strengths** and **three growth opportunities**."
- Expandable doc "Read the full document: Interpreting Your Church Numerical Report" — "Pay Attention to Sample Size," "Understand Your Percentages," "Numbers Are People," "What to Look for in Numbers," "Differences Between Numbers," "Interpreting Subgroup Numbers." Source: "Source: Interpret — Interpreting Your Church Numerical Report. © 2017 Jesus Journey Group. All Rights Reserved." Full text at `dashboard.html` lines 604–638.

**Card: Comments Report** (tag: "Open-ended answers")
- Bullets:
  - "**Read with prayerful eyes** — resist scanning only for the extremes."
  - "Look for differences by spiritual-maturity stage: what is each group asking for?"
  - "Compare by gender — what themes are distinct to women vs. men?"
  - "Look for recurring key words and phrases across responses."
  - "Watch for generational themes — young adults, parents, and older adults often surface different needs."
- Expandable doc "Read the full document: Interpreting Your Church Comments Report" — "Keep Your Focus on Your People," "Use Prayerful Eyes," "Examine by Differences in Spiritual Maturity," "Examine by Gender," "Examine for Key Words and Phrases," "Examine for Generational Themes." Source: "Source: Interpret — Interpreting Your Church Comments Report. © 2017 Jesus Journey Group. All Rights Reserved." Full text at `dashboard.html` lines 656–676.

**Callout card**: "Guiding principle: numbers are people" — "A score of 3 ("often true of me") on prayer life could be a strong sign of growth for someone new to faith — or a plateau for someone who considers themselves Jesus-centered. Always read a score alongside where that person or group already is on their journey, and never compare your church's numbers to another church's."

### Act tab
- H1: "Act"
- Subhead: "Fostering positive change after the survey — from a first read of the report to a strategic plan."

**Timeline step 1 — "Debriefing preparation"**
- Meta: "Day 1 · Senior pastor + 1–2 key leaders · ~4 hours"
- Body: "Work through the church report page by page right after the survey closes. Use the report as a checklist: sample size, demographic strengths and opportunities, the 5 stages of maturity, and the four Journey Goals — Trusting, Experiencing, Reflecting, Serving. Look first for strengths, then for growth opportunities."
- Expandable doc "Read the full document: Debriefing Preparation" — a checklist covering Contents page, Demographics pages, Maturity stages page, Maturity profile page, Maturity & demographics comparison pages, Spiritual change & demographics pages, Pathways overview page, and the four Journey Goal areas (Trusting/Experiencing/Reflecting/Serving Jesus), Strengths & opportunities summary page, Maturity comparison graph. Source: "Source: Act — Debriefing Preparation. © 2017 Jesus Journey Group. All Rights Reserved." Full text at `dashboard.html` lines 705–726.

**Timeline step 2 — "Debriefing leadership sessions"**
- Meta: "Day 2 · Ministry staff / key leaders · ~4 hours"
- Body: "Walk the wider staff through the same results using yesterday's notes. Start together on Trusting Jesus, then split into three groups for Experiencing, Reflecting, and Serving Jesus. Introduce the Comments Report, then plan the next month, including core-community and town-hall meetings."
- Expandable doc "Read the full document: Debriefing Leadership Sessions" — full text at `dashboard.html` lines 741–760. Source: "Source: Act — Debriefing Leadership Sessions. © 2017 Jesus Journey Group. All Rights Reserved."

**Timeline step 3 — "Engaging the church"**
- Meta: "Within 1–2 weeks · Core community, then whole church"
- Body: "Never build strategy from data alone — bring the actual people back in. Start with an invite-only core-community meeting (7–9pm: 45 min review, 30 min small-group discussion, 45 min report-back). Follow with town halls or focus groups, and a Sunday message naming your three greatest strengths and three growth opportunities."
- Expandable doc "Read the full document: Engaging the Church" — full text at `dashboard.html` lines 775–799, including a Jeremiah/Ecclesiastes-adjacent quote structure and meeting outline. Source: "Source: Act — Engaging the Church. © 2017 Jesus Journey Group. All Rights Reserved."

**Timeline step 4 — "Making a plan"**
- Meta: "Following weeks · Staff / leaders retreat"
- Body: "Set goals for a **12–18 month** window. Focus on outcomes, not programs — programs are scaffolding, not the building. Look for high-leverage "keys," build initiatives across three strands (inviting God in, involving fellow believers, drawing on outside wisdom), and re-evaluate at 6 months and 1 year. Plan to repeat the survey in about 18 months."
- Expandable doc "Read the full document: Making a Plan" — sections "Drawing Conclusions," "Setting 12–18 Month Goals," "Looking for Significant Strategic "Keys,"" "Three Primary Types of "Helping Initiatives,"" "Monitoring Progress / Adjusting Plans," "Preparing for Survey Follow-Up." Full text at `dashboard.html` lines 814–844. Source: "Source: Act — Making a Plan. © 2017 Jesus Journey Group. All Rights Reserved."

### Resources tab
- H1: "Resources"
- Subhead: "Templates, guides, and support materials to use throughout every stage above."
- Card 1: "Small Group Curriculum" / "Discussion guides to help groups reflect on their own results together." / Button "Download"
- Card 2: "Graphic Templates" / "Promotional slides and bulletin graphics for announcing your survey." / Button "Download"
- Card 3: "Sample Message Outline" / "A minimal Sunday-message outline for sharing strengths & opportunities — built to be personalized." / Button "Download" + expandable full outline "Read the full outline: Becoming Like Jesus (Sample Message)" (Colossians 1:28–29 opening quote, sections "Why does this matter?," "Is this only the concern of fathers / mothers / church leaders?" incl. Philippians 2:12–13 and 2 Peter 1:3,5 quotes, "How do we do this?," "What happens if we say no?," "The importance of community" incl. Hebrews 10 reference, "Three significant strengths to celebrate," "Three opportunities to reach toward," "Next steps: We can work because God is at work!"). Source: "Source: Resources — Becoming Like Jesus (Sample Message Outline). Intentionally minimal so it can be personalized for your own congregation." Full text at `dashboard.html` lines 889–954.

### Footer
- Brand: "Jesus Journey Survey" (plain text, no "my" prefix — see Section 1)
- Copyright: "© 2026 Jesus Journey Group. All Rights Reserved."

### "Wave" jargon — internal term replaced with plain language
The internal/legacy term **"wave"** (used historically to mean one round/instance of the survey) still appears **only in CSS class names and code comments**, never in user-facing copy:
- CSS classes: `.wave-card`, `.wave-card-head`, `.wave-label`, `.wave-dates`, `.wave-metrics`, `.wave-metric`, `.wave-metric-value`, `.wave-metric-label`, `.wave-hint`, `.wave-actions`, `.survey-again-note`
- Code comment: `/* ============ COLLECT: WAVE CARD ============ */`
- Data attribute: `data-survey-state="live"` / `data-goto-survey-state="none"`

**In all visible copy, "wave" has been replaced by "survey."** Examples: "Fall 2026 Survey" (not "Fall 2026 Wave"), "Start a new survey" (not "Start a new wave"), "Close survey & run reports," "Your Surveys" tab title, "A church can only run one survey at a time," "Ready to run this again? Each survey is a separate purchase." The mockup also avoids "wave" in explanatory text — e.g., describing the 3 lifecycle states as things "a church actually sees" rather than "wave states."

**Recommendation for the React port**: rename the CSS/component classes and any internal variable/type names from `wave*` to `survey*` (e.g., `WaveCard` → `SurveyCard`, `waveMetrics` → `surveyMetrics`) so the codebase's internal vocabulary matches the plain-language UI copy and doesn't reintroduce "wave" jargon into new code, comments, or analytics event names.

---

## 5. Color Palette & Typography

All custom properties are defined in `style.css` (not `dashboard.css` or `base.css`), under `:root, [data-theme="light"]` (light theme, default) and `[data-theme="dark"]` (dark theme override), plus a second `:root` block for type scale and spacing.

### Light theme (default) — `style.css` lines 2–56
```css
:root, [data-theme="light"] {
  --color-bg: #F8F5F0;
  --color-surface: #FFFFFF;
  --color-surface-2: #FBF9F5;
  --color-surface-offset: #F0EBE2;
  --color-border: #E2DBCC;
  --color-divider: #EAE3D5;

  --color-text: #2A2620;
  --color-text-muted: #6B655A;
  --color-text-faint: #A8A091;
  --color-text-inverse: #FBF8F2;

  --color-primary: #2E6B67;
  --color-primary-hover: #1F4F4C;
  --color-primary-active: #163B39;
  --color-primary-highlight: #DCE8E5;

  --color-coral: #C4573F;
  --color-coral-hover: #A8452F;
  --color-coral-highlight: #F0DCD4;

  --color-tan: #D3B896;
  --color-tan-highlight: #F1E7D9;

  --color-success: #4C7A3A;
  --color-success-highlight: #DCE7D3;
  --color-warning: #96601D;
  --color-warning-highlight: #EBDEC7;

  --radius-sm: 0.375rem;
  --radius-md: 0.625rem;
  --radius-lg: 1rem;
  --radius-xl: 1.5rem;
  --radius-full: 9999px;

  --transition-interactive: 180ms cubic-bezier(0.16, 1, 0.3, 1);

  --shadow-sm: 0 1px 2px oklch(0.2 0.02 60 / 0.06);
  --shadow-md: 0 6px 20px oklch(0.2 0.02 60 / 0.08);
  --shadow-lg: 0 20px 48px oklch(0.2 0.02 60 / 0.14);

  --content-wide: 1240px;

  --font-display: 'Fraunces', Georgia, serif;
  --font-body: 'Source Sans 3', 'Helvetica Neue', sans-serif;
}
```

### Dark theme override — `style.css` lines 58–84
```css
[data-theme="dark"] {
  --color-bg: #17191A;
  --color-surface: #1E2021;
  --color-surface-2: #232526;
  --color-surface-offset: #262827;
  --color-border: #383B39;
  --color-divider: #2C2E2C;
  --color-text: #E8E5DD;
  --color-text-muted: #A29C8E;
  --color-text-faint: #6C675C;
  --color-text-inverse: #17191A;
  --color-primary: #6FADA7;
  --color-primary-hover: #8FC4BE;
  --color-primary-active: #A8D3CE;
  --color-primary-highlight: #263634;
  --color-coral: #E08267;
  --color-coral-hover: #E89985;
  --color-coral-highlight: #3B2A24;
  --color-tan: #C9AC85;
  --color-tan-highlight: #322C22;
  --color-success: #8BB870;
  --color-success-highlight: #263323;
  --color-warning: #D9A552;
  --color-warning-highlight: #362D1E;
  --shadow-sm: 0 1px 2px oklch(0 0 0 / 0.3);
  --shadow-md: 0 6px 20px oklch(0 0 0 / 0.35);
  --shadow-lg: 0 20px 48px oklch(0 0 0 / 0.5);
}
```
(Note: the dashboard mockup itself doesn't expose a theme toggle in `dashboard.html`, but the marketing site's shared `style.css` supports both themes via `data-theme` attribute — worth preserving dark-mode tokens in the React port even if not wired up yet.)

### Type scale & spacing — `style.css` lines 88–109
```css
:root {
  --text-xs: clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem);
  --text-sm: clamp(0.875rem, 0.8rem + 0.35vw, 1rem);
  --text-base: clamp(1rem, 0.95rem + 0.25vw, 1.125rem);
  --text-lg: clamp(1.125rem, 1rem + 0.75vw, 1.5rem);
  --text-xl: clamp(1.5rem, 1.2rem + 1.25vw, 2.25rem);
  --text-2xl: clamp(2rem, 1.2rem + 2.5vw, 3.5rem);
  --text-3xl: clamp(2.5rem, 1rem + 4vw, 4.5rem);

  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.25rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-10: 2.5rem;
  --space-12: 3rem;
  --space-16: 4rem;
  --space-20: 5rem;
  --space-24: 6rem;
  --space-32: 8rem;
}
```
Note: spacing scale skips some steps (no `--space-7`, `--space-9`, etc. defined) but `dashboard.css` still references `var(--space-7)` (used in `.wave-card` padding) — verify this variable exists elsewhere or falls back to `initial`/unset; likely an oversight to fix in the port (define `--space-7: 1.75rem` or replace with an existing token).

### Fonts
- **Display font**: `'Fraunces'` (serif, weights 500/600, optical-size range `9..144`) — used for all headings (`h1`, `.wave-label`, `.wave-metric-value`, `.info-card h2`, `.report-card-head h2`, `.act-step-marker`, `.act-step-body h2`, `.callout-card h3`, `.resource-card h2`, `.doc-body h4`, `.status-value`).
- **Body font**: `'Source Sans 3'` (sans-serif, weights 400/500/600/700) — used for all body text, buttons, labels, tabs.
- **Script accent font**: `'Allura'` (cursive) — used only for the "my" prefix in the header brand lockup.
- Google Fonts `<link>`: `https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Source+Sans+3:wght@400;500;600;700&family=Allura&display=swap`

### Key colors by usage
| Usage | Variable | Light hex | Dark hex |
|---|---|---|---|
| Page background | `--color-bg` | `#F8F5F0` | `#17191A` |
| Card/surface background | `--color-surface` | `#FFFFFF` | `#1E2021` |
| Secondary surface (metric tiles) | `--color-surface-2` | `#FBF9F5` | `#232526` |
| Muted fill (progress track, secondary btn bg) | `--color-surface-offset` | `#F0EBE2` | `#262827` |
| Borders | `--color-border` | `#E2DBCC` | `#383B39` |
| Primary text | `--color-text` | `#2A2620` | `#E8E5DD` |
| Muted/secondary text | `--color-text-muted` | `#6B655A` | `#A29C8E` |
| Faint text (badge numerals, timestamps) | `--color-text-faint` | `#A8A091` | `#6C675C` |
| Inverse text (on colored backgrounds) | `--color-text-inverse` | `#FBF8F2` | `#17191A` |
| **Primary action / brand teal** | `--color-primary` | `#2E6B67` | `#6FADA7` |
| Primary hover | `--color-primary-hover` | `#1F4F4C` | `#8FC4BE` |
| Primary highlight bg (e.g. "Live" pill bg) | `--color-primary-highlight` | `#DCE8E5` | `#263634` |
| **Coral accent** (tags, bullet dots, step meta) | `--color-coral` | `#C4573F` | `#E08267` |
| Coral highlight bg (report tag bg, resource icon bg) | `--color-coral-highlight` | `#F0DCD4` | `#3B2A24` |
| Tan accent | `--color-tan` | `#D3B896` | `#C9AC85` |
| Tan highlight bg (callout-card bg) | `--color-tan-highlight` | `#F1E7D9` | `#322C22` |
| Success (defined, not visibly used in dashboard) | `--color-success` | `#4C7A3A` | `#8BB870` |
| Warning (defined, not visibly used in dashboard) | `--color-warning` | `#96601D` | `#D9A552` |

### Status badge colors specifically
- **"Live" / "Live · Collecting" pill** (`.status-pill--live`): background `var(--color-primary-highlight)` (`#DCE8E5` light), text `var(--color-primary)` (`#2E6B67` light); has a small 7×7px solid-primary-color dot (`::before`) rendered inline before the text.
- **"Closed" pill** (`.status-pill--closed`, defined but not directly used in current markup — the closed state uses plain heading text "— closed" instead of a pill): background `var(--color-surface-offset)`, text `var(--color-text-muted)`.
- **Report tag** ("Numbers & graphs" / "Open-ended answers", `.report-tag`): background `var(--color-coral-highlight)`, text `var(--color-coral)`, uppercase, `font-size: var(--text-xs)`, `font-weight:600`, pill-shaped (`border-radius: var(--radius-full)`).
- No dedicated "warning" or "success" colored badge appears anywhere in the dashboard mockup, despite those tokens existing — available for future states (e.g., "at risk of missing minimum," "goal met") in the React port.

---

## 6. Component Patterns

### Cards
Three near-identical card base styles share one rule (`dashboard.css` line 245):
```css
.info-card, .report-card, .resource-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);   /* 1rem */
  padding: var(--space-6);            /* 1.5rem */
  box-shadow: var(--shadow-sm);
}
```
- `.info-card--highlight` variant: `background: var(--color-primary-highlight); border-color: transparent;` (used for "Keys to Success" card).
- `.wave-card` (survey console card) uses a larger radius/padding/shadow: `border-radius: var(--radius-lg); padding: var(--space-7); box-shadow: var(--shadow-md);` — note `--space-7` isn't in the defined spacing scale (see gap noted in Section 5).
- `.callout-card`: `background: var(--color-tan-highlight); border-radius: var(--radius-lg); padding: var(--space-6) var(--space-7);` — no border, tinted tan background, used for "Before you begin" and "Guiding principle: numbers are people."
- Card header pattern (`.info-card-head`, `.report-card-head`): flex row, icon + heading, `gap: 0.75rem` / `var(--space-3)`.
- Icon chip (`.info-icon`): `width/height: 2.25rem; border-radius: var(--radius-md); background: var(--color-surface-offset); color: var(--color-primary); display:inline-flex; align-items:center; justify-content:center;` containing an 18×18px inline SVG stroke icon.
- Resource icon chip (`.resource-icon`) is larger (2.5rem) and coral-tinted: `background: var(--color-coral-highlight); color: var(--color-coral);` with 20×20px SVG.

### Buttons (`dashboard.css` lines 528–557; base sizing shared with `style.css` `.btn`)
```css
.btn {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 600;
  padding: 0.65rem 1.25rem;
  border-radius: var(--radius-md);   /* 0.625rem */
  transition: var(--transition-interactive);
}
.btn-primary { background: var(--color-primary); color: var(--color-text-inverse); }
.btn-primary:hover { background: var(--color-primary-hover); }

.btn-secondary { background: var(--color-surface-offset); color: var(--color-text); }
.btn-secondary:hover { background: var(--color-border); }

.btn-tertiary { background: transparent; color: var(--color-primary); padding-left:0; padding-right:0; }
.btn-tertiary:hover { color: var(--color-primary-hover); text-decoration: underline; }
```
(Note: the marketing `style.css` also defines a slightly different `.btn` with `border-radius: var(--radius-full)` and a `.btn-coral` variant, plus `.btn-lg` — the dashboard's own `dashboard.css` `.btn` rules take precedence within dashboard pages since they're loaded last and match more specifically, giving dashboard buttons a `--radius-md` pill-ish rectangle rather than the marketing site's fully-rounded pill buttons. **Flag this cascade quirk for the React port** — decide on one canonical `Button` component rather than relying on load-order overrides.)
- **Primary**: solid primary-teal background, inverse text — used for main CTAs ("Start a new survey," "Close survey & run reports," "Download Church Report (PDF)").
- **Secondary**: neutral/offset background, normal text — used for lower-emphasis actions ("Send reminder," "Download Comments Report (PDF)").
- **Tertiary**: transparent background, primary-colored text, no horizontal padding, underlines on hover — used for lightweight downloads ("Download paper survey," "Download" on resource cards).
- **Link-button** (`.link-btn`): not a `.btn` at all — inline text styled as a bold underlined link (`font-weight:700; color: var(--color-primary); text-decoration: underline;`), used for the "start a new survey" call-to-action inside a sentence.

### Badges / pills
- `.status-pill` base: `inline-flex; gap:0.4rem; font-size: var(--text-sm); font-weight:600; padding: 0.25rem 0.75rem; border-radius: var(--radius-full);`
- `--live` variant: primary-highlight bg + primary text + small solid dot before text.
- `--closed` variant: surface-offset bg + muted text, no dot.
- `.report-tag`: uppercase micro-label, coral-highlight bg + coral text, `padding: 0.2rem 0.65rem`, `letter-spacing: 0.04em`.
- `.mockup-state-btn` (preview-only pill toggle): outlined pill, `border-radius: var(--radius-full)`, becomes solid primary-filled with white text when `.is-active`.

### Progress bars
- Track: `.progress-track` (8px tall, pill-shaped, `background: var(--color-surface-offset)`), `.progress-track--lg` variant is 12px tall with vertical margin.
- Fill: `.progress-fill` — teal gradient `linear-gradient(90deg, var(--color-primary), var(--color-primary-hover))`, pill-shaped, animates width changes over 600ms with an ease-out cubic-bezier.
- Subgroup mini-bars reuse the same `.progress-track`/`.progress-fill` classes inside a 3-col grid row (`90px 1fr 40px`: label / bar / percentage).

### Icons
All icons are **simple inline SVGs**, `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="2"` — geometric line icons (rectangles, circles, simple paths), each just 1–2 short `<path>`/`<rect>`/`<circle>` elements. These are simple enough to describe/recreate as a small icon set rather than needing literal copy-paste, but exact path data is included below for fidelity since they're each only one line of SVG:

| Context | SVG shape description | Path data |
|---|---|---|
| "Start your survey" (info-icon) | rounded square + plus | `<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M3 9h6"/>` |
| "Not sure where to start?" / "Make sense of your results" / step-list icon | circle + clock hands | `<circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/>` (also a variant `<path d="M12 7v5l3 3"/>` used in Prepare and Interpret step-list icon) |
| "What Send reminder does" (info-icon) | envelope | `<path d="M22 6l-10 7L2 6"/><rect x="2" y="4" width="20" height="16" rx="2"/>` |
| "One survey at a time" / "Fall 2026 Survey — closed" / "Monitoring & readiness" doc icon | document/file with folded corner | `<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/>` |
| "Understanding the Survey" (Prepare) | circle + clock (see above, `M12 7v5l3 3`) | same family as clock icon |
| "Step-by-Step to Success" (Prepare) | checklist / checkmark | `<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>` |
| "Keys to Success" (Prepare) | bar chart | `<path d="M12 20V10M18 20V4M6 20v-4"/>` |
| "Starting a survey" (Collect) | window/browser frame | `<path d="M4 4h16v16H4z"/><path d="M4 8h16"/>` |
| "Monitoring & readiness" (Collect) | line chart | `<path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>` |
| Small Group Curriculum (Resources) | open book | `<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>` |
| Graphic Templates (Resources) | image/grid | `<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>` |
| Sample Message Outline (Resources) | grid/table | `<path d="M3 3h18v18H3z"/><path d="M3 9h18M9 3v18"/>` |

Icon sizing: 18×18px inside `.info-icon` chips, 20×20px inside `.resource-icon` chips (`.info-icon svg { width:18px; height:18px; }`, `.resource-icon svg { width:20px; height:20px; }`).

### Spacing/gap patterns
- Card internal spacing generally uses `var(--space-3)`–`var(--space-6)` for vertical rhythm between head/body/actions.
- Grid gaps consistently `var(--space-5)` (panel-grid) or `var(--space-4)`/`var(--space-6)` for tighter groupings.
- `.panel-grid` = 3-col default; `.panel-grid--collect` = `1.4fr 1fr` (wave card + side panel); `.panel-grid--reports` = 2-col equal.
- Responsive breakpoints: `900px` (grids collapse to 1–2 cols) and `640px` (header stacks vertically, single-column everywhere, smaller timeline markers).

### Expand/collapse "full document" pattern
Every info-card/report-card/timeline-step/resource-card that has long-form legacy source text wraps it in a native `<details class="full-doc"><summary>...</summary><div class="doc-body">...</div></details>`:
```css
.full-doc { margin-top: var(--space-4); border-top: 1px solid var(--color-border); padding-top: var(--space-3); }
.full-doc > summary { cursor:pointer; list-style:none; font-size: var(--text-sm); font-weight:600; color: var(--color-primary); display:flex; align-items:center; gap:0.4rem; padding:0.35rem 0; user-select:none; }
.full-doc > summary::-webkit-details-marker { display:none; }
.full-doc > summary::before { content:""; width:0; height:0; border-left:5px solid currentColor; border-top:4px solid transparent; border-bottom:4px solid transparent; transition: transform 0.15s ease; }
.full-doc[open] > summary::before { transform: rotate(90deg); }
.doc-body { margin-top: var(--space-3); padding: var(--space-5); background: var(--color-surface-offset); border-radius: var(--radius-md); font-size: var(--text-sm); line-height:1.65; color: var(--color-text); max-height: 32rem; overflow-y:auto; }
```
- Custom triangle/caret indicator (CSS border-triangle, rotates 90° on open) replaces the native disclosure marker.
- Scrollable body capped at `32rem` height (`26rem` on mobile) with a small "scroll hint" (`.doc-scroll-hint`, faint italic text) — text for the hint itself isn't populated in this markup but the class exists for it.
- `.doc-body h4`: uppercase, small, primary-colored section headers within the long-form text; `.doc-source`: small italic dashed-top-border attribution line (the "Source: ... © 2017 Jesus Journey Group" lines).
- **This expand/collapse pattern is the vehicle for all the long legacy 2017 doctrinal/procedural text** — in React, model this as a reusable `<FullDoc summary="..." source="...">` component that takes structured content (headings/paragraphs/lists) as children/props, since nearly every tab uses it at least once (13 total instances across Prepare/Collect/Interpret/Act/Resources).

---

## 7. Settings / Contact Info UI

**Not present in this mockup.** After a full read of `dashboard.html`, there is:
- No editable profile or settings page/section/tab.
- No contact-name, contact-email, or contact-phone form fields.
- No sign-out button or account menu within the dashboard header (only the brand lockup + church name/join-code display, which are read-only, not editable).
- No account/settings link in the tab list (`Your Surveys`, `Prepare`, `Collect`, `Interpret`, `Act`, `Resources` only).

The closest related concept is **narrative, not UI**: the Prepare-tab copy repeatedly references designating a "primary contact" / "survey coordinator" for the church (e.g., "Selecting a primary contact who will coordinate the survey process and confirm that when you register with the Journey team... This person will receive all correspondence, coordinate the survey activities within your church...") — but this is described as something that happens at registration/sign-up time, not as an editable settings UI shown anywhere in this dashboard mockup.

**Recommendation**: since the task expects a settings/contact-info area to exist, flag to design/product that either (a) it lives on a page not included in this mockup export (e.g., a separate account/settings screen not part of `jj-public-site`), or (b) it still needs to be designed — the React port should not invent a settings UI from scratch without further design input, but should leave a placeholder route/tab for church contact/profile management if the product requires one.

---

## Cross-reference notes for the React port
- Only `dashboard.html`, `dashboard.css`, `base.css`, and `style.css` were read for this extraction (per task scope) — `index.html` was only spot-checked for the header sign-in button and footer CSS confirmation, not fully inventoried.
- `--space-7` is used in `dashboard.css` (`.wave-card` padding, `.callout-card` padding) but not defined in the `:root` spacing scale in `style.css` — needs to be added (likely `1.75rem`, consistent with the `space-N × 0.25rem` pattern) or the CSS should be changed to use a defined token.
- The dashboard's own `.btn` rules in `dashboard.css` differ from and override the marketing site's `.btn` rules in `style.css` (radius and base padding differ) purely due to CSS load order/specificity — the React port should consolidate into a single `Button` component with explicit variants rather than relying on cascade order.
- All long-form 2017-era doctrinal/procedural text should be pulled verbatim from `dashboard.html` (line ranges cited above per section) into the port's content/copy data layer — this extraction summarizes structure and headings for these blocks but the source HTML is the canonical verbatim text.
