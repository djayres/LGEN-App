"use strict";
// LGEN phone app.
// Data: the daily 7:30am check writes data/ in github.com/djayres/LGEN-App; the app reads it from there
// (with the copy bundled into the APK as a fallback). Live prices come from Yahoo Finance when the app
// opens and every 15 minutes while the London market is open.

const REPO_RAW = "https://raw.githubusercontent.com/djayres/LGEN-App/main/data/";
const LIVE_EVERY_MS = 15 * 60 * 1000;
const STATUS_EVERY_MS = 30 * 60 * 1000;
const DAY = 86400000;

const S = {
  shares: [],          // [{code, name, ticker}]
  data: {},            // code -> chart data (candles etc)
  watch: null,         // watchlist
  live: {},            // ticker -> {price, prev, time}
  liveAt: 0, statusAt: 0, statusSource: "",
  code: "LGEN", months: 12, page: 0, events: [],
};

// ───────────────────────── helpers ─────────────────────────
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const p1 = v => v == null || isNaN(v) ? "—" : v.toFixed(1);
const p2 = v => v == null || isNaN(v) ? "—" : v.toFixed(2);
const pct = v => (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
const gbp = v => "£" + Math.round(v).toLocaleString("en-GB");
const fmtDate = s => new Date(s + (s.length === 10 ? "T12:00:00Z" : "")).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const fmtShort = s => new Date(s + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const londonDate = d => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const todayStr = () => londonDate(new Date());
const daysTo = s => Math.round((Date.parse(s + "T12:00:00Z") - Date.parse(todayStr() + "T12:00:00Z")) / DAY);
function toast(msg, important) {
  if (!important && Date.now() < (toast.lock || 0)) return;   // don't cover a status-change message
  if (important) toast.lock = Date.now() + 4000;
  const t = $("toast"); t.textContent = msg; t.style.display = "block"; clearTimeout(toast.t); toast.t = setTimeout(() => t.style.display = "none", 3500); }

function londonClock() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date()).map(p => [p.type, p.value]));
  return { wd: parts.weekday, mins: +parts.hour * 60 + +parts.minute };
}
function marketOpen() {
  const { wd, mins } = londonClock();
  return !["Sat", "Sun"].includes(wd) && mins >= 8 * 60 && mins <= 16 * 60 + 35;
}
// n trading days (Mon–Fri) before a date
function tradingDaysBefore(s, n) {
  const d = new Date(s + "T12:00:00Z");
  while (n > 0) { d.setUTCDate(d.getUTCDate() - 1); const w = d.getUTCDay(); if (w !== 0 && w !== 6) n--; }
  return d.toISOString().slice(0, 10);
}

// Files are written as "window.X = {json};" — take the JSON after the last assignment.
function parseAssign(text) {
  const re = /window\.[A-Za-z_]+(?:\["[^"]+"\])?\s*=\s*(?=[\[{])/g;
  let m, last = null;
  while ((m = re.exec(text))) last = m;
  if (!last) throw new Error("bad data file");
  return JSON.parse(text.slice(last.index + last[0].length).trim().replace(/;\s*$/, ""));
}
async function getText(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(r.status + " " + url);
  return r.text();
}
// Repo first; then the last good copy on the phone; then the copy built into the app.
async function loadDataFile(path) {
  const key = "f:" + path;
  try {
    const obj = parseAssign(await getText(REPO_RAW + path + "?t=" + Date.now()));
    try { localStorage.setItem(key, JSON.stringify(obj)); } catch (e) {}
    return { obj, src: "repo" };
  } catch (e) {
    try { const c = localStorage.getItem(key); if (c) return { obj: JSON.parse(c), src: "saved" }; } catch (e2) {}
    return { obj: parseAssign(await getText("data/" + path)), src: "built-in" };
  }
}

// ───────────────────────── indicators ─────────────────────────
function wma(values, n) {
  const out = new Array(values.length).fill(null), wsum = n * (n + 1) / 2;
  for (let i = n - 1; i < values.length; i++) {
    let s = 0;
    for (let k = 0; k < n; k++) s += values[i - n + 1 + k] * (k + 1);
    out[i] = s / wsum;
  }
  return out;
}
function ema(a, n) { const k = 2 / (n + 1), o = []; let e = a[0]; a.forEach((v, i) => { e = i ? v * k + e * (1 - k) : v; o.push(e); }); return o; }
function rsiWilder(c, n = 14) {
  const out = new Array(c.length).fill(null); let g = 0, l = 0;
  for (let i = 1; i < c.length; i++) {
    const ch = c[i] - c[i - 1], up = Math.max(ch, 0), dn = Math.max(-ch, 0);
    if (i <= n) { g += up / n; l += dn / n; } else { g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n; }
    if (i >= n) out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  }
  return out;
}
// Yahoo sometimes records stray trades far outside the day's real range: trim them (same as the dashboard).
function cleanWicks(candles) {
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i], pc = i > 0 ? candles[i - 1].c : null;
    if (pc && Math.abs(c.o / pc - 1) > 0.04 && Math.abs(c.o / c.c - 1) > 0.04 && Math.abs(c.c / pc - 1) < 0.03) c.o = pc;
    const prior = candles.slice(Math.max(0, i - 20), i).map(x => x.h - x.l).sort((a, b) => a - b);
    const med = prior.length ? prior[Math.floor(prior.length / 2)] : (c.h - c.l);
    const limit = Math.max(3 * med, 0.03 * c.c), top = Math.max(c.o, c.c), bot = Math.min(c.o, c.c);
    if (c.h - top > limit) c.h = top + med / 2;
    if (bot - c.l > limit) c.l = bot - med / 2;
  }
}
// RSI(14) and MACD(12,26) are kept from the daily file where present and worked out for new (live) days.
// MACD signal = simple 9-day average of the MACD line, to match Investing.com.
function computeIndicators(d) {
  const cs = d.candles, closes = cs.map(c => c.c);
  const r = rsiWilder(closes), e12 = ema(closes, 12), e26 = ema(closes, 26);
  cs.forEach((c, i) => {
    if (c.rsi == null || c.live) c.rsi = r[i];
    if (c.macd == null || c.live) c.macd = e12[i] - e26[i];
  });
  cs.forEach((c, i) => {
    if (i < 8 || c.macd == null) { c.macd_sig = null; c.macd_hist = null; return; }
    let s = 0; for (let k = i - 8; k <= i; k++) s += cs[k].macd;
    c.macd_sig = s / 9; c.macd_hist = c.macd - c.macd_sig;
  });
  const w50 = wma(closes, 50), w200 = wma(closes, 200);
  cs.forEach((c, i) => { c.ma50 = w50[i]; c.ma200 = w200[i]; });
}
const last = d => d.candles[d.candles.length - 1];
const prevC = d => d.candles[d.candles.length - 2];

