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
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
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
  students: [],
  stats: null,
  filters: { q: '', facultad: '', carrera: '', estado: '' }
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
  'Ciencias':                     'tag-f-ciencias',
  'Medicina':                     'tag-f-medicina',
  'Ingeniería':                   'tag-f-ingenieria',
  'Derecho':                      'tag-f-derecho',
  'Humanidades y Educación':      'tag-f-humanidades',
  'Arquitectura y Urbanismo':     'tag-f-arquit',
  'Ciencias Económicas y Sociales': 'tag-f-faces',
};

// ─────────────────────────────────────────
//  Utilities
// ─────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
      loadStudents();
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
        <div class="card-avatar ${avatarClass}" aria-hidden="true">${av}</div>
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
//  Render: grid
// ─────────────────────────────────────────
function renderGrid() {
  const grid = $('students-grid');
  if (!state.students.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon" aria-hidden="true">🔍</div>
        <h3>No se encontraron estudiantes</h3>
        <p>Prueba con otros filtros o registra un nuevo caso.</p>
      </div>`;
    return;
  }

  grid.innerHTML = state.students.map(renderCard).join('');

  grid.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      if (btn.dataset.action === 'detail') openDetailModal(id);
      if (btn.dataset.action === 'found')  openFoundModal(id);
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
//  Modal helpers
// ─────────────────────────────────────────
function openModal(id) {
  const el = $(id);
  el.classList.add('open');
  el.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const el = $(id);
  el.classList.remove('open');
  el.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  document.dispatchEvent(new CustomEvent('modalClosed', { detail: id }));
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
      <div class="det-grid">
        <div class="det-field" style="grid-column:1/-1">
          <span class="det-fl">Última ubicación</span>
          <span class="det-fv">${s.ultima_ubicacion ? esc(s.ultima_ubicacion) : '<span class="empty">No especificada</span>'}</span>
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
        ${s.telefono_contacto ? `<div class="det-field" style="grid-column:1/-1"><span class="det-fl">Teléfono</span><span class="det-fv mono">${esc(s.telefono_contacto)}</span></div>` : ''}
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

    <div class="det-actions">
      ${missing ? `
        <button class="btn-found" id="det-btn-found" data-id="${s.id}">Marcar como aparecido</button>
        <button class="btn-deceased" id="det-btn-fall" data-id="${s.id}">Reportar fallecimiento</button>
      ` : ''}
      <button class="btn-secondary" data-close="modal-detalle">Cerrar</button>
    </div>
  `;

  $('modal-detalle').querySelectorAll('[data-close]').forEach(b =>
    b.addEventListener('click', () => closeModal(b.dataset.close))
  );
  const bf = $('det-btn-found');
  if (bf) bf.addEventListener('click', () => {
    closeModal('modal-detalle');
    openFoundModal(parseInt(bf.dataset.id));
  });
  const bfall = $('det-btn-fall');
  if (bfall) bfall.addEventListener('click', () => {
    closeModal('modal-detalle');
    openDeceasedModal(parseInt(bfall.dataset.id));
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
  } catch { /* silent */ }
}

async function loadStudents() {
  const grid = $('students-grid');
  grid.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Cargando…</p></div>';

  const p = new URLSearchParams();
  if (state.filters.q)       p.set('q',       state.filters.q);
  if (state.filters.facultad) p.set('facultad', state.filters.facultad);
  if (state.filters.carrera)  p.set('carrera',  state.filters.carrera);
  if (state.filters.estado)   p.set('estado',   state.filters.estado);

  try {
    state.students = await api.get(`/api/estudiantes?${p}`);
    renderGrid();
  } catch (err) {
    grid.innerHTML = `
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
  } catch { /* silent */ }
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
$('form-desaparecido').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('btn-submit-des');
  btn.disabled = true; btn.textContent = 'Registrando…';

  const data = Object.fromEntries(new FormData(e.target));
  try {
    await api.post('/api/estudiantes', data);
    closeModal('modal-desaparecido');
    e.target.reset();
    $('ff-carrera').disabled = true;
    toast('Estudiante registrado. La comunidad UCV está buscando.', 'info');
    await Promise.all([loadStudents(), loadStats()]);
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Registrar estudiante';
  }
});

// ─────────────────────────────────────────
//  Form: confirm found
// ─────────────────────────────────────────
$('form-aparecido').addEventListener('submit', async e => {
  e.preventDefault();
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
//  Import Excel modal
// ─────────────────────────────────────────
(function initImport() {
  let selectedFile = null;

  const dropzone   = $('imp-dropzone');
  const fileInput  = $('imp-file-input');
  const fileLabel  = $('imp-dz-file');
  const fileName   = $('imp-file-name');
  const removeBtn  = $('imp-remove-file');
  const importBtn  = $('btn-do-import');
  const results    = $('imp-results');

  function setFile(file) {
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      toast('Solo se aceptan archivos .xlsx o .xls', 'error');
      return;
    }
    selectedFile = file;
    fileName.textContent = file.name;
    fileLabel.style.display = 'flex';
    importBtn.disabled = false;
    results.style.display = 'none';
  }

  function clearFile() {
    selectedFile = null;
    fileInput.value = '';
    fileLabel.style.display = 'none';
    importBtn.disabled = true;
    results.style.display = 'none';
  }

  dropzone.addEventListener('click', e => {
    if (e.target === removeBtn) return;
    fileInput.click();
  });
  dropzone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') fileInput.click();
  });
  fileInput.addEventListener('change', () => setFile(fileInput.files[0]));
  removeBtn.addEventListener('click', e => { e.stopPropagation(); clearFile(); });

  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    setFile(e.dataTransfer.files[0]);
  });

  importBtn.addEventListener('click', async () => {
    if (!selectedFile) return;
    importBtn.disabled = true;
    importBtn.classList.add('btn-loading');
    importBtn.textContent = 'Importando…';
    results.style.display = 'none';

    const fd = new FormData();
    fd.append('archivo', selectedFile);

    try {
      const r = await fetch('/api/importar', { method: 'POST', body: fd });
      const data = await r.json();

      results.style.display = 'block';
      if (!r.ok) {
        results.className = 'imp-results error';
        results.innerHTML = `
          <div class="imp-res-title err">Error al importar</div>
          <div class="imp-res-body">${esc(data.error)}</div>
          ${data.errores?.length ? `<ul class="imp-errors-list">${data.errores.map(e => `<li>Fila ${e.fila}: ${esc(e.motivo)}</li>`).join('')}</ul>` : ''}`;
        return;
      }

      const { importados, omitidos, errores } = data;
      const cls    = omitidos > 0 ? 'partial' : 'success';
      const tCls   = omitidos > 0 ? 'warn' : 'ok';
      results.className = `imp-results ${cls}`;
      results.innerHTML = `
        <div class="imp-res-title ${tCls}">${importados} estudiante${importados !== 1 ? 's' : ''} importado${importados !== 1 ? 's' : ''} correctamente</div>
        <div class="imp-res-body">${omitidos > 0 ? `${omitidos} fila${omitidos !== 1 ? 's' : ''} omitida${omitidos !== 1 ? 's' : ''} por falta de datos requeridos.` : 'Todos los registros fueron importados sin problemas.'}</div>
        ${errores?.length ? `<ul class="imp-errors-list">${errores.map(e => `<li>Fila ${e.fila}: ${esc(e.motivo)}</li>`).join('')}</ul>` : ''}`;

      if (importados > 0) {
        toast(`${importados} estudiante${importados !== 1 ? 's' : ''} importado${importados !== 1 ? 's' : ''} exitosamente.`, 'success');
        clearFile();
        await Promise.all([loadStudents(), loadStats()]);
      }
    } catch (err) {
      results.style.display = 'block';
      results.className = 'imp-results error';
      results.innerHTML = `<div class="imp-res-title err">Error de red</div><div class="imp-res-body">${esc(err.message)}</div>`;
    } finally {
      importBtn.disabled = !selectedFile;
      importBtn.classList.remove('btn-loading');
      importBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" width="15" height="15"><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12M8 12l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Importar estudiantes`;
    }
  });

  // Reset modal state when closed
  document.addEventListener('modalClosed', e => {
    if (e.detail === 'modal-importar') { clearFile(); results.style.display = 'none'; }
  });
})();

