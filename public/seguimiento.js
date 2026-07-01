'use strict';

let chartInstance = null;
let statsCache    = null;

function fmt(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })
    + ' ' + d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
}

function delta(curr, prev, key) {
  if (!prev) return '<span class="delta-neu">—</span>';
  const diff = curr[key] - prev[key];
  if (diff === 0) return '<span class="delta-neu">0</span>';
  // Para desaparecidos: bajar es bueno (verde); para aparecidos/fallecidos: subir puede ser bueno o malo
  const isGoodDown = key === 'desaparecidos';
  const isPos = diff > 0;
  const cls = (isGoodDown ? !isPos : isPos) ? 'delta-pos' : 'delta-neg';
  return `<span class="${cls}">${isPos ? '+' : ''}${diff}</span>`;
}

function renderKPIs(snaps) {
  const grid = document.getElementById('kpi-grid');
  if (!snaps.length) { grid.innerHTML = '<p style="color:var(--text-muted)">Sin datos aún.</p>'; return; }

  const first = snaps[0];
  const last  = snaps[snaps.length - 1];

  const aparecieronTotal = last.aparecidos - first.aparecidos;
  const fallecieronTotal = last.fallecidos - first.fallecidos;

  const cards = [
    {
      label: 'Desaparecidos actuales',
      val: last.desaparecidos,
      cls: 'color-red',
      note: snaps.length > 1
        ? `${last.desaparecidos - first.desaparecidos > 0 ? '+' : ''}${last.desaparecidos - first.desaparecidos} desde el inicio`
        : 'Primer registro',
    },
    {
      label: 'Aparecidos totales',
      val: last.aparecidos,
      cls: 'color-green',
      note: snaps.length > 1 ? `+${aparecieronTotal} desde el inicio` : 'Primer registro',
    },
    {
      label: 'Fallecidos confirmados',
      val: last.fallecidos,
      cls: 'color-slate',
      note: snaps.length > 1 ? `+${fallecieronTotal} desde el inicio` : 'Primer registro',
    },
    {
      label: 'Total registrados',
      val: last.total,
      cls: 'color-amber',
      note: `${snaps.length} snapshot${snaps.length !== 1 ? 's' : ''} registrados`,
    },
  ];

  grid.innerHTML = cards.map(c => `
    <div class="kpi-card">
      <div class="kpi-label">${c.label}</div>
      <div class="kpi-val ${c.cls}">${c.val}</div>
      <div class="kpi-delta">${c.note}</div>
    </div>
  `).join('');
}

function renderChart(snaps) {
  if (typeof Chart === 'undefined') {
    document.getElementById('chart').closest('.chart-wrap').innerHTML =
      '<p style="color:var(--text-muted);text-align:center;padding:60px 24px">Gráfica no disponible — Chart.js no cargó (sin conexión o CDN bloqueado)</p>';
    return;
  }
  const labels = snaps.map(s => fmt(s.tomado_en));
  const ctx = document.getElementById('chart').getContext('2d');

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Desaparecidos',
          data: snaps.map(s => s.desaparecidos),
          borderColor: '#E05A5A',
          backgroundColor: 'rgba(224,90,90,.08)',
          tension: .35,
          fill: true,
          pointRadius: snaps.length < 20 ? 4 : 2,
        },
        {
          label: 'Aparecidos',
          data: snaps.map(s => s.aparecidos),
          borderColor: '#4CAF82',
          backgroundColor: 'rgba(76,175,130,.08)',
          tension: .35,
          fill: true,
          pointRadius: snaps.length < 20 ? 4 : 2,
        },
        {
          label: 'Fallecidos',
          data: snaps.map(s => s.fallecidos),
          borderColor: '#9BB5C8',
          backgroundColor: 'rgba(155,181,200,.08)',
          tension: .35,
          fill: true,
          pointRadius: snaps.length < 20 ? 4 : 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: '#BACDD8', boxWidth: 12, padding: 20, font: { size: 12 } },
        },
        tooltip: {
          backgroundColor: '#142233',
          borderColor: 'rgba(155,181,200,.2)',
          borderWidth: 1,
          titleColor: '#E8F0F7',
          bodyColor: '#BACDD8',
        },
      },
      scales: {
        x: {
          ticks: { color: '#7A98B4', font: { size: 11 }, maxRotation: 45 },
          grid:  { color: 'rgba(155,181,200,.07)' },
        },
        y: {
          ticks: { color: '#7A98B4', font: { size: 11 } },
          grid:  { color: 'rgba(155,181,200,.07)' },
          beginAtZero: false,
        },
      },
    },
  });
}

