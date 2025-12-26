// js/state.js
(function(){
  const hoy = new Date();
  const fechaClave = hoy.toISOString().slice(0,10); // yyyy-mm-dd

  function baseTaller(){
    return { personal:0, services:0, pruebas:0, instalaciones:0, otros:0, obs:'', updated:null };
  }

  window.APP_STATE = {
    hoy,
    fechaClave,
    tallerActual: "zipoli",
    modoActual: "hoy",
    archivosOrdenados: [],
    printUltimos7DefaultHtml: "",
    datos: {
      fecha: fechaClave,
      zipoli: baseTaller(),
      alem: baseTaller()
    },
    baseTaller
  };
})();
