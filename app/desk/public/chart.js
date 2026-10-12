/** Scardesk mark chart — Tick (default step+shade) or candles from 15m+.
 *  Red=#FF2418 up, ash=#8A847F down. Subtle optional EMA (off by default).
 *  Layout inspired by papertrade blotter flow; not a pixel copy; no green/red HL palette.
 */
(function (global) {
  const UP = "#FF2418";
  const DN = "#8A847F";
  const GRID = "rgba(58,41,39,0.85)";
  const INK = "#A89A92";
  const SHADE = "rgba(255, 36, 24, 0.14)";
  const LINE = "#FFD0C8";
  const EMA_COL = "rgba(255, 208, 200, 0.45)";
  const LIVE = "#FF2418";

  const TF_MS = {
    Tick: 0,
    "1m": 60_000,
    "5m": 5 * 60_000,
    "15m": 15 * 60_000,
    "1h": 60 * 60_000,
    "4h": 4 * 60 * 60_000,
    "1d": 24 * 60 * 60_000,
  };

  function reduceMotion() {
    try {
      return global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }

  function ema(values, period) {
    const out = new Array(values.length).fill(null);
    if (!values.length || period < 1) return out;
    const k = 2 / (period + 1);
    let prev = null;
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (v == null || !Number.isFinite(v)) continue;
      if (prev == null) {
        if (i + 1 < period) continue;
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += values[j];
        prev = sum / period;
        out[i] = prev;
        continue;
      }
      prev = v * k + prev * (1 - k);
      out[i] = prev;
    }
    return out;
  }

  function aggregate(ticks, tf) {
    const ms = TF_MS[tf] || 0;
    if (!ms || tf === "Tick") {
      return ticks.map((t) => ({
        t: t.t,
        o: Number(t.c),
        h: Number(t.c),
        l: Number(t.c),
        c: Number(t.c),
        v: Number(t.v || 1),
      }));
    }
    const buckets = new Map();
    for (const raw of ticks) {
      const c = Number(raw.c);
      if (!Number.isFinite(c)) continue;
      const t0 = Math.floor(raw.t / ms) * ms;
      let b = buckets.get(t0);
      if (!b) {
        b = { t: t0, o: c, h: c, l: c, c: c, v: Number(raw.v || 1) };
        buckets.set(t0, b);
      } else {
        if (c > b.h) b.h = c;
        if (c < b.l) b.l = c;
        b.c = c;
        b.v += Number(raw.v || 1);
      }
    }
    return Array.from(buckets.values()).sort((a, b) => a.t - b.t);
  }

  function Chart(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ticks = [];
    this.market = "SOL/USD";
    this.tf = "Tick";
    this.showEma = false;
    this.entries = [];
    this._ro = null;
    // Synchronous demo seed so first paint is never empty (overwritten by /api/history).
    this.seedDemo();
    if (typeof ResizeObserver !== "undefined") {
      this._ro = new ResizeObserver(() => this.draw());
      this._ro.observe(canvas.parentElement || canvas);
    }
  }

  Chart.prototype.seedDemo = function () {
    const base = this.market.indexOf("BTC") >= 0 ? 65000 : this.market.indexOf("ETH") >= 0 ? 3500 : 100;
    const now = Date.now();
    const ticks = [];
    let px = base;
    for (let i = 0; i < 90; i++) {
      px = px * (1 + (Math.sin(i / 6) * 0.0015) + ((i % 7) - 3) * 0.0002);
      ticks.push({ t: now - (90 - i) * 60_000, c: px, v: 1 });
    }
    this.ticks = ticks;
    this.draw();
  };

  Chart.prototype.setMarket = function (id) {
    this.market = id || this.market;
  };

  Chart.prototype.setTimeframe = function (tf) {
    if (TF_MS[tf] != null || tf === "Tick") this.tf = tf;
  };

  Chart.prototype.setShowEma = function (on) {
    this.showEma = !!on;
  };

  Chart.prototype.setEntries = function (rows) {
    this.entries = Array.isArray(rows) ? rows : [];
  };

  Chart.prototype.setBars = function (bars) {
    // Accept history bars as ticks (use close).
    this.ticks = (Array.isArray(bars) ? bars : []).map((b) => ({
      t: b.t,
      c: b.cRaw != null ? Number(b.c) || Number(b.cRaw) / 1e8 : Number(b.c),
      v: Number(b.v || 1),
      cRaw: b.cRaw,
    })).filter((t) => Number.isFinite(t.c) && t.c > 0);
    // Prefer raw expo-8 if present
    this.ticks = (Array.isArray(bars) ? bars : []).map((b) => {
      let c;
      if (b.cRaw != null && String(b.cRaw).length) {
        c = Number(b.cRaw) / 1e8;
      } else {
        c = Number(String(b.c).replace(/,/g, ""));
      }
      return { t: b.t, c: c, v: Number(b.v || 1) };
    }).filter((t) => Number.isFinite(t.c) && t.c > 0);
    this.draw();
  };

  Chart.prototype._size = function () {
    const parent = this.canvas.parentElement || this.canvas;
    const w = Math.max(280, parent.clientWidth || 640);
    const h = Math.max(180, parent.clientHeight || 240);
    const dpr = Math.min(global.devicePixelRatio || 1, 2);
    if (this.canvas.width !== Math.floor(w * dpr) || this.canvas.height !== Math.floor(h * dpr)) {
      this.canvas.width = Math.floor(w * dpr);
      this.canvas.height = Math.floor(h * dpr);
      this.canvas.style.width = w + "px";
      this.canvas.style.height = h + "px";
    }
    return { w, h, dpr };
  };

  Chart.prototype.draw = function () {
    const ctx = this.ctx;
    if (!ctx) return;
    const { w, h, dpr } = this._size();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0E0A09";
    ctx.fillRect(0, 0, w, h);

    const padL = 8;
    const padR = 64;
    const padT = 10;
    const padB = 22;
    const plotH = h - padT - padB;
    const plotW = w - padL - padR;

    const series = aggregate(this.ticks, this.tf);
    if (!series.length) {
      ctx.fillStyle = INK;
      ctx.font = "12px IBM Plex Mono, monospace";
      ctx.fillText("Waiting for " + this.market + " mark…", padL + 8, h / 2);
      return;
    }

    const useCandles = this.tf !== "Tick" && TF_MS[this.tf] >= TF_MS["15m"];
    const closes = series.map((b) => b.c);
    let min = Math.min.apply(null, series.map((b) => (useCandles ? b.l : b.c)));
    let max = Math.max.apply(null, series.map((b) => (useCandles ? b.h : b.c)));
    if (!(max > min)) {
      min *= 0.999;
      max *= 1.001;
    }
    const span = max - min || 1;
    const yPx = (v) => padT + plotH - ((v - min) / span) * plotH;
    const slot = plotW / Math.max(series.length, 1);

    // grid
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const y = padT + (plotH / 3) * i;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      const val = max - (span / 3) * i;
      ctx.fillStyle = INK;
      ctx.font = "10px IBM Plex Mono, monospace";
      ctx.textAlign = "left";
      ctx.fillText(formatPx(val), w - padR + 6, y + 3);
    }

    if (useCandles) {
      const bodyW = Math.max(2, Math.min(12, slot * 0.62));
      for (let i = 0; i < series.length; i++) {
        const b = series[i];
        const x = padL + slot * i + slot / 2;
        const up = b.c >= b.o;
        ctx.strokeStyle = up ? UP : DN;
        ctx.fillStyle = up ? UP : DN;
        ctx.beginPath();
        ctx.moveTo(x, yPx(b.h));
        ctx.lineTo(x, yPx(b.l));
        ctx.stroke();
        const top = yPx(Math.max(b.o, b.c));
        const bot = yPx(Math.min(b.o, b.c));
        ctx.fillRect(x - bodyW / 2, top, bodyW, Math.max(1, bot - top));
      }
    } else {
      // Tick / sub-15m: step line + shade under last path
      ctx.beginPath();
      for (let i = 0; i < series.length; i++) {
        const x = padL + slot * i + slot / 2;
        const y = yPx(series[i].c);
        if (i === 0) ctx.moveTo(x, y);
        else {
          // step
          const prevX = padL + slot * (i - 1) + slot / 2;
          ctx.lineTo(x, yPx(series[i - 1].c));
          ctx.lineTo(x, y);
        }
      }
      // shade
      const lastX = padL + slot * (series.length - 1) + slot / 2;
      const firstX = padL + slot / 2;
      ctx.save();
      ctx.lineTo(lastX, padT + plotH);
      ctx.lineTo(firstX, padT + plotH);
      ctx.closePath();
      ctx.fillStyle = SHADE;
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      for (let i = 0; i < series.length; i++) {
        const x = padL + slot * i + slot / 2;
        const y = yPx(series[i].c);
        if (i === 0) ctx.moveTo(x, y);
        else {
          ctx.lineTo(x, yPx(series[i - 1].c));
          ctx.lineTo(x, y);
        }
      }
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // subtle EMA21 (opt-in; not claimed as papertrade parity)
    if (this.showEma) {
      const e = ema(closes, 21);
      ctx.strokeStyle = EMA_COL;
      ctx.lineWidth = 1;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < e.length; i++) {
        if (e[i] == null) continue;
        const x = padL + slot * i + slot / 2;
        const y = yPx(e[i]);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else ctx.lineTo(x, y);
      }
      if (started) ctx.stroke();
    }

    // entry overlays (desk / on-chain opens)
    for (const ent of this.entries) {
      const px = Number(ent.price);
      if (!Number.isFinite(px)) continue;
      const y = yPx(px);
      ctx.strokeStyle = ent.side === "short" ? DN : UP;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = ent.side === "short" ? DN : UP;
      ctx.font = "10px IBM Plex Mono, monospace";
      ctx.fillText((ent.side === "short" ? "S " : "L ") + formatPx(px), padL + 4, y - 3);
    }

    // last mark flag
    const last = series[series.length - 1].c;
    const ly = yPx(last);
    ctx.fillStyle = UP;
    ctx.fillRect(w - padR, ly - 8, padR - 4, 16);
    ctx.fillStyle = "#1A0504";
    ctx.font = "10px IBM Plex Mono, monospace";
    ctx.textAlign = "left";
    ctx.fillText(formatPx(last), w - padR + 4, ly + 3);

    ctx.fillStyle = INK;
    ctx.font = "10px IBM Plex Mono, monospace";
    ctx.textAlign = "left";
    const mode = useCandles ? "candles" : "tick";
    ctx.fillText(this.market + " · " + this.tf + " · " + mode, padL, h - 6);
  };

  function formatPx(n) {
    if (!Number.isFinite(n)) return "—";
    if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
    return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
  }

  Chart.TIMEFRAMES = Object.keys(TF_MS);
  global.ScardeskChart = Chart;
})(typeof window !== "undefined" ? window : globalThis);
