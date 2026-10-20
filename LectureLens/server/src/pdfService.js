const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('./db');
const { gatherLectureMultimodalContext } = require('./summaryService');
const { evaluateMathExpression } = require('./visualizationEngine');

const PDF_DIR = path.join(__dirname, '..', 'data', 'pdfs');
if (!fs.existsSync(PDF_DIR)) {
  fs.mkdirSync(PDF_DIR, { recursive: true });
}

function formatOffset(seconds = 0) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * ── PDF Vector Visualization Renderers ────────────────────────────────────────
 */

function drawPdfCoordinateGraph(doc, startX, startY, width, height, spec = {}) {
  // Save graphics state
  doc.save();

  // Background card
  doc.roundedRect(startX, startY, width, height, 8).fillAndStroke('#090d16', '#1e293b');

  // Title
  const title = spec.title || spec.equation || 'Coordinate Plot';
  doc.fillColor('#f8fafc').fontSize(10).font('Helvetica-Bold').text(title, startX + 16, startY + 10);
  if (spec.equation) {
    doc.fillColor('#38bdf8').fontSize(9).font('Courier-Bold').text(spec.equation, startX + width - 140, startY + 10, { width: 120, align: 'right' });
  }

  // Plot Area bounds
  const pLeft = startX + 45;
  const pTop = startY + 28;
  const pWidth = width - 75;
  const pHeight = height - 52;

  const xDomain = Array.isArray(spec.xDomain) && spec.xDomain.length === 2 ? spec.xDomain : [0, 8];
  const yDomain = Array.isArray(spec.yDomain) && spec.yDomain.length === 2 ? spec.yDomain : [0, 16];
  const minX = Number(xDomain[0]) || 0;
  const maxX = Number(xDomain[1]) || (minX + 8);
  const minY = Number(yDomain[0]) || 0;
  const maxY = Number(yDomain[1]) || (minY + 16);
  const spanX = (maxX - minX) || 1;
  const spanY = (maxY - minY) || 1;

  const toPdfX = (x) => {
    const num = Number(x);
    if (!Number.isFinite(num)) return pLeft;
    return pLeft + ((num - minX) / spanX) * pWidth;
  };
  const toPdfY = (y) => {
    const num = Number(y);
    if (!Number.isFinite(num)) return pTop + pHeight;
    return pTop + pHeight - ((num - minY) / spanY) * pHeight;
  };

  // Grid lines
  const xStep = Math.max(1, Math.round(spanX / 6));
  const yStep = Math.max(1, Math.round(spanY / 5));

  doc.strokeColor('#1e293b').lineWidth(0.5).dash(2, { space: 2 });
  for (let x = Math.ceil(minX); x <= maxX; x += xStep) {
    const sx = toPdfX(x);
    if (Number.isFinite(sx)) {
      doc.moveTo(sx, pTop).lineTo(sx, pTop + pHeight).stroke();
      doc.fillColor('#64748b').fontSize(7.5).font('Helvetica').text(x.toString(), sx - 6, pTop + pHeight + 4);
    }
  }

  for (let y = Math.ceil(minY); y <= maxY; y += yStep) {
    const sy = toPdfY(y);
    if (Number.isFinite(sy)) {
      doc.moveTo(pLeft, sy).lineTo(pLeft + pWidth, sy).stroke();
      doc.fillColor('#64748b').fontSize(7.5).font('Helvetica').text(y.toString(), pLeft - 22, sy - 3);
    }
  }
  doc.undash();

  // Axes lines (at boundary or origin)
  const originX = Math.max(minX, Math.min(maxX, 0));
  const originY = Math.max(minY, Math.min(maxY, 0));
  const axX = toPdfX(originX);
  const axY = toPdfY(originY);

  doc.strokeColor('#94a3b8').lineWidth(1.5);
  // X axis
  if (Number.isFinite(axY)) {
    doc.moveTo(pLeft, axY).lineTo(pLeft + pWidth + 8, axY).stroke();
    doc.polygon([pLeft + pWidth + 12, axY], [pLeft + pWidth + 6, axY - 3], [pLeft + pWidth + 6, axY + 3]).fill('#94a3b8');
  }

  // Y axis
  if (Number.isFinite(axX)) {
    doc.moveTo(axX, pTop + pHeight).lineTo(axX, pTop - 8).stroke();
    doc.polygon([axX, pTop - 12], [axX - 3, pTop - 6], [axX + 3, pTop - 6]).fill('#94a3b8');
  }

  // Axis Labels
  if (Number.isFinite(axY)) {
    doc.fillColor('#cbd5e1').fontSize(8.5).font('Helvetica-Bold').text(spec.xAxisLabel || 'x', pLeft + pWidth + 14, axY - 4);
  }
  if (Number.isFinite(axX)) {
    doc.text(spec.yAxisLabel || 'y', axX - 6, pTop - 20);
  }

  // Plot Curve
  const fnStr = spec.fn || spec.expression || 'x';
  const steps = 60;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const curX = minX + (i / steps) * spanX;
    const curY = evaluateMathExpression(fnStr, curX);
    if (Number.isFinite(curY)) {
      const px = toPdfX(curX);
      const py = toPdfY(Math.max(minY, Math.min(maxY, curY)));
      if (Number.isFinite(px) && Number.isFinite(py)) {
        pts.push({ px, py });
      }
    }
  }

  if (pts.length > 1) {
    doc.strokeColor('#38bdf8').lineWidth(2);
    doc.moveTo(pts[0].px, pts[0].py);
    for (let i = 1; i < pts.length; i++) {
      doc.lineTo(pts[i].px, pts[i].py);
    }
    doc.stroke();
  }

  // Marked points (e.g. intercepts)
  if (Array.isArray(spec.points)) {
    spec.points.forEach((pt) => {
      const numX = Number(pt.x);
      const numY = Number(pt.y);
      if (!Number.isFinite(numX) || !Number.isFinite(numY)) return;
      const px = toPdfX(numX);
      const py = toPdfY(numY);
      if (!Number.isFinite(px) || !Number.isFinite(py)) return;
      doc.circle(px, py, 3.5).fill('#38bdf8');
      doc.circle(px, py, 6).lineWidth(1).strokeColor('#38bdf8').stroke();
      if (pt.label != null) {
        doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold').text(String(pt.label), px + 8, py - 6);
      }
    });
  }

  // Slope Triangle
  if (spec.slopeTriangle && Number.isFinite(Number(spec.slopeTriangle.x1)) && Number.isFinite(Number(spec.slopeTriangle.x2))) {
    const x1 = Number(spec.slopeTriangle.x1);
    const x2 = Number(spec.slopeTriangle.x2);
    const label = spec.slopeTriangle.label;
    const y1 = evaluateMathExpression(fnStr, x1);
    const y2 = evaluateMathExpression(fnStr, x2);
    const sx1 = toPdfX(x1);
    const sy1 = toPdfY(y1);
    const sx2 = toPdfX(x2);
    const sy2 = toPdfY(y2);

    if (Number.isFinite(sx1) && Number.isFinite(sy1) && Number.isFinite(sx2) && Number.isFinite(sy2)) {
      doc.strokeColor('#f59e0b').lineWidth(1).dash(2, { space: 2 });
      doc.moveTo(sx1, sy1).lineTo(sx2, sy1).lineTo(sx2, sy2).stroke();
      doc.undash();
      if (label) {
        doc.fillColor('#fbbf24').fontSize(7.5).font('Helvetica-Bold').text(String(label), sx2 + 6, (sy1 + sy2) / 2 - 4);
      }
    }
  }

  doc.restore();
}

