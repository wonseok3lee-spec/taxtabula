# taxtabula data

All data is plain CSV. The backend loads these at startup and exposes them via the API.

## Files

- `states.csv` — 10 Tier 1 states + Federal
- `credits.csv` — 41 credits (35+ state + federal)
- `eligibility_rules.csv` — 114 rules across all credits
- `tax_brackets.csv` — 2025 income tax brackets per state

## Adding more states

Currently Tier 1: DC, VA, MD, CA, NY, IL, MA, TX, FL, WA.

To add a state:

1. Add 3-5 rows to `credits.csv` with state-specific credits from that state's DOR website.
2. For each credit, add eligibility rules to `eligibility_rules.csv`.
3. Add tax brackets to `tax_brackets.csv` (skip if no income tax).
4. Update `frontend/src/App.jsx` — add the state to `TIER_1_STATES`.

## Rule vocabulary

See `eligibility_rules.csv` for the full set. Common ones:
- `residency_state` — must live in this state
- `federal_agi_max_under70`, `federal_agi_max_70plus`
- `claimed_as_dependent`, `public_housing`, `rents_or_owns`
- `citizenship`, `filing_status`, `has_valid_ssn`
- `child_age_max`, `age_min`, `age_max`
- `investment_income_max`, `earned_income_max`

Operators: `eq`, `lte`, `gte`, `lt`, `gt`, `in`, `not_in`

## Sources

All data verified against official sources as of May 2026:
- IRS.gov — federal credits
- otr.cfo.dc.gov — DC
- tax.virginia.gov — VA
- marylandtaxes.gov — MD
- ftb.ca.gov — CA
- tax.ny.gov — NY
- tax.illinois.gov — IL
- mass.gov/dor — MA
- workingfamiliescredit.wa.gov — WA
