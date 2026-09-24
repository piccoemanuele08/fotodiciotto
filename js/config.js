// ============================================================
//  MEMORIES SHARE — Firebase Config
//  ✅ Firebase già configurato!
//  ⏳ Manca solo: compilare cloudinaryConfig (Passo 5 del SETUP.md)
// ============================================================

// ---- Firebase (Auth + Firestore) ----
// Questo file è caricato via <script> tag negli HTML — NON aggiungere
// import/require: questo NON è un progetto Node.js/webpack.
const firebaseConfig = {
  apiKey: "AIzaSyCnkguOw8k3GPDfVMufxPtoGob74C25Bmw",
  authDomain: "memories-compleanno-2026.firebaseapp.com",
  projectId: "memories-compleanno-2026",
  storageBucket: "",   // Non usato — storage gestito da Cloudinary
  messagingSenderId: "1021831205599",
  appId: "1:1021831205599:web:1e02c2fb9ce8f0f4c30f6a"
};

// ---- Cloudinary (storage gratuito per foto e video) ----
// ⬇ Compila questi due valori seguendo il Passo 5 del SETUP.md
const cloudinaryConfig = {
  cloudName: "jvmyjsdd",    // es. "dxy1abc2z"
  uploadPreset: "memories_unsigned"  // es. "memories_unsigned"
};

// Rileva automaticamente l'URL base dell'app
// Funzionerà ovunque tu ospiti il sito (Firebase Hosting, GitHub Pages, ecc.)
const APP_BASE_URL = (() => {
  const loc = window.location;
  const path = loc.pathname.replace(/\/[^/]*$/, '');
  return loc.origin + path;
})();

// Controlla se le config sono state compilate
const IS_CONFIGURED = !firebaseConfig.apiKey.includes('INSERISCI');
const IS_CLOUDINARY_CONFIGURED = !cloudinaryConfig.cloudName.includes('INSERISCI');
