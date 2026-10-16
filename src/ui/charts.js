const number = value => Number.isFinite(value) ? value : null;
export function lineChart(target, series, options = {}) {
  const host = typeof target === 'string' ? document.getElementById(target) : target;
  if (!host) return;
  const width = Math.max(320, host.clientWidth || 820);
  const height = options.height || (host.classList.contains('tall') ? 310 : 210);
  const pad = { left: 47, right: 12, top: 12, bottom: 27 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const clean = series.map(item => ({...item, values:item.values.map(number)})).filter(item => item.values.some(Number.isFinite));
  if (!clean.length) { host.innerHTML = '<div class="empty-state">ไม่มีข้อมูลพอสำหรับวาดกราฟ</div>'; return; }
  const values = clean.flatMap(item => item.values.filter(Number.isFinite));
  let min = Math.min(...values), max = Math.max(...values);
  if (options.percent) { min = Math.min(min, 0); max = Math.max(max, 0); }
  if (min === max) { min -= 1; max += 1; }
  const y = value => pad.top + (max - value) / (max - min) * plotH;
  const x = index => pad.left + index / Math.max(1, Math.max(...clean.map(item => item.values.length)) - 1) * plotW;
  let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${options.aria || 'กราฟข้อมูล'}" preserveAspectRatio="none">`;
  for (let i = 0; i < 4; i += 1) {
    const value = max - (max - min) * i / 3;
    const yy = y(value);
    const label = options.percent ? `${value.toFixed(1)}%` : value.toLocaleString('en-US',{maximumFractionDigits:0});
    svg += `<line x1="${pad.left}" y1="${yy}" x2="${width-pad.right}" y2="${yy}" stroke="#263746" stroke-width="1"/><text x="${pad.left-7}" y="${yy+3}" fill="#71869a" font-size="9" text-anchor="end" font-family="DM Mono,monospace">${label}</text>`;
  }
  const count = Math.max(...clean.map(item => item.values.length));
  for (let i = 0; i < 4; i += 1) {
    const ix = Math.round((count - 1) * i / 3);
    const xx = x(ix);
    svg += `<line x1="${xx}" y1="${pad.top}" x2="${xx}" y2="${height-pad.bottom}" stroke="#172633" stroke-width="1"/>`;
  }
  clean.forEach(item => {
    let segments = [], current = [];
    item.values.forEach((value,index) => {
      if (!Number.isFinite(value)) { if (current.length) segments.push(current); current=[]; return; }
      current.push(`${x(index).toFixed(1)},${y(value).toFixed(1)}`);
    });
    if (current.length) segments.push(current);
    segments.forEach(points => { if (points.length>1) svg += `<polyline points="${points.join(' ')}" fill="none" stroke="${item.color}" stroke-width="${item.width || 2}" stroke-linejoin="round" stroke-linecap="round" opacity="${item.opacity || 1}"/>`; });
  });
  svg += `</svg>`;
  host.innerHTML = svg;
}

export function sparkline(values, color = '#44d7b5') {
  const data = values.filter(Number.isFinite);
  if (data.length < 2) return '';
  const min = Math.min(...data), max = Math.max(...data);
  const points = data.map((value,index) => `${(index/(data.length-1)*58).toFixed(1)},${(18-(value-min)/(max-min||1)*16).toFixed(1)}`).join(' ');
  return `<svg class="sparkline" viewBox="0 0 58 20" aria-hidden="true"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