// ───────────────────────── loading ─────────────────────────
async function loadStatus() {
  const idx = await loadDataFile("chart_data/index.js");
  S.shares = idx.obj;
  const wl = await loadDataFile("watchlist.js");
  S.watch = wl.obj;
  S.statusSource = idx.src === "repo" && wl.src === "repo" ? "repo" : wl.src;
  try { S.events = (await loadDataFile("events.js")).obj || []; } catch (e) { S.events = S.events || []; }
  const got = await Promise.all(S.shares.map(sh => loadDataFile("chart_data/" + sh.code + ".js").then(r => [sh.code, r.obj]).catch(() => null)));
  for (const g of got) if (g) { cleanWicks(g[1].candles); S.data[g[0]] = g[1]; }
  S.statusAt = Date.now();
  applyLive();
}

// Yahoo Finance daily bars (prices in pence for London shares). The app's native HTTP gets round browser limits.
async function fetchLiveOne(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=5d&interval=1d&includePrePost=false`;
  const j = JSON.parse(await getText(url));
  const r = j.chart && j.chart.result && j.chart.result[0];
  if (!r) throw new Error("no data for " + ticker);
  const q = r.indicators.quote[0], bars = [];
  (r.timestamp || []).forEach((ts, i) => {
    if (q.close[i] == null) return;
    bars.push({ t: londonDate(new Date(ts * 1000)), o: q.open[i], h: q.high[i], l: q.low[i], c: q.close[i], v: q.volume[i] || 0 });
  });
  const m = r.meta;
  return { bars, price: m.regularMarketPrice, time: m.regularMarketTime * 1000 };
}
async function loadLive() {
  const tickers = [...new Set(S.shares.map(s => s.ticker).filter(Boolean))];
  const res = await Promise.allSettled(tickers.map(t => fetchLiveOne(t).then(v => [t, v])));
  let ok = 0;
  for (const r of res) if (r.status === "fulfilled") { S.live[r.value[0]] = r.value[1]; ok++; }
  if (ok) S.liveAt = Date.now();
  applyLive();
  if (!ok && tickers.length) throw new Error("Live prices unavailable");
}
// Merge the live bars into each share's candles, then recompute indicators.
function applyLive() {
  for (const code in S.data) {
    const d = S.data[code], lv = S.live[d.ticker];
    d.candles = d.candles.filter(c => !c.added);
    if (lv && lv.bars.length) {
      const scale = lv.bars[lv.bars.length - 1].c < last(d).c * 0.2 ? 100 : 1;   // pounds → pence if needed
      for (const b0 of lv.bars) {
        const b = { ...b0, o: b0.o * scale, h: b0.h * scale, l: b0.l * scale, c: b0.c * scale };
        const lc = last(d);
        if (b.t < lc.t) continue;
        if (b.t === lc.t) { if (!lc.orig) lc.orig = { o: lc.o, h: lc.h, l: lc.l, c: lc.c, v: lc.v }; Object.assign(lc, b, { live: true }); }
        else d.candles.push({ ...b, live: true, added: true });
      }
      const lc = last(d);
      if (lv.price && lc.t === todayStr()) { lc.c = lv.price * scale; lc.h = Math.max(lc.h, lc.c); lc.l = Math.min(lc.l, lc.c); }
    }
    computeIndicators(d);
  }
  renderAll();
}

// ───────────────────────── rules: banner + next steps ─────────────────────────
function lgen() { return S.data.LGEN; }
function wlShare(ticker) { return S.watch && S.watch.shares ? S.watch.shares.find(s => s.ticker === ticker) : null; }
function keyLevel(ticker = "LGEN.L") { const s = wlShare(ticker); return s && s.key_levels && s.key_levels[0]; }

function eventsFor(code) { return (S.events || []).filter(e => e.code === code).sort((a, b) => a.t.localeCompare(b.t)); }
function nextEvent(code, within) {
  const today = todayStr();
  return eventsFor(code).find(e => e.t >= today && daysTo(e.t) <= within);
}
const whenTxt = t => { const n = daysTo(t); return n === 0 ? "today" : n === 1 ? "tomorrow" : fmtShort(t) + " (" + n + " days)"; };

function verdict() {
  const d = lgen(); if (!d) return null;
  const L = last(d), rs = d.rule_state || {}, kl = keyLevel();
  const cls = { buy: "b-buy", sell: "b-sell", hold: "b-hold", wait: "b-wait", out: "b-wait" }[rs.kind] || "b-wait";
  const word = { buy: "BUY", sell: "SELL", hold: "HOLDING", wait: "WAIT", out: "OUT" }[rs.kind] || (rs.short || "—").toUpperCase();
  let v = { cls, word, text: rs.banner || "No status from the daily check yet", sub: rs.sub || "" };
  if (kl) {
    const top = Math.max(kl.price * 1.005, kl.zone_to === "WMA200" && L.ma200 ? L.ma200 : kl.price * 1.02);
    if (L.c < kl.price) v = { cls: "b-sell", word: v.word, text: `🔴 KEY SUPPORT ${kl.price.toFixed(0)}p BROKEN · now ${p1(L.c)}p`, sub: "First crack in the uptrend. " + v.text };
    else if (L.l <= top) v.zone = `🟠 In key support zone ${kl.price.toFixed(0)}–${top.toFixed(0)}p · watch for RSI near 40 (now ${L.rsi.toFixed(0)})`;
  }
  return v;
}

function nextSteps() {
  const d = lgen(); if (!d) return [];
  const L = last(d), P = prevC(d), rs = d.rule_state || {}, wl = wlShare("LGEN.L"), steps = [];
  const t4 = S.data.LGEN_TEST4, trades = (t4 && t4.trades) || [];
  const lastBuy = [...trades].reverse().find(t => t.side === "BUY");
  const macdUp = L.macd > L.macd_sig;
  if (rs.holding) {
    if (lastBuy) steps.push({ s: "ok", t: `Holding since ${fmtDate(lastBuy.t)}`, sub: `Bought at ${p1(lastBuy.price)}p · now ${p1(L.c)}p (${pct((L.c / lastBuy.price - 1) * 100)})` });
    if (rs.winter_sell_text && rs.period === "winter") {
      const needJan = /1 Jan/.test(rs.winter_sell_text);
      const y = +todayStr().slice(0, 4), jan = (todayStr().slice(5) >= "06-01" ? y + 1 : y) + "-01-01";
      const janOk = !needJan || todayStr() >= jan;
      const rsiOk = L.rsi > (rs.winter_sell_rsi || 70);
      steps.push({ s: janOk && rsiOk && !macdUp ? "warn" : "no", t: "Next sell signal: " + rs.winter_sell_text,
        sub: [needJan ? (janOk ? "1 Jan passed ✓" : `1 Jan is in ${daysTo(jan)} days`) : null,
              `RSI now ${L.rsi.toFixed(0)} (needs over ${rs.winter_sell_rsi || 70}${rsiOk ? " ✓" : ""})`,
              `MACD ${macdUp ? "above" : "below"} its signal line${P && (P.macd > P.macd_sig) && !macdUp ? " · crossed down today" : ""}`].filter(Boolean).join(" · ") });
    }
    const ex = wl && wl.next_exdivs && wl.next_exdivs[0];
    if (ex && /ex-div/i.test(rs.exit_reason || "")) {
      const sellBy = tradingDaysBefore(ex[0], 3);
      steps.push({ s: daysTo(sellBy) <= 10 ? "warn" : "no", t: `Otherwise out by ${fmtShort(sellBy)}`,
        sub: `${rs.exit_reason} (ex-div ${fmtDate(ex[0])}, ${ex[1].toFixed(2)}p expected) · ${daysTo(sellBy)} days away` });
    }
  } else {
    steps.push({ s: "no", t: "Not holding", sub: rs.exit_reason ? "Last exit: " + rs.exit_reason : "" });
    if (rs.buy_text) {
      const rsiOk = L.rsi < (rs.buy_rsi || 40), bull = L.c > L.o;
      steps.push({ s: rsiOk && bull ? "ok" : "no", t: "Next buy signal: " + rs.buy_text,
        sub: `RSI now ${L.rsi.toFixed(0)} (needs under ${rs.buy_rsi || 40}${rsiOk ? " ✓" : ""}) · today's candle ${bull ? "bullish ✓" : "not bullish"}` });
    }
  }
  const ev = nextEvent("LGEN", 14);
  if (ev) steps.push({ s: "warn", t: `${ev.type} ${whenTxt(ev.t)}`, sub: (ev.note ? ev.note + " " : "") + "Expect a bigger move than usual on the day." });
  const kl = keyLevel();
  if (kl) steps.push({ s: L.c < kl.price ? "warn" : "ok", t: `Key support ${p1(kl.price)}p`,
    sub: `${L.c >= kl.price ? (L.c / kl.price * 100 - 100).toFixed(1) + "% above" : "BROKEN"} · ${kl.note || "a close below it would be the first crack in the uptrend"}` });
  if (rs.watch) steps.push({ s: "warn", t: "Watch: " + rs.watch, sub: "" });
  if (rs.divergence) steps.push({ s: "ok", t: "Bullish RSI divergence: " + rs.divergence, sub: "" });
  if (rs.bear_divergence) steps.push({ s: "warn", t: "Bearish RSI divergence: " + rs.bear_divergence, sub: "" });
  return steps;
}