function renderTable(snaps) {
  const tbody = document.getElementById('tbl-body');
  if (!snaps.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:30px">Sin snapshots aún</td></tr>';
    return;
  }

  tbody.innerHTML = [...snaps].reverse().map((s, i, arr) => {
    const prev = arr[i + 1] || null;
    return `
      <tr>
        <td style="color:var(--text-muted)">${snaps.length - i}</td>
        <td>${fmt(s.tomado_en)}</td>
        <td class="color-red">${s.desaparecidos}</td>
        <td>${delta(s, prev, 'desaparecidos')}</td>
        <td class="color-green">${s.aparecidos}</td>
        <td>${delta(s, prev, 'aparecidos')}</td>
        <td class="color-slate">${s.fallecidos}</td>
        <td>${delta(s, prev, 'fallecidos')}</td>
        <td style="color:var(--text-muted)">${s.total}</td>
      </tr>
    `;
  }).join('');
}

async function load() {
  const loadingEl = document.getElementById('loading');
  const contentEl = document.getElementById('content');
  loadingEl.style.display = 'block';
  contentEl.style.display = 'none';

  try {
    const res = await fetch('/api/snapshots');
    if (!res.ok) throw new Error(`Error del servidor (HTTP ${res.status})`);
    const data = await res.json();

    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';

    if (data.length) {
      document.getElementById('last-update').textContent =
        'Último snapshot: ' + fmt(data[data.length - 1].tomado_en);
    }

    renderKPIs(data);
    try { renderChart(data); } catch { /* gráfica falla sin bloquear la tabla */ }
    renderTable(data);
  } catch (err) {
    loadingEl.innerHTML = `
      <p style="color:#E05A5A;font-size:14px">
        Error al cargar datos: ${err.message}
      </p>
      <button onclick="load()" style="margin-top:12px;padding:8px 16px;background:#142233;
        color:#BACDD8;border:1px solid rgba(155,181,200,.2);border-radius:8px;cursor:pointer;">
        Reintentar
      </button>`;
  }
}

