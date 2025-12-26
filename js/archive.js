// js/archive.js
(function(){
  const S = window.APP_STATE;
  const UI = window.UI;
  const U = window.UIActions;
  const C = window.APP_CONFIG;

  function renderArchivos(snapshot){
    if(!UI.archivosCont) return;

    if(!snapshot.exists()){
      UI.archivosCont.innerHTML = '<p class="resumen-linea">No hay días archivados todavía.</p>';
      if(UI.resumenMesEl) UI.resumenMesEl.textContent = 'Sin datos archivados de este mes todavía.';
      if(UI.printUltimos7){
        S.printUltimos7DefaultHtml = '<p>No hay datos para imprimir.</p>';
        UI.printUltimos7.innerHTML = S.printUltimos7DefaultHtml;
      }
      S.archivosOrdenados = [];
      U.actualizarSelectorMeses([]);
      if(window.Reports && window.Reports.render) window.Reports.render();
      return;
    }

    const items = [];
    snapshot.forEach(child=>{
      items.push({ key: child.key, val: child.val() });
    });

    items.sort((a,b)=> b.key.localeCompare(a.key));
    S.archivosOrdenados = items;

    const ahora = new Date();
    const currentYear  = String(ahora.getFullYear());
    const currentMonth = String(ahora.getMonth()+1).padStart(2,'0');

    const acumulado = {
      zipoli:{services:0, pruebas:0, instalaciones:0, otros:0, totalTrabajos:0},
      alem:  {services:0, pruebas:0, instalaciones:0, otros:0, totalTrabajos:0}
    };

    let html = '';
    let printHtml7 = '';
    const mesesSet = new Set();

    items.forEach((item, idx)=>{
      const fecha = item.key;
      const d = item.val || {};
      const z = d.zipoli || null;
      const a = d.alem   || null;

      const tz = z ? ((z.services||0) + (z.pruebas||0) + (z.instalaciones||0) + (z.otros||0)) : 0;
      const ta = a ? ((a.services||0) + (a.pruebas||0) + (a.instalaciones||0) + (a.otros||0)) : 0;

      const obsZ = z && z.obs ? z.obs : 'Sin observaciones.';
      const obsA = a && a.obs ? a.obs : 'Sin observaciones.';

      const partesFecha = fecha.split('-');
      if(partesFecha.length === 3){
        const [y,m] = partesFecha;
        mesesSet.add(y + '-' + m);
        const esMesActual = (y === currentYear && m === currentMonth);
        if(esMesActual){
          if(z){
            acumulado.zipoli.services      += z.services || 0;
            acumulado.zipoli.pruebas       += z.pruebas || 0;
            acumulado.zipoli.instalaciones += z.instalaciones || 0;
            acumulado.zipoli.otros         += z.otros || 0;
            acumulado.zipoli.totalTrabajos += tz;
          }
          if(a){
            acumulado.alem.services        += a.services || 0;
            acumulado.alem.pruebas         += a.pruebas || 0;
            acumulado.alem.instalaciones   += a.instalaciones || 0;
            acumulado.alem.otros           += a.otros || 0;
            acumulado.alem.totalTrabajos   += ta;
          }
        }
      }

      html += `
        <div class="archivo-item">
          <div class="archivo-fecha">${fecha}</div>
          <div class="archivo-grid">
            <div class="archivo-col">
              <div class="archivo-taller">Zipoli</div>
              ${z ? `
                <p class="archivo-linea">Personas en el taller: ${z.personal||0}</p>
                <p class="archivo-linea">Servicios GNC: ${z.services||0}</p>
                <p class="archivo-linea">Pruebas hidráulicas: ${z.pruebas||0}</p>
                <p class="archivo-linea">Instalaciones: ${z.instalaciones||0}</p>
                <p class="archivo-linea">Obleas: ${z.otros||0}</p>
                <p class="archivo-obs">Observaciones: ${obsZ}</p>
                ` : `
                <p class="archivo-linea">Sin datos archivados para Zipoli ese día.</p>
              `}
            </div>
            <div class="archivo-col">
              <div class="archivo-taller">Alem</div>
              ${a ? `
                <p class="archivo-linea">Personas en el taller: ${a.personal||0}</p>
                <p class="archivo-linea">Servicios GNC: ${a.services||0}</p>
                <p class="archivo-linea">Pruebas hidráulicas: ${a.pruebas||0}</p>
                <p class="archivo-linea">Instalaciones: ${a.instalaciones||0}</p>
                <p class="archivo-linea">Obleas: ${a.otros||0}</p>
                <p class="archivo-obs">Observaciones: ${obsA}</p>
                ` : `
                <p class="archivo-linea">Sin datos archivados para Alem ese día.</p>
              `}
            </div>
          </div>
        </div>
      `;

      if(idx < 7){
        printHtml7 += `
          <div class="print-dia">
            <div class="print-fecha">${fecha}</div>
            <div class="print-taller">Taller Zipoli</div>
            ${z ? `
              <p class="print-linea">Personas en el taller: ${z.personal||0}</p>
              <p class="print-linea">Servicios GNC: ${z.services||0}</p>
              <p class="print-linea">Pruebas hidráulicas: ${z.pruebas||0}</p>
              <p class="print-linea">Instalaciones: ${z.instalaciones||0}</p>
              <p class="print-linea">Obleas: ${z.otros||0}</p>
              <p class="print-linea">Observaciones: ${obsZ}</p>
            ` : `<p class="print-linea">Sin datos para Zipoli ese día.</p>`}
            <div class="print-taller">Taller Alem</div>
            ${a ? `
              <p class="print-linea">Personas en el taller: ${a.personal||0}</p>
              <p class="print-linea">Servicios GNC: ${a.services||0}</p>
              <p class="print-linea">Pruebas hidráulicas: ${a.pruebas||0}</p>
              <p class="print-linea">Instalaciones: ${a.instalaciones||0}</p>
              <p class="print-linea">Obleas: ${a.otros||0}</p>
              <p class="print-linea">Observaciones: ${obsA}</p>
            ` : `<p class="print-linea">Sin datos para Alem ese día.</p>`}
          </div>
        `;
      }
    });

    UI.archivosCont.innerHTML = html;

    if(UI.resumenMesEl){
      const z = acumulado.zipoli;
      const a = acumulado.alem;
      if(z.totalTrabajos === 0 && a.totalTrabajos === 0){
        UI.resumenMesEl.textContent = 'Sin datos archivados de este mes todavía.';
      }else{
        UI.resumenMesEl.innerHTML =
          'Resumen mes actual<br>' +
          'Zipoli — Servicios GNC: ' + z.services +
          ' · Pruebas hidráulicas: ' + z.pruebas +
          ' · Instalaciones: ' + z.instalaciones +
          ' · Obleas: ' + z.otros + '<br>' +
          'Alem — Servicios GNC: ' + a.services +
          ' · Pruebas hidráulicas: ' + a.pruebas +
          ' · Instalaciones: ' + a.instalaciones +
          ' · Obleas: ' + a.otros;
      }
    }

    if(UI.printUltimos7){
      if(printHtml7.trim() === ''){
        S.printUltimos7DefaultHtml = '<p>No hay datos para imprimir.</p>';
      }else{
        const ahoraPrint = new Date().toLocaleString('es-AR');
        S.printUltimos7DefaultHtml = `
          <div style="font-weight:700;margin-bottom:6px;">Informe últimos 7 días cargados – Zipoli y Alem</div>
          <div style="font-size:11px;margin-bottom:10px;">Impreso: ${ahoraPrint}</div>
          ${printHtml7}
        `;
      }
      UI.printUltimos7.innerHTML = S.printUltimos7DefaultHtml;
    }

    const mesesOrdenados = Array.from(mesesSet).sort((a,b)=> b.localeCompare(a));
    U.actualizarSelectorMeses(mesesOrdenados);

    
      if(window.Reports && Reports.renderRegistros) Reports.renderRegistros();
if(window.Reports && window.Reports.render) window.Reports.render();
  }

  window.Archive = { renderArchivos };
})();