// ─────────────────────────────────────────
//  Event bindings
// ─────────────────────────────────────────
function bindEvents() {
  // Open missing modal
  $('btn-reportar-desaparecido').addEventListener('click', () => openModal('modal-desaparecido'));
  $('btn-importar-excel').addEventListener('click', () => openModal('modal-importar'));

  // Close buttons via data-close
  document.querySelectorAll('[data-close]').forEach(btn =>
    btn.addEventListener('click', () => closeModal(btn.dataset.close))
  );

  // Close on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay =>
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay.id); })
  );

  // ESC key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape')
      document.querySelectorAll('.modal-overlay.open').forEach(o => closeModal(o.id));
  });

  // Search filter (debounced)
  let searchTid;
  $('filter-q').addEventListener('input', e => {
    clearTimeout(searchTid);
    searchTid = setTimeout(() => { state.filters.q = e.target.value; loadStudents(); }, 320);
  });

  // Faculty filter
  $('filter-facultad').addEventListener('change', e => {
    state.filters.facultad = e.target.value;
    state.filters.carrera  = '';
    updateCareerSelect('filter-carrera', state.filters.facultad);
    renderFacultyBar();
    loadStudents();
  });

  // Career filter
  $('filter-carrera').addEventListener('change', e => {
    state.filters.carrera = e.target.value;
    loadStudents();
  });

  // Status tabs
  document.querySelectorAll('.tab-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filters.estado = btn.dataset.estado;
      loadStudents();
    })
  );

  // Form: facultad → carrera cascade
  $('ff-facultad').addEventListener('change', e =>
    updateCareerSelect('ff-carrera', e.target.value)
  );
}

// ─────────────────────────────────────────
//  Init
// ─────────────────────────────────────────
async function init() {
  await loadFacultades();
  await Promise.all([loadStudents(), loadStats()]);
  bindEvents();
}

init().catch(console.error);
