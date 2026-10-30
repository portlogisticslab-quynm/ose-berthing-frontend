/* Live-test visualisation in the existing Animation tab; retains legacy CaseID animation. */
'use strict';
(() => {
  const mode = document.getElementById('animMode');
  const testSelect = document.getElementById('animLiveEvent');
  const animCanvas = document.getElementById('animCanvas');
  const animStatus = document.getElementById('animStatus');
  const animInfo = document.getElementById('animInfo');
  const animSpeed = document.getElementById('animSpeed');
  const notes = document.getElementById('animNotes');
  const hint = document.getElementById('animLiveHint');
  const title = document.getElementById('animTitle');
  const legacyNotes = notes.innerHTML;
  const isLive = () => mode.value === 'live';

  function syncTestList() {
    const source = document.getElementById('liveEvent');
    const current = source.value;
    const values = Array.from(source.options).map(o => [o.value, o.textContent]);
    if (values.length !== testSelect.options.length || values.some((x,i) => x[0] !== testSelect.options[i]?.value)) {
      testSelect.replaceChildren(...values.map(([value,text]) => {const o=document.createElement('option');o.value=value;o.textContent=text;return o;}));
    }
    testSelect.value = current;
  }
  function paint() {
    if (!isLive()) return;
    syncTestList();
    const ctx = animCanvas.getContext('2d');
    const w = animCanvas.width, h = animCanvas.height;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle='#f8fafc';ctx.fillRect(0,0,w,h);
    if (!LIVE.ev || !LIVE.live) {
      ctx.fillStyle='#334155';ctx.font='22px Segoe UI, Arial';
      ctx.fillText('Generate or load Live Berthing data to begin.',40,90);
      animInfo.textContent='Open Live Berthing → Generate & train or Load ZIP; choose a test event, then return to Animation.';
      animStatus.textContent='Waiting for Live Berthing dataset';
      return;
    }
    const ev = LIVE.ev, b = ev.brt, i=LIVE.idx, p=b[i], f=LIVE.live;
    const maxD = Math.max(200, Number(b[0].n1_distance)||200);
    const d=Math.max(0,Number(p.n1_distance)||0);
    const left=115, berth=230, right=w-55, cy=h*0.51;
    const available=right-berth-40;
    const pxD = d / maxD * available;
    const shipX = berth + 25 + pxD;
    // Top-down schematic only: use distance and reported approach angle; no fabricated X/Y track.
    ctx.fillStyle='#e0f2fe';ctx.fillRect(berth,55,w-berth-30,h-110);
    ctx.fillStyle='#cbd5e1';ctx.fillRect(berth-25,55,25,h-110);
    ctx.strokeStyle='#334155';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(berth,55);ctx.lineTo(berth,h-55);ctx.stroke();
    ctx.fillStyle='#334155';ctx.font='bold 18px Segoe UI';ctx.fillText('BERTH',berth-90,40);
    ctx.fillStyle='#64748b';ctx.font='14px Segoe UI';ctx.fillText('Water / approach zone (schematic, not to scale)',berth+20,82);
    ctx.strokeStyle='#94a3b8';ctx.setLineDash([9,8]);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(berth+10,cy);ctx.lineTo(right,cy);ctx.stroke();ctx.setLineDash([]);
    const distX = Math.min(right,shipX);
    ctx.strokeStyle='#2563eb';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(berth+8,cy+84);ctx.lineTo(distX,cy+84);ctx.stroke();
    ctx.fillStyle='#1d4ed8';ctx.font='bold 16px Segoe UI';ctx.fillText(`Distance: ${d.toFixed(1)} m`,Math.min(berth+18,distX),cy+115);
    const ang = Math.max(-25,Math.min(25,Number(p.angle)||0))*Math.PI/180;
    ctx.save();ctx.translate(shipX,cy);ctx.rotate(-ang);
    // Bow points toward quay (left); schematic hull dimensions intentionally illustrative.
    ctx.fillStyle= f.levelName==='Critical'?'#dc2626':f.levelName==='Warning'?'#ea580c':'#1d4ed8';
    ctx.strokeStyle='#0f172a';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(-50,0);ctx.lineTo(-32,-20);ctx.lineTo(48,-20);ctx.lineTo(55,0);ctx.lineTo(48,20);ctx.lineTo(-32,20);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='#fff';ctx.fillRect(0,-11,25,22);ctx.restore();
    ctx.fillStyle='#0f172a';ctx.font='bold 20px Segoe UI';ctx.fillText(`EV ${ev.meta.eventId}  •  ${p.t} / ${b[b.length-1].t} s`,35,h-28);
    const barX=50,barY=h-62,barW=w-100;
    ctx.fillStyle='#e2e8f0';ctx.fillRect(barX,barY,barW,8);
    ctx.fillStyle='#2563eb';ctx.fillRect(barX,barY,barW*(i/Math.max(1,b.length-1)),8);
    const al = typeof alertAt==='function'?alertAt(p.t):null;
    const risk = al?.alertName||f.levelName;
    animStatus.textContent=`Live ${ev.meta.eventId} • t=${p.t}s • ${i+1}/${b.length} samples • ${risk} • ${LIVE.timer?'Playing':'Paused'}`;
    const display=(v,n=1)=>Number.isFinite(Number(v))?Number(v).toFixed(n):'—';
    animInfo.textContent=`LIVE TEST (synthetic / port-shm replay)\nEvent: ${ev.meta.eventId}\nScenario: ${ev.meta.scenario}\nTime: ${p.t} / ${b[b.length-1].t} s\nDistance: ${display(d)} m\nMeasured BRT velocity: ${display(p.n1_velocity,2)} cm/s\nMeasured approach angle: ${LIVE.two?display(p.angle)+'°':'unavailable (1 BRT)'}\nForecast contact speed P50 [P10–P90]: ${display(f.velocity.p50*100)} [${display(f.velocity.p10*100)}–${display(f.velocity.p90*100)}] cm/s\nForecast energy P50/P90: ${display(f.energy.p50,0)} / ${display(f.energy.p90,0)} kJ\nFender reaction P50/P90: ${display(f.reaction.p50,0)} / ${display(f.reaction.p90,0)} kN\nWharf displacement P50/P90: ${display(f.displacement.p50)} / ${display(f.displacement.p90)} mm\nAlert level: ${risk}\n\nSCHEMATIC ONLY: BRT provides distance and approach angle, not a measured X/Y vessel trajectory.`;
  }
  window.renderLiveAnimation = paint;
  function updateMode() {
    pauseAnimation();pauseLive();
    testSelect.hidden=!isLive();
    notes.innerHTML=isLive()?'Live source: current test event (1 Hz BRT). Vessel location is a schematic representation based on distance and approach angle; no measured X/Y trajectory is available. Predictive metrics come from the existing Live Berthing model.':legacyNotes;
    hint.textContent=isLive()?'Shared with Live Berthing: event, sensors, forecasts, time and alerts. Generate or load data in Live Berthing first.':'Legacy CaseID mode uses the separate base-trajectory dataset; generate/load it with the left-hand Data tools.';
    title.textContent=isLive()?'Live Berthing – animated test replay (schematic)':'Berthing animation – selected CaseID';
    if(isLive()){ animSpeed.value=String(LIVE.speed);paint(); }
    else resetAnimation();
  }
  mode.addEventListener('change',updateMode);
  testSelect.addEventListener('change',()=>{const src=document.getElementById('liveEvent');src.value=testSelect.value;liveSelect();});
  const oldStart=ACTIONS.animStart, oldPause=ACTIONS.animPause, oldReset=ACTIONS.animReset;
  ACTIONS.animStart=()=>isLive()?playLive():oldStart();
  ACTIONS.animPause=()=>isLive()?(pauseLive(),paint()):oldPause();
  ACTIONS.animReset=()=>isLive()?resetLive():oldReset();
  ACTIONS.animGotoLive=()=>{showTab('live',document.querySelector('.tabbtn[data-tab="live"]'));};
  animSpeed.addEventListener('change',()=>{if(isLive())LIVE.speed=Number(animSpeed.value)||30;});
  document.querySelector('.tabbtn[data-tab="animation"]').addEventListener('click',()=>{setTimeout(()=>{if(isLive())paint();},0);});
  document.getElementById('liveEvent').addEventListener('change',()=>{syncTestList();paint();});
  updateMode();
})();