function drawPdfAlgorithmSteps(doc, startX, startY, width, height, spec = {}) {
  doc.save();
  doc.roundedRect(startX, startY, width, height, 8).fillAndStroke('#090d16', '#1e293b');

  doc.fillColor('#f8fafc').fontSize(10).font('Helvetica-Bold').text(spec.title || 'Algorithm Steps', startX + 16, startY + 10);

  // If spec.steps is provided without spec.array, render clean step sequence!
  if (Array.isArray(spec.steps) && spec.steps.length > 0 && !spec.array) {
    const steps = spec.steps.slice(0, 4);
    const stepW = Math.min(115, Math.floor((width - 48 - (steps.length - 1) * 10) / steps.length));
    const totalW = steps.length * stepW + (steps.length - 1) * 10;
    const sStartX = startX + (width - totalW) / 2;
    const sStartY = startY + 36;
    const sHeight = height - 52;

    steps.forEach((st, idx) => {
      const bx = sStartX + idx * (stepW + 10);
      const text = typeof st === 'string' ? st : (st.text || st.label || '');

      doc.roundedRect(bx, sStartY, stepW, sHeight, 4).fillAndStroke('#181f2f', '#3b82f6');
      doc.circle(bx + 12, sStartY + 12, 7).fill('#2563eb');
      doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold').text((idx + 1).toString(), bx + 7, sStartY + 8, { width: 10, align: 'center' });
      doc.fillColor('#e2e8f0').fontSize(7.5).font('Helvetica').text(text, bx + 6, sStartY + 24, { width: stepW - 12, height: sHeight - 28 });

      if (idx < steps.length - 1) {
        const arrX = bx + stepW + 1;
        doc.strokeColor('#60a5fa').lineWidth(1.2).moveTo(arrX, sStartY + sHeight / 2).lineTo(arrX + 6, sStartY + sHeight / 2).stroke();
      }
    });

    doc.restore();
    return;
  }

  const array = spec.array || [2, 5, 8, 12, 16, 23, 38, 56];
  const target = spec.target != null ? spec.target : 23;
  const low = spec.low != null ? spec.low : 4;
  const mid = spec.mid != null ? spec.mid : 5;
  const high = spec.high != null ? spec.high : 7;

  const boxW = Math.min(34, Math.floor((width - 60) / array.length));
  const totalArrW = array.length * boxW;
  const aStartX = startX + (width - totalArrW) / 2;
  const aStartY = startY + 45;

  array.forEach((val, idx) => {
    const bx = aStartX + idx * boxW;
    const isMid = idx === mid;
    const isInRange = idx >= low && idx <= high;

    const bg = isMid ? '#2563eb' : isInRange ? '#1e293b' : '#111827';
    const border = isMid ? '#60a5fa' : '#334155';

    doc.roundedRect(bx, aStartY, boxW - 3, 28, 4).fillAndStroke(bg, border);
    doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold').text(val.toString(), bx, aStartY + 8, { width: boxW - 3, align: 'center' });
    doc.fillColor('#94a3b8').fontSize(7).font('Helvetica').text(idx.toString(), bx, aStartY + 32, { width: boxW - 3, align: 'center' });
  });

  // Pointers
  const midX = aStartX + mid * boxW + (boxW - 3) / 2;
  doc.fillColor('#fbbf24').fontSize(8).font('Helvetica-Bold').text(`MID [${mid}]`, midX - 25, aStartY - 18, { width: 50, align: 'center' });
  doc.strokeColor('#fbbf24').lineWidth(1.5).moveTo(midX, aStartY - 6).lineTo(midX, aStartY - 1).stroke();

  // Status banner
  const comparison = spec.comparison || `Target ${target} located at index ${mid} in O(log n) time.`;
  doc.roundedRect(startX + 16, startY + height - 26, width - 32, 18, 4).fillAndStroke('#064e3b', '#059669');
  doc.fillColor('#6ee7b7').fontSize(8).font('Helvetica-Bold').text('✓ ' + comparison, startX + 20, startY + height - 22, { width: width - 40, align: 'center' });

  doc.restore();
}

function drawPdfNullCoalesceFlow(doc, startX, startY, width, height, spec = {}) {
  doc.save();
  doc.roundedRect(startX, startY, width, height, 8).fillAndStroke('#090d16', '#1e293b');

  // Title
  const title = spec.title || 'SQL COALESCE() Null-Handling Flow';
  doc.fillColor('#f8fafc').fontSize(10).font('Helvetica-Bold').text(title, startX + 16, startY + 10);

  // Expression Banner
  const expr = spec.expression || spec.sql || "SELECT name, COALESCE(dept, 'Unknown') FROM employee;";
  doc.roundedRect(startX + 16, startY + 25, width - 32, 18, 3).fillAndStroke('#1e1b4b', '#4338ca');
  doc.fillColor('#a5b4fc').fontSize(8.5).font('Courier-Bold').text(expr, startX + 22, startY + 30);

  // Table rows
  const rows = Array.isArray(spec.inputRows) && spec.inputRows.length > 0 ? spec.inputRows : [
    { name: 'Alice', dept: "'IT'" },
    { name: 'Bob', dept: null },
    { name: 'Charlie', dept: "'HR'" },
  ];
  const fallback = spec.fallback || "'Unknown'";

  const rStartY = startY + 47;
  const rHeight = 20;
  const colW1 = 70;
  const colW2 = 80;
  const colW3 = 90;

  // Header
  doc.roundedRect(startX + 16, rStartY, width - 32, 15, 2).fill('#1e293b');
  doc.fillColor('#94a3b8').fontSize(7.5).font('Courier-Bold').text('name', startX + 24, rStartY + 4);
  doc.text('dept (raw)', startX + 24 + colW1, rStartY + 4);
  doc.text('dept IS NULL?', startX + 24 + colW1 + colW2, rStartY + 4);
  doc.fillColor('#38bdf8').text('COALESCE Result', startX + 24 + colW1 + colW2 + colW3, rStartY + 4);

  rows.forEach((r, idx) => {
    const ry = rStartY + 18 + idx * (rHeight + 4);
    const isNull = r.dept === null || r.dept === 'NULL' || r.dept === undefined;
    const rawVal = isNull ? 'NULL' : String(r.dept);
    const resultVal = isNull ? fallback : rawVal;

    doc.roundedRect(startX + 16, ry, width - 32, rHeight, 3).fillAndStroke(isNull ? '#2a1a1f' : '#111827', isNull ? '#f43f5e' : '#334155');
    doc.fillColor('#f8fafc').fontSize(8).font('Courier').text(r.name || '', startX + 24, ry + 5);

    // Raw dept
    if (isNull) {
      doc.roundedRect(startX + 24 + colW1, ry + 2, 38, 14, 2).fill('#881337');
      doc.fillColor('#fda4af').fontSize(7.5).font('Courier-Bold').text('NULL', startX + 24 + colW1, ry + 5, { width: 38, align: 'center' });
    } else {
      doc.fillColor('#cbd5e1').fontSize(8).font('Courier').text(rawVal, startX + 24 + colW1, ry + 5);
    }

    // Condition
    doc.roundedRect(startX + 24 + colW1 + colW2, ry + 2, 72, 14, 2).fill(isNull ? '#78350f' : '#064e3b');
    doc.fillColor(isNull ? '#fde68a' : '#a7f3d0').fontSize(7).font('Helvetica-Bold').text(isNull ? 'YES -> Fallback' : 'NO -> Keep Raw', startX + 24 + colW1 + colW2, ry + 5, { width: 72, align: 'center' });

    // Result
    doc.roundedRect(startX + 24 + colW1 + colW2 + colW3, ry + 2, 150, 14, 2).fillAndStroke(isNull ? '#14532d' : '#0f172a', isNull ? '#22c55e' : '#38bdf8');
    doc.fillColor(isNull ? '#86efac' : '#38bdf8').fontSize(7.5).font('Courier-Bold').text(resultVal + (isNull ? ' (replaces NULL)' : ''), startX + 28 + colW1 + colW2 + colW3, ry + 5);
  });

  // Footer Rule
  const footerY = startY + height - 20;
  doc.roundedRect(startX + 16, footerY, width - 32, 15, 3).fillAndStroke('#0b1329', '#1d4ed8');
  doc.fillColor('#93c5fd').fontSize(7).font('Helvetica').text(`* Rule: Returns first non-null argument; falls back to ${fallback} if dept IS NULL. [Illustrative Example]`, startX + 22, footerY + 4);

  doc.restore();
}