document.getElementById('btn-snapshot').addEventListener('click', async () => {
  const btn   = document.getElementById('btn-snapshot');
  const token = document.getElementById('admin-token').value.trim();

  if (!token) {
    document.getElementById('admin-token').focus();
    document.getElementById('admin-token').style.borderColor = '#E05A5A';
    setTimeout(() => { document.getElementById('admin-token').style.borderColor = ''; }, 2000);
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Tomando…';

  try {
    const res = await fetch('/api/snapshots/tomar', {
      method: 'POST',
      headers: { 'x-admin-token': token },
    });

    if (res.status === 401) {
      document.getElementById('admin-token').style.borderColor = '#E05A5A';
      alert('Token incorrecto.');
      return;
    }

    if (!res.ok) throw new Error(`Error del servidor (HTTP ${res.status})`);

    await load();
  } catch (err) {
    alert('Error al tomar snapshot: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '+ Tomar snapshot ahora';
  }
});

document.getElementById('btn-refresh').addEventListener('click', () => { load(); loadFacultades(); });

function generarCanvas(stats) {
  const { porFacultad, desaparecidos: totalDesp, aparecidos: totalApar, fallecidos: totalFall } = stats;

  const S      = 2;     // retina scale
  const W      = 520;   // logical width px
  const pad    = 22;
  const tableW = W - pad * 2;
  const c0     = 220;                            // Facultad column
  const cW     = Math.floor((tableW - c0) / 3); // each stat column
  const lastCW = tableW - c0 - cW * 2;           // last col absorbs rounding

  const rowH  = 30;
  const hdrH  = 38;
  const footH = 34;
  // title: 24px line + 16px subtitle + 8px gap before header
  const H = pad + 24 + 16 + 8 + hdrH + rowH * porFacultad.length + hdrH + footH + pad;

  const canvas = document.createElement('canvas');
  canvas.width  = W * S;
  canvas.height = H * S;
  const ctx = canvas.getContext('2d');
  ctx.scale(S, S);

  function mid(y, h) { return y + h / 2; }
  function clamp(text, maxPx) {
    if (ctx.measureText(text).width <= maxPx) return text;
    while (text.length > 1 && ctx.measureText(text + '…').width > maxPx) text = text.slice(0, -1);
    return text + '…';
  }

  // Background + border
  ctx.fillStyle = '#0D1B2A';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(155,181,200,0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

  // Title row
  let y = pad;
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = '#E8A838';
  ctx.textAlign = 'left';
  ctx.fillText('UCV Aparecidos', pad, mid(y, 24));
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillStyle = '#7A98B4';
  ctx.textAlign = 'right';
  ctx.fillText(new Date().toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' }), W - pad, mid(y, 24));
  y += 24;

  // Subtitle
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillStyle = '#9BB5C8';
  ctx.textAlign = 'left';
  ctx.fillText('Resumen por facultad · estado actual', pad, mid(y, 16));
  y += 16 + 8;

  // Separator
  ctx.strokeStyle = 'rgba(155,181,200,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();

  // Column x origins
  const colX = [pad + c0, pad + c0 + cW, pad + c0 + cW * 2];

  // Header row
  ctx.fillStyle = '#142233';
  ctx.fillRect(pad, y, tableW, hdrH);
  const hMid = mid(y, hdrH);
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#7A98B4';
  ctx.fillText('FACULTAD', pad + 10, hMid);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#4CAF82'; ctx.fillText('ENCONTRADOS',  colX[0] + cW / 2,    hMid);
  ctx.fillStyle = '#E05A5A'; ctx.fillText('DESAPARECIDOS', colX[1] + cW / 2,   hMid);
  ctx.fillStyle = '#9BB5C8'; ctx.fillText('FALLECIDOS',   colX[2] + lastCW / 2, hMid);
  ctx.strokeStyle = 'rgba(155,181,200,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad, y + hdrH); ctx.lineTo(pad + tableW, y + hdrH); ctx.stroke();
  y += hdrH;

  // Data rows
  for (let i = 0; i < porFacultad.length; i++) {
    const f    = porFacultad[i];
    const ry   = y + i * rowH;
    const rMid = mid(ry, rowH);

    if (i % 2 === 1) {
      ctx.fillStyle = 'rgba(155,181,200,0.04)';
      ctx.fillRect(pad, ry, tableW, rowH);
    }
    ctx.textBaseline = 'middle';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = '#BACDD8';
    ctx.textAlign = 'left';
    ctx.fillText(clamp(f.facultad, c0 - 22), pad + 10, rMid);
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#4CAF82'; ctx.fillText(f.aparecidos,    colX[0] + cW / 2,    rMid);
    ctx.fillStyle = '#E05A5A'; ctx.fillText(f.desaparecidos, colX[1] + cW / 2,    rMid);
    ctx.fillStyle = '#9BB5C8'; ctx.fillText(f.fallecidos,    colX[2] + lastCW / 2, rMid);
    ctx.strokeStyle = 'rgba(155,181,200,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad, ry + rowH); ctx.lineTo(pad + tableW, ry + rowH); ctx.stroke();
  }
  y += rowH * porFacultad.length;

  // Totals row
  ctx.fillStyle = 'rgba(232,168,56,0.1)';
  ctx.fillRect(pad, y, tableW, hdrH);
  ctx.strokeStyle = 'rgba(232,168,56,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(pad + tableW, y); ctx.stroke();
  const tMid = mid(y, hdrH);
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#E8A838';
  ctx.fillText('TOTAL', pad + 10, tMid);
  ctx.textAlign = 'center';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillStyle = '#4CAF82'; ctx.fillText(totalApar, colX[0] + cW / 2,    tMid);
  ctx.fillStyle = '#E05A5A'; ctx.fillText(totalDesp, colX[1] + cW / 2,    tMid);
  ctx.fillStyle = '#9BB5C8'; ctx.fillText(totalFall, colX[2] + lastCW / 2, tMid);
  y += hdrH;

  // Footer
  ctx.fillStyle = 'rgba(155,181,200,0.05)';
  ctx.fillRect(0, y, W, footH + pad);
  ctx.strokeStyle = 'rgba(155,181,200,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  const fMid = mid(y, footH + pad);
  ctx.font = '9px system-ui, sans-serif';
  ctx.fillStyle = '#7A98B4';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('Universidad Central de Venezuela', pad, fMid);
  ctx.textAlign = 'right';
  ctx.fillText('ucvaparecidos.vercel.app', W - pad, fMid);

  return canvas;
}

document.getElementById('btn-compartir').addEventListener('click', async () => {
  const btn = document.getElementById('btn-compartir');
  if (!statsCache) { alert('Datos no cargados aún.'); return; }

  btn.disabled = true;
  btn.textContent = 'Generando…';

  try {
    const canvas = generarCanvas(statsCache);
    const blob   = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const file   = new File([blob], 'ucv-aparecidos-facultades.png', { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ title: 'UCV Aparecidos — Resumen por Facultad', files: [file] });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'ucv-aparecidos-facultades.png'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
  } catch (err) {
    if (err.name !== 'AbortError') alert('No se pudo generar la imagen: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '&#128248; Compartir';
  }
});

async function loadFacultades() {
  const loadEl = document.getElementById('facultades-loading');
  const wrapEl = document.getElementById('facultades-wrap');
  loadEl.style.display = 'block';
  wrapEl.style.display = 'none';

  try {
    const res = await fetch('/api/stats');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const { porFacultad, total, desaparecidos, aparecidos, fallecidos } = json;
    statsCache = json;

    const tbody = document.getElementById('tbl-facultades-body');
    const tfoot = document.getElementById('tbl-facultades-foot');

    tbody.innerHTML = porFacultad.map(f => `
      <tr>
        <td style="font-weight:600;color:var(--text)">${f.facultad}</td>
        <td class="color-red" data-label="Desaparecidos">${f.desaparecidos}</td>
        <td class="color-green" data-label="Encontrados">${f.aparecidos}</td>
        <td class="color-slate" data-label="Fallecidos">${f.fallecidos}</td>
        <td style="color:var(--text-muted)" data-label="Total">${f.total}</td>
      </tr>
    `).join('');

    tfoot.innerHTML = `
      <tr style="border-top:1px solid rgba(155,181,200,.2)">
        <td style="font-weight:700;color:var(--amber);padding-top:14px">TOTAL</td>
        <td data-label="Desaparecidos" style="font-weight:700;color:var(--red);padding-top:14px">${desaparecidos}</td>
        <td data-label="Encontrados" style="font-weight:700;color:var(--green);padding-top:14px">${aparecidos}</td>
        <td data-label="Fallecidos" style="font-weight:700;color:var(--slate);padding-top:14px">${fallecidos}</td>
        <td data-label="Total" style="font-weight:700;color:var(--amber);padding-top:14px">${total}</td>
      </tr>
    `;

    loadEl.style.display = 'none';
    wrapEl.style.display = 'block';
    document.getElementById('btn-compartir').style.display = 'inline-flex';
  } catch (err) {
    loadEl.innerHTML = `<span style="color:#E05A5A">Error al cargar facultades: ${err.message}</span>`;
  }
}

load();
loadFacultades();

// ── Excel Import Client-Side Handling ──

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('excel-file');
const dropText = document.getElementById('drop-text');
const fileName = document.getElementById('file-name');
const btnImportSubmit = document.getElementById('btn-import-submit');
const formImportar = document.getElementById('form-importar');
const importLoading = document.getElementById('import-loading');
const importResult = document.getElementById('import-result');

// Drag and drop event listeners
['dragenter', 'dragover'].forEach(eventName => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.style.borderColor = 'var(--amber)';
    dropZone.style.backgroundColor = 'rgba(232,168,56,0.06)';
  }, false);
});

['dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.style.borderColor = 'rgba(155,181,200,0.2)';
    dropZone.style.backgroundColor = 'rgba(20,34,51,0.4)';
  }, false);
});

