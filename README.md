# TaxTabula

State and federal tax credits, surfaced. Click any state to see what's available, who qualifies, and what you might be missing — including small ones like DC's Schedule H rent credit that most filers never claim.

**Live demo:** _coming soon — taxtabula.com_

## Why this exists

VITA volunteer experience showed me that people routinely miss state-specific tax credits they qualify for — DC's Schedule H rent/property credit alone leaves money on the table for thousands of DC renters. TaxTabula fixes that:

1. **Map view** — pick a state, see every credit available
2. **Eligibility wizard** — answer a few questions, see what you qualify for
3. **Compare locations** — see how your tax picture changes across states (great for relocation decisions)

## Coverage

- **Tier 1 (full data):** DC, VA, MD, CA, NY, IL, MA, TX, FL, WA — 35+ state credits
- **Federal:** EITC, CTC, AOTC, LLC, Saver's, Premium, CDCC
- **Tier 2 (federal-only for now):** All 40 remaining states; expanding weekly

## Stack

- **Backend:** Python + FastAPI, CSV-driven (no DB needed)
- **Frontend:** React + Vite + react-simple-maps
- **Deployment:** Vercel (frontend) + Render (backend)

## Run locally

You need Python 3.11+ and Node 18+ installed.

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

Backend runs at `http://localhost:8000`. Test it:

```
http://localhost:8000/api/states
http://localhost:8000/api/states/DC
```

### 2. Frontend (in a separate terminal)

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`. The Vite dev server proxies `/api` to the backend automatically.

## Project structure

```
taxtabula/
├── data/                     # CSV-driven content
│   ├── states.csv
│   ├── credits.csv           # 41 credits (state + federal)
│   ├── eligibility_rules.csv # 114 rules
│   └── tax_brackets.csv      # 2025 brackets per state
├── backend/
│   ├── main.py               # FastAPI app + rule evaluator
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.jsx           # Map + wizard + compare
    │   ├── main.jsx
    │   └── styles.css
    ├── index.html
    ├── package.json
    └── vite.config.js
```

## Adding a new state

All data is plain CSV — no DB migrations. To add a state:

1. Add row to `data/states.csv`
2. Add credits to `data/credits.csv`
3. Add eligibility rules to `data/eligibility_rules.csv`
4. (If state has income tax) add brackets to `data/tax_brackets.csv`
5. Restart the backend — that's it.

## Disclaimer

Estimates are directional. Tax rules change. Always confirm with a licensed CPA before filing or making relocation decisions based on this tool.

Built by Wonseok (Eddie) Lee — CPA + Data, Northern Virginia.