function watchAlerts() {
  const d = lgen(); if (!d) return [];
  const L = last(d), P = prevC(d), out = [], kl = keyLevel(), wl = wlShare("LGEN.L"), rs = d.rule_state || {};
  if (kl) {
    const top = Math.max(kl.price * 1.005, kl.zone_to === "WMA200" && L.ma200 ? L.ma200 : kl.price * 1.02);
    if (L.c < kl.price) out.push(["t-red", "SUPPORT", `Below key support ${p1(kl.price)}p — first crack in the uptrend`]);
    else if (L.l <= top) out.push(["t-amber", "ZONE", `In key support zone ${kl.price.toFixed(0)}–${top.toFixed(0)}p · watch for RSI near 40`]);
    else if (L.c / kl.price < 1.04) out.push(["t-amber", "NEAR", `Within ${(L.c / kl.price * 100 - 100).toFixed(1)}% of key support`]);
  }
  if (L.rsi >= 70) out.push(["t-red", "RSI", `Overbought, RSI ${L.rsi.toFixed(0)}`]);
  else if (L.rsi <= 40) out.push(["t-green", "RSI", `RSI ${L.rsi.toFixed(0)} — in the buy zone (under 40)`]);
  else if (L.rsi >= 65) out.push(["t-amber", "RSI", `RSI ${L.rsi.toFixed(0)} — getting near 70`]);
  if (P && P.macd_hist != null && L.macd_hist != null && Math.sign(P.macd_hist) !== Math.sign(L.macd_hist))
    out.push([L.macd_hist > 0 ? "t-green" : "t-red", "MACD", `MACD crossed ${L.macd_hist > 0 ? "up through" : "down through"} its signal line`]);
  if (L.ma200 && Math.abs(L.c / L.ma200 - 1) < 0.02) out.push(["t-amber", "WMA200", `Within 2% of WMA200 (${p1(L.ma200)}p)`]);
  if (L.ma50 && Math.abs(L.c / L.ma50 - 1) < 0.01) out.push(["t-blue", "WMA50", `At WMA50 (${p1(L.ma50)}p)`]);
  const ev = nextEvent("LGEN", 14);
  if (ev) out.push(["t-amber", "RESULTS", `${ev.type} ${whenTxt(ev.t)}`]);
  const ex = wl && wl.next_exdivs && wl.next_exdivs[0];
  if (ex && daysTo(ex[0]) <= 21) out.push(["t-amber", "EX-DIV", `Ex-dividend ${fmtDate(ex[0])} (${daysTo(ex[0])} days)`]);
  if (rs.watch) out.push(["t-amber", "WATCH", rs.watch]);
  if (rs.divergence) out.push(["t-green", "÷", "Bullish RSI divergence: " + rs.divergence]);
  if (rs.bear_divergence) out.push(["t-red", "÷", "Bearish RSI divergence: " + rs.bear_divergence]);
  if (wl && wl.items) for (const v of Object.values(wl.items)) out.push(["t-blue", "CHECK", v]);
  return out;
}

// ───────────────────────── pages ─────────────────────────
function renderHeader() {
  const d = lgen(); if (!d) return;
  const L = last(d), P = prevC(d), ch = P ? (L.c / P.c - 1) * 100 : 0;
  $("top-price").textContent = p1(L.c) + "p";
  const c = $("top-chg"); c.textContent = (ch >= 0 ? "+" : "") + ch.toFixed(2) + "%"; c.className = "chg " + (ch >= 0 ? "pos" : "neg");
  const lv = S.live["LGEN.L"];
  const t = lv ? new Date(lv.time).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }) : null;
  $("top-status").innerHTML = (marketOpen() ? '<span class="green">● Open</span>' : '<span class="muted">● Closed</span>') +
    "<br>" + (t ? (L.t === todayStr() ? "Live " : "Last ") + t : "Close " + fmtDate(L.t));
}