fileInput.addEventListener('change', handleFileSelect);

function handleFileSelect(e) {
  const file = fileInput.files[0];
  if (file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      alert('Solo se aceptan archivos .xlsx o .xls');
      fileInput.value = '';
      fileName.style.display = 'none';
      dropText.style.display = 'block';
      btnImportSubmit.disabled = true;
      return;
    }
    
    // Display file name nicely
    fileName.textContent = `📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    fileName.style.display = 'block';
    dropText.style.display = 'none';
    btnImportSubmit.disabled = false;
    
    // Clear previous results
    importResult.style.display = 'none';
    importResult.style.borderColor = 'transparent';
    importResult.style.backgroundColor = 'transparent';
    importResult.innerHTML = '';
  } else {
    fileName.style.display = 'none';
    dropText.style.display = 'block';
    btnImportSubmit.disabled = true;
  }
}

// Variables para almacenar los resultados del análisis en memoria
let importPayload = null;

// Referencias a los nuevos elementos de la vista previa
const importPreview = document.getElementById('import-preview');
const btnImportConfirm = document.getElementById('btn-import-confirm');
const btnImportCancel = document.getElementById('btn-import-cancel');
const confirmLoading = document.getElementById('confirm-loading');

const lblCountNuevos = document.getElementById('lbl-count-nuevos');
const lblCountActualizaciones = document.getElementById('lbl-count-actualizaciones');
const lblCountNoCambios = document.getElementById('lbl-count-nocambios');
const lblCountOmitidos = document.getElementById('lbl-count-omitidos');

const tabNuevos = document.getElementById('tab-nuevos');
const tabActualizaciones = document.getElementById('tab-actualizaciones');
const tabOmitidos = document.getElementById('tab-omitidos');

const tabContentNuevos = document.getElementById('tab-content-nuevos');
const tabContentActualizaciones = document.getElementById('tab-content-actualizaciones');
const tabContentOmitidos = document.getElementById('tab-content-omitidos');

function getStatusBadge(status) {
  let bg = 'rgba(155,181,200,0.12)';
  let color = 'var(--text-muted)';
  if (status === 'aparecido') {
    bg = 'rgba(76,175,130,0.12)';
    color = 'var(--green)';
  } else if (status === 'fallecido') {
    bg = 'rgba(224,90,90,0.12)';
    color = '#E05A5A';
  } else if (status === 'desaparecido') {
    bg = 'rgba(232,168,56,0.12)';
    color = 'var(--amber)';
  }
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;background:${bg};color:${color};font-weight:600;font-size:11px;margin-left:6px">${status}</span>`;
}

