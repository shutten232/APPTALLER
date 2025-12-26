// js/ui.js
(function(){
  const S = window.APP_STATE;

  // Splash
  const splash = document.getElementById('splash');
  function ocultarSplash(){
    if(splash && !splash.classList.contains('splash-hidden')){
      splash.classList.add('splash-hidden');
    }
  }
  if(splash){
    setTimeout(ocultarSplash, 1800);
    splash.addEventListener('click', ocultarSplash);
  }

  // Fecha cabecera
  const subfecha = document.getElementById('subfecha');
  if(subfecha){
    subfecha.textContent = S.hoy.toLocaleDateString('es-AR',{ weekday:'long', day:'numeric', month:'short' });
  }

  // Elementos UI
  const tabs = document.querySelectorAll('.tab');
  const modeTabs = document.querySelectorAll('.mode-tab');

  const panelHoy = document.getElementById('panel-hoy');
  const panelArchivos = document.getElementById('panel-archivos');

  const inputs = {
    personal: document.getElementById('inp-personal'),
    services: document.getElementById('inp-services'),
    pruebas: document.getElementById('inp-pruebas'),
    instalaciones: document.getElementById('inp-instalaciones'),
    otros: document.getElementById('inp-otros')
  };
  const inpObs = document.getElementById('inp-observaciones');

  const tituloTaller = document.getElementById('titulo-taller');
  const ultimaAct = document.getElementById('ultima-actualizacion');
  const resumenDia = document.getElementById('resumen-dia');
  const totalTrabajosEl = document.getElementById('total-trabajos');

  const cmpZipoli = document.getElementById('cmp-zipoli');
  const cmpAlem = document.getElementById('cmp-alem');
  const alerta = document.getElementById('alerta');

  const archivosCont = document.getElementById('archivos-contenido');
  const resumenMesEl = document.getElementById('resumen-mes');
  const printUltimos7 = document.getElementById('print-ultimos7');
  const btnImprimir7 = document.getElementById('btn-imprimir-7');
  const selMes = document.getElementById('sel-mes');
  const btnImprimirMes = document.getElementById('btn-imprimir-mes');

  const estadoGuardado = document.getElementById('estado-guardado');

  window.UI = {
    tabs, modeTabs, panelHoy, panelArchivos,
    inputs, inpObs,
    tituloTaller, ultimaAct, resumenDia, totalTrabajosEl,
    cmpZipoli, cmpAlem, alerta,
    archivosCont, resumenMesEl, printUltimos7, btnImprimir7, selMes, btnImprimirMes,
    estadoGuardado
  };

  function textoTallerDetallado(d){
    const total = (d.services||0) + (d.pruebas||0) + (d.instalaciones||0) + (d.otros||0);
    if((d.personal||0) === 0 && total === 0){
      return 'Sin datos cargados todavía.';
    }
    return (
      (d.personal||0) + ' personas en el taller.<br>' +
      'Servicios GNC: ' + (d.services||0) + '<br>' +
      'Pruebas hidráulicas: ' + (d.pruebas||0) + '<br>' +
      'Instalaciones: ' + (d.instalaciones||0) + '<br>' +
      'Obleas: ' + (d.otros||0) + '.'
    );
  }

  function llenarFormulario(){
    const d = S.datos[S.tallerActual] || S.baseTaller();

    UI.inputs.personal.value      = d.personal || 0;
    UI.inputs.services.value      = d.services || 0;
    UI.inputs.pruebas.value       = d.pruebas || 0;
    UI.inputs.instalaciones.value = d.instalaciones || 0;
    UI.inputs.otros.value         = d.otros || 0;
    UI.inpObs.value               = d.obs || '';

    UI.resumenDia.innerHTML = textoTallerDetallado(d);
    UI.tituloTaller.textContent = 'Taller ' + (S.tallerActual === 'zipoli' ? 'Zipoli' : 'Alem') + ' – Hoy';

    const total = (d.services||0) + (d.pruebas||0) + (d.instalaciones||0) + (d.otros||0);
    if(UI.totalTrabajosEl) UI.totalTrabajosEl.textContent = String(total);

    if(d.updated){
      UI.ultimaAct.textContent = 'Última actualización: ' + d.updated;
    }else{
      UI.ultimaAct.textContent = 'Sin registrar todavía';
    }
  }

  function actualizarComparacion(){
    const dz = S.datos.zipoli || S.baseTaller();
    const da = S.datos.alem   || S.baseTaller();

    UI.cmpZipoli.innerHTML = textoTallerDetallado(dz);
    UI.cmpAlem.innerHTML   = textoTallerDetallado(da);

    const tz = (dz.services||0) + (dz.pruebas||0) + (dz.instalaciones||0) + (dz.otros||0);
    const ta = (da.services||0) + (da.pruebas||0) + (da.instalaciones||0) + (da.otros||0);

    if(tz === 0 && ta === 0){
      UI.alerta.textContent = 'Todavía no cargaron nada hoy en ninguno de los dos talleres.';
    }else if(tz > ta){
      UI.alerta.innerHTML = '<strong>Más cargado hoy: Zipoli.</strong> Podría convenir mandar alguien desde Alem.';
    }else if(ta > tz){
      UI.alerta.innerHTML = '<strong>Más cargado hoy: Alem.</strong> Podría convenir mandar alguien desde Zipoli.';
    }else{
      UI.alerta.textContent = 'Carga parecida en los dos talleres. Vean entre encargados si hace falta mover gente.';
    }
  }

  function nombreMes(m){
    const nombres = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const n = parseInt(m,10);
    if(n>=1 && n<=12) return nombres[n-1];
    return m;
  }

  function actualizarSelectorMeses(mesesArray){
    if(!UI.selMes) return;
    UI.selMes.innerHTML = '<option value="">Elegí un mes con datos...</option>';
    if(!mesesArray.length) return;
    mesesArray.forEach(code=>{
      const [y,m] = code.split('-');
      const label = nombreMes(m) + ' ' + y;
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = label;
      UI.selMes.appendChild(opt);
    });
  }

  function setEstado(tipo, texto){
    if(!UI.estadoGuardado) return;
    UI.estadoGuardado.classList.remove('guardando','error');
    if(tipo) UI.estadoGuardado.classList.add(tipo);
    UI.estadoGuardado.textContent = texto;
  }

  window.UIActions = {
    textoTallerDetallado,
    llenarFormulario,
    actualizarComparacion,
    actualizarSelectorMeses,
    nombreMes,
    setEstado
  };

  // Modo: Hoy/Archivado
  UI.modeTabs.forEach(btn=>{
    btn.addEventListener('click',()=>{
      UI.modeTabs.forEach(b=>b.classList.remove('activa'));
      btn.classList.add('activa');
      S.modoActual = btn.dataset.modo;
      if(S.modoActual === 'hoy'){
        UI.panelHoy.style.display = 'block';
        UI.panelArchivos.style.display = 'none';
      }else{
        UI.panelHoy.style.display = 'none';
        UI.panelArchivos.style.display = 'block';
          if(window.Reports && Reports.renderRegistros) Reports.renderRegistros();
          if(window.Reports && Reports.renderRegistros) Reports.renderRegistros();
      }
    });
  });

  // Tabs talleres
  UI.tabs.forEach(tab=>{
    tab.addEventListener('click',()=>{
      UI.tabs.forEach(t=>t.classList.remove('activa'));
      tab.classList.add('activa');
      S.tallerActual = tab.dataset.taller;
      UIActions.llenarFormulario();
      UIActions.actualizarComparacion();
      if(window.Reports && window.Reports.render) window.Reports.render();
    });
  });
})();