function renderSignal() {
  const v = verdict(); if (!v) return;
  const d = lgen(), L = last(d);
  const steps = nextSteps();
  $("signal-body").innerHTML = `
    <div class="banner ${v.cls}${Date.now() < (S.flashUntil || 0) ? " flash" : ""}"><div class="big-word">${esc(v.word)}</div>${esc(v.text)}${v.sub && v.sub !== v.text ? `<small>${esc(v.sub)}</small>` : ""}</div>
    ${v.zone ? `<div class="banner b-zone" style="font-size:15px">${esc(v.zone)}</div>` : ""}
    <div class="card"><h3>What happens next</h3>
      <ul class="steps">${steps.map(s => `<li><span class="dot ${s.s}">${s.s === "ok" ? "✓" : s.s === "warn" ? "!" : "·"}</span>
        <div><div>${esc(s.t)}</div>${s.sub ? `<div class="sub">${esc(s.sub)}</div>` : ""}</div></li>`).join("")}</ul>
    </div>
    <div class="card"><h3>Now</h3>
      <div class="stat-grid">
        ${stat("Price", p1(L.c) + "p", "Open " + p1(L.o) + "p")}
        ${stat("RSI (14)", L.rsi.toFixed(1), L.rsi >= 70 ? "Overbought" : L.rsi <= 40 ? "Low" : "Middle", L.rsi >= 70 ? "red" : L.rsi <= 40 ? "green" : "blue")}
        ${stat("MACD", L.macd.toFixed(2), (L.macd > L.macd_sig ? "Above" : "Below") + " signal " + L.macd_sig.toFixed(2), L.macd > L.macd_sig ? "green" : "red")}
      </div>
    </div>
    <div class="note">Buy/sell status from the 7:30am daily check · ${S.watch ? "updated " + esc(S.watch.updated) : "not loaded"}${S.statusSource !== "repo" ? " (offline copy)" : ""}.
      Price, RSI and MACD above are live.</div>`;
}

function stat(lbl, val, sub, cls = "", extra = "") {
  return `<div class="stat ${extra}"><div class="lbl">${lbl}</div><div class="val ${cls}">${val}</div><div class="sub">${sub || ""}</div></div>`;
}

function renderLevels() {
  const d = lgen(); if (!d) return;
  const L = last(d), P = prevC(d), kl = keyLevel(), wl = wlShare("LGEN.L");
  const ch = P ? (L.c / P.c - 1) * 100 : 0;
  let cards = stat("Close", p1(L.c) + "p", `${pct(ch)} · H ${p1(L.h)} · L ${p1(L.l)}`, ch >= 0 ? "green" : "red");
  cards += stat("RSI (14)", L.rsi.toFixed(1), L.rsi >= 70 ? "Overbought (70+)" : L.rsi <= 40 ? "Buy zone (under 40)" : "Middle", L.rsi >= 70 ? "red" : L.rsi <= 40 ? "green" : "blue");
  if (kl) {
    const top = Math.max(kl.price * 1.005, kl.zone_to === "WMA200" && L.ma200 ? L.ma200 : kl.price * 1.02), dp = (L.c / kl.price - 1) * 100;
    cards += stat(esc(kl.label || "Key support"), p1(kl.price) + "p", `${dp >= 0 ? dp.toFixed(1) + "% above" : (-dp).toFixed(1) + "% below"} · zone to ${top.toFixed(0)}p`, dp >= 0 ? "" : "red", "key");
  }
  cards += stat("WMA 50", p1(L.ma50) + "p", `Price ${pct((L.c / L.ma50 - 1) * 100)} vs it`, "", "");
  cards += stat("WMA 200", p1(L.ma200) + "p", `Price ${pct((L.c / L.ma200 - 1) * 100)} vs it · ${L.ma50 > L.ma200 ? "50 above 200: bullish" : "50 below 200: bearish"}`);
  cards += stat("MACD hist", L.macd_hist.toFixed(3), `MACD ${L.macd.toFixed(2)} · signal ${L.macd_sig.toFixed(2)} (9-day SMA)`, L.macd_hist > 0 ? "green" : "red");
  if (wl && wl.trend) cards += stat("Trendline", wl.trend.toFixed(0) + "p", `${pct(wl.above_trend_pct)} above (daily check)`);
  const alerts = watchAlerts();
  $("levels-body").innerHTML = `
    <div class="stat-grid">${cards}</div>
    <div class="card"><h3>Watch alerts <span class="muted" style="text-transform:none;letter-spacing:0">${alerts.length || "none"}</span></h3>
      ${alerts.length ? alerts.map(a => `<div class="alert"><span class="tag ${a[0]}">${esc(a[1])}</span><span>${esc(a[2])}</span></div>`).join("")
        : '<div class="muted" style="font-size:14px">Nothing to watch right now.</div>'}
    </div>
    <div class="note">Levels as of ${fmtDate(L.t)}${L.live ? " (live)" : ""}.</div>`;
}

function renderWatch() {
  if (!S.watch) return;
  const html = S.watch.shares.map(st => {
    const sh = S.shares.find(s => s.ticker === st.ticker && !/_TEST/.test(s.code)), d = sh && S.data[sh.code];
    const L = d ? last(d) : null, P = d ? prevC(d) : null;
    const price = L ? L.c : st.close, rsi = L ? L.rsi : st.rsi, ch = L && P ? (L.c / P.c - 1) * 100 : null;
    const keys = Object.keys(st.items || {});
    const cls = keys.some(k => k === "overbought" || k === "spring_sell" || k.startsWith("run_up_sell")) ? "red"
              : keys.some(k => k.startsWith("autumn_buy") || k.startsWith("run_up")) ? "green" : keys.length ? "amber" : "muted";
    const today = st.rule_state && st.rule_state.short ? st.rule_state.banner : (Object.values(st.items || {}).join(" · ") || "Nothing to do");
    const ex = (st.next_exdivs || [])[0];
    const trendPct = st.trend ? (price / st.trend - 1) * 100 : null;
    return `<div class="card share-card" data-code="${sh ? sh.code : ""}">
      <div class="row1"><div><span class="name">${esc(st.name)}</span> <span class="muted">${esc(st.ticker.replace(".L", ""))}</span></div>
        <div><span class="px">${p1(price)}p</span> ${ch != null ? `<span class="chg ${ch >= 0 ? "pos" : "neg"}">${ch >= 0 ? "+" : ""}${ch.toFixed(2)}%</span>` : ""}</div></div>
      <div class="row2"><span>RSI <b class="${rsi >= 70 ? "red" : rsi <= 40 ? "green" : ""}">${rsi.toFixed(0)}</b></span>
        <span>Trend ${st.trend ? st.trend.toFixed(0) + "p (" + pct(trendPct) + ")" : "none"}</span>
        <span>Ex-div ${ex ? fmtDate(ex[0]) + " · " + ex[1].toFixed(1) + "p" : "—"}</span></div>
      <div class="today ${cls}">${esc(today)}</div></div>`;
  }).join("");
  $("watch-body").innerHTML = html + `<div class="note">Tap a share to open its chart. Rules status from the daily check (${esc(S.watch.updated)}); prices live.</div>`;
  $("watch-body").querySelectorAll(".share-card").forEach(el => el.onclick = () => {
    if (!el.dataset.code) return;
    showShare(el.dataset.code); goPage(0);
  });
}

