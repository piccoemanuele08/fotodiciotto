// ============================================================
//  MEMORIES SHARE — gallery.js
//  Galleria condivisa: visualizza, scarica, lightbox
// ============================================================

let db, auth;
let eventId   = null;
let eventData = null;
let allPhotos = [];      // Tutti i media caricati
let lightboxIndex = 0;

/* ---- Init ---- */
document.addEventListener('DOMContentLoaded', () => {
  eventId = new URLSearchParams(window.location.search).get('event');

  if (!eventId) {
    showError('Link galleria non valido.');
    return;
  }

  initFirebase();
  bindUI();
});

function initFirebase() {
  if (!IS_CONFIGURED) {
    showError('App non configurata. Contatta l\'organizzatore.');
    return;
  }
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    db   = firebase.firestore();
    auth = firebase.auth();
    // Le foto vengono lette tramite URL Cloudinary salvato su Firestore

    auth.signInAnonymously().catch(console.error);
    loadGallery();
  } catch (e) {
    console.error('Firebase init error:', e);
    showError('Errore di connessione.');
  }
}

/* ---- Load Event + Gallery ---- */
async function loadGallery() {
  try {
    // Carica info evento
    const eventSnap = await db.collection('events').doc(eventId).get();
    if (!eventSnap.exists) {
      showError('Evento non trovato.');
      return;
    }
    eventData = eventSnap.data();
    renderEventHeader();

    // Listener in tempo reale per nuove foto
    const photosRef = db.collection('events').doc(eventId).collection('photos')
                       .orderBy('uploadedAt', 'desc');

    photosRef.onSnapshot(snapshot => {
      // Primo caricamento
      if (allPhotos.length === 0) {
        allPhotos = [];
        snapshot.docs.forEach(doc => {
          allPhotos.push({ id: doc.id, ...doc.data() });
        });
        renderGallery(allPhotos);
      } else {
        // Aggiornamenti in tempo reale (nuove foto)
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const photo = { id: change.doc.id, ...change.doc.data() };
            allPhotos.unshift(photo);
            prependPhoto(photo);
          } else if (change.type === 'removed') {
            allPhotos = allPhotos.filter(p => p.id !== change.doc.id);
            document.getElementById(`photo-${change.doc.id}`)?.remove();
          }
        });
        updateStats();
      }
    }, err => {
      console.error('Gallery snapshot error:', err);
      showError('Errore nel caricamento delle foto.');
    });

  } catch (err) {
    console.error('Load gallery error:', err);
    showError('Impossibile caricare la galleria.');
  }
}

