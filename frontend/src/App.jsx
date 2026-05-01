import React, { useState, useEffect } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup, Marker, Line } from 'react-simple-maps';
import { scaleLinear } from 'd3-scale';
import { geoCentroid } from 'd3-geo';

const API_BASE = import.meta.env.VITE_API_URL || "";

// US states topojson (simplified, hosted)
const US_TOPO = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

// Tier 1 states (full data)
const TIER_1_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

// Map state name → 2-letter code
const STATE_NAME_TO_CODE = {
  "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
  "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
  "District of Columbia": "DC", "Florida": "FL", "Georgia": "GA", "Hawaii": "HI",
  "Idaho": "ID", "Illinois": "IL", "Indiana": "IN", "Iowa": "IA",
  "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME",
  "Maryland": "MD", "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN",
  "Mississippi": "MS", "Missouri": "MO", "Montana": "MT", "Nebraska": "NE",
  "Nevada": "NV", "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM",
  "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH",
  "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI",
  "South Carolina": "SC", "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX",
  "Utah": "UT", "Vermont": "VT", "Virginia": "VA", "Washington": "WA",
  "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY",
};

const STATE_FIPS_TO_CODE = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO",
  "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI",
  "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
  "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN",
  "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
  "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
  "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
  "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA",
  "54": "WV", "55": "WI", "56": "WY"
};

// Northeast cluster — labels placed in Atlantic to the east, [longitude, latitude]
const LABEL_OFFSETS = {
  "NH": [-69.5, 43.5],
  "MA": [-69.0, 41.8],
  "CT": [-71.5, 40.5],
  "RI": [-69.5, 41.0],
  "VT": [-71.5, 44.8],
  "NJ": [-72.8, 39.5],
  "DE": [-73.5, 38.5],
  "MD": [-73.0, 37.8],
};

