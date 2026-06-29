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
