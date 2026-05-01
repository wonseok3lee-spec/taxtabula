# taxtabula — data collection guide

## 4 CSVs in /data

### 1. `states.csv` — 10 states + Federal (DONE ✅)
You don't need to touch this.

### 2. `credits.csv` — credit definitions (DC + Federal seeded)
For each Tier 1 state, add 3-7 rows.

**Required columns:**
- `id` — unique snake_case (e.g. `va_low_income`, `md_renters`)
- `state_code` — 2-letter (DC, VA, MD…) or `US` for federal
- `name` — official credit name
- `level` — `state` or `federal`
- `type` — `credit` or `deduction`
- `refundable` — `TRUE` / `FALSE` / `partial`
- `max_amount` — integer (in $) or empty
- `tax_year` — `2025`
- `short_description` — one sentence (~15 words)
- `long_description` — 2-3 sentences with concrete numbers
- `source_url` — official state DOR or IRS URL

### 3. `eligibility_rules.csv` — eligibility rules per credit
Multiple rows per credit, one per rule.

**rule_type vocabulary** (use these exactly):
- `residency_state` — must live in this state
- `residency_duration_months` — minimum months of residency
- `federal_agi_max_under70`, `federal_agi_max_70plus`, `agi_max_single`, `agi_max_mfj`, `agi_max_hoh`
- `agi_phaseout_single`, `agi_phaseout_mfj`
- `claimed_as_dependent` — TRUE/FALSE
- `public_housing` — TRUE/FALSE
- `rents_or_owns` — `rent` / `own` / `rent,own`
- `citizenship` — `citizen` / `resident_alien` / `nonresident_alien`
- `filing_status` — `single` / `mfj` / `mfs` / `hoh` / `qss`
- `has_valid_ssn` — TRUE/FALSE
- `has_dependents`, `child_age_max`, `age_min`, `age_max`
- `is_student`, `years_completed`
- `investment_income_max`
- `enrolled_marketplace`
- `us_residency_months`

**operator vocabulary:**
- `eq` (equals), `gte` (>=), `lte` (<=), `gt`, `lt`
- `in` (value is comma-separated list — user value must be one of)
- `not_in`

**value:** the threshold or required value. Strings unquoted unless they contain commas.

### 4. `tax_brackets.csv` — for What-if calculations
For each Tier 1 income-tax state, add brackets per filing status.
Use `9999999` as max for top bracket.

---

## Tier 1 states to fill (need 3-5 credits each minimum)

- [x] DC — 5 credits seeded
- [ ] VA — research at https://tax.virginia.gov
- [ ] MD — research at https://marylandtaxes.gov
- [ ] CA — research at https://ftb.ca.gov
- [ ] NY — research at https://tax.ny.gov
- [ ] IL — research at https://tax.illinois.gov
- [ ] MA — research at https://mass.gov/dor
- [ ] TX — likely just sales tax exemptions (no income tax)
- [ ] FL — same
- [ ] WA — Working Families Tax Credit ✅ (https://workingfamiliescredit.wa.gov)

## Tier 2 states (40 remaining)
v1 launch: just show federal credits + "state data being verified" note.
