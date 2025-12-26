// js/main.js
(function(){
  const S = window.APP_STATE;
  const UI = window.UI;
  const U = window.UIActions;
  const C = window.APP_CONFIG;

  // Firebase init
  firebase.initializeApp(C.firebaseConfig);
  const db = firebase.database();
  const diaRef = db.ref(C.ROOT_PATH + "/" + S.fechaClave);

  function initRealtime(){
    ['zipoli','alem'].forEach(taller=>{
      diaRef.child(taller).on('value', snap=>{
        const val = snap.val();
        if(val){
          S.datos[taller] = Object.assign(S.baseTaller(), val);
        }else{
          S.datos[taller] = S.baseTaller();
        }
        if(taller === S.tallerActual){
          U.llenarFormulario();
        }
        U.actualizarComparacion();
        if(window.Reports && window.Reports.render) window.Reports.render();
      });
    });
  }

  function initArchivos(){
    const q = db.ref(C.ARCHIVE_ROOT).orderByKey().limitToLast(C.ARCHIVE_LIMIT);
    q.on('value', window.Archive.renderArchivos);
  }

  // Imprimir últimos 7
  if(UI.btnImprimir7){
    UI.btnImprimir7.addEventListener('click', ()=>{
      if(UI.printUltimos7){
        UI.printUltimos7.innerHTML = S.printUltimos7DefaultHtml || '<p>No hay datos para imprimir.</p>';
      }
      window.print();
    });
  }

  // Imprimir mes
  if(UI.btnImprimirMes){
    UI.btnImprimirMes.addEventListener('click', ()=>{
      const mes = UI.selMes.value; // YYYY-MM
      if(!mes){ alert('Elegí un mes del listado.'); return; }
      if(!S.archivosOrdenados.length){ alert('No hay datos archivados.'); return; }

      const itemsAsc = S.archivosOrdenados.slice().sort((a,b)=>a.key.localeCompare(b.key));
      let html = '';
      let encontrado = false;

      itemsAsc.forEach(item=>{
        if(item.key.startsWith(mes + '-')){
          encontrado = true;
          const fecha = item.key;
          const d = item.val || {};
          const z = d.zipoli || null;
          const a = d.alem || null;
          const obsZ = z && z.obs ? z.obs : 'Sin observaciones.';
          const obsA = a && a.obs ? a.obs : 'Sin observaciones.';

          html += `
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

      if(!encontrado){
        alert('No hay datos archivados para ese mes.');
        if(UI.printUltimos7) UI.printUltimos7.innerHTML = S.printUltimos7DefaultHtml || '<p>No hay datos para imprimir.</p>';
        return;
      }

      if(UI.printUltimos7){
        const [y,m] = mes.split('-');
        const labelMes = U.nombreMes(m) + ' ' + y;
        const ahoraPrint = new Date().toLocaleString('es-AR');
        UI.printUltimos7.innerHTML = `
          <div style="font-weight:700;margin-bottom:6px;">Informe mes ${labelMes} – Zipoli y Alem</div>
          <div style="font-size:11px;margin-bottom:10px;">Impreso: ${ahoraPrint}</div>
          ${html}
        `;
      }

      window.print();

      if(UI.printUltimos7){
        UI.printUltimos7.innerHTML = S.printUltimos7DefaultHtml || '<p>No hay datos para imprimir.</p>';
      }
    });
  }

  // Archivar taller actual
  const btnCerrar = document.getElementById('btn-cerrar-dia');
  if(btnCerrar){
    btnCerrar.addEventListener('click', ()=>{
      const nombreTaller = (S.tallerActual === 'zipoli') ? 'Zipoli' : 'Alem';
      if(!confirm('¿Archivar y reiniciar hoy el taller ' + nombreTaller + '?')) return;

      const d = S.datos[S.tallerActual] || S.baseTaller();
      const total = (d.services||0) + (d.pruebas||0) + (d.instalaciones||0) + (d.otros||0);
      const cerradoA = new Date().toLocaleString('es-AR');

      const archivePayload = {
        personal: d.personal||0,
        services: d.services||0,
        pruebas: d.pruebas||0,
        instalaciones: d.instalaciones||0,
        otros: d.otros||0,
        obs: d.obs || '',
        updated: d.updated || null,
        totalTrabajos: total,
        cerradoA: cerradoA
      };

      const archiveRef = db.ref(C.ARCHIVE_ROOT + "/" + S.fechaClave + "/" + S.tallerActual);

      archiveRef.set(archivePayload)
        .then(()=> diaRef.child(S.tallerActual).set(S.baseTaller()))
        .then(()=>{
          S.datos[S.tallerActual] = S.baseTaller();
          U.llenarFormulario();
          U.actualizarComparacion();
          if(window.Reports && window.Reports.render) window.Reports.render();
          alert('Taller ' + nombreTaller + ' archivado y reiniciado.');
        })
        .catch(err=>{
          console.error(err);
          alert('Error al archivar: ' + err.message);
        });
    });
  }

  // Start
  initRealtime();
  initArchivos();
  window.AutoSave.init(db, diaRef);

  U.llenarFormulario();
  U.actualizarComparacion();
  if(window.Reports && window.Reports.render) window.Reports.render();
})();