function drawPdfStringTransformation(doc, startX, startY, width, height, spec = {}) {
  doc.save();
  doc.roundedRect(startX, startY, width, height, 8).fillAndStroke('#090d16', '#1e293b');

  // Title
  const title = spec.title || 'SQL String Functions: Input -> Output Transformations';
  doc.fillColor('#f8fafc').fontSize(10).font('Helvetica-Bold').text(title, startX + 16, startY + 10);

  // Input String Banner
  const inputStr = spec.input != null ? String(spec.input) : '  LectureLens  ';
  doc.roundedRect(startX + 16, startY + 25, width - 32, 20, 3).fillAndStroke('#181f2f', '#2563eb');
  doc.fillColor('#cbd5e1').fontSize(8).font('Helvetica-Bold').text('INPUT STRING: ', startX + 24, startY + 30, { continued: true });
  doc.fillColor('#38bdf8').font('Courier-Bold').text(`'${inputStr}'`, { continued: true });
  doc.fillColor('#94a3b8').font('Helvetica').text(`   (Length: ${inputStr.length})`);

  const operations = Array.isArray(spec.operations) && spec.operations.length > 0 ? spec.operations : [
    { func: 'UPPER(str)', result: `'${inputStr.toUpperCase()}'`, desc: 'Converts to uppercase' },
    { func: 'LOWER(str)', result: `'${inputStr.toLowerCase()}'`, desc: 'Converts to lowercase' },
    { func: 'LENGTH(str)', result: String(inputStr.length), desc: 'Char count incl spaces' },
    { func: 'TRIM(str)', result: `'${inputStr.trim()}'`, desc: 'Removes outer spaces' },
    { func: 'SUBSTRING(str, 3, 7)', result: `'Lecture'`, desc: 'Extracts 7 chars from pos 3' },
    { func: `CONCAT(TRIM(str), ' AI')`, result: `'LectureLens AI'`, desc: 'Concatenates strings' },
  ];

  const opStartY = startY + 50;
  const cardH = 15;
  const gap = 3;

  operations.slice(0, 6).forEach((op, idx) => {
    const cy = opStartY + idx * (cardH + gap);
    doc.roundedRect(startX + 16, cy, width - 32, cardH, 2).fillAndStroke('#111827', '#1f2937');

    // Func box
    doc.roundedRect(startX + 20, cy + 1, 130, cardH - 2, 2).fill('#1e293b');
    doc.fillColor('#93c5fd').fontSize(7).font('Courier-Bold').text(op.func, startX + 24, cy + 3);

    // Arrow
    doc.strokeColor('#64748b').lineWidth(1).moveTo(startX + 155, cy + cardH / 2).lineTo(startX + 168, cy + cardH / 2).stroke();

    // Result box
    doc.roundedRect(startX + 172, cy + 1, 125, cardH - 2, 2).fill('#064e3b');
    doc.fillColor('#a7f3d0').fontSize(7).font('Courier-Bold').text(op.result, startX + 176, cy + 3);

    // Desc
    if (op.desc) {
      doc.fillColor('#94a3b8').fontSize(6.5).font('Helvetica').text(op.desc, startX + 305, cy + 3);
    }
  });

  // Footer Tag
  doc.fillColor('#f59e0b').fontSize(7).font('Helvetica-Oblique').text('[Illustrative Teaching Examples for SQL String Manipulation]', startX + width - 260, startY + height - 13);

  doc.restore();
}

