import { fmt, fmtX, computeStats, bestWorstSlot } from './huntCalc';

const COLORS = {
  bgTop: '#0b0f17',
  bgBottom: '#141019',
  border: 'rgba(255,255,255,0.10)',
  emerald: '#34d399',
  orange: '#f59e0b',
  purple: '#c084fc',
  white: '#f4f4f5',
  muted: 'rgba(244,244,245,0.55)',
  faint: 'rgba(244,244,245,0.30)',
  rowAlt: 'rgba(255,255,255,0.03)',
  line: 'rgba(255,255,255,0.10)',
};
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const SANS = 'ui-sans-serif, system-ui, sans-serif';

function gamblerRows(hunt) {
  const gamblers = hunt?.gamblers ?? [];
  const totalBuyIns = gamblers.reduce((s, g) => s + (Number(g.inFor) || 0), 0);
  const finish =
    hunt?.finishBalance === '' || hunt?.finishBalance == null
      ? null
      : Number(hunt.finishBalance);
  return gamblers.map((g) => {
    const inFor = Number(g.inFor) || 0;
    const pct = totalBuyIns > 0 ? (inFor / totalBuyIns) * 100 : 0;
    const payout = finish != null && totalBuyIns > 0 ? (pct / 100) * finish : null;
    return { name: g.name, inFor, pct, payout };
  });
}

function triggerDownload(canvas, filename) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function dateStr() {
  return new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Draws the eyebrow + title + date header. Returns the y after the header.
function drawHeader(ctx, W, padding, eyebrow, title, accent) {
  let y = padding + 12;
  ctx.textAlign = 'left';
  ctx.fillStyle = accent;
  ctx.font = `bold 13px ${MONO}`;
  ctx.fillText(eyebrow.toUpperCase(), padding, y);

  y += 30;
  ctx.fillStyle = COLORS.white;
  ctx.font = `900 34px ${SANS}`;
  ctx.fillText(title, padding, y);

  y += 24;
  ctx.fillStyle = COLORS.muted;
  ctx.font = `13px ${SANS}`;
  ctx.fillText(dateStr(), padding, y);
  return y;
}

// Draws the split table starting at startY. Returns the y after the total row.
function drawSplitTable(ctx, W, padding, startY, hunt) {
  const rows = gamblerRows(hunt);
  const totalBuyIns = rows.reduce((s, r) => s + r.inFor, 0);
  const finish =
    hunt?.finishBalance === '' || hunt?.finishBalance == null
      ? null
      : Number(hunt.finishBalance);
  const rowH = 48;
  const cols = {
    name: padding,
    inFor: W * 0.45,
    pct: W * 0.65,
    payout: W - padding,
  };

  // Column headers
  let y = startY;
  ctx.fillStyle = COLORS.faint;
  ctx.font = `bold 11px ${MONO}`;
  ctx.textAlign = 'left';
  ctx.fillText('NAME', cols.name, y);
  ctx.textAlign = 'right';
  ctx.fillText('IN FOR', cols.inFor, y);
  ctx.fillText('%', cols.pct, y);
  ctx.fillText('PAYOUT', cols.payout, y);
  ctx.textAlign = 'left';

  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, y + 12);
  ctx.lineTo(W - padding, y + 12);
  ctx.stroke();

  // Rows
  y += 40;
  rows.forEach((g, i) => {
    const rowY = y + i * rowH;
    if (i % 2 === 0) {
      ctx.fillStyle = COLORS.rowAlt;
      ctx.fillRect(padding - 8, rowY - rowH + 12, W - padding * 2 + 16, rowH);
    }
    ctx.fillStyle = COLORS.white;
    ctx.font = `bold 16px ${SANS}`;
    ctx.textAlign = 'left';
    ctx.fillText(g.name, cols.name, rowY);

    ctx.fillStyle = COLORS.muted;
    ctx.font = `15px ${SANS}`;
    ctx.textAlign = 'right';
    ctx.fillText(fmt(g.inFor), cols.inFor, rowY);

    ctx.fillStyle = COLORS.purple;
    ctx.font = `bold 15px ${SANS}`;
    ctx.fillText(`${g.pct.toFixed(2)}%`, cols.pct, rowY);

    if (g.payout != null) {
      ctx.fillStyle = g.payout >= g.inFor ? COLORS.emerald : '#f87171';
      ctx.font = `bold 15px ${SANS}`;
      ctx.fillText(fmt(g.payout), cols.payout, rowY);
    } else {
      ctx.fillStyle = COLORS.faint;
      ctx.font = `15px ${SANS}`;
      ctx.fillText('—', cols.payout, rowY);
    }
  });

  // Total row
  const totalY = y + rows.length * rowH + 12;
  ctx.strokeStyle = COLORS.line;
  ctx.beginPath();
  ctx.moveTo(padding, totalY - 16);
  ctx.lineTo(W - padding, totalY - 16);
  ctx.stroke();

  ctx.fillStyle = COLORS.muted;
  ctx.font = `bold 13px ${MONO}`;
  ctx.textAlign = 'left';
  ctx.fillText('TOTAL', cols.name, totalY + 16);

  ctx.fillStyle = COLORS.white;
  ctx.font = `bold 16px ${SANS}`;
  ctx.textAlign = 'right';
  ctx.fillText(fmt(totalBuyIns), cols.inFor, totalY + 16);
  ctx.fillStyle = COLORS.muted;
  ctx.fillText('100.00%', cols.pct, totalY + 16);
  if (finish != null) {
    ctx.fillStyle = COLORS.orange;
    ctx.fillText(fmt(finish), cols.payout, totalY + 16);
  } else {
    ctx.fillStyle = COLORS.faint;
    ctx.fillText('—', cols.payout, totalY + 16);
  }
  return totalY + 16;
}

