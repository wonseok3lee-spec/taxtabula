"""
TaxTabula backend - FastAPI app.

Loads CSV data into memory at startup and exposes endpoints for:
- States
- Credits (per state)
- Eligibility checking (rule evaluator)
- What-if simulation
- Compare locations
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import csv
import os

app = FastAPI(title="TaxTabula API", version="0.1.0")

# CORS for frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────────────────────────────────
# Load data from CSVs at startup
# ──────────────────────────────────────────────────────────────────────────

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

states: List[dict] = []
credits: List[dict] = []
eligibility_rules: List[dict] = []
tax_brackets: List[dict] = []


def load_csv(filename: str) -> List[dict]:
    path = os.path.join(DATA_DIR, filename)
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f))


@app.on_event("startup")
def load_all_data():
    global states, credits, eligibility_rules, tax_brackets
    states = load_csv("states.csv")
    credits = load_csv("credits.csv")
    eligibility_rules = load_csv("eligibility_rules.csv")
    tax_brackets = load_csv("tax_brackets.csv")
    print(f"Loaded {len(states)} states, {len(credits)} credits, "
          f"{len(eligibility_rules)} rules, {len(tax_brackets)} brackets")


# ──────────────────────────────────────────────────────────────────────────
# Pydantic models for user input
# ──────────────────────────────────────────────────────────────────────────

class UserScenario(BaseModel):
    """User's tax situation. All fields optional — engine handles missing data."""
    state: Optional[str] = None
    federal_agi: Optional[float] = None
    earned_income: Optional[float] = None
    investment_income: Optional[float] = None
    filing_status: Optional[str] = "single"  # single, mfj, mfs, hoh, qss
    age: Optional[int] = None
    dependents: Optional[int] = 0
    child_ages: Optional[List[int]] = []
    months_resident: Optional[int] = 12
    citizenship: Optional[str] = "citizen"  # citizen, resident_alien, nonresident_alien
    rents_or_owns: Optional[str] = None  # rent, own, free
    public_housing: Optional[bool] = False
    claimed_as_dependent: Optional[bool] = False
    has_valid_ssn: Optional[bool] = True
    is_student: Optional[bool] = False
    enrolled_marketplace: Optional[bool] = False
    has_student_loans: Optional[bool] = False


class CompareRequest(BaseModel):
    base_scenario: UserScenario
    comparison_states: List[str]  # e.g. ["VA", "MD", "DC"]


# ──────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────

def get_credits_for_state(state_code: str) -> List[dict]:
    """Return state credits + all federal credits."""
    return [c for c in credits if c["state_code"] == state_code or c["level"] == "federal"]


def get_rules_for_credit(credit_id: str) -> List[dict]:
    return [r for r in eligibility_rules if r["credit_id"] == credit_id]


def evaluate_rule(rule: dict, user: UserScenario) -> dict:
    """
    Evaluate a single eligibility rule against user input.
    Returns: {passes: bool, reason: str, was_evaluated: bool}
    """
    rule_type = rule["rule_type"]
    operator = rule["operator"]
    expected = rule["value"]

    # Map rule_type to user attribute
    user_value = _get_user_value(rule_type, user)

    # If we don't have data, mark as "unknown" (still ok-ish)
    if user_value is None:
        return {"passes": None, "reason": f"Need: {rule['description']}", "was_evaluated": False}

    # Evaluate
    passes = _apply_operator(operator, user_value, expected)
    return {
        "passes": passes,
        "reason": rule["description"],
        "was_evaluated": True,
    }