function drawPdfDateTimeline(doc, startX, startY, width, height, spec = {}) {
  doc.save();
  doc.roundedRect(startX, startY, width, height, 8).fillAndStroke('#090d16', '#1e293b');

  // Title
  const title = spec.title || 'SQL Date & Time Arithmetic Timeline';
  doc.fillColor('#f8fafc').fontSize(10).font('Helvetica-Bold').text(title, startX + 16, startY + 10);

  // Top badges for current date/time functions
  const badges = [
    { label: 'CURRENT_DATE()', color: '#38bdf8' },
    { label: 'CURRENT_TIME()', color: '#38bdf8' },
    { label: 'NOW()', color: '#38bdf8' },
    { label: 'EXTRACT()', color: '#818cf8' },
    { label: 'TIMESTAMPDIFF()', color: '#818cf8' },
  ];
  let bx = startX + 16;
  badges.forEach((b) => {
    const bw = b.label.length * 5.2 + 10;
    doc.roundedRect(bx, startY + 25, bw, 13, 2).fill('#1e293b');
    doc.fillColor(b.color).fontSize(6.5).font('Courier-Bold').text(b.label, bx, startY + 27, { width: bw, align: 'center' });
    bx += bw + 5;
  });

  const baseDate = spec.baseDate || '2020-09-05';
  const axisY = startY + 70;
  const lineStart = startX + 45;
  const lineEnd = startX + width - 45;
  const midX = (lineStart + lineEnd) / 2;
  const leftX = lineStart + 40;
  const rightX = lineEnd - 40;

  // Timeline axis
  doc.strokeColor('#64748b').lineWidth(2).moveTo(lineStart, axisY).lineTo(lineEnd, axisY).stroke();

  // Center: Base Date
  doc.circle(midX, axisY, 5).fill('#38bdf8');
  doc.roundedRect(midX - 35, axisY + 8, 70, 18, 3).fillAndStroke('#0f172a', '#38bdf8');
  doc.fillColor('#38bdf8').fontSize(7.5).font('Courier-Bold').text(`'${baseDate}'`, midX - 35, axisY + 10, { width: 70, align: 'center' });
  doc.fillColor('#94a3b8').fontSize(6).font('Helvetica').text('Base Date', midX - 35, axisY + 19, { width: 70, align: 'center' });

  // Left: DATE_SUB (-10 DAY) -> 2020-08-26
  doc.circle(leftX, axisY, 4).fill('#f43f5e');
  doc.roundedRect(leftX - 35, axisY + 8, 70, 14, 2).fillAndStroke('#111827', '#f43f5e');
  doc.fillColor('#fda4af').fontSize(7).font('Courier-Bold').text("'2020-08-26'", leftX - 35, axisY + 11, { width: 70, align: 'center' });
  // Curve
  doc.strokeColor('#f43f5e').lineWidth(1).dash(2, { space: 2 }).moveTo(midX, axisY - 5).quadraticCurveTo((midX + leftX) / 2, axisY - 24, leftX, axisY - 5).stroke().undash();
  doc.roundedRect((midX + leftX) / 2 - 45, axisY - 28, 90, 11, 2).fill('#881337');
  doc.fillColor('#fecdd3').fontSize(6.5).font('Courier-Bold').text('DATE_SUB(..., 10 DAY)', (midX + leftX) / 2 - 45, axisY - 26, { width: 90, align: 'center' });

  // Right: DATE_ADD (+10 DAY) -> 2020-09-15
  doc.circle(rightX, axisY, 4).fill('#10b981');
  doc.roundedRect(rightX - 35, axisY + 8, 70, 14, 2).fillAndStroke('#111827', '#10b981');
  doc.fillColor('#a7f3d0').fontSize(7).font('Courier-Bold').text("'2020-09-15'", rightX - 35, axisY + 11, { width: 70, align: 'center' });
  // Curve
  doc.strokeColor('#10b981').lineWidth(1.2).moveTo(midX, axisY - 5).quadraticCurveTo((midX + rightX) / 2, axisY - 24, rightX, axisY - 5).stroke();
  doc.roundedRect((midX + rightX) / 2 - 45, axisY - 28, 90, 11, 2).fill('#064e3b');
  doc.fillColor('#6ee7b7').fontSize(6.5).font('Courier-Bold').text('DATE_ADD(..., 10 DAY)', (midX + rightX) / 2 - 45, axisY - 26, { width: 90, align: 'center' });

  // DATEDIFF Bracket below
  doc.strokeColor('#fbbf24').lineWidth(1).moveTo(midX, axisY + 30).lineTo(midX, axisY + 36).lineTo(rightX, axisY + 36).lineTo(rightX, axisY + 30).stroke();
  doc.roundedRect((midX + rightX) / 2 - 65, axisY + 39, 130, 12, 2).fill('#451a03');
  doc.fillColor('#fde68a').fontSize(6.5).font('Courier-Bold').text("DATEDIFF('2020-09-15', '2020-09-05') = 10", (midX + rightX) / 2 - 65, axisY + 41, { width: 130, align: 'center' });

  // Footer Tag
  doc.fillColor('#f59e0b').fontSize(7).font('Helvetica-Oblique').text('[Calendar Date Arithmetic & Chronological Calculations]', startX + width - 240, startY + height - 13);

  doc.restore();
}

function drawPdfFlowchart(doc, startX, startY, width, height, spec = {}) {
  doc.save();
  doc.roundedRect(startX, startY, width, height, 8).fillAndStroke('#090d16', '#1e293b');

  doc.fillColor('#f8fafc').fontSize(10).font('Helvetica-Bold').text(spec.title || 'Process Flowchart', startX + 16, startY + 10);

  const nodes = spec.nodes || [
    { label: 'Start / Input', type: 'start' },
    { label: 'Invariant Check', type: 'decision' },
    { label: 'Execute Transition', type: 'process' },
    { label: 'Commit State', type: 'end' },
  ];

  const nodeW = Math.min(90, Math.floor((width - 60) / nodes.length));
  const nStartY = startY + 36;
  const gap = 16;
  const totalW = nodes.length * nodeW + (nodes.length - 1) * gap;
  const nStartX = startX + (width - totalW) / 2;

  nodes.forEach((n, idx) => {
    const nx = nStartX + idx * (nodeW + gap);
    const bg = n.type === 'start' ? '#064e3b' : n.type === 'decision' ? '#78350f' : n.type === 'end' ? '#831843' : '#1e3a8a';
    const border = n.type === 'start' ? '#10b981' : n.type === 'decision' ? '#f59e0b' : n.type === 'end' ? '#f43f5e' : '#3b82f6';

    doc.roundedRect(nx, nStartY, nodeW, 36, 6).fillAndStroke(bg, border);
    doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold').text(n.label, nx + 4, nStartY + 10, { width: nodeW - 8, align: 'center' });

    if (idx < nodes.length - 1) {
      const arrowStartX = nx + nodeW;
      const arrowEndX = arrowStartX + gap;
      const midY = nStartY + 18;
      doc.strokeColor('#94a3b8').lineWidth(1.5).moveTo(arrowStartX, midY).lineTo(arrowEndX - 4, midY).stroke();
      doc.polygon([arrowEndX, midY], [arrowEndX - 4, midY - 2.5], [arrowEndX - 4, midY + 2.5]).fill('#94a3b8');
    }
  });

  doc.restore();
}

function drawPdfBlockDiagram(doc, startX, startY, width, height, spec = {}) {
  doc.save();
  doc.roundedRect(startX, startY, width, height, 8).fillAndStroke('#090d16', '#1e293b');

  doc.fillColor('#f8fafc').fontSize(10).font('Helvetica-Bold').text(spec.title || 'System Architecture / Block Diagram', startX + 16, startY + 10);

  const blocks = Array.isArray(spec.blocks) && spec.blocks.length > 0
    ? spec.blocks
    : [
        { label: 'Client / UI', desc: 'Browser' },
        { label: 'API Gateway', desc: 'Auth / Router' },
        { label: 'AI Service', desc: 'Inference' },
        { label: 'Database', desc: 'Persistent' },
      ];

  const n = blocks.length;
  const bW = Math.min(95, Math.floor((width - 60 - (n - 1) * 14) / n));
  const bH = 46;
  const bStartY = startY + 34;
  const gap = 14;
  const totalW = n * bW + (n - 1) * gap;
  const bStartX = startX + (width - totalW) / 2;

  blocks.forEach((b, idx) => {
    const bx = bStartX + idx * (bW + gap);
    doc.roundedRect(bx, bStartY, bW, bH, 6).fillAndStroke('#1e293b', '#38bdf8');
    doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold').text(b.label || `Block ${idx + 1}`, bx + 2, bStartY + 8, { width: bW - 4, align: 'center' });
    if (b.desc || b.description) {
      doc.fillColor('#94a3b8').fontSize(6.5).font('Helvetica').text(b.desc || b.description, bx + 2, bStartY + 24, { width: bW - 4, align: 'center' });
    }

    if (idx < n - 1) {
      const ax1 = bx + bW;
      const ax2 = ax1 + gap;
      const midY = bStartY + bH / 2;
      doc.strokeColor('#0ea5e9').lineWidth(1.5).moveTo(ax1, midY).lineTo(ax2 - 3, midY).stroke();
      doc.polygon([ax2, midY], [ax2 - 3, midY - 2.5], [ax2 - 3, midY + 2.5]).fill('#0ea5e9');
    }
  });

  doc.restore();
}

