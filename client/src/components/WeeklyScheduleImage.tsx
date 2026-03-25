import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Share2, Download, Loader2, CalendarDays, ImagePlus, ZoomIn, Move } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import type { ClubMatchday, ClubTeam, ClubSponsor } from "@shared/schema";
import { type TemplateName, loadImage, drawRoundedRect, drawBgPhoto, drawSponsor, drawBranding, darkenColor, lightenColor, truncateText } from "@/lib/imageTemplates";

interface MatchEntry {
  teamName: string;
  teamColor: string;
  category: string;
  rival: string;
  date: string;
  time: string;
  venue: string;
  isHome: boolean;
}

interface WeeklyScheduleImageProps {
  clubName: string;
  clubPrimaryColor: string;
  clubSecondaryColor: string;
  clubLogoUrl?: string | null;
  matchdays: ClubMatchday[];
  teams: ClubTeam[];
  sponsors: ClubSponsor[];
  template?: TemplateName;
}

function formatMatchDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  const days = ["DOM", "LUN", "MAR", "MIE", "JUE", "VIE", "SAB"];
  const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
}

function getWeekRange(matchdays: ClubMatchday[]): string {
  const dates = matchdays
    .filter(md => md.date)
    .map(md => new Date(md.date!))
    .sort((a, b) => a.getTime() - b.getTime());
  if (dates.length === 0) return "";
  const months = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (first.getMonth() === last.getMonth()) {
    return `${first.getDate()} - ${last.getDate()} ${months[first.getMonth()]}`;
  }
  return `${first.getDate()} ${months[first.getMonth()].substring(0, 3)} - ${last.getDate()} ${months[last.getMonth()].substring(0, 3)}`;
}

async function renderClassic(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  matches: MatchEntry[],
  cat: string,
  opts: {
    clubName: string; primaryColor: string; secondaryColor: string;
    logoImg: HTMLImageElement | null; bgImg: HTMLImageElement | null;
    photoZoom: number; photoPanX: number; photoPanY: number;
    title: string; weekRange: string;
    showSponsor: boolean; sponsor: ClubSponsor | null;
  }
) {
  const width = 1080;
  const matchRowH = 130;
  const headerH = 320;
  const footerH = 120;
  const matchesAreaH = matches.length * matchRowH + 30;
  const height = Math.max(1080, headerH + matchesAreaH + footerH);
  canvas.width = width;
  canvas.height = height;

  const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
  bgGradient.addColorStop(0, darkenColor(opts.primaryColor, 0.1));
  bgGradient.addColorStop(0.5, darkenColor(opts.primaryColor, 0.4));
  bgGradient.addColorStop(1, darkenColor(opts.primaryColor, 0.7));
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  if (opts.bgImg) {
    drawBgPhoto(ctx, opts.bgImg, width, height, opts.photoZoom, opts.photoPanX, opts.photoPanY, 0.12);
  }

  const accentGrad = ctx.createLinearGradient(0, 0, width, 0);
  accentGrad.addColorStop(0, opts.secondaryColor);
  accentGrad.addColorStop(1, lightenColor(opts.secondaryColor, 0.3));
  ctx.fillStyle = accentGrad;
  ctx.fillRect(0, 0, width, 8);

  let y = 50;
  if (opts.logoImg) {
    const logoSize = 80;
    ctx.drawImage(opts.logoImg, width / 2 - logoSize / 2, y, logoSize, logoSize);
    y += logoSize + 20;
  }

  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.textAlign = 'center';
  ctx.fillText(opts.clubName.toUpperCase(), width / 2, y);
  y += 40;

  ctx.font = 'bold 48px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(opts.title, width / 2, y);
  y += 35;

  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillStyle = opts.secondaryColor;
  ctx.fillText(cat.toUpperCase(), width / 2, y);
  y += 25;

  if (opts.weekRange) {
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillText(opts.weekRange, width / 2, y);
    y += 20;
  }

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, y + 5);
  ctx.lineTo(width - 60, y + 5);
  ctx.stroke();
  y += 20;

  const cardPad = 40;
  matches.forEach((match, idx) => {
    const rowY = y + idx * matchRowH;
    const cardH = matchRowH - 14;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    drawRoundedRect(ctx, cardPad, rowY, width - cardPad * 2, cardH, 14);
    ctx.fill();

    ctx.fillStyle = match.teamColor;
    drawRoundedRect(ctx, cardPad, rowY, 6, cardH, 3);
    ctx.fill();

    const textX = cardPad + 28;
    const homeTeam = match.isHome ? match.teamName : match.rival;
    const awayTeam = match.isHome ? match.rival : match.teamName;

    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    const maxTextW = width - cardPad * 2 - 160;
    ctx.fillText(truncateText(ctx, `${homeTeam}  vs  ${awayTeam}`, maxTextW), textX, rowY + 40);

    ctx.font = '19px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    const infoParts = [match.date, match.time, match.venue].filter(Boolean);
    ctx.fillText(infoParts.join('  ·  '), textX, rowY + 72);

    const badgeText = match.isHome ? "LOCAL" : "VISITANTE";
    const badgeColor = match.isHome ? '#22c55e' : '#f59e0b';
    ctx.font = 'bold 14px system-ui, sans-serif';
    const badgeW = ctx.measureText(badgeText).width + 18;
    const badgeX = width - cardPad - badgeW - 16;
    ctx.fillStyle = badgeColor + '30';
    drawRoundedRect(ctx, badgeX, rowY + 18, badgeW, 26, 7);
    ctx.fill();
    ctx.fillStyle = badgeColor;
    ctx.textAlign = 'left';
    ctx.fillText(badgeText, badgeX + 9, badgeY(rowY));
    ctx.textAlign = 'center';
  });

  let footerY = y + matches.length * matchRowH + 15;
  if (opts.showSponsor && opts.sponsor) {
    footerY = await drawSponsor(ctx, opts.sponsor.name, opts.sponsor.logoUrl, width, footerY);
    footerY += 10;
  }
  drawBranding(ctx, width, height);
}