// Configuración de pestañas de previsualización
const tabs = [
  { button: tabNuevos, content: tabContentNuevos },
  { button: tabActualizaciones, content: tabContentActualizaciones },
  { button: tabOmitidos, content: tabContentOmitidos }
];

function switchPreviewTab(activeTabId) {
  tabs.forEach(t => {
    if (t.button.id === `tab-${activeTabId}`) {
      t.button.classList.add('active-tab');
      t.content.style.display = 'block';
    } else {
      t.button.classList.remove('active-tab');
      t.content.style.display = 'none';
    }
  });
}

tabNuevos.addEventListener('click', () => switchPreviewTab('nuevos'));
tabActualizaciones.addEventListener('click', () => switchPreviewTab('actualizaciones'));
tabOmitidos.addEventListener('click', () => switchPreviewTab('omitidos'));

// Paso 1: Enviar formulario para analizar el Excel
formImportar.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const file = fileInput.files[0];
  if (!file) return;
  
  const token = document.getElementById('admin-token').value.trim();
  const chkActualizar = document.getElementById('chk-actualizar').checked;
  
  // Limpiar estados previos
  btnImportSubmit.disabled = true;
  importLoading.style.display = 'inline-flex';
  importResult.style.display = 'none';
  importPreview.style.display = 'none';
  importPayload = null;
  
  const formData = new FormData();
  formData.append('archivo', file);
  formData.append('actualizarExistentes', chkActualizar);
  
  try {
    const headers = {};
    if (token) {
      headers['x-admin-token'] = token;
    }
    
    const res = await fetch('/api/import/analizar', {
      method: 'POST',
      headers,
      body: formData
    });
    
    if (res.status === 401) {
      document.getElementById('admin-token').style.borderColor = '#E05A5A';
      document.getElementById('admin-token').focus();
      showImportResult('error', '<strong>Error de autorización:</strong> Se requiere ingresar el Token de Admin en la cabecera de la página para realizar análisis.');
      btnImportSubmit.disabled = false;
      return;
    }
    
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `HTTP ${res.status}`);
    }
    
    const data = await res.json();
    
    // Guardar payload analizado en memoria
    importPayload = data.payload;
    
    // Renderizar estadísticas de la previsualización
    lblCountNuevos.textContent = data.insertar.length;
    lblCountActualizaciones.textContent = data.actualizar.length;
    lblCountNoCambios.textContent = data.noCambiosCount;
    lblCountOmitidos.textContent = data.omitidos.length;
    
    // 1. Renderizar Nuevos
    let nuevosHtml = '';
    if (data.insertar.length === 0) {
      nuevosHtml = '<div style="color:var(--text-muted)">No hay nuevos estudiantes para registrar.</div>';
    } else {
      data.insertar.forEach(item => {
        nuevosHtml += `<div style="margin-bottom:6px">• <strong>${item.nombre}</strong> (C.I. ${item.cedula || 'N/A'}) - Carrera: ${item.carrera} - Estado: ${getStatusBadge(item.estado)}`;
        if (item.warnings && item.warnings.length > 0) {
          item.warnings.forEach(w => {
            nuevosHtml += `<span style="color:var(--text-muted);font-size:11px;display:block;margin-left:14px">⚠ ${w}</span>`;
          });
        }
        nuevosHtml += `</div>`;
      });
    }
    tabContentNuevos.innerHTML = nuevosHtml;
    
    // 2. Renderizar Modificaciones
    let modHtml = '';
    if (data.actualizar.length === 0) {
      modHtml = '<div style="color:var(--text-muted)">No se detectaron modificaciones en estudiantes existentes.</div>';
    } else {
      data.actualizar.forEach(item => {
        modHtml += `<div style="margin-bottom:12px;border-bottom:1px solid rgba(155,181,200,0.06);padding-bottom:8px">`;
        modHtml += `• <strong>${item.nombre}</strong> (C.I. ${item.cedula || 'N/A'}) - Carrera: ${item.carrera}<br>`;
        modHtml += `<div style="margin-left:14px;font-size:11.5px;color:var(--text-sec)">`;
        item.diffs.forEach(d => {
          let ant = d.anterior;
          let nue = d.nuevo;
          if (d.campo === 'Estado') {
            ant = getStatusBadge(d.anterior);
            nue = getStatusBadge(d.nuevo);
          }
          modHtml += `<div style="margin-top:4px">${d.campo}: <span style="text-decoration:line-through;opacity:0.6">${ant}</span> ➔ <span style="font-weight:600">${nue}</span></div>`;
        });
        modHtml += `</div></div>`;
      });
    }
    tabContentActualizaciones.innerHTML = modHtml;
    
    // 3. Renderizar Omitidos / Errores
    let omitHtml = '';
    if (data.omitidos.length === 0) {
      omitHtml = '<div style="color:var(--text-muted)">No hay registros omitidos.</div>';
    } else {
      data.omitidos.forEach(item => {
        omitHtml += `<div style="color:#E05A5A;margin-bottom:4px">• Fila ${item.fila}: ${item.motivo}</div>`;
      });
    }
    tabContentOmitidos.innerHTML = omitHtml;
    
    // Mostrar sección de previsualización y seleccionar la pestaña de Nuevos
    importPreview.style.display = 'block';
    switchPreviewTab('nuevos');
    
  } catch (err) {
    showImportResult('error', `<strong>Error al analizar:</strong> ${err.message}`);
    btnImportSubmit.disabled = false;
  } finally {
    importLoading.style.display = 'none';
  }
});