function resolveSnapshotPath(imgPath) {
  if (!imgPath) return null;
  if (path.isAbsolute(imgPath) && fs.existsSync(imgPath)) return imgPath;
  const inData = path.join(__dirname, '..', 'data', imgPath);
  if (fs.existsSync(inData)) return inData;
  const inSnapshots = path.join(__dirname, '..', 'data', 'snapshots', path.basename(imgPath));
  if (fs.existsSync(inSnapshots)) return inSnapshots;
  return null;
}

function drawPdfGeometryDiagram(doc, startX, startY, width, height, spec = {}) {
  doc.save();
  doc.roundedRect(startX, startY, width, height, 8).fillAndStroke('#090d16', '#1e293b');

  const title = spec.title || 'Circle Geometry: Radius & Area Scaling';
  doc.fillColor('#f8fafc').fontSize(10).font('Helvetica-Bold').text(title, startX + 16, startY + 10);
  doc.fillColor('#38bdf8').fontSize(9).font('Courier-Bold').text(spec.formula || 'A = \u03C0 r\u00B2', startX + width - 140, startY + 10, { width: 120, align: 'right' });

  // Geometry plot canvas on the left
  const cx = startX + 105;
  const cy = startY + 85;
  const r = 46;

  // Background circle fill & stroke
  doc.circle(cx, cy, r).fillAndStroke('#0f2b48', '#38bdf8');

  // Center point O
  doc.circle(cx, cy, 3).fill('#ffffff');
  doc.fillColor('#cbd5e1').fontSize(8.5).font('Helvetica-Bold').text('O', cx - 12, cy - 4);

  // Radius vector from center to circumference
  doc.strokeColor('#f59e0b').lineWidth(2).moveTo(cx, cy).lineTo(cx + r, cy).stroke();
  doc.circle(cx + r, cy, 2.5).fill('#f59e0b');
  doc.fillColor('#fbbf24').fontSize(9).font('Helvetica-Bold').text('r', cx + r / 2 - 4, cy - 12);

  // Circumference indicator
  doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica').text('Circumference: C = 2\u03C0r', cx - 55, cy + r + 6, { width: 110, align: 'center' });

  // Properties Card on the right
  const cardX = startX + 215;
  const cardY = startY + 30;
  const cardW = width - 231;
  const cardH = height - 42;

  doc.roundedRect(cardX, cardY, cardW, cardH, 6).fillAndStroke('#0f172a', '#334155');
  doc.fillColor('#f8fafc').fontSize(8.5).font('Helvetica-Bold').text('Core Geometric Principles', cardX + 10, cardY + 8);

  doc.fillColor('#38bdf8').fontSize(8).font('Helvetica-Bold').text('\u2022 Area Formula: A = \u03C0 \u00D7 r\u00B2', cardX + 10, cardY + 22);
  doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica').text('  \u03C0 \u2248 3.14159, r = radius of the circle', cardX + 10, cardY + 34);

  // Quadratic scaling callout
  doc.roundedRect(cardX + 8, cardY + 48, cardW - 16, 42, 4).fillAndStroke('#172554', '#1d4ed8');
  doc.fillColor('#93c5fd').fontSize(7.5).font('Helvetica-Bold').text('\u26A1 Quadratic Scaling Law (A \u221D r\u00B2):', cardX + 12, cardY + 54);
  doc.fillColor('#e0f2fe').fontSize(7).font('Helvetica').text('Doubling radius (2r) increases Area by 4\u00D7 (2\u00B2). Tripling radius (3r) increases Area by 9\u00D7 (3\u00B2). Growth rate dA/dr = 2\u03C0r.', cardX + 12, cardY + 66, { width: cardW - 24 });

  doc.restore();
}

function drawPdfBiologicalSystem(doc, startX, startY, width, height, spec = {}) {
  doc.save();
  doc.roundedRect(startX, startY, width, height, 8).fillAndStroke('#090d16', '#1e293b');

  const title = spec.title || 'Human Excretory System: Organ Pathway';
  doc.fillColor('#f8fafc').fontSize(10).font('Helvetica-Bold').text(title, startX + 16, startY + 10);
  doc.fillColor('#38bdf8').fontSize(7.5).font('Helvetica-Bold').text('[PHYSIOLOGICAL PATHWAY]', startX + width - 170, startY + 10, { width: 150, align: 'right' });

  const stages = Array.isArray(spec.stages) && spec.stages.length > 0 ? spec.stages : [
    { name: '1. Kidneys', desc: 'Nephrons filter blood; urine forms' },
    { name: '2. Ureters', desc: 'Muscular conduits transport urine' },
    { name: '3. Urinary Bladder', desc: 'Elastic reservoir stores urine' },
    { name: '4. Urethra', desc: 'Terminal duct expels urine' },
  ];

  const n = stages.length;
  const gap = 10;
  const cardW = Math.min(108, Math.floor((width - 40 - (n - 1) * gap) / n));
  const cardH = 46;
  const totalW = n * cardW + (n - 1) * gap;
  const sStartX = startX + (width - totalW) / 2;
  const sStartY = startY + 32;

  stages.forEach((stage, idx) => {
    const sx = sStartX + idx * (cardW + gap);
    doc.roundedRect(sx, sStartY, cardW, cardH, 5).fillAndStroke('#1e1b4b', '#6366f1');
    doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold').text(stage.name, sx + 2, sStartY + 8, { width: cardW - 4, align: 'center' });
    doc.fillColor('#cbd5e1').fontSize(6.5).font('Helvetica').text(stage.desc, sx + 2, sStartY + 22, { width: cardW - 4, align: 'center' });

    if (idx < n - 1) {
      const ax1 = sx + cardW;
      const ax2 = ax1 + gap;
      const midY = sStartY + cardH / 2;
      doc.strokeColor('#818cf8').lineWidth(1.5).moveTo(ax1, midY).lineTo(ax2 - 3, midY).stroke();
      doc.polygon([ax2, midY], [ax2 - 3, midY - 2.5], [ax2 - 3, midY + 2.5]).fill('#818cf8');
    }
  });

  // Homeostatic function banner
  doc.roundedRect(startX + 16, startY + height - 24, width - 32, 16, 4).fillAndStroke('#064e3b', '#059669');
  doc.fillColor('#6ee7b7').fontSize(7.5).font('Helvetica-Bold').text('\u2713 Homeostatic Function: Nitrogenous waste removal, osmoregulation & pH homeostasis.', startX + 20, startY + height - 20, { width: width - 40, align: 'center' });

  doc.restore();
}

