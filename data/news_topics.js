// News searches per share, copied from the platform (swing_system/news_topics.json).
window.NEWS_TOPICS = {
 "LGEN": {
  "region": "GB",
  "label": "L&G",
  "names": [
   "\"Legal & General\"",
   "\"Legal and General\"",
   "LGEN shares",
   "\"L&G\" shares OR results OR \"trading update\""
  ],
  "must": "Legal (&|and) General|\\bL&G\\b|\\bLGEN\\b",
  "topics": [
   {
    "id": "inf",
    "label": "Inflation",
    "q": [
     "\"UK inflation\"",
     "UK CPI inflation"
    ],
    "must": "inflation|\\bCPI\\b|prices"
   },
   {
    "id": "boe",
    "label": "BoE / rates",
    "q": [
     "\"Bank of England\" interest rates"
    ],
    "must": "rate|Bank of England|\\bBoE\\b|MPC|Bailey"
   },
   {
    "id": "gilt",
    "label": "Gilts",
    "q": [
     "gilt yields",
     "\"30-year gilt\" OR \"10-year gilt\""
    ],
    "must": "gilt|yield|borrowing cost|bond"
   },
   {
    "id": "prt",
    "label": "Pensions & annuities",
    "q": [
     "\"pension risk transfer\"",
     "bulk annuity buyout",
     "UK annuity rates",
     "Reeves pensions"
    ],
    "must": "pension|annuit|buy-?out|buy-?in"
   },
   {
    "id": "peers",
    "label": "Insurers (Aviva, M&G, Phoenix)",
    "q": [
     "Aviva shares",
     "\"M&G\" shares OR results",
     "\"Standard Life\" OR \"Phoenix Group\" shares",
     "UK insurers shares",
     "Rothesay OR \"Just Group\" OR \"Pension Insurance Corporation\""
    ],
    "must": "Aviva|M&G|Phoenix|Standard Life|insurer|Rothesay|Just Group|Pension Insurance|Prudential"
   }
  ]
 },
 "SDLF": {
  "region": "GB",
  "names": [
   "\"Standard Life\" shares OR results",
   "\"Phoenix Group\"",
   "SDLF shares"
  ],
  "must": "Standard Life|Phoenix|\\bSDLF\\b",
  "topics": [
   {
    "id": "gilt",
    "label": "Gilts",
    "q": [
     "gilt yields"
    ],
    "must": "gilt|yield|borrowing cost|bond"
   },
   {
    "id": "prt",
    "label": "Pensions & annuities",
    "q": [
     "\"pension risk transfer\"",
     "UK annuity rates"
    ],
    "must": "pension|annuit|buy-?out|buy-?in"
   },
   {
    "id": "peers",
    "label": "UK insurers",
    "q": [
     "\"Legal & General\" shares",
     "Aviva shares",
     "UK insurers shares"
    ],
    "must": "Aviva|M&G|Legal (&|and) General|L&G|insurer"
   }
  ]
 },
 "NG": {
  "region": "GB",
  "names": [
   "\"National Grid\" shares OR results OR dividend",
   "\"National Grid\" plc"
  ],
  "must": "National Grid",
  "topics": [
   {
    "id": "ofgem",
    "label": "Ofgem / grid",
    "q": [
     "Ofgem electricity networks",
     "UK electricity grid investment",
     "New York utility rate case"
    ],
    "must": "Ofgem|grid|network|utilit|rate case|energy bills"
   },
   {
    "id": "boe",
    "label": "Rates",
    "q": [
     "\"Bank of England\" interest rates",
     "gilt yields"
    ],
    "must": "rate|Bank of England|\\bBoE\\b|gilt|yield"
   }
  ]
 },
 "CAML": {
  "region": "GB",
  "names": [
   "\"Central Asia Metals\""
  ],
  "must": "Central Asia Metals|\\bCAML\\b",
  "topics": [
   {
    "id": "cu",
    "label": "Copper & zinc",
    "q": [
     "copper price",
     "zinc price"
    ],
    "must": "copper|zinc|metal"
   },
   {
    "id": "china",
    "label": "China demand",
    "q": [
     "China copper demand OR imports"
    ],
    "must": "China|Chinese"
   }
  ]
 },
 "HOC": {
  "region": "GB",
  "names": [
   "\"Hochschild Mining\"",
   "Hochschild shares OR production OR results",
   "\"Mara Rosa\" OR Inmaculada OR \"Monte do Carmo\""
  ],
  "must": "Hochschild|Mara Rosa|Inmaculada|Monte do Carmo|San Jos[e\u00e9]|\\bHOC\\b",
  "topics": [
   {
    "id": "ag",
    "label": "Silver & gold",
    "q": [
     "silver price",
     "gold price"
    ],
    "must": "silver|gold|precious"
   },
   {
    "id": "peru",
    "label": "Peru / Brazil / Argentina",
    "q": [
     "Peru mining",
     "Brazil gold mining",
     "Argentina mining"
    ],
    "must": "Peru|Brazil|Argentin|mining|mine"
   },
   {
    "id": "peers",
    "label": "Silver miners",
    "q": [
     "Fresnillo shares",
     "silver miners stocks"
    ],
    "must": "Fresnillo|silver|miner"
   }
  ]
 },
 "HYMC": {
  "region": "US",
  "names": [
   "\"Hycroft Mining\"",
   "Hycroft HYMC"
  ],
  "must": "Hycroft|\\bHYMC\\b",
  "topics": [
   {
    "id": "ag",
    "label": "Gold & silver",
    "q": [
     "gold price",
     "silver price"
    ],
    "must": "silver|gold|precious"
   },
   {
    "id": "meme",
    "label": "Small miners",
    "q": [
     "junior gold miners stocks"
    ],
    "must": "miner|mining"
   }
  ]
 },
 "GOOGL": {
  "region": "US",
  "names": [
   "Alphabet stock",
   "Google Alphabet shares",
   "Alphabet earnings OR results"
  ],
  "must": "Alphabet|Google|GOOGL",
  "topics": [
   {
    "id": "ai",
    "label": "AI",
    "q": [
     "Google Gemini",
     "AI stocks"
    ],
    "must": "\\bAI\\b|Gemini|artificial intelligence|chip"
   },
   {
    "id": "reg",
    "label": "Regulators",
    "q": [
     "Google antitrust OR regulator"
    ],
    "must": "antitrust|regulat|court|judge|DOJ|EU|fine"
   },
   {
    "id": "fed",
    "label": "Fed / Nasdaq",
    "q": [
     "Federal Reserve interest rates",
     "Nasdaq stocks today"
    ],
    "must": "Fed|rate|Nasdaq|stocks"
   }
  ]
 },
 "NBIS": {
  "region": "US",
  "names": [
   "\"Nebius\""
  ],
  "must": "Nebius|\\bNBIS\\b",
  "topics": [
   {
    "id": "ai",
    "label": "AI cloud",
    "q": [
     "\"AI data center\" GPU cloud",
     "neocloud CoreWeave OR Nebius OR Oracle AI"
    ],
    "must": "\\bAI\\b|GPU|data cent|cloud|CoreWeave"
   },
   {
    "id": "nvda",
    "label": "Nvidia / chips",
    "q": [
     "Nvidia GPU OR earnings"
    ],
    "must": "Nvidia|GPU|chip"
   },
   {
    "id": "aimkt",
    "label": "AI stocks",
    "q": [
     "AI stocks bubble OR selloff OR rally"
    ],
    "must": "\\bAI\\b"
   }
  ]
 },
 "SNDK": {
  "region": "US",
  "names": [
   "\"SanDisk\" stock OR shares OR earnings",
   "\"Sandisk\""
  ],
  "must": "Sandisk|\\bSNDK\\b",
  "topics": [
   {
    "id": "nand",
    "label": "Memory chips",
    "q": [
     "NAND flash prices",
     "memory chip prices"
    ],
    "must": "NAND|flash|memory|DRAM|chip"
   },
   {
    "id": "peers",
    "label": "Micron / WD / Samsung",
    "q": [
     "Micron earnings OR stock",
     "Western Digital OR Seagate OR \"SK Hynix\" stock"
    ],
    "must": "Micron|Western Digital|Seagate|Hynix|Samsung|Kioxia"
   },
   {
    "id": "aimkt",
    "label": "AI stocks",
    "q": [
     "AI stocks bubble OR selloff OR rally"
    ],
    "must": "\\bAI\\b"
   }
  ]
 },
 "FPS": {
  "region": "US",
  "names": [
   "\"Forgent\" power OR stock OR earnings",
   "\"Forgent Power\""
  ],
  "must": "Forgent|\\bFPS\\b",
  "topics": [
   {
    "id": "dc",
    "label": "Data centres & power",
    "q": [
     "data center power demand electrical equipment",
     "AI data center construction"
    ],
    "must": "data cent|power|grid|electric"
   },
   {
    "id": "peers",
    "label": "Vertiv / Eaton / GE Vernova",
    "q": [
     "Vertiv OR Eaton OR \"GE Vernova\" stock"
    ],
    "must": "Vertiv|Eaton|GE Vernova|Schneider"
   },
   {
    "id": "aimkt",
    "label": "AI stocks",
    "q": [
     "AI stocks bubble OR selloff OR rally"
    ],
    "must": "\\bAI\\b"
   }
  ]
 }
};
