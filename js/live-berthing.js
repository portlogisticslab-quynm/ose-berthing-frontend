/* Berthing AI — "Live Berthing" demo tab (3.6.0-demo).
 * Replays synthetic berthing events as if they were streaming from port-shm, forecasts the contact
 * state with uncertainty and propagates it through energy → fender → wharf displacement → alert.
 * All data are synthetic and all parameters illustrative (see LiveBerthingCore.assumptionsText()).
 */
'use strict';
const LB = window.LiveBerthingCore;
const LIVE = { ds: null, split: null, model: null, two: true, ev: null, idx: 0, timer: null, speed: 30, series: [], fender: LB.makeFender(), cfg: LB.DEFAULTS, live: null };
const $ = (id) => document.getElementById(id);
const fmt = (x, n = 2) => (Number.isFinite(Number(x)) ? Number(x).toFixed(n) : '—');
const LEVEL_TXT = { Normal: 'Bình thường', Caution: 'Chú ý', Warning: 'Cảnh báo', Critical: 'Nguy hiểm' };

function liveSetStatus(msg, isErr = false) { const el = $('liveStatus'); if (el) { el.textContent = msg; el.classList.toggle('st-error', isErr); } logMsg('[Live] ' + msg); }

// ------------------------------------------------------------------ dataset + model
async function liveGenerate() {
  const n = clamp(Number($('liveCount').value) || 150, 20, 400), seed = Number($('liveSeed').value) || 20261101;
  setWait('Live Berthing', `Generating ${n} synthetic berthing events...`, 20);
  await new Promise((r) => setTimeout(r, 40));
  try {
    LIVE.ds = LB.generateDataset({ count: n, seed });
    liveAfterDataset(`Generated ${n} synthetic events (seed ${seed}).`);
  } finally { hideWait(); }
}
function liveAfterDataset(msg) {
  LIVE.split = LB.splitEvents(LIVE.ds.events, 0.3, 99);
  LIVE.model = LB.trainForecaster(LIVE.split.train, LIVE.cfg);
  const testIds = new Set(LIVE.split.test.map((e) => e.meta.eventId));
  const sel = $('liveEvent');
  sel.replaceChildren(...LIVE.ds.events.filter((e) => testIds.has(e.meta.eventId)).map((e) => {
    const o = document.createElement('option'); o.value = e.meta.eventId;
    o.textContent = `${e.meta.eventId} · ${e.meta.vessel.type} ${e.meta.vessel.DWT / 1000}k DWT · ${e.meta.scenario} · ${LEVEL_TXT[e.impact.levelName]}`;
    return o;
  }));
  const cnt = (k) => LIVE.ds.events.filter((e) => e.impact.levelName === k).length;
  liveSetStatus(`${msg} Outcome levels: ${LB.LEVELS.map((l) => `${l} ${cnt(l)}`).join(', ')}. Forecaster trained on ${LIVE.split.train.length} events; ${LIVE.split.test.length} unseen test events available for replay.`);
  liveValidate();
  liveSelect();
}
function liveValidate() {
  const lines = [`FORECASTER VALIDATION — ${LIVE.split.test.length} unseen test events (${LIVE.two ? '2 BRT sensors' : '1 BRT sensor'})`,
    'Dist(m)  MAE v(cm/s)  80%-band coverage  MAE angle(°)  Warning/Critical detected  False alarms'];
  for (const r of LB.validateForecaster(LIVE.model, LIVE.split.test, LIVE.cfg, LIVE.two)) {
    lines.push(`${String(r.D).padStart(6)}   ${fmt(100 * r.maeVelocity, 2).padStart(8)}   ${(fmt(100 * r.coverage80, 0) + ' %').padStart(10)}        ${fmt(r.maeAngle, 2).padStart(6)}       ${Number.isFinite(r.detection) ? (fmt(100 * r.detection, 0) + ' %').padStart(6) : '   n/a'} (${r.eventsWarnCrit} ev.)          ${Number.isFinite(r.falseAlarm) ? fmt(100 * r.falseAlarm, 0) + ' %' : 'n/a'}`);
  }
  lines.push('', 'Detection = share of Warning/Critical outcomes already flagged ≥ Warning at that distance.',
    'Late-braking and gust events typically become detectable only in the last 10–50 m — the lead time is short,', 'so real-time alerts must reach the berthing master / pilot, not only the port manager.');
  $('liveValidation').textContent = lines.join('\n');
}
function liveSelect() {
  pauseLive();
  const id = $('liveEvent').value;
  LIVE.ev = LIVE.ds?.events.find((e) => e.meta.eventId === id) || null;
  if (!LIVE.ev) return;
  LIVE.idx = 0;
  // precompute the forecast every 5 s (only past data are used at each step)
  LIVE.series = [];
  const b = LIVE.ev.brt;
  for (let i = 0; i < b.length; i += 5) LIVE.series.push(LB.forecastAt(LIVE.model, LIVE.ev, i, LIVE.cfg, LIVE.fender, LIVE.two, 200, 3));
  if ((b.length - 1) % 5) LIVE.series.push(LB.forecastAt(LIVE.model, LIVE.ev, b.length - 1, LIVE.cfg, LIVE.fender, LIVE.two, 200, 3));
  applyHysteresis(LIVE.series);
  const slider = $('liveSlider'); slider.max = String(b.length - 1); slider.value = '0';
  liveRender();
}