def _get_user_value(rule_type: str, user: UserScenario):
    """Map rule_type strings to user scenario values."""
    mapping = {
        "residency_state": user.state,
        "residency_duration_months": user.months_resident,
        "us_residency_months": user.months_resident,
        "federal_agi_max_under70": user.federal_agi if (user.age is None or user.age < 70) else None,
        "federal_agi_max_70plus": user.federal_agi if (user.age and user.age >= 70) else None,
        "agi_max_single": user.federal_agi if user.filing_status == "single" else None,
        "agi_max_mfj": user.federal_agi if user.filing_status == "mfj" else None,
        "agi_max_hoh": user.federal_agi if user.filing_status == "hoh" else None,
        "agi_phaseout_single": user.federal_agi if user.filing_status == "single" else None,
        "agi_phaseout_mfj": user.federal_agi if user.filing_status == "mfj" else None,
        "household_income_max": user.federal_agi,
        "earned_income_min": user.earned_income,
        "earned_income_max": user.earned_income,
        "investment_income_max": user.investment_income,
        "claimed_as_dependent": user.claimed_as_dependent,
        "public_housing": user.public_housing,
        "rents_or_owns": user.rents_or_owns,
        "citizenship": user.citizenship,
        "filing_status": user.filing_status,
        "has_valid_ssn": user.has_valid_ssn,
        "has_dependents": (user.dependents or 0) > 0,
        "child_age_max": min(user.child_ages) if user.child_ages else None,
        "age_min": user.age,
        "age_max": user.age,
        "age_min_no_kids": user.age if (user.dependents or 0) == 0 else None,
        "age_max_no_kids": user.age if (user.dependents or 0) == 0 else None,
        "is_student": user.is_student,
        "enrolled_marketplace": user.enrolled_marketplace,
        "has_student_loans": user.has_student_loans,
        # Rules we cannot evaluate (need extra info or are derived)
        "federal_eitc_eligible": None,
        "below_federal_poverty": None,
        "taxed_by_other_state": None,
        "owns_property": None if user.rents_or_owns is None else user.rents_or_owns == "own",
        "age_or_disabled": None if user.age is None else user.age >= 65,
        "age_or_qualifying_child": None if user.age is None else (user.age >= 18 or (user.dependents or 0) > 0),
        "was_foster_youth": None,
        "has_earned_income": None if user.earned_income is None else user.earned_income > 0,
        "property_value_max": None,
    }
    return mapping.get(rule_type)


def _apply_operator(operator: str, actual, expected_str: str):
    """Apply comparison operator."""
    try:
        if operator == "eq":
            # boolean comparison
            if expected_str.upper() == "TRUE":
                return bool(actual) is True
            if expected_str.upper() == "FALSE":
                return bool(actual) is False
            return str(actual).upper() == str(expected_str).upper()
        if operator == "lte":
            return float(actual) <= float(expected_str)
        if operator == "gte":
            return float(actual) >= float(expected_str)
        if operator == "lt":
            return float(actual) < float(expected_str)
        if operator == "gt":
            return float(actual) > float(expected_str)
        if operator == "in":
            allowed = [v.strip() for v in expected_str.split(",")]
            return str(actual) in allowed
        if operator == "not_in":
            disallowed = [v.strip() for v in expected_str.split(",")]
            return str(actual) not in disallowed
    except (ValueError, TypeError):
        return None
    return None


def calculate_state_tax(state_code: str, income: float, filing_status: str = "single") -> float:
    """Apply progressive tax brackets to income."""
    brackets = [b for b in tax_brackets
                if b["state_code"] == state_code and b["filing_status"] == filing_status]
    if not brackets:
        return 0.0
    tax = 0.0
    for b in brackets:
        lo = float(b["income_min"])
        hi = float(b["income_max"])
        rate = float(b["rate"])
        if income <= lo:
            break
        taxable = min(income, hi) - lo
        tax += taxable * rate
        if income <= hi:
            break
    return round(tax, 2)


# ──────────────────────────────────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"name": "TaxTabula API", "status": "ok", "version": "0.1.0"}


@app.get("/api/states")
def list_states():
    """All states (Tier 1 first)."""
    return [s for s in states if s["code"] != "US"]


@app.get("/api/states/{state_code}")
def get_state(state_code: str):
    state = next((s for s in states if s["code"] == state_code.upper()), None)
    if not state:
        raise HTTPException(404, f"State {state_code} not found")
    state_credits = get_credits_for_state(state_code.upper())
    return {**state, "credits": state_credits}


@app.get("/api/credits/{credit_id}")
def get_credit(credit_id: str):
    credit = next((c for c in credits if c["id"] == credit_id), None)
    if not credit:
        raise HTTPException(404, f"Credit {credit_id} not found")
    rules = get_rules_for_credit(credit_id)
    return {**credit, "rules": rules}


