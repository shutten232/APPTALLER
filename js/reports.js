// reports.js
(function(){
  const S = window.APP_STATE;

  function parseDateKey(key){
    const [y,m,d] = key.split('-').map(Number);
    return new Date(y, m-1, d);
  }

  function startOfWeek(date){
    const d = new Date(date);
    const day = d.getDay() || 7; // lunes=1
    if(day !== 1) d.setDate(d.getDate() - (day - 1));
    d.setHours(0,0,0,0);
    return d;
  }
  function endOfWeek(date){
    const d = startOfWeek(date);
    d.setDate(d.getDate() + 6);
    d.setHours(23,59,59,999);
    return d;
  }
  function startOfMonth(date){
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }
  function endOfMonth(date){
    return new Date(date.getFullYear(), date.getMonth()+1, 0, 23,59,59,999);
  }

  function empty(){ return { services:0, pruebas:0, instalaciones:0, otros:0 }; }
  function sumar(acc, d){
    acc.services      += d.services || 0;
    acc.pruebas       += d.pruebas || 0;
    acc.instalaciones += d.instalaciones || 0;
    acc.otros         += d.otros || 0;
  }
  function renderTexto(acc){
    const total = acc.services + acc.pruebas + acc.instalaciones + acc.otros;
    if(total === 0) return 'Sin datos en el período.';
    return `Servicios: ${acc.services} · PH: ${acc.pruebas} · Instalaciones: ${acc.instalaciones} · Obleas: ${acc.otros}`;
  }

  function calcularPeriodo(items, taller, desde, hasta){
    const acc = empty();
    items.forEach(it=>{
      const fecha = parseDateKey(it.key);
      if(fecha < desde || fecha > hasta) return;
      const d = it.val && it.val[taller];
      if(d) sumar(acc, d);
    });

    // incluir HOY desde tiempo real aunque todavía no esté en historial
    const hoyKey = S.fechaClave || S.fecha || new Date().toISOString().slice(0,10);
    const dtHoy = parseDateKey(hoyKey);
    if(dtHoy >= desde && dtHoy <= hasta){
      const dHoy = S.datos && S.datos[taller];
      if(dHoy){
        const totalHoy = (dHoy.services||0)+(dHoy.pruebas||0)+(dHoy.instalaciones||0)+(dHoy.otros||0);
        if(totalHoy > 0) sumar(acc, dHoy);
      }
    }
    return acc;
  }

  function renderRegistros(){
    const elZS = document.getElementById('sum-zipoli-semana');
    const elZM = document.getElementById('sum-zipoli-mes');
    const elAS = document.getElementById('sum-alem-semana');
    const elAM = document.getElementById('sum-alem-mes');
    if(!elZS && !elZM && !elAS && !elAM) return;

    const items = Array.isArray(S.archivosOrdenados) ? S.archivosOrdenados : [];
    const now = new Date();
    const sw = startOfWeek(now), ew=endOfWeek(now), sm=startOfMonth(now), em=endOfMonth(now);

    if(elZS) elZS.textContent = renderTexto(calcularPeriodo(items, 'zipoli', sw, ew));
    if(elZM) elZM.textContent = renderTexto(calcularPeriodo(items, 'zipoli', sm, em));
    if(elAS) elAS.textContent = renderTexto(calcularPeriodo(items, 'alem',   sw, ew));
    if(elAM) elAM.textContent = renderTexto(calcularPeriodo(items, 'alem',   sm, em));
  }

  function render(){
    // siempre registros
    try{ renderRegistros(); }catch(e){}

    // (opcional) si existe resumen en "Hoy"
    const semanaEl = document.getElementById('rep-semana');
    const mesEl    = document.getElementById('rep-mes');
    if(!semanaEl || !mesEl) return;

    const items = Array.isArray(S.archivosOrdenados) ? S.archivosOrdenados : [];
    const taller = S.tallerActual;
    const now = new Date();

    semanaEl.textContent = renderTexto(calcularPeriodo(items, taller, startOfWeek(now), endOfWeek(now)));
    mesEl.textContent    = renderTexto(calcularPeriodo(items, taller, startOfMonth(now), endOfMonth(now)));
  }

  window.Reports = { render, renderRegistros };
})();
