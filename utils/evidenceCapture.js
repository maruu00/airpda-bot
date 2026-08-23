'use strict';

const path = require('path');
const { AttachmentBuilder } = require('discord.js');

let _cv = undefined;
let _fontsRegistered = false;

function getCanvas() {
  if (_cv === undefined) {
    try {
      _cv = require('@napi-rs/canvas');
    } catch (err) {
      _cv = null;
      console.warn('[Evidence] @napi-rs/canvas no encontrado:', err.message);
    }
  }
  if (_cv && !_fontsRegistered) {
    _fontsRegistered = true;
    try {
      const dir = path.join(__dirname, '..', 'assets', 'fonts');
      _cv.GlobalFonts.registerFromPath(path.join(dir, 'Inter-Regular.ttf'), 'UIFont');
      _cv.GlobalFonts.registerFromPath(path.join(dir, 'Inter-Bold.ttf'), 'UIFont');
    } catch (err) {
      console.warn('[Evidence] No se pudieron registrar fuentes propias:', err.message);
    }
  }
  return _cv;
}

// ─── Paleta Discord dark ──────────────────────────────────────────────────────
const DC = {
  BG:     '#313338',
  HEADER: '#1e1f22',
  TEXT:   '#dcddde',
  MUTED:  '#949ba4',
  BLUE:   '#5865f2',
  RED:    '#ed4245',
  LINK:   '#00aff4',
  WHITE:  '#ffffff',
  SEP:    '#3f4147',
};

/**
 * Genera una imagen PNG que simula una captura del mensaje infractor.
 *
 * @param {import('discord.js').Message} message  Mensaje que causó la sanción
 * @param {string}                       reason   Motivo de la sanción
 * @returns {Promise<AttachmentBuilder|null>}      Listo para adjuntar en Discord, null si canvas no disponible
 */
