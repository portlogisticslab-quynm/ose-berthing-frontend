/* Berthing Energy & Fender — giao diện 5 tab. Mọi lệnh gọi backend đi qua apiCall → window.oseFetch. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const t = (k, v) => window.I18N.t(k, v);

  // ------------------------------------------------------------ API helpers (Phụ lục C)
  async function apiCall(path, method = "GET", body) {
    const opts = { method, headers: {} };
    if (body !== undefined) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
    const res = window.oseFetch
      ? await window.oseFetch(path, opts)
      : await fetch(String(window.OSE_API_BASE || "").replace(/\/+$/, "") + path, opts);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { throw new Error(`Máy chủ trả về phản hồi không hợp lệ (HTTP ${res.status})`); }
    if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail || "Backend error"));
    return data;
  }
  async function backendLabel() {
    const base = String(await window.OSE_API_READY || window.OSE_API_BASE || "");
    return base.includes("onrender.com") ? t("wakeRender") : t("busy");
  }

  // ------------------------------------------------------------ tiện ích
  const META_FALLBACK = {
    ship_types: ["Container", "General", "Tanker", "Bulk", "Gas"],
    ship_classes: {
      Container: ["Feeder ships (TEU < 2900)", "Panamax ships (1900 < TEU < 5300)", "Post Panamax ships (TEU > 4000)"],
      General: ["General cargo", "Car carriers", "RoRo ships"],
      Tanker: ["Small tankers (< 10000 DWT)", "Handysize tankers (10000 - 25000 DWT)", "Handymax tankers (25000 - 55000 DWT)",
        "Panamax tankers (55000 - 80000 DWT)", "Aframax tankers (80000 - 120000 DWT)", "Suezmax tankers (120000 - 170000 DWT)",
        "ULCC & VLCC (170000 - 500000 DWT)"],
      Bulk: ["Small bulk carriers (< 10000 DWT)", "Handysize bulk carriers (10000 - 25000 DWT)", "Handymax bulk carriers (25000 - 55000 DWT)",
        "Panamax bulk carriers (55000 - 85000 DWT)", "Capesize bulk carriers (85000 - 200000 DWT)", "VLBC (200000 - 330000 DWT)"],
      Gas: ["LNG (Prismatic type)", "LNG (Spherical type)", "LPG"],
    },
  };
  const SHORT = { trelleborg: "Trelleborg", sft: "ShibataFenderTeam", prosertek: "Prosertek" };
  const state = {
    meta: META_FALLBACK, ships: {}, shipType: "Container", method: "list", load: "full", record: null, loaded: {},
    standards: null, fenders: [], energyReq: null, energy: null, selectReq: null, select: null,
    checkReq: null, check: null, compare: new Set(), report: null,
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function fmt(v, d = 1) {
    if (v == null || !isFinite(v)) return "–";
    return new Intl.NumberFormat(window.I18N.lang === "vi" ? "vi-VN" : "en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
  }
  function num(id) {
    const s = String($(id).value).trim().replace(",", ".");
    if (s === "") return null;
    const v = Number(s);
    return isFinite(v) ? v : null;
  }
  function interp(x, xs, ys) {
    if (x <= xs[0]) return ys[0];
    for (let i = 1; i < xs.length; i++) if (x <= xs[i]) return ys[i - 1] + (ys[i] - ys[i - 1]) * (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
    return ys[ys.length - 1];
  }
  function showError(msg) { const a = $("alert"); a.textContent = msg || ""; a.hidden = !msg; if (msg) a.scrollIntoView({ block: "nearest" }); }
  let toastTimer;
  function toast(msg, ms = 2600) {
    const el = $("toast"); el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.hidden = true), ms);
  }
  async function busy(btn, fn) {
    btn.classList.add("busy"); btn.disabled = true; showError("");
    const slow = setTimeout(async () => toast(await backendLabel(), 6000), 1500);
    try { return await fn(); }
    catch (e) { showError(e.message); return null; }
    finally { clearTimeout(slow); btn.classList.remove("busy"); btn.disabled = false; }
  }
  function download(name, text, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // ------------------------------------------------------------ tab
  function goTab(name) {
    document.querySelectorAll(".apptabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === name));
    document.querySelectorAll("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== name));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function markDone(name) { const b = document.querySelector(`.apptabs button[data-tab="${name}"]`); if (b) b.classList.add("done"); }

  // ------------------------------------------------------------ trạng thái API
  async function checkApi() {
    const pill = $("apiStatus"), txt = $("apiStatusText");
    pill.className = "pill pill-wait"; txt.textContent = t("apiWait");
    try {
      const h = await apiCall("/api/health");
      const base = String(await window.OSE_API_READY);
      pill.className = "pill pill-ok";
      txt.textContent = `${t("apiOk")} · v${h.version}${base.includes("onrender.com") ? " · Render" : ""}`;
    } catch (e) {
      pill.className = "pill pill-err"; txt.textContent = t("apiErr");
    }
  }

  // ------------------------------------------------------------ 1. TÀU
  const DIM_IDS = { DWT: "d_DWT", M: "d_M", LOA: "d_LOA", LBP: "d_LBP", B: "d_B", T: "d_T", Cb_source: "d_Cb" };

  function renderTypeSeg() {
    const seg = $("shipTypeSeg"); seg.innerHTML = "";
    state.meta.ship_types.forEach((ty) => {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = ty; b.setAttribute("role", "radio");
      b.classList.toggle("on", ty === state.shipType);
      b.onclick = () => { state.shipType = ty; renderTypeSeg(); renderClasses(); renderShipList(); };
      seg.appendChild(b);
    });
  }
  function renderClasses() {
    const sel = $("shipClass"); sel.innerHTML = "";
    const list = (state.meta.ship_classes || {})[state.shipType] || [];
    if (!list.length) sel.add(new Option("—", "1"));
    list.forEach((c, i) => sel.add(new Option(c, String(i + 1))));
  }
  function renderShipList() {
    const sel = $("shipSelect"); sel.innerHTML = "";
    const ships = state.ships[state.shipType] || [];
    if (!ships.length) { sel.add(new Option(t("noShips"), "")); return; }
    ships.forEach((s, i) => {
      const cap = state.shipType === "Container" && s.capacity ? ` · ${fmt(s.capacity, 0)} TEU` : "";
      sel.add(new Option(`#${s.no || i + 1} — ${fmt(s.DWT, 0)} DWT${cap}${s.index ? " · " + s.index : ""}${s.type_name ? " (" + s.type_name + ")" : ""}`, String(i)));
    });
  }
  function setDim(key, v) {
    const el = $(DIM_IDS[key]);
    el.value = v == null || !isFinite(v) ? "" : Math.round(v * 1000) / 1000;
    state.loaded[key] = el.value;
    el.classList.remove("edited");
  }
  function applyLoad() {
    const r = state.record;
    if (!r) return;
    if (state.load === "full") {
      setDim("M", r.delta_m); setDim("T", r.T_FullyLoaded);
      $("loadHint").textContent = t("loadHintFull");
    } else {
      const rho = num("d_rho") || 1.025;
      const Tb = r.T_Ballasted;
      setDim("T", Tb);
      setDim("M", rho * (r.Cb || 0) * r.Lpp * r.B * Tb);
      $("loadHint").textContent = t("loadHintBallast");
    }
    updateCb();
  }
  // Chọn cấp tàu khớp DWT (hoặc TEU với tàu container) theo khoảng ghi trong tên cấp của mooringloads.
  function autoClass(r) {
    const list = (state.meta.ship_classes || {})[state.shipType] || [];
    const name = String(r.type_name || "").toLowerCase();
    let idx = list.findIndex((c) => (name.includes("car") && /car/i.test(c)) || (name.includes("roro") && /roro/i.test(c)) ||
      (name.includes("lpg") && /lpg/i.test(c)));
    if (idx < 0) {
      const v = state.shipType === "Container" ? (r.capacity || r.DWT / 11) : r.DWT;
      idx = list.findIndex((c) => {
        const n = (c.match(/\d+/g) || []).map(Number);
        if (/<[^<]*$/.test(c.replace(/\).*/, "")) && n.length === 1) return v < n[0];
        if (/>/.test(c) && n.length === 1) return v > n[0];
        if (n.length >= 2) return v >= n[0] && v <= n[1];
        return false;
      });
    }
    if (idx >= 0) $("shipClass").value = String(idx + 1);
  }
  function fillShip(r, sourceText) {
    state.record = r;
    if (r.DWT) autoClass(r);
    setDim("DWT", r.DWT); setDim("LOA", r.Loa); setDim("LBP", r.Lpp); setDim("B", r.B); setDim("Cb_source", r.Cb);
    applyLoad();
    $("shipSourceInfo").textContent = sourceText || "";
  }
  function updateCb() {
    const M = num("d_M"), L = num("d_LBP"), B = num("d_B"), T = num("d_T"), rho = num("d_rho") || 1.025;
    $("d_CbCalc").value = M && L && B && T ? fmt(M / (rho * L * B * T), 4) : "";
  }
  function readShip() {
    const v = {};
    for (const k of ["DWT", "M", "LOA", "LBP", "B", "T"]) {
      v[k] = num(DIM_IDS[k]);
      if (!(v[k] > 0)) throw new Error(t("needShip"));
    }
    const sel = $("shipClass");
    return {
      ship_type: state.shipType, class_name: sel.selectedOptions[0] ? sel.selectedOptions[0].text : null,
      index: state.record && state.record.index ? String(state.record.index) : null,
      ...v, Cb_source: num("d_Cb") || null, load_condition: state.load, rho_w: num("d_rho") || 1.025,
    };
  }
  function editedFields() {
    return Object.keys(DIM_IDS).filter((k) => $(DIM_IDS[k]).classList.contains("edited"));
  }

  async function loadShipData() {
    try {
      const [meta, ships] = await Promise.all([apiCall("/api/ships/meta").catch(() => null), apiCall("/api/ships")]);
      if (meta && meta.ship_types) state.meta = { ship_types: meta.ship_types, ship_classes: meta.ship_classes || META_FALLBACK.ship_classes };
      state.ships = ships.ships || {};
      const n = Object.values(state.ships).reduce((a, b) => a + b.length, 0);
      const src = { live: "srcLive", cache: "srcCache", "cache-stale": "srcCache", snapshot: "srcSnapshot" }[ships._source] || "srcLive";
      $("shipSourceTag").textContent = t("shipsN", { n });
      $("shipSourceInfo").textContent = t(src);
    } catch (e) {
      showError(e.message);
    }
    renderTypeSeg(); renderClasses(); renderShipList();
    const list = state.ships[state.shipType] || [];
    if (list.length) { $("shipSelect").value = "0"; fillShip(list[0], t("loaded")); }
  }

  // ------------------------------------------------------------ 2–3. NĂNG LƯỢNG
  function buildEnergyReq() {
    const standards = [];
    if ($("s_pianc").checked) standards.push("PIANC2024");
    if ($("s_ocdi").checked) standards.push("OCDI2020");
    if (!standards.length) standards.push("PIANC2024");
    const aps = $("o_aps").value;
    return {
      ship: readShip(),
      berth: { water_depth: num("c_depth"), mode: $("c_mode").value, fender_pitch: num("c_pitch") },
      pianc: {
        navigation: $("p_nav").value, consequence: $("p_cc").value, cov: $("p_cov").value, contact: $("p_contact").value,
        monitored: $("p_mon").checked, berthings_per_year: num("p_n") || 100, pilot: $("p_pilot").checked,
        gamma_c: num("p_gc") || 1, velocity: num("p_v"), manoeuvre: $("p_man").value, tugs: $("p_tugs").checked,
        thrusters: $("p_thr").checked, alpha: num("p_a"), x_F_ratio: Number($("p_xf").value), y_F: num("p_yf"), C_m: num("p_cm"),
      },
      ocdi: {
        velocity: num("o_v"), theta: num("o_t"), alpha_ps: aps ? Number(aps) : null, k: num("o_k") || 0.5,
        fender_pitch: num("c_pitch"), C_s: num("o_cs") || 1, C_c: num("o_cc") || 1,
      },
      standards,
    };
  }
  function kvTable(rows) {
    return `<table class="kv">${rows.map(([k, v, note]) =>
      `<tr><th>${window.I18N.subs(k)}</th><td>${v}</td>${note !== undefined ? `<td class="l muted small">${esc(note)}</td>` : "<td></td>"}</tr>`).join("")}</table>`;
  }
  function renderEnergy() {
    const r = state.energy;
    $("energyEmpty").hidden = true; $("energyOut").hidden = false;
    const P = r.results.PIANC2024, O = r.results.OCDI2020;
    const k = [];
    if (P) {
      k.push(`<div class="kpi"><span class="k">${window.I18N.subs(t("kEkc"))}</span><span class="v">${fmt(P.E_kc, 0)}</span><span class="u">kNm</span></div>`);
      k.push(`<div class="kpi hero"><span class="k">${window.I18N.subs(t("kEkd"))}</span><span class="v">${fmt(P.E_kd, 0)}</span><span class="u">kNm · ${window.I18N.subs("γ_E")} = ${fmt(P.gamma.gamma_E, 3)}</span></div>`);
    }
    if (O) k.push(`<div class="kpi"><span class="k">${window.I18N.subs(t("kEf"))}</span><span class="v">${fmt(O.E_f, 0)}</span><span class="u">kNm</span></div>`);
    if (r.comparison) k.push(`<div class="kpi"><span class="k">${t("ratio")}</span><span class="v">${fmt(r.comparison.ratio_PIANC_over_OCDI, 2)}</span><span class="u">${window.I18N.subs("E_k,d / E_f")}</span></div>`);
    $("energyKpis").innerHTML = k.join("");

    if (P) {
      const e = P.eccentricity;
      $("piancTable").innerHTML = kvTable([
        ["V_c (m/s)", fmt(P.V, 3), P.V_source],
        ["α_c (°)", fmt(P.alpha, 1), P.alpha_source],
        ["C_b", fmt(P.C_b, 4), "Eq. 5-15"],
        ["C_m", fmt(P.C_m, 3), P.C_m_source],
        ["C_e", fmt(P.C_e, 4), e.r_F ? `r_F = ${fmt(e.r_F, 2)} m, φ = ${fmt(e.phi_deg, 1)}°, K = ${fmt(e.K, 2)} m` : e.source],
        ["E_k,c (kNm)", `<b>${fmt(P.E_kc, 1)}</b>`, "Eq. 5-4"],
        ["γ_E,ref", fmt(P.gamma.gamma_E_ref, 2), P.gamma.ref_source],
        ["γ_n · γ_p · γ_c", `${fmt(P.gamma.gamma_n, 3)} · ${fmt(P.gamma.gamma_p, 2)} · ${fmt(P.gamma.gamma_c, 2)}`, "Eq. 5-19, bước 7–8"],
        ["E_k,d (kNm)", `<b>${fmt(P.E_kd, 1)}</b>`, "Eq. 5-3"],
      ]);
      $("piancSteps").textContent = P.steps.join("\n");
    } else { $("piancTable").innerHTML = `<p class="muted">—</p>`; $("piancSteps").textContent = ""; }
    if (O) {
      $("ocdiTable").innerHTML = kvTable([
        ["V_b (m/s)", fmt(O.V, 3), O.V_source],
        ["θ (°)", fmt(O.theta, 1), ""],
        ["C_b", fmt(O.C_b, 4), "Eq. 2.2.4"],
        ["C_m", fmt(O.C_m, 4), "Eq. 2.2.3 (Ueda)"],
        ["r (m)", fmt(O.r, 2), "Eq. 2.2.7"],
        ["l (m)", fmt(O.l, 2), O.L1 != null ? `L1 = ${fmt(O.L1, 2)}, L2 = ${fmt(O.L2, 2)}; ${O.e_source}` : O.C_e_source],
        ["C_e", fmt(O.C_e, 4), "Eq. 2.2.6"],
        ["C_s · C_c", `${fmt(O.C_s, 2)} · ${fmt(O.C_c, 2)}`, "8.2.2 (6)–(7)"],
        ["E_f (kNm)", `<b>${fmt(O.E_f, 1)}</b>`, "Eq. 2.2.1"],
      ]);
      $("ocdiSteps").textContent = O.steps.join("\n");
    } else { $("ocdiTable").innerHTML = `<p class="muted">—</p>`; $("ocdiSteps").textContent = ""; }

    const warns = [...new Set([...(r.warnings || []), ...(P ? P.warnings : []), ...(O ? O.warnings : [])])];
    const w = $("energyWarn");
    w.hidden = !warns.length;
    w.innerHTML = warns.length ? `<b>${t("warnings")}</b><ul>${warns.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
    $("sweepChart").innerHTML = "";
  }
  function hullDefault(ship) {
    const rows = (((state.standards || {}).PIANC2024 || {}).hull_pressure || {}).rows || [];
    const cls = (ship.class_name || "").toLowerCase();
    let type = ship.ship_type, size = null;
    if (type === "General" && (cls.includes("car") || cls.includes("roro"))) type = "Cruise";
    if (type === "Container") size = cls.includes("post") ? "post_panamax_and_larger" : "panamax_and_smaller";
    const row = rows.find((r) => r.type === type && (!r.size || r.size === size) &&
      (r.dwt_max == null || ship.DWT <= r.dwt_max) && (r.dwt_min == null || ship.DWT > r.dwt_min));
    return row ? { p: row.p_kN_m2, label: `${type}${size ? " " + size.replace(/_/g, " ") : ""}` } : null;
  }
  function prefillFender() {
    const r = state.energy; if (!r) return;
    const P = r.results.PIANC2024, O = r.results.OCDI2020;
    if (!P && O) $("f_std").value = "OCDI2020";
    const std = $("f_std").value;
    const res = std === "OCDI2020" ? O : P;
    if (res) $("f_E").value = Math.round(res.E_design * 10) / 10;
    if (P || O) $("f_V").value = (P || O).V;
    $("f_ang").value = P ? P.alpha : (O.theta || 0);
    const h = hullDefault(state.energyReq.ship);
    const hint = [];
    if (std === "PIANC2024" && h) { if (!$("f_p").value) $("f_p").value = h.p; hint.push(t("hullDefault", { p: h.p, t: h.label })); }
    if (std === "OCDI2020") hint.push(t("ocdiHull"));
    $("fHint").textContent = hint.join(" ");
  }
  async function calcEnergy() {
    let req;
    try { req = buildEnergyReq(); } catch (e) { showError(e.message); goTab("ship"); return; }
    const out = await busy($("btnEnergy"), () => apiCall("/api/berthing/energy", "POST", req));
    if (!out) return;
    state.energyReq = req; state.energy = out;
    renderEnergy(); prefillFender(); markDone("ship"); markDone("cond"); markDone("energy");
    goTab("energy");
  }
  async function runSweep() {
    if (!state.energyReq) return;
    const P = state.energy.results.PIANC2024 || state.energy.results.OCDI2020;
    const V0 = P.V;
    const values = [0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4].map((f) => Math.round(V0 * f * 1000) / 1000);
    const out = await busy($("btnSweep"), () => apiCall("/api/berthing/sweep", "POST", { ...state.energyReq, param: "velocity", values }));
    if (!out) return;
    const series = [];
    if (out.rows[0].PIANC2024 != null) series.push({ name: "PIANC E_k,d", xs: out.rows.map((r) => r.value), ys: out.rows.map((r) => r.PIANC2024) });
    if (out.rows[0].OCDI2020 != null) series.push({ name: "OCDI E_f", xs: out.rows.map((r) => r.value), ys: out.rows.map((r) => r.OCDI2020), dash: "6 4" });
    window.Charts.lineChart($("sweepChart"), { title: "E (kNm) — V (m/s)", xLabel: "V (m/s)", yLabel: "E (kNm)", series });
  }

  // ------------------------------------------------------------ 4. ĐỆM
  function renderMfrChecks() {
    const box = $("mfrChecks"); box.innerHTML = "";
    const seen = new Map();
    state.fenders.forEach((s) => { if (!seen.has(s.manufacturer_id)) seen.set(s.manufacturer_id, s.manufacturer); });
    seen.forEach((name, id) => {
      const l = document.createElement("label"); l.className = "check";
      l.innerHTML = `<input type="checkbox" data-mfr="${esc(id)}" checked><span>${esc(name)}</span>`;
      box.appendChild(l);
    });
  }
  function fenderConditions() {
    const E = num("f_E"), V = num("f_V");
    if (!(E > 0) || !(V > 0)) throw new Error(t("needEnergy"));
    const P = state.energy && state.energy.results.PIANC2024;
    return {
      standard: $("f_std").value, E_demand: E, velocity: V, angle: num("f_ang") || 0,
      T_high: num("f_Th") ?? 30, T_low: num("f_Tl") ?? 10, consequence: $("p_cc").value, contact: $("p_contact").value,
      alpha_c: P ? P.alpha : (num("f_ang") || 5), C_mult: num("f_cm") || 1,
      R_allow: num("f_R"), p_hull: num("f_p"), panel_area: num("f_A"),
    };
  }
  async function runSelect() {
    let cond;
    try { cond = fenderConditions(); } catch (e) { showError(e.message); return; }
    const manufacturers = [...document.querySelectorAll("[data-mfr]")].filter((c) => c.checked).map((c) => c.dataset.mfr);
    const types = [$("t_cone").checked && "cone", $("t_cell").checked && "cell"].filter(Boolean);
    const req = { ...cond, manufacturers, types, top: 10, per_manufacturer: 3 };
    const out = await busy($("btnSelect"), () => apiCall("/api/fenders/select", "POST", req));
    if (!out) return;
    state.selectReq = req; state.select = out; state.compare.clear();
    renderCandidates();
  }
  function renderCandidates() {
    const out = state.select, tb = $("candTable").querySelector("tbody");
    $("selSummary").textContent = t("evaluated", { p: out.passed, n: out.evaluated });
    if (!out.candidates.length) {
      const why = Object.entries(out.rejected_reasons).map(([k, v]) => `${k}: ${v}`).join("; ");
      tb.innerHTML = `<tr><td colspan="8" class="empty">${esc(why || "—")}</td></tr>`;
      return;
    }
    tb.innerHTML = out.candidates.map((c, i) => `<tr class="clickable" data-i="${i}">
      <td><input type="checkbox" data-cmp="${i}" aria-label="compare"></td>
      <td class="fname">${esc(SHORT[c.manufacturer_id] || c.manufacturer)} · <b>${esc(c.size)}</b><br><span class="muted small">${esc(c.series)}</span></td>
      <td>${esc(c.grade)}</td><td>${fmt(c.E_capacity, 0)}</td><td>${fmt(c.utilisation * 100, 0)} %</td>
      <td>${fmt(c.R_design, 0)}</td><td>${fmt(c.deflection_pct, 1)}</td><td>${c.panel_area_required != null ? fmt(c.panel_area_required, 2) : "–"}</td></tr>`).join("");
    tb.querySelectorAll("tr.clickable").forEach((tr) => tr.addEventListener("click", (ev) => {
      if (ev.target.matches("input")) return;
      tb.querySelectorAll("tr").forEach((x) => x.classList.remove("sel")); tr.classList.add("sel");
      const c = state.select.candidates[Number(tr.dataset.i)];
      runCheck({ series_id: c.series_id, size: c.size, grade: c.grade });
    }));
    tb.querySelectorAll("[data-cmp]").forEach((cb) => cb.addEventListener("change", () => {
      const i = Number(cb.dataset.cmp);
      if (cb.checked) { if (state.compare.size >= 4) { cb.checked = false; return; } state.compare.add(i); } else state.compare.delete(i);
      $("btnCompare").disabled = state.compare.size < 2;
      toast(t("selectedInfo", { n: state.compare.size }), 1200);
    }));
    $("btnCompare").disabled = true;
  }
  function pitchInputs() {
    const ship = state.energyReq ? state.energyReq.ship : null;
    return { B: ship ? ship.B : null, L_bow: num("pc_Lbow"), LOA_min: num("pc_LOAmin"),
             panel_thickness: num("pc_tp") || 0, d_support_tan_beta: num("pc_db") || 0 };
  }
  async function runCheck(fender, btn) {
    let cond;
    try { cond = fenderConditions(); } catch (e) { showError(e.message); return; }
    const req = { ...cond, ...fender, ...pitchInputs() };
    const out = await busy(btn || $("btnSelect"), () => apiCall("/api/fenders/check", "POST", req));
    if (!out) return;
    state.checkReq = req; state.check = out;
    renderDetail(); markDone("fender");
  }
  function renderDetail() {
    const c = state.check, isP = state.checkReq.standard === "PIANC2024";
    $("detailCard").hidden = false;
    $("detailTitle").textContent = c.series_id === "custom" ? `${c.series} (${c.manufacturer})` : `${c.manufacturer} · ${c.series} · ${c.size} ${c.grade}`;
    $("detailBadge").innerHTML = `<span class="badge ${c.pass ? "ok" : "err"}">${c.pass ? t("pass") : t("fail")}</span>` +
      (c.verified === false || c.base === "nhập tay" ? `<span class="badge warn">${t("unverified")}</span>` : "");
    $("detailKpis").innerHTML = [
      [isP ? "E_f,d" : "E_s = φ·E_cat", fmt(c.E_capacity, 0), "kNm"],
      [t("hUtil"), fmt(c.utilisation * 100, 0) + " %", c.check_text],
      [isP ? "R_f,d" : "R (+tol)", fmt(c.R_design, 0), "kN"],
      ["δ", fmt(c.deflection_mm, 0) + " mm", fmt(c.deflection_pct, 1) + " %"],
    ].map(([k, v, u], i) => `<div class="kpi${i === 0 ? " hero" : ""}"><span class="k">${window.I18N.subs(k)}</span><span class="v">${v}</span><span class="u">${esc(u)}</span></div>`).join("");
    const cv = c.curve;
    const Eop = interp(c.deflection_pct, cv.defl_pct, cv.E_kNm), Rop = c.R_at_demand_pct * c.R_char / 100;
    $("detailCharts").innerHTML = "<div></div><div></div>";
    const [d1, d2] = $("detailCharts").children;
    window.Charts.lineChart(d1, { title: "R – δ", xLabel: "δ (mm)", yLabel: "R (kN)", series: [{ name: "R", xs: cv.defl_mm, ys: cv.R_kN }],
      points: [{ x: c.deflection_mm, y: Rop, label: `${fmt(Rop, 0)} kN` }] });
    window.Charts.lineChart(d2, { title: "E – δ", xLabel: "δ (mm)", yLabel: "E (kNm)", series: [{ name: "E", xs: cv.defl_mm, ys: cv.E_kNm, color: "#c2410c" }],
      points: [{ x: c.deflection_mm, y: Eop, label: `${fmt(Eop, 0)} kNm` }] });
    const rows = [
      [`E_base / R_base (${c.base})`, `${fmt(c.E_base, 1)} kNm / ${fmt(c.R_base, 1)} kN`],
      ["C_v", `${fmt(c.C_v, 3)}`, c.C_v_source],
      ["C_t (T cao / T thấp)", `${fmt(c.C_t_high, 3)} / ${fmt(c.C_t_low, 3)}`],
      ["C_ang (E / R)", `${fmt(isP ? c.C_ang_E_used : c.C_ang_E, 3)} / ${fmt(c.C_ang_R, 3)}`],
    ];
    if (isP) rows.push(["C_mult", fmt(c.C_mult, 2)], ["γ_f · γ_mult · γ_R", `${fmt(c.gamma_f, 2)} · ${fmt(c.gamma_mult, 2)} · ${fmt(c.gamma_R, 2)}`, "Bảng 6-3, 6-4, 6-5"],
      ["E_f,c (kNm)", fmt(c.E_capacity_char, 1)], ["R_f,c (kN) — kết cấu đỡ", fmt(c.R_support_char, 1), "6.7.1.4: F_d = R_f,c · γ_Q · φ_Q"]);
    else rows.push(["φ (1 − dung sai)", fmt(c.phi, 2), "Eq. 9.2.4"], ["E_cat (kNm)", fmt(c.E_cat, 1)]);
    if (c.panel_area_required != null) rows.push(["A_panel cần (m²)", fmt(c.panel_area_required, 2)]);
    if (c.hull_pressure != null) rows.push(["p vỏ tàu (kN/m²)", fmt(c.hull_pressure, 0)]);
    if (c.reasons && c.reasons.length) rows.push(["Không đạt", esc(c.reasons.join("; "))]);
    $("detailFactors").innerHTML = rows.map(([k, v, n]) => `<tr><th>${window.I18N.subs(k)}</th><td>${v}</td><td class="l muted small">${esc(n || "")}</td></tr>`).join("");
    const p = c.pitch || {};
    const pr = [["c_min (m)", fmt(p.c_min, 2)]];
    if (p.R_B != null) pr.push(["R_B (m)", fmt(p.R_B, 2)], ["h_f,act (m)", fmt(p.h_f_act, 3)], ["p_max (m)", `<b>${fmt(p.p_max, 2)}</b>`]);
    if (p.p_max_concept != null) pr.push(["0,15 · LOA_min (m)", fmt(p.p_max_concept, 2)]);
    $("pitchTable").innerHTML = pr.map(([k, v]) => `<tr><th>${window.I18N.subs(k)}</th><td>${v}</td></tr>`).join("");
    const src = c.source ? Object.entries(c.source).map(([k, v]) => `${k}: ${v}`).join("; ") : "";
    $("detailSource").textContent = c.catalogue ? `${c.catalogue.title} (${c.catalogue.edition}) — ${src}` : (c.note || "");
  }
  async function runCompare() {
    const picks = [...state.compare].map((i) => state.select.candidates[i]);
    let cond;
    try { cond = fenderConditions(); } catch (e) { showError(e.message); return; }
    const res = await busy($("btnCompare"), () => Promise.all(picks.map((c) =>
      apiCall("/api/fenders/check", "POST", { ...cond, series_id: c.series_id, size: c.size, grade: c.grade, ...pitchInputs() }))));
    if (!res) return;
    $("compareCard").hidden = false;
    const head = `<thead><tr><th></th>${res.map((c) => `<th>${esc(c.manufacturer)}<br>${esc(c.size)} ${esc(c.grade)}</th>`).join("")}</tr></thead>`;
    const line = (label, f) => `<tr><td>${window.I18N.subs(label)}</td>${res.map((c) => `<td>${f(c)}</td>`).join("")}</tr>`;
    $("compareTable").innerHTML = head + "<tbody>" + [
      line("E_cap (kNm)", (c) => fmt(c.E_capacity, 0)), line(t("hUtil"), (c) => fmt(c.utilisation * 100, 0) + " %"),
      line("R_d (kN)", (c) => fmt(c.R_design, 0)), line("δ (mm)", (c) => fmt(c.deflection_mm, 0)),
      line("H (mm)", (c) => fmt(c.H_mm, 0)), line("C_v", (c) => fmt(c.C_v, 3)),
      line("A_panel (m²)", (c) => c.panel_area_required != null ? fmt(c.panel_area_required, 2) : "–"),
      line("p_max (m)", (c) => c.pitch && c.pitch.p_max != null ? fmt(c.pitch.p_max, 2) : "–"),
    ].join("") + "</tbody>";
    $("compareCharts").innerHTML = "<div></div><div></div>";
    const [a, b] = $("compareCharts").children;
    const name = (c) => `${c.size} ${c.grade}`;
    window.Charts.lineChart(a, { title: "R – δ", xLabel: "δ (mm)", yLabel: "R (kN)", series: res.map((c) => ({ name: name(c), xs: c.curve.defl_mm, ys: c.curve.R_kN })) });
    window.Charts.lineChart(b, { title: "E – δ", xLabel: "δ (mm)", yLabel: "E (kNm)", series: res.map((c) => ({ name: name(c), xs: c.curve.defl_mm, ys: c.curve.E_kNm })) });
    $("compareCard").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function runCustom() {
    const lines = $("cu_curve").value.split(/\n+/).map((l) => l.split(/[;,\t ]+/).map(Number).filter((x) => isFinite(x))).filter((r) => r.length >= 3);
    if (lines.length < 3) { showError(t("customBad")); return; }
    const custom = {
      name: $("cu_name").value || "Custom", H_mm: num("cu_H"), E: num("cu_E"), R: num("cu_R"),
      rated_deflection_pct: num("cu_rd"), tolerance_pct: num("cu_tol") ?? 10,
      defl_pct: lines.map((r) => r[0]), E_pct: lines.map((r) => r[1]), R_pct: lines.map((r) => r[2]),
    };
    runCheck({ custom }, $("btnCustom"));
  }

  // ------------------------------------------------------------ 5. BÁO CÁO
  function reportHtml(r) {
    const s = r.input.ship, E = r.energy, P = E.results.PIANC2024, O = E.results.OCDI2020, F = r.fender;
    const tbl = (rows) => `<table class="kv">${rows.map(([k, v]) => `<tr><th>${window.I18N.subs(k)}</th><td>${v}</td></tr>`).join("")}</table>`;
    const edited = editedFields();
    let h = `<h2>${esc(r.project || t("title"))}</h2><p class="meta">${esc(r.generated_at)} · v${esc(r.version)} · ${esc(location.host)}</p>`;
    h += `<div class="notice">${esc(r.disclaimer)}</div>`;
    h += `<h3>1. ${t("dims")}</h3>` + tbl([
      [t("shipType"), esc(`${s.ship_type} — ${s.class_name || ""}`)], ["DWT (t)", fmt(s.DWT, 0)], ["M (t)", fmt(s.M, 0)],
      ["LOA / L_BP (m)", `${fmt(s.LOA, 1)} / ${fmt(s.LBP, 1)}`], ["B / T (m)", `${fmt(s.B, 2)} / ${fmt(s.T, 2)}`],
      ["C_b", fmt(E.ship.Cb, 4)], [t("loadCond"), esc(s.load_condition)],
      ["Sửa tay / edited", esc(edited.join(", ") || "—")],
    ]);
    h += `<h3>2. ${t("tabCond")}</h3>` + tbl([
      [t("mode"), esc(r.input.berth.mode)], [t("depth"), fmt(r.input.berth.water_depth, 2)],
      ["U_c (m)", fmt(E.ship.UKC, 2)], [t("nav"), esc(r.input.pianc.navigation)], [t("cc"), esc(r.input.pianc.consequence)],
    ]);
    if (P) h += `<h3>3a. PIANC WG 211 (2024)</h3><pre class="steps">${esc(P.steps.join("\n"))}</pre>`;
    if (O) h += `<h3>3b. OCDI 2020</h3><pre class="steps">${esc(O.steps.join("\n"))}</pre>`;
    if (E.comparison) h += `<p>${t("ratio")}: <b>${fmt(E.comparison.ratio_PIANC_over_OCDI, 2)}</b> — ${esc(E.comparison.note)}</p>`;
    const warns = [...new Set([...(E.warnings || []), ...(P ? P.warnings : []), ...(O ? O.warnings : [])])];
    if (warns.length) h += `<div class="notice"><b>${t("warnings")}</b><ul>${warns.map((w) => `<li>${esc(w)}</li>`).join("")}</ul></div>`;
    if (F) {
      h += `<h3>4. ${t("tabFender")}: ${esc(F.series_id === "custom" ? F.series + " (" + F.manufacturer + ")" : `${F.manufacturer} ${F.series} ${F.size} ${F.grade}`)} — ${F.pass ? t("pass") : t("fail")}</h3>`;
      h += tbl([
        [t("fStd"), esc(r.fender_input.standard)], [t("fE"), fmt(r.fender_input.E_demand, 1)],
        ["E_cap (kNm)", fmt(F.E_capacity, 1)], [t("hUtil"), fmt(F.utilisation * 100, 0) + " %"], ["R_d (kN)", fmt(F.R_design, 0)],
        ["δ (mm / %)", `${fmt(F.deflection_mm, 0)} / ${fmt(F.deflection_pct, 1)}`],
        ["C_v / C_t,hi / C_t,lo / C_ang", `${fmt(F.C_v, 3)} / ${fmt(F.C_t_high, 3)} / ${fmt(F.C_t_low, 3)} / ${fmt(F.C_ang_E, 3)}`],
        ["A_panel (m²)", F.panel_area_required != null ? fmt(F.panel_area_required, 2) : "–"],
        ["p_max (m)", F.pitch && F.pitch.p_max != null ? fmt(F.pitch.p_max, 2) : "–"],
        [esc(F.check_text), ""],
      ]);
      if (F.catalogue) h += `<p class="meta">${esc(F.catalogue.title)} (${esc(F.catalogue.edition)}) — ${esc(Object.values(F.source || {}).join("; "))}</p>`;
    }
    h += `<h3>5. Nguồn / Sources</h3><ul>${Object.entries(r.sources).map(([k, v]) =>
      `<li>${esc(v.title)} — ${v.available === false ? t("pending") : v.verified ? "verified" : t("unverified")}</li>`).join("")}</ul>`;
    return h;
  }
  async function makeReport() {
    if (!state.energyReq) { showError(t("needEnergy")); goTab("cond"); return; }
    const body = { energy: state.energyReq, project: $("r_project").value || null };
    if (state.checkReq) body.fender = state.checkReq;
    const out = await busy($("btnReport"), () => apiCall("/api/report", "POST", body));
    if (!out) return;
    state.report = out;
    $("reportOut").innerHTML = reportHtml(out);
    ["btnPrint", "btnCsv", "btnJson"].forEach((id) => ($(id).disabled = false));
    markDone("report"); toast(t("reportReady"));
  }
  function exportCsv() {
    const r = state.report; if (!r) return;
    const rows = [["section", "key", "value"]];
    const s = r.input.ship;
    Object.entries(s).forEach(([k, v]) => rows.push(["ship", k, v]));
    Object.entries(r.energy.results).forEach(([std, res]) => {
      ["V", "alpha", "theta", "C_b", "C_m", "C_e", "E_kc", "E_kd", "E_f", "E_design"].forEach((k) => { if (res[k] != null) rows.push([std, k, res[k]]); });
      if (res.gamma) Object.entries(res.gamma).forEach(([k, v]) => rows.push([std, k, v]));
    });
    if (r.fender) ["manufacturer", "series", "size", "grade", "E_capacity", "R_design", "utilisation", "deflection_mm", "C_v", "C_t_high", "C_t_low", "C_ang_E", "panel_area_required"]
      .forEach((k) => rows.push(["fender", k, r.fender[k]]));
    if (state.select) state.select.candidates.forEach((c, i) => rows.push([`candidate_${i + 1}`, `${c.manufacturer} ${c.size} ${c.grade}`, `E=${c.E_capacity.toFixed(1)};R=${c.R_design.toFixed(1)}`]));
    const csv = rows.map((r) => r.map((x) => `"${String(x == null ? "" : x).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    download(`berthing-${s.ship_type}-${Math.round(s.DWT)}.csv`, "﻿" + csv, "text/csv;charset=utf-8");
  }
  function exportJson() {
    download("berthing-input.json", JSON.stringify({ energy: state.energyReq, fender: state.checkReq }, null, 2), "application/json");
  }
  function printReport() {
    const p = document.querySelector('[data-panel="report"]');
    p.classList.add("print-me");
    window.print();
    setTimeout(() => p.classList.remove("print-me"), 500);
  }

  // ------------------------------------------------------------ khởi động
  function bind() {
    document.querySelectorAll("[data-lang]").forEach((b) => (b.onclick = () => window.I18N.setLang(b.dataset.lang)));
    document.addEventListener("langchange", () => { if (state.energy) renderEnergy(); if (state.check) renderDetail(); if (state.report) $("reportOut").innerHTML = reportHtml(state.report); });
    document.querySelectorAll(".apptabs button").forEach((b) => (b.onclick = () => goTab(b.dataset.tab)));
    document.querySelectorAll("[data-goto]").forEach((b) => (b.onclick = () => goTab(b.dataset.goto)));
    document.querySelectorAll("#methodSeg button").forEach((b) => (b.onclick = () => {
      state.method = b.dataset.method;
      document.querySelectorAll("#methodSeg button").forEach((x) => x.classList.toggle("on", x === b));
      $("methodList").hidden = state.method !== "list"; $("methodDwt").hidden = state.method !== "dwt";
    }));
    document.querySelectorAll("#loadSeg button").forEach((b) => (b.onclick = () => {
      state.load = b.dataset.load;
      document.querySelectorAll("#loadSeg button").forEach((x) => x.classList.toggle("on", x === b));
      applyLoad();
    }));
    $("shipSelect").addEventListener("change", () => {
      const s = (state.ships[state.shipType] || [])[Number($("shipSelect").value)];
      if (s) fillShip(s, t("loaded"));
    });
    $("btnEstimate").onclick = async () => {
      const body = { ship_type: state.shipType, ship_class: Number($("shipClass").value) || 1, DWT: num("dwtInput") };
      const out = await busy($("btnEstimate"), () => apiCall("/api/ships/estimate", "POST", body));
      if (out && out.ship) fillShip(out.ship, t("estimated"));
    };
    Object.entries(DIM_IDS).forEach(([k, id]) => $(id).addEventListener("input", () => {
      $(id).classList.toggle("edited", $(id).value !== (state.loaded[k] ?? ""));
      updateCb();
    }));
    $("d_rho").addEventListener("input", updateCb);
    $("btnEnergy").onclick = calcEnergy;
    $("btnSweep").onclick = runSweep;
    $("f_std").addEventListener("change", () => { $("f_p").value = ""; prefillFender(); });
    $("btnSelect").onclick = runSelect;
    $("btnCompare").onclick = runCompare;
    $("btnCustom").onclick = runCustom;
    $("btnPitch").onclick = () => { if (state.checkReq) runCheck(state.checkReq.custom ? { custom: state.checkReq.custom } :
      { series_id: state.checkReq.series_id, size: state.checkReq.size, grade: state.checkReq.grade }, $("btnPitch")); };
    $("btnReport").onclick = makeReport;
    $("btnPrint").onclick = printReport;
    $("btnCsv").onclick = exportCsv;
    $("btnJson").onclick = exportJson;
  }

  async function init() {
    window.I18N.apply();
    bind();
    renderTypeSeg(); renderClasses(); renderShipList();
    await checkApi();
    apiCall("/api/standards").then((s) => (state.standards = s)).catch(() => {});
    apiCall("/api/fenders").then((f) => { state.fenders = f.series || []; renderMfrChecks(); }).catch((e) => showError(e.message));
    await loadShipData();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
