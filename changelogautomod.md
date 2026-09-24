# Changelog — Automod & Regex Engine

Correctness pass on `config.yml` (`regex_engine`, automod) plus the regex test harness.

Detection behaviour is described only at the phrase/concept level. Actual patterns, obfuscation-handling character sets, and lookaround logic are deliberately omitted so this document cannot be used to bypass the filters.

Scope note: covers the automod/regex work in this session. Other uncommitted `config.yml` changes in the working tree (anti-impersonation feature, command and role-connection edits) predate this pass and are not covered here.

---

## Broken Patterns Repaired

### Slurs + Extremism — Encoding Corruption
- Five pattern lines were stored double-encoded (mojibake), so their alternate-character alternatives and symbol alternatives were literal garbage bytes instead of the intended characters.
- Effect: obfuscated slurs that substitute look-alike letters were not caught at all, and the Extremism symbol-alternative entry matched nothing.
- Decoded back to valid UTF-8. Four lines in Slurs, one in Extremism.
- This closes a real evasion gap — the affected entries were silently dead.

### Staff Impersonation — Apostrophe Form Missed
- The self-claim pattern required whitespace immediately after the pronoun, so `"i'm a mod"` / `"i'm an admin"` never matched while `"i am a mod"` did.
- Fixed to accept both `"i am"` and `"i'm"`, plus the indefinite article.

### Scam Links — Article Handling
- The "I won a ___" lure pattern only allowed one of article-or-adjective, so `"i won a free nitro click here"` was missed.
- Now accepts article + adjective together.

---

## New Detections

### Self-Harm & Suicide Encouragement — 15 gaps closed
- End-of-life phrasings: "end it all", "end it already".
- Despair/hopelessness: "life is not worth it", "no point in living", "what's the point of living/life", "i'm (so) done with life/everything", "i'm tired of living/life", "i'm over it all/everything".
- Ideation: "kms" (numeric contexts such as distances are excluded), "self delete".
- Worthlessness: "nobody/no one" + cares / loves / needs / wants / misses / likes + "you".
- "i wish i was dead", "i wish i was never born".
- These fire the rule's existing welfare response (report + supportive notice + warn), not a punitive action.

### Advertising & DM Ads
- Added Steam keys/codes to the free-gift lure list alongside the existing digital-currency items.

### Phishing
- Added a "verify/confirm here, then claim a free digital item" lure shape (the classic free-nitro verification bait).

### Homophobia
- Added "pansy" as a direct-address insult only — requires an addressing/intensifier prefix, so the bare word and plural floral usage do not match.

### NSFW
- Added "horny" as a standalone term, with the animal name exempted.

### Piracy
- Extended the pirate/crack/warez object list to include downloads, links, sites, and packs (e.g. "warez download" was missed).
- Allowed a linking noun between the re-upload/download-link phrase and the target (e.g. "reupload link for crack" was missed).

### Alt Account Promotion
- Now accepts indefinite/possessive articles ("use my alt", "get an alternate account").
- Accepts the copula ("this is my alt", "here is my smurf account").
- Accepts full "i am" alongside "i'm", and an optional state word ("i am on my alt right now" was missed).

---

## False Positives Removed

### Piracy
- "How/where to..." entries now require a concrete media/software object, so benign phrasings such as "how to crack an egg" and "how to get free advice" no longer match.

### Alt Account Promotion
- "Backup"/"secondary" now require the account noun, so "make a backup" (files, not accounts) no longer matches. Deliberate alt phrasing still matches.

### NSFW
- Animal-name exemption added to the new standalone term.

### Homophobia
- Bare/plural floral usage stays unmatched (insult form is context-gated).

### Reclassified as Explicit Guards
- Several phrases previously asserted as must-match were moved to must-NOT-match, reflecting deliberate earlier false-positive removals: non-Latin script text (Zalgo), a British/common noun, generic URL shorteners, bare "free X" phrases (now handled by Advertising/link filter at the appropriate severity), and flirtatious-but-not-explicit compliments, plus a general insult and a neutral/reclaimed term (Homophobia).
- Each is now a regression guard — re-broadening any of these fails the suite.

---

## Test Harness

### Harness Bug — Faked Results
- The harness passed pattern-objects straight into the regex constructor, which stringified them into a character class that matched nearly any text. This manufactured five false positives that were not real config problems.
- Fixed to mirror the production engine exactly: unwrap the pattern source and honour the credit-card (Luhn) gate.
- Compile checks now cover both the plural and singular pattern fields.

### Coverage Added
- Fixed two rules that were never actually tested due to misnamed test keys — the self-harm block was split across two wrong names, and the Extremism key was misspelled. Both were merging/renamed to their real config names.
- Removed a test block for a rule that does not exist in config.
- Added a new case file covering six previously untested rules: Emergency Staff Pin, Piracy, Alt Account Promotion, Staff Impersonation, Advertising & DM Ads, Bumping.
- Harness now reports any config rule with zero test coverage; currently zero untested rules.

### Results
- Corpus: 929 tests / 37 failures → **1145 tests / 0 failures**.
- 0 untested rules (was 8).
- Config validates against the Zod schema (33 regex rules) and typecheck passes clean.

### Files Changed
- `config.yml` — encoding repairs, new detections, false-positive tightening.
- `scripts/test-regexes.mjs` — harness correctness, Luhn parity, coverage reporter.
- `scripts/regex-cases.mjs`, `scripts/regex-cases2.mjs` — rule-name fixes, reclassified guards.
- `scripts/regex-cases3.mjs` — new, coverage for six untested rules.