function renderCalendar() {
  if (!S.watch) return;
  const today = todayStr(), from = new Date(Date.now() - 365 * DAY).toISOString().slice(0, 10), ev = [];
  const names = {};
  for (const sh of S.shares) if (!/_TEST/.test(sh.code)) names[sh.ticker] = sh.code;
  for (const st of S.watch.shares) {
    const code = names[st.ticker] || st.ticker, d = S.data[code];
    const known = (d && d.ex_div_dates) || [];
    for (const t of known) if (t >= from) ev.push({ t, code, what: `Ex-dividend${d.ex_div_amounts && d.ex_div_amounts[t] ? " · " + d.ex_div_amounts[t].toFixed(2) + "p" : ""}`, kind: "D" });
    for (const [t, a] of (st.next_exdivs || [])) if (!known.some(k => Math.abs(Date.parse(k) - Date.parse(t)) < 10 * DAY))
      ev.push({ t, code, what: `Ex-dividend · ${a.toFixed(2)}p (expected)`, kind: "D" });
    for (const e of eventsFor(code)) if (e.t >= from) ev.push({ t: e.t, code, what: e.type + (e.note ? " · " + e.note : ""), kind: "R" });
    const res = (d && d.results_dates) || [];
    for (const r of res) if (r.t >= from) ev.push({ t: r.t, code, what: `${r.type} results`, kind: "R" });
    for (const type of ["Full year", "Half year"]) {   // next results: about a year after the last one of the same kind
      const lastR = res.filter(r => r.type === type).map(r => r.t).sort().pop();
      if (!lastR) continue;
      const n = new Date(Date.parse(lastR) + 364 * DAY).toISOString().slice(0, 10);
      if (n >= today) ev.push({ t: n, code, what: `${type} results (expected, around this date)`, kind: "R" });
    }
    if (code === "LGEN") {
      const rs = d && d.rule_state, ex = (st.next_exdivs || [])[0];
      if (rs && rs.holding && ex && /ex-div/i.test(rs.exit_reason || ""))
        ev.push({ t: tradingDaysBefore(ex[0], 3), code, what: "Rule: be out by today (3 trading days before ex-div)", kind: "S" });
    }
  }
  ev.sort((a, b) => a.t.localeCompare(b.t));
  const up = ev.filter(e => e.t >= today), past = ev.filter(e => e.t < today).reverse();
  const item = (e, isPast) => {
    const dt = new Date(e.t + "T12:00:00Z"), n = daysTo(e.t);
    const tag = e.kind === "D" ? '<span class="tag t-green">D</span>' : e.kind === "R" ? '<span class="tag t-blue">R</span>' : '<span class="tag t-red">!</span>';
    return `<div class="cal-item ${isPast ? "cal-past" : ""}"><div class="cal-date"><b>${dt.getUTCDate()}</b><span>${dt.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}</span></div>
      <div class="cal-what">${tag} <b>${esc(e.code)}</b> ${esc(e.what)}</div>
      <div class="cal-when">${isPast ? "" : n === 0 ? "today" : "in " + n + "d"}</div></div>`;
  };
  let html = "", month = "";
  for (const e of up) {
    const m = new Date(e.t + "T12:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
    if (m !== month) { if (month) html += "</div>"; html += `<div class="cal-month">${m}</div><div class="card">`; month = m; }
    html += item(e, false);
  }
  if (month) html += "</div>";
  if (!up.length) html += '<div class="card muted">No upcoming dates.</div>';
  html += `<div class="cal-month">Last 12 months</div><div class="card">${past.map(e => item(e, true)).join("") || '<span class="muted">None</span>'}</div>`;
  html += '<div class="note"><b class="green">D</b> ex-dividend · <b class="blue">R</b> results · expected dates are estimates until the company confirms them.</div>';
  $("cal-body").innerHTML = html;
}

let testChart = null;
function renderTest() {
  const d = S.data.LGEN_TEST4;
  if (!d || !d.paper) { $("test-body").innerHTML = '<div class="card muted">No Test 4 record yet.</div>'; return; }
  const p = d.paper, trades = d.trades || [], L = last(d);
  const asOf = d.candles.find(c => c.t === p.as_of) || L, liveMove = L.c / (asOf.orig ? asOf.orig.c : asOf.c);
  const value = p.holding ? p.cash + p.shares * L.c / 100 : p.value;
  const bh = p.buy_hold_value * liveMove;
  const gain = (value / p.start_cash - 1) * 100, bhg = (bh / p.start_cash - 1) * 100;
  $("test-body").innerHTML = `
    <div class="card"><h3>LGEN test 4 <span>${gbp(p.start_cash)} from ${fmtDate(p.start)}</span></h3>
      <div class="stat-grid">
        ${stat("Portfolio now", gbp(value), pct(gain), gain >= 0 ? "green" : "red")}
        ${stat("Buy and hold", gbp(bh), pct(bhg), bhg >= 0 ? "green" : "red")}
        ${stat(p.holding ? "Holding" : "In cash", p.holding ? p.shares.toLocaleString("en-GB") : gbp(p.cash), p.holding ? "shares at " + p1(L.c) + "p" : "earning bank rate")}
        ${stat("Ahead of buy & hold", gbp(value - bh), (gain - bhg >= 0 ? "+" : "") + (gain - bhg).toFixed(1) + " points", value >= bh ? "green" : "red")}
      </div>
      <div class="note" style="margin-top:8px">${esc(p.label || "")}</div>
    </div>
    <div class="card" style="padding:8px"><div id="test-chart"></div></div>
    <div class="card"><h3>Trades <span>${trades.length}</span></h3>
      <table class="trades"><tr><th>Date</th><th></th><th>Price</th><th>Shares</th><th>Portfolio</th></tr>
      ${[...trades].reverse().map(t => `<tr><td>${fmtDate(t.t)}</td><td class="${t.side === "BUY" ? "buy" : "sell"}">${t.side}</td>
        <td>${p1(t.price)}p</td><td>${t.shares.toLocaleString("en-GB")}</td><td><b>${gbp(t.value)}</b></td></tr>`).join("")}</table>
    </div>
    <div class="note">Record from the daily check up to ${fmtDate(p.as_of)}; values above use today's live price. Dividends received ${gbp(p.dividends)}.
      Trades at the next day's opening price, after stamp duty and spread.</div>`;
  const LW = window.LightweightCharts, th = TH();
  if (testChart) { testChart.remove(); testChart = null; }
  testChart = LW.createChart($("test-chart"), Object.assign({ autoSize: true, handleScroll: false, handleScale: false,
    timeScale: { borderColor: th.border }, rightPriceScale: { borderColor: th.border } }, baseLayout()));
  const s = testChart.addSeries(LW.LineSeries, { color: th.macd, lineWidth: 2, priceLineVisible: false });
  s.setData(d.candles.filter(c => c.t >= tradingDaysBefore(p.start, 20)).map(c => ({ time: c.t, value: c.c })));
  LW.createSeriesMarkers(s, trades.map(t => ({ time: t.t, position: t.side === "BUY" ? "belowBar" : "aboveBar",
    color: t.side === "BUY" ? "#16a34a" : "#e53935", shape: t.side === "BUY" ? "arrowUp" : "arrowDown", text: t.side + " " + p1(t.price) })));
  testChart.timeScale().fitContent();
}

// ───────────────────────── main chart ─────────────────────────
let theme = "light";
try { theme = localStorage.getItem("theme") || "light"; } catch (e) {}
const THEMES = {
  light: { bg: "#ffffff", text: "#131722", grid: "#f3f4f7", border: "#d1d4dc", up: "#0a9d58", down: "#e0302f",
           w50: "#9575cd", w200: "#3949ab", macd: "#2962ff", sig: "#f23645", histUp: "rgba(8,153,129,0.55)",
           histDown: "rgba(242,54,69,0.55)", rsi: "#7e57c2", band: "rgba(126,87,194,0.09)", bandLine: "#b9a6e0", divFill: "#8bd649", divText: "#173d00" },
  dark:  { bg: "#131722", text: "#d1d4dc", grid: "#1c202b", border: "#2a2e39", up: "#26a69a", down: "#ef5350",
           w50: "#b39ddb", w200: "#64b5f6", macd: "#2962ff", sig: "#ff6d00", histUp: "rgba(38,166,154,0.6)",
           histDown: "rgba(239,83,80,0.6)", rsi: "#b388ff", band: "rgba(179,136,255,0.10)", bandLine: "#6c5a96", divFill: "#7cc243", divText: "#0d2600" },
};
const TH = () => THEMES[theme];
function baseLayout() {
  const th = TH();
  return { layout: { background: { type: "solid", color: th.bg }, textColor: th.text, attributionLogo: false,
                     panes: { separatorColor: th.border, separatorHoverColor: th.border, enableResize: false } },
           grid: { vertLines: { color: th.grid }, horzLines: { color: th.grid } } };
}

let chart = null, candleS, paneSeries = [], markIdx = { D: [], R: [] }, chartData = null;

// Shaded 30–70 band on the RSI pane
class RsiBand {
  attached(p) { this.s = p.series; }
  updateAllViews() {}
  paneViews() {
    return [{ zOrder: () => "bottom", renderer: () => ({ draw: tg => tg.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const th = TH(), y70 = this.s.priceToCoordinate(70), y30 = this.s.priceToCoordinate(30);
      if (y70 == null || y30 == null) return;
      ctx.save(); ctx.fillStyle = th.band; ctx.fillRect(0, y70, mediaSize.width, y30 - y70);
      ctx.strokeStyle = th.bandLine; ctx.setLineDash([4, 3]);
      for (const y of [y70, y30]) { ctx.beginPath(); ctx.moveTo(0, Math.round(y) + .5); ctx.lineTo(mediaSize.width, Math.round(y) + .5); ctx.stroke(); }
      ctx.restore();
    }) }) }];
  }
}
// "D" (ex-dividend) above and "R" (results) below the candles, like the dashboard
class DayMarks {
  updateAllViews() {}
  paneViews() {
    return [{ zOrder: () => "top", renderer: () => ({ draw: tg => tg.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      if (!chart || !chartData) return;
      const th = TH(), ts = chart.timeScale();
      ctx.save(); ctx.font = "bold 11px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const dot = (i, above, fill, stroke, txt, txtCol) => {
        const x = ts.logicalToCoordinate(i); if (x == null || x < -10 || x > mediaSize.width + 10) return;
        const c = chartData.candles[i], y = candleS.priceToCoordinate(above ? c.h : c.l); if (y == null) return;
        const cy = above ? y - 13 : y + 13;
        ctx.beginPath(); ctx.arc(x, cy, 8, 0, 7); ctx.fillStyle = fill; ctx.fill();
        if (stroke) { ctx.lineWidth = 1.5; ctx.strokeStyle = stroke; ctx.stroke(); }
        ctx.fillStyle = txtCol; ctx.fillText(txt, x, cy + .5);
      };
      for (const i of markIdx.D) dot(i, true, th.divFill, null, "D", th.divText);
      for (const [i, type] of markIdx.R) { const full = type === "Full year"; dot(i, false, full ? "#2962ff" : th.bg, "#2962ff", "R", full ? "#fff" : "#2962ff"); }
      ctx.restore();
    }) }) }];
  }
}

