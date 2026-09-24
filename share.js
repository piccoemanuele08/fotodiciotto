// ============================================================
//  MEMORIES SHARE — share.js
//  Pagina invitati: scatta/carica foto e video, upload su Firebase
// ============================================================

let db, auth;
let eventId = null;
let eventData = null;
let selectedFiles = [];
let uploaderName = '';

const MAX_FILE_SIZE_MB = 50;   // Max dimensione singolo file (MB)
const MAX_FILES        = 20;   // Max file per sessione upload

/* ---- Init ---- */
document.addEventListener('DOMContentLoaded', () => {
  eventId = new URLSearchParams(window.location.search).get('event');

  if (!eventId) {
    showError('Link non valido. Scansiona di nuovo il QR code.');
    return;
  }

  initFirebase();
  bindUI();
});

function initFirebase() {
  if (!IS_CONFIGURED) {
    showError('L\'app non è ancora configurata. Contatta l\'organizzatore.');
    return;
  }
  if (!IS_CLOUDINARY_CONFIGURED) {
    showError('Cloudinary non è configurato. Contatta l\'organizzatore.');
    return;
  }
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    db   = firebase.firestore();
    auth = firebase.auth();
    // Storage gestito da Cloudinary, non da Firebase

    auth.signInAnonymously()
      .then(() => loadEvent())
      .catch(err => {
        console.error('Auth error:', err);
        loadEvent(); // Prova comunque
      });
  } catch (e) {
    console.error('Firebase init error:', e);
    showError('Errore di connessione. Riprova tra qualche secondo.');
  }
}

async function loadEvent() {
  try {
    const snap = await db.collection('events').doc(eventId).get();
    if (!snap.exists) {
      showError('Evento non trovato. Controlla il QR code.');
      return;
    }
    eventData = snap.data();
    renderEventUI();
  } catch (err) {
    console.error('Load event error:', err);
    showError('Impossibile caricare l\'evento. Controlla la connessione.');
  }
}

/* ---- Render event info ---- */
function renderEventUI() {
  document.getElementById('loading-screen').classList.add('hidden');
  document.getElementById('upload-screen').classList.remove('hidden');

  document.getElementById('event-title').textContent    = eventData.name;
  document.getElementById('event-emoji-big').textContent = eventData.emoji || '🎉';

  if (eventData.date) {
    const d = new Date(eventData.date);
    document.getElementById('event-date-str').textContent =
      d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // Link galleria
  const galleryLink = document.getElementById('gallery-link');
  if (galleryLink) galleryLink.href = `gallery.html?event=${eventId}`;
}

/* ---- UI Bindings ---- */
function bindUI() {
  // Camera button
  const cameraBtn = document.getElementById('camera-btn');
  const cameraInput = document.getElementById('camera-input');
  if (cameraBtn && cameraInput) {
    cameraBtn.addEventListener('click', () => cameraInput.click());
    cameraInput.addEventListener('change', e => handleFiles(e.target.files));
  }

  // Gallery button
  const galleryBtn = document.getElementById('gallery-btn');
  const galleryInput = document.getElementById('gallery-input');
  if (galleryBtn && galleryInput) {
    galleryBtn.addEventListener('click', () => galleryInput.click());
    galleryInput.addEventListener('change', e => handleFiles(e.target.files));
  }

  // Upload zone drag & drop
  const dropZone = document.getElementById('drop-zone');
  if (dropZone) {
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      handleFiles(e.dataTransfer.files);
    });
    const dropInput = dropZone.querySelector('input[type="file"]');
    if (dropInput) dropInput.addEventListener('change', e => handleFiles(e.target.files));
  }

  // Upload button
  const uploadBtn = document.getElementById('upload-btn');
  if (uploadBtn) uploadBtn.addEventListener('click', startUpload);

  // Name input (opzionale)
  const nameInput = document.getElementById('uploader-name');
  if (nameInput) {
    nameInput.addEventListener('input', () => {
      uploaderName = nameInput.value.trim();
    });
    // Ricorda nome
    const saved = localStorage.getItem('memoriesShare_name');
    if (saved) { nameInput.value = saved; uploaderName = saved; }
    nameInput.addEventListener('blur', () => {
      if (uploaderName) localStorage.setItem('memoriesShare_name', uploaderName);
    });
  }

  // Upload more button (success screen)
  const uploadMoreBtn = document.getElementById('upload-more-btn');
  if (uploadMoreBtn) uploadMoreBtn.addEventListener('click', resetToUpload);
}

