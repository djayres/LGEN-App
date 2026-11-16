// Results / trading update scorecards, newest first. Written by the 7:10am results-day check.
// The app shows the newest one as a banner for 7 days and opens it automatically the first time.
// Fields: id, code, t (YYYY-MM-DD), type, overall (BEAT | MIXED | MISS), headline, lines: [what, actual, expected, verdict, note],
// other: [text], guidance (quote), reaction (optional), sources: [[title, url]], updated.
window.RESULTS = [
  { "id": "LGEN-2026-11-16", "code": "LGEN", "t": "2026-11-16", "type": "Q3 trading update", "overall": "MIXED",
    "headline": "PRT deals missed forecast by ~20%; solvency, retail and EPS guidance on or ahead of plan",
    "lines": [
      ["PRT written in Q3", "£3.7bn", "£4.6bn consensus (HL said ~£4.8bn)", "MISS", "Up from £2.4bn in Q3 2025. 9M completed £5.8bn vs £5.9bn last year. £6.7bn written or exclusive YTD (£6.2bn UK)"],
      ["Solvency II ratio", "213%", "212% consensus", "IN LINE", "Up from 201% at H1. c.1-2 point Q4 hit expected from US dollar hedging changes"],
      ["2026 core EPS growth", "Above top-end of 6-9% (unchanged)", "A firmer, higher number", "IN LINE", "Reaffirmed, not upgraded"],
      ["Asset management net outflows (Q3)", "£3bn", "£4.5bn consensus", "BEAT", "YTD outflows £28bn. AUM £1,230bn"],
      ["Asset management new revenue (Q3 ANNR)", "£2m", "£15.1m consensus", "MISS", "YTD ANNR £25m, positive for 8th quarter"],
      ["Workplace net flows (Q3)", "£4.5bn", "£3.7bn consensus", "BEAT", "vs £1.0bn in Q3 2025. Workplace AUA £133.3bn vs £132bn expected"],
      ["Protection sales (Q3)", "£80.1m", "£69.1m consensus", "BEAT", "Up 19% on Q3 2025"],
      ["UK PRT market 2026", "No size given", "Below £50bn; a further cut = miss", "NOT GIVEN", "\"Market remains active... precise timing of individual transactions remains uncertain\""],
      ["Dividend cover", "Not mentioned", "Repeat 'dividend covered by core EPS this year'", "NOT GIVEN", "Wording not repeated in this short update: watch at full year"]
    ],
    "other": [
      "Asset optimisation on track to exceed £400m in 2026 (£288m at H1)",
      "c.1,000 fewer roles by mid-2027 reconfirmed (first announced Sept)",
      "No dividend, buyback or M&A news. Full year results 8 Mar 2027"
    ],
    "guidance": "Core operating EPS growth \"above the top-end of our 6-9% target range for 2026\"",
    "sources": [
      ["L&G announcements (RNS)", "https://www.investegate.co.uk/company/LGEN"],
      ["Reuters: Q3 pension deals miss forecast", "https://ca.investing.com/news/earnings/legal--general-q3-pension-deals-miss-forecast-earnings-growth-outlook-reaffirmed-4959699"]
    ],
    "updated": "2026-11-16 08:00" }
];