function drawFooter(ctx, W, H, padding) {
  ctx.fillStyle = COLORS.faint;
  ctx.font = `11px ${MONO}`;
  ctx.textAlign = 'center';
  ctx.fillText('goofer.tv · Bonus Hunt Tracker', W / 2, H - padding);
}

function makeCanvas(W, H) {
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, COLORS.bgTop);
  bg.addColorStop(1, COLORS.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, W - 40, H - 40);
  return { canvas, ctx };
}

/** Squad equity split — available anytime. */
export function renderSplit(hunt) {
  const rows = hunt?.gamblers ?? [];
  const W = 720;
  const padding = 40;
  const headerH = 110;
  const tableTop = padding + headerH;
  const H = tableTop + 40 + 48 * rows.length + 56 + 50 + padding;

  const { canvas, ctx } = makeCanvas(W, H);
  drawHeader(ctx, W, padding, 'Squad split', hunt?.name || 'Bonus Hunt Equity', COLORS.purple);
  drawSplitTable(ctx, W, padding, tableTop, hunt);
  drawFooter(ctx, W, H, padding);
  triggerDownload(canvas, `hunt-split-${new Date().toISOString().slice(0, 10)}.png`);
}

// Draws the "Top slot" / "Lowest slot" rows starting at startY. Returns the y
// after the block. Shows slot name + multiplier for the best/worst played slot.
function drawSlotRows(ctx, W, padding, startY, hunt) {
  const { best, worst } = bestWorstSlot(hunt?.bonuses);
  const rowGap = 26;
  const labelX = padding;
  const xValX = W - padding;
  let y = startY;

  const line = (label, accent, entry) => {
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.faint;
    ctx.font = `bold 10px ${MONO}`;
    ctx.fillText(label.toUpperCase(), labelX, y);

    if (entry) {
      ctx.fillStyle = COLORS.white;
      ctx.font = `bold 16px ${SANS}`;
      ctx.fillText(entry.slot || '—', labelX + 92, y);

      ctx.textAlign = 'right';
      ctx.fillStyle = accent;
      ctx.font = `bold 16px ${SANS}`;
      ctx.fillText(fmtX(entry.x), xValX, y);
    } else {
      ctx.fillStyle = COLORS.faint;
      ctx.font = `15px ${SANS}`;
      ctx.fillText('—', labelX + 92, y);
    }
    y += rowGap;
  };

  line('Top slot', COLORS.emerald, best);
  line('Lowest slot', '#f87171', worst);
  return y;
}

/** Full recap — completed hunts (adds stat band + top/lowest slots above split). */
export function renderRecap(hunt) {
  const s = computeStats(hunt);
  const rows = hunt?.gamblers ?? [];
  const W = 720;
  const padding = 40;
  const headerH = 110;
  const statBandH = 84;
  const slotsBandH = 64; // two rows (Top slot / Lowest slot) + spacing
  const tableTop = padding + headerH + statBandH + slotsBandH;
  const H = tableTop + 40 + 48 * rows.length + 56 + 50 + padding;

  const { canvas, ctx } = makeCanvas(W, H);
  drawHeader(ctx, W, padding, 'Hunt recap', hunt?.name || 'Bonus Hunt', COLORS.emerald);

  // Stat band
  const bandY = padding + headerH;
  const stats = [
    ['START', fmt(s.start)],
    ['FINISH', fmt(s.finish)],
    ['PROFIT', s.profit == null ? '—' : (s.profit >= 0 ? '+' : '') + fmt(s.profit)],
    ['REQ X', s.reqX != null ? `${s.reqX.toFixed(1)}x` : '—'],
    ['BEST X', s.bestX != null ? fmtX(s.bestX) : '—'],
  ];
  const cellW = (W - padding * 2) / stats.length;
  stats.forEach(([label, value], i) => {
    const x = padding + i * cellW;
    ctx.fillStyle = COLORS.faint;
    ctx.font = `bold 10px ${MONO}`;
    ctx.textAlign = 'left';
    ctx.fillText(label, x, bandY + 16);
    ctx.fillStyle =
      label === 'PROFIT' && s.profit != null
        ? s.profit >= 0
          ? COLORS.emerald
          : '#f87171'
        : COLORS.white;
    ctx.font = `bold 18px ${SANS}`;
    ctx.fillText(value, x, bandY + 42);
  });
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, bandY + statBandH - 14);
  ctx.lineTo(W - padding, bandY + statBandH - 14);
  ctx.stroke();

  // Top / lowest slot rows, in the slots band between stat band and table.
  const slotsY = bandY + statBandH + 14;
  drawSlotRows(ctx, W, padding, slotsY, hunt);
  ctx.strokeStyle = COLORS.line;
  ctx.beginPath();
  ctx.moveTo(padding, bandY + statBandH + slotsBandH - 14);
  ctx.lineTo(W - padding, bandY + statBandH + slotsBandH - 14);
  ctx.stroke();

  drawSplitTable(ctx, W, padding, tableTop, hunt);
  drawFooter(ctx, W, H, padding);
  triggerDownload(canvas, `hunt-recap-${new Date().toISOString().slice(0, 10)}.png`);
}