/* ---- Render event header ---- */
function renderEventHeader() {
  document.getElementById('loading-bar').classList.add('hidden');

  document.getElementById('event-title').textContent     = eventData.name;
  document.getElementById('event-emoji-big').textContent = eventData.emoji || '🎉';

  if (eventData.date) {
    const d = new Date(eventData.date);
    document.getElementById('event-date-str').textContent =
      d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // Link upload
  const shareLink = document.getElementById('share-link');
  if (shareLink) shareLink.href = `share.html?event=${eventId}`;
}

/* ---- Render gallery ---- */
function renderGallery(photos) {
  const grid = document.getElementById('photo-grid');
  const loading = document.getElementById('gallery-loading');
  const empty = document.getElementById('gallery-empty');

  if (loading) loading.classList.add('hidden');

  if (!photos || photos.length === 0) {
    if (empty) empty.classList.remove('hidden');
    updateStats();
    return;
  }

  if (empty) empty.classList.add('hidden');
  if (grid) grid.innerHTML = '';

  photos.forEach((photo, idx) => {
    const el = createPhotoElement(photo, idx);
    if (grid) grid.appendChild(el);
  });

  updateStats();
}

function createPhotoElement(photo, idx) {
  const item = document.createElement('div');
  item.className = 'photo-item fade-in';
  item.id = `photo-${photo.id}`;
  item.dataset.idx = allPhotos.indexOf(photo) >= 0 ? allPhotos.indexOf(photo) : idx;

  const isVideo = photo.type === 'video';

  if (isVideo) {
    // Video: mostra thumbnail con play icon
    const video = document.createElement('video');
    video.src = photo.url;
    video.preload = 'metadata';
    video.muted = true;
    video.style.cssText = 'width:100%;height:auto;display:block;';
    item.appendChild(video);

    const playIcon = document.createElement('div');
    playIcon.className = 'video-play-icon';
    playIcon.innerHTML = '▶';
    item.appendChild(playIcon);
  } else {
    // Immagine lazy-loaded
    const img = document.createElement('img');
    img.alt = photo.originalName || 'Foto';
    img.loading = 'lazy';
    img.src = photo.url;
    item.appendChild(img);
  }

  // Overlay con download
  const overlay = document.createElement('div');
  overlay.className = 'photo-overlay';
  overlay.innerHTML = `
    <button class="btn btn-xs btn-ghost" onclick="event.stopPropagation();downloadSingle('${photo.url}','${escapeHtml(photo.originalName || 'foto')}')" title="Scarica">
      ⬇
    </button>
    <span style="flex:1;font-size:0.75rem;color:rgba(255,255,255,0.7);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(photo.uploaderName || 'Ospite')}</span>
  `;
  item.appendChild(overlay);

  // Click → lightbox
  item.addEventListener('click', () => openLightbox(allPhotos.findIndex(p => p.id === photo.id)));

  return item;
}

function prependPhoto(photo) {
  const grid = document.getElementById('photo-grid');
  const empty = document.getElementById('gallery-empty');
  if (empty) empty.classList.add('hidden');

  const idx = 0; // nuova foto è in cima
  const el = createPhotoElement(photo, idx);
  el.classList.add('fade-in');
  if (grid && grid.firstChild) {
    grid.insertBefore(el, grid.firstChild);
  } else if (grid) {
    grid.appendChild(el);
  }
  updateStats();
  showToast('📸 Nuova foto aggiunta!', 'info');
}

function updateStats() {
  const images = allPhotos.filter(p => p.type !== 'video').length;
  const videos = allPhotos.filter(p => p.type === 'video').length;
  const uploaders = new Set(allPhotos.map(p => p.uploaderUid)).size;

  const el = {
    total:     document.getElementById('stat-total'),
    images:    document.getElementById('stat-images'),
    videos:    document.getElementById('stat-videos'),
    people:    document.getElementById('stat-people'),
  };

  if (el.total)   el.total.textContent   = allPhotos.length;
  if (el.images)  el.images.textContent  = images;
  if (el.videos)  el.videos.textContent  = videos;
  if (el.people)  el.people.textContent  = uploaders;
}

/* ---- Lightbox ---- */
function openLightbox(idx) {
  if (idx < 0 || idx >= allPhotos.length) return;
  lightboxIndex = idx;
  renderLightboxMedia(idx);
  document.getElementById('lightbox').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('active');
  document.body.style.overflow = '';
  // Ferma eventuali video in riproduzione
  const video = document.getElementById('lightbox-video');
  if (video) { video.pause(); video.src = ''; }
}

function renderLightboxMedia(idx) {
  const photo = allPhotos[idx];
  if (!photo) return;

  const imgEl    = document.getElementById('lightbox-img');
  const videoEl  = document.getElementById('lightbox-video');
  const info     = document.getElementById('lightbox-info');
  const counter  = document.getElementById('lightbox-counter');

  // Ferma video precedente
  if (videoEl) { videoEl.pause(); videoEl.src = ''; }

  if (photo.type === 'video') {
    if (imgEl)   imgEl.classList.add('hidden');
    if (videoEl) {
      videoEl.classList.remove('hidden');
      videoEl.src = photo.url;
      videoEl.controls = true;
      videoEl.autoplay = true;
    }
  } else {
    if (videoEl) videoEl.classList.add('hidden');
    if (imgEl) {
      imgEl.classList.remove('hidden');
      imgEl.src = photo.url;
      imgEl.alt = photo.originalName || 'Foto';
    }
  }

  if (info) {
    const date = photo.uploadedAt?.toDate?.() || new Date();
    const dateStr = date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
    info.textContent = `${photo.uploaderName || 'Ospite'} · ${dateStr}`;
  }

  if (counter) counter.textContent = `${idx + 1} / ${allPhotos.length}`;

  // Nav arrows
  document.getElementById('lb-prev').style.visibility = idx > 0 ? 'visible' : 'hidden';
  document.getElementById('lb-next').style.visibility = idx < allPhotos.length - 1 ? 'visible' : 'hidden';
}

function lightboxNav(dir) {
  const newIdx = lightboxIndex + dir;
  if (newIdx < 0 || newIdx >= allPhotos.length) return;
  lightboxIndex = newIdx;
  renderLightboxMedia(newIdx);
}

/* ---- Download ---- */
async function downloadSingle(url, name) {
  try {
    showToast('⬇ Download in corso...', 'info', 2000);
    const response = await fetch(url);
    const blob     = await response.blob();
    const ext      = blob.type.split('/')[1] || 'jpg';
    const fileName = name.includes('.') ? name : `${name}.${ext}`;
    const link     = document.createElement('a');
    link.href      = URL.createObjectURL(blob);
    link.download  = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('Download error:', err);
    // Fallback: apri in nuova tab
    window.open(url, '_blank');
  }
}

async function downloadLightboxCurrent() {
  const photo = allPhotos[lightboxIndex];
  if (photo) downloadSingle(photo.url, photo.originalName || `memoria_${lightboxIndex + 1}`);
}

async function downloadAll() {
  if (allPhotos.length === 0) {
    showToast('Nessuna foto da scaricare', 'error');
    return;
  }

  if (!window.JSZip) {
    showToast('Libreria ZIP non disponibile', 'error');
    return;
  }

  const btn = document.getElementById('download-all-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Preparazione ZIP...';
  }

  showToast(`📦 Sto raccogliendo ${allPhotos.length} file...`, 'info', 8000);

  try {
    const zip = new JSZip();
    const folder = zip.folder(`${eventData.name.replace(/[^a-zA-Z0-9]/g, '_')}_memories`);

    await Promise.all(allPhotos.map(async (photo, idx) => {
      try {
        const response = await fetch(photo.url);
        const blob = await response.blob();
        const ext  = blob.type.split('/')[1] || (photo.type === 'video' ? 'mp4' : 'jpg');
        const name = `${String(idx + 1).padStart(3, '0')}_${photo.uploaderName || 'ospite'}.${ext}`
                       .replace(/[^a-zA-Z0-9._-]/g, '_');
        folder.file(name, blob);
      } catch (e) {
        console.warn(`Skip ${photo.id}:`, e);
      }
    }));

    const content = await zip.generateAsync({ type: 'blob' }, meta => {
      if (btn) btn.innerHTML = `<span class="spinner"></span> ${meta.percent.toFixed(0)}%`;
    });

    const link = document.createElement('a');
    link.href  = URL.createObjectURL(content);
    link.download = `${eventData.name.replace(/[^a-zA-Z0-9]/g, '_')}_memories.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('✅ ZIP scaricato con successo!', 'success');
  } catch (err) {
    console.error('Download all error:', err);
    showToast('Errore durante il download. Riprova.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '⬇ Scarica tutto (ZIP)';
    }
  }
}

/* ---- UI Bindings ---- */
function bindUI() {
  // Lightbox close
  document.getElementById('lb-close')?.addEventListener('click', closeLightbox);
  // Lightbox nav
  document.getElementById('lb-prev')?.addEventListener('click', () => lightboxNav(-1));
  document.getElementById('lb-next')?.addEventListener('click', () => lightboxNav(1));
  // Lightbox download
  document.getElementById('lb-download')?.addEventListener('click', downloadLightboxCurrent);
  // Lightbox backdrop close
  document.getElementById('lightbox')?.addEventListener('click', e => {
    if (e.target.id === 'lightbox') closeLightbox();
  });
  // Download all
  document.getElementById('download-all-btn')?.addEventListener('click', downloadAll);
  // Keyboard nav
  document.addEventListener('keydown', e => {
    const lb = document.getElementById('lightbox');
    if (!lb?.classList.contains('active')) return;
    if (e.key === 'ArrowLeft')  lightboxNav(-1);
    if (e.key === 'ArrowRight') lightboxNav(1);
    if (e.key === 'Escape')     closeLightbox();
  });
}

/* ---- Utils ---- */
function showError(msg) {
  document.getElementById('loading-bar')?.classList.add('hidden');
  const errEl = document.getElementById('error-screen');
  if (errEl) {
    errEl.classList.remove('hidden');
    const msgEl = document.getElementById('error-message');
    if (msgEl) msgEl.textContent = msg;
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
