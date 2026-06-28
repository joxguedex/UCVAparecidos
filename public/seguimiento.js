'use strict';

let chartInstance = null;

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

document.getElementById('btn-refresh').addEventListener('click', load);

load();
