// Company dates the daily check doesn't know about (trading updates, results, confirmed ex-div dates).
// Edit this file on GitHub to add more: the app reads it each time it opens, no new APK needed.
// Fields: code, t (YYYY-MM-DD), type (shown in the app), kind ("R" results/update, "D" ex-dividend),
// note (optional), expect (optional: [what, what's expected] pairs to judge beat or miss).
// L&G dates from group.legalandgeneral.com/en/investors/financial-calendar (checked 15 Nov 2026), all 7am.
window.EVENTS = [
  { "code": "LGEN", "t": "2026-11-16", "kind": "R", "type": "Q3 trading update",
    "note": "First-ever quarterly update, no analyst call.",
    "expect": [
      ["UK PRT written in Q3", "about £4.8bn (HL). L&G said in Aug it had a further c.£3.5bn done or exclusive since June"],
      ["Solvency II ratio", "above 210% (HL). Was 201% at June, 209% pro forma after the debt refinancing"],
      ["2026 core EPS growth", "already guided above the top of 6-9%: a firmer, higher number is the beat"],
      ["Asset management flows", "further outflows expected"],
      ["UK PRT market 2026", "L&G said below £50bn: a further cut would be a miss"],
      ["Dividend cover", "H1 capital generation £790m (consensus £750m), cover about 1.2x. Good: repeats 'dividend covered by core EPS this year'. Warning: that wording dropped or softened"]
    ] },
  { "code": "LGEN", "t": "2027-03-08", "kind": "R", "type": "Full year results 2026",
    "expect": [
      ["Dividend cover", "about 1.2x on capital generation is thin but planned. Under 1.0x = real warning. Core EPS should cover the dividend (management guidance)"],
      ["Capital generation", "on track for £5-6bn over 2025-27"]
    ] },
  { "code": "LGEN", "t": "2027-04-22", "kind": "D", "type": "Ex-dividend (final, confirmed date)" },
  { "code": "LGEN", "t": "2027-05-20", "kind": "R", "type": "Q1 trading update" },
  { "code": "LGEN", "t": "2027-08-11", "kind": "R", "type": "Half year results 2027" },
  { "code": "LGEN", "t": "2027-08-19", "kind": "D", "type": "Ex-dividend (interim, confirmed date)" },
  { "code": "LGEN", "t": "2027-11-17", "kind": "R", "type": "Q3 trading update" }
];
