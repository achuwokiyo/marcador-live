export type TemplateName = "classic" | "modern" | "bold" | "sport";

export const TEMPLATE_OPTIONS: { value: TemplateName; label: string; description: string }[] = [
  { value: "classic", label: "Clasica", description: "Fondo oscuro con degradado elegante" },
  { value: "modern", label: "Moderna", description: "Diseno limpio y minimalista" },
  { value: "bold", label: "Impacto", description: "Tipografia grande y alto contraste" },
  { value: "sport", label: "Deportivo", description: "Foto a pantalla completa, estilo deportivo" },
];

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : null;
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('');
}

export function darkenColor(hex: string, amount: number): string {
  const c = hexToRgb(hex);
  if (!c) return hex;
  return rgbToHex(Math.round(c.r * (1 - amount)), Math.round(c.g * (1 - amount)), Math.round(c.b * (1 - amount)));
}

export function lightenColor(hex: string, amount: number): string {
  const c = hexToRgb(hex);
  if (!c) return hex;
  return rgbToHex(Math.round(c.r + (255 - c.r) * amount), Math.round(c.g + (255 - c.g) * amount), Math.round(c.b + (255 - c.b) * amount));
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

export function truncateText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '...').width > maxW) t = t.slice(0, -1);
  return t + '...';
}

export function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function drawBgPhoto(ctx: CanvasRenderingContext2D, img: HTMLImageElement, width: number, height: number, zoom: number, panX: number, panY: number, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const imgRatio = img.width / img.height;
  const boxRatio = width / height;
  let visibleW: number, visibleH: number;
  if (imgRatio > boxRatio) {
    visibleH = img.height / zoom;
    visibleW = visibleH * boxRatio;
  } else {
    visibleW = img.width / zoom;
    visibleH = visibleW / boxRatio;
  }
  const maxSx = img.width - visibleW;
  const maxSy = img.height - visibleH;
  ctx.drawImage(img, maxSx * panX, maxSy * panY, visibleW, visibleH, 0, 0, width, height);
  ctx.globalAlpha = 1;
  ctx.restore();
}

export async function drawSponsor(ctx: CanvasRenderingContext2D, sponsorName: string, sponsorLogo: string | null | undefined, width: number, y: number): Promise<number> {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = '16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Patrocinado por', width / 2, y);

  if (sponsorLogo) {
    try {
      const sImg = await loadImage(sponsorLogo);
      const maxH = 36;
      const scale = maxH / sImg.height;
      const sW = sImg.width * scale;
      const nameW = ctx.measureText(sponsorName).width;
      const totalW = sW + 12 + nameW;
      const startX = width / 2 - totalW / 2;
      ctx.drawImage(sImg, startX, y + 8, sW, maxH);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(sponsorName, startX + sW + 12, y + 32);
      ctx.textAlign = 'center';
      return y + 52;
    } catch {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.fillText(sponsorName, width / 2, y + 30);
      return y + 42;
    }
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(sponsorName, width / 2, y + 30);
    return y + 42;
  }
}

export function drawBranding(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = '16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Sigue los marcadores en directo en', width / 2, height - 38);
  const brandGrad = ctx.createLinearGradient(width * 0.3, 0, width * 0.7, 0);
  brandGrad.addColorStop(0, '#22c55e');
  brandGrad.addColorStop(1, '#3b82f6');
  ctx.fillStyle = brandGrad;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('marcadorlive.com', width / 2, height - 14);
}