function nearIdx(times, s) {
  const t = Date.parse(s), i = times.findIndex(x => x >= t);
  return i >= 0 && Math.abs(times[i] - t) < 5 * DAY ? i : -1;
}

function buildChart() {
  const d = S.data[S.code]; if (!d) return;
  chartData = d;
  const LW = window.LightweightCharts, th = TH(), cs = d.candles;
  const times = cs.map(c => Date.parse(c.t));
  markIdx.D = (d.ex_div_dates || []).map(s => nearIdx(times, s)).filter(i => i >= 0);
  const evs = eventsFor(S.code.replace(/_TEST\d*$/, "")).map(e => ({ t: e.t, type: e.type }));
  markIdx.R = [...(d.results_dates || []), ...evs].map(r => [nearIdx(times, r.t), r.type]).filter(r => r[0] >= 0);
  const keep = chart ? chart.timeScale().getVisibleLogicalRange() : null, sameShare = buildChart.code === S.code && keep;
  if (chart) { chart.remove(); chart = null; }
  buildChart.code = S.code;
  chart = LW.createChart($("lw-chart"), Object.assign({
    autoSize: true, crosshair: { mode: LW.CrosshairMode.Normal },
    rightPriceScale: { minimumWidth: 64, borderColor: th.border, scaleMargins: { top: 0.06, bottom: 0.16 } },
    timeScale: { rightOffset: 8, barSpacing: 4, minBarSpacing: 0.5, borderColor: th.border },
    localization: { dateFormat: "dd MMM yy" },
    handleScale: { axisPressedMouseMove: { time: true, price: true }, pinch: true },
    handleScroll: { horzTouchDrag: true, vertTouchDrag: false },
  }, baseLayout()));
  const pf = { type: "price", precision: 2, minMove: 0.01 }, pf4 = { type: "price", precision: 3, minMove: 0.001 };
  const vol = chart.addSeries(LW.HistogramSeries, { priceScaleId: "vol", priceFormat: { type: "volume" }, priceLineVisible: false, lastValueVisible: false }, 0);
  vol.priceScale().applyOptions({ scaleMargins: { top: 0.86, bottom: 0 } });
  vol.setData(cs.map(c => ({ time: c.t, value: c.v || 0, color: (c.c >= c.o ? th.up : th.down) + (theme === "light" ? "55" : "66") })));
  candleS = chart.addSeries(LW.CandlestickSeries, { upColor: th.up, downColor: th.down, wickUpColor: th.up, wickDownColor: th.down,
    borderVisible: false, priceFormat: pf, priceLineStyle: LW.LineStyle.Dotted }, 0);
  candleS.setData(cs.map(c => ({ time: c.t, open: c.o, high: c.h, low: c.l, close: c.c })));
  const line = (color, title, pane, extra) => chart.addSeries(LW.LineSeries, Object.assign({ color, lineWidth: 1, title,
    priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false, priceFormat: pf }, extra || {}), pane);
  const ser = k => cs.filter(c => c[k] != null).map(c => ({ time: c.t, value: c[k] }));
  line(th.w50, "WMA 50", 0).setData(ser("ma50"));
  line(th.w200, "WMA 200", 0).setData(ser("ma200"));
  const hist = chart.addSeries(LW.HistogramSeries, { priceFormat: pf4, priceLineVisible: false, lastValueVisible: false }, 1);
  hist.setData(cs.filter(c => c.macd_hist != null).map(c => ({ time: c.t, value: c.macd_hist, color: c.macd_hist >= 0 ? th.histUp : th.histDown })));
  const macdS = line(th.macd, "MACD", 1, { priceFormat: pf4 }); macdS.setData(ser("macd"));
  line(th.sig, "Signal", 1, { priceFormat: pf4 }).setData(ser("macd_sig"));
  const rsiS = line(th.rsi, "RSI", 2, { autoscaleInfoProvider: o => { const r = o(); if (r) { r.priceRange.minValue = Math.min(r.priceRange.minValue, 25); r.priceRange.maxValue = Math.max(r.priceRange.maxValue, 75); } return r; } });
  rsiS.setData(ser("rsi")); rsiS.attachPrimitive(new RsiBand());
  candleS.attachPrimitive(new DayMarks());
  paneSeries = [candleS, macdS, rsiS];
  const kl = keyLevel(d.ticker);
  if (kl && !/_TEST/.test(S.code)) candleS.createPriceLine({ price: kl.price, color: "#e53935", lineWidth: 2, lineStyle: 0, axisLabelVisible: true, title: kl.label || "Key support" });
  if (d.trades && d.trades.length) LW.createSeriesMarkers(candleS, d.trades.map(t => ({ time: t.t, position: t.side === "BUY" ? "belowBar" : "aboveBar",
    color: t.side === "BUY" ? "#16a34a" : "#e53935", shape: t.side === "BUY" ? "arrowUp" : "arrowDown", text: `${t.side} ${p1(t.price)}` })));
  const panes = chart.panes();
  if (panes.length >= 3 && panes[0].setStretchFactor) { panes[0].setStretchFactor(66); panes[1].setStretchFactor(17); panes[2].setStretchFactor(17); }
  chart.subscribeCrosshairMove(p => {
    const i = p && p.logical != null && p.point ? Math.round(p.logical) : -1;
    showOHLC(i >= 0 && i < cs.length ? i : cs.length - 1);
  });
  showOHLC(cs.length - 1);
  if (sameShare) chart.timeScale().setVisibleLogicalRange(keep); else setRange(S.months);
}

