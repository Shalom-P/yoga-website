# Condition landing pages — format spec, status & revision plan

Standalone marketing/SEO landing pages (one per condition), **not wired into the Next.js app**.
Gold standard = `yoga-for-diabetes.html` (signed off — see the shared PDF render).
All 9 pages share the same CSS/nav/footer/reveal-JS scaffolding; only the `<main>` content differs.

---

## 1. The format (the template every page follows)

Eleven sections, in order:

| # | Section | What it contains |
|---|---------|------------------|
| 1 | **Hero** | eyebrow `<intensity> intensity · for <condition>` · H1 `Yoga for <em>X</em>, shaped around you.` · lead paragraph · two CTAs (Book / How it helps) · trust line `Free 1:1 trial · No credit card · 60 min, live on Google Meet` |
| 2 | **Empathy strip** (sage) | uppercase `.mini` label + one big serif sentence acknowledging the lived reality + "alongside, never replaces medical care" |
| 3 | **How yoga helps** | eyebrow "Why it works" + H2 `How yoga can support <condition>.` + subhead + **exactly 4 numbered lever cards** (title + 1–2 sentence body) |
| 4 | **The poses** (signature) | eyebrow "What you'll actually do" + H2 + **asana groups**, each with a `.tag` + a `.why` line + 2–4 pose cards (`.sa` Sanskrit, `.en` English, `.desc`), optional italic `.pose-note` caveats, closing `.selection-note` |
| 5 | **How we work** | 4 numbered steps (get to know you → plan → live 1:1s → grow gently) |
| 6/7 | **Session + Who-for split** | "What a session looks like" checklist + "Who it's for" paragraph + "What you'll need" chips |
| 8 | **Testimonial** | placeholder quote (`<strong>Placeholder — swap for a real review.</strong>`) |
| 9 | **FAQ** | 5 condition-specific Q&A in `<details>` — Q1 always defuses the "cure/replace meds" question |
| 10 | **Safety strip** (clay) | the "Yoga supports your care — it doesn't replace it" disclaimer |
| 11 | **Final CTA** (sage) | "Your first session is on us." + Book CTA + trust line |

**Copy rules (load-bearing — UAE PDPL / India DPDP ad rules; mirrors migration 0024 reframe):**
- Supportive verbs only: *support, help with, ease, alongside your medical care*. Never *cure, treat, reverse, lower, control, balance (hormones), burn fat*.
- Every page's FAQ Q1 explicitly says yoga does **not** replace medication/treatment.
- Encode safety in `.pose-note`, the session checklist, and the FAQ (contraindications, "best time", "see your doctor first" red-flags).

---

## 2. Status of all 9 pages

All 9 are **fully built in the format above** — none are stubs. Claim-safety is disciplined across the board (no false health claims found; the weight-loss/mental-health/hormonal reframes are deliberate and correct). Remaining work is correction + polish, not creation.

| Page | State | Notes |
|------|-------|-------|
| diabetes | ✅ gold standard | signed off |
| hypertension | ✅ strong | best safety handling of the set (inversions/breath-holding/Kapalbhati+Bhastrika excluded, head ≥ heart) |
| geriatric | ✅ strong | chair/wall support throughout; osteoporosis + dizziness caveats present |
| weight-loss | ✅ good | reframed to "Weight Management / active routine"; "we don't promise numbers" FAQ |
| mental-health | ✅ good | reframed to "calmer mind"; crisis + emotional-release FAQs (best FAQ set) |
| pain-relief | ✅ good | strong red-flag screening (numbness/radiating → doctor) |
| prenatal | ✅ good | clearance-first; thorough avoid-list; left-side Shavasana |
| kids | ✅ good | best tonal reinvention (animal names, play); but disclaimer not parent-targeted |
| hormonal-health | ✅ rewritten | levers/who-for/testimonial now name lived experiences (sleep, mood, warm flushes, life stages) |

---

## 3. Fix list (prioritised)

### ✅ DONE — must-fix factual/safety errors (applied)
1. **pain-relief** — `Supta Kapotasana` (classically a deep reclined *backbend*) mislabeled as the gentle "reclined figure-four". Renamed `.sa` → **Sucirandhrasana**. *(Done)*
2. **hormonal-health** — Sheetali described as "often used for warmth" (backwards — it's a *cooling* breath). Rewritten → "A slow, cooling breath that many find soothing during warm flushes." *(Done)*

### ✅ DONE — safety caveats / ambiguity (applied)
3. **kids** — disclaimer re-pointed at parent/guardian (supervision, safe clear space, paediatrician); supervision FAQ strengthened (parent sets up + supervises the live 1:1). *(Done)*
4. **prenatal** — `Supta Baddha Konasana` now "on an incline — never flat on your back". *(Done)*
5. **prenatal** — `Konasana` → "Gentle standing side-bend", desc specifies "no twisting". *(Done)*
6. **prenatal** — `Malasana` now "only later in pregnancy when baby is head-down — skipped in early pregnancy or if advised". *(Done)*
7. **pain-relief** — `Bhujangasana` now "gentle arching or rounding, whichever eases your spine". *(Done)*
8. **weight-loss** — pose-note now names "forearm/knees-down for sensitive wrists, gentler routes during pregnancy". *(Done)*
9. **mental-health** — crisis FAQ now names "your local emergency number, or Tele-MANAS on 14416 (India)". **⚠️ add a verified UAE helpline number before launch.** *(Done — pending UAE number)*

### ✅ DONE — hormonal-health rewrite (applied)
10. **hormonal-health** — 4 levers rewritten to name lived experiences (broken sleep/tiredness, mood swings, cramps/tension/warm flushes, life stages); who-for now names cycles/pregnancy recovery/perimenopause/menopause; testimonial made specific (perimenopause). *(Done)*

### ☐ QUALITY POLISH — remaining (taste-dependent; NOT yet done)
11. **mental-health & weight-loss** — pose descriptions and lever bodies are single-sentence/thin vs. diabetes' fuller two-sentence cards; expand to match.
12. Minor: kids `Natarajasana` (Dancer) is ambitious for younger kids — qualify "for older/steadier children"; kids "Downward dog = the puppy" animal-name is loose; geriatric descs lightly repeat the English label.

---

## 4. Open product decisions (not copy bugs)
- **hormonal-health** page name/H1 implies a physiological hormonal effect; body copy never promises it (pivots to rest/sleep/calm). Compliant as written, but it's the riskiest *premise* of the set — confirm the taxonomy is intended.
- These pages are standalone HTML. Decide distribution: where they're hosted/linked, and whether to fold the richer content back into the app's `/classes/[slug]` route (currently much simpler than these pages).
