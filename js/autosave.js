// js/autosave.js
(function(){
  const S = window.APP_STATE;
  const UI = window.UI;
  const U = window.UIActions;

  let db = null;
  let diaRef = null;

  let saveTimer = null;
  let saveInFlight = false;
  let pendingSave = false;

  function init(firebaseDb, diaRefRef){
    db = firebaseDb;
    diaRef = diaRefRef;
    bindAutosave();
  }

  function leerUIyActualizarMemoria(){
    const d = S.datos[S.tallerActual];

    d.personal      = parseInt(UI.inputs.personal.value      || '0',10) || 0;
    d.services      = parseInt(UI.inputs.services.value      || '0',10) || 0;
    d.pruebas       = parseInt(UI.inputs.pruebas.value       || '0',10) || 0;
    d.instalaciones = parseInt(UI.inputs.instalaciones.value || '0',10) || 0;
    d.otros         = parseInt(UI.inputs.otros.value         || '0',10) || 0;
    d.obs           = (UI.inpObs.value || '').trim();
    d.updated       = new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
  }

  function buildPayload(taller){
    const d = S.datos[taller];
    return {
      personal: d.personal,
      services: d.services,
      pruebas: d.pruebas,
      instalaciones: d.instalaciones,
      otros: d.otros,
      obs: d.obs,
      updated: d.updated
    };
  }

  function guardarAhora(){
    if(!db || !diaRef) return;

    if(saveInFlight){
      pendingSave = true;
      return;
    }
    saveInFlight = true;
    pendingSave = false;

    U.setEstado('guardando', 'Guardando...');
    const payload = buildPayload(S.tallerActual);

    const logRef = db.ref(window.APP_CONFIG.LOG_ROOT + "/" + S.fechaClave + "/" + S.tallerActual);
    const logData = Object.assign({ ts: firebase.database.ServerValue.TIMESTAMP }, payload);

    diaRef.child(S.tallerActual).set(payload)
      .then(()=> logRef.push(logData))
      .then(()=>{
        U.setEstado('', 'Guardado');
        saveInFlight = false;
        if(pendingSave) guardarAhora();
      })
      .catch(err=>{
        console.error(err);
        U.setEstado('error', 'Error guardando: ' + err.message);
        saveInFlight = false;
      });
  }

  function programarAutoSave(ms){
    clearTimeout(saveTimer);
    saveTimer = setTimeout(()=>{
      leerUIyActualizarMemoria();
      U.llenarFormulario();
      U.actualizarComparacion();
      if(window.Reports && window.Reports.render) window.Reports.render();
      guardarAhora();
    }, ms);
  }

  function bindAutosave(){
    // Inputs
    Object.values(UI.inputs).forEach(inp=>{
      if(!inp) return;
      inp.addEventListener('input', ()=> programarAutoSave(450));
      inp.addEventListener('change', ()=> programarAutoSave(150));
      inp.addEventListener('keydown',(e)=>{
        if(e.key === 'Enter'){
          e.preventDefault();
          programarAutoSave(1);
        }
      });
    });

    // Observaciones
    if(UI.inpObs){
      UI.inpObs.addEventListener('input', ()=> programarAutoSave(750));
      UI.inpObs.addEventListener('change', ()=> programarAutoSave(200));
    }

    // Botones +/- (delegado)
    const panel = document.getElementById('panel-taller');
    if(panel){
      panel.addEventListener('click', (e)=>{
        const btn = e.target.closest('button[data-op][data-campo]');
        if(!btn) return;

        const op = btn.dataset.op;
        const campo = btn.dataset.campo;
        const input = UI.inputs[campo];
        if(!input) return;

        let val = parseInt(input.value || '0',10);
        if(Number.isNaN(val)) val = 0;
        if(op === '+') val += 1;
        if(op === '-') val = Math.max(0, val - 1);
        input.value = val;

        programarAutoSave(250);
      });
    }
  }

  window.AutoSave = { init, programarAutoSave, guardarAhora };
})();