function badgeY(rowY: number) { return rowY + 36; }

async function renderModern(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  matches: MatchEntry[],
  cat: string,
  opts: {
    clubName: string; primaryColor: string; secondaryColor: string;
    logoImg: HTMLImageElement | null; bgImg: HTMLImageElement | null;
    photoZoom: number; photoPanX: number; photoPanY: number;
    title: string; weekRange: string;
    showSponsor: boolean; sponsor: ClubSponsor | null;
  }
) {
  const width = 1080;
  const matchRowH = 140;
  const headerH = 300;
  const footerH = 130;
  const matchesAreaH = matches.length * matchRowH + 30;
  const height = Math.max(1080, headerH + matchesAreaH + footerH);
  canvas.width = width;
  canvas.height = height;

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, height);

  if (opts.bgImg) {
    drawBgPhoto(ctx, opts.bgImg, width, height, opts.photoZoom, opts.photoPanX, opts.photoPanY, 0.06);
  }

  ctx.fillStyle = opts.primaryColor;
  ctx.fillRect(0, 0, width, 200);

  let y = 35;
  if (opts.logoImg) {
    const logoSize = 65;
    ctx.drawImage(opts.logoImg, 50, y, logoSize, logoSize);
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(opts.clubName.toUpperCase(), 130, y + 28);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText(opts.weekRange || '', 130, y + 52);
  } else {
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(opts.clubName.toUpperCase(), 50, y + 28);
  }
  y = 130;

  ctx.font = 'bold 42px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(opts.title, 50, y);
  y += 35;

  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillStyle = opts.secondaryColor;
  ctx.fillText(cat.toUpperCase(), 50, y);
  y = 230;

  const cardPad = 35;
  const cardGap = 12;
  matches.forEach((match, idx) => {
    const rowY = y + idx * matchRowH;
    const cardH = matchRowH - cardGap;

    ctx.shadowColor = 'rgba(0,0,0,0.08)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#ffffff';
    drawRoundedRect(ctx, cardPad, rowY, width - cardPad * 2, cardH, 16);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.fillStyle = match.teamColor;
    ctx.fillRect(cardPad, rowY + 14, 5, cardH - 28);

    const textX = cardPad + 24;
    const homeTeam = match.isHome ? match.teamName : match.rival;
    const awayTeam = match.isHome ? match.rival : match.teamName;

    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.textAlign = 'left';
    const maxTextW = width - cardPad * 2 - 170;
    ctx.fillText(truncateText(ctx, `${homeTeam}  vs  ${awayTeam}`, maxTextW), textX, rowY + 42);

    ctx.font = '18px system-ui, sans-serif';
    ctx.fillStyle = '#64748b';
    const infoParts = [match.date, match.time, match.venue].filter(Boolean);
    ctx.fillText(infoParts.join('  ·  '), textX, rowY + 74);

    const badgeText = match.isHome ? "LOCAL" : "VISITANTE";
    const badgeColor = match.isHome ? '#16a34a' : '#d97706';
    ctx.font = 'bold 13px system-ui, sans-serif';
    const badgeW = ctx.measureText(badgeText).width + 18;
    const badgeX = width - cardPad - badgeW - 16;
    ctx.fillStyle = badgeColor + '18';
    drawRoundedRect(ctx, badgeX, rowY + 22, badgeW, 26, 7);
    ctx.fill();
    ctx.fillStyle = badgeColor;
    ctx.textAlign = 'left';
    ctx.fillText(badgeText, badgeX + 9, rowY + 40);
    ctx.textAlign = 'center';
  });

  let footerY = y + matches.length * matchRowH + 15;
  if (opts.showSponsor && opts.sponsor) {
    ctx.fillStyle = 'rgba(100, 116, 139, 0.5)';
    ctx.font = '14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Patrocinado por', width / 2, footerY);
    if (opts.sponsor.logoUrl) {
      try {
        const sImg = await loadImage(opts.sponsor.logoUrl);
        const maxH = 34;
        const scale = maxH / sImg.height;
        const sW = sImg.width * scale;
        ctx.drawImage(sImg, width / 2 - sW / 2 - 50, footerY + 8, sW, maxH);
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 20px system-ui, sans-serif';
        ctx.fillText(opts.sponsor.name, width / 2 + sW / 2 - 30, footerY + 32);
      } catch {
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 20px system-ui, sans-serif';
        ctx.fillText(opts.sponsor.name, width / 2, footerY + 30);
      }
    } else {
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillText(opts.sponsor.name, width / 2, footerY + 30);
    }
    footerY += 50;
  }

  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Sigue los marcadores en directo en', width / 2, height - 36);
  ctx.fillStyle = opts.primaryColor;
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText('marcadorlive.com', width / 2, height - 14);
}

