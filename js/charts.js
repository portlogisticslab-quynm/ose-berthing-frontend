/* Đồ thị đường SVG nhỏ, không dùng thư viện ngoài. Màu lấy từ biến CSS để hợp chế độ sáng/tối. */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const PALETTE = ["var(--accent)", "#c2410c", "#7c3aed", "#0f766e", "#b91c1c", "#a16207"];

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function niceStep(range, n) {
    const raw = range / n;
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p;
    return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p;
  }
  function fmt(v) {
    const loc = window.I18N && window.I18N.lang === "en" ? "en-US" : "vi-VN";
    const a = Math.abs(v);
    return new Intl.NumberFormat(loc, { maximumFractionDigits: a >= 100 ? 0 : a >= 10 ? 1 : 3 }).format(v);
  }

  /**
   * lineChart(container, { title, xLabel, yLabel, series: [{name, xs, ys, color?, dash?}], points: [{x, y, label}] })
   */
  function lineChart(container, opt) {
    container.innerHTML = "";
    const W = Math.round(Math.max(300, Math.min(container.clientWidth || 520, 860)));
    const H = Math.round(Math.max(230, Math.min(W * 0.58, 340))), m = { l: 58, r: 16, t: 28, b: 42 };
    const all = opt.series.filter((s) => s.xs.length);
    if (!all.length) return;
    let xmin = Math.min(...all.map((s) => Math.min(...s.xs))), xmax = Math.max(...all.map((s) => Math.max(...s.xs)));
    let ymin = Math.min(0, ...all.map((s) => Math.min(...s.ys))), ymax = Math.max(...all.map((s) => Math.max(...s.ys)));
    (opt.points || []).forEach((p) => { ymax = Math.max(ymax, p.y); xmax = Math.max(xmax, p.x); });
    if (xmax === xmin) xmax = xmin + 1;
    if (ymax === ymin) ymax = ymin + 1;
    const xs = niceStep(xmax - xmin, 6), ys = niceStep(ymax - ymin, 5);
    xmin = Math.floor(xmin / xs) * xs; xmax = Math.ceil(xmax / xs) * xs;
    ymin = Math.floor(ymin / ys) * ys; ymax = Math.ceil(ymax * 1.04 / ys) * ys;
    const X = (v) => m.l + (v - xmin) / (xmax - xmin) * (W - m.l - m.r);
    const Y = (v) => H - m.b - (v - ymin) / (ymax - ymin) * (H - m.t - m.b);

    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: "chart", role: "img", "aria-label": opt.title || "" });
    if (opt.title) el("text", { x: m.l, y: 16, class: "ttl" }, svg).textContent = opt.title;
    const grid = el("g", { class: "grid" }, svg), axis = el("g", { class: "axis" }, svg);
    for (let v = xmin; v <= xmax + 1e-9; v += xs) {
      el("line", { x1: X(v), x2: X(v), y1: m.t, y2: H - m.b }, grid);
      el("text", { x: X(v), y: H - m.b + 15, "text-anchor": "middle" }, axis).textContent = fmt(v);
    }
    for (let v = ymin; v <= ymax + 1e-9; v += ys) {
      el("line", { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v) }, grid);
      el("text", { x: m.l - 6, y: Y(v) + 4, "text-anchor": "end" }, axis).textContent = fmt(v);
    }
    el("line", { x1: m.l, x2: W - m.r, y1: Y(ymin), y2: Y(ymin) }, axis);
    el("line", { x1: m.l, x2: m.l, y1: m.t, y2: H - m.b }, axis);
    if (opt.xLabel) el("text", { x: (W + m.l) / 2, y: H - 6, "text-anchor": "middle" }, axis).textContent = opt.xLabel;
    if (opt.yLabel) {
      const t = el("text", { x: 12, y: (H - m.b + m.t) / 2, "text-anchor": "middle", transform: `rotate(-90 12 ${(H - m.b + m.t) / 2})` }, axis);
      t.textContent = opt.yLabel;
    }
    all.forEach((s, i) => {
      const c = s.color || PALETTE[i % PALETTE.length];
      const d = s.xs.map((x, j) => `${j ? "L" : "M"}${X(x).toFixed(1)},${Y(s.ys[j]).toFixed(1)}`).join("");
      el("path", { d, fill: "none", stroke: c, "stroke-width": 2, "stroke-dasharray": s.dash || "none" }, svg);
    });
    (opt.points || []).forEach((p) => {
      el("circle", { cx: X(p.x), cy: Y(p.y), r: 4.5, fill: "var(--danger)", stroke: "var(--surface)", "stroke-width": 1.5 }, svg);
      if (p.label) {
        const right = X(p.x) < W - 150;
        el("text", { x: X(p.x) + (right ? 8 : -8), y: Y(p.y) - 8, "text-anchor": right ? "start" : "end", class: "ttl" }, svg).textContent = p.label;
      }
    });
    const wrap = document.createElement("div");
    wrap.appendChild(svg);
    if (all.length > 1) {
      const lg = document.createElement("div");
      lg.className = "legend";
      all.forEach((s, i) => {
        const sp = document.createElement("span");
        const sw = document.createElement("i");
        sw.style.background = s.color || PALETTE[i % PALETTE.length];
        sp.appendChild(sw);
        sp.appendChild(document.createTextNode(s.name));
        lg.appendChild(sp);
      });
      wrap.appendChild(lg);
    }
    container.appendChild(wrap);
  }
  window.Charts = { lineChart, PALETTE };
})();
