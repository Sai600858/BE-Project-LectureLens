/**
 * visualizationEngine.js
 * 
 * Deterministic, accurate educational diagram generator.
 * Produces clean, responsive, accessible SVG markup for:
 * 1. Mathematical plots & coordinate graphs (evaluated accurately from equations)
 * 2. Algorithm visualizations (e.g. binary search interval shrinking, arrays)
 * 3. Flowcharts & state diagrams
 * 4. System block diagrams & architectures
 * 5. Electrical circuits & schematics
 */

const fs = require('fs');
const path = require('path');

/**
 * Safely evaluates a math expression for x
 */
/**
 * Safely evaluates a math expression for x with strict token validation
 */
function evaluateMathExpression(fnStr, x) {
  if (typeof fnStr === 'function') {
    return fnStr(x);
  }
  if (!fnStr || typeof fnStr !== 'string') return 0;
  if (fnStr.length > 300) return 0;

  const trimmed = fnStr.trim();
  if (!trimmed) return 0;

  // Security Hardening: Strict whitelist of mathematical symbols and functions.
  // Reject any character that could lead to code execution or prototype pollution.
  const clean = trimmed
    .toLowerCase()
    .replace(/\^/g, '**')
    .replace(/\bsin\b(?=\s*\()/g, 'Math.sin')
    .replace(/\bcos\b(?=\s*\()/g, 'Math.cos')
    .replace(/\btan\b(?=\s*\()/g, 'Math.tan')
    .replace(/\bsqrt\b(?=\s*\()/g, 'Math.sqrt')
    .replace(/\blog\b(?=\s*\()/g, 'Math.log')
    .replace(/\bexp\b(?=\s*\()/g, 'Math.exp')
    .replace(/\babs\b(?=\s*\()/g, 'Math.abs')
    .replace(/\bpi\b/g, 'Math.PI')
    .replace(/\be\b/g, 'Math.E');

  // Verify that ONLY allowed tokens remain after removing known math symbols
  const testAgainstWhitelist = clean
    .replace(/Math\.(sin|cos|tan|sqrt|log|exp|abs|PI|E)/g, '')
    .replace(/\b[0-9]+(\.[0-9]+)?\b/g, '')
    .replace(/\bx\b/g, '')
    .replace(/[\+\-\*\/\(\)\s\.]/g, '');

  if (testAgainstWhitelist.length > 0) {
    // Contains forbidden characters or identifiers
    return 0;
  }

  try {
    const fn = new Function('x', `"use strict"; return (${clean});`);
    const val = fn(Number(x) || 0);
    return isFinite(val) ? val : 0;
  } catch (_) {
    return 0;
  }
}

/**
 * 1. Mathematical Coordinate Graph Generator
 */
function renderCoordinateGraphSvg(spec = {}) {
  const width = spec.width || 560;
  const height = spec.height || 360;
  const padding = { top: 40, right: 40, bottom: 50, left: 60 };

  const xDomain = Array.isArray(spec.xDomain) && spec.xDomain.length === 2 ? spec.xDomain : [-5, 5];
  const yDomain = Array.isArray(spec.yDomain) && spec.yDomain.length === 2 ? spec.yDomain : [-5, 5];
  const minX = Number(xDomain[0]) || 0;
  const maxX = Number(xDomain[1]) || (minX + 10);
  const minY = Number(yDomain[0]) || 0;
  const maxY = Number(yDomain[1]) || (minY + 10);
  const spanX = (maxX - minX) || 1;
  const spanY = (maxY - minY) || 1;

  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const toSvgX = (x) => {
    const num = Number(x);
    if (!Number.isFinite(num)) return padding.left;
    return padding.left + ((num - minX) / spanX) * plotW;
  };
  const toSvgY = (y) => {
    const num = Number(y);
    if (!Number.isFinite(num)) return padding.top + plotH;
    return padding.top + plotH - ((num - minY) / spanY) * plotH;
  };

  // Grid lines & ticks
  const xStep = spec.xStep || Math.max(1, Math.round((maxX - minX) / 10));
  const yStep = spec.yStep || Math.max(1, Math.round((maxY - minY) / 10));

  let gridLines = '';
  let tickLabels = '';

  for (let x = Math.ceil(minX); x <= maxX; x += xStep) {
    const sx = toSvgX(x);
    gridLines += `<line x1="${sx}" y1="${padding.top}" x2="${sx}" y2="${padding.top + plotH}" stroke="#27272a" stroke-dasharray="3,3" stroke-width="1"/>`;
    tickLabels += `<text x="${sx}" y="${padding.top + plotH + 18}" fill="#71717a" font-size="11" text-anchor="middle" font-family="system-ui">${x}</text>`;
  }

  for (let y = Math.ceil(minY); y <= maxY; y += yStep) {
    const sy = toSvgY(y);
    gridLines += `<line x1="${padding.left}" y1="${sy}" x2="${padding.left + plotW}" y2="${sy}" stroke="#27272a" stroke-dasharray="3,3" stroke-width="1"/>`;
    if (y !== 0 || minY > 0 || maxY < 0) {
      tickLabels += `<text x="${padding.left - 10}" y="${sy + 4}" fill="#71717a" font-size="11" text-anchor="end" font-family="system-ui">${y}</text>`;
    }
  }

  // Axes lines (at x=0 and y=0 if in domain, else at boundary)
  const originX = Math.max(minX, Math.min(maxX, 0));
  const originY = Math.max(minY, Math.min(maxY, 0));
  const axisX = toSvgX(originX);
  const axisY = toSvgY(originY);

  const axes = `
    <!-- X Axis -->
    <line x1="${padding.left}" y1="${axisY}" x2="${padding.left + plotW + 15}" y2="${axisY}" stroke="#94a3b8" stroke-width="2"/>
    <polygon points="${padding.left + plotW + 20},${axisY} ${padding.left + plotW + 10},${axisY - 4} ${padding.left + plotW + 10},${axisY + 4}" fill="#94a3b8"/>
    <!-- Y Axis -->
    <line x1="${axisX}" y1="${padding.top + plotH}" x2="${axisX}" y2="${padding.top - 15}" stroke="#94a3b8" stroke-width="2"/>
    <polygon points="${axisX},${padding.top - 20} ${axisX - 4},${padding.top - 10} ${axisX + 4},${padding.top - 10}" fill="#94a3b8"/>
  `;

  // Plot Curve
  let curvePath = '';
  const pointsToSample = 120;
  const samples = [];
  const fnStr = spec.fn || spec.expression || 'x';

  for (let i = 0; i <= pointsToSample; i++) {
    const curX = minX + (i / pointsToSample) * (maxX - minX);
    const curY = evaluateMathExpression(fnStr, curX);
    if (!isNaN(curY)) {
      const clampedY = Math.max(minY - 2, Math.min(maxY + 2, curY));
      samples.push({ sx: toSvgX(curX), sy: toSvgY(clampedY), x: curX, y: curY });
    }
  }

  if (samples.length > 1) {
    curvePath = samples.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.sx.toFixed(1)} ${pt.sy.toFixed(1)}`).join(' ');
  }

  // Marked Points (Intercepts, vertices, labeled coordinates)
  let markedPointsSvg = '';
  if (Array.isArray(spec.points)) {
    spec.points.forEach((pt) => {
      const numX = Number(pt.x);
      const numY = Number(pt.y);
      if (!Number.isFinite(numX) || !Number.isFinite(numY)) return;
      const px = toSvgX(numX);
      const py = toSvgY(numY);
      const col = pt.color || '#38bdf8';
      const label = pt.label != null ? String(pt.label) : `(${numX}, ${numY})`;
      const labelW = (label.length * 7.5) + 12;
      markedPointsSvg += `
        <circle cx="${px}" cy="${py}" r="5" fill="${col}" stroke="#0f172a" stroke-width="2"/>
        <circle cx="${px}" cy="${py}" r="8" fill="none" stroke="${col}" stroke-width="1.5" stroke-opacity="0.5"/>
        <rect x="${px + 8}" y="${py - 18}" width="${labelW}" height="22" rx="4" fill="#090d16" stroke="${col}" stroke-width="1" fill-opacity="0.95"/>
        <text x="${px + 14}" y="${py - 4}" fill="#ffffff" font-size="11" font-weight="600" font-family="system-ui">${label}</text>
      `;
    });
  }

  // Slope Indicator (if specified)
  let slopeSvg = '';
  if (spec.slopeTriangle) {
    const { x1, x2, label } = spec.slopeTriangle;
    const y1 = evaluateMathExpression(fnStr, x1);
    const y2 = evaluateMathExpression(fnStr, x2);
    const sx1 = toSvgX(x1);
    const sy1 = toSvgY(y1);
    const sx2 = toSvgX(x2);
    const sy2 = toSvgY(y2);

    slopeSvg = `
      <!-- Slope Triangle -->
      <path d="M ${sx1} ${sy1} L ${sx2} ${sy1} L ${sx2} ${sy2}" fill="rgba(245, 158, 11, 0.15)" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="3,3"/>
      <text x="${(sx1 + sx2) / 2}" y="${sy1 + 14}" fill="#fbbf24" font-size="10" font-weight="600" text-anchor="middle" font-family="system-ui">Δx = ${(x2 - x1).toFixed(1)}</text>
      <text x="${sx2 + 8}" y="${(sy1 + sy2) / 2}" fill="#fbbf24" font-size="10" font-weight="600" font-family="system-ui">Δy = ${(y2 - y1).toFixed(1)}</text>
      ${label ? `<text x="${sx2 + 10}" y="${(sy1 + sy2) / 2 + 14}" fill="#fde68a" font-size="10" font-weight="bold" font-family="system-ui">${label}</text>` : ''}
    `;
  }

  const title = spec.title || spec.equation || 'Mathematical Plot';
  const xAxisLabel = spec.xAxisLabel || 'x';
  const yAxisLabel = spec.yAxisLabel || 'y';

  return `
<svg viewBox="0 0 ${width} ${height}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="background:#090d16; border-radius:10px; border:1px solid #1e293b; max-width:${width}px;">
  <defs>
    <linearGradient id="plotGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#818cf8"/>
    </linearGradient>
  </defs>

  <!-- Title -->
  <text x="${padding.left}" y="24" fill="#f8fafc" font-size="13" font-weight="700" font-family="system-ui">${title}</text>
  ${spec.equation ? `<text x="${width - padding.right}" y="24" fill="#38bdf8" font-size="12" font-weight="600" text-anchor="end" font-family="monospace">${spec.equation}</text>` : ''}

  <!-- Grid -->
  ${gridLines}
  ${tickLabels}

  <!-- Axes -->
  ${axes}

  <!-- Axis Labels -->
  <text x="${padding.left + plotW + 25}" y="${axisY + 4}" fill="#cbd5e1" font-size="12" font-weight="700" font-family="system-ui">${xAxisLabel}</text>
  <text x="${axisX}" y="${padding.top - 26}" fill="#cbd5e1" font-size="12" font-weight="700" text-anchor="middle" font-family="system-ui">${yAxisLabel}</text>

  <!-- Plotted Curve -->
  ${curvePath ? `<path d="${curvePath}" fill="none" stroke="url(#plotGradient)" stroke-width="3" stroke-linecap="round"/>` : ''}

  <!-- Slope -->
  ${slopeSvg}

  <!-- Marked Points -->
  ${markedPointsSvg}
</svg>`.trim();
}

/**
 * 2. Algorithm / Binary Search Interval Visualizer
 */
function renderAlgorithmSvg(spec = {}) {
  const width = spec.width || 560;
  const height = spec.height || 280;
  const title = spec.title || 'Algorithm Execution Visualization';

  // If spec.steps is provided and no array is specified, render clean sequential execution steps!
  if (Array.isArray(spec.steps) && spec.steps.length > 0 && !spec.array) {
    const steps = spec.steps;
    const stepH = 38;
    const gap = 12;
    const computedHeight = Math.max(height, 75 + steps.length * (stepH + gap));
    let stepsSvg = '';

    steps.forEach((st, idx) => {
      const sy = 60 + idx * (stepH + gap);
      const text = typeof st === 'string' ? st : (st.text || st.label || JSON.stringify(st));
      stepsSvg += `
        <g>
          <rect x="24" y="${sy}" width="${width - 48}" height="${stepH}" rx="6" fill="#181f2f" stroke="#3b82f6" stroke-width="1.2"/>
          <circle cx="48" cy="${sy + stepH / 2}" r="11" fill="#2563eb"/>
          <text x="48" y="${sy + stepH / 2 + 4}" fill="#ffffff" font-size="11" font-weight="bold" text-anchor="middle" font-family="system-ui">${idx + 1}</text>
          <text x="70" y="${sy + stepH / 2 + 4}" fill="#f8fafc" font-size="11.5" font-weight="500" font-family="system-ui">${escapeXml(text)}</text>
        </g>
      `;
      if (idx < steps.length - 1) {
        const arrowY = sy + stepH;
        stepsSvg += `
          <line x1="${width / 2}" y1="${arrowY}" x2="${width / 2}" y2="${arrowY + gap}" stroke="#60a5fa" stroke-width="1.5"/>
          <polygon points="${width / 2},${arrowY + gap} ${width / 2 - 3},${arrowY + gap - 4} ${width / 2 + 3},${arrowY + gap - 4}" fill="#60a5fa"/>
        `;
      }
    });

    return `
<svg viewBox="0 0 ${width} ${computedHeight}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="background:#090d16; border-radius:10px; border:1px solid #1e293b; max-width:${width}px;">
  <text x="24" y="28" fill="#f8fafc" font-size="13" font-weight="700" font-family="system-ui">${escapeXml(title)}</text>
  <text x="24" y="44" fill="#38bdf8" font-size="10" font-weight="600" font-family="system-ui">[ALGORITHMIC EXECUTION STEPS]</text>
  ${stepsSvg}
</svg>`.trim();
  }

  const array = spec.array || [2, 5, 8, 12, 16, 23, 38, 56, 72, 91];
  const target = spec.target != null ? spec.target : 23;
  const low = spec.low != null ? spec.low : 4;
  const mid = spec.mid != null ? spec.mid : 5;
  const high = spec.high != null ? spec.high : 8;

  const boxW = Math.min(42, Math.floor((width - 80) / array.length));
  const startX = (width - array.length * boxW) / 2;
  const boxY = 110;

  let boxesSvg = '';
  array.forEach((val, i) => {
    const bx = startX + i * boxW;
    const isInRange = i >= low && i <= high;
    const isMid = i === mid;
    const isTarget = val === target;

    const bg = isMid
      ? '#2563eb'
      : isTarget && isMid
      ? '#16a34a'
      : isInRange
      ? '#1e293b'
      : '#111827';
    const border = isMid ? '#60a5fa' : isInRange ? '#475569' : '#1f2937';
    const textColor = isInRange ? '#f8fafc' : '#64748b';

    boxesSvg += `
      <g>
        <rect x="${bx}" y="${boxY}" width="${boxW - 4}" height="44" rx="6" fill="${bg}" stroke="${border}" stroke-width="${isMid ? 2.5 : 1}"/>
        <text x="${bx + (boxW - 4) / 2}" y="${boxY + 27}" fill="${textColor}" font-size="14" font-weight="bold" text-anchor="middle" font-family="system-ui">${val}</text>
        <text x="${bx + (boxW - 4) / 2}" y="${boxY + 60}" fill="#94a3b8" font-size="10" text-anchor="middle" font-family="system-ui">${i}</text>
      </g>
    `;
  });

  // Pointers for low, mid, high
  const lowX = startX + low * boxW + (boxW - 4) / 2;
  const midX = startX + mid * boxW + (boxW - 4) / 2;
  const highX = startX + high * boxW + (boxW - 4) / 2;

  const pointersSvg = `
    <!-- Low Pointer -->
    <text x="${lowX}" y="${boxY - 26}" fill="#38bdf8" font-size="11" font-weight="bold" text-anchor="middle" font-family="system-ui">LOW [${low}]</text>
    <line x1="${lowX}" y1="${boxY - 22}" x2="${lowX}" y2="${boxY - 4}" stroke="#38bdf8" stroke-width="2"/>
    <polygon points="${lowX},${boxY - 2} ${lowX - 3},${boxY - 8} ${lowX + 3},${boxY - 8}" fill="#38bdf8"/>

    <!-- Mid Pointer -->
    <text x="${midX}" y="${boxY - 38}" fill="#fbbf24" font-size="12" font-weight="bold" text-anchor="middle" font-family="system-ui">MID [${mid}] = ${array[mid]}</text>
    <line x1="${midX}" y1="${boxY - 34}" x2="${midX}" y2="${boxY - 4}" stroke="#fbbf24" stroke-width="2.5"/>
    <polygon points="${midX},${boxY - 2} ${midX - 4},${boxY - 10} ${midX + 4},${boxY - 10}" fill="#fbbf24"/>

    <!-- High Pointer -->
    <text x="${highX}" y="${boxY - 26}" fill="#f43f5e" font-size="11" font-weight="bold" text-anchor="middle" font-family="system-ui">HIGH [${high}]</text>
    <line x1="${highX}" y1="${boxY - 22}" x2="${highX}" y2="${boxY - 4}" stroke="#f43f5e" stroke-width="2"/>
    <polygon points="${highX},${boxY - 2} ${highX - 3},${boxY - 8} ${highX + 3},${boxY - 8}" fill="#f43f5e"/>
  `;

  const comparison = spec.comparison || `Target (${target}) == arr[mid] (${array[mid]}) → Found!`;

  return `
<svg viewBox="0 0 ${width} ${height}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="background:#090d16; border-radius:10px; border:1px solid #1e293b; max-width:${width}px;">
  <!-- Title -->
  <text x="24" y="28" fill="#f8fafc" font-size="13" font-weight="700" font-family="system-ui">${escapeXml(title)}</text>
  <rect x="24" y="44" width="${width - 48}" height="28" rx="6" fill="#181f2f" stroke="#1e3a8a" stroke-width="1"/>
  <text x="36" y="62" fill="#93c5fd" font-size="11" font-weight="600" font-family="system-ui">Search Interval: [${low} .. ${high}] | Window size: ${high - low + 1} | Target: ${target}</text>

  <!-- Array Elements -->
  ${boxesSvg}
  ${pointersSvg}

  <!-- Status / Comparison Banner -->
  <rect x="24" y="${height - 54}" width="${width - 48}" height="36" rx="6" fill="#064e3b" stroke="#059669" stroke-width="1"/>
  <text x="${width / 2}" y="${height - 31}" fill="#6ee7b7" font-size="12" font-weight="bold" text-anchor="middle" font-family="system-ui">✓ ${comparison}</text>
</svg>`.trim();
}

/**
 * Render NULL-handling decision flow for COALESCE(val, fallback)
 */
function renderNullCoalesceFlowSvg(spec = {}) {
  const width = spec.width || 560;
  const height = spec.height || 340;
  const title = spec.title || 'SQL COALESCE() Null-Handling Flow';
  const expr = spec.expression || spec.sql || "SELECT name, COALESCE(dept, 'Unknown') FROM employee;";
  const fallback = spec.fallback || "'Unknown'";
  const isIllustrative = spec.isIllustrative !== false;

  const rows = Array.isArray(spec.inputRows) && spec.inputRows.length > 0 ? spec.inputRows : [
    { name: 'Alice', dept: "'IT'" },
    { name: 'Bob', dept: null },
    { name: 'Charlie', dept: "'HR'" },
  ];

  let rowsSvg = '';
  const rowStartX = 30;
  const rowStartY = 95;
  const rowHeight = 36;
  const colW1 = 70;
  const colW2 = 80;
  const colW3 = 100;

  // Header row
  rowsSvg += `
    <g>
      <rect x="${rowStartX}" y="${rowStartY}" width="${colW1 + colW2 + colW3 + 240}" height="26" fill="#1e293b" rx="4"/>
      <text x="${rowStartX + 10}" y="${rowStartY + 17}" fill="#94a3b8" font-size="10" font-weight="bold" font-family="monospace">name</text>
      <text x="${rowStartX + colW1 + 10}" y="${rowStartY + 17}" fill="#94a3b8" font-size="10" font-weight="bold" font-family="monospace">dept (raw)</text>
      <text x="${rowStartX + colW1 + colW2 + 30}" y="${rowStartY + 17}" fill="#94a3b8" font-size="10" font-weight="bold" font-family="monospace">dept IS NULL?</text>
      <text x="${rowStartX + colW1 + colW2 + colW3 + 120}" y="${rowStartY + 17}" fill="#38bdf8" font-size="10" font-weight="bold" font-family="monospace">COALESCE Result</text>
    </g>
  `;

  rows.forEach((r, idx) => {
    const ry = rowStartY + 32 + idx * (rowHeight + 8);
    const isNull = r.dept === null || r.dept === 'NULL' || r.dept === undefined;
    const rawVal = isNull ? 'NULL' : String(r.dept);
    const resultVal = isNull ? fallback : rawVal;

    const rowBg = isNull ? '#2a1a1f' : '#111827';
    const border = isNull ? '#f43f5e' : '#334155';

    rowsSvg += `
      <g>
        <rect x="${rowStartX}" y="${ry}" width="${colW1 + colW2 + colW3 + 240}" height="${rowHeight}" rx="6" fill="${rowBg}" stroke="${border}" stroke-width="${isNull ? 1.5 : 1}"/>
        <text x="${rowStartX + 10}" y="${ry + 22}" fill="#f8fafc" font-size="12" font-family="monospace">${escapeXml(r.name)}</text>
        
        <!-- Raw Dept -->
        ${isNull 
          ? `<rect x="${rowStartX + colW1 + 8}" y="${ry + 8}" width="50" height="20" rx="3" fill="#881337"/>
             <text x="${rowStartX + colW1 + 33}" y="${ry + 22}" fill="#fda4af" font-size="11" font-weight="bold" text-anchor="middle" font-family="monospace">NULL</text>`
          : `<text x="${rowStartX + colW1 + 10}" y="${ry + 22}" fill="#cbd5e1" font-size="12" font-family="monospace">${escapeXml(rawVal)}</text>`
        }

        <!-- Decision Indicator -->
        <line x1="${rowStartX + colW1 + colW2}" y1="${ry + 18}" x2="${rowStartX + colW1 + colW2 + 25}" y2="${ry + 18}" stroke="#64748b" stroke-width="1.5"/>
        <polygon points="${rowStartX + colW1 + colW2 + 27},${ry + 18} ${rowStartX + colW1 + colW2 + 22},${ry + 15} ${rowStartX + colW1 + colW2 + 22},${ry + 21}" fill="#64748b"/>
        
        <rect x="${rowStartX + colW1 + colW2 + 30}" y="${ry + 8}" width="80" height="20" rx="3" fill="${isNull ? '#78350f' : '#064e3b'}"/>
        <text x="${rowStartX + colW1 + colW2 + 70}" y="${ry + 22}" fill="${isNull ? '#fde68a' : '#a7f3d0'}" font-size="10" font-weight="bold" text-anchor="middle" font-family="system-ui">${isNull ? 'YES → Fallback' : 'NO → Original'}</text>

        <!-- Arrow to Result -->
        <line x1="${rowStartX + colW1 + colW2 + 115}" y1="${ry + 18}" x2="${rowStartX + colW1 + colW2 + 135}" y2="${ry + 18}" stroke="#64748b" stroke-width="1.5"/>
        <polygon points="${rowStartX + colW1 + colW2 + 137},${ry + 18} ${rowStartX + colW1 + colW2 + 132},${ry + 15} ${rowStartX + colW1 + colW2 + 132},${ry + 21}" fill="#64748b"/>

        <!-- Result Cell -->
        <rect x="${rowStartX + colW1 + colW2 + colW3 + 45}" y="${ry + 7}" width="185" height="22" rx="4" fill="${isNull ? '#14532d' : '#0f172a'}" stroke="${isNull ? '#22c55e' : '#38bdf8'}" stroke-width="${isNull ? 1.5 : 1}"/>
        <text x="${rowStartX + colW1 + colW2 + colW3 + 55}" y="${ry + 22}" fill="${isNull ? '#86efac' : '#38bdf8'}" font-size="11" font-weight="bold" font-family="monospace">${escapeXml(resultVal)} ${isNull ? ' (replaces NULL)' : ''}</text>
      </g>
    `;
  });

  return `
<svg viewBox="0 0 ${width} ${height}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="background:#090d16; border-radius:10px; border:1px solid #1e293b; max-width:${width}px;">
  <!-- Title & SQL Query -->
  <text x="24" y="26" fill="#f8fafc" font-size="13" font-weight="700" font-family="system-ui">${escapeXml(title)}</text>
  <rect x="24" y="38" width="${width - 48}" height="26" rx="4" fill="#1e1b4b" stroke="#4338ca" stroke-width="1"/>
  <text x="34" y="55" fill="#a5b4fc" font-size="11" font-weight="600" font-family="monospace">${escapeXml(expr)}</text>

  <!-- Table Visualization -->
  ${rowsSvg}

  <!-- Footer Rule & Provenance -->
  <rect x="24" y="${height - 42}" width="${width - 48}" height="28" rx="4" fill="#0b1329" stroke="#1d4ed8" stroke-width="1"/>
  <text x="34" y="${height - 24}" fill="#93c5fd" font-size="10.5" font-family="system-ui">💡 Rule: COALESCE evaluates arguments sequentially; returns the first NON-NULL value, else ${escapeXml(fallback)}.</text>
  ${isIllustrative ? `<text x="${width - 34}" y="${height - 24}" fill="#f59e0b" font-size="9.5" font-weight="600" text-anchor="end" font-family="system-ui">[Illustrative Example]</text>` : ''}
</svg>`.trim();
}

/**
 * Render input-to-output transformations for SQL String functions
 */
function renderStringTransformationSvg(spec = {}) {
  const width = spec.width || 560;
  const height = spec.height || 360;
  const title = spec.title || 'SQL String Functions: Input → Output Transformations';
  const inputStr = spec.input != null ? String(spec.input) : '  LectureLens  ';
  const isIllustrative = spec.isIllustrative !== false;

  const operations = Array.isArray(spec.operations) && spec.operations.length > 0 ? spec.operations : [
    { func: 'UPPER(str)', result: `'${inputStr.toUpperCase()}'`, desc: 'Converts all characters to uppercase' },
    { func: 'LOWER(str)', result: `'${inputStr.toLowerCase()}'`, desc: 'Converts all characters to lowercase' },
    { func: 'LENGTH(str)', result: String(inputStr.length), desc: 'Returns character count including whitespace' },
    { func: 'TRIM(str)', result: `'${inputStr.trim()}'`, desc: 'Strips leading and trailing spaces' },
    { func: 'SUBSTRING(TRIM(str), 1, 7)', result: `'Lecture'`, desc: 'Extracts 7 chars starting at pos 1' },
    { func: `CONCAT(TRIM(str), ' AI')`, result: `'LectureLens AI'`, desc: 'Concatenates two or more strings' },
  ];

  let opsSvg = '';
  const startY = 88;
  const cardH = 34;
  const gap = 8;

  operations.slice(0, 6).forEach((op, idx) => {
    const cy = startY + idx * (cardH + gap);
    opsSvg += `
      <g>
        <!-- Card -->
        <rect x="24" y="${cy}" width="${width - 48}" height="${cardH}" rx="5" fill="#111827" stroke="#1f2937" stroke-width="1"/>
        
        <!-- Function Name -->
        <rect x="32" y="${cy + 6}" width="165" height="22" rx="3" fill="#1e293b" stroke="#3b82f6" stroke-width="1"/>
        <text x="40" y="${cy + 21}" fill="#93c5fd" font-size="11" font-weight="bold" font-family="monospace">${escapeXml(op.func)}</text>

        <!-- Arrow -->
        <line x1="205" y1="${cy + 17}" x2="225" y2="${cy + 17}" stroke="#64748b" stroke-width="1.5"/>
        <polygon points="228,${cy + 17} 223,${cy + 14} 223,${cy + 20}" fill="#64748b"/>

        <!-- Result -->
        <rect x="235" y="${cy + 6}" width="150" height="22" rx="3" fill="#064e3b" stroke="#059669" stroke-width="1"/>
        <text x="243" y="${cy + 21}" fill="#a7f3d0" font-size="11" font-weight="bold" font-family="monospace">${escapeXml(op.result)}</text>

        <!-- Description Note -->
        <text x="395" y="${cy + 21}" fill="#94a3b8" font-size="10" font-family="system-ui">${escapeXml(op.desc || '')}</text>
      </g>
    `;
  });

  return `
<svg viewBox="0 0 ${width} ${height}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="background:#090d16; border-radius:10px; border:1px solid #1e293b; max-width:${width}px;">
  <!-- Title -->
  <text x="24" y="24" fill="#f8fafc" font-size="13" font-weight="700" font-family="system-ui">${escapeXml(title)}</text>

  <!-- Input String Banner -->
  <rect x="24" y="38" width="${width - 48}" height="36" rx="6" fill="#181f2f" stroke="#2563eb" stroke-width="1"/>
  <text x="36" y="55" fill="#cbd5e1" font-size="10.5" font-weight="bold" font-family="system-ui">INPUT STRING: </text>
  <rect x="130" y="44" width="${Math.min(260, inputStr.length * 9 + 30)}" height="24" rx="4" fill="#090d16" stroke="#38bdf8" stroke-width="1"/>
  <text x="140" y="60" fill="#38bdf8" font-size="12" font-weight="bold" font-family="monospace">'${escapeXml(inputStr)}'</text>
  <text x="${width - 36}" y="60" fill="#94a3b8" font-size="10" text-anchor="end" font-family="monospace">length: ${inputStr.length}</text>

  <!-- Operations List -->
  ${opsSvg}

  <!-- Footer Tag -->
  ${isIllustrative ? `
    <text x="${width - 24}" y="${height - 10}" fill="#f59e0b" font-size="9" font-weight="600" text-anchor="end" font-family="system-ui">[Illustrative Teaching Examples]</text>
  ` : ''}
</svg>`.trim();
}

/**
 * Render calendar-date arithmetic timeline for SQL Date & Time functions
 */
function renderDateTimelineSvg(spec = {}) {
  const width = spec.width || 560;
  const height = spec.height || 310;
  const title = spec.title || 'SQL Date & Time Arithmetic Timeline';
  const baseDate = spec.baseDate || '2020-09-05';
  const isIllustrative = spec.isIllustrative !== false;

  // Timeline axis positions
  const axisY = 165;
  const startX = 60;
  const endX = width - 60;
  const midX = (startX + endX) / 2;
  const leftX = startX + 50;
  const rightX = endX - 50;

  return `
<svg viewBox="0 0 ${width} ${height}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="background:#090d16; border-radius:10px; border:1px solid #1e293b; max-width:${width}px;">
  <!-- Title -->
  <text x="24" y="24" fill="#f8fafc" font-size="13" font-weight="700" font-family="system-ui">${escapeXml(title)}</text>

  <!-- Top Badges for Current Date/Time Functions -->
  <g>
    <rect x="24" y="38" width="115" height="24" rx="4" fill="#1e293b" stroke="#38bdf8" stroke-width="1"/>
    <text x="81" y="54" fill="#38bdf8" font-size="10" font-weight="bold" text-anchor="middle" font-family="monospace">CURRENT_DATE()</text>

    <rect x="145" y="38" width="115" height="24" rx="4" fill="#1e293b" stroke="#38bdf8" stroke-width="1"/>
    <text x="202" y="54" fill="#38bdf8" font-size="10" font-weight="bold" text-anchor="middle" font-family="monospace">CURRENT_TIME()</text>

    <rect x="266" y="38" width="70" height="24" rx="4" fill="#1e293b" stroke="#38bdf8" stroke-width="1"/>
    <text x="301" y="54" fill="#38bdf8" font-size="10" font-weight="bold" text-anchor="middle" font-family="monospace">NOW()</text>

    <rect x="342" y="38" width="90" height="24" rx="4" fill="#1e293b" stroke="#818cf8" stroke-width="1"/>
    <text x="387" y="54" fill="#c7d2fe" font-size="10" font-weight="bold" text-anchor="middle" font-family="monospace">EXTRACT()</text>

    <rect x="438" y="38" width="98" height="24" rx="4" fill="#1e293b" stroke="#818cf8" stroke-width="1"/>
    <text x="487" y="54" fill="#c7d2fe" font-size="10" font-weight="bold" text-anchor="middle" font-family="monospace">TIMESTAMPDIFF()</text>
  </g>

  <!-- Horizontal Timeline Axis -->
  <line x1="${startX}" y1="${axisY}" x2="${endX}" y2="${axisY}" stroke="#64748b" stroke-width="3"/>
  <polygon points="${endX + 8},${axisY} ${endX},${axisY - 4} ${endX},${axisY + 4}" fill="#64748b"/>

  <!-- Left Point: DATE_SUB (-10 DAY) -> 2020-08-26 -->
  <g>
    <circle cx="${leftX}" cy="${axisY}" r="7" fill="#f43f5e" stroke="#090d16" stroke-width="2"/>
    <rect x="${leftX - 52}" y="${axisY + 16}" width="104" height="26" rx="4" fill="#111827" stroke="#f43f5e" stroke-width="1.2"/>
    <text x="${leftX}" y="${axisY + 33}" fill="#fda4af" font-size="11" font-weight="bold" text-anchor="middle" font-family="monospace">'2020-08-26'</text>
    
    <!-- Backward Arrow curve -->
    <path d="M ${midX} ${axisY - 14} Q ${(midX + leftX) / 2} ${axisY - 55} ${leftX} ${axisY - 14}" fill="none" stroke="#f43f5e" stroke-width="2" stroke-dasharray="3,3"/>
    <polygon points="${leftX},${axisY - 10} ${leftX + 4},${axisY - 18} ${leftX - 2},${axisY - 18}" fill="#f43f5e"/>
    <rect x="${(midX + leftX) / 2 - 75}" y="${axisY - 68}" width="150" height="20" rx="3" fill="#881337"/>
    <text x="${(midX + leftX) / 2}" y="${axisY - 54}" fill="#fecdd3" font-size="9.5" font-weight="bold" text-anchor="middle" font-family="monospace">DATE_SUB(..., 10 DAY)</text>
  </g>

  <!-- Center Point: Base Date -> 2020-09-05 -->
  <g>
    <circle cx="${midX}" cy="${axisY}" r="9" fill="#38bdf8" stroke="#090d16" stroke-width="2.5"/>
    <rect x="${midX - 58}" y="${axisY + 16}" width="116" height="34" rx="5" fill="#0f172a" stroke="#38bdf8" stroke-width="1.8"/>
    <text x="${midX}" y="${axisY + 32}" fill="#38bdf8" font-size="12" font-weight="bold" text-anchor="middle" font-family="monospace">'${escapeXml(baseDate)}'</text>
    <text x="${midX}" y="${axisY + 45}" fill="#94a3b8" font-size="9" text-anchor="middle" font-family="system-ui">Base Reference Date</text>
  </g>

  <!-- Right Point: DATE_ADD (+10 DAY) -> 2020-09-15 -->
  <g>
    <circle cx="${rightX}" cy="${axisY}" r="7" fill="#10b981" stroke="#090d16" stroke-width="2"/>
    <rect x="${rightX - 52}" y="${axisY + 16}" width="104" height="26" rx="4" fill="#111827" stroke="#10b981" stroke-width="1.2"/>
    <text x="${rightX}" y="${axisY + 33}" fill="#a7f3d0" font-size="11" font-weight="bold" text-anchor="middle" font-family="monospace">'2020-09-15'</text>

    <!-- Forward Arrow curve -->
    <path d="M ${midX} ${axisY - 14} Q ${(midX + rightX) / 2} ${axisY - 55} ${rightX} ${axisY - 14}" fill="none" stroke="#10b981" stroke-width="2"/>
    <polygon points="${rightX},${axisY - 10} ${rightX - 2},${axisY - 18} ${rightX + 4},${axisY - 18}" fill="#10b981"/>
    <rect x="${(midX + rightX) / 2 - 75}" y="${axisY - 68}" width="150" height="20" rx="3" fill="#064e3b"/>
    <text x="${(midX + rightX) / 2}" y="${axisY - 54}" fill="#6ee7b7" font-size="9.5" font-weight="bold" text-anchor="middle" font-family="monospace">DATE_ADD(..., 10 DAY)</text>
  </g>

  <!-- Difference Span Bracket (DATEDIFF) -->
  <g>
    <path d="M ${midX} ${axisY + 58} L ${midX} ${axisY + 68} L ${rightX} ${axisY + 68} L ${rightX} ${axisY + 58}" fill="none" stroke="#fbbf24" stroke-width="1.5"/>
    <rect x="${(midX + rightX) / 2 - 95}" y="${axisY + 74}" width="190" height="22" rx="4" fill="#451a03" stroke="#f59e0b" stroke-width="1"/>
    <text x="${(midX + rightX) / 2}" y="${axisY + 89}" fill="#fde68a" font-size="10" font-weight="bold" text-anchor="middle" font-family="monospace">DATEDIFF('2020-09-15', '2020-09-05') = 10</text>
  </g>

  <!-- Footer Tag -->
  ${isIllustrative ? `
    <text x="${width - 24}" y="${height - 12}" fill="#f59e0b" font-size="9" font-weight="600" text-anchor="end" font-family="system-ui">[Calendar Date Arithmetic]</text>
  ` : ''}
</svg>`.trim();
}

/**
 * 3. Flowchart & State Transition Generator
 */
function renderFlowchartSvg(spec = {}) {
  const width = spec.width || 560;
  const nodes = spec.nodes || [
    { id: 'start', label: 'Start / Input', type: 'start' },
    { id: 'cond', label: 'Condition Check', type: 'decision' },
    { id: 'step1', label: 'Execute Algorithm Step', type: 'process' },
    { id: 'end', label: 'Return Result', type: 'end' },
  ];
  const edges = spec.edges || [
    { from: 'start', to: 'cond' },
    { from: 'cond', to: 'step1', label: 'True' },
    { from: 'step1', to: 'cond', label: 'Loop' },
    { from: 'cond', to: 'end', label: 'False' },
  ];
  const title = spec.title || 'Process Flowchart';

  const nodeHeight = 44;
  const nodeWidth = 140;
  const startY = 60;
  const stepY = 68;

  const totalH = Math.max(260, startY + nodes.length * stepY + 30);

  let nodesSvg = '';
  nodes.forEach((n, idx) => {
    const nx = (width - nodeWidth) / 2;
    const ny = startY + idx * stepY;
    const isDecision = n.type === 'decision';

    const fill = isDecision ? '#78350f' : n.type === 'start' ? '#064e3b' : n.type === 'end' ? '#831843' : '#1e3a8a';
    const stroke = isDecision ? '#f59e0b' : n.type === 'start' ? '#10b981' : n.type === 'end' ? '#f43f5e' : '#3b82f6';

    nodesSvg += `
      <g>
        <rect x="${nx}" y="${ny}" width="${nodeWidth}" height="${nodeHeight}" rx="${isDecision ? 8 : 6}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
        <text x="${nx + nodeWidth / 2}" y="${ny + 26}" fill="#ffffff" font-size="12" font-weight="600" text-anchor="middle" font-family="system-ui">${n.label}</text>
      </g>
    `;

    // Arrow to next node
    if (idx < nodes.length - 1) {
      const nextY = startY + (idx + 1) * stepY;
      nodesSvg += `
        <line x1="${width / 2}" y1="${ny + nodeHeight}" x2="${width / 2}" y2="${nextY - 4}" stroke="#64748b" stroke-width="2"/>
        <polygon points="${width / 2},${nextY} ${width / 2 - 4},${nextY - 6} ${width / 2 + 4},${nextY - 6}" fill="#64748b"/>
      `;
    }
  });

  return `
<svg viewBox="0 0 ${width} ${totalH}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="background:#090d16; border-radius:10px; border:1px solid #1e293b; max-width:${width}px;">
  <text x="24" y="28" fill="#f8fafc" font-size="13" font-weight="700" font-family="system-ui">${title}</text>
  ${nodesSvg}
</svg>`.trim();
}

function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 4. Hierarchical Tree Diagram Generator (Binary trees, search trees, taxonomies)
 */
function renderTreeDiagramSvg(spec = {}) {
  const width = spec.width || 560;
  const height = spec.height || 260;
  const title = escapeXml(spec.title || 'Hierarchical Tree Structure');

  const root = spec.root || { label: 'Root', children: [{ label: 'Left' }, { label: 'Right' }] };

  // Level-order layout
  const levels = [];
  const queue = [{ node: root, depth: 0, parent: null }];
  let totalNodes = 0;
  const placed = [];

  while (queue.length > 0 && totalNodes < 16) {
    const item = queue.shift();
    totalNodes++;
    if (!levels[item.depth]) levels[item.depth] = [];
    levels[item.depth].push(item);
    placed.push(item);

    if (Array.isArray(item.node.children)) {
      item.node.children.forEach((c) => {
        queue.push({
          node: typeof c === 'string' ? { label: c } : c,
          depth: item.depth + 1,
          parent: item,
        });
      });
    }
  }

  const numLevels = Math.max(1, levels.length);
  const levelH = Math.min(75, (height - 80) / numLevels);

  // Position nodes evenly
  levels.forEach((lvl, d) => {
    const count = lvl.length;
    const spacing = width / (count + 1);
    lvl.forEach((item, i) => {
      item.x = spacing * (i + 1);
      item.y = 65 + d * levelH;
    });
  });

  let linesSvg = '';
  let nodesSvg = '';

  placed.forEach((item) => {
    if (item.parent) {
      linesSvg += `<line x1="${item.parent.x}" y1="${item.parent.y + 16}" x2="${item.x}" y2="${item.y - 16}" stroke="#64748b" stroke-width="1.5"/>`;
    }
    const lbl = escapeXml(item.node.label || 'Node');
    nodesSvg += `
      <g>
        <circle cx="${item.x}" cy="${item.y}" r="18" fill="#1e3a8a" stroke="#3b82f6" stroke-width="2"/>
        <text x="${item.x}" y="${item.y + 4}" fill="#ffffff" font-size="11" font-weight="600" text-anchor="middle" font-family="system-ui">${lbl}</text>
      </g>
    `;
  });

  return `
<svg viewBox="0 0 ${width} ${height}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="background:#090d16; border-radius:10px; border:1px solid #1e293b; max-width:${width}px;">
  <text x="24" y="28" fill="#f8fafc" font-size="13" font-weight="700" font-family="system-ui">${title}</text>
  ${linesSvg}
  ${nodesSvg}
</svg>`.trim();
}

/**
 * 5. System Block Diagram Generator (Architectures, Pipelines, Flow of Data)
 */
function renderBlockDiagramSvg(spec = {}) {
  const width = spec.width || 600;
  const height = spec.height || 220;
  const title = escapeXml(spec.title || 'System Architecture / Block Diagram');
  const blocks = Array.isArray(spec.blocks) && spec.blocks.length > 0
    ? spec.blocks
    : [
        { label: 'Client / UI', desc: 'Browser App' },
        { label: 'API Gateway', desc: 'Express / Auth' },
        { label: 'Core Service', desc: 'Business Logic' },
        { label: 'Database', desc: 'Persistent Storage' },
      ];

  const n = blocks.length;
  const blockW = Math.max(90, Math.min(120, (width - 60 - (n - 1) * 35) / n));
  const blockH = 70;
  const startY = (height - blockH) / 2 + 10;
  const totalSpan = n * blockW + (n - 1) * 35;
  const startX = (width - totalSpan) / 2;

  let blocksSvg = '';
  blocks.forEach((b, i) => {
    const bx = startX + i * (blockW + 35);
    const label = escapeXml(b.label || `Block ${i + 1}`);
    const desc = escapeXml(b.desc || b.description || '');

    blocksSvg += `
      <g>
        <rect x="${bx}" y="${startY}" width="${blockW}" height="${blockH}" rx="8" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5"/>
        <text x="${bx + blockW / 2}" y="${startY + 28}" fill="#ffffff" font-size="12" font-weight="700" text-anchor="middle" font-family="system-ui">${label}</text>
        ${desc ? `<text x="${bx + blockW / 2}" y="${startY + 48}" fill="#94a3b8" font-size="10" text-anchor="middle" font-family="system-ui">${desc}</text>` : ''}
      </g>
    `;

    if (i < n - 1) {
      const ax1 = bx + blockW;
      const ax2 = bx + blockW + 35;
      const ay = startY + blockH / 2;
      blocksSvg += `
        <line x1="${ax1}" y1="${ay}" x2="${ax2 - 4}" y2="${ay}" stroke="#0ea5e9" stroke-width="2"/>
        <polygon points="${ax2},${ay} ${ax2 - 6},${ay - 4} ${ax2 - 6},${ay + 4}" fill="#0ea5e9"/>
      `;
    }
  });

  return `
<svg viewBox="0 0 ${width} ${height}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="background:#090d16; border-radius:10px; border:1px solid #1e293b; max-width:${width}px;">
  <text x="24" y="28" fill="#f8fafc" font-size="13" font-weight="700" font-family="system-ui">${title}</text>
  ${blocksSvg}
</svg>`.trim();
}

/**
 * 6. Geometry Diagram Generator (Circles, radius, diameter, area, geometric figures)
 */
function renderGeometryDiagramSvg(spec = {}) {
  const width = spec.width || 560;
  const height = spec.height || 260;
  const title = escapeXml(spec.title || 'Geometric Figure: Circle & Area Formula');
  const shape = (spec.shape || 'circle').toLowerCase();

  if (shape.includes('circle')) {
    const cx = 160;
    const cy = 135;
    const r = 70;
    const radiusLabel = escapeXml(spec.radiusLabel || spec.radius || 'r');
    const formulaStr = escapeXml(spec.formula || 'A = \\pi r^2');
    const radAngle = 25 * (Math.PI / 180);
    const px = cx + r * Math.cos(radAngle);
    const py = cy - r * Math.sin(radAngle);
    const midX = (cx + px) / 2;
    const midY = (cy + py) / 2;

    return `
<svg viewBox="0 0 ${width} ${height}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="background:#090d16; border-radius:10px; border:1px solid #1e293b; max-width:${width}px;">
  <!-- Title -->
  <text x="24" y="28" fill="#f8fafc" font-size="13" font-weight="700" font-family="system-ui">${title}</text>
  
  <!-- Circle Shape with Translucent Fill -->
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="#0284c7" fill-opacity="0.12" stroke="#38bdf8" stroke-width="2.5"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#0ea5e9" stroke-width="1" stroke-dasharray="4,4"/>

  <!-- Center Point O -->
  <circle cx="${cx}" cy="${cy}" r="4" fill="#38bdf8"/>
  <text x="${cx - 14}" y="${cy + 5}" fill="#94a3b8" font-size="12" font-weight="600" font-family="system-ui">O</text>

  <!-- Radius Line -->
  <line x1="${cx}" y1="${cy}" x2="${px}" y2="${py}" stroke="#f59e0b" stroke-width="2.5"/>
  <circle cx="${px}" cy="${py}" r="3" fill="#f59e0b"/>
  
  <!-- Radius Label -->
  <rect x="${midX - 12}" y="${midY - 22}" width="24" height="18" rx="4" fill="#090d16" stroke="#f59e0b" stroke-width="1"/>
  <text x="${midX}" y="${midY - 9}" fill="#fbbf24" font-size="12" font-weight="700" text-anchor="middle" font-family="system-ui">${radiusLabel}</text>

  <!-- Formula & Educational Legend Card -->
  <g transform="translate(300, 55)">
    <rect x="0" y="0" width="235" height="165" rx="8" fill="#1e293b" fill-opacity="0.75" stroke="#334155" stroke-width="1.5"/>
    <text x="16" y="26" fill="#38bdf8" font-size="11" font-weight="700" font-family="system-ui">CIRCLE RELATIONSHIPS</text>
    
    <text x="16" y="54" fill="#cbd5e1" font-size="12" font-family="system-ui">Area: <tspan fill="#38bdf8" font-weight="700">${formulaStr}</tspan></text>
    <text x="16" y="80" fill="#cbd5e1" font-size="11" font-family="system-ui">Circumference: <tspan fill="#ffffff" font-weight="700">C = 2πr</tspan></text>
    <text x="16" y="104" fill="#cbd5e1" font-size="11" font-family="system-ui">Diameter: <tspan fill="#ffffff" font-weight="700">d = 2r</tspan></text>
    
    <line x1="16" y1="118" x2="219" y2="118" stroke="#334155" stroke-width="1"/>
    <text x="16" y="136" fill="#38bdf8" font-size="10" font-weight="700" font-family="system-ui">Quadratic Scaling (A ∝ r²):</text>
    <text x="16" y="152" fill="#fbbf24" font-size="9" font-family="system-ui">Doubling r quadruples the enclosed area</text>
  </g>
</svg>`.trim();
  }

  return renderBlockDiagramSvg(spec);
}

/**
 * 7. Biological System & Physiological Pathway Generator
 */
function renderBiologicalSystemSvg(spec = {}) {
  const width = spec.width || 560;
  const height = spec.height || 260;
  const title = escapeXml(spec.title || 'Human Excretory System: Functional Pathway');

  const stages = Array.isArray(spec.stages) && spec.stages.length > 0
    ? spec.stages
    : [
        { name: 'Kidneys', role: 'Filtration (~1M Nephrons)', color: '#065f46' },
        { name: 'Ureters', role: 'Urine Conduction', color: '#1e3a8a' },
        { name: 'Urinary Bladder', role: 'Storage & Distension', color: '#78350f' },
        { name: 'Urethra', role: 'Micturition & Exit', color: '#831843' },
      ];

  const n = stages.length;
  const cardW = Math.max(90, Math.min(115, (width - 60 - (n - 1) * 20) / n));
  const cardH = 80;
  const totalW = n * cardW + (n - 1) * 20;
  const startX = (width - totalW) / 2;
  const startY = 85;

  let stagesSvg = '';
  stages.forEach((s, idx) => {
    const sx = startX + idx * (cardW + 20);
    const name = escapeXml(s.name || `Organ ${idx + 1}`);
    const role = escapeXml(s.role || s.description || '');
    const fill = s.color || '#1e293b';

    stagesSvg += `
      <g>
        <rect x="${sx}" y="${startY}" width="${cardW}" height="${cardH}" rx="8" fill="${fill}" stroke="#38bdf8" stroke-width="1.5"/>
        <text x="${sx + cardW / 2}" y="${startY + 26}" fill="#ffffff" font-size="11" font-weight="700" text-anchor="middle" font-family="system-ui">${name}</text>
        <text x="${sx + cardW / 2}" y="${startY + 48}" fill="#e2e8f0" font-size="9" text-anchor="middle" font-family="system-ui">${role.slice(0, 20)}</text>
        ${role.length > 20 ? `<text x="${sx + cardW / 2}" y="${startY + 62}" fill="#cbd5e1" font-size="8.5" text-anchor="middle" font-family="system-ui">${role.slice(20, 42)}</text>` : ''}
      </g>
    `;

    if (idx < n - 1) {
      const ax1 = sx + cardW;
      const ax2 = ax1 + 20;
      const ay = startY + cardH / 2;
      stagesSvg += `
        <line x1="${ax1}" y1="${ay}" x2="${ax2 - 3}" y2="${ay}" stroke="#38bdf8" stroke-width="2"/>
        <polygon points="${ax2},${ay} ${ax2 - 5},${ay - 3.5} ${ax2 - 5},${ay + 3.5}" fill="#38bdf8"/>
      `;
    }
  });

  return `
<svg viewBox="0 0 ${width} ${height}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="background:#090d16; border-radius:10px; border:1px solid #1e293b; max-width:${width}px;">
  <text x="24" y="28" fill="#f8fafc" font-size="13" font-weight="700" font-family="system-ui">${title}</text>
  <text x="24" y="48" fill="#94a3b8" font-size="10.5" font-family="system-ui">Anatomical & Physiological Sequence of Organ Function</text>
  ${stagesSvg}
</svg>`.trim();
}

/**
 * 8. Preserved Source Diagram Card (Embeds actual captured blackboard/screen diagram)
 */
function renderPreservedSourceDiagramSvg(spec = {}) {
  const width = spec.width || 560;
  const height = spec.height || 280;
  const title = escapeXml(spec.title || 'Original Lecture Diagram');
  const caption = escapeXml(spec.caption || 'Captured directly from lecture materials');
  const labels = Array.isArray(spec.labels) ? spec.labels : [];

  let labelsBadgeSvg = '';
  labels.slice(0, 6).forEach((lbl, idx) => {
    const lx = 24 + idx * 85;
    if (lx < width - 90) {
      labelsBadgeSvg += `
        <rect x="${lx}" y="${height - 35}" width="80" height="20" rx="4" fill="#1e293b" stroke="#38bdf8" stroke-width="1"/>
        <text x="${lx + 40}" y="${height - 21}" fill="#38bdf8" font-size="9" font-weight="600" text-anchor="middle" font-family="system-ui">${escapeXml(lbl)}</text>
      `;
    }
  });

  let imageEmbed = '';
  let imgBase64 = spec.imageBase64;
  if (!imgBase64 && spec.imagePath) {
    try {
      const candidates = [
        spec.imagePath,
        path.join(__dirname, '..', 'data', 'snapshots', path.basename(spec.imagePath)),
        path.join(__dirname, '..', 'data', spec.imagePath),
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          const ext = path.extname(p).slice(1) || 'jpeg';
          const buf = fs.readFileSync(p);
          imgBase64 = `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${buf.toString('base64')}`;
          break;
        }
      }
    } catch (_) {}
  }

  if (imgBase64) {
    const src = imgBase64.startsWith('data:') ? imgBase64 : `data:image/jpeg;base64,${imgBase64}`;
    imageEmbed = `<image href="${src}" x="24" y="55" width="${width - 48}" height="${height - 100}" preserveAspectRatio="xMidYMid meet"/>`;
  } else {
    imageEmbed = `
      <rect x="24" y="55" width="${width - 48}" height="${height - 100}" rx="6" fill="#0f172a" stroke="#334155" stroke-dasharray="4,4"/>
      <text x="${width / 2}" y="125" fill="#38bdf8" font-size="13" font-weight="700" text-anchor="middle" font-family="system-ui">📷 Preserved Original Diagram</text>
      <text x="${width / 2}" y="145" fill="#94a3b8" font-size="11" text-anchor="middle" font-family="system-ui">${caption}</text>
    `;
  }

  return `
<svg viewBox="0 0 ${width} ${height}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="background:#090d16; border-radius:10px; border:1px solid #1e293b; max-width:${width}px;">
  <text x="24" y="28" fill="#f8fafc" font-size="13" font-weight="700" font-family="system-ui">${title}</text>
  <text x="24" y="45" fill="#38bdf8" font-size="10" font-weight="600" font-family="system-ui">[PRESERVED SOURCE DIAGRAM]</text>
  ${imageEmbed}
  ${labelsBadgeSvg}
</svg>`.trim();
}

/**
 * Extensible Renderer Registry
 */
class RendererRegistry {
  constructor() {
    this.renderers = new Map();
    this.validators = new Map();
  }

  register(type, renderFn, validatorFn = null) {
    const key = String(type).toLowerCase().trim();
    this.renderers.set(key, renderFn);
    if (validatorFn) this.validators.set(key, validatorFn);
    return this;
  }

  get(type) {
    return this.renderers.get(String(type).toLowerCase().trim());
  }

  has(type) {
    return this.renderers.has(String(type).toLowerCase().trim());
  }

  list() {
    return Array.from(this.renderers.keys());
  }

  render(spec = {}) {
    const type = (spec.visualizationType || spec.type || '').toLowerCase().trim();
    const titleLower = (spec.title || '').toLowerCase();
    const headingLower = (spec.heading || spec.sectionHeading || '').toLowerCase();
    const exprLower = (spec.expression || spec.sql || spec.equation || '').toLowerCase();
    const combined = `${type} ${titleLower} ${headingLower} ${exprLower}`;

    // 1. High-priority semantic routing: prevent cross-domain contamination
    if (combined.includes('coalesce') || combined.includes('null-handling') || combined.includes('null handling')) {
      const cFn = this.renderers.get('null_coalesce_flow') || renderNullCoalesceFlowSvg;
      return cFn(spec);
    }
    if (combined.includes('string function') || combined.includes('string manipulation') || combined.includes('upper(') || combined.includes('trim(')) {
      const sFn = this.renderers.get('string_transformation') || renderStringTransformationSvg;
      return sFn(spec);
    }
    if (combined.includes('date arithmetic') || combined.includes('datediff') || combined.includes('date_add') || combined.includes('date and time')) {
      const dFn = this.renderers.get('date_timeline') || renderDateTimelineSvg;
      return dFn(spec);
    }
    if (combined.includes('circle') || exprLower.includes('r^2') || exprLower.includes('r²')) {
      const geomFn = this.renderers.get('geometry_diagram') || renderGeometryDiagramSvg;
      return geomFn(spec);
    }
    if (combined.includes('excret') || combined.includes('kidney') || combined.includes('urinary')) {
      const bioFn = this.renderers.get('biological_system') || renderBiologicalSystemSvg;
      return bioFn(spec);
    }

    // Exact match
    if (this.renderers.has(type)) {
      return this.renderers.get(type)(spec);
    }

    // Fuzzy matches
    for (const [key, fn] of this.renderers.entries()) {
      if (type.includes(key) || key.includes(type)) {
        return fn(spec);
      }
    }

    // Content-aware fallbacks (never force geometry or biology into software flowchart!)
    if (type.includes('geometry') || type.includes('circle') || spec.shape === 'circle' || spec.radius || (spec.formula && spec.formula.includes('r^2'))) {
      const geomFn = this.renderers.get('geometry_diagram') || renderGeometryDiagramSvg;
      return geomFn(spec);
    }
    if (type.includes('biology') || type.includes('excret') || type.includes('kidney') || type.includes('organ') || type.includes('anatomy')) {
      const bioFn = this.renderers.get('biological_system') || renderBiologicalSystemSvg;
      return bioFn(spec);
    }
    if (type.includes('source') || spec.isSourceDiagram || spec.imagePath || spec.imageBase64) {
      const srcFn = this.renderers.get('preserved_source_diagram') || renderPreservedSourceDiagramSvg;
      return srcFn(spec);
    }
    // Dedicated SQL renderers: prevent array/binary search or graph fallback for SQL topics
    if (type.includes('coalesce') || type.includes('null') || (spec.title && spec.title.toLowerCase().includes('coalesce')) || (spec.expression && spec.expression.toLowerCase().includes('coalesce'))) {
      const cFn = this.renderers.get('null_coalesce_flow') || renderNullCoalesceFlowSvg;
      return cFn(spec);
    }
    if (type.includes('string') || type.includes('substring') || type.includes('concat') || type.includes('trim') || (spec.title && spec.title.toLowerCase().includes('string function'))) {
      const sFn = this.renderers.get('string_transformation') || renderStringTransformationSvg;
      return sFn(spec);
    }
    if (type.includes('date') || type.includes('time') || spec.baseDate || (spec.title && spec.title.toLowerCase().includes('date'))) {
      const dFn = this.renderers.get('date_timeline') || renderDateTimelineSvg;
      return dFn(spec);
    }
    if (type.includes('graph') || type.includes('coordinate') || type.includes('plot') || spec.fn || spec.expression || spec.slopeTriangle) {
      const gFn = this.renderers.get('coordinate_graph') || renderCoordinateGraphSvg;
      return gFn(spec);
    }
    if (type.includes('tree') || type.includes('hierarchy') || spec.root) {
      const tFn = this.renderers.get('tree_diagram') || renderTreeDiagramSvg;
      return tFn(spec);
    }
    if (type.includes('block') || type.includes('architecture') || spec.blocks) {
      const bFn = this.renderers.get('block_diagram') || renderBlockDiagramSvg;
      return bFn(spec);
    }
    if (type.includes('algorithm') || type.includes('array') || type.includes('search')) {
      const aFn = this.renderers.get('algorithm_steps') || renderAlgorithmSvg;
      return aFn(spec);
    }

    // Default fallback: flowchart
    const defaultRenderer = this.renderers.get('flowchart') || renderFlowchartSvg;
    return defaultRenderer(spec);
  }
}

// Global registry singleton
const diagramRegistry = new RendererRegistry();
diagramRegistry
  .register('coordinate_graph', renderCoordinateGraphSvg)
  .register('algorithm_steps', renderAlgorithmSvg)
  .register('flowchart', renderFlowchartSvg)
  .register('tree_diagram', renderTreeDiagramSvg)
  .register('block_diagram', renderBlockDiagramSvg)
  .register('geometry_diagram', renderGeometryDiagramSvg)
  .register('circle', renderGeometryDiagramSvg)
  .register('biological_system', renderBiologicalSystemSvg)
  .register('anatomy_diagram', renderBiologicalSystemSvg)
  .register('preserved_source_diagram', renderPreservedSourceDiagramSvg)
  .register('null_coalesce_flow', renderNullCoalesceFlowSvg)
  .register('coalesce_flow', renderNullCoalesceFlowSvg)
  .register('null_handling', renderNullCoalesceFlowSvg)
  .register('string_transformation', renderStringTransformationSvg)
  .register('sql_string', renderStringTransformationSvg)
  .register('string_functions', renderStringTransformationSvg)
  .register('date_timeline', renderDateTimelineSvg)
  .register('date_arithmetic', renderDateTimelineSvg)
  .register('sql_date', renderDateTimelineSvg)
  .register('date_functions', renderDateTimelineSvg);

/**
 * Master dispatcher: uses RendererRegistry to deterministically render SVG
 */
function generateDiagramSvg(spec = {}) {
  return diagramRegistry.render(spec);
}

module.exports = {
  renderCoordinateGraphSvg,
  renderAlgorithmSvg,
  renderFlowchartSvg,
  renderTreeDiagramSvg,
  renderBlockDiagramSvg,
  renderGeometryDiagramSvg,
  renderBiologicalSystemSvg,
  renderPreservedSourceDiagramSvg,
  renderNullCoalesceFlowSvg,
  renderStringTransformationSvg,
  renderDateTimelineSvg,
  RendererRegistry,
  diagramRegistry,
  generateDiagramSvg,
  evaluateMathExpression,
  escapeXml,
};