async function captureEvidence(message, reason = 'Infracción detectada') {
  const cv = getCanvas();
  if (!cv) return null;

  const { createCanvas, loadImage } = cv;

  try {
    // ── Layout ──────────────────────────────────────────────────────────────
    const W      = 660;
    const PAD    = 18;
    const AV     = 42;
    const LINE   = 21;
    const HDR    = 38;
    const TEXT_X = PAD + AV + 14;

    // Líneas de texto del mensaje
    const rawContent   = message.content?.trim() ?? '';
    console.log(`[Evidence] rawContent="${rawContent.slice(0,80)}" len=${rawContent.length} embeds=${message.embeds?.length || 0} atts=${message.attachments?.size || 0}`);
    const contentLines = rawContent ? wrapText(rawContent, W - TEXT_X - PAD, 14) : [];

    // Filas de embeds (título, descripción, url con invite)
    const embedRows = [];
    for (const emb of (message.embeds ?? []).slice(0, 3)) {
      if (emb.title)       embedRows.push({ bold: true,  text: emb.title.slice(0, 68),        link: false });
      if (emb.description) embedRows.push({ bold: false, text: emb.description.slice(0, 120), link: false });
      if (emb.url)         embedRows.push({ bold: false, text: emb.url.slice(0, 80),           link: true  });
    }

    // Usuario humano que ejecutó la app (si aplica)
    const intUser = message.interaction?.user ?? message.interactionMetadata?.user ?? null;

    // Attachments
    const attNames = [...(message.attachments?.values() ?? [])].map(a => a.name).slice(0, 4);

    // ── Altura dinámica ─────────────────────────────────────────────────────
    let H = HDR + PAD;
    H += AV + 6;
    H += Math.max(contentLines.length, 1) * LINE;
    if (embedRows.length)  H += embedRows.length * LINE + 22;
    if (intUser)           H += LINE + 6;
    if (attNames.length)   H += LINE + 4;
    H += PAD + 1 + 48;   // separador + footer
    H = Math.max(H, 180);

    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext('2d');

    // ── Fondo ───────────────────────────────────────────────────────────────
    ctx.fillStyle = DC.BG;
    ctx.fillRect(0, 0, W, H);

    // ── Header ──────────────────────────────────────────────────────────────
    ctx.fillStyle = DC.HEADER;
    ctx.fillRect(0, 0, W, HDR);

    // Pastilla azul de escudo
    ctx.fillStyle = DC.BLUE;
    fillRoundRect(ctx, PAD, 10, 18, 18, 4);
    ctx.font = 'bold 11px "UIFont"';
    ctx.fillStyle = DC.WHITE;
    ctx.fillText('S', PAD + 5, 23);

    ctx.font = 'bold 13px "UIFont"';
    ctx.fillStyle = DC.WHITE;
    ctx.fillText('EVIDENCIA DE INFRACCION  —  American Island', PAD + 24, 24);

    let y = HDR + PAD;

    // ── Avatar circular ─────────────────────────────────────────────────────
    const avCX = PAD + AV / 2;
    const avCY = y + AV / 2;
    try {
      const url = message.author.displayAvatarURL({ extension: 'png', size: 64, forceStatic: true });
      const img = await loadImage(url);
      ctx.save();
      ctx.beginPath();
      ctx.arc(avCX, avCY, AV / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, PAD, y, AV, AV);
      ctx.restore();
    } catch {
      // Fallback: círculo con inicial
      ctx.fillStyle = DC.BLUE;
      ctx.beginPath();
      ctx.arc(avCX, avCY, AV / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = 'bold 18px "UIFont"';
      ctx.fillStyle = DC.WHITE;
      ctx.textAlign = 'center';
      ctx.fillText((message.author.username?.[0] ?? '?').toUpperCase(), avCX, avCY + 7);
      ctx.textAlign = 'left';
    }

    // ── Username ────────────────────────────────────────────────────────────
    const nameY = y + 17;
    const hex   = message.member?.displayHexColor;
    const roleColor = (hex && hex !== '#000000') ? hex : DC.WHITE;

    ctx.font = 'bold 15px "UIFont"';
    ctx.fillStyle = roleColor;
    ctx.fillText(message.author.username, TEXT_X, nameY);
    const nameW = ctx.measureText(message.author.username).width;

    // Badge BOT / APP
    const isApp  = message.author.bot || !!message.applicationId;
    const badge  = message.author.bot ? 'BOT' : 'APP';
    let   afterBadgeX = TEXT_X + nameW + 4;
    if (isApp) {
      ctx.fillStyle = DC.BLUE;
      fillRoundRect(ctx, TEXT_X + nameW + 5, nameY - 13, 34, 15, 3);
      ctx.font = 'bold 10px "UIFont"';
      ctx.fillStyle = DC.WHITE;
      ctx.fillText(badge, TEXT_X + nameW + 10, nameY - 2);
      afterBadgeX = TEXT_X + nameW + 44;
    }

    // Timestamp
    const ts = new Date(message.createdTimestamp).toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    ctx.font = '11px "UIFont"';
    ctx.fillStyle = DC.MUTED;
    ctx.fillText(ts, afterBadgeX + 4, nameY);

    // ── Contenido del mensaje ───────────────────────────────────────────────
    y = nameY + 9;
    if (contentLines.length) {
      ctx.font = '14px "UIFont"';
      ctx.fillStyle = DC.TEXT;
      for (const line of contentLines) {
        y += LINE;
        ctx.fillText(line, TEXT_X, y);
      }
    } else {
      y += LINE;
      ctx.font = '13px "UIFont"';
      ctx.fillStyle = DC.MUTED;
      ctx.fillText('[Mensaje sin texto — ver embed abajo]', TEXT_X, y);
    }

    // ── Embeds ──────────────────────────────────────────────────────────────
    if (embedRows.length) {
      y += 12;
      const embedBlockH = embedRows.length * LINE + 10;
      // Borde izquierdo azul (estilo Discord embed)
      ctx.fillStyle = DC.BLUE;
      ctx.fillRect(TEXT_X, y, 3, embedBlockH);
      // Fondo levemente distinto
      ctx.fillStyle = '#2b2d31';
      ctx.fillRect(TEXT_X + 3, y, W - TEXT_X - PAD - 3, embedBlockH);

      let ey = y + LINE - 2;
      for (const row of embedRows) {
        ctx.font = row.bold ? 'bold 13px sans-serif' : '12px sans-serif';
        ctx.fillStyle = row.link ? DC.LINK : DC.TEXT;
        ctx.fillText(row.text, TEXT_X + 10, ey);
        ey += LINE;
      }
      y = y + embedBlockH;
    }

    // ── Ejecutado por (interaction user) ───────────────────────────────────
    if (intUser) {
      y += 8;
      ctx.font = '12px "UIFont"';
      ctx.fillStyle = DC.MUTED;
      ctx.fillText(`Ejecutado por: ${intUser.username ?? intUser.id}`, TEXT_X, y + LINE);
      y += LINE;
    }

    // ── Adjuntos ────────────────────────────────────────────────────────────
    if (attNames.length) {
      y += 6;
      ctx.font = '12px "UIFont"';
      ctx.fillStyle = DC.LINK;
      ctx.fillText(`Adjuntos: ${attNames.join(', ')}`, TEXT_X, y + LINE);
      y += LINE;
    }

    // ── Separador ───────────────────────────────────────────────────────────
    y += PAD;
    ctx.fillStyle = DC.SEP;
    ctx.fillRect(PAD, y, W - PAD * 2, 1);
    y += 12;

    // ── Footer — motivo + watermark ─────────────────────────────────────────
    // Franja roja de motivo
    ctx.fillStyle = DC.RED;
    ctx.fillRect(PAD, y, 3, 30);

    ctx.font = 'bold 12px "UIFont"';
    ctx.fillStyle = DC.RED;
    ctx.fillText(`Motivo: ${reason}`, PAD + 9, y + 14);

    ctx.font = '11px "UIFont"';
    ctx.fillStyle = DC.MUTED;
    ctx.fillText(
      `Evidencia generada por brooklynnightsBot  |  ${new Date().toLocaleString('es-ES')}`,
      PAD + 9, y + 30
    );

    // ── Exportar ────────────────────────────────────────────────────────────
    const buffer = canvas.toBuffer('image/png');
    return new AttachmentBuilder(buffer, { name: 'evidencia.png' });

  } catch (err) {
    console.error('[Evidence] Error generando captura:', err.message);
    return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Divide el texto en líneas que caben en maxPx píxeles */
function wrapText(text, maxPx, fontSize) {
  const charW   = fontSize * 0.55;
  const maxCh   = Math.floor(maxPx / charW);
  const words   = text.replace(/\n/g, ' \n ').split(' ');
  const lines   = [];
  let   cur     = '';

  for (const w of words) {
    if (w === '\n') {
      if (cur) { lines.push(cur.trimEnd()); cur = ''; }
    } else if ((cur + w).length > maxCh && cur) {
      lines.push(cur.trimEnd());
      cur = w + ' ';
    } else {
      cur += w + ' ';
    }
    if (lines.length >= 12) { lines.push('…'); return lines; }
  }
  if (cur.trim()) lines.push(cur.trimEnd());
  return lines.slice(0, 12);
}

/** Rectángulo redondeado relleno */
function fillRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
  ctx.fill();
}

module.exports = { captureEvidence };