async function renderBold(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  matches: MatchEntry[],
  cat: string,
  opts: {
    clubName: string; primaryColor: string; secondaryColor: string;
    logoImg: HTMLImageElement | null; bgImg: HTMLImageElement | null;
    photoZoom: number; photoPanX: number; photoPanY: number;
    title: string; weekRange: string;
    showSponsor: boolean; sponsor: ClubSponsor | null;
  }
) {
  const width = 1080;
  const matchRowH = 155;
  const headerH = 320;
  const footerH = 130;
  const matchesAreaH = matches.length * matchRowH + 30;
  const height = Math.max(1080, headerH + matchesAreaH + footerH);
  canvas.width = width;
  canvas.height = height;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  if (opts.bgImg) {
    drawBgPhoto(ctx, opts.bgImg, width, height, opts.photoZoom, opts.photoPanX, opts.photoPanY, 0.08);
  }

  ctx.fillStyle = opts.primaryColor;
  ctx.fillRect(0, 0, width, 10);
  ctx.fillStyle = opts.secondaryColor;
  ctx.fillRect(0, 10, width, 4);

  let y = 50;
  if (opts.logoImg) {
    const logoSize = 90;
    ctx.drawImage(opts.logoImg, width / 2 - logoSize / 2, y, logoSize, logoSize);
    y += logoSize + 18;
  }

  ctx.font = 'bold 60px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(opts.title, width / 2, y + 10);
  y += 35;

  ctx.fillStyle = opts.primaryColor;
  ctx.fillRect(width / 2 - 100, y, 200, 5);
  y += 25;

  ctx.font = 'bold 32px system-ui, sans-serif';
  ctx.fillStyle = opts.secondaryColor;
  ctx.fillText(cat.toUpperCase(), width / 2, y);
  y += 25;

  ctx.font = '18px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText(opts.clubName.toUpperCase() + (opts.weekRange ? `  ·  ${opts.weekRange}` : ''), width / 2, y);
  y += 30;

  const cardPad = 30;
  matches.forEach((match, idx) => {
    const rowY = y + idx * matchRowH;
    const cardH = matchRowH - 16;

    const grad = ctx.createLinearGradient(cardPad, rowY, width - cardPad, rowY);
    grad.addColorStop(0, match.teamColor + '35');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.04)');
    ctx.fillStyle = grad;
    drawRoundedRect(ctx, cardPad, rowY, width - cardPad * 2, cardH, 10);
    ctx.fill();

    ctx.strokeStyle = match.teamColor + '50';
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, cardPad, rowY, width - cardPad * 2, cardH, 10);
    ctx.stroke();

    const textX = cardPad + 24;
    const homeTeam = match.isHome ? match.teamName : match.rival;
    const awayTeam = match.isHome ? match.rival : match.teamName;

    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    const maxTextW = width - cardPad * 2 - 48;
    ctx.fillText(truncateText(ctx, homeTeam.toUpperCase(), maxTextW), textX, rowY + 42);

    ctx.font = '20px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText('VS', textX, rowY + 68);

    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillStyle = match.teamColor;
    ctx.fillText(truncateText(ctx, awayTeam.toUpperCase(), maxTextW), textX + 40, rowY + 68);

    ctx.font = '20px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    const infoParts = [match.date, match.time, match.venue].filter(Boolean);
    ctx.fillText(infoParts.join('  ·  '), textX, rowY + 102);

    const badgeText = match.isHome ? "LOCAL" : "VISITANTE";
    const badgeColor = match.isHome ? '#22c55e' : '#f59e0b';
    ctx.font = 'bold 15px system-ui, sans-serif';
    const badgeW = ctx.measureText(badgeText).width + 20;
    const badgeX = width - cardPad - badgeW - 16;
    ctx.fillStyle = badgeColor;
    drawRoundedRect(ctx, badgeX, rowY + 18, badgeW, 28, 5);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.fillText(badgeText, badgeX + 10, rowY + 38);
    ctx.textAlign = 'center';
  });

  let footerY = y + matches.length * matchRowH + 15;
  if (opts.showSponsor && opts.sponsor) {
    footerY = await drawSponsor(ctx, opts.sponsor.name, opts.sponsor.logoUrl, width, footerY);
    footerY += 10;
  }
  drawBranding(ctx, width, height);
}

