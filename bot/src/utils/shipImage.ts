let canvasModule: any = null;
function getCanvas() {
  if (!canvasModule) canvasModule = require('@napi-rs/canvas');
  return canvasModule;
}

function consistentRandom(id1: string, id2: string): number {
  const sorted = [id1, id2].sort();
  let hash = 0;
  const str = `${sorted[0]}:${sorted[1]}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 101;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function getPercentColor(percent: number): string {
  if (percent >= 80) return '#ff69b4';
  if (percent >= 60) return '#ff9a5c';
  if (percent >= 40) return '#ffd700';
  if (percent >= 20) return '#ff6347';
  return '#888888';
}

function getGlowColor(percent: number): string {
  if (percent >= 80) return '#ff69b4';
  if (percent >= 60) return '#ff9a5c';
  if (percent >= 40) return '#ffd700';
  return '#ff6347';
}

function getLabel(percent: number): string {
  if (percent >= 90) return 'SOULMATES';
  if (percent >= 75) return 'PERFECT MATCH';
  if (percent >= 60) return 'GREAT MATCH';
  if (percent >= 40) return 'JUST FRIENDS';
  if (percent >= 20) return 'UNLIKELY';
  return 'TOXIC';
}

function drawRoundedRect(ctx: any, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawHeart(ctx: any, cx: number, cy: number, size: number, color: string): void {
  ctx.save();
  ctx.translate(cx, cy);
  const s = size / 20;
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, -3);
  ctx.bezierCurveTo(-2, -10, -15, -12, -15, -2);
  ctx.bezierCurveTo(-15, 6, 0, 14, 0, 18);
  ctx.bezierCurveTo(0, 14, 15, 6, 15, -2);
  ctx.bezierCurveTo(15, -12, 2, -10, 0, -3);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();
}

function drawGlowCircle(ctx: any, cx: number, cy: number, r: number, color: string, intensity: number): void {
  const [cr, cg, cb] = hexToRgb(color);
  for (let i = intensity; i >= 1; i--) {
    const alpha = 0.06 / i;
    ctx.beginPath();
    ctx.arc(cx, cy, r + i * 8, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;
    ctx.fill();
  }
}

export async function generateShipImage(
  user1Tag: string,
  user1AvatarUrl: string | null,
  user2Tag: string,
  user2AvatarUrl: string | null,
): Promise<Buffer> {
  const { createCanvas, loadImage } = getCanvas();

  const W = 420;
  const H = 320;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const percent = consistentRandom(user1Tag + (user1AvatarUrl ?? ''), user2Tag + (user2AvatarUrl ?? ''));
  const color = getPercentColor(percent);
  const glowColor = getGlowColor(percent);
  const label = getLabel(percent);

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#0f0c29');
  bgGrad.addColorStop(0.5, '#1a1040');
  bgGrad.addColorStop(1, '#0f0c29');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle radial glow behind center
  const centerGrad = ctx.createRadialGradient(W / 2, H / 2 - 20, 0, W / 2, H / 2 - 20, 180);
  const [cr, cg, cb] = hexToRgb(color);
  centerGrad.addColorStop(0, `rgba(${cr},${cg},${cb},0.08)`);
  centerGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = centerGrad;
  ctx.fillRect(0, 0, W, H);

  // Avatar config
  const avatarR = 52;
  const avatarY = 100;
  const avatar1X = 105;
  const avatar2X = W - 105;

  // Glow behind avatars
  drawGlowCircle(ctx, avatar1X, avatarY, avatarR, color, 4);
  drawGlowCircle(ctx, avatar2X, avatarY, avatarR, color, 4);

  // Avatar ring
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(avatar1X, avatarY, avatarR + 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(avatar2X, avatarY, avatarR + 2, 0, Math.PI * 2);
  ctx.stroke();

  // Load and draw avatars
  const drawAvatar = async (url: string | null, cx: number, cy: number) => {
    try {
      if (url) {
        const img = await loadImage(url);
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, avatarR, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, cx - avatarR, cy - avatarR, avatarR * 2, avatarR * 2);
        ctx.restore();
      } else {
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(cx, cy, avatarR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', cx, cy);
      }
    } catch {
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(cx, cy, avatarR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', cx, cy);
    }
  };

  await drawAvatar(user1AvatarUrl, avatar1X, avatarY);
  await drawAvatar(user2AvatarUrl, avatar2X, avatarY);

  // Connecting line (dashed, behind heart)
  ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.25)`;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(avatar1X + avatarR + 12, avatarY);
  ctx.lineTo(avatar2X - avatarR - 12, avatarY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Heart in center
  drawHeart(ctx, W / 2, avatarY, 28, color);

  // Inner heart glow
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  drawHeart(ctx, W / 2, avatarY, 22, `rgba(${cr},${cg},${cb},0.3)`);
  ctx.restore();

  // Username labels
  const maxLen = 11;
  const name1 = user1Tag.length > maxLen ? user1Tag.slice(0, maxLen) + '…' : user1Tag;
  const name2 = user2Tag.length > maxLen ? user2Tag.slice(0, maxLen) + '…' : user2Tag;

  ctx.fillStyle = '#e0e0e0';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(name1, avatar1X, avatarY + avatarR + 14);
  ctx.fillText(name2, avatar2X, avatarY + avatarR + 14);

  // Percentage
  ctx.fillStyle = color;
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 15;
  ctx.fillText(`${percent}%`, W / 2, H - 80);
  ctx.shadowBlur = 0;

  // Label
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, W / 2, H - 55);

  // Progress bar
  const barX = 55;
  const barY = H - 35;
  const barW = W - 110;
  const barH = 10;

  // Bar background
  drawRoundedRect(ctx, barX, barY, barW, barH, 5);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fill();

  // Bar fill
  const fillW = Math.max((barW * percent) / 100, percent > 0 ? 10 : 0);
  if (fillW > 0) {
    const fillGrad = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
    fillGrad.addColorStop(0, color);
    fillGrad.addColorStop(1, `rgba(${cr},${cg},${cb},0.6)`);
    drawRoundedRect(ctx, barX, barY, fillW, barH, 5);
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // Bar glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Bar outline
  drawRoundedRect(ctx, barX, barY, barW, barH, 5);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  return canvas.toBuffer('image/png');
}