function drawPdfPreservedDiagram(doc, startX, startY, width, height, spec = {}) {
  doc.save();
  doc.roundedRect(startX, startY, width, height, 8).fillAndStroke('#090d16', '#1e293b');

  const title = spec.title || 'Original Lecture Diagram';
  doc.fillColor('#f8fafc').fontSize(10).font('Helvetica-Bold').text(title, startX + 16, startY + 10);
  doc.fillColor('#38bdf8').fontSize(7.5).font('Helvetica-Bold').text('[PRESERVED SOURCE SNAPSHOT]', startX + width - 180, startY + 10, { width: 160, align: 'right' });

  const resolved = resolveSnapshotPath(spec.imagePath);
  if (resolved) {
    try {
      const imgTop = startY + 26;
      const imgAvailH = height - 52;
      const imgAvailW = width - 32;
      doc.image(resolved, startX + 16, imgTop, {
        fit: [imgAvailW, imgAvailH],
        align: 'center',
        valign: 'center'
      });
    } catch (imgErr) {
      console.warn('[PDF] Failed to embed preserved image:', imgErr.message);
      doc.fillColor('#94a3b8').fontSize(8.5).font('Helvetica-Oblique').text('Preserved lecture diagram recorded during session.', startX + 20, startY + 45);
    }
  } else {
    doc.fillColor('#94a3b8').fontSize(8.5).font('Helvetica-Oblique').text('Original lecture diagram recorded and catalogued in LectureLens session.', startX + 20, startY + 45);
  }

  // Label badges at bottom
  if (Array.isArray(spec.labels) && spec.labels.length > 0) {
    const lblStr = 'Labels: ' + spec.labels.slice(0, 6).join(' \u2022 ');
    doc.fillColor('#38bdf8').fontSize(7).font('Helvetica-Bold').text(lblStr, startX + 16, startY + height - 16, { width: width - 32 });
  }

  doc.restore();
}

/**
 * ── PDF Generators ────────────────────────────────────────────────────────────
 */

/**
 * Generate Transcript PDF
 */
async function generateTranscriptPdf(lectureId) {
  const lecture = await get('SELECT * FROM lectures WHERE id = ?', [lectureId]);
  const host = lecture ? await get('SELECT name, email FROM users WHERE id = ?', [lecture.host_id]) : null;
  const segments = await all(
    'SELECT * FROM transcript_segments WHERE lecture_id = ? ORDER BY start_time ASC',
    [lectureId]
  );

  const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
  const filename = `Transcript_${lecture?.room_id || lectureId}_${Date.now()}.pdf`;
  const filePath = path.join(PDF_DIR, filename);
  const stream = fs.createWriteStream(filePath);

  doc.pipe(stream);

  // Header Banner
  doc.rect(40, 40, 515, 60).fill('#1e293b');
  doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold').text('LectureLens — Lecture Transcript', 55, 52);
  doc.fontSize(10).font('Helvetica').text(`Room: ${lecture?.room_id || 'N/A'}  |  Date: ${new Date().toLocaleDateString()}`, 55, 75);

  doc.moveDown(4);
  doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text(`Lecture: ${lecture?.title || 'Lecture Session'}`);
  doc.fontSize(10).font('Helvetica').fillColor('#64748b').text(`Instructor: ${host?.name || 'Instructor'} (${host?.email || 'N/A'})`);
  doc.text(`Total Segments: ${segments.length}`);
  doc.moveDown(1.5);

  doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(1);

  if (segments.length === 0) {
    doc.fillColor('#94a3b8').fontSize(11).font('Helvetica-Oblique').text('No spoken transcript segments were captured for this lecture.');
  } else {
    for (const seg of segments) {
      if (doc.y > 750) {
        doc.addPage();
      }

      const timeTag = `[${formatOffset(seg.start_time)}]`;
      const speakerTag = `${seg.speaker_name || 'Speaker'}:`;

      doc.fillColor('#2563eb').fontSize(9).font('Helvetica-Bold').text(timeTag, { continued: true });
      doc.fillColor('#0284c7').text(` ${speakerTag} `, { continued: true });
      doc.fillColor('#334155').font('Helvetica').text(seg.text);
      doc.moveDown(0.4);
    }
  }

  // Page numbering in footer
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.fillColor('#94a3b8').fontSize(8).font('Helvetica').text(
      `Page ${i + 1} of ${pages.count}  •  Generated by LectureLens Multimodal AI`,
      40,
      785,
      { align: 'center', width: 515, lineBreak: false }
    );
  }

  doc.end();
  await new Promise((resolve) => stream.on('finish', resolve));

  const docId = 'doc_' + uuidv4().slice(0, 8);
  await run(
    'INSERT INTO generated_documents (id, lecture_id, doc_type, file_path) VALUES (?, ?, ?, ?)',
    [docId, lectureId, 'TRANSCRIPT_PDF', filePath]
  );

  return { filePath, filename };
}

/**
 * Generate Summary PDF
 */
async function generateSummaryPdf(lectureId) {
  const lecture = await get('SELECT * FROM lectures WHERE id = ?', [lectureId]);
  const host = lecture ? await get('SELECT name FROM users WHERE id = ?', [lecture.host_id]) : null;
  const summaryRow = await get('SELECT * FROM summaries WHERE lecture_id = ?', [lectureId]);

  const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
  const filename = `Summary_${lecture?.room_id || lectureId}_${Date.now()}.pdf`;
  const filePath = path.join(PDF_DIR, filename);
  const stream = fs.createWriteStream(filePath);

  doc.pipe(stream);

  // Header Banner
  doc.rect(40, 40, 515, 60).fill('#0f766e');
  doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold').text('LectureLens — AI Executive Summary', 55, 52);
  doc.fontSize(10).font('Helvetica').text(`Lecture: ${lecture?.title || 'Session'}  |  Date: ${new Date().toLocaleDateString()}`, 55, 75);

  doc.moveDown(4);
  doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text(`Instructor: ${host?.name || 'Instructor'}`);
  doc.moveDown(1);

  // 1. Short Executive Summary
  doc.fillColor('#0f766e').fontSize(14).font('Helvetica-Bold').text('1. Executive Overview');
  doc.moveDown(0.5);
  doc.fillColor('#1e293b').fontSize(10).font('Helvetica').text(summaryRow?.short_summary || 'Executive summary unavailable.');
  doc.moveDown(1.5);

  // 2. Detailed Synthesis
  if (doc.y > 650) doc.addPage();
  doc.fillColor('#0f766e').fontSize(14).font('Helvetica-Bold').text('2. In-Depth Synthesis');
  doc.moveDown(0.5);
  doc.fillColor('#1e293b').fontSize(10).font('Helvetica').text(summaryRow?.detailed_summary || 'Detailed summary unavailable.');
  doc.moveDown(1.5);

  // Footer
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.fillColor('#94a3b8').fontSize(8).font('Helvetica').text(
      `Page ${i + 1} of ${pages.count}  •  Generated by LectureLens`,
      40,
      785,
      { align: 'center', width: 515, lineBreak: false }
    );
  }

  doc.end();
  await new Promise((resolve) => stream.on('finish', resolve));

  const docId = 'doc_' + uuidv4().slice(0, 8);
  await run(
    'INSERT INTO generated_documents (id, lecture_id, doc_type, file_path) VALUES (?, ?, ?, ?)',
    [docId, lectureId, 'SUMMARY_PDF', filePath]
  );

  return { filePath, filename };
}