export default function App() {
  const [selectedState, setSelectedState] = useState(null);
  const [tab, setTab] = useState("explore"); // explore | wizard | compare
  const [scenario, setScenario] = useState({
    state: "DC",
    federal_agi: 50000,
    earned_income: 50000,
    investment_income: 0,
    filing_status: "single",
    age: 30,
    dependents: 0,
    months_resident: 12,
    citizenship: "citizen",
    rents_or_owns: "rent",
    public_housing: false,
    claimed_as_dependent: false,
    has_valid_ssn: true,
  });
  const [results, setResults] = useState(null);
  const [compareResults, setCompareResults] = useState(null);
  const [compareStates, setCompareStates] = useState(["VA", "MD"]);
  const [stateCredits, setStateCredits] = useState([]);
  const [showFederal, setShowFederal] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState([-96, 38]);

  // Fetch credits when state selected
  useEffect(() => {
    if (selectedState) {
      fetch(`${API_BASE}/api/states/${selectedState}`)
        .then(r => r.json())
        .then(data => setStateCredits(data.credits || []))
        .catch(() => setStateCredits([]));
    }
  }, [selectedState]);

  const handleStateClick = (geo) => {
    const stateName = geo.properties.name;
    const code = STATE_NAME_TO_CODE[stateName];
    if (code && TIER_1_STATES.includes(code)) {
      setSelectedState(code);
      setScenario(prev => ({ ...prev, state: code }));
    } else if (code) {
      // Tier 2 — show federal-only message
      setSelectedState(code);
    }
  };

  const checkEligibility = async () => {
    const res = await fetch(`${API_BASE}/api/eligibility/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scenario),
    });
    const data = await res.json();
    setResults(data);
  };

  const runCompare = async () => {
    const res = await fetch(`${API_BASE}/api/whatif/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base_scenario: scenario,
        comparison_states: compareStates,
      }),
    });
    const data = await res.json();
    setCompareResults(data);
  };

  // Color scale for map (deeper = more credits)
  const colorScale = scaleLinear()
    .domain([0, 5, 10])
    .range(["#f1efe8", "#b5d4f4", "#185fa5"]);

  return (
    <>
      <header className="hero">
        <div className="header-row">
          <h1>TaxTabula</h1>
          <span className="tax-year-badge">Tax Year 2025</span>
        </div>
        <p className="tagline">State and federal tax credits you might be missing. Click a state to see what's available, who qualifies, and what you could be saving.</p>
      </header>

      <div className="container">
        <div className="tab-bar">
          <button className={`tab ${tab === "explore" ? "active" : ""}`} onClick={() => setTab("explore")}>
            Explore by state
          </button>
          <button className={`tab ${tab === "wizard" ? "active" : ""}`} onClick={() => setTab("wizard")}>
            What can I claim?
          </button>
          <button className={`tab ${tab === "compare" ? "active" : ""}`} onClick={() => setTab("compare")}>
            Compare locations
          </button>
        </div>

        {tab === "explore" && (
          <div className="layout">
            <div className="map-wrapper">
              <div style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
                <label style={{ fontSize: 13, color: "var(--ink-muted)" }}>Or pick a state:</label>
                <select
                  value={selectedState || ""}
                  onChange={e => {
                    const code = e.target.value;
                    if (code) {
                      setSelectedState(code);
                      setScenario(prev => ({ ...prev, state: code }));
                    }
                  }}
                  style={{ padding: "6px 12px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 14 }}
                >
                  <option value="">— Select —</option>
                  {Object.entries(STATE_NAME_TO_CODE)
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([name, code]) => (
                      <option key={code} value={code}>
                        {name} {TIER_1_STATES.includes(code) ? "✓" : ""}
                      </option>
                    ))}
                </select>
              </div>
              <div className="zoom-controls">
                <button className="zoom-btn" onClick={() => setZoom(Math.min(zoom * 1.5, 8))}>+</button>
                <button className="zoom-btn" onClick={() => setZoom(Math.max(zoom / 1.5, 1))}>−</button>
                <button className="zoom-btn reset" onClick={() => { setZoom(1); setCenter([-96, 38]); }}>Reset</button>
              </div>
              <ComposableMap
                projection="geoAlbersUsa"
                projectionConfig={{ scale: 1000 }}
                width={800}
                height={520}
                style={{ width: "100%", height: "auto", display: "block" }}
              >
                <ZoomableGroup
                  zoom={zoom}
                  center={center}
                  minZoom={1}
                  maxZoom={8}
                  translateExtent={[[-200, -200], [1000, 700]]}
                  onMoveEnd={({ coordinates, zoom: z }) => { setCenter(coordinates); setZoom(z); }}
                >
                  <Geographies geography={US_TOPO}>
                    {({ geographies }) =>
                      geographies.map((geo) => {
                        const stateName = geo.properties.name;
                        const code = STATE_NAME_TO_CODE[stateName] || STATE_FIPS_TO_CODE[geo.id];
                        const isTier1 = TIER_1_STATES.includes(code);
                        const isSelected = selectedState === code;
                        const centroid = geoCentroid(geo);
                        const offsetCoords = LABEL_OFFSETS[code];
                        return (
                          <g key={geo.rsmKey}>
                            <Geography
                              geography={geo}
                              onClick={() => handleStateClick(geo)}
                              style={{
                                default: {
                                  fill: isSelected ? "#185fa5" : (isTier1 ? "#85b7eb" : "#e5e5e0"),
                                  stroke: "#fafaf7",
                                  strokeWidth: 0.5,
                                  outline: "none",
                                  cursor: "pointer",
                                },
                                hover: {
                                  fill: isTier1 ? "#378ade" : "#d3d1c7",
                                  outline: "none",
                                },
                                pressed: { outline: "none" },
                              }}
                            />
                            {code && code !== "DC" && !offsetCoords && (
                              <Marker coordinates={centroid}>
                                <text
                                  textAnchor="middle"
                                  dy={3}
                                  fontSize={9}
                                  fontWeight={700}
                                  fill="#ffffff"
                                  stroke="rgba(0,0,0,0.4)"
                                  strokeWidth={0.5}
                                  paintOrder="stroke"
                                  style={{ pointerEvents: "none", userSelect: "none" }}
                                >
                                  {code}
                                </text>
                              </Marker>
                            )}
                            {offsetCoords && (
                              <>
                                <Line
                                  from={centroid}
                                  to={offsetCoords}
                                  stroke="#94a3b8"
                                  strokeWidth={0.5}
                                  strokeLinecap="round"
                                />
                                <Marker coordinates={offsetCoords}>
                                  <text
                                    textAnchor="start"
                                    dy={3}
                                    dx={3}
                                    fontSize={8}
                                    fontWeight={700}
                                    fill="#475569"
                                    style={{ pointerEvents: "none", userSelect: "none" }}
                                  >
                                    {code}
                                  </text>
                                </Marker>
                              </>
                            )}
                          </g>
                        );
                      })
                    }
                  </Geographies>
                  <Marker
                    coordinates={[-77.0369, 38.9072]}
                    onClick={() => { setSelectedState("DC"); setScenario(prev => ({ ...prev, state: "DC" })); }}
                  >
                    <circle r={4} fill={selectedState === "DC" ? "#185fa5" : "#378ade"} stroke="#fff" strokeWidth={1.5} style={{ cursor: "pointer" }} />
                    <text x={8} y={4} fontSize={10} fill="var(--ink)">DC</text>
                  </Marker>
                </ZoomableGroup>
              </ComposableMap>
              <div style={{ marginTop: 12, fontSize: 12, color: "var(--ink-muted)", textAlign: "center" }}>
                <span style={{ display: "inline-block", width: 12, height: 12, background: "#85b7eb", marginRight: 4, verticalAlign: "middle" }}></span>
                Full data available
                <span style={{ display: "inline-block", width: 12, height: 12, background: "#e5e5e0", marginLeft: 16, marginRight: 4, verticalAlign: "middle" }}></span>
                Federal credits only (more states coming)
              </div>
            </div>

            <div className="card">
              {!selectedState && (
                <div className="empty-state">
                  Click any state on the map to see available tax credits.
                </div>
              )}
              {selectedState && !TIER_1_STATES.includes(selectedState) && (
                <div className="empty-state">
                  <p><strong>{selectedState}</strong> data is being verified.</p>
                  <p>Federal credits still apply — switch to "What can I claim?" to check.</p>
                </div>
              )}
              {selectedState && TIER_1_STATES.includes(selectedState) && (() => {
                const stateOnlyCredits = stateCredits.filter(c => c.level !== "federal");
                const federalCredits = stateCredits.filter(c => c.level === "federal");
                return (
                  <>
                    <h2>{selectedState} — {stateOnlyCredits.length} state credits</h2>
                    {stateOnlyCredits.map(c => (
                      <div key={c.id} className="credit-card">
                        <div className="name">{c.name}</div>
                        {c.max_amount && <div className="amount">Up to ${parseInt(c.max_amount).toLocaleString()}</div>}
                        <div className="desc">{c.short_description}</div>
                        <div className="meta">
                          <span className="state-badge">{c.state_code}</span>
                          <span>{c.refundable === "TRUE" ? "Refundable" : c.refundable === "partial" ? "Partially refundable" : "Non-refundable"}</span>
                          <span>{c.type}</span>
                        </div>
                      </div>
                    ))}
                    {federalCredits.length > 0 && (
                      <>
                        <button
                          className="secondary"
                          style={{ width: "100%", marginTop: 16, marginBottom: 12 }}
                          onClick={() => setShowFederal(!showFederal)}
                        >
                          {showFederal
                            ? `− Hide federal credits`
                            : `+ Show ${federalCredits.length} federal credits`}
                        </button>
                        {showFederal && (
                          <div style={{ background: "var(--bg)", padding: 12, borderRadius: 8 }}>
                            <div style={{ fontSize: 13, color: "var(--ink-muted)", marginBottom: 8 }}>
                              Federal credits (apply nationwide)
                            </div>
                            {federalCredits.map(c => (
                              <div key={c.id} className="credit-card">
                                <div className="name">{c.name}</div>
                                {c.max_amount && <div className="amount">Up to ${parseInt(c.max_amount).toLocaleString()}</div>}
                                <div className="desc">{c.short_description}</div>
                                <div className="meta">
                                  <span className="state-badge">Federal</span>
                                  <span>{c.refundable === "TRUE" ? "Refundable" : c.refundable === "partial" ? "Partially refundable" : "Non-refundable"}</span>
                                  <span>{c.type}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {tab === "wizard" && (
          <div className="layout">
            <div className="card">
              <h2>Tell us about you</h2>
              <p style={{ color: "var(--ink-muted)", fontSize: 13, marginBottom: 16 }}>
                Nothing is saved. This stays in your browser only.
              </p>

              <div className="form-group">
                <label>State</label>
                <select value={scenario.state} onChange={e => setScenario({ ...scenario, state: e.target.value })}>
                  {TIER_1_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Federal AGI ($)</label>
                  <input type="number" value={scenario.federal_agi}
                    onChange={e => setScenario({ ...scenario, federal_agi: +e.target.value, earned_income: +e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Investment income ($)</label>
                  <input type="number" value={scenario.investment_income}
                    onChange={e => setScenario({ ...scenario, investment_income: +e.target.value })} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Filing status</label>
                  <select value={scenario.filing_status} onChange={e => setScenario({ ...scenario, filing_status: e.target.value })}>
                    <option value="single">Single</option>
                    <option value="mfj">Married filing jointly</option>
                    <option value="mfs">Married filing separately</option>
                    <option value="hoh">Head of household</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Age</label>
                  <input type="number" value={scenario.age}
                    onChange={e => setScenario({ ...scenario, age: +e.target.value })} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Dependents</label>
                  <input type="number" value={scenario.dependents}
                    onChange={e => setScenario({ ...scenario, dependents: +e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Rent or own?</label>
                  <select value={scenario.rents_or_owns} onChange={e => setScenario({ ...scenario, rents_or_owns: e.target.value })}>
                    <option value="rent">Rent</option>
                    <option value="own">Own</option>
                    <option value="free">Neither</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Months in state</label>
                  <input type="number" min="0" max="12" value={scenario.months_resident}
                    onChange={e => setScenario({ ...scenario, months_resident: +e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Citizenship</label>
                  <select value={scenario.citizenship} onChange={e => setScenario({ ...scenario, citizenship: e.target.value })}>
                    <option value="citizen">US citizen</option>
                    <option value="resident_alien">Resident alien</option>
                    <option value="nonresident_alien">Non-resident alien</option>
                  </select>
                </div>
              </div>

              <button className="primary" onClick={checkEligibility}>Check what I qualify for</button>
            </div>

            <div className="card">
              {!results && <div className="empty-state">Fill in your info and click "Check" to see your credits.</div>}
              {results && (
                <>
                  <h2>Your results — {scenario.state}</h2>
                  <p style={{ fontSize: 13, color: "var(--ink-muted)", marginBottom: 16 }}>
                    Estimates are directional. Always confirm with a CPA before filing.
                  </p>
                  {results.results.map((r, i) => (
                    <div key={i} className={`credit-card ${r.status}`}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div className="name">{r.credit.name}</div>
                        <span className={`status-pill ${r.status}`}>
                          {r.status === "eligible" ? "Likely eligible" : r.status === "needs_info" ? "Maybe — need info" : "Not eligible"}
                        </span>
                      </div>
                      {r.estimated_amount > 0 && r.status === "eligible" && (
                        <div className="amount">Up to ${parseInt(r.estimated_amount).toLocaleString()}</div>
                      )}
                      <div className="desc">{r.credit.short_description}</div>
                      {r.failing_rules.length > 0 && (
                        <div style={{ fontSize: 12, color: "var(--red)", marginTop: 6 }}>
                          ✗ {r.failing_rules[0].reason}
                        </div>
                      )}
                      {r.unknown_rules.length > 0 && r.status === "needs_info" && (
                        <div style={{ fontSize: 12, color: "var(--amber)", marginTop: 6 }}>
                          ? {r.unknown_rules[0].reason}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {tab === "compare" && (
          <div className="layout">
            <div className="card">
              <h2>Compare locations</h2>
              <p style={{ color: "var(--ink-muted)", fontSize: 13, marginBottom: 16 }}>
                See how your tax situation changes across different states. Useful when considering a move.
              </p>

              <div className="form-group">
                <label>Currently in</label>
                <select value={scenario.state} onChange={e => setScenario({ ...scenario, state: e.target.value })}>
                  {TIER_1_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Federal AGI ($)</label>
                <input type="number" value={scenario.federal_agi}
                  onChange={e => setScenario({ ...scenario, federal_agi: +e.target.value, earned_income: +e.target.value })} />
              </div>

              <div className="form-group">
                <label>Filing status</label>
                <select value={scenario.filing_status} onChange={e => setScenario({ ...scenario, filing_status: e.target.value })}>
                  <option value="single">Single</option>
                  <option value="mfj">Married filing jointly</option>
                  <option value="hoh">Head of household</option>
                </select>
              </div>

              <h3>Compare against</h3>
              {TIER_1_STATES.filter(s => s !== scenario.state).map(s => (
                <label key={s} style={{ display: "inline-block", marginRight: 12, fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={compareStates.includes(s)}
                    onChange={e => {
                      if (e.target.checked) setCompareStates([...compareStates, s]);
                      else setCompareStates(compareStates.filter(x => x !== s));
                    }}
                  /> {s}
                </label>
              ))}

              <button className="primary" style={{ marginTop: 16 }} onClick={runCompare}>Compare</button>
            </div>

            <div className="card">
              {!compareResults && <div className="empty-state">Pick states and click Compare.</div>}
              {compareResults && (
                <>
                  <h2>Side-by-side</h2>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", fontSize: 14, borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid var(--border)" }}>
                          <th style={{ textAlign: "left", padding: "8px 0" }}>State</th>
                          <th style={{ textAlign: "right" }}>State tax</th>
                          <th style={{ textAlign: "right" }}>Eligible credits</th>
                          <th style={{ textAlign: "right" }}>Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--accent-light)" }}>
                          <td style={{ padding: "10px 0" }}><strong>{compareResults.base.state}</strong> (current)</td>
                          <td style={{ textAlign: "right" }}>${compareResults.base.estimated_state_tax.toFixed(0)}</td>
                          <td style={{ textAlign: "right" }}>{compareResults.base.results.filter(r => r.status === "eligible").length}</td>
                          <td style={{ textAlign: "right" }}>—</td>
                        </tr>
                        {compareResults.comparisons.map(c => (
                          <tr key={c.state} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ padding: "10px 0" }}>{c.state}</td>
                            <td style={{ textAlign: "right" }}>${c.estimated_state_tax.toFixed(0)}</td>
                            <td style={{ textAlign: "right" }}>{c.eligible_credit_count}</td>
                            <td style={{ textAlign: "right", fontWeight: 500, color: c.net_estimate < compareResults.base.estimated_state_tax ? "var(--green)" : "var(--ink)" }}>
                              ${c.net_estimate.toFixed(0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 16 }}>
                    "Net" = state tax minus estimated value of credits you'd qualify for. Directional only.
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        <footer>
          TaxTabula — Built by Wonseok (Eddie) Lee · Data sourced from official state DOR sites and IRS.gov ·
          <a href="https://github.com/wonseok3lee-spec/taxtabula" target="_blank" rel="noopener"> GitHub</a>
          <br />
          Estimates are directional. Always confirm with a CPA before filing.
        </footer>
      </div>
    </>
  );
}