// Cancelar la importación analizada
btnImportCancel.addEventListener('click', () => {
  importPreview.style.display = 'none';
  importPayload = null;
  btnImportSubmit.disabled = false;
  
  // Limpiar campo de archivo
  fileInput.value = '';
  fileName.style.display = 'none';
  dropText.style.display = 'block';
});

// Paso 2: Confirmar e importar registros analizados
btnImportConfirm.addEventListener('click', async () => {
  if (!importPayload) return;
  
  const token = document.getElementById('admin-token').value.trim();
  
  // Mostrar loading
  btnImportConfirm.disabled = true;
  btnImportCancel.disabled = true;
  confirmLoading.style.display = 'inline-flex';
  
  try {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['x-admin-token'] = token;
    }
    
    const res = await fetch('/api/import/confirmar', {
      method: 'POST',
      headers,
      body: JSON.stringify(importPayload)
    });
    
    if (res.status === 401) {
      document.getElementById('admin-token').style.borderColor = '#E05A5A';
      document.getElementById('admin-token').focus();
      showImportResult('error', '<strong>Error de autorización:</strong> Se requiere ingresar el Token de Admin en la cabecera de la página para confirmar.');
      return;
    }
    
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `HTTP ${res.status}`);
    }
    
    const result = await res.json();
    
    // Renderizar éxito
    let html = `<div style="color:var(--green);font-weight:600;margin-bottom:8px">✓ Sincronización realizada correctamente en la base de datos:</div>`;
    html += `<div style="margin-left:12px">• <strong>${result.importados}</strong> nuevos estudiantes cargados.</div>`;
    html += `<div style="margin-left:12px">• <strong>${result.actualizados}</strong> registros actualizados exitosamente.</div>`;
    
    showImportResult('success', html);
    
    // Ocultar sección de previsualización
    importPreview.style.display = 'none';
    importPayload = null;
    
    // Limpiar campo de archivo
    fileInput.value = '';
    fileName.style.display = 'none';
    dropText.style.display = 'block';
    
    // Refrescar KPIs y tablas
    load();
    loadFacultades();
    
  } catch (err) {
    showImportResult('error', `<strong>Error al guardar cambios:</strong> ${err.message}`);
    btnImportConfirm.disabled = false;
    btnImportCancel.disabled = false;
  } finally {
    confirmLoading.style.display = 'none';
  }
});