export function WeeklyScheduleImage({ clubName, clubPrimaryColor, clubSecondaryColor, clubLogoUrl, matchdays, teams, sponsors, template = "classic" }: WeeklyScheduleImageProps) {
  const [open, setOpen] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<{ category: string; image: string }[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editTitle, setEditTitle] = useState("PARTIDOS DE LA SEMANA");
  const [showSponsor, setShowSponsor] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("__all__");
  const [bgPhoto, setBgPhoto] = useState<string | null>(null);
  const [photoZoom, setPhotoZoom] = useState(1);
  const [photoPanX, setPhotoPanX] = useState(0.5);
  const [photoPanY, setPhotoPanY] = useState(0.5);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0.5, y: 0.5 });
  const previewRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pendingMatches = matchdays.filter(md => {
    const matchStatus = (md as any).matchStatus;
    return !matchStatus || matchStatus === "scheduled" || md.status === "pending";
  });

  const categorizedMatches = new Map<string, MatchEntry[]>();
  pendingMatches.forEach(md => {
    const team = teams.find(t => t.id === md.teamId);
    if (!team) return;
    const cat = team.category || "Sin categoria";
    if (!categorizedMatches.has(cat)) categorizedMatches.set(cat, []);
    categorizedMatches.get(cat)!.push({
      teamName: team.name,
      teamColor: team.color || clubPrimaryColor,
      category: cat,
      rival: md.rival,
      date: formatMatchDate(md.date),
      time: md.time || "",
      venue: md.venue || "",
      isHome: md.isHome ?? true,
    });
  });

  const categories = [...categorizedMatches.keys()].sort();
  const mainSponsor = sponsors.find(s => s.tier === "gold") || sponsors[0] || null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setBgPhoto(event.target?.result as string);
        setPhotoZoom(1);
        setPhotoPanX(0.5);
        setPhotoPanY(0.5);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!bgPhoto || !previewRef.current) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setPanStart({ x: photoPanX, y: photoPanY });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    const dx = (e.clientX - dragStart.x) / rect.width;
    const dy = (e.clientY - dragStart.y) / rect.height;
    setPhotoPanX(Math.max(0, Math.min(1, panStart.x - dx)));
    setPhotoPanY(Math.max(0, Math.min(1, panStart.y - dy)));
  };

  const handlePointerUp = () => setIsDragging(false);

  useEffect(() => { if (!open) setGeneratedImages([]); }, [open]);

  const generateImage = useCallback(async () => {
    if (!canvasRef.current) return;
    setIsGenerating(true);

    const results: { category: string; image: string }[] = [];
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setIsGenerating(false); return; }

    const categoriesToRender = selectedCategory === "__all__" ? categories : [selectedCategory];

    const [bgImg, logoImg] = await Promise.all([
      bgPhoto ? loadImage(bgPhoto).catch(() => null) : Promise.resolve(null),
      clubLogoUrl ? loadImage(clubLogoUrl).catch(() => null) : Promise.resolve(null),
    ]);

    for (const cat of categoriesToRender) {
      const matches = categorizedMatches.get(cat) || [];
      if (matches.length === 0) continue;

      const weekRange = getWeekRange(pendingMatches.filter(md => {
        const t = teams.find(t2 => t2.id === md.teamId);
        return t?.category === cat;
      }));

      const opts = {
        clubName, primaryColor: clubPrimaryColor, secondaryColor: clubSecondaryColor,
        logoImg, bgImg, photoZoom, photoPanX, photoPanY,
        title: editTitle, weekRange,
        showSponsor, sponsor: mainSponsor,
      };

      if (template === "modern") {
        await renderModern(ctx, canvas, matches, cat, opts);
      } else if (template === "bold") {
        await renderBold(ctx, canvas, matches, cat, opts);
      } else {
        await renderClassic(ctx, canvas, matches, cat, opts);
      }

      try {
        results.push({ category: cat, image: canvas.toDataURL('image/jpeg', 0.92) });
      } catch { /* skip */ }
    }

    setGeneratedImages(results);
    setIsGenerating(false);
  }, [pendingMatches, teams, categorizedMatches, categories, selectedCategory, editTitle, showSponsor, mainSponsor, clubName, clubPrimaryColor, clubSecondaryColor, clubLogoUrl, bgPhoto, photoZoom, photoPanX, photoPanY, template]);

  const handleShare = async (imageData: string, category: string) => {
    const shareText = `${editTitle}\n${category} - ${clubName}\n\nSigue los marcadores en directo en marcadorlive.com`;
    try {
      const response = await fetch(imageData);
      const blob = await response.blob();
      const file = new File([blob], `jornada-${category.toLowerCase().replace(/\s+/g, '-')}.jpg`, { type: 'image/jpeg' });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `${editTitle} - ${category}`, text: shareText });
      } else {
        navigator.clipboard.writeText(shareText);
        handleDownload(imageData, category);
      }
    } catch (err) {
      console.error('Share failed:', err);
    }
  };

  const handleDownload = (imageData: string, category: string) => {
    const link = document.createElement('a');
    link.download = `jornada-${category.toLowerCase().replace(/\s+/g, '-')}.jpg`;
    link.href = imageData;
    link.click();
  };

  if (pendingMatches.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" data-testid="button-weekly-schedule">
          <CalendarDays className="w-4 h-4" />
          <span className="hidden sm:inline">Imagen Semanal</span>
          <span className="sm:hidden">Semanal</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            Imagen de Jornada
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {generatedImages.length === 0 ? (
            <>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Titulo</Label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="PARTIDOS DE LA SEMANA" data-testid="input-weekly-title" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Categoria</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} data-testid="select-weekly-category">
                  <option value="__all__">Todas (una imagen por categoria)</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat} ({categorizedMatches.get(cat)?.length || 0} partidos)</option>
                  ))}
                </select>
              </div>

              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} data-testid="input-weekly-bg-photo" />
              <div
                ref={previewRef}
                className={`border-2 border-dashed border-slate-300 rounded-xl overflow-hidden text-center ${bgPhoto ? '' : 'p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800'} transition-all`}
                onClick={() => { if (!bgPhoto) fileInputRef.current?.click(); }}
                data-testid="button-upload-weekly-bg"
              >
                {bgPhoto ? (
                  <div>
                    <div className="w-full h-32 overflow-hidden cursor-grab active:cursor-grabbing relative select-none touch-none" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}>
                      <img src={bgPhoto} alt="Fondo" className="w-full h-full object-cover pointer-events-none" style={{ transform: `scale(${photoZoom})`, transformOrigin: `${photoPanX * 100}% ${photoPanY * 100}%` }} draggable={false} />
                      <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1 pointer-events-none">
                        <Move className="w-3 h-3" /> Arrastra
                      </div>
                    </div>
                    <div className="px-3 py-2 space-y-1.5 bg-slate-50 dark:bg-slate-800">
                      <div className="flex items-center gap-2">
                        <ZoomIn className="w-3 h-3 text-slate-500 shrink-0" />
                        <Slider value={[photoZoom]} onValueChange={([v]) => setPhotoZoom(v)} min={1} max={3} step={0.05} className="flex-1" />
                        <span className="text-xs text-slate-500 w-8 text-right">{Math.round(photoZoom * 100)}%</span>
                      </div>
                      <button type="button" className="text-xs text-primary underline w-full text-center" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>Cambiar fondo</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <ImagePlus className="w-8 h-8 mx-auto text-slate-400" />
                    <p className="font-medium text-sm text-slate-700 dark:text-slate-300">Foto de fondo (opcional)</p>
                  </div>
                )}
              </div>

              {mainSponsor && (
                <div className="flex items-center gap-2">
                  <Checkbox id="show-sponsor-weekly" checked={showSponsor} onCheckedChange={(checked) => setShowSponsor(!!checked)} data-testid="checkbox-show-sponsor-weekly" />
                  <Label htmlFor="show-sponsor-weekly" className="text-sm cursor-pointer">Incluir patrocinador ({mainSponsor.name})</Label>
                </div>
              )}

              <div className="bg-muted/50 p-3 rounded-lg text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Vista previa:</p>
                {categories.map(cat => {
                  if (selectedCategory !== "__all__" && selectedCategory !== cat) return null;
                  const m = categorizedMatches.get(cat) || [];
                  return (
                    <div key={cat} className="mb-2">
                      <p className="font-semibold text-foreground">{cat} ({m.length} partidos)</p>
                      {m.map((match, i) => (
                        <p key={i} className="ml-2">{match.isHome ? `${match.teamName} vs ${match.rival}` : `${match.rival} vs ${match.teamName}`}{match.date ? ` · ${match.date}` : ""}{match.time ? ` ${match.time}` : ""}</p>
                      ))}
                    </div>
                  );
                })}
              </div>

              <Button className="w-full gap-2" onClick={generateImage} disabled={isGenerating} data-testid="button-generate-weekly-image">
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />}
                {selectedCategory === "__all__" ? `Generar ${categories.length} imagenes` : "Generar imagen"}
              </Button>
            </>
          ) : (
            <div className="space-y-6">
              {generatedImages.map(({ category, image }, idx) => (
                <div key={idx} className="space-y-2">
                  <p className="font-semibold text-sm text-center" data-testid={`text-category-${idx}`}>{category}</p>
                  <div className="rounded-xl overflow-hidden shadow-lg">
                    <img src={image} alt={`Jornada ${category}`} className="w-full block" data-testid={`img-weekly-${idx}`} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => handleDownload(image, category)} data-testid={`button-download-weekly-${idx}`}>
                      <Download className="w-3 h-3" /> Descargar
                    </Button>
                    <Button size="sm" className="gap-1" onClick={() => handleShare(image, category)} data-testid={`button-share-weekly-${idx}`}>
                      <Share2 className="w-3 h-3" /> Compartir
                    </Button>
                  </div>
                </div>
              ))}
              <Button variant="ghost" className="w-full text-sm" onClick={() => setGeneratedImages([])} data-testid="button-create-another-weekly">Crear otras imagenes</Button>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
}