/**
 * Generate Complete Study Notes PDF with Embedded Vector Visualizations & Graphs
 */
async function generateStudyNotesPdf(lectureId) {
  const lecture = await get('SELECT * FROM lectures WHERE id = ?', [lectureId]);
  const host = lecture ? await get('SELECT name, email FROM users WHERE id = ?', [lecture.host_id]) : null;
  const summaryRow = await get('SELECT * FROM summaries WHERE lecture_id = ?', [lectureId]);
  const noteRow = await get('SELECT * FROM study_notes WHERE lecture_id = ? ORDER BY created_at DESC LIMIT 1', [lectureId]);
  const boardRows = await all('SELECT * FROM board_contents WHERE lecture_id = ?', [lectureId]);
  const screenRows = await all('SELECT * FROM screen_contents WHERE lecture_id = ?', [lectureId]);

  const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
  const filename = `StudyNotes_${lecture?.room_id || lectureId}_${Date.now()}.pdf`;
  const filePath = path.join(PDF_DIR, filename);
  const stream = fs.createWriteStream(filePath);

  doc.pipe(stream);

  // Cover / Header Banner
  doc.rect(40, 40, 515, 75).fill('#1e1b4b');
  doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold').text('LectureLens Complete Study Notes', 55, 52);
  doc.fontSize(11).font('Helvetica').text(`Title: ${lecture?.title || 'Academic Lecture'}`, 55, 78);
  doc.fontSize(9).font('Helvetica').text(`Instructor: ${host?.name || 'Professor'}  |  Generated: ${new Date().toLocaleDateString()}`, 55, 94);

  doc.moveDown(5);

  // 1. Lecture Overview & Scope
  doc.fillColor('#312e81').fontSize(14).font('Helvetica-Bold').text('1. Lecture Overview & Scope');
  doc.moveDown(0.4);

  let overviewText = summaryRow?.short_summary;
  if (!overviewText || overviewText === '[object Object]' || (typeof overviewText === 'string' && overviewText.trim() === '')) {
    overviewText = summaryRow?.detailed_summary;
  }
  if (!overviewText || overviewText === '[object Object]' || (typeof overviewText === 'string' && overviewText.trim() === '')) {
    overviewText = 'Comprehensive study notes with embedded domain-accurate visual diagrams and examples.';
  } else if (typeof overviewText === 'object') {
    try {
      overviewText = JSON.stringify(overviewText);
    } catch (_) {
      overviewText = 'Comprehensive study notes with embedded domain-accurate visual diagrams and examples.';
    }
  }

  doc.fillColor('#334155').fontSize(10).font('Helvetica').text(overviewText);
  doc.moveDown(1.5);

  // Parse structured sections & visualizations
  let sections = [];
  try { sections = JSON.parse(noteRow?.sections_json || '[]'); } catch (_) {}

  let visualizations = [];
  try { visualizations = JSON.parse(noteRow?.visualizations_json || '[]'); } catch (_) {}

  // 2. Structured Section Notes with Embedded Graphs & Diagrams
  if (sections.length > 0) {
    doc.fillColor('#312e81').fontSize(14).font('Helvetica-Bold').text('2. Detailed Topic Explanations & Visualizations');
    doc.moveDown(0.6);

    for (let idx = 0; idx < sections.length; idx++) {
      const sec = sections[idx];

      // Check remaining page space
      if (doc.y > 540) doc.addPage();

      // Heading
      doc.fillColor('#1e1b4b').fontSize(12).font('Helvetica-Bold').text(`${idx + 1}. ${sec.heading}`);
      doc.moveDown(0.3);

      // Formula Box
      if (sec.formula) {
        doc.roundedRect(40, doc.y, 515, 26, 4).fillAndStroke('#0f172a', '#38bdf8');
        doc.fillColor('#38bdf8').fontSize(10).font('Courier-Bold').text(
          `Formula: ${sec.formula.replace(/^\$+|\$+$/g, '')}`,
          50,
          doc.y + 7
        );
        doc.moveDown(1.8);
      }

      // Variables breakdown
      if (Array.isArray(sec.variables) && sec.variables.length > 0) {
        doc.fillColor('#475569').fontSize(9).font('Helvetica-Bold').text('Variables: ', { continued: true });
        const varStr = sec.variables.map((v) => `${v.symbol}: ${v.meaning}${v.unit ? ` [${v.unit}]` : ''}`).join('  |  ');
        doc.fillColor('#1e293b').font('Helvetica').text(varStr);
        doc.moveDown(0.4);
      }

      // Explanation
      if (sec.explanation) {
        doc.fillColor('#334155').fontSize(9.5).font('Helvetica').text(sec.explanation);
        doc.moveDown(0.6);
      }

      // EMBEDDED DIAGRAM / GRAPH IN PDF!
      const viz = sec.visualization;
      if (viz && viz.required) {
        const vType = (viz.type || '').toLowerCase();
        const headingLower = (sec.heading || '').toLowerCase();
        const formulaClean = (sec.formula || '').replace(/^\$+|\$+$/g, '');
        const hasImagePath = Boolean(viz.imagePath || viz.spec?.imagePath || sec.sourceSnapshotPath);
        const resolvedImg = hasImagePath ? resolveSnapshotPath(viz.imagePath || viz.spec?.imagePath || sec.sourceSnapshotPath) : null;

        if (resolvedImg || vType === 'preserved_source_diagram') {
          if (doc.y > 550) doc.addPage();
          const diagY = doc.y;
          drawPdfPreservedDiagram(doc, 40, diagY, 515, 200, {
            title: viz.title || sec.heading,
            imagePath: resolvedImg || viz.imagePath || sec.sourceSnapshotPath,
            labels: viz.spec?.labels || viz.labels || [],
            ...viz.spec,
          });
          doc.y = diagY + 208;
        } else if (vType.includes('null') || vType.includes('coalesce') || headingLower.includes('coalesce')) {
          if (doc.y > 590) doc.addPage();
          const coalY = doc.y;
          drawPdfNullCoalesceFlow(doc, 40, coalY, 515, 145, {
            title: viz.title || sec.heading,
            ...viz.spec,
          });
          doc.y = coalY + 152;
        } else if (vType.includes('string') || headingLower.includes('string function') || headingLower.includes('string manipulation') || headingLower.includes('upper') || headingLower.includes('trim')) {
          if (doc.y > 590) doc.addPage();
          const strY = doc.y;
          drawPdfStringTransformation(doc, 40, strY, 515, 150, {
            title: viz.title || sec.heading,
            ...viz.spec,
          });
          doc.y = strY + 158;
        } else if (vType.includes('date') || headingLower.includes('date and time') || headingLower.includes('date arithmetic') || headingLower.includes('datediff') || headingLower.includes('date_add')) {
          if (doc.y > 600) doc.addPage();
          const dateY = doc.y;
          drawPdfDateTimeline(doc, 40, dateY, 515, 145, {
            title: viz.title || sec.heading,
            ...viz.spec,
          });
          doc.y = dateY + 152;
        } else if (vType.includes('geometry') || vType.includes('circle') || headingLower.includes('circle') || formulaClean.includes('r^2') || formulaClean.includes('r²')) {
          if (doc.y > 590) doc.addPage();
          const geomY = doc.y;
          drawPdfGeometryDiagram(doc, 40, geomY, 515, 155, {
            title: viz.title || sec.heading,
            formula: formulaClean || 'A = \u03C0 r\u00B2',
            ...viz.spec,
          });
          doc.y = geomY + 163;
        } else if (vType.includes('biolog') || vType.includes('excret') || vType.includes('kidney') || vType.includes('organ') || vType.includes('anatomy') || headingLower.includes('excret') || headingLower.includes('kidney')) {
          if (doc.y > 610) doc.addPage();
          const bioY = doc.y;
          drawPdfBiologicalSystem(doc, 40, bioY, 515, 130, {
            title: viz.title || sec.heading,
            ...viz.spec,
          });
          doc.y = bioY + 138;
        } else if (vType.includes('graph') || vType.includes('coordinate') || vType.includes('plot') || vType.includes('linear') || vType.includes('kinematics')) {
          if (doc.y > 580) doc.addPage();
          const graphY = doc.y;
          drawPdfCoordinateGraph(doc, 40, graphY, 515, 170, {
            title: viz.title || sec.heading,
            equation: formulaClean,
            ...viz.spec,
          });
          doc.y = graphY + 178;
        } else if (vType.includes('algorithm') || vType.includes('search') || vType.includes('array')) {
          if (doc.y > 640) doc.addPage();
          const algoY = doc.y;
          drawPdfAlgorithmSteps(doc, 40, algoY, 515, 115, {
            title: viz.title || 'Algorithm Execution',
            ...viz.spec,
          });
          doc.y = algoY + 122;
        } else if (viz.type === 'block_diagram' || viz.type === 'architecture' || viz.type === 'tree_diagram') {
          if (doc.y > 620) doc.addPage();
          const blkY = doc.y;
          drawPdfBlockDiagram(doc, 40, blkY, 515, 115, {
            title: viz.title || 'System Diagram',
            ...viz.spec,
          });
          doc.y = blkY + 122;
        } else {
          if (doc.y > 620) doc.addPage();
          const flowY = doc.y;
          drawPdfFlowchart(doc, 40, flowY, 515, 115, {
            title: viz.title || 'Process Flow',
            ...viz.spec,
          });
          doc.y = flowY + 122;
        }

        // Caption & connection to formula
        if (viz.caption || viz.connectionToFormula) {
          doc.roundedRect(40, doc.y, 515, 24, 4).fillAndStroke('#f0f9ff', '#bae6fd');
          doc.fillColor('#0369a1').fontSize(8.5).font('Helvetica-Oblique').text(
            `Visual Note: ${viz.caption || ''} ${viz.connectionToFormula ? `(${viz.connectionToFormula})` : ''}`,
            48,
            doc.y + 6,
            { width: 500 }
          );
          doc.moveDown(1.5);
        }
      }

      // Practical Example
      if (sec.derivationOrExample) {
        doc.fillColor('#047857').fontSize(9).font('Helvetica-Bold').text('Example: ', { continued: true });
        doc.fillColor('#1e293b').font('Helvetica').text(sec.derivationOrExample);
        doc.moveDown(0.4);
      }

      // Key Takeaway
      if (sec.takeaway) {
        doc.fillColor('#b45309').fontSize(9).font('Helvetica-Bold').text('Key Takeaway: ', { continued: true });
        doc.fillColor('#78350f').font('Helvetica').text(sec.takeaway);
        doc.moveDown(0.8);
      }

      // Separator line
      doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.8);
    }
  } else if (noteRow?.content_markdown) {
    // Fallback markdown rendering
    doc.fillColor('#312e81').fontSize(14).font('Helvetica-Bold').text('2. Lecture Study Notes');
    doc.moveDown(0.4);
    const cleanNotes = noteRow.content_markdown
      .replace(/#+\s/g, '')
      .replace(/\*\*/g, '')
      .split('\n')
      .filter((line) => line.trim().length > 0);

    for (const line of cleanNotes.slice(0, 30)) {
      if (doc.y > 740) doc.addPage();
      doc.fillColor('#1e293b').fontSize(9.5).font('Helvetica').text(line);
      doc.moveDown(0.3);
    }
    doc.moveDown(1.5);
  }

  // 3. Review Questions
  let questions = [];
  try { questions = JSON.parse(noteRow?.questions_json || '[]'); } catch (_) {}
  if (questions.length > 0) {
    if (doc.y > 650) doc.addPage();
    doc.fillColor('#312e81').fontSize(14).font('Helvetica-Bold').text('3. Review & Examination Questions');
    doc.moveDown(0.5);
    for (let qi = 0; qi < questions.length; qi++) {
      const q = questions[qi];
      if (doc.y > 740) doc.addPage();
      doc.fillColor('#0f172a').fontSize(9.5).font('Helvetica-Bold').text(`Q${qi + 1}: ${q.question}`);
      if (q.hint) {
        doc.fillColor('#059669').fontSize(8.5).font('Helvetica-Oblique').text(`   Hint: ${q.hint}`);
      }
      doc.moveDown(0.4);
    }
  }

  // Footer page numbering
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.fillColor('#94a3b8').fontSize(8).font('Helvetica').text(
      `Page ${i + 1} of ${pages.count}  •  LectureLens Complete Study Notes with Vector Visualizations`,
      40,
      785,
      { align: 'center', width: 515, lineBreak: false }
    );
  }

  doc.end();
  await new Promise((resolve) => stream.on('finish', resolve));

  const docId = 'doc_' + uuidv4().slice(0, 8);
  await run(
    'INSERT INTO generated_documents (id, lecture_id, doc_type, file_path) VALUES (?, ?, ?, ?)',
    [docId, lectureId, 'STUDY_NOTES_PDF', filePath]
  );

  return { filePath, filename };
}

module.exports = {
  generateTranscriptPdf,
  generateSummaryPdf,
  generateStudyNotesPdf,
  drawPdfCoordinateGraph,
  drawPdfAlgorithmSteps,
  drawPdfFlowchart,
  drawPdfGeometryDiagram,
  drawPdfBiologicalSystem,
  drawPdfPreservedDiagram,
  resolveSnapshotPath,
};