function showImportResult(type, content) {
  importResult.style.display = 'block';
  importResult.innerHTML = content;
  
  if (type === 'success') {
    importResult.style.backgroundColor = 'rgba(76,175,130,0.08)';
    importResult.style.borderColor = 'rgba(76,175,130,0.22)';
    importResult.style.color = '#E8F0F7';
  } else if (type === 'warning') {
    importResult.style.backgroundColor = 'rgba(232,168,56,0.08)';
    importResult.style.borderColor = 'rgba(232,168,56,0.22)';
    importResult.style.color = '#E8F0F7';
  } else {
    importResult.style.backgroundColor = 'rgba(224,90,90,0.08)';
    importResult.style.borderColor = 'rgba(224,90,90,0.22)';
    importResult.style.color = '#FFF';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Administración de Estudiantes (Edición y Eliminación Interna)
// ─────────────────────────────────────────────────────────────────────────────

let adminCachedStudents = [];
let adminSelectedStudentId = null;

const adminSearchInput = document.getElementById('admin-search-q');
const adminSearchBtn = document.getElementById('btn-admin-search');
const adminSearchResults = document.getElementById('admin-search-results');
const adminEditFormWrap = document.getElementById('admin-edit-form-wrap');
const adminFormEditar = document.getElementById('admin-form-editar');
const adminEditTitle = document.getElementById('admin-edit-title');

const adminEditId = document.getElementById('admin-edit-id');
const adminEditEstado = document.getElementById('admin-edit-estado');
const adminEditTipoConf = document.getElementById('admin-edit-tipo-conf');
const adminEditDetalles = document.getElementById('admin-edit-detalles');
const adminEditUbicacion = document.getElementById('admin-edit-ubicacion');

const adminEditConfWrap = document.getElementById('admin-edit-conf-wrap');
const adminEditDetallesWrap = document.getElementById('admin-edit-detalles-wrap');

const btnAdminDelete = document.getElementById('btn-admin-delete');
const btnAdminCancel = document.getElementById('btn-admin-cancel');

// Toggle fields based on selected state
adminEditEstado.addEventListener('change', (e) => {
  const v = e.target.value;
  const isSpecial = v === 'aparecido' || v === 'fallecido';
  adminEditConfWrap.style.display = isSpecial ? 'block' : 'none';
  adminEditDetallesWrap.style.display = isSpecial ? 'block' : 'none';
});

// Search function
async function handleAdminSearch() {
  const q = adminSearchInput.value.trim().toLowerCase();
  adminSearchResults.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:13px;text-align:center">Buscando…</div>';
  adminEditFormWrap.style.display = 'none';
  adminSelectedStudentId = null;

  try {
    const res = await fetch('/api/estudiantes');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    adminCachedStudents = data;

    const filtered = data.filter(s => {
      const matchName = s.nombre.toLowerCase().includes(q);
      const matchCedula = s.cedula && String(s.cedula).includes(q);
      return matchName || matchCedula;
    });

    if (!filtered.length) {
      adminSearchResults.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:13px;text-align:center">No se encontraron estudiantes.</div>';
      return;
    }

    adminSearchResults.innerHTML = filtered.map(s => `
      <div class="admin-student-item" data-id="${s.id}">
        <div>
          <strong style="color:var(--text)">${s.nombre}</strong>
          <span style="font-size:11.5px;color:var(--text-muted);margin-left:8px">${s.cedula ? 'C.I. ' + s.cedula : 'Sin Cédula'}</span>
        </div>
        <div style="font-size:12px;color:var(--text-sec)">
          <span style="text-transform:uppercase;font-weight:600;margin-right:8px" class="${s.estado === 'desaparecido' ? 'color-red' : s.estado === 'fallecido' ? 'color-slate' : 'color-green'}">${s.estado}</span>
          <span>${s.carrera}</span>
        </div>
      </div>
    `).join('');

    // Add click listeners to items
    adminSearchResults.querySelectorAll('.admin-student-item').forEach(item => {
      item.addEventListener('click', () => {
        adminSearchResults.querySelectorAll('.admin-student-item').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        selectAdminStudent(parseInt(item.dataset.id));
      });
    });

  } catch (err) {
    adminSearchResults.innerHTML = `<div style="padding:16px;color:var(--red);font-size:13px;text-align:center">Error: ${err.message}</div>`;
  }
}

adminSearchBtn.addEventListener('click', handleAdminSearch);
adminSearchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleAdminSearch();
  }
});

