
/* Seguimiento App - ALEGRE PLUS (FILE:// friendly, no modules) */
(function(){
  const KEY = "seguimiento_app_v3";
  const FB_KEY = "seguimiento_app_fb_cache_v1";

  const $ = (q, el=document) => el.querySelector(q);
  const $$ = (q, el=document) => Array.from(el.querySelectorAll(q));

  function fmtARS(n){
    const v = Number(n||0);
    return v.toLocaleString('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0});
  }
  function fmtNum(n, d=0){
    const v = Number(n||0);
    return v.toLocaleString('es-AR',{maximumFractionDigits:d, minimumFractionDigits:d});
  }
  function todayISO(){
    const d = new Date();
    const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function uid(prefix){
    return (prefix||'id') + "_" + Math.random().toString(16).slice(2) + Date.now().toString(16);
  }
  function toast(msg){
    const el = $("#toast");
    if(!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(()=> el.classList.remove("show"), 1600);
  }
  function esc(s){
    return String(s||"")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }
  function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }

  const DEFAULT = {
    settings:{
      baseCash: 90000,
      weeklyIncome: 215000,
      debtTotal: 570000,
      runKcalPerKm: 65,
      swimKcalPerMin: 8,

      // GOALS
      weeklyKmGoal: 30,
      weeklyKcalGoal: 2500,
      monthlyDebtPayGoal: 200000
    },
    fitnessSessions: [],
    financeTx: []
  };

  function load(){
    // 1) Local rápido (siempre)
    try{
      const raw = localStorage.getItem(KEY);
      if(!raw) return structuredClone(DEFAULT);
      const parsed = JSON.parse(raw);
      return merge(parsed, DEFAULT);
    }catch(e){
      return structuredClone(DEFAULT);
    }
  }
  function save(){
    localStorage.setItem(KEY, JSON.stringify(state));
    scheduleFirebasePush();
  }
  function merge(obj, def){
    if(obj === null || typeof obj !== "object") return structuredClone(def);
    const out = Array.isArray(def) ? [] : {};
    Object.keys(def).forEach(k=>{
      if(obj[k] === undefined) out[k] = structuredClone(def[k]);
      else out[k] = merge(obj[k], def[k]);
    });
    Object.keys(obj).forEach(k=>{
      if(out[k] === undefined) out[k] = obj[k];
    });
    return out;
  }

  // ---------------- Firebase Sync (Realtime Database) ----------------
  // Requiere servir la app por http/https (no file://) para que Firebase funcione bien.
  // Path: /users/{uid}/state
  let fbReady = false;
  let fbUid = null;
  let fbUnsub = null;
  let pushing = false;
  let pullApplied = false;
  let pushTimer = null;

  function fbAvailable(){
    return !!(window.FB && window.FB.enabled && window.FB.db && window.FB.auth);
  }

  function firebasePath(){
    return `users/${fbUid}/state`;
  }

  function applyRemoteState(remote){
    if(!remote || typeof remote !== "object") return;
    // Merge para no romper defaults
    state = merge(remote, DEFAULT);
    // Guardar en local para abrir rápido la próxima
    localStorage.setItem(KEY, JSON.stringify(state));
    pullApplied = true;
    toast("Sincronizado");
    render();
  }

  function attachFirebaseListener(){
    if(!fbAvailable() || !fbUid) return;
    try{
      const ref = window.FB.db.ref(firebasePath());
      // Listener único
      if(fbUnsub){ fbUnsub.off(); fbUnsub = null; }
      fbUnsub = ref;
      ref.on("value", (snap)=>{
        const val = snap.val();
        // Evitar pisar si recién arrancaste y no hay data en cloud
        if(val === null) return;
        // Evitar loop: si nosotros estamos empujando, igual dejamos que actualice (es el mismo estado)
        applyRemoteState(val);
      });
    }catch(e){
      // si falla, queda local
    }
  }

  function scheduleFirebasePush(){
    if(!fbAvailable() || !fbUid) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(()=>{
      firebasePushNow();
    }, 600); // debounce
  }

  function firebasePushNow(){
    if(!fbAvailable() || !fbUid) return;
    try{
      pushing = true;
      const ref = window.FB.db.ref(firebasePath());
      ref.set(state).finally(()=>{
        pushing = false;
      });
    }catch(e){
      pushing = false;
    }
  }

  // Cuando Firebase autentica, intentamos pull inicial si hay data y luego listener
  window.addEventListener("fb-auth-ready", (ev)=>{
    fbUid = ev.detail && ev.detail.uid ? ev.detail.uid : null;
    if(!fbUid) return;
    fbReady = true;

    // Pull inicial
    try{
      const ref = window.FB.db.ref(firebasePath());
      ref.once("value").then((snap)=>{
        const val = snap.val();
        if(val){
          applyRemoteState(val);
        }else{
          // Si no hay data en cloud, subimos la local una vez
          firebasePushNow();
        }
        attachFirebaseListener();
      }).catch(()=>{
        attachFirebaseListener();
      });
    }catch(e){
      // noop
    }
  });
  // ------------------------------------------------------------------


  let state = load();
  let route = "dashboard";

  const view = $("#view");
  const tabs = $$(".tab");

  // FAB (mobile): ir a "Hoy"
  const fab = $("#fabAdd");
  if(fab){ fab.addEventListener("click", ()=> setRoute("today")); }


  tabs.forEach(t=>{
    t.addEventListener("click", ()=>{
      route = t.dataset.route;
      tabs.forEach(x=> x.classList.toggle("is-active", x === t));
      render();
    });
  });

  // RESET
  $("#btnReset").addEventListener("click", ()=>{
    localStorage.removeItem(KEY);
    state = load();
    toast("Datos borrados");
    setRoute("dashboard");
  });

  // EXPORT
  $("#btnExport").addEventListener("click", ()=>{
    const blob = new Blob([JSON.stringify(state,null,2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "seguimiento-backup.json";
    a.click();
    URL.revokeObjectURL(url);
    toast("Exportado");
  });

  // IMPORT
  const importBtn = $("#btnImport");
  const importFile = $("#importFile");
  importBtn.addEventListener("click", ()=> importFile.click());
  importFile.addEventListener("change", async ()=>{
    const file = importFile.files && importFile.files[0];
    if(!file) return;
    try{
      const text = await file.text();
      const obj = JSON.parse(text);
      // minimal validation
      if(!obj || typeof obj !== "object") throw new Error("JSON inválido");
      if(!obj.settings || !obj.fitnessSessions || !obj.financeTx) throw new Error("Faltan campos");
      state = merge(obj, DEFAULT);
      save();
      toast("Importado");
      render();
    }catch(e){
      toast("No se pudo importar");
    }finally{
      importFile.value = "";
    }
  });

  function setRoute(r){
    route = r;
    const tab = tabs.find(x=>x.dataset.route===r);
    if(tab){
      tabs.forEach(x=> x.classList.toggle("is-active", x === tab));
    }
    render();
  }

  function weekStartISO(d=new Date()){
    const x = new Date(d);
    const day = (x.getDay()+6)%7; // Mon=0
    x.setDate(x.getDate()-day);
    x.setHours(0,0,0,0);
    return iso(x);
  }
  function addDaysISO(isoStr, days){
    const d = parseISO(isoStr);
    d.setDate(d.getDate()+days);
    return iso(d);
  }
  function parseISO(s){
    const [y,m,d] = String(s).split("-").map(Number);
    return new Date(y,(m||1)-1,d||1);
  }
  function iso(d){
    const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${dd}`;
  }
  function monthKey(isoStr){
    return isoStr.slice(0,7); // YYYY-MM
  }

  function calcKcal(type, durationMin, distanceKm){
    if(type === "trote"){
      return Math.round(Number(distanceKm||0) * Number(state.settings.runKcalPerKm||0));
    }
    if(type === "natacion"){
      return Math.round(Number(durationMin||0) * Number(state.settings.swimKcalPerMin||0));
    }
    return 0;
  }

  function totalsFinance(){
    const base = Number(state.settings.baseCash||0);
    const debtTotal = Number(state.settings.debtTotal||0);
    const income = state.financeTx.filter(t=>t.type==="ingreso").reduce((a,b)=>a+Number(b.amount||0),0);
    const expenses = state.financeTx.filter(t=>t.type==="gasto").reduce((a,b)=>a+Number(b.amount||0),0);
    const debtPay = state.financeTx.filter(t=>t.type==="pago_deuda").reduce((a,b)=>a+Number(b.amount||0),0);
    const cashNow = base + income - expenses - debtPay;
    const debtLeft = Math.max(0, debtTotal - debtPay);
    return { base, debtTotal, income, expenses, debtPay, cashNow, debtLeft };
  }

  function weekTotalsFitness(weekStart){
    const end = addDaysISO(weekStart, 7);
    const week = state.fitnessSessions.filter(s=> s.date >= weekStart && s.date < end);
    const kcal = week.reduce((a,b)=>a+Number(b.calories||0),0);
    const km = week.reduce((a,b)=>a+Number(b.distanceKm||0),0);
    const swimMin = week.filter(s=>s.type==="natacion").reduce((a,b)=>a+Number(b.durationMin||0),0);
    return { kcal, km, swimMin, count: week.length, runCount: week.filter(s=>s.type==="trote").length, swimCount: week.filter(s=>s.type==="natacion").length };
  }
  function weekTotalsFinance(weekStart){
    const end = addDaysISO(weekStart, 7);
    const week = state.financeTx.filter(t=> t.date >= weekStart && t.date < end);
    const income = week.filter(t=>t.type==="ingreso").reduce((a,b)=>a+Number(b.amount||0),0);
    const expenses = week.filter(t=>t.type==="gasto").reduce((a,b)=>a+Number(b.amount||0),0);
    const debtPay = week.filter(t=>t.type==="pago_deuda").reduce((a,b)=>a+Number(b.amount||0),0);
    return { income, expenses, debtPay };
  }

  function pctDelta(curr, prev){
    if(prev === 0) return curr === 0 ? 0 : 100;
    return ((curr - prev) / prev) * 100;
  }
  function deltaBadge(v){
    const sign = v>0 ? "↑" : (v<0 ? "↓" : "→");
    const abs = Math.abs(v);
    return `${sign} ${fmtNum(abs,0)}%`;
  }

  function render(){
    if(route === "today") renderToday();
    else if(route === "fitness") renderFitness();
    else if(route === "finance") renderFinance();
    else if(route === "settings") renderSettings();
    else renderDashboard();
  }

  // Mini chart: simple SVG bars
  function svgBars(values, opts={}){
    const w = opts.w || 600;
    const h = opts.h || 120;
    const pad = 12;
    const max = Math.max(1, ...values.map(v=>Number(v||0)));
    const n = values.length || 1;
    const gap = 6;
    const barW = Math.max(6, (w - pad*2 - gap*(n-1)) / n);
    const showLabels = opts.labels === true;
    const labelFmt = typeof opts.labelFmt === "function" ? opts.labelFmt : (v)=> String(Math.round(v));
    let x = pad;

    let svg = `
      <svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" preserveAspectRatio="none">
        <rect x="0" y="0" width="${w}" height="${h}" fill="rgba(255,255,255,0)"></rect>
        <line x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}" stroke="rgba(230,233,245,1)" stroke-width="2"></line>
    `;

    for(const raw of values){
      const val = Number(raw||0);
      const bh = (h - pad*2 - (showLabels?14:0)) * (val / max);
      const y = h - pad - bh;
      const r = 8;
      svg += `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="${r}" ry="${r}" fill="rgba(37,99,235,.55)"></rect>`;
      if(showLabels){
        const tx = x + barW/2;
        const ty = Math.max(pad+10, y - 6);
        svg += `<text x="${tx}" y="${ty}" text-anchor="middle" font-size="12" font-weight="900" fill="rgba(15,23,42,.75)">${labelFmt(val)}</text>`;
      }
      x += barW + gap;
    }

    svg += `</svg>`;
    return svg;
  }

  function progressHTML(current, goal){
    const g = Math.max(0, Number(goal||0));
    const c = Math.max(0, Number(current||0));
    const pct = g<=0 ? 0 : clamp((c/g)*100, 0, 100);
    return `
      <div class="progress"><span style="width:${pct.toFixed(1)}%"></span></div>
      <div class="progressmeta">
        <span>${fmtNum(c,0)} / ${fmtNum(g,0)}</span>
        <span>${fmtNum(pct,0)}%</span>
      </div>
    `;
  }

  function renderDashboard(){
    const ws = weekStartISO(new Date());
    const prevWs = addDaysISO(ws, -7);

    const wFit = weekTotalsFitness(ws);
    const pFit = weekTotalsFitness(prevWs);

    const wFin = weekTotalsFinance(ws);
    const pFin = weekTotalsFinance(prevWs);

    const tf = totalsFinance();

    const totalKcalAll = state.fitnessSessions.reduce((a,b)=>a+Number(b.calories||0),0);

    // debt goal per month
    const curMonth = monthKey(todayISO());
    const monthDebtPay = state.financeTx
      .filter(t=>t.type==="pago_deuda" && monthKey(t.date)===curMonth)
      .reduce((a,b)=>a+Number(b.amount||0),0);

    // charts: last 6 weeks km
    const weeks = [];
    const kcalVals = [];
    for(let i=5;i>=0;i--){
      const start = addDaysISO(ws, -7*i);
      weeks.push(start);
      kcalVals.push(weekTotalsFitness(start).kcal);
    }

    view.innerHTML = `
      <div class="grid cols-2">
        <div class="card">
          <h2>Dashboard</h2>
          <div class="muted">Semana desde ${ws}</div>
          <hr class="sep"/>

          <div class="kpis">
            <div class="kpi">
              <div class="label">KM (semana)</div>
              <div class="value">${fmtNum(wFit.km,2)} km</div>
              ${progressHTML(wFit.km, state.settings.weeklyKmGoal)}
            </div>
            <div class="kpi">
              <div class="label">Calorías (semana)</div>
              <div class="value">${fmtNum(wFit.kcal,0)} kcal</div>
              ${progressHTML(wFit.kcal, state.settings.weeklyKcalGoal)}
            </div>
          
            <div class="kpi">
              <div class="label">Calorías (total)</div>
              <div class="value">${fmtNum(totalKcalAll,0)} kcal</div>
              <div class="muted" style="font-size:12px;font-weight:900;margin-top:6px;">Semana actual: <b>${fmtNum(wFit.kcal,0)} kcal</b></div>
              <div class="muted" style="font-size:12px;font-weight:900;margin-top:6px;">Acumulado histórico (trote + natación)</div>
            </div>

          </div>

          <div class="grid" style="grid-template-columns:1fr 1fr; gap:14px; margin-top:12px;">
            <div class="note">
              Comparación vs semana anterior
              <br/>KM: <b>${deltaBadge(pctDelta(wFit.km, pFit.km))}</b>
              <br/>Kcal: <b>${deltaBadge(pctDelta(wFit.kcal, pFit.kcal))}</b>
            </div>
            <div class="note">
              Natación / Trote
              <br/>Trote: <b>${wFit.runCount}</b> · Nado: <b>${wFit.swimCount}</b>
              <br/>Min nado: <b>${fmtNum(wFit.swimMin,0)}</b>
            </div>
          </div>

          <hr class="sep"/>
          <div class="muted" style="font-weight:950; margin-bottom:8px;">Kcal últimas 6 semanas</div>
          <div class="miniChart">${svgBars(kcalVals, {labels:true, labelFmt:(v)=> String(Math.round(v))})}</div>

          <hr class="sep"/>
          <div class="flex">
            <button class="btn primary" data-go="today">Hoy</button>
            <button class="btn" data-go="fitness">Cargar entrenamiento</button>
            <button class="btn" data-go="finance">Cargar movimiento</button>
            <div class="spacer"></div>
          </div>
        </div>

        <div class="card">
          <h3>Finanzas</h3>
          <div class="muted">Base + ingresos - gastos - pagos deuda</div>
          <hr class="sep"/>

          <div class="kpis">
            <div class="kpi">
              <div class="label">Caja actual</div>
              <div class="value ${tf.cashNow>=0?'good':'bad'}">${fmtARS(tf.cashNow)}</div>
            </div>
            <div class="kpi">
              <div class="label">Deuda restante</div>
              <div class="value ${tf.debtLeft===0?'good':''}">${fmtARS(tf.debtLeft)}</div>
            </div>
          </div>

          <div class="grid" style="grid-template-columns:1fr 1fr; gap:14px; margin-top:12px;">
            <div class="note">
              Semana actual
              <br/>Ingresos: <b>${fmtARS(wFin.income)}</b>
              <br/>Gastos: <b>${fmtARS(wFin.expenses)}</b>
              <br/>Pago deuda: <b>${fmtARS(wFin.debtPay)}</b>
            </div>
            <div class="note">
              Vs semana anterior
              <br/>Gastos: <b>${deltaBadge(pctDelta(wFin.expenses, pFin.expenses))}</b>
              <br/>Pago deuda: <b>${deltaBadge(pctDelta(wFin.debtPay, pFin.debtPay))}</b>
            </div>
          </div>

          <hr class="sep"/>
          <div class="muted" style="font-weight:950;">Meta pago deuda (mes ${curMonth})</div>
          ${progressHTML(monthDebtPay, state.settings.monthlyDebtPayGoal)}
          <div class="muted" style="font-size:12px; font-weight:900; margin-top:8px;">
            Pagado este mes: ${fmtARS(monthDebtPay)} · Meta: ${fmtARS(state.settings.monthlyDebtPayGoal)}
          </div>
        </div>
      </div>
    `;

    $$("[data-go]", view).forEach(b=>{
      b.addEventListener("click", ()=>{
        const r = b.getAttribute("data-go");
        setRoute(r);
      });
    });
  }

  function renderToday(){
    const t = todayISO();

    const todaySessions = state.fitnessSessions.filter(s=>s.date===t);
    const todayKm = todaySessions.reduce((a,b)=>a+Number(b.distanceKm||0),0);
    const todayKcal = todaySessions.reduce((a,b)=>a+Number(b.calories||0),0);

    const todayTx = state.financeTx.filter(x=>x.date===t);
    const todayIncome = todayTx.filter(x=>x.type==="ingreso").reduce((a,b)=>a+Number(b.amount||0),0);
    const todayExp = todayTx.filter(x=>x.type==="gasto").reduce((a,b)=>a+Number(b.amount||0),0);
    const todayDebt = todayTx.filter(x=>x.type==="pago_deuda").reduce((a,b)=>a+Number(b.amount||0),0);

    view.innerHTML = `
      <div class="grid cols-2">
        <div class="card">
          <h2>Hoy</h2>
          <div class="muted">${t}</div>
          <hr class="sep"/>

          <div class="kpis">
            <div class="kpi">
              <div class="label">Entrenamiento</div>
              <div class="value">${fmtNum(todayKm,2)} km · ${fmtNum(todayKcal,0)} kcal</div>
            </div>
            <div class="kpi">
              <div class="label">Finanzas</div>
              <div class="value">${fmtARS(todayIncome - todayExp - todayDebt)}</div>
            </div>
          </div>

          <div class="grid" style="grid-template-columns:1fr 1fr; gap:14px; margin-top:12px;">
            <div class="note">
              Fitness hoy
              <br/>Sesiones: <b>${todaySessions.length}</b>
              <br/>Trote: <b>${todaySessions.filter(x=>x.type==="trote").length}</b>
              · Nado: <b>${todaySessions.filter(x=>x.type==="natacion").length}</b>
            </div>
            <div class="note">
              Finanzas hoy
              <br/>Ingresos: <b>${fmtARS(todayIncome)}</b>
              <br/>Gastos: <b>${fmtARS(todayExp)}</b>
              <br/>Deuda: <b>${fmtARS(todayDebt)}</b>
            </div>
          </div>
        </div>

        <div class="card">
          <h3>Registrar rápido</h3>
          <div class="muted">Una pantalla para usar todos los días.</div>
          <hr class="sep"/>

          <div class="grid" style="grid-template-columns:1fr; gap:14px;">
            <div>
              <div class="muted" style="font-weight:950; margin-bottom:8px;">Fitness</div>
              <form class="form" id="quickFit">
                <input type="hidden" name="date" value="${t}">
                <div class="grid" style="grid-template-columns:1fr 1fr; gap:14px;">
                  <div class="field">
                    <label>Tipo</label>
                    <select name="type" required>
                      <option value="trote">Trote</option>
                      <option value="natacion">Natación</option>
                    </select>
                  </div>
                  <div class="field">
                    <label>Duración (min)</label>
                    <input class="input" type="number" name="durationMin" min="0" step="1" placeholder="45">
                  </div>
                </div>
                <div class="grid" style="grid-template-columns:1fr 1fr; gap:14px;">
                  <div class="field">
                    <label>Distancia (km)</label>
                    <input class="input" type="number" name="distanceKm" min="0" step="0.01" placeholder="9">
                  </div>
                  <div class="field">
                    <label>Calorías</label>
                    <input class="input" type="number" name="calories" min="0" step="1" placeholder="auto">
                  </div>
                </div>

                <div class="muted" style="font-weight:950; margin-top:6px;">Etiquetas rápidas</div>
                <div class="chips" style="margin-top:8px;">
                  ${["Calor","Ritmo alto","Técnica","Cansado","Suave"].map(x=> `<button type="button" class="chip" data-tag="${esc(x)}">${esc(x)}</button>`).join("")}
                </div>

                <div class="field" style="margin-top:10px;">
                  <label>Notas</label>
                  <input class="input" name="notes" placeholder="Se arma con etiquetas o texto">
                </div>

                <div class="flex">
                  <button class="btn" type="button" id="qFitAuto">Auto kcal</button>
                  <button class="btn primary" type="submit">Guardar</button>
                </div>
              </form>
            </div>

            <div>
              <hr class="sep"/>
              <div class="muted" style="font-weight:950; margin-bottom:8px;">Finanzas</div>
              <form class="form" id="quickTx">
                <input type="hidden" name="date" value="${t}">
                <div class="grid" style="grid-template-columns:1fr 1fr; gap:14px;">
                  <div class="field">
                    <label>Tipo</label>
                    <select name="type" required>
                      <option value="ingreso">Ingreso</option>
                      <option value="gasto">Gasto</option>
                      <option value="pago_deuda">Pago deuda</option>
                    </select>
                  </div>
                  <div class="field">
                    <label>Monto</label>
                    <input class="input" type="number" name="amount" min="0" step="1" placeholder="12000" required>
                  </div>
                </div>

                <div class="muted" style="font-weight:950; margin-top:6px;">Categorías</div>
                <div class="chips" style="margin-top:8px;">
                  ${["Comida","Transporte","Fijo","Extra","Salud"].map(x=> `<button type="button" class="chip" data-cat="${esc(x)}">${esc(x)}</button>`).join("")}
                </div>

                <div class="field" style="margin-top:10px;">
                  <label>Nota</label>
                  <input class="input" name="notes" placeholder="Se arma con categorías o texto">
                </div>

                <div class="flex">
                  <button class="btn primary" type="submit">Guardar</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    `;

    // chips fitness
    const fitForm = $("#quickFit", view);
    const fitNotes = $('input[name="notes"]', fitForm);
    $$("[data-tag]", fitForm).forEach(ch=>{
      ch.addEventListener("click", ()=>{
        ch.classList.toggle("is-on");
        const active = $$("[data-tag].is-on", fitForm).map(x=>x.getAttribute("data-tag"));
        fitNotes.value = active.join(" · ");
      });
    });

    $("#qFitAuto", view).addEventListener("click", ()=>{
      const fd = new FormData(fitForm);
      const type = String(fd.get("type"));
      const durationMin = Number(fd.get("durationMin")||0);
      const distanceKm = Number(fd.get("distanceKm")||0);
      const kcal = calcKcal(type, durationMin, distanceKm);
      fitForm.querySelector('[name="calories"]').value = String(kcal||0);
      toast("Auto kcal");
    });

    fitForm.addEventListener("submit", (e)=>{
      e.preventDefault();
      const fd = new FormData(fitForm);
      const date = String(fd.get("date"));
      const type = String(fd.get("type"));
      const durationMin = Number(fd.get("durationMin")||0);
      const distanceKm = Number(fd.get("distanceKm")||0);
      let calories = fd.get("calories");
      calories = (calories === "" ? calcKcal(type, durationMin, distanceKm) : Number(calories||0));
      const notes = String(fd.get("notes")||"");

      if(type === "trote" && durationMin<=0 && distanceKm<=0){ toast("Cargá duración o distancia"); return; }
      if(type === "natacion" && durationMin<=0){ toast("En natación cargá duración"); return; }

      state.fitnessSessions.push({ id: uid("fit"), date, type, durationMin, distanceKm, calories, notes });
      save();
      toast("Guardado");
      renderToday();
    });

    // chips finance
    const txForm = $("#quickTx", view);
    const txNotes = $('input[name="notes"]', txForm);
    $$("[data-cat]", txForm).forEach(ch=>{
      ch.addEventListener("click", ()=>{
        ch.classList.toggle("is-on");
        const active = $$("[data-cat].is-on", txForm).map(x=>x.getAttribute("data-cat"));
        txNotes.value = active.join(" · ");
      });
    });

    txForm.addEventListener("submit", (e)=>{
      e.preventDefault();
      const fd = new FormData(txForm);
      const date = String(fd.get("date"));
      const type = String(fd.get("type"));
      const amount = Number(fd.get("amount")||0);
      const notes = String(fd.get("notes")||"");
      if(amount<=0){ toast("Monto inválido"); return; }
      state.financeTx.push({ id: uid("tx"), date, type, amount, notes });
      save();
      toast("Guardado");
      renderToday();
    });
  }

  function renderFitness(){
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const sessions = state.fitnessSessions.slice().sort((a,b)=> a.date < b.date ? 1 : -1).slice(0, 80);

    view.innerHTML = `
      <div class="grid cols-2">
        <div class="card">
          <h2>Fitness</h2>
          <div class="muted">Trote / Natación. Registro + almanaque.</div>
          <hr class="sep"/>

          <form class="form" id="fitForm">
            <div class="grid" style="grid-template-columns:1fr 1fr; gap:14px;">
              <div class="field">
                <label>Fecha</label>
                <input class="input" type="date" name="date" value="${todayISO()}" required>
              </div>
              <div class="field">
                <label>Tipo</label>
                <select name="type" required>
                  <option value="trote">Trote</option>
                  <option value="natacion">Natación</option>
                </select>
              </div>
            </div>

            <div class="grid" style="grid-template-columns:1fr 1fr; gap:14px;">
              <div class="field">
                <label>Duración (min)</label>
                <input class="input" type="number" name="durationMin" min="0" step="1" placeholder="Ej: 45">
              </div>
              <div class="field">
                <label>Distancia (km)</label>
                <input class="input" type="number" name="distanceKm" min="0" step="0.01" placeholder="Ej: 9">
              </div>
            </div>

            <div class="field">
              <label>Calorías (opcional)</label>
              <input class="input" type="number" name="calories" min="0" step="1" placeholder="Si lo dejás vacío, se estima">
              <div class="muted" style="font-size:12px;margin-top:6px;">
                Estimación: trote = ${fmtNum(state.settings.runKcalPerKm,0)} kcal/km · natación = ${fmtNum(state.settings.swimKcalPerMin,0)} kcal/min
              </div>
            </div>

            <div class="field">
              <label>Notas</label>
              <input class="input" name="notes" placeholder="Ej: calor / técnica / ritmo">
            </div>

            <div class="flex">
              <button class="btn primary" type="submit">Guardar sesión</button>
              <button class="btn" type="button" id="btnAutoKcal">Autocompletar calorías</button>
              <div class="spacer"></div>
            </div>
          </form>
        </div>

        <div class="card">
          <h3>Almanaque</h3>
          <div id="fitCal"></div>
        </div>
      </div>

      <div class="card" style="margin-top:14px;">
        <div class="flex">
          <h3 style="margin:0;">Últimas sesiones</h3>
          <div class="spacer"></div>
          <span class="badge">Total sesiones: ${state.fitnessSessions.length}</span>
          <span class="badge">Kcal total: ${fmtNum(state.fitnessSessions.reduce((a,b)=>a+Number(b.calories||0),0),0)} kcal</span>
        </div>
        <div class="tablewrap" style="margin-top:10px;">
          ${fitnessTable(sessions)}
        </div>
      </div>
    `;

    $("#btnAutoKcal").addEventListener("click", ()=>{
      const form = $("#fitForm");
      const fd = new FormData(form);
      const type = String(fd.get("type"));
      const durationMin = Number(fd.get("durationMin")||0);
      const distanceKm = Number(fd.get("distanceKm")||0);
      const kcal = calcKcal(type, durationMin, distanceKm);
      form.querySelector('[name="calories"]').value = String(kcal||0);
      toast("Calorías estimadas");
    });

    $("#fitForm").addEventListener("submit", (e)=>{
      e.preventDefault();
      const fd = new FormData(e.target);
      const date = String(fd.get("date"));
      const type = String(fd.get("type"));
      const durationMin = Number(fd.get("durationMin")||0);
      const distanceKm = Number(fd.get("distanceKm")||0);
      let calories = fd.get("calories");
      calories = (calories === "" ? calcKcal(type, durationMin, distanceKm) : Number(calories||0));
      const notes = String(fd.get("notes")||"");

      if(type === "trote" && durationMin<=0 && distanceKm<=0){ toast("Cargá duración o distancia"); return; }
      if(type === "natacion" && durationMin<=0){ toast("En natación cargá duración"); return; }

      state.fitnessSessions.push({ id: uid("fit"), date, type, durationMin, distanceKm, calories, notes });
      save();
      toast("Sesión guardada");
      renderFitness();
    });

    view.addEventListener("click", (e)=>{
      const btn = e.target.closest("[data-del-fit]");
      if(!btn) return;
      const id = btn.getAttribute("data-del-fit");
      state.fitnessSessions = state.fitnessSessions.filter(x=>x.id!==id);
      save();
      toast("Sesión borrada");
      renderFitness();
    });

    $("#fitCal").innerHTML = renderCalendar(y, m, (isoStr)=>{
      const s = state.fitnessSessions.filter(x=>x.date===isoStr);
      const pills = [];
      if(s.some(x=>x.type==="trote")){
        const kcal = s.filter(x=>x.type==="trote").reduce((a,b)=>a+Number(b.calories||0),0);
        pills.push({kind:"run", label:`Trote ${kcal||0}kcal`});
      }
      if(s.some(x=>x.type==="natacion")){
        const kcal = s.filter(x=>x.type==="natacion").reduce((a,b)=>a+Number(b.calories||0),0);
        pills.push({kind:"swim", label:`Nado ${kcal||0}kcal`});
      }
      return pills;
    });
  }

  function fitnessTable(sessions){
    if(!sessions.length){
      return `<div class="muted" style="padding:12px;">Sin sesiones todavía.</div>`;
    }
    const rows = sessions.map(s=>{
      const badgeCls = s.type==="trote" ? "run" : "swim";
      const label = s.type==="trote" ? "Trote" : "Natación";
      return `
        <tr>
          <td>${s.date}</td>
          <td><span class="badge ${badgeCls}">${label}</span></td>
          <td>${fmtNum(s.durationMin||0,0)} min</td>
          <td>${fmtNum(s.distanceKm||0,2)} km</td>
          <td>${fmtNum(s.calories||0,0)} kcal</td>
          <td>${esc(s.notes||"")}</td>
          <td><button class="btn small danger" data-del-fit="${s.id}">Borrar</button></td>
        </tr>
      `;
    }).join("");
    return `
      <table class="table">
        <thead>
          <tr>
            <th>Fecha</th><th>Tipo</th><th>Duración</th><th>Distancia</th><th>Calorías</th><th>Notas</th><th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function renderFinance(){
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const tf = totalsFinance();

    const totalKcalAll = state.fitnessSessions.reduce((a,b)=>a+Number(b.calories||0),0);
    const tx = state.financeTx.slice().sort((a,b)=> a.date < b.date ? 1 : -1).slice(0, 120);

    view.innerHTML = `
      <div class="grid cols-2">
        <div class="card">
          <h2>Finanzas</h2>
          <div class="muted">Ingresos, gastos y pagos de deuda.</div>
          <hr class="sep"/>

          <div class="kpis">
            <div class="kpi">
              <div class="label">Caja actual</div>
              <div class="value ${tf.cashNow>=0?'good':'bad'}">${fmtARS(tf.cashNow)}</div>
            </div>
            <div class="kpi">
              <div class="label">Deuda restante</div>
              <div class="value ${tf.debtLeft===0?'good':''}">${fmtARS(tf.debtLeft)}</div>
            </div>
            <div class="kpi">
              <div class="label">Ingresos acumulados</div>
              <div class="value">${fmtARS(tf.income)}</div>
            </div>
            <div class="kpi">
              <div class="label">Gastos acumulados</div>
              <div class="value">${fmtARS(tf.expenses)}</div>
            </div>
          </div>

          <hr class="sep"/>

          <form class="form" id="txForm">
            <div class="grid" style="grid-template-columns:1fr 1fr; gap:14px;">
              <div class="field">
                <label>Fecha</label>
                <input class="input" type="date" name="date" value="${todayISO()}" required>
              </div>
              <div class="field">
                <label>Tipo</label>
                <select name="type" required>
                  <option value="ingreso">Ingreso</option>
                  <option value="gasto">Gasto</option>
                  <option value="pago_deuda">Pago deuda</option>
                </select>
              </div>
            </div>

            <div class="grid" style="grid-template-columns:1fr 1fr; gap:14px;">
              <div class="field">
                <label>Monto (ARS)</label>
                <input class="input" type="number" name="amount" min="0" step="1" placeholder="Ej: 215000" required>
              </div>
              <div class="field">
                <label>Nota</label>
                <input class="input" name="notes" placeholder="Ej: cobro / súper / deuda">
              </div>
            </div>

            <div class="flex">
              <button class="btn primary" type="submit">Guardar</button>
              <div class="spacer"></div>
              <span class="badge">Base ${fmtARS(state.settings.baseCash)} · Semanal ${fmtARS(state.settings.weeklyIncome)} · Deuda ${fmtARS(state.settings.debtTotal)}</span>
            </div>
          </form>
        </div>

        <div class="card">
          <h3>Almanaque</h3>
          <div id="moneyCal"></div>
        </div>
      </div>

      <div class="card" style="margin-top:14px;">
        <div class="flex">
          <h3 style="margin:0;">Movimientos</h3>
          <div class="spacer"></div>
          <span class="badge">Total: ${state.financeTx.length}</span>
        </div>
        <div class="tablewrap" style="margin-top:10px;">
          ${financeTable(tx)}
        </div>
      </div>
    `;

    $("#txForm").addEventListener("submit", (e)=>{
      e.preventDefault();
      const fd = new FormData(e.target);
      const date = String(fd.get("date"));
      const type = String(fd.get("type"));
      const amount = Number(fd.get("amount")||0);
      const notes = String(fd.get("notes")||"");
      if(amount<=0){ toast("Monto inválido"); return; }
      state.financeTx.push({ id: uid("tx"), date, type, amount, notes });
      save();
      toast("Movimiento guardado");
      renderFinance();
    });

    view.addEventListener("click", (e)=>{
      const btn = e.target.closest("[data-del-tx]");
      if(!btn) return;
      const id = btn.getAttribute("data-del-tx");
      state.financeTx = state.financeTx.filter(x=>x.id!==id);
      save();
      toast("Movimiento borrado");
      renderFinance();
    });

    $("#moneyCal").innerHTML = renderCalendar(y, m, (isoStr)=>{
      const dayTx = state.financeTx.filter(x=>x.date===isoStr);
      const pills = [];
      const plus = dayTx.filter(x=>x.type==="ingreso").reduce((a,b)=>a+Number(b.amount||0),0);
      const minus = dayTx.filter(x=>x.type==="gasto").reduce((a,b)=>a+Number(b.amount||0),0);
      const debt = dayTx.filter(x=>x.type==="pago_deuda").reduce((a,b)=>a+Number(b.amount||0),0);
      if(plus>0) pills.push({kind:"money", label:`+${Math.round(plus/1000)}k`});
      if(minus>0) pills.push({kind:"money", label:`-${Math.round(minus/1000)}k`});
      if(debt>0) pills.push({kind:"money", label:`deuda ${Math.round(debt/1000)}k`});
      return pills;
    });
  }

  function financeTable(tx){
    if(!tx.length){
      return `<div class="muted" style="padding:12px;">Sin movimientos todavía.</div>`;
    }
    const rows = tx.map(t=>{
      const badgeCls = t.type==="ingreso" ? "in" : (t.type==="gasto" ? "out" : "debt");
      const label = t.type==="ingreso" ? "Ingreso" : (t.type==="gasto" ? "Gasto" : "Pago deuda");
      return `
        <tr>
          <td>${t.date}</td>
          <td><span class="badge ${badgeCls}">${label}</span></td>
          <td>${fmtARS(t.amount||0)}</td>
          <td>${esc(t.notes||"")}</td>
          <td><button class="btn small danger" data-del-tx="${t.id}">Borrar</button></td>
        </tr>
      `;
    }).join("");
    return `
      <table class="table">
        <thead>
          <tr><th>Fecha</th><th>Tipo</th><th>Monto</th><th>Nota</th><th></th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function renderSettings(){
    view.innerHTML = `
      <div class="grid cols-2">
        <div class="card">
          <h2>Ajustes</h2>
          <div class="muted">Base, deuda, metas y factores de calorías.</div>
          <hr class="sep"/>

          <form class="form" id="setForm">
            <div class="grid" style="grid-template-columns:1fr 1fr; gap:14px;">
              <div class="field">
                <label>Base de caja (ARS)</label>
                <input class="input" type="number" name="baseCash" min="0" step="1" value="${Number(state.settings.baseCash||0)}">
              </div>
              <div class="field">
                <label>Ingreso semanal (ARS)</label>
                <input class="input" type="number" name="weeklyIncome" min="0" step="1" value="${Number(state.settings.weeklyIncome||0)}">
              </div>
            </div>

            <div class="grid" style="grid-template-columns:1fr 1fr; gap:14px;">
              <div class="field">
                <label>Deuda total (ARS)</label>
                <input class="input" type="number" name="debtTotal" min="0" step="1" value="${Number(state.settings.debtTotal||0)}">
              </div>
              <div class="field">
                <label>Meta pago deuda mensual (ARS)</label>
                <input class="input" type="number" name="monthlyDebtPayGoal" min="0" step="1" value="${Number(state.settings.monthlyDebtPayGoal||0)}">
              </div>
            </div>

            <hr class="sep"/>

            <div class="grid" style="grid-template-columns:1fr 1fr; gap:14px;">
              <div class="field">
                <label>Meta KM semanal</label>
                <input class="input" type="number" name="weeklyKmGoal" min="0" step="0.1" value="${Number(state.settings.weeklyKmGoal||0)}">
              </div>
              <div class="field">
                <label>Meta calorías semanal</label>
                <input class="input" type="number" name="weeklyKcalGoal" min="0" step="1" value="${Number(state.settings.weeklyKcalGoal||0)}">
              </div>
            </div>

            <hr class="sep"/>

            <div class="grid" style="grid-template-columns:1fr 1fr; gap:14px;">
              <div class="field">
                <label>Estimación trote: kcal por km</label>
                <input class="input" type="number" name="runKcalPerKm" min="0" step="1" value="${Number(state.settings.runKcalPerKm||0)}">
              </div>
              <div class="field">
                <label>Estimación natación: kcal por minuto</label>
                <input class="input" type="number" name="swimKcalPerMin" min="0" step="1" value="${Number(state.settings.swimKcalPerMin||0)}">
              </div>
            </div>

            <div class="flex">
              <button class="btn primary" type="submit">Guardar</button>
              <div class="spacer"></div>
              <span class="badge">Backup: ⤓ exporta · ⤒ importa</span>
            </div>
          </form>
        </div>

        <div class="card">
          <h3>Qué se agregó</h3>
          <div class="note">
            - Pestaña “Hoy” (registro rápido)
            <br/>- Metas + barras de progreso
            <br/>- Comparación semana vs semana anterior
            <br/>- Importar backup JSON (⤒)
            <br/>- Firebase: si lo abrís por http/https, sincroniza en la nube
            <br/>- Mini gráfico KM últimas semanas
          </div>
        </div>
      </div>
    `;

    $("#setForm").addEventListener("submit", (e)=>{
      e.preventDefault();
      const fd = new FormData(e.target);
      const s = state.settings;
      s.baseCash = Number(fd.get("baseCash")||0);
      s.weeklyIncome = Number(fd.get("weeklyIncome")||0);
      s.debtTotal = Number(fd.get("debtTotal")||0);
      s.monthlyDebtPayGoal = Number(fd.get("monthlyDebtPayGoal")||0);

      s.weeklyKmGoal = Number(fd.get("weeklyKmGoal")||0);
      s.weeklyKcalGoal = Number(fd.get("weeklyKcalGoal")||0);

      s.runKcalPerKm = Number(fd.get("runKcalPerKm")||0);
      s.swimKcalPerMin = Number(fd.get("swimKcalPerMin")||0);

      save();
      toast("Ajustes guardados");
      renderSettings();
    });
  }

  function renderCalendar(year, month, pillsFn){
    const DOW = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
    const first = new Date(year, month, 1);
    const firstIdx = (first.getDay()+6)%7; // Mon start
    const start = new Date(year, month, 1 - firstIdx);

    const head = `
      <div class="calhead">
        <span class="badge">${year}-${String(month+1).padStart(2,'0')}</span>
        <span class="muted">Vista mensual</span>
      </div>
    `;
    const dows = DOW.map(x=> `<div class="dow">${x}</div>`).join("");

    let cells = "";
    for(let i=0;i<42;i++){
      const d = new Date(start);
      d.setDate(start.getDate()+i);
      const inMonth = d.getMonth() === month;
      const dayNum = d.getDate();
      const is = iso(d);
      const pills = (pillsFn ? pillsFn(is) : []) || [];
      const pillsHtml = pills.map(p=> `<span class="pill ${p.kind||'money'}">${esc(p.label)}</span>`).join("");
      cells += `
        <div class="day ${inMonth?'':'out'}">
          <div class="daynum">${dayNum}</div>
          <div class="pills">${pillsHtml}</div>
        </div>
      `;
    }

    return `
      <div class="calendar">
        ${head}
        <div class="calgrid">
          ${dows}
          ${cells}
        </div>
      </div>
    `;
  }

  // initial
  render();
})();