@app.post("/api/eligibility/check")
def check_eligibility(user: UserScenario):
    """
    Check which credits the user qualifies for given their scenario.
    Returns: list of credits with eligibility status.
    """
    if not user.state:
        raise HTTPException(400, "User must specify state")

    candidate_credits = get_credits_for_state(user.state.upper())
    results = []

    # Conditional rule pairs: when one applies the other is N/A
    conditional_pairs = [
        ("federal_agi_max_under70", "federal_agi_max_70plus"),
        ("agi_max_single", "agi_max_mfj"),
        ("agi_max_single", "agi_max_hoh"),
        ("agi_max_mfj", "agi_max_hoh"),
        ("agi_phaseout_single", "agi_phaseout_mfj"),
        ("age_min_no_kids", "age_max_no_kids"),
    ]

    for credit in candidate_credits:
        rules = get_rules_for_credit(credit["id"])
        rule_results = []
        for r in rules:
            res = evaluate_rule(r, user)
            res["rule_type"] = r["rule_type"]
            rule_results.append(res)

        evaluated_types = {r["rule_type"] for r in rule_results if r["was_evaluated"]}
        filtered = []
        for r in rule_results:
            if not r["was_evaluated"]:
                paired = False
                for a, b in conditional_pairs:
                    if r["rule_type"] == a and b in evaluated_types:
                        paired = True; break
                    if r["rule_type"] == b and a in evaluated_types:
                        paired = True; break
                if paired:
                    continue
            filtered.append(r)

        evaluated = [r for r in filtered if r["was_evaluated"]]
        unknown = [r for r in filtered if not r["was_evaluated"]]
        failing = [r for r in evaluated if r["passes"] is False]
        passing = [r for r in evaluated if r["passes"] is True]

        if failing:
            status = "ineligible"
        elif unknown:
            status = "needs_info"
        else:
            status = "eligible"

        results.append({
            "credit": credit,
            "status": status,
            "passing_rules": passing,
            "failing_rules": failing,
            "unknown_rules": unknown,
            "estimated_amount": _estimate_amount(credit, user, status),
        })

    # Sort: eligible first, then needs_info, then ineligible
    order = {"eligible": 0, "needs_info": 1, "ineligible": 2}
    results.sort(key=lambda r: (order[r["status"]], -float(r["credit"].get("max_amount") or 0)))
    return {"state": user.state, "results": results}


def _estimate_amount(credit: dict, user: UserScenario, status: str) -> Optional[float]:
    """Best-effort estimate of credit amount. Directional only."""
    if status == "ineligible":
        return 0
    max_amt = credit.get("max_amount")
    if max_amt:
        try:
            return float(max_amt)
        except ValueError:
            return None
    return None


@app.post("/api/whatif/compare")
def whatif_compare(req: CompareRequest):
    """Compare base scenario vs same scenario in different states."""
    base = req.base_scenario
    base_result = check_eligibility(base)
    base_state_tax = calculate_state_tax(
        base.state, base.federal_agi or 0, base.filing_status or "single"
    ) if base.state else 0

    comparisons = []
    for state_code in req.comparison_states:
        scenario = base.model_copy(update={"state": state_code})
        result = check_eligibility(scenario)
        state_tax = calculate_state_tax(
            state_code, scenario.federal_agi or 0, scenario.filing_status or "single"
        )
        eligible_credits = [r for r in result["results"] if r["status"] == "eligible"]
        total_credit_value = sum(
            (r.get("estimated_amount") or 0) for r in eligible_credits
        )
        comparisons.append({
            "state": state_code,
            "estimated_state_tax": state_tax,
            "eligible_credit_count": len(eligible_credits),
            "estimated_total_credits": total_credit_value,
            "net_estimate": state_tax - total_credit_value,
            "results": result["results"],
        })

    return {
        "base": {
            "state": base.state,
            "estimated_state_tax": base_state_tax,
            "results": base_result["results"],
        },
        "comparisons": comparisons,
    }
