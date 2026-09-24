# 📸 Memories Share — Guida di Setup Firebase

Questa guida ti spiega come configurare Firebase gratuitamente in ~10 minuti.
Firebase **non richiede carta di credito** per il piano gratuito (Spark Plan).

---

## Passo 1 — Crea il progetto Firebase

1. Vai su **[console.firebase.google.com](https://console.firebase.google.com)**
2. Clicca **"Aggiungi progetto"**
3. Dai un nome al progetto (es. `memories-compleanno-2026`)
4. Disabilita Google Analytics (non serve)
5. Clicca **"Crea progetto"** e aspetta

---

## Passo 2 — Aggiungi un'app Web

1. Nel pannello del progetto, clicca l'icona **`</>`** (Web)
2. Dai un nome all'app (es. `Memories Share`)
3. **NON** spuntare "Firebase Hosting" per ora (lo facciamo dopo)
4. Clicca **"Registra app"**
5. Vedrai apparire una schermata con le chiavi API. **Copia questi valori:**

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "tuoprogetto.firebaseapp.com",
  projectId: "tuoprogetto",
  storageBucket: "tuoprogetto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef..."
};
```

1. Apri il file **`js/config.js`** nella cartella dell'app
2. Sostituisci i valori `INSERISCI_QUI_...` con i valori copiati
3. Salva il file

---

## Passo 3 — Abilita Authentication (Anonima)

1. Nel menu laterale di Firebase, clicca **Authentication**
2. Clicca **"Inizia"**
3. Vai su **"Metodi di accesso"** → **"Anonimo"**
4. Attiva e salva

---

## Passo 4 — Crea il database Firestore

1. Nel menu laterale, clicca **Firestore Database**
2. Clicca **"Crea database"**
3. Scegli **"Inizia in modalità produzione"**
4. Scegli la regione più vicina (es. `europe-west3` per Frankfurt)
5. Clicca **"Attiva"**

### Configura le regole Firestore

Vai su **Firestore → Regole** e incolla questo:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Chiunque può leggere e scrivere eventi e foto
    // (la sicurezza è garantita dall'ID univoco dell'evento)
    match /events/{eventId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update: if request.auth != null
                    && request.resource.data.diff(resource.data).affectedKeys()
                       .hasOnly(['photoCount']);

      match /photos/{photoId} {
        allow read: if true;
        allow create: if request.auth != null
                      && request.resource.data.size() < 10;
        allow delete: if false;
      }
    }
  }
}
```

Clicca **"Pubblica"**.

---

## Passo 5 — Configura Cloudinary (storage foto GRATIS)

Cloudinary offre **25 GB gratuiti** senza carta di credito.

### 5a — Crea l'account Cloudinary

1. Vai su **[cloudinary.com](https://cloudinary.com)** → clicca **"Sign Up For Free"**
2. Registrati con Google o email (nessuna carta di credito richiesta)
3. Dopo il login sei nella **Dashboard** — annota il tuo **Cloud Name**
   (visibile in alto, es. `dxy1abc2z`)

### 5b — Crea un Upload Preset (permette upload senza chiave segreta)

1. In alto clicca **Settings** (icona ingranaggio) → **Upload**
2. Scorri fino a **"Upload presets"** → clicca **"Add upload preset"**
3. Configura così:
   - **Preset name**: `memories_unsigned`
   - **Signing Mode**: seleziona **`Unsigned`** ← obbligatorio!
   - **Folder**: `events` (opzionale)
4. Clicca **"Save"** in alto a destra

### 5c — Inserisci i valori in config.js

Apri **`js/config.js`** e sostituisci le due righe evidenziate:

```javascript
const cloudinaryConfig = {
  cloudName:    "dxy1abc2z",         // ← il tuo Cloud Name dalla Dashboard
  uploadPreset: "memories_unsigned"  // ← il nome del preset appena creato
};
```

Salva il file.

---

## Passo 6 — Pubblica l'app (hosting gratuito)

Hai due opzioni gratuite:

### Opzione A: Firebase Hosting (consigliata)

Richiede Node.js installato sul PC.

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
# Scegli il tuo progetto Firebase
# Public directory: . (punto, la cartella corrente)
# Single-page app: NO
firebase deploy
```

Il sito sarà su: `https://tuoprogetto.web.app`

### Opzione B: GitHub Pages (più semplice)

1. Crea un repository su [github.com](https://github.com)
2. Carica tutti i file dell'app
3. Vai su **Settings → Pages → Source: main branch → root**
4. Il sito sarà su: `https://tuonome.github.io/tuorepo`

---

## Passo 7 — Test finale

1. Apri `index.html` (o il tuo dominio pubblicato)
2. Crea un evento di test
3. Si genera il QR → clicca "Galleria" per aprirla
4. Scansiona il QR con il tuo telefono
5. Carica una foto → deve apparire in galleria in tempo reale ✓

---

## 💰 Limiti del piano gratuito

| Servizio | Limite gratuito |
|---|---|
| **Cloudinary** (foto/video) | **25 GB** storage + **25 GB** banda/mese |
| Firestore reads | **50.000/giorno** |
| Firestore writes | **20.000/giorno** |
| Auth | Illimitato |

Per una festa con 100–200 invitati: anche 2.000 foto da 5MB = 10 GB — ampiamente nel limite dei 25 GB gratuiti di Cloudinary.

---

## ❓ Problemi comuni

**"Permission denied" su Firebase:**
→ Controlla le regole di Firestore (Passo 4)

**Errore upload foto:**
→ Controlla che `cloudName` e `uploadPreset` in `js/config.js` siano corretti (Passo 5)
→ Verifica che il preset sia impostato su **Unsigned** su Cloudinary

**Il QR code non funziona:**
→ Il QR punta a `share.html?event=...` — assicurati che il sito sia online (non aprire i file localmente con `file://`)

**Le foto non appaiono in galleria:**
→ Controlla la console del browser (F12) per errori

**"App non configurata" / "Cloudinary non configurato":**
→ Hai compilato correttamente `js/config.js`? Controlla che non ci siano `INSERISCI_QUI` rimasti.

---

Realizzato con ❤️ — Memories Share