/** Alert hysteresis: escalate immediately, de-escalate only after the lower level has held for HOLD_S seconds
 *  (avoids flapping messages to the port manager). Adds .alertLevel / .alertName to every series point. */
const HOLD_S = 30;
function applyHysteresis(series) {
  let cur = 0, lowSince = null;
  for (const s of series) {
    if (s.level >= cur) { cur = s.level; lowSince = null; }
    else { lowSince ??= s.t; if (s.t - lowSince >= HOLD_S) { cur = s.level; lowSince = null; } }
    s.alertLevel = cur; s.alertName = LB.LEVELS[cur];
  }
}
const alertAt = (t) => { let a = LIVE.series[0]; for (const s of LIVE.series) { if (s.t <= t) a = s; else break; } return a; };

// ------------------------------------------------------------------ player
// Opt-in, one-way simulation stream. No request is sent by scrubbing/preview.
const SHM = {session: '', lastSent: -1, busy: false, ok: 0, fail: 0, relayToken: ''};
function shmStatus(msg) { const e=$('liveShmStatus'); if(e) e.textContent=msg; }
async function sendLiveShm() {
  if (!$('liveShmEnabled')?.checked || !LIVE.ev || SHM.busy || !LIVE.timer) return;
  const now = LIVE.ev.brt[LIVE.idx];
  const at = Math.floor(now.t/5)*5;
  if (at === SHM.lastSent) return;
  const f=LIVE.live, a=alertAt(now.t);
  if (!f) return;
  const body={source:'berthing-ai',mode:'simulation',session_id:SHM.session,
    event_id:LIVE.ev.meta.eventId,structure_code:'WH-P1',elapsed_s:at,
    event_ts:now.ts,distance_m:Math.max(0,now.n1_distance),
    displacement_p50_mm:f.displacement.p50,displacement_p90_mm:f.displacement.p90,
    displacement_limit_mm:LIVE.cfg.wharf.displacementLimit,
    probability_exceedance:f.probs.dispCritical,alert_level:a?.alertName || f.levelName};
  SHM.busy=true;
  try {
    const base=(window.APP_CONFIG?.API_BASE_URL||'').replace(/\/$/,'');
    if (!base) throw Error('Chưa cấu hình API_BASE_URL');
    const resp=await fetch(base+'/api/port-shm/forecast',{method:'POST',headers:{'Content-Type':'application/json','X-Relay-Token':SHM.relayToken},body:JSON.stringify(body)});
    if(!resp.ok) throw Error('HTTP '+resp.status+' '+(await resp.text()).slice(0,130));
    SHM.lastSent=at; SHM.ok++; shmStatus('Port-SHM: đã nhận '+SHM.ok+' bản tin (simulation)');
  } catch(err) { SHM.fail++; shmStatus('Port-SHM lỗi ('+SHM.fail+'): '+err.message); }
  finally { SHM.busy=false; }
}
$('liveShmEnabled').addEventListener('change', e => {
  if (e.target.checked) {
    const entered=window.prompt('Nhập Relay Token thử nghiệm (KHÔNG phải Gateway API Key). Token chỉ giữ trong bộ nhớ trang.');
    if (!entered || !entered.trim()) {e.target.checked=false;shmStatus('Chưa nhập Relay Token');return;}
    SHM.relayToken=entered.trim();
    SHM.session='sim_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);SHM.lastSent=-1; SHM.ok=0;SHM.fail=0;shmStatus('Đã bật: chỉ gửi khi nhấn Phát');}
  else {SHM.relayToken='';shmStatus('Đã tắt gửi Port-SHM');}
});
function playLive() {
  if (!LIVE.ev) throw new Error('Generate or load a dataset and select an event first.');
  if (LIVE.timer) return;
  if (LIVE.idx >= LIVE.ev.brt.length - 1) LIVE.idx = 0;
  LIVE.timer = setInterval(() => {
    LIVE.idx = Math.min(LIVE.ev.brt.length - 1, LIVE.idx + Math.max(1, Math.round(LIVE.speed / 5)));
    $('liveSlider').value = String(LIVE.idx);
    liveRender();
    void sendLiveShm();
    if (LIVE.idx >= LIVE.ev.brt.length - 1) pauseLive();
  }, 200);
}
function pauseLive() { if (LIVE.timer) clearInterval(LIVE.timer); LIVE.timer = null; }
function resetLive() { pauseLive(); LIVE.idx = 0; $('liveSlider').value = '0'; liveRender(); }

// ------------------------------------------------------------------ rendering
function card(label, metric, value, unit, sub = '', cls = '') {
  return `<div class="shm-card ${cls}"><div class="shm-head"><span>${escapeHtml(label)}</span><span>${escapeHtml(metric)}</span></div>
    <div class="shm-val">${escapeHtml(value)}<small>${escapeHtml(unit)}</small></div><div class="shm-sub">${escapeHtml(sub)}</div></div>`;
}
function liveRender() {
  const ev = LIVE.ev; if (!ev) return;
  const b = ev.brt, i = LIVE.idx, now = b[i], done = i >= b.length - 1;
  const f = LB.forecastAt(LIVE.model, ev, i, LIVE.cfg, LIVE.fender, LIVE.two, 400, 5);
  LIVE.live = f;
  const al = alertAt(now.t), lvl = al?.alertName || f.levelName;
  const e = f.observed.env, Er = LIVE.fender.ratedEnergy, dl = LIVE.cfg.wharf.displacementLimit;
  const m = ev.meta;
  // banner
  const banner = $('liveBanner');
  banner.className = `live-banner lvl-${lvl}`;
  banner.innerHTML = `<span class="badge ${lvl}">${LEVEL_TXT[lvl]}</span>
    <b>${escapeHtml(m.eventId)}</b> · ${escapeHtml(m.vessel.type)} ${m.vessel.DWT.toLocaleString()} DWT (${m.vessel.laden ? 'đầy tải' : 'ballast'}, Δ ${m.vessel.displacement.toLocaleString()} t, ${m.tugs} tàu lai)
    · t = ${now.t} s · cách bến ${fmt(Math.max(0, now.n1_distance), 1)} m<br>${escapeHtml(al && al.alertLevel > f.level ? `${LEVEL_TXT[lvl].toUpperCase()} (giữ mức cảnh báo): dự báo mới nhất là "${LEVEL_TXT[f.levelName]}" — chỉ hạ mức khi ổn định ≥ ${HOLD_S} s. ${f.recommendation}` : f.recommendation)}`;
  // port-shm style sensor cards
  const sub = `Trực tuyến · ${new Date(now.ts).toLocaleTimeString()}`;
  $('liveSensors').innerHTML = [
    card('WH-P1-BRT-N1', 'distance', fmt(Math.max(0, now.n1_distance), 1), ' m', sub, 'ok'),
    card('WH-P1-BRT-N1', 'velocity', fmt(now.n1_velocity, 2), ' cm/s', sub, 'ok'),
    LIVE.two ? card('WH-P1-BRT-N2', 'angle', fmt(now.angle, 1), '°', sub, 'ok') : card('WH-P1-BRT-N2', 'angle', '—', '', 'Chế độ 1 cảm biến: không đo góc', 'off'),
    card('ENV-WIND-N1', 'speed / from', `${fmt(e.windSpeed, 1)} / ${fmt(e.windFrom, 0)}°`, ' m/s', `Thành phần hướng vào bến ${fmt(f.observed.windOn, 1)} m/s`, 'ok'),
    card('ENV-CUR-N1', 'speed / to', `${fmt(e.currentSpeed, 2)} / ${fmt(e.currentTo, 0)}°`, ' m/s', `Thành phần hướng vào bến ${fmt(f.observed.curOn, 2)} m/s`, 'ok'),
    card('ENV-WAVE-N1', 'Hs / Tp', `${fmt(e.hs, 2)} / ${fmt(e.tp, 1)}`, ' m / s', sub, 'ok'),
    card('ENV-TIDE-N1', 'level', fmt(e.tide, 2), ' m', sub, 'ok'),
    done ? card('WH-P1-FND-N1', 'value (đo)', fmt(ev.measured.fnd, 1), ' kN', 'Theo sự kiện · khi chạm bến', 'ok') : card('WH-P1-FND-N1', 'value', '—', '', 'Chờ sự kiện chạm bến', 'off'),
    done ? card('WH-P1-DSP-N1', 'dx (đo)', fmt(ev.measured.dsp_dx, 2), ' mm', 'Theo sự kiện · khi chạm bến', 'ok') : card('WH-P1-DSP-N1', 'dx', '—', '', 'Chờ sự kiện chạm bến', 'off'),
  ].join('');
  // forecast cards
  const pE = (x) => `${fmt(x, 0)} kJ (${fmt((100 * x) / Er, 0)} % Er)`;
  $('liveForecast').innerHTML = [
    card('Dự báo vận tốc cập', 'P50 [P10–P90]', `${fmt(100 * f.velocity.p50, 1)}`, ' cm/s', `[${fmt(100 * f.velocity.p10, 1)} – ${fmt(100 * f.velocity.p90, 1)}] · thiết kế ${fmt(100 * LIVE.cfg.berth.designVelocity, 0)} cm/s`, 'fc'),
    card('Dự báo góc cập', 'P50 [P10–P90]', fmt(f.angle.p50, 1), '°', `[${fmt(f.angle.p10, 1)} – ${fmt(f.angle.p90, 1)}]${LIVE.two ? '' : ' · không đo góc'}`, 'fc'),
    card('Năng lượng cập (PIANC)', 'P50 / P90', pE(f.energy.p50), '', `P90 ${pE(f.energy.p90)} · P(≥0,85 Er) ${fmt(100 * f.probs.energyWarning, 0)} %`, 'fc'),
    card('Phản lực đệm', 'P50 / P90', `${fmt(f.reaction.p50, 0)} / ${fmt(f.reaction.p90, 0)}`, ' kN', `Rr ${LIVE.fender.ratedReaction} kN · độ nén P90 ${fmt(100 * f.deflectionRatio.p90, 0)} %`, 'fc'),
    card('Chuyển vị bến', 'P50 / P90', `${fmt(f.displacement.p50, 1)} / ${fmt(f.displacement.p90, 1)}`, ' mm', `Giới hạn ${dl} mm · P(≥ giới hạn) ${fmt(100 * f.probs.dispCritical, 0)} %`, 'fc'),
  ].join('');
  // charts
  drawLiveVelocity(ev, i, f, done);
  drawLiveProbability(i);
  drawLiveFender(f, done ? ev.impact : null);
  // alert log (level changes up to now)
  const log = [], series = LIVE.series.filter((s) => s.t <= now.t);
  let prev = -1;
  for (const s of series) { if (s.alertLevel !== prev) { log.push(s); prev = s.alertLevel; } }
  $('liveAlerts').textContent = log.length
    ? log.map((s) => `${new Date(s.ts).toLocaleTimeString()}  d=${fmt(Math.max(0, s.distance), 0).padStart(4)} m  ${s.alertName.padEnd(8)}  P(E≥0,85Er)=${fmt(100 * s.probs.energyWarning, 0)}%  P(E≥Er)=${fmt(100 * s.probs.energyCritical, 0)}%  P(δ≥lim)=${fmt(100 * s.probs.dispCritical, 0)}%`).join('\n')
    : 'Chưa có cảnh báo.';
  // outcome comparison
  if (done) {
    const im = ev.impact, ms = ev.measured, at = (D) => { const k = LB.indexAtDistance(ev, D); return k < 0 ? null : LB.forecastAt(LIVE.model, ev, k, LIVE.cfg, LIVE.fender, LIVE.two, 400, 5); };
    const rows = [[200, at(200)], [50, at(50)], [20, at(20)], [5, at(5)]].filter((x) => x[1]);
    $('liveOutcome').textContent =
`KẾT QUẢ KHI CHẠM BẾN (giá trị "thực" của sự kiện giả định)
Vận tốc cập ${fmt(100 * im.contactVelocity, 2)} cm/s · góc ${fmt(im.contactAngle, 1)}° · năng lượng ${fmt(im.energy, 0)} kJ (${fmt((100 * im.energy) / Er, 0)} % Er, Cm ${fmt(im.Cm, 2)}, Ce ${fmt(im.Ce, 2)})
Phản lực đệm tính ${fmt(im.reaction, 0)} kN · "đo" FND ${fmt(ms.fnd, 0)} kN · chuyển vị tính ${fmt(im.displacement, 2)} mm · "đo" DSP dx ${fmt(ms.dsp_dx, 2)} mm
Mức rủi ro thực tế: ${im.levelName} (${LEVEL_TXT[im.levelName]}) · kịch bản: ${m.scenario}

Dự báo trước đó:
${rows.map(([D, x]) => `  tại ${String(D).padStart(3)} m: v P50 ${fmt(100 * x.velocity.p50, 1)} cm/s [${fmt(100 * x.velocity.p10, 1)}–${fmt(100 * x.velocity.p90, 1)}] · E P90 ${fmt(x.energy.p90, 0)} kJ · mức ${x.levelName}`).join('\n')}`;
  } else $('liveOutcome').textContent = 'Kết quả sẽ hiện khi tàu chạm bến.';
  $('liveTime').textContent = `${now.t} / ${b[b.length - 1].t} s`;
  if (typeof window.renderLiveAnimation === 'function') window.renderLiveAnimation();
}

function axes(ctx, w, h, X, Y, xt, yt, xl, yl) {
  ctx.strokeStyle = '#e2e8f0'; ctx.fillStyle = '#64748b'; ctx.font = '11px Segoe UI'; ctx.lineWidth = 1;
  for (const v of yt) { const y = Y(v); ctx.beginPath(); ctx.moveTo(44, y); ctx.lineTo(w - 10, y); ctx.stroke(); ctx.fillText(String(v), 4, y + 4); }
  for (const v of xt) { const x = X(v); ctx.fillText(String(v), x - 8, h - 8); }
  ctx.fillText(xl, w - 10 - ctx.measureText(xl).width, h - 20); if (yl) ctx.fillText(yl, 48, 14);
}
function drawLiveVelocity(ev, i, f, done) {
  const c = $('liveVelCanvas'); const { ctx, w, h } = prepCanvas(c); ctx.clearRect(0, 0, w, h);
  const b = ev.brt, dMax = Math.ceil(b[0].n1_distance / 50) * 50;
  const vMax = Math.max(60, ...b.slice(0, i + 1).map((x) => x.n1_velocity), 100 * f.velocity.p90 + 5);
  const X = (d) => 44 + (1 - d / dMax) * (w - 60), Y = (v) => h - 30 - (v / vMax) * (h - 50);
  axes(ctx, w, h, X, Y, [dMax, Math.round(dMax / 2), 100, 0], [0, 10, 20, Math.round(vMax / 2), Math.round(vMax)].filter((v, k, a) => a.indexOf(v) === k), 'khoảng cách tới bến (m)', '');
  // design velocity
  ctx.setLineDash([6, 4]); ctx.strokeStyle = '#d97706'; ctx.beginPath(); ctx.moveTo(44, Y(100 * LIVE.cfg.berth.designVelocity)); ctx.lineTo(w - 10, Y(100 * LIVE.cfg.berth.designVelocity)); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#d97706'; ctx.fillText('vận tốc thiết kế', w - 110, Y(100 * LIVE.cfg.berth.designVelocity) - 4);
  // measured history
  ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 2; ctx.beginPath();
  for (let k = 0; k <= i; k += 2) { const x = X(b[k].n1_distance), y = Y(b[k].n1_velocity); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
  // forecast band at contact
  const x0 = X(0);
  ctx.fillStyle = 'rgba(220,38,38,.18)'; ctx.fillRect(x0 - 8, Y(100 * f.velocity.p90), 16, Y(100 * f.velocity.p10) - Y(100 * f.velocity.p90));
  ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.arc(x0, Y(100 * f.velocity.p50), 4, 0, 2 * Math.PI); ctx.fill();
  ctx.setLineDash([3, 3]); ctx.strokeStyle = '#dc2626'; ctx.beginPath(); ctx.moveTo(X(b[i].n1_distance), Y(b[i].n1_velocity)); ctx.lineTo(x0, Y(100 * f.velocity.p50)); ctx.stroke(); ctx.setLineDash([]);
  if (done) { ctx.fillStyle = '#059669'; ctx.beginPath(); ctx.arc(x0, Y(100 * ev.impact.contactVelocity), 5, 0, 2 * Math.PI); ctx.fill(); }
  ctx.fillStyle = '#334155'; ctx.fillText('— đo BRT · ● dự báo P50 + dải P10–P90 tại điểm chạm' + (done ? ' · ● thực tế (xanh)' : ''), 50, 14);
}
function drawLiveProbability(i) {
  const c = $('liveProbCanvas'); const { ctx, w, h } = prepCanvas(c); ctx.clearRect(0, 0, w, h);
  const tEnd = LIVE.ev.brt[LIVE.ev.brt.length - 1].t, tNow = LIVE.ev.brt[i].t;
  const X = (t) => 44 + (t / tEnd) * (w - 60), Y = (p) => h - 30 - p * (h - 50);
  axes(ctx, w, h, X, Y, [0, Math.round(tEnd / 2), tEnd], [0, 0.2, 0.5, 1], 'thời gian (s)', '');
  ctx.setLineDash([5, 4]); ctx.strokeStyle = '#94a3b8'; ctx.beginPath(); ctx.moveTo(44, Y(LIVE.cfg.alert.probability)); ctx.lineTo(w - 10, Y(LIVE.cfg.alert.probability)); ctx.stroke(); ctx.setLineDash([]);
  const S = LIVE.series.filter((s) => s.t <= tNow);
  const lines = [['energyWarning', '#d97706', 'P(E ≥ 0,85 Er)'], ['energyCritical', '#dc2626', 'P(E ≥ Er)'], ['dispCritical', '#7c3aed', 'P(δ ≥ giới hạn)'], ['angleCaution', '#0891b2', 'P(góc ≥ 10°)']];
  lines.forEach(([k, col, lab], n) => {
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath();
    S.forEach((s, j) => { const x = X(s.t), y = Y(s.probs[k]); j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    ctx.fillStyle = col; ctx.fillText(lab, 50 + (n % 2) * 130, 12 + Math.floor(n / 2) * 14);
  });
}
function drawLiveFender(f, impact) {
  const c = $('liveFenderCanvas'); const { ctx, w, h } = prepCanvas(c); ctx.clearRect(0, 0, w, h);
  const F = LIVE.fender, rMax = 2.2 * F.ratedReaction;
  const X = (r) => 44 + (r / 0.9) * (w - 60), Y = (R) => h - 30 - (Math.min(R, rMax) / rMax) * (h - 50);
  axes(ctx, w, h, X, Y, [0, 0.36, 0.72, 0.9], [0, Math.round(F.ratedReaction / 2), F.ratedReaction, Math.round(rMax)], 'độ nén / chiều cao đệm', '');
  ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2; ctx.beginPath();
  F.curve.forEach(([x, y], k) => { const px = X(x), py = Y(y * F.ratedReaction); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.stroke();
  ctx.setLineDash([4, 4]); ctx.strokeStyle = '#d97706'; ctx.beginPath(); ctx.moveTo(X(F.ratedDeflection), 20); ctx.lineTo(X(F.ratedDeflection), h - 30); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#d97706'; ctx.fillText(`định mức: Er ${F.ratedEnergy} kJ, Rr ${F.ratedReaction} kN`, 50, 28);
  const pt = (x, R, col, rr) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(Math.min(x, 0.9)), Y(R), rr, 0, 2 * Math.PI); ctx.fill(); };
  pt(f.deflectionRatio.p50, f.reaction.p50, '#dc2626', 4); pt(f.deflectionRatio.p90, f.reaction.p90, 'rgba(220,38,38,.45)', 6);
  if (impact) pt(impact.deflectionRatio, impact.reaction, '#059669', 5);
  ctx.fillStyle = '#334155'; ctx.fillText('● dự báo P50 (đỏ) · ● P90 (hồng)' + (impact ? ' · ● thực tế (xanh)' : ''), 50, 14);
}

// ------------------------------------------------------------------ exports / import
async function liveExportDataset() {
  if (!LIVE.ds) throw new Error('Generate a dataset first.');
  setWait('Export dataset', 'Building CSV files...', 30); await new Promise((r) => setTimeout(r, 40));
  try {
    const t = LB.datasetTables(LIVE.ds), zip = new JSZip();
    zip.file('events.csv', LB.toCSV(t.events));
    zip.file('brt_timeseries_1s.csv', LB.toCSV(t.brt));
    zip.file('env_timeseries_10s.csv', LB.toCSV(t.env));
    zip.file('impact_sensors.csv', LB.toCSV(t.sensors));
    zip.file('assumptions.txt', LB.assumptionsText(LIVE.cfg, LIVE.fender) + `\n\nSeed ${LIVE.ds.seed}; ${LIVE.ds.events.length} events. Column names follow port-shm channel naming (CHANNEL.metric_unit).\n`);
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    downloadBlob(blob, `berthing_live_demo_dataset_${LIVE.ds.seed}.zip`);
    liveSetStatus(`Exported dataset ZIP (${t.events.length} events, ${t.brt.length.toLocaleString()} BRT rows).`);
  } finally { hideWait(); }
}
function liveExportAlerts() {
  if (!LIVE.series.length) throw new Error('Select an event first.');
  const rows = LIVE.series.map((s) => ({ event_id: LIVE.ev.meta.eventId, timestamp: s.ts, source: 'BERTHING-AI-LIVE', sensors: LIVE.two ? '2xBRT' : '1xBRT', distance_m: +s.distance.toFixed(1),
    alert_level: s.alertName, forecast_level: s.levelName, v_contact_p50_cms: +(100 * s.velocity.p50).toFixed(2), v_contact_p90_cms: +(100 * s.velocity.p90).toFixed(2), energy_p90_kJ: +s.energy.p90.toFixed(0),
    reaction_p90_kN: +s.reaction.p90.toFixed(0), displacement_p90_mm: +s.displacement.p90.toFixed(2), p_energy_ge_085Er: +s.probs.energyWarning.toFixed(3), p_energy_ge_Er: +s.probs.energyCritical.toFixed(3),
    p_disp_ge_limit: +s.probs.dispCritical.toFixed(3), recommendation: s.recommendation }));
  download(`berthing_live_alerts_${LIVE.ev.meta.eventId}.csv`, LB.toCSV(rows));
  liveSetStatus(`Exported ${rows.length} forecast/alert rows for ${LIVE.ev.meta.eventId} (port-shm alert format).`);
}
async function liveLoadZip(evn) {
  const file = evn.target.files?.[0]; if (!file) return;
  try {
    setWait('Load dataset ZIP', `Reading ${file.name}...`, 20);
    const zip = await JSZip.loadAsync(file);
    const read = async (n) => { const f = zip.file(n); if (!f) throw new Error(`${n} is missing in the ZIP.`); return parseCSV(await f.async('string')); };
    const [evs, brt, env, sen] = [await read('events.csv'), await read('brt_timeseries_1s.csv'), await read('env_timeseries_10s.csv'), await read('impact_sensors.csv')];
    const by = (rows) => rows.reduce((m, r) => ((m[r.event_id] ??= []).push(r), m), {});
    const B = by(brt), E = by(env), Sx = Object.fromEntries(sen.map((r) => [r.event_id, r]));
    const n = (x) => Number(x);
    const events = evs.map((r) => {
      const vp = LB.vesselParticulars(LB.VESSELS.find((v) => v.id === r.vessel_id) || LB.VESSELS[0], r.laden === 'true');
      const imp = LB.impactChain(vp, n(r.contact_velocity_mps), n(r.contact_angle_deg), LIVE.cfg, LIVE.fender, 0);
      return {
        meta: { eventId: r.event_id, scenario: r.scenario, start: r.start, vessel: { id: r.vessel_id, type: r.vessel_type, DWT: n(r.DWT), LOA: n(r.LOA_m), B: n(r.B_m), T: n(r.T_m), Cb: n(r.Cb), displacement: n(r.displacement_t), laden: r.laden === 'true' }, tugs: n(r.tugs), brtRange: n(r.brt_range_m) },
        brt: (B[r.event_id] || []).map((x) => ({ t: n(x.t_s), ts: x.timestamp, n1_distance: n(x['WH-P1-BRT-N1.distance_m']), n1_velocity: n(x['WH-P1-BRT-N1.velocity_cms']), n2_distance: n(x['WH-P1-BRT-N2.distance_m']), n2_velocity: n(x['WH-P1-BRT-N2.velocity_cms']), angle: n(x['BRT.angle_deg']) })),
        env: (E[r.event_id] || []).map((x) => ({ t: n(x.t_s), ts: x.timestamp, windSpeed: n(x['ENV-WIND-N1.speed_ms']), windFrom: n(x['ENV-WIND-N1.from_deg']), currentSpeed: n(x['ENV-CUR-N1.speed_ms']), currentTo: n(x['ENV-CUR-N1.to_deg']), hs: n(x['ENV-WAVE-N1.hs_m']), tp: n(x['ENV-WAVE-N1.tp_s']), tide: n(x['ENV-TIDE-N1.level_m']) })),
        impact: { contactVelocity: n(r.contact_velocity_mps), contactAngle: n(r.contact_angle_deg), ...imp, level: LB.LEVELS.indexOf(r.risk_level), levelName: r.risk_level },
        measured: { ts: r.contact_time, fnd: n(Sx[r.event_id]?.['WH-P1-FND-N1.value_kN']), dsp_dx: n(Sx[r.event_id]?.['WH-P1-DSP-N1.dx_mm']) },
      };
    }).filter((e) => e.brt.length > 30 && e.env.length);
    if (events.length < 20) throw new Error('At least 20 complete events are needed.');
    LIVE.ds = { seed: file.name, events };
    liveAfterDataset(`Loaded ${events.length} events from ${file.name}.`);
  } catch (err) { liveSetStatus('Load dataset failed: ' + err.message, true); alert('Load dataset ZIP failed:\n\n' + err.message); }
  finally { hideWait(); evn.target.value = ''; }
}

// ------------------------------------------------------------------ wiring
Object.assign(ACTIONS, {
  liveGenerate: () => liveGenerate(),
  liveLoad: () => $('liveZipInput').click(),
  livePlay: () => playLive(), livePause: () => pauseLive(), liveReset: () => resetLive(),
  liveExportDataset: () => liveExportDataset(), liveExportAlerts: () => liveExportAlerts(),
});
$('liveZipInput').addEventListener('change', liveLoadZip);
$('liveEvent').addEventListener('change', liveSelect);
$('liveSensorsMode').addEventListener('change', (e) => { LIVE.two = e.target.value === '2'; if (LIVE.model) { liveValidate(); liveSelect(); } });
$('liveSpeed').addEventListener('change', (e) => { LIVE.speed = Number(e.target.value) || 30; });
$('liveSlider').addEventListener('input', (e) => { pauseLive(); LIVE.idx = Number(e.target.value) || 0; liveRender(); });
$('liveAssumptions').textContent = LB.assumptionsText(LIVE.cfg, LIVE.fender);
window.addEventListener('resize', () => { if (LIVE.ev) liveRender(); });