function showOHLC(i) {
  const d = chartData, c = d.candles[i], pv = d.candles[i - 1], th = TH(); if (!c) return;
  const ch = pv ? (c.c / pv.c - 1) * 100 : 0, col = c.c >= c.o ? th.up : th.down;
  const sp = v => `<span style="color:${col}">${p2(v)}</span>`;
  $("ohlc").innerHTML = `<b>${esc(S.code)}</b> <span class="muted">${fmtDate(c.t)}${c.live ? " · live" : ""}</span><br>` +
    `O ${sp(c.o)} H ${sp(c.h)} L ${sp(c.l)} C ${sp(c.c)} <span style="color:${col}">${ch >= 0 ? "+" : ""}${ch.toFixed(2)}%</span><br>` +
    `<span style="color:${th.w50}">WMA50 ${p2(c.ma50)}</span> <span style="color:${th.w200}">WMA200 ${p2(c.ma200)}</span> ` +
    `<span style="color:${th.rsi}">RSI ${p1(c.rsi)}</span>`;
}

function setRange(months) {
  if (!chart || !chartData) return;
  const cs = chartData.candles, n = cs.length;
  let from = 0;
  if (months) { const d = new Date(cs[n - 1].t); d.setMonth(d.getMonth() - months); const s = d.toISOString().slice(0, 10); from = Math.max(0, cs.findIndex(c => c.t >= s)); }
  chart.timeScale().setVisibleLogicalRange({ from, to: n - 1 + Math.max(4, Math.round((n - from) * 0.05)) });
}

function fillSharePicker() {
  const sel = $("share-pick");
  sel.innerHTML = S.shares.map(s => `<option value="${esc(s.code)}">${esc(s.code)} · ${esc(s.name)}</option>`).join("");
  sel.value = S.code;
}
function showShare(code) {
  if (!S.data[code]) return;
  S.code = code; $("share-pick").value = code;
  try { localStorage.setItem("share", code); } catch (e) {}
  buildChart();
}

// ───────────────────────── page swiping, tabs, landscape ─────────────────────────
const pager = $("pager"), tabs = [...document.querySelectorAll("#tabs button")];
function goPage(i, smooth = true) {
  S.page = i;
  try { localStorage.setItem("page", i); } catch (e) {}
  pager.scrollTo({ left: i * pager.clientWidth, behavior: smooth ? "smooth" : "auto" });
  tabs.forEach((b, k) => b.classList.toggle("active", k === i));
  updateFull();
}
tabs.forEach(b => b.onclick = () => goPage(+b.dataset.i));
pager.addEventListener("scroll", () => {
  const i = Math.round(pager.scrollLeft / pager.clientWidth);
  if (i !== S.page) { S.page = i; tabs.forEach((b, k) => b.classList.toggle("active", k === i)); try { localStorage.setItem("page", i); } catch (e) {} updateFull(); }
}, { passive: true });

let lastPage = -1;
function pageChanged() { if (lastPage === 6 && S.page !== 6) { markNewsSeen(); renderNews(); } lastPage = S.page; }
function updateFull() {
  pageChanged();
  const land = window.innerWidth > window.innerHeight;
  const full = land && S.page === 0;
  if (document.body.classList.contains("full") !== full) {
    document.body.classList.toggle("full", full);
    try { const sb = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.SystemBars; if (sb) full ? sb.hide() : sb.show(); } catch (e) {}
  }
}
window.addEventListener("resize", () => { updateFull(); requestAnimationFrame(() => pager.scrollTo({ left: S.page * pager.clientWidth })); });

$("share-pick").onchange = e => showShare(e.target.value);
document.querySelectorAll("#range-btns button").forEach(b => b.onclick = () => {
  document.querySelectorAll("#range-btns button").forEach(x => x.classList.toggle("active", x === b));
  S.months = +b.dataset.m; setRange(S.months);
});
function applyTheme() {
  document.documentElement.dataset.theme = theme;
  $("theme-btn").textContent = theme === "light" ? "◐ Dark" : "◑ Light";
}
$("theme-btn").onclick = () => {
  theme = theme === "light" ? "dark" : "light";
  try { localStorage.setItem("theme", theme); } catch (e) {}
  applyTheme(); buildChart(); renderTest();
};