// Select student to edit
function selectAdminStudent(id) {
  const s = adminCachedStudents.find(x => x.id === id);
  if (!s) return;

  adminSelectedStudentId = id;
  adminEditId.value = s.id;
  adminEditTitle.textContent = `Editar: ${s.nombre}`;
  adminEditEstado.value = s.estado;
  adminEditTipoConf.value = s.tipo_confirmacion || '';
  adminEditDetalles.value = s.detalles_confirmacion || '';
  adminEditUbicacion.value = s.ultima_ubicacion || '';

  const isSpecial = s.estado === 'aparecido' || s.estado === 'fallecido';
  adminEditConfWrap.style.display = isSpecial ? 'block' : 'none';
  adminEditDetallesWrap.style.display = isSpecial ? 'block' : 'none';

  adminEditFormWrap.style.display = 'block';
}

// Cancel edit
btnAdminCancel.addEventListener('click', () => {
  adminEditFormWrap.style.display = 'none';
  adminSelectedStudentId = null;
  adminSearchResults.querySelectorAll('.admin-student-item').forEach(el => el.classList.remove('selected'));
});

// Submit changes (Edit)
adminFormEditar.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!adminSelectedStudentId) return;

  const btnSave = document.getElementById('btn-admin-save');
  btnSave.disabled = true;
  btnSave.textContent = 'Guardando…';

  const token = document.getElementById('admin-token').value;
  
  const body = {
    estado: adminEditEstado.value,
    tipo_confirmacion: adminEditTipoConf.value || null,
    detalles_confirmacion: adminEditDetalles.value.trim() || null,
    ultima_ubicacion: adminEditUbicacion.value.trim() || null,
  };

  try {
    const res = await fetch(`/api/estudiantes/${adminSelectedStudentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': token
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    alert('Estudiante modificado correctamente.');
    
    // Refresh search results to show updated state
    handleAdminSearch();
    
    // Update main tracking dashboard metrics
    load();
    loadFacultades();

  } catch (err) {
    alert('Error al guardar cambios: ' + err.message);
  } finally {
    btnSave.disabled = false;
    btnSave.textContent = 'Guardar Cambios';
  }
});

// Delete student
btnAdminDelete.addEventListener('click', async () => {
  if (!adminSelectedStudentId) return;
  
  const s = adminCachedStudents.find(x => x.id === adminSelectedStudentId);
  if (!s) return;

  const confirmDelete = confirm(`¿Estás seguro de que deseas eliminar permanentemente a ${s.nombre} del sistema? Esta acción no se puede deshacer.`);
  if (!confirmDelete) return;

  btnAdminDelete.disabled = true;
  btnAdminDelete.textContent = 'Eliminando…';

  const token = document.getElementById('admin-token').value;

  try {
    const res = await fetch(`/api/estudiantes/${adminSelectedStudentId}`, {
      method: 'DELETE',
      headers: {
        'x-admin-token': token
      }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    alert('Estudiante eliminado correctamente.');

    // Clear search and refresh lists
    adminSearchInput.value = '';
    adminSearchResults.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:13px;text-align:center">Introduce un nombre o cédula y haz clic en Buscar.</div>';
    adminEditFormWrap.style.display = 'none';
    adminSelectedStudentId = null;

    load();
    loadFacultades();

  } catch (err) {
    alert('Error al eliminar: ' + err.message);
  } finally {
    btnAdminDelete.disabled = false;
    btnAdminDelete.textContent = 'Eliminar Estudiante';
  }
});