/* ---- File Handling ---- */
function handleFiles(fileList) {
  if (!fileList || fileList.length === 0) return;

  const newFiles = Array.from(fileList).filter(f => {
    // Solo immagini e video
    if (!f.type.startsWith('image/') && !f.type.startsWith('video/')) {
      showToast(`⚠️ ${f.name}: formato non supportato`, 'error');
      return false;
    }
    // Limite dimensione
    if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      showToast(`⚠️ ${f.name}: file troppo grande (max ${MAX_FILE_SIZE_MB}MB)`, 'error');
      return false;
    }
    return true;
  });

  if (selectedFiles.length + newFiles.length > MAX_FILES) {
    showToast(`⚠️ Puoi caricare massimo ${MAX_FILES} file alla volta`, 'error');
    return;
  }

  selectedFiles.push(...newFiles);
  renderPreviews();
  updateUploadBtn();
}

function renderPreviews() {
  const grid = document.getElementById('preview-grid');
  const section = document.getElementById('preview-section');
  if (!grid || !section) return;

  if (selectedFiles.length === 0) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  grid.innerHTML = '';

  selectedFiles.forEach((file, idx) => {
    const item = document.createElement('div');
    item.className = 'preview-item fade-in';
    item.dataset.idx = idx;

    if (file.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.alt = file.name;
      item.appendChild(img);
    } else {
      // Video thumbnail
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.muted = true;
      video.style.cssText = 'width:100%;height:100%;object-fit:cover;';
      item.appendChild(video);
      const badge = document.createElement('span');
      badge.className = 'preview-video-badge';
      badge.textContent = '▶ VIDEO';
      item.appendChild(badge);
    }

    const removeBtn = document.createElement('button');
    removeBtn.className = 'preview-remove';
    removeBtn.innerHTML = '×';
    removeBtn.title = 'Rimuovi';
    removeBtn.onclick = () => removeFile(idx);
    item.appendChild(removeBtn);

    grid.appendChild(item);
  });
}

function removeFile(idx) {
  selectedFiles.splice(idx, 1);
  renderPreviews();
  updateUploadBtn();
}

function updateUploadBtn() {
  const btn = document.getElementById('upload-btn');
  const countEl = document.getElementById('upload-count');
  if (btn) btn.disabled = selectedFiles.length === 0;
  if (countEl) countEl.textContent = selectedFiles.length > 0
    ? `Carica ${selectedFiles.length} file`
    : 'Seleziona delle foto prima';
}

/* ---- Upload ---- */
async function startUpload() {
  if (selectedFiles.length === 0) return;

  const uploadBtn = document.getElementById('upload-btn');
  const uploadSection = document.getElementById('upload-main');
  const progressSection = document.getElementById('progress-section');

  if (uploadSection) uploadSection.classList.add('hidden');
  if (progressSection) progressSection.classList.remove('hidden');

  const uploadList = document.getElementById('upload-list');
  if (uploadList) uploadList.innerHTML = '';

  let completed = 0;
  const total = selectedFiles.length;

  const updateOverallProgress = () => {
    completed++;
    const pct = Math.round((completed / total) * 100);
    const overallBar = document.getElementById('overall-progress-fill');
    const overallLabel = document.getElementById('overall-progress-label');
    if (overallBar) overallBar.style.width = `${pct}%`;
    if (overallLabel) overallLabel.textContent = `${completed} di ${total} caricati`;
  };

  try {
    await Promise.all(selectedFiles.map(async (file, idx) => {
      // Crea elemento UI per questo file
      const itemId = `upload-item-${idx}`;
      const isVideo = file.type.startsWith('video/');
      const thumbUrl = isVideo ? null : URL.createObjectURL(file);
      const item = createUploadItem(itemId, file.name, thumbUrl, isVideo);
      if (uploadList) uploadList.appendChild(item);

      try {
        await uploadSingleFile(file, itemId);
        updateOverallProgress();
        setItemStatus(itemId, 'success', '✓ Caricato!');
      } catch (err) {
        updateOverallProgress();
        setItemStatus(itemId, 'error', '✗ Errore');
        console.error(`Upload error for ${file.name}:`, err);
      }
    }));

    // Tutto fatto!
    showSuccessScreen(total);

  } catch (err) {
    console.error('Upload batch error:', err);
    showToast('Errore durante il caricamento', 'error');
    if (uploadSection) uploadSection.classList.remove('hidden');
    if (progressSection) progressSection.classList.add('hidden');
  }
}

async function uploadSingleFile(file, itemId) {
  const uid = auth.currentUser ? auth.currentUser.uid : 'anonymous';

  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    formData.append('folder', `events/${eventId}`);
    // Tag utili per organizzare su Cloudinary
    formData.append('tags', `event_${eventId}`);

    const endpoint =
      `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/auto/upload`;

    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);

    // Progresso upload
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        setItemProgress(itemId, pct);
      }
    };

    xhr.onload = async () => {
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          const downloadURL  = data.secure_url;
          const storagePath  = data.public_id;   // es. "events/abc123/img_001"

          // Salva metadati su Firestore (invariato)
          await db.collection('events').doc(eventId).collection('photos').add({
            url:          downloadURL,
            storagePath:  storagePath,
            fileName:     file.name,
            type:         file.type.startsWith('video/') ? 'video' : 'image',
            mimeType:     file.type,
            uploaderName: uploaderName || 'Ospite',
            uploaderUid:  uid,
            uploadedAt:   firebase.firestore.FieldValue.serverTimestamp(),
            size:         file.size,
            originalName: file.name
          });

          // Incrementa counter evento
          db.collection('events').doc(eventId).update({
            photoCount: firebase.firestore.FieldValue.increment(1)
          }).catch(() => {});

          resolve();
        } catch (err) {
          reject(err);
        }
      } else {
        let errMsg = `Upload Cloudinary fallito (${xhr.status})`;
        try {
          const errData = JSON.parse(xhr.responseText);
          errMsg = errData.error?.message || errMsg;
        } catch (_) {}
        reject(new Error(errMsg));
      }
    };

    xhr.onerror = () => reject(new Error('Errore di rete durante l\'upload'));
    xhr.send(formData);
  });
}

/* ---- UI Helpers ---- */
function createUploadItem(id, name, thumbUrl, isVideo) {
  const item = document.createElement('div');
  item.className = 'upload-item';
  item.id = id;
  item.innerHTML = `
    ${thumbUrl
      ? `<img class="upload-thumb" src="${thumbUrl}" alt="${escapeHtml(name)}">`
      : `<div class="upload-thumb" style="display:flex;align-items:center;justify-content:center;font-size:1.5rem;background:var(--surface)">🎥</div>`
    }
    <div class="upload-details">
      <div class="upload-name">${escapeHtml(name)}</div>
      <div class="upload-status" id="${id}-status">In attesa...</div>
      <div class="progress-bar mt-1"><div class="progress-fill" id="${id}-progress"></div></div>
    </div>
  `;
  return item;
}

function setItemProgress(id, pct) {
  const bar = document.getElementById(`${id}-progress`);
  const status = document.getElementById(`${id}-status`);
  if (bar) bar.style.width = `${pct}%`;
  if (status) status.textContent = `${pct}%`;
}

function setItemStatus(id, type, text) {
  const status = document.getElementById(`${id}-status`);
  if (status) {
    status.textContent = text;
    status.style.color = type === 'success' ? '#10b981' : '#ef4444';
  }
}

function showSuccessScreen(count) {
  document.getElementById('progress-section').classList.add('hidden');
  const success = document.getElementById('success-screen');
  if (success) {
    success.classList.remove('hidden');
    const msg = document.getElementById('success-msg');
    if (msg) msg.textContent = `${count} foto/video caricati con successo! 🎉`;

    const galleryLink = document.getElementById('success-gallery-link');
    if (galleryLink) galleryLink.href = `gallery.html?event=${eventId}`;
  }
}

function resetToUpload() {
  selectedFiles = [];
  document.getElementById('success-screen').classList.add('hidden');
  document.getElementById('upload-main').classList.remove('hidden');
  document.getElementById('preview-section').classList.add('hidden');
  updateUploadBtn();
  // Reset inputs
  document.querySelectorAll('input[type="file"]').forEach(i => i.value = '');
}

function showError(msg) {
  document.getElementById('loading-screen').classList.add('hidden');
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
