/* Firebase init (Compat) */
(function(){
  // Requiere: firebase-app-compat, firebase-auth-compat, firebase-database-compat
  const firebaseConfig = {
    apiKey: "AIzaSyBPhgr32Jk-NERmIBodqcMYAJt-_-IxU0A",
    authDomain: "gustavopersonal-8f5fc.firebaseapp.com",
    projectId: "gustavopersonal-8f5fc",
    databaseURL: "https://gustavopersonal-8f5fc-default-rtdb.firebaseio.com",
    storageBucket: "gustavopersonal-8f5fc.firebasestorage.app",
    messagingSenderId: "1073863078622",
    appId: "1:1073863078622:web:b4c5398517293700bd884f",
    measurementId: "G-Y20YMJCC76"
  };

  try{
    firebase.initializeApp(firebaseConfig);
  }catch(e){
    // ignore double init
  }

  // Exponer helpers globales para app.js
  window.FB = {
    enabled: true,
    auth: firebase.auth(),
    db: firebase.database(),
    uid: null
  };

  // Login anónimo (simple y sin UI)
  window.FB.auth.signInAnonymously().catch(()=>{
    window.FB.enabled = false;
  });

  window.FB.auth.onAuthStateChanged((user)=>{
    window.FB.uid = user ? user.uid : null;
    window.dispatchEvent(new CustomEvent("fb-auth-ready", { detail:{ uid: window.FB.uid }}));
  });
})();