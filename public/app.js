'use strict';

// ─────────────────────────────────────────
//  API helpers
// ─────────────────────────────────────────
const api = {
  async get(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  },
  async post(url, body) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    if (!r.ok) {
      const err = new Error(data.error || `HTTP ${r.status}`);
      if (data.tipo)       err.tipo       = data.tipo;
      if (data.existente)  err.existente  = data.existente;
      if (data.existentes) err.existentes = data.existentes;
      throw err;
    }
    return data;
  },
  async put(url, body) {
    const r = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data;
  }
};

// ─────────────────────────────────────────
//  State
// ─────────────────────────────────────────
const state = {
  facultades: {},
  allStudents: [],  // copia completa del servidor
  students: [],     // vista filtrada
  stats: null,
  filters: { q: '', facultad: '', carrera: '', estado: '', sort: 'fecha_desc', con_contacto: false }
};

const $ = id => document.getElementById(id);

// ─────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────
const CONF = {
  contacto_directo:   { label: 'Contacto directo',       icon: '🤝' },
  llamada_telefonica: { label: 'Llamada telefónica',      icon: '📞' },
  mensaje_texto:      { label: 'Mensaje / WhatsApp',      icon: '💬' },
  video:              { label: 'Video',                   icon: '🎥' },
  presencia_fisica:   { label: 'Visto en persona',        icon: '👀' },
  tercero_confiable:  { label: 'Información de tercero',  icon: '🔗' },
  redes_sociales:     { label: 'Redes sociales',          icon: '📱' },
  otro:               { label: 'Otro',                    icon: '📋' }
};

const DEATH_CONF = {
  hospital:               { label: 'Hospital o centro médico',    icon: '🏥' },
  familiar:               { label: 'Confirmación familiar',        icon: '🕊️' },
  rescate:                { label: 'Equipo de rescate',            icon: '🚒' },
  documentacion_oficial:  { label: 'Documentación oficial',        icon: '📋' },
  otro:                   { label: 'Otro',                         icon: '📝' },
};

const FAC_TAG = {
  'Ciencias':                       'tag-f-ciencias',
  'Medicina':                       'tag-f-medicina',
  'Ingeniería':                     'tag-f-ingenieria',
  'Ciencias Jurídicas y Políticas': 'tag-f-derecho',
  'Humanidades y Educación':        'tag-f-humanidades',
  'Arquitectura y Urbanismo':       'tag-f-arquit',
  'Ciencias Económicas y Sociales': 'tag-f-faces',
};

// ─────────────────────────────────────────
//  Utilities
// ─────────────────────────────────────────
function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0,2).map(w => w[0].toUpperCase()).join('');
}

function facTag(fac) {
  return FAC_TAG[fac] || 'tag-f-default';
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return '';
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60)   return 'Hace un momento';
  const m = Math.floor(s / 60);
  if (m < 60)   return `Hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `Hace ${h} h`;
  const dd = Math.floor(h / 24);
  return `Hace ${dd} día${dd !== 1 ? 's' : ''}`;
}

function formatDate(dateStr) {
  if (!dateStr) return 'No disponible';
  const d = new Date(dateStr);
  if (isNaN(d)) return 'No disponible';
  return d.toLocaleString('es-VE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─────────────────────────────────────────
//  Render: stats
// ─────────────────────────────────────────
function renderStats() {
  if (!state.stats) return;
  $('stat-desaparecidos').textContent = state.stats.desaparecidos;
  $('stat-aparecidos').textContent    = state.stats.aparecidos;
  $('stat-fallecidos').textContent    = state.stats.fallecidos ?? 0;
  $('stat-total').textContent         = state.stats.total;
  $('stat-facultades').textContent    = state.stats.porFacultad.length;
}

// ─────────────────────────────────────────
//  Render: faculty chips bar
// ─────────────────────────────────────────
function renderFacultyBar() {
  const bar = $('faculty-bar');
  const faculties = (state.stats?.porFacultad || []).filter(f => f.total > 0);
  if (!faculties.length) { bar.innerHTML = ''; return; }

  bar.innerHTML = faculties.map(f => `
    <button class="fac-chip ${state.filters.facultad === f.facultad ? 'active' : ''}"
            data-fac="${esc(f.facultad)}">
      ${esc(f.facultad)}
      <span class="fac-count">${f.desaparecidos}✗ ${f.aparecidos}✓${f.fallecidos > 0 ? ` ${f.fallecidos}†` : ''}</span>
    </button>
  `).join('');

  bar.querySelectorAll('.fac-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const fac = chip.dataset.fac;
      state.filters.facultad = state.filters.facultad === fac ? '' : fac;
      state.filters.carrera = '';
      $('filter-facultad').value = state.filters.facultad;
      updateCareerSelect('filter-carrera', state.filters.facultad);
      renderFacultyBar();
      applyFilters();
    });
  });
}

// ─────────────────────────────────────────
//  Render: heartbeat SVG
// ─────────────────────────────────────────
function heartbeatSVG() {
  return `<div class="hb-wrap">
    <svg class="hb-svg" viewBox="0 0 300 22" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
      <path class="hb-path" d="M0,11 L65,11 L78,3 L88,19 L98,11 L115,11 L122,5 L129,17 L136,11 L300,11"/>
    </svg>
  </div>`;
}

// ─────────────────────────────────────────
//  Render: single card
// ─────────────────────────────────────────
function renderCard(s) {
  const missing  = s.estado === 'desaparecido';
  const deceased = s.estado === 'fallecido';
  const found    = s.estado === 'aparecido';

  const av     = initials(s.nombre);
  const conf   = s.tipo_confirmacion ? (deceased ? DEATH_CONF : CONF)[s.tipo_confirmacion] : null;
  const tagCls = facTag(s.facultad);

  let headerHTML;
  if (missing) {
    headerHTML = heartbeatSVG();
  } else if (deceased) {
    headerHTML = `<div class="deceased-header">
      <svg viewBox="0 0 24 24" fill="none"><path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm0 5v6m0 4h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      Fallecido — Q.E.P.D.
    </div>`;
  } else {
    headerHTML = `<div class="found-shimmer">
      <svg viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Estudiante localizado
    </div>`;
  }

  const statusTag = missing
    ? `<span class="tag tag-missing">Desaparecido</span>`
    : deceased
    ? `<span class="tag tag-deceased">Fallecido</span>`
    : `<span class="tag tag-found">Aparecido</span>`;

  const cardClass   = missing ? 'missing'   : deceased ? 'deceased' : 'found';
  const avatarClass = missing ? 'av-missing' : deceased ? 'av-deceased' : 'av-found';
  const ariaLabel   = missing ? 'desaparecido' : deceased ? 'fallecido' : 'aparecido';
  const timeRef     = missing ? s.fecha_registro : s.fecha_aparecio;

  return `
  <article class="s-card ${cardClass}"
           data-id="${s.id}" role="listitem"
           aria-label="${esc(s.nombre)}, ${ariaLabel}">

    ${headerHTML}

    <div class="card-body">
      <div class="card-head">
        ${s.foto_signed_url
          ? `<img src="${s.foto_signed_url}" class="card-photo ${avatarClass}" alt="Foto de ${esc(s.nombre)}" loading="lazy" onerror="this.outerHTML='<div class=\\'card-avatar ${avatarClass}\\'>${av}</div>'">`
          : `<div class="card-avatar ${avatarClass}" aria-hidden="true">${av}</div>`}
        <div class="card-info">
          <h3 class="card-name">${esc(s.nombre)}</h3>
          <div class="card-tags">
            <span class="tag ${tagCls}">${esc(s.facultad)}</span>
            ${statusTag}
          </div>
          <div class="card-career">${esc(s.carrera)}${s.semestre ? ` · ${esc(s.semestre)}` : ''}</div>
        </div>
      </div>

      <div class="card-details">
        ${s.cedula ? `
          <div class="d-row">
            <span class="d-label">Cédula</span>
            <span class="d-val mono">${esc(s.cedula)}</span>
          </div>` : ''}
        ${s.ultima_ubicacion ? `
          <div class="d-row">
            <span class="d-label">Última vez</span>
            <span class="d-val">${esc(s.ultima_ubicacion)}</span>
          </div>` : ''}
        <div class="d-row">
          <span class="d-label">Reportado</span>
          <span class="d-val">${timeAgo(s.fecha_registro)}</span>
        </div>
      </div>
    </div>

    ${found && conf ? `
      <div class="conf-block">
        <div class="conf-type">
          <span class="conf-icon" aria-hidden="true">${conf.icon}</span>
          <span class="conf-label">${conf.label}</span>
        </div>
        ${s.detalles_confirmacion ? `<p class="conf-text">"${esc(s.detalles_confirmacion)}"</p>` : ''}
      </div>` : ''}

    <div class="card-foot">
      <button class="c-btn c-btn-detail" data-action="detail" data-id="${s.id}">Ver detalles</button>
      ${missing ? `<button class="c-btn c-btn-found" data-action="found" data-id="${s.id}">Marcar aparecido</button>` : ''}
      <span class="card-time">${timeAgo(timeRef)}</span>
    </div>
  </article>`;
}

// ─────────────────────────────────────────
//  Helpers: filtros
// ─────────────────────────────────────────
function hasActiveFilters() {
  return !!(state.filters.q || state.filters.facultad || state.filters.carrera || state.filters.estado || state.filters.con_contacto);
}

function clearFilters() {
  state.filters = { q: '', facultad: '', carrera: '', estado: '', sort: state.filters.sort, con_contacto: false };
  $('filter-q').value = '';
  $('filter-facultad').value = '';
  updateCareerSelect('filter-carrera', '');
  document.querySelectorAll('.tab-btn[data-estado]').forEach(b => b.classList.toggle('active', b.dataset.estado === ''));
  const cc = $('btn-con-contacto');
  if (cc) { cc.classList.remove('active'); cc.setAttribute('aria-pressed', 'false'); }
  renderFacultyBar();
  applyFilters();
}

function buildFilterChips() {
  const chips = [];
  const estadoLabels = { desaparecido: 'Desaparecidos', aparecido: 'Aparecidos', fallecido: 'Fallecidos' };
  if (state.filters.estado)      chips.push({ key: 'estado',      label: estadoLabels[state.filters.estado] || state.filters.estado });
  if (state.filters.facultad)    chips.push({ key: 'facultad',    label: state.filters.facultad });
  if (state.filters.carrera)     chips.push({ key: 'carrera',     label: state.filters.carrera });
  if (state.filters.q)           chips.push({ key: 'q',           label: `"${state.filters.q}"` });
  if (state.filters.con_contacto) chips.push({ key: 'con_contacto', label: 'Con contacto' });
  return chips;
}

function removeFilterChip(key) {
  if (key === 'estado') {
    state.filters.estado = '';
    document.querySelectorAll('.tab-btn[data-estado]').forEach(b => b.classList.toggle('active', b.dataset.estado === ''));
  } else if (key === 'facultad') {
    state.filters.facultad = '';
    state.filters.carrera  = '';
    $('filter-facultad').value = '';
    updateCareerSelect('filter-carrera', '');
    renderFacultyBar();
  } else if (key === 'carrera') {
    state.filters.carrera = '';
    $('filter-carrera').value = '';
  } else if (key === 'q') {
    state.filters.q = '';
    $('filter-q').value = '';
  } else if (key === 'con_contacto') {
    state.filters.con_contacto = false;
    const b = $('btn-con-contacto');
    if (b) { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); }
  }
  applyFilters();
}

// Filtra state.allStudents en el cliente y actualiza state.students + grid.
// No toca la red — solo se llama al servidor al mutar datos o en el init.
function applyFilters() {
  const { q, facultad, carrera, estado, sort, con_contacto } = state.filters;
  let list = state.allStudents;

  if (estado)       list = list.filter(s => s.estado   === estado);
  if (facultad)     list = list.filter(s => s.facultad === facultad);
  if (carrera)      list = list.filter(s => s.carrera  === carrera);
  if (con_contacto) list = list.filter(s => s.nombre_contacto || s.telefono_contacto || s.registrado_por || s.contacto_reportador);
  if (q) {
    const qLow  = q.trim().toLowerCase();
    const isNum = /^\d+$/.test(qLow);
    list = list.filter(s => {
      const nameMatch = s.nombre.toLowerCase().includes(qLow);
      const cedMatch  = isNum && s.cedula != null && String(s.cedula).includes(qLow);
      return nameMatch || cedMatch;
    });
  }

  list = [...list].sort((a, b) => {
    switch (sort || 'fecha_desc') {
      case 'fecha_asc':  return new Date(a.fecha_registro) - new Date(b.fecha_registro);
      case 'nombre_az':  return a.nombre.localeCompare(b.nombre, 'es');
      case 'nombre_za':  return b.nombre.localeCompare(a.nombre, 'es');
      default:           return new Date(b.fecha_registro) - new Date(a.fecha_registro);
    }
  });

  state.students = list;
  renderGrid();
}

// ─────────────────────────────────────────
//  Render: grid
// ─────────────────────────────────────────
function renderGrid() {
  const grid = $('students-grid');
  const countBar = $('result-count-bar');
  const chips = buildFilterChips();

  if (!state.students.length) {
    if (countBar) countBar.innerHTML = '';
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon" aria-hidden="true">🔍</div>
        <h3>No se encontraron estudiantes</h3>
        <p>Prueba con otros filtros o registra un nuevo caso.</p>
        ${hasActiveFilters() ? '<button class="btn-secondary btn-clear-filters" id="btn-clear-filters">Limpiar filtros</button>' : ''}
      </div>`;
    const clearBtn = $('btn-clear-filters');
    if (clearBtn) clearBtn.addEventListener('click', clearFilters);
    return;
  }

  if (countBar) {
    const n = state.students.length;
    const chipsHtml = chips.map(c =>
      `<span class="filter-chip">${esc(c.label)}<button class="chip-remove" data-chip="${esc(c.key)}" aria-label="Quitar filtro ${esc(c.label)}">×</button></span>`
    ).join('');
    countBar.innerHTML = `<span class="count-num">${n} estudiante${n !== 1 ? 's' : ''}</span>${chipsHtml}${chips.length ? `<button class="count-clear" id="btn-count-clear">Limpiar todo</button>` : ''}`;
    countBar.querySelectorAll('.chip-remove').forEach(btn =>
      btn.addEventListener('click', () => removeFilterChip(btn.dataset.chip))
    );
    const cc = $('btn-count-clear');
    if (cc) cc.addEventListener('click', clearFilters);
  }

  grid.innerHTML = state.students.map(renderCard).join('');

  grid.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      if (btn.dataset.action === 'detail') openDetailModal(id);
      if (btn.dataset.action === 'found')  confirmAndMark(id, 'found');
    });
  });

  grid.querySelectorAll('.s-card').forEach(card => {
    card.addEventListener('click', () => openDetailModal(parseInt(card.dataset.id)));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') openDetailModal(parseInt(card.dataset.id));
    });
    card.setAttribute('tabindex', '0');
  });
}

// ─────────────────────────────────────────
//  Confirm modal
// ─────────────────────────────────────────
let _confirmCallback = null;
let _lastSyncTime    = null;

function openConfirmModal({ title, message, btnLabel, btnCls, onConfirm }) {
  $('conf-title').textContent = title;
  $('conf-message').innerHTML = message;
  const btn = $('btn-conf-ok');
  btn.textContent = btnLabel;
  btn.className = btnCls;
  _confirmCallback = onConfirm;
  openModal('modal-confirmar');
}

function confirmAndMark(id, action) {
  const s = state.students.find(x => x.id === id) || state.allStudents.find(x => x.id === id);
  if (!s) return;
  if (action === 'found') {
    openConfirmModal({
      title:    'Confirmar aparición',
      message:  `¿Confirmas que <strong>${esc(s.nombre)}</strong> ha aparecido? Esto actualizará el estado público del caso de forma permanente.`,
      btnLabel: 'Sí, confirmar aparición',
      btnCls:   'btn-found',
      onConfirm: () => openFoundModal(id)
    });
  } else {
    openConfirmModal({
      title:    'Reportar fallecimiento',
      message:  `¿Confirmas el fallecimiento de <strong>${esc(s.nombre)}</strong>? Esta acción es permanente e irreversible. Asegúrate de que la información es correcta antes de continuar.`,
      btnLabel: 'Sí, reportar fallecimiento',
      btnCls:   'btn-deceased',
      onConfirm: () => openDeceasedModal(id)
    });
  }
}

// ─────────────────────────────────────────
//  Deep-link
// ─────────────────────────────────────────
function checkDeepLink() {
  const id = parseInt(new URLSearchParams(location.search).get('id'));
  if (id && state.allStudents.find(s => s.id === id)) openDetailModal(id);
}

// ─────────────────────────────────────────
//  OpenStreetMap / Nominatim Autocomplete (#11)
// ─────────────────────────────────────────
let _nominatimTid = null;

function osmEmbedUrl(lat, lon, delta = 0.005) {
  const bbox = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`;
}

function showMapPreview(lat, lon) {
  const preview = $('maps-preview');
  if (!preview) return;
  preview.style.display = 'block';
  preview.innerHTML = `<iframe class="maps-preview-frame" loading="lazy" src="${osmEmbedUrl(lat, lon)}" allowfullscreen></iframe>`;
}

function clearMapPreview() {
  $('des-lat').value = '';
  $('des-lng').value = '';
  const preview = $('maps-preview');
  if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
}

function initNominatimAutocomplete() {
  const input = $('des-ubicacion');
  if (!input) return;

  // Dropdown al body con position:fixed para escapar el overflow:auto del modal
  const dropdown = document.createElement('ul');
  dropdown.className = 'osm-dropdown';
  dropdown.setAttribute('role', 'listbox');
  document.body.appendChild(dropdown);

  function positionDropdown() {
    const r = input.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.top      = (r.bottom + 4) + 'px';
    dropdown.style.left     = r.left + 'px';
    dropdown.style.width    = r.width + 'px';
  }

  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !dropdown.contains(e.target))
      dropdown.style.display = 'none';
  });

  input.addEventListener('input', () => {
    clearMapPreview();
    clearTimeout(_nominatimTid);
    const q = input.value.trim();
    if (q.length < 3) { dropdown.style.display = 'none'; return; }

    _nominatimTid = setTimeout(async () => {
      try {
        const url = `/api/geocode?q=${encodeURIComponent(q)}`;
        const r = await fetch(url);
        const results = await r.json();
        if (!results.length) { dropdown.style.display = 'none'; return; }

        dropdown.innerHTML = results.map((res, i) =>
          `<li class="osm-item" role="option" data-idx="${i}"
               data-lat="${res.lat}" data-lon="${res.lon}"
               data-name="${esc(res.display_name)}">
            <svg class="osm-pin" viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/>
            </svg>
            <span>${esc(res.display_name)}</span>
          </li>`
        ).join('');
        positionDropdown();
        dropdown.style.display = 'block';

        dropdown.querySelectorAll('.osm-item').forEach(item => {
          item.addEventListener('mousedown', e => {
            e.preventDefault();
            const lat = parseFloat(item.dataset.lat);
            const lon = parseFloat(item.dataset.lon);
            input.value        = item.dataset.name;
            $('des-lat').value = lat;
            $('des-lng').value = lon;
            dropdown.style.display = 'none';
            showMapPreview(lat, lon);
          });
        });
      } catch (err) {
        console.error('[Nominatim]', err);
        dropdown.style.display = 'none';
      }
    }, 400);
  });

  input.addEventListener('blur', () => setTimeout(() => { dropdown.style.display = 'none'; }, 200));
}

function loadMapsAPI() { initNominatimAutocomplete(); }

// ─────────────────────────────────────────
//  Foto preview en formulario (#3)
// ─────────────────────────────────────────
function initFotoPreview() {
  const input = $('des-foto');
  if (!input) return;

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 100 * 1024) {
      toast('La foto debe pesar menos de 100 KB', 'error');
      input.value = '';
      return;
    }
    const url = URL.createObjectURL(file);
    $('foto-preview-img').src = url;
    $('foto-preview-name').textContent = file.name;
    $('foto-preview-wrap').style.display = 'flex';
    $('foto-label').style.display = 'none';
  });

  const removeBtn = $('foto-remove');
  if (removeBtn) removeBtn.addEventListener('click', () => {
    input.value = '';
    if ($('foto-preview-img').src) URL.revokeObjectURL($('foto-preview-img').src);
    $('foto-preview-wrap').style.display = 'none';
    $('foto-label').style.display = 'flex';
  });
}

// ─────────────────────────────────────────
//  Realtime polling (#1)
// ─────────────────────────────────────────
function updateSyncLabel() {
  const el = $('last-sync');
  if (!el || !_lastSyncTime) return;
  const ago = Math.floor((Date.now() - _lastSyncTime) / 1000);
  el.textContent = ago < 60
    ? '· actualizado hace un momento'
    : `· actualizado hace ${Math.floor(ago / 60)} min`;
}

async function poll() {
  try {
    const fresh      = await api.get('/api/estudiantes');
    const freshKey   = fresh.map(s => `${s.id}:${s.estado}`).sort().join(',');
    const currentKey = state.allStudents.map(s => `${s.id}:${s.estado}`).sort().join(',');
    const changed    = freshKey !== currentKey;
    state.allStudents = fresh;
    _lastSyncTime = Date.now();
    updateSyncLabel();
    if (changed) {
      applyFilters();
      await loadStats();
    }
  } catch {
    // silent — network errors during polling should not disrupt the UI
  }
}

function startRealtime() {
  _lastSyncTime = Date.now();
  updateSyncLabel();
  setInterval(poll, 60000);
  setInterval(updateSyncLabel, 30000);
}

// ─────────────────────────────────────────
//  Export CSV (#12)
// ─────────────────────────────────────────
function exportCSV() {
  const list = state.students;
  if (!list.length) { toast('No hay datos para exportar', 'info'); return; }

  const headers = [
    'Nombre', 'Cédula', 'Facultad', 'Carrera', 'Semestre',
    'Estado', 'Última ubicación', 'Fecha registro',
    'Contacto nombre', 'Teléfono contacto',
  ];
  const rows = list.map(s => [
    s.nombre,
    s.cedula            ?? '',
    s.facultad,
    s.carrera,
    s.semestre          ?? '',
    s.estado,
    s.ultima_ubicacion  ?? '',
    formatDate(s.fecha_registro),
    s.nombre_contacto   ?? '',
    s.telefono_contacto ?? '',
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `ucv-aparecidos-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast(`${list.length} registro${list.length !== 1 ? 's' : ''} exportado${list.length !== 1 ? 's' : ''}`, 'success');
}

// ─────────────────────────────────────────
//  Modal helpers + focus trap (D2/D3)
// ─────────────────────────────────────────
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
let _modalTrigger = null;

function openModal(id) {
  _modalTrigger = document.activeElement;
  const el = $(id);
  el.classList.add('open');
  el.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => {
    const first = el.querySelector(FOCUSABLE);
    if (first) first.focus();
  });
}

function closeModal(id) {
  const el = $(id);
  el.classList.remove('open');
  el.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  document.dispatchEvent(new CustomEvent('modalClosed', { detail: id }));
  if (_modalTrigger) { _modalTrigger.focus(); _modalTrigger = null; }
}

function trapFocus(overlay, e) {
  if (e.key !== 'Tab' || !overlay.classList.contains('open')) return;
  const focusable = [...overlay.querySelectorAll(FOCUSABLE)];
  if (!focusable.length) return;
  const first = focusable[0];
  const last  = focusable[focusable.length - 1];
  if (e.shiftKey) {
    if (document.activeElement === first) { e.preventDefault(); last.focus(); }
  } else {
    if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
  }
}

// ─────────────────────────────────────────
//  Detail modal
// ─────────────────────────────────────────
function openDetailModal(id) {
  const s = state.students.find(x => x.id === id);
  if (!s) return;

  const missing  = s.estado === 'desaparecido';
  const deceased = s.estado === 'fallecido';
  const found    = s.estado === 'aparecido';
  const conf     = s.tipo_confirmacion
    ? (deceased ? DEATH_CONF : CONF)[s.tipo_confirmacion]
    : null;

  const headerCls = found ? 'found-header' : '';
  $('m-det-header').className = `modal-header ${headerCls}`;
  if (deceased) {
    $('m-det-header').style.cssText = 'background:var(--slate-dim);border-bottom-color:rgba(155,181,200,.22)';
  } else {
    $('m-det-header').style.cssText = '';
  }
  $('m-det-title').textContent = s.nombre;

  $('modal-det-content').innerHTML = `
    ${s.foto_signed_url ? `
    <div class="det-foto-wrap">
      <img src="${s.foto_signed_url}" class="det-foto" alt="Foto de ${esc(s.nombre)}" loading="lazy">
    </div>` : ''}
    <div class="det-section">
      <div class="det-sec-title">Información académica</div>
      <div class="det-grid">
        <div class="det-field">
          <span class="det-fl">Facultad</span>
          <span class="det-fv">${esc(s.facultad)}</span>
        </div>
        <div class="det-field">
          <span class="det-fl">Carrera</span>
          <span class="det-fv">${esc(s.carrera)}</span>
        </div>
        <div class="det-field">
          <span class="det-fl">Cédula</span>
          <span class="det-fv mono">${s.cedula ? esc(s.cedula) : '<span class="empty">No registrada</span>'}</span>
        </div>
        <div class="det-field">
          <span class="det-fl">Semestre</span>
          <span class="det-fv">${s.semestre ? esc(s.semestre) : '<span class="empty">No especificado</span>'}</span>
        </div>
      </div>
    </div>

    <div class="det-section">
      <div class="det-sec-title">Última información conocida</div>
      ${(s.latitud && s.longitud) ? `
      <div class="det-map-wrap">
        <iframe class="det-map" loading="lazy"
          src="${osmEmbedUrl(s.latitud, s.longitud)}"
          allowfullscreen>
        </iframe>
        <a class="det-map-link" href="https://www.google.com/maps?q=${s.latitud},${s.longitud}" target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" fill="none" width="13" height="13"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M15 3h6v6M10 14L21 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Abrir en Google Maps
        </a>
      </div>` : ''}
      <div class="det-grid">
        <div class="det-field" style="grid-column:1/-1">
          <span class="det-fl">Última ubicación</span>
          <span class="det-fv">${s.ultima_ubicacion ? esc(s.ultima_ubicacion) : '<span class="empty">No especificada</span>'}${(!s.latitud && s.ultima_ubicacion) ? ` <a class="maps-search-link" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.ultima_ubicacion)}" target="_blank" rel="noopener noreferrer">Buscar en Maps ↗</a>` : ''}</span>
        </div>
        ${s.descripcion ? `
          <div class="det-field" style="grid-column:1/-1">
            <span class="det-fl">Descripción adicional</span>
            <span class="det-fv">${esc(s.descripcion)}</span>
          </div>` : ''}
        <div class="det-field">
          <span class="det-fl">Fecha de reporte</span>
          <span class="det-fv">${formatDate(s.fecha_registro)}</span>
        </div>
        ${s.registrado_por ? `
          <div class="det-field">
            <span class="det-fl">Registrado por</span>
            <span class="det-fv">${esc(s.registrado_por)}</span>
          </div>` : ''}
      </div>
    </div>

    ${s.nombre_contacto || s.telefono_contacto ? `
    <div class="det-section">
      <div class="det-sec-title">Contacto familiar</div>
      <div class="det-grid">
        ${s.nombre_contacto ? `<div class="det-field"><span class="det-fl">Nombre</span><span class="det-fv">${esc(s.nombre_contacto)}</span></div>` : ''}
        ${s.relacion_contacto ? `<div class="det-field"><span class="det-fl">Relación</span><span class="det-fv">${esc(s.relacion_contacto)}</span></div>` : ''}
        ${s.telefono_contacto ? `<div class="det-field" style="grid-column:1/-1"><span class="det-fl">Teléfono</span><span class="det-fv mono"><a href="tel:${esc(s.telefono_contacto)}" class="tel-link">${esc(s.telefono_contacto)}</a></span></div>` : ''}
      </div>
    </div>` : ''}

    ${found && conf ? `
    <div class="det-section">
      <div class="det-sec-title">Confirmación de aparición</div>
      <div class="det-conf-box">
        <div class="det-conf-head">
          <span style="font-size:20px" aria-hidden="true">${conf.icon}</span>
          <span class="conf-label">${conf.label}</span>
          <span class="det-conf-when">${formatDate(s.fecha_aparecio)}</span>
        </div>
        ${s.detalles_confirmacion ? `<p class="det-conf-text">"${esc(s.detalles_confirmacion)}"</p>` : ''}
        ${s.reportado_aparicion_por ? `
          <p class="det-conf-reporter">Reportado por: ${esc(s.reportado_aparicion_por)}${s.contacto_reportador ? ` · ${esc(s.contacto_reportador)}` : ''}</p>
        ` : ''}
      </div>
    </div>` : ''}

    ${deceased ? `
    <div class="det-section">
      <div class="det-sec-title" style="color:var(--slate)">Confirmación de fallecimiento</div>
      <div class="det-conf-box-deceased">
        <div class="det-conf-head">
          <span style="font-size:20px" aria-hidden="true">${conf ? conf.icon : '🕊️'}</span>
          <span class="conf-label-deceased">${conf ? conf.label : 'Confirmado'}</span>
          <span class="det-conf-when">${formatDate(s.fecha_aparecio)}</span>
        </div>
        ${s.detalles_confirmacion ? `<p class="det-conf-text">"${esc(s.detalles_confirmacion)}"</p>` : ''}
        ${s.reportado_aparicion_por ? `
          <p class="det-conf-reporter">Reportado por: ${esc(s.reportado_aparicion_por)}${s.contacto_reportador ? ` · ${esc(s.contacto_reportador)}` : ''}</p>
        ` : ''}
      </div>
    </div>` : ''}

    <div class="det-section">
      <div class="det-sec-title">Línea de tiempo</div>
      <div class="timeline">
        <div class="tl-item tl-register">
          <div class="tl-dot"></div>
          <div class="tl-content">
            <div class="tl-label">Caso registrado</div>
            <div class="tl-date">${formatDate(s.fecha_registro)}</div>
            ${s.registrado_por ? `<div class="tl-sub">por ${esc(s.registrado_por)}</div>` : ''}
          </div>
        </div>
        ${s.fecha_aparecio ? `
          <div class="tl-connector"></div>
          <div class="tl-item ${s.estado === 'aparecido' ? 'tl-aparecido' : 'tl-fallecido'}">
            <div class="tl-dot"></div>
            <div class="tl-content">
              <div class="tl-label">${s.estado === 'aparecido' ? 'Aparición confirmada' : 'Fallecimiento reportado'}</div>
              <div class="tl-date">${formatDate(s.fecha_aparecio)}</div>
              ${s.reportado_aparicion_por ? `<div class="tl-sub">por ${esc(s.reportado_aparicion_por)}</div>` : ''}
            </div>
          </div>
        ` : `
          <div class="tl-connector tl-connector-dashed"></div>
          <div class="tl-item tl-pending">
            <div class="tl-dot tl-dot-pending"></div>
            <div class="tl-content">
              <div class="tl-label">En búsqueda activa</div>
              <div class="tl-date">${timeAgo(s.fecha_registro)}</div>
            </div>
          </div>
        `}
      </div>
    </div>

    <div class="det-actions">
      ${missing ? `
        <button class="btn-found" id="det-btn-found" data-id="${s.id}">Marcar como aparecido</button>
        <button class="btn-deceased" id="det-btn-fall" data-id="${s.id}">Reportar fallecimiento</button>
      ` : ''}
      <button class="btn-secondary" id="det-btn-share" data-id="${s.id}" title="Compartir enlace a este caso">
        <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><circle cx="18" cy="5" r="3" stroke="currentColor" stroke-width="2"/><circle cx="6" cy="12" r="3" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="19" r="3" stroke="currentColor" stroke-width="2"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        Compartir
      </button>
      <button class="btn-secondary" data-close="modal-detalle">Cerrar</button>
    </div>
  `;

  $('modal-detalle').querySelectorAll('[data-close]').forEach(b =>
    b.addEventListener('click', () => closeModal(b.dataset.close))
  );
  const bf = $('det-btn-found');
  if (bf) bf.addEventListener('click', () => {
    closeModal('modal-detalle');
    confirmAndMark(parseInt(bf.dataset.id), 'found');
  });
  const bfall = $('det-btn-fall');
  if (bfall) bfall.addEventListener('click', () => {
    closeModal('modal-detalle');
    confirmAndMark(parseInt(bfall.dataset.id), 'deceased');
  });
  const bshare = $('det-btn-share');
  if (bshare) bshare.addEventListener('click', () => {
    const shareId = parseInt(bshare.dataset.id);
    const url = `${location.origin}${location.pathname}?id=${shareId}`;
    const nombre = state.allStudents.find(x => x.id === shareId)?.nombre || '';
    if (navigator.share) {
      navigator.share({ title: `UCV Aparecidos — ${nombre}`, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url)
        .then(() => toast('Enlace copiado al portapapeles', 'success'))
        .catch(() => toast('No se pudo copiar el enlace', 'error'));
    }
  });

  openModal('modal-detalle');
}

// ─────────────────────────────────────────
//  Found modal
// ─────────────────────────────────────────
function openFoundModal(id) {
  const s = state.students.find(x => x.id === id);
  if (!s) return;

  $('modal-apar-banner').innerHTML =
    `<strong>${esc(s.nombre)}</strong> · ${esc(s.facultad)} · ${esc(s.carrera)}`;

  $('form-aparecido').reset();
  $('fa-student-id').value = id;

  openModal('modal-aparecido');
}

// ─────────────────────────────────────────
//  Duplicate-name warning modal
// ─────────────────────────────────────────
function openDuplicateModal(existentes, onForce) {
  const list = $('dup-list');
  list.innerHTML = existentes.map(e => `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:.75rem 1rem;margin-bottom:.5rem">
      <strong>${esc(e.nombre)}</strong>
      <span class="tag ${e.estado === 'desaparecido' ? 'tag-missing' : e.estado === 'fallecido' ? 'tag-deceased' : 'tag-found'}" style="margin-left:.5rem">${e.estado}</span>
      <div style="font-size:.8rem;color:var(--text-sec);margin-top:.3rem">
        ${esc(e.facultad)} · ${esc(e.carrera)}${e.cedula ? ` · <span class="mono">${esc(e.cedula)}</span>` : ''}
      </div>
    </div>`).join('');

  // Rebind force button to avoid stacking listeners
  const old = $('btn-dup-force');
  const fresh = old.cloneNode(true);
  old.parentNode.replaceChild(fresh, old);
  fresh.addEventListener('click', () => { closeModal('modal-duplicado'); onForce(); });

  openModal('modal-duplicado');
}

// ─────────────────────────────────────────
//  Deceased modal
// ─────────────────────────────────────────
function openDeceasedModal(id) {
  const s = state.students.find(x => x.id === id);
  if (!s) return;

  $('modal-fall-banner').innerHTML =
    `<strong>${esc(s.nombre)}</strong> · ${esc(s.facultad)} · ${esc(s.carrera)}`;

  $('form-fallecido').reset();
  $('ffall-student-id').value = id;

  openModal('modal-fallecido');
}

// ─────────────────────────────────────────
//  Data loading
// ─────────────────────────────────────────
async function loadStats() {
  try {
    state.stats = await api.get('/api/stats');
    renderStats();
    renderFacultyBar();
  } catch {
    toast('No se pudieron cargar las estadísticas. Recarga la página.', 'error');
  }
}

function skeletonGrid() {
  return Array(6).fill(null).map(() => `
    <article class="s-card s-skeleton" aria-hidden="true">
      <div class="sk-header"></div>
      <div class="card-body">
        <div class="card-head">
          <div class="sk-avatar"></div>
          <div class="sk-info">
            <div class="sk-line sk-name"></div>
            <div class="sk-line sk-tag"></div>
            <div class="sk-line sk-career"></div>
          </div>
        </div>
        <div class="sk-line sk-detail"></div>
        <div class="sk-line sk-detail" style="width:52%"></div>
      </div>
      <div class="card-foot" style="border-top:1px solid var(--border)">
        <div class="sk-line" style="height:34px;border-radius:6px;flex:1"></div>
      </div>
    </article>`).join('');
}

async function loadStudents() {
  $('students-grid').innerHTML = skeletonGrid();
  try {
    state.allStudents = await api.get('/api/estudiantes');
    applyFilters();
  } catch (err) {
    $('students-grid').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h3>Error al cargar</h3>
        <p>${esc(err.message)}</p>
      </div>`;
  }
}

async function loadFacultades() {
  try {
    state.facultades = await api.get('/api/facultades');
    const opts = Object.keys(state.facultades).map(f =>
      `<option value="${esc(f)}">${esc(f)}</option>`
    ).join('');
    $('filter-facultad').insertAdjacentHTML('beforeend', opts);
    $('ff-facultad').insertAdjacentHTML('beforeend', opts);
  } catch {
    toast('No se pudo cargar el catálogo de facultades. Recarga la página.', 'error');
  }
}

// ─────────────────────────────────────────
//  Career select helper
// ─────────────────────────────────────────
function updateCareerSelect(selectId, facultad) {
  const sel = $(selectId);
  sel.innerHTML = `<option value="">${selectId === 'filter-carrera' ? 'Todas las carreras' : 'Seleccionar carrera'}</option>`;
  if (facultad && state.facultades[facultad]) {
    sel.disabled = false;
    state.facultades[facultad].forEach(c => {
      const o = document.createElement('option');
      o.value = c; o.textContent = c;
      sel.appendChild(o);
    });
  } else {
    sel.disabled = true;
  }
}

// ─────────────────────────────────────────
//  Toast
// ─────────────────────────────────────────
function toast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  $('toast-container').appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 4200);
}

// ─────────────────────────────────────────
//  Form: register missing
// ─────────────────────────────────────────
async function submitDesaparecido(form, forzar = false) {
  const btn = $('btn-submit-des');
  btn.disabled = true; btn.textContent = 'Registrando…';

  const fd = new FormData(form);
  if (forzar) fd.set('forzar', 'true');

  try {
    const r = await fetch('/api/estudiantes', { method: 'POST', body: fd });
    const data = await r.json();
    if (!r.ok) {
      const err = new Error(data.error || `HTTP ${r.status}`);
      if (data.tipo)      err.tipo      = data.tipo;
      if (data.existente) err.existente = data.existente;
      if (data.existentes) err.existentes = data.existentes;
      throw err;
    }
    closeModal('modal-desaparecido');
    form.reset();
    $('ff-carrera').disabled = true;
    $('foto-preview-wrap').style.display = 'none';
    $('foto-label').style.display = 'flex';
    toast('Estudiante registrado. La comunidad UCV está buscando.', 'info');
    await Promise.all([loadStudents(), loadStats()]);
  } catch (err) {
    if (err.tipo === 'cedula_duplicada') {
      const ex = err.existente;
      toast(`Cédula ya registrada: ${ex.nombre} (${ex.estado}) — ${ex.facultad}`, 'error');
    } else if (err.tipo === 'nombre_duplicado') {
      openDuplicateModal(err.existentes, () => submitDesaparecido(form, true));
    } else {
      toast('Error: ' + err.message, 'error');
    }
  } finally {
    btn.disabled = false; btn.textContent = 'Registrar estudiante';
  }
}

$('form-desaparecido').addEventListener('submit', e => {
  e.preventDefault();
  if (!validateRequired(e.target, ['nombre', 'facultad', 'carrera'])) return;
  submitDesaparecido(e.target);
});

// ─────────────────────────────────────────
//  Form: confirm found
// ─────────────────────────────────────────
$('form-aparecido').addEventListener('submit', async e => {
  e.preventDefault();
  if (!validateRequired(e.target, ['tipo_confirmacion'])) return;
  const btn = $('btn-submit-apar');
  btn.disabled = true; btn.textContent = 'Confirmando…';

  const fd  = new FormData(e.target);
  const id  = fd.get('student_id');
  const data = {
    tipo_confirmacion:      fd.get('tipo_confirmacion'),
    detalles_confirmacion:  fd.get('detalles_confirmacion'),
    reportado_aparicion_por: fd.get('reportado_aparicion_por'),
    contacto_reportador:    fd.get('contacto_reportador')
  };
  try {
    await api.put(`/api/estudiantes/${id}/aparecio`, data);
    closeModal('modal-aparecido');
    e.target.reset();
    toast('¡Aparición confirmada! Una buena noticia para todos. 🎉', 'success');
    await Promise.all([loadStudents(), loadStats()]);
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Confirmar aparición';
  }
});

// ─────────────────────────────────────────
//  Form: report deceased
// ─────────────────────────────────────────
$('form-fallecido').addEventListener('submit', async e => {
  e.preventDefault();
  if (!validateRequired(e.target, ['tipo_confirmacion_deceso'])) return;
  const btn = $('btn-submit-fall');
  btn.disabled = true; btn.textContent = 'Confirmando…';

  const fd = new FormData(e.target);
  const id = fd.get('student_id');
  const data = {
    tipo_confirmacion_deceso: fd.get('tipo_confirmacion_deceso'),
    detalles_confirmacion:    fd.get('detalles_confirmacion'),
    reportado_aparicion_por:  fd.get('reportado_aparicion_por'),
    contacto_reportador:      fd.get('contacto_reportador')
  };
  try {
    await api.put(`/api/estudiantes/${id}/fallecio`, data);
    closeModal('modal-fallecido');
    e.target.reset();
    toast('Fallecimiento registrado. Q.E.P.D.', 'info');
    await Promise.all([loadStudents(), loadStats()]);
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Confirmar fallecimiento';
  }
});

// ─────────────────────────────────────────
//  Event bindings
// ─────────────────────────────────────────
function bindEvents() {
  // Open missing modal
  $('btn-reportar-desaparecido').addEventListener('click', () => openModal('modal-desaparecido'));

  // Close buttons via data-close
  document.querySelectorAll('[data-close]').forEach(btn =>
    btn.addEventListener('click', () => closeModal(btn.dataset.close))
  );

  // Close on overlay click + focus trap
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay.id); });
    overlay.addEventListener('keydown', e => trapFocus(overlay, e));
  });

  // ESC key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape')
      document.querySelectorAll('.modal-overlay.open').forEach(o => closeModal(o.id));
  });

  // Search filter — debounce corto porque filtra en el cliente
  let searchTid;
  $('filter-q').addEventListener('input', e => {
    clearTimeout(searchTid);
    searchTid = setTimeout(() => { state.filters.q = e.target.value; applyFilters(); }, 150);
  });

  // Faculty filter
  $('filter-facultad').addEventListener('change', e => {
    state.filters.facultad = e.target.value;
    state.filters.carrera  = '';
    updateCareerSelect('filter-carrera', state.filters.facultad);
    renderFacultyBar();
    applyFilters();
  });

  // Career filter
  $('filter-carrera').addEventListener('change', e => {
    state.filters.carrera = e.target.value;
    applyFilters();
  });

  // Status tabs (only [data-estado] buttons — excluye tab-contact)
  document.querySelectorAll('.tab-btn[data-estado]').forEach(btn =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn[data-estado]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filters.estado = btn.dataset.estado;
      applyFilters();
    })
  );

  // Con contacto toggle
  const btnContact = $('btn-con-contacto');
  if (btnContact) {
    btnContact.addEventListener('click', () => {
      state.filters.con_contacto = !state.filters.con_contacto;
      btnContact.classList.toggle('active', state.filters.con_contacto);
      btnContact.setAttribute('aria-pressed', state.filters.con_contacto ? 'true' : 'false');
      applyFilters();
    });
  }

  // Sort
  const sortSel = $('filter-sort');
  if (sortSel) {
    sortSel.addEventListener('change', e => {
      state.filters.sort = e.target.value;
      applyFilters();
    });
  }

  // Theme toggle
  const btnTheme = $('btn-theme');
  if (btnTheme) {
    btnTheme.addEventListener('click', () => {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      const next = isLight ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('ucv-theme', next);
      btnTheme.setAttribute('aria-label', next === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
    });
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    btnTheme.setAttribute('aria-label', isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
  }

  // Confirm modal OK button
  const btnConfOk = $('btn-conf-ok');
  if (btnConfOk) {
    btnConfOk.addEventListener('click', () => {
      closeModal('modal-confirmar');
      if (_confirmCallback) { _confirmCallback(); _confirmCallback = null; }
    });
  }

  // Export CSV
  const btnExport = $('btn-export-csv');
  if (btnExport) btnExport.addEventListener('click', exportCSV);

  // Form: facultad → carrera cascade
  $('ff-facultad').addEventListener('change', e =>
    updateCareerSelect('ff-carrera', e.target.value)
  );

  // Foto preview
  initFotoPreview();
}

// ─────────────────────────────────────────
//  Validación en cliente
// ─────────────────────────────────────────
function validateRequired(form, fieldNames) {
  let valid = true;
  fieldNames.forEach(name => {
    const el = form.querySelector(`[name="${name}"]`);
    if (!el) return;
    const empty = !el.value.trim();
    el.classList.toggle('input-error', empty);
    if (empty) {
      valid = false;
      const clear = () => el.classList.remove('input-error');
      el.addEventListener('input',  clear, { once: true });
      el.addEventListener('change', clear, { once: true });
    }
  });
  if (!valid) {
    const first = form.querySelector('.input-error');
    if (first) first.focus();
  }
  return valid;
}

// ─────────────────────────────────────────
//  Normalización de cédula en tiempo real
// ─────────────────────────────────────────
document.querySelectorAll('input[name="cedula"]').forEach(input => {
  input.addEventListener('input', () => {
    const pos = input.selectionStart;
    const clean = input.value.replace(/\D/g, '').slice(0, 9);
    if (input.value !== clean) {
      input.value = clean;
      // Restaurar posición del cursor
      input.setSelectionRange(Math.min(pos, clean.length), Math.min(pos, clean.length));
    }
  });
});

// ─────────────────────────────────────────
//  Init
// ─────────────────────────────────────────
async function init() {
  await loadFacultades();
  await Promise.all([loadStudents(), loadStats(), loadMapsAPI()]);
  bindEvents();
  checkDeepLink();
  startRealtime();
}

init().catch(console.error);
