// ============================================================
//  MEMORIES SHARE — main.js
//  Pagina organizzatore: crea eventi, genera QR code
// ============================================================

/* ---- Firebase refs ---- */
let db, auth;
let currentEventId = null;

/* ---- Init ---- */
document.addEventListener('DOMContentLoaded', () => {
  initFirebase();
  bindUI();
  loadMyEvents();
  updateClock();
});

function initFirebase() {
  if (!IS_CONFIGURED) {
    showBanner();
    return;
  }
  try {
    firebase.initializeApp(firebaseConfig);
    db   = firebase.firestore();
    auth = firebase.auth();
    auth.signInAnonymously().catch(console.error);
  } catch (e) {
    console.error('Firebase init error:', e);
    showBanner();
  }
}

function showBanner() {
  const banner = document.getElementById('config-banner');
  if (banner) banner.classList.remove('hidden');
}

/* ---- UI Bindings ---- */
function bindUI() {
  // Form create event
  const form = document.getElementById('create-form');
  if (form) form.addEventListener('submit', handleCreateEvent);

  // Emoji picker
  const emojiButtons = document.querySelectorAll('.emoji-btn');
  emojiButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      emojiButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // QR Modal close
  const closeQr = document.getElementById('close-qr-modal');
  if (closeQr) closeQr.addEventListener('click', () => closeModal('qr-modal'));

  // Copy link button
  const copyBtn = document.getElementById('copy-link-btn');
  if (copyBtn) copyBtn.addEventListener('click', copyShareLink);

  // Print QR
  const printBtn = document.getElementById('print-qr-btn');
  if (printBtn) printBtn.addEventListener('click', () => window.print());

  // Close modal on backdrop click
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) closeModal(backdrop.id);
    });
  });
}

/* ---- Create Event ---- */
async function handleCreateEvent(e) {
  e.preventDefault();
  if (!IS_CONFIGURED) { showToast('⚠️ Configura prima Firebase! Leggi SETUP.md', 'error'); return; }

  const nameInput  = document.getElementById('event-name');
  const dateInput  = document.getElementById('event-date');
  const activeEmoji = document.querySelector('.emoji-btn.active');

  const name  = nameInput.value.trim();
  const date  = dateInput.value;
  const emoji = activeEmoji ? activeEmoji.dataset.emoji : '🎉';

  if (!name) { showToast('Inserisci il nome dell\'evento', 'error'); return; }

  const btn = document.getElementById('create-btn');
  setLoading(btn, true);

  try {
    const eventId = generateId();
    const eventData = {
      name,
      date: date || null,
      emoji,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      photoCount: 0
    };

    await db.collection('events').doc(eventId).set(eventData);

    // Salva in localStorage
    saveMyEvent(eventId, { name, date, emoji });

    // Mostra QR
    currentEventId = eventId;
    showQRModal(eventId, name);

    // Reset form
    nameInput.value = '';
    dateInput.value = '';

    // Aggiorna lista
    loadMyEvents();
    showToast('✨ Evento creato!', 'success');

  } catch (err) {
    console.error('Create event error:', err);
    showToast('Errore nella creazione. Controlla Firebase.', 'error');
  } finally {
    setLoading(btn, false);
  }
}

/* ---- QR Modal ---- */
function showQRModal(eventId, eventName) {
  const shareUrl = `${APP_BASE_URL}/share.html?event=${eventId}`;
  const galleryUrl = `${APP_BASE_URL}/gallery.html?event=${eventId}`;

  document.getElementById('qr-event-name').textContent = eventName;
  document.getElementById('share-link-text').textContent = shareUrl;
  document.getElementById('gallery-link').href = galleryUrl;

  // Genera QR
  const canvas = document.getElementById('qr-canvas');
  if (canvas && window.QRCode) {
    QRCode.toCanvas(canvas, shareUrl, {
      width: 240,
      margin: 2,
      color: { dark: '#1a0435', light: '#ffffff' }
    }, err => {
      if (err) console.error('QR error:', err);
    });
  }

  openModal('qr-modal');
}

function copyShareLink() {
  const url = document.getElementById('share-link-text').textContent;
  navigator.clipboard.writeText(url).then(() => {
    showToast('🔗 Link copiato!', 'success');
  }).catch(() => {
    // fallback
    const el = document.createElement('textarea');
    el.value = url;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showToast('🔗 Link copiato!', 'success');
  });
}

/* ---- My Events (localStorage) ---- */
function saveMyEvent(id, data) {
  const events = getMyEvents();
  events.unshift({ id, ...data, savedAt: Date.now() });
  // Tieni solo ultimi 20 eventi
  const trimmed = events.slice(0, 20);
  localStorage.setItem('memoriesShare_events', JSON.stringify(trimmed));
}

function getMyEvents() {
  try {
    return JSON.parse(localStorage.getItem('memoriesShare_events') || '[]');
  } catch { return []; }
}

async function loadMyEvents() {
  const list = document.getElementById('my-events-list');
  const section = document.getElementById('my-events-section');
  const empty = document.getElementById('events-empty');
  if (!list) return;

  const events = getMyEvents();

  if (events.length === 0) {
    if (section) section.classList.add('hidden');
    if (empty) empty.classList.remove('hidden');
    return;
  }

  if (section) section.classList.remove('hidden');
  if (empty) empty.classList.add('hidden');

  list.innerHTML = '';

  for (const ev of events) {
    // Carica conteggio foto da Firestore (se possibile)
    let photoCount = '—';
    if (IS_CONFIGURED && db) {
      try {
        const snap = await db.collection('events').doc(ev.id).get();
        if (snap.exists) photoCount = snap.data().photoCount || 0;
      } catch (e) { /* ignora */ }
    }

    const dateStr = ev.date ? new Date(ev.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    const card = document.createElement('div');
    card.className = 'event-card fade-in';
    card.innerHTML = `
      <div class="event-emoji">${ev.emoji || '🎉'}</div>
      <div class="event-info">
        <div class="event-name">${escapeHtml(ev.name)}</div>
        <div class="event-meta">${dateStr}${dateStr && photoCount !== '—' ? ' · ' : ''}${photoCount !== '—' ? `${photoCount} foto/video` : ''}</div>
      </div>
      <div class="flex gap-1">
        <button class="btn btn-xs btn-ghost" onclick="showEventQR('${ev.id}','${escapeHtml(ev.name).replace(/'/g,"\\'")}')">QR</button>
        <a href="gallery.html?event=${ev.id}" class="btn btn-xs btn-primary">Galleria →</a>
      </div>
    `;
    list.appendChild(card);
  }
}

async function showEventQR(eventId, eventName) {
  currentEventId = eventId;
  showQRModal(eventId, eventName);
}

/* ---- Utils ---- */
function generateId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase() +
         Math.random().toString(36).substring(2, 6).toUpperCase();
}

function setLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Creazione...';
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
    btn.disabled = false;
  }
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(msg, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastIn 0.3s ease reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function updateClock() {
  const el = document.getElementById('current-date');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