// ───────────────────────── status change: open on Signal and flash ─────────────────────────
// Compares the daily check's status with the one you last saw. First run just remembers it.
function statusKey() {
  const d = lgen(), rs = d && d.rule_state;
  return rs && rs.kind ? rs.kind + (rs.holding ? ":in" : ":out") : null;
}
function checkStatusChange() {
  const now = statusKey(); if (!now) return;
  let seen = null; try { seen = localStorage.getItem("seenStatus"); } catch (e) {}
  try { localStorage.setItem("seenStatus", now); } catch (e) {}
  if (!seen || seen === now) return;
  goPage(1);
  const v = verdict();
  toast("Status changed: " + (v ? v.word : now.split(":")[0].toUpperCase()), true);
  S.flashUntil = Date.now() + 4500;
  renderSignal();
}

// ───────────────────────── news (Google News RSS) ─────────────────────────
const NEWS_TOPICS = [
  { id: "inf", label: "Inflation", q: ['"UK inflation"', 'UK CPI inflation'] },
  { id: "boe", label: "BoE / rates", q: ['"Bank of England" interest rates'] },
  { id: "gilt", label: "Gilts", q: ['gilt yields'] },
  { id: "lg", label: "L&G", q: ['"Legal & General"', '"Legal and General"', '"L&G" shares OR results OR "trading update"', 'LGEN shares', '"Legal & General" "trading update" OR results OR preview'] },
];
const NEWS_EVERY_MS = 15 * 60 * 1000;
S.news = []; S.newsAt = 0; S.newsTopic = "all";
try { const c = JSON.parse(localStorage.getItem("news") || "null"); if (c) { S.news = c.items; S.newsAt = c.at; } } catch (e) {}

function parseRss(xml, topic) {
  const doc = new DOMParser().parseFromString(xml, "text/xml"), out = [];
  for (const it of doc.querySelectorAll("item")) {
    const get = t => (it.querySelector(t) || {}).textContent || "";
    const src = get("source");
    let title = get("title").trim();
    if (src && title.endsWith(" - " + src)) title = title.slice(0, -(src.length + 3));
    const t = Date.parse(get("pubDate"));
    if (!title || isNaN(t)) continue;
    out.push({ title, link: get("link").trim(), src, t, topics: [topic] });
  }
  return out;
}
async function loadNews() {
  const jobs = NEWS_TOPICS.flatMap(tp => tp.q.map(q => [tp.id, q]));
  const res = await Promise.allSettled(jobs.map(([id, q]) => getText(
    "https://news.google.com/rss/search?q=" + encodeURIComponent(q + " when:14d") + "&hl=en-GB&gl=GB&ceid=GB:en").then(x => parseRss(x, id))));
  const byTitle = new Map();
  for (const r of res) if (r.status === "fulfilled") for (const n of r.value) {
    const k = n.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 80);
    const had = byTitle.get(k);
    if (had) { if (!had.topics.includes(n.topics[0])) had.topics.push(n.topics[0]); }
    else byTitle.set(k, n);
  }
  if (!byTitle.size) throw new Error("News unavailable");
  S.news = [...byTitle.values()].sort((a, b) => b.t - a.t).slice(0, 200);
  S.newsAt = Date.now();
  try { localStorage.setItem("news", JSON.stringify({ items: S.news, at: S.newsAt })); } catch (e) {}
  renderNews();
}
function ago(t) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 60) return Math.max(1, m) + " min ago";
  if (m < 24 * 60) return Math.round(m / 60) + " h ago";
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function renderNews() {
  let seen = 0; try { seen = +(localStorage.getItem("newsSeen") || 0); } catch (e) {}
  const list = S.news.filter(n => S.newsTopic === "all" || n.topics.includes(S.newsTopic));
  const lbl = Object.fromEntries(NEWS_TOPICS.map(t => [t.id, t.label]));
  $("news-body").innerHTML = `
    <div class="chips">${[{ id: "all", label: "All" }, ...NEWS_TOPICS].map(t =>
      `<button class="chip ${S.newsTopic === t.id ? "active" : ""}" data-t="${t.id}">${esc(t.label)}</button>`).join("")}</div>
    <div class="card" style="padding-top:2px;padding-bottom:2px">${list.length ? list.map(n => `
      <a class="news-item" href="${esc(n.link)}">
        <div class="news-title">${esc(n.title)}</div>
        <div class="news-meta">${seen && n.t > seen ? '<span class="news-new">NEW</span>' : ""}<span>${esc(n.src)}</span><span>${ago(n.t)}</span>
          <span>${n.topics.map(t => esc(lbl[t])).join(" · ")}</span></div>
      </a>`).join("") : '<div class="muted" style="padding:12px 0">No headlines yet. Pull in news with ⟳ at the top.</div>'}</div>
    <div class="note">Google News, last 14 days, newest first. Tap a headline to open it.${S.newsAt ? " Updated " + ago(S.newsAt) + "." : ""}</div>`;
  $("news-body").querySelectorAll(".chip").forEach(b => b.onclick = () => { S.newsTopic = b.dataset.t; renderNews(); });
}
function markNewsSeen() { if (S.news.length) try { localStorage.setItem("newsSeen", String(Math.max(...S.news.map(n => n.t)))); } catch (e) {} }
function refreshNews(force) {
  if (!force && Date.now() - S.newsAt < NEWS_EVERY_MS) return;
  loadNews().catch(e => { if (S.page === 6) toast(e.message); });
}

// ───────────────────────── refresh loop ─────────────────────────
function renderAll() {
  if (!lgen()) return;
  renderHeader();
  buildChart();
  renderSignal(); renderLevels(); renderWatch(); renderCalendar(); renderTest(); renderNews();
}

let busy = false;
async function refresh(opts = {}) {
  if (busy) return; busy = true;
  $("refresh-btn").classList.add("spin");
  try {
    if (opts.status || !S.statusAt || Date.now() - S.statusAt > STATUS_EVERY_MS) { await loadStatus(); checkStatusChange(); }
    if (opts.live !== false) await loadLive();
  } catch (e) {
    toast(String(e.message || e));
    renderAll();
  } finally { busy = false; $("refresh-btn").classList.remove("spin"); }
}
$("refresh-btn").onclick = () => { refresh({ status: true }); refreshNews(true); };

setInterval(() => {
  if (document.hidden) return;
  refreshNews();
  if (marketOpen() && Date.now() - S.liveAt >= LIVE_EVERY_MS) refresh();
  else renderHeader();
}, 60 * 1000);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  refreshNews();
  if (Date.now() - S.liveAt > 2 * 60 * 1000) refresh({ status: Date.now() - S.statusAt > STATUS_EVERY_MS });
});

(async function start() {
  applyTheme();
  try { S.code = localStorage.getItem("share") || "LGEN"; } catch (e) {}
  try { await loadStatus(); } catch (e) { toast("Couldn't load data: " + e.message); return; }
  if (!S.data[S.code]) S.code = "LGEN";
  fillSharePicker();
  renderAll();
  let p = 0; try { p = +(localStorage.getItem("page") || 0); } catch (e) {}
  goPage(p, false);
  checkStatusChange();
  refresh();
  refreshNews(true);   // live prices straight away
})();
