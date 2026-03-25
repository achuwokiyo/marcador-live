import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Share2, Download, ImagePlus, Loader2, Megaphone, ZoomIn, Move } from "lucide-react";
import type { TemplateName } from "@/lib/imageTemplates";
import { darkenColor, lightenColor, truncateText } from "@/lib/imageTemplates";

interface MatchdayImageProps {
  matchId?: number;
  localTeam: string;
  awayTeam: string;
  localTeamColor?: string;
  awayTeamColor?: string;
  localTeamLogo?: string | null;
  awayTeamLogo?: string | null;
  scheduledDate?: Date | string | null;
  scheduledTime?: string | null;
  venue?: string | null;
  category?: string | null;
  league?: string | null;
  fullWidth?: boolean;
  sponsorName?: string | null;
  sponsorLogo?: string | null;
  template?: TemplateName;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

function formatDateForDisplay(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  return `${days[date.getDay()]} ${date.getDate()} de ${months[date.getMonth()]}`;
}

export function MatchdayImage({ matchId, localTeam, awayTeam, localTeamColor = '#3b82f6', awayTeamColor = '#ef4444', localTeamLogo, awayTeamLogo, scheduledDate, scheduledTime, venue, category, league, fullWidth, sponsorName, sponsorLogo, template = 'classic' }: MatchdayImageProps) {
  const [open, setOpen] = useState(false);
  const [playerPhoto, setPlayerPhoto] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editDate, setEditDate] = useState(formatDateForDisplay(scheduledDate));
  const [editTime, setEditTime] = useState(scheduledTime || "");
  const [editVenue, setEditVenue] = useState(venue || "");
  const [editCategory, setEditCategory] = useState(category || "");
  const [editLeague, setEditLeague] = useState(league || "");
  const [showSponsor, setShowSponsor] = useState(!!sponsorName);
  const sponsorInitRef = useRef(false);
  useEffect(() => {
    if (sponsorName && !sponsorInitRef.current) {
      setShowSponsor(true);
      sponsorInitRef.current = true;
    }
  }, [sponsorName]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photoZoom, setPhotoZoom] = useState(1);
  const [photoPanX, setPhotoPanX] = useState(0.5);
  const [photoPanY, setPhotoPanY] = useState(0.5);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0.5, y: 0.5 });
  const previewRef = useRef<HTMLDivElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPlayerPhoto(event.target?.result as string);
        setGeneratedImage(null);
        setPhotoZoom(1);
        setPhotoPanX(0.5);
        setPhotoPanY(0.5);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!playerPhoto || !previewRef.current) return;
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

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (!open) return;
    setEditDate(formatDateForDisplay(scheduledDate));
    setEditTime(scheduledTime || "");
    setEditVenue(venue || "");
    setEditCategory(category || "");
    setEditLeague(league || "");
  }, [open, scheduledDate, scheduledTime, venue, category, league]);

  const generateImage = useCallback(async () => {
    if (!canvasRef.current) return;
    
    setIsGenerating(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setIsGenerating(false); return; }

    const width = 1080;
    const height = 1350;
    canvas.width = width;
    canvas.height = height;

    const [localLogoImg, awayLogoImg, playerImg] = await Promise.all([
      localTeamLogo ? loadImage(localTeamLogo).catch(() => null) : Promise.resolve(null),
      awayTeamLogo ? loadImage(awayTeamLogo).catch(() => null) : Promise.resolve(null),
      playerPhoto ? loadImage(playerPhoto).catch(() => null) : Promise.resolve(null),
    ]);

    const isModern = template === 'modern';
    const isBold = template === 'bold';
    const isSport = template === 'sport';

    if (isSport) {
      const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
      bgGradient.addColorStop(0, '#1a1a2e');
      bgGradient.addColorStop(1, '#0a0a15');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      if (playerImg) {
        const imgRatio = playerImg.width / playerImg.height;
        const boxRatio = width / height;
        let visibleW: number, visibleH: number;
        if (imgRatio > boxRatio) {
          visibleH = playerImg.height / photoZoom;
          visibleW = visibleH * boxRatio;
        } else {
          visibleW = playerImg.width / photoZoom;
          visibleH = visibleW / boxRatio;
        }
        const maxSx = playerImg.width - visibleW;
        const maxSy = playerImg.height - visibleH;
        ctx.drawImage(playerImg, maxSx * photoPanX, maxSy * photoPanY, visibleW, visibleH, 0, 0, width, height);
      }

      const gradH = height * 0.55;
      const bottomGrad = ctx.createLinearGradient(0, height - gradH, 0, height);
      bottomGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      bottomGrad.addColorStop(0.35, 'rgba(0, 0, 0, 0.6)');
      bottomGrad.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
      ctx.fillStyle = bottomGrad;
      ctx.fillRect(0, height - gradH, width, gradH);

      const leftX = 60;

      const sponsorBlockH = (showSponsor && sponsorName) ? 55 : 0;
      const brandingBaseY = height - 14;
      const brandingLabelY = height - 42;
      const sponsorBaseYSport = brandingLabelY - 10 - sponsorBlockH;

      let curY = sponsorBaseYSport - 20;

      const dateTimeStr = [editDate, editTime].filter(Boolean).join(' · ');
      if (dateTimeStr) {
        curY -= 26;
      }
      if (editVenue) {
        curY -= 26;
      }
      const infoY = curY;

      curY -= 34;
      const subtitleY = curY;

      curY -= 80;
      const titleY = curY;

      curY -= 40;
      const teamNameY = curY;

      const logoSize = 40;
      curY -= (logoSize + 10);
      const logoY = curY;

      ctx.font = 'bold 30px system-ui, sans-serif';
      ctx.textAlign = 'left';
      const maxTeamW = (width - leftX * 2 - 80) / 2;
      const localName = truncateText(ctx, localTeam.toUpperCase(), maxTeamW);
      const awayName = truncateText(ctx, awayTeam.toUpperCase(), maxTeamW);
      const localNameW = ctx.measureText(localName).width;
      const vsText = '  vs  ';
      const vsW = ctx.measureText(vsText).width;
      const awayNameX = leftX + localNameW + vsW;
      const awayNameW = ctx.measureText(awayName).width;

      const localLogoCenterX = leftX + localNameW / 2;
      const awayLogoCenterX = awayNameX + awayNameW / 2;

      if (localLogoImg) {
        ctx.drawImage(localLogoImg, localLogoCenterX - logoSize / 2, logoY, logoSize, logoSize);
      } else {
        ctx.fillStyle = localTeamColor;
        ctx.beginPath();
        ctx.arc(localLogoCenterX, logoY + logoSize / 2, 16, 0, Math.PI * 2);
        ctx.fill();
      }

      if (awayLogoImg) {
        ctx.drawImage(awayLogoImg, awayLogoCenterX - logoSize / 2, logoY, logoSize, logoSize);
      } else {
        ctx.fillStyle = awayTeamColor;
        ctx.beginPath();
        ctx.arc(awayLogoCenterX, logoY + logoSize / 2, 16, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.font = 'bold 30px system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText(localName, leftX, teamNameY);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText(vsText, leftX + localNameW, teamNameY);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(awayName, awayNameX, teamNameY);

      ctx.font = 'bold italic 80px system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('NEXT', leftX, titleY);
      const nextW = ctx.measureText('NEXT').width;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.strokeText('MATCH', leftX + nextW + 16, titleY);

      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fillText('PRÓXIMO PARTIDO', leftX + 4, subtitleY);

      ctx.font = '22px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      let infoOffset = 0;
      if (editVenue) {
        ctx.fillText(editVenue.toUpperCase(), leftX + 4, infoY + infoOffset);
        infoOffset += 26;
      }
      if (dateTimeStr) {
        ctx.fillText(dateTimeStr, leftX + 4, infoY + infoOffset);
      }

      const finalizeSport = () => {
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.font = 'bold 16px system-ui, sans-serif';
        ctx.fillText('Sigue el marcador en directo en', width / 2, brandingLabelY);
        const brandGrad = ctx.createLinearGradient(width * 0.3, 0, width * 0.7, 0);
        brandGrad.addColorStop(0, '#22c55e');
        brandGrad.addColorStop(1, '#3b82f6');
        ctx.fillStyle = brandGrad;
        ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.fillText('marcadorlive.com', width / 2, brandingBaseY);
        try { setGeneratedImage(canvas.toDataURL('image/jpeg', 0.92)); } catch { setGeneratedImage(null); }
        setIsGenerating(false);
      };

      if (showSponsor && sponsorName) {
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.font = '14px system-ui, sans-serif';
        ctx.fillText('Patrocinado por', width / 2, sponsorBaseYSport);
        if (sponsorLogo) {
          const sLogoImg = new Image();
          sLogoImg.crossOrigin = 'anonymous';
          sLogoImg.onload = () => {
            const maxH = 32;
            const scale = maxH / sLogoImg.height;
            const sW = sLogoImg.width * scale;
            ctx.font = 'bold 22px system-ui, sans-serif';
            const nameW = ctx.measureText(sponsorName).width;
            const totalW = sW + 10 + nameW;
            const startX = width / 2 - totalW / 2;
            ctx.drawImage(sLogoImg, startX, sponsorBaseYSport + 8, sW, maxH);
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';
            ctx.fillText(sponsorName, startX + sW + 10, sponsorBaseYSport + 30);
            finalizeSport();
          };
          sLogoImg.onerror = () => {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 22px system-ui, sans-serif';
            ctx.fillText(sponsorName, width / 2, sponsorBaseYSport + 28);
            finalizeSport();
          };
          sLogoImg.src = sponsorLogo;
          return;
        } else {
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 22px system-ui, sans-serif';
          ctx.fillText(sponsorName, width / 2, sponsorBaseYSport + 28);
        }
      }
      finalizeSport();
      return;
    }

    if (isModern) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = localTeamColor;
      ctx.fillRect(0, 0, width, 8);
    } else if (isBold) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = localTeamColor;
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, width - 6, height - 6);
    } else {
      const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
      bgGradient.addColorStop(0, '#0f172a');
      bgGradient.addColorStop(1, '#1e293b');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);
      const accentGrad = ctx.createLinearGradient(0, 0, width, 0);
      accentGrad.addColorStop(0, localTeamColor);
      accentGrad.addColorStop(1, awayTeamColor);
      ctx.fillStyle = accentGrad;
      ctx.fillRect(0, 0, width, 6);
    }

    if (!isBold && !isModern) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
      for (let i = 0; i < 20; i++) {
        const x = (i * 53 + 17) % width;
        const y = (i * 71 + 23) % height;
        const r = 40 + ((i * 37) % 120);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const textColor = isModern ? '#1e293b' : '#ffffff';
    const subtextColor = isModern ? 'rgba(30,41,59,0.5)' : 'rgba(255,255,255,0.5)';
    const subtextColor2 = isModern ? 'rgba(30,41,59,0.6)' : 'rgba(255,255,255,0.6)';

    ctx.font = isBold ? 'bold 20px system-ui, sans-serif' : 'bold 18px system-ui, sans-serif';
    ctx.fillStyle = subtextColor;
    ctx.textAlign = 'center';
    ctx.fillText('MARCADORLIVE.COM', width / 2, 40);

    const catLeagueText = [editCategory, editLeague].filter(Boolean).join(' / ');
    let headerY = 55;
    if (catLeagueText) {
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.fillStyle = subtextColor2;
      ctx.textAlign = 'center';
      ctx.fillText(catLeagueText.toUpperCase(), width / 2, headerY + 22);
      headerY += 30;
    }

    if (isBold) {
      ctx.font = 'bold 90px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('MATCHDAY', width / 2, headerY + 60);
    } else if (isModern) {
      ctx.font = 'bold 64px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = localTeamColor;
      ctx.fillText('MATCHDAY', width / 2, headerY + 55);
    } else {
      ctx.font = 'bold 72px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const matchdayGrad = ctx.createLinearGradient(width * 0.2, 0, width * 0.8, 0);
      matchdayGrad.addColorStop(0, localTeamColor);
      matchdayGrad.addColorStop(0.5, '#ffffff');
      matchdayGrad.addColorStop(1, awayTeamColor);
      ctx.fillStyle = matchdayGrad;
      ctx.fillText('MATCHDAY', width / 2, headerY + 55);
    }

    const lineY = headerY + 75;
    if (!isBold) {
      ctx.strokeStyle = isModern ? 'rgba(0,0,0,0.08)' : 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(80, lineY);
      ctx.lineTo(width - 80, lineY);
      ctx.stroke();
    }

    const photoTop = lineY + 15;
    const photoBottom = height - 80;
    const photoHeight = photoBottom - photoTop;
    const photoWidth = width - 60;
    const photoX = 30;

    if (playerImg) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(photoX, photoTop, photoWidth, photoHeight, 20);
      ctx.clip();

      const imgRatio = playerImg.width / playerImg.height;
      const boxRatio = photoWidth / photoHeight;
      let visibleW: number, visibleH: number;
      if (imgRatio > boxRatio) {
        visibleH = playerImg.height / photoZoom;
        visibleW = visibleH * boxRatio;
      } else {
        visibleW = playerImg.width / photoZoom;
        visibleH = visibleW / boxRatio;
      }
      const maxSx = playerImg.width - visibleW;
      const maxSy = playerImg.height - visibleH;
      const sx = maxSx * photoPanX;
      const sy = maxSy * photoPanY;

      ctx.drawImage(playerImg, sx, sy, visibleW, visibleH, photoX, photoTop, photoWidth, photoHeight);

      const washBase = isModern ? '248, 250, 252' : isBold ? '0, 0, 0' : '15, 23, 42';
      const darkWash = ctx.createLinearGradient(0, photoBottom - 450, 0, photoBottom);
      darkWash.addColorStop(0, `rgba(${washBase}, 0)`);
      darkWash.addColorStop(0.4, `rgba(${washBase}, 0.5)`);
      darkWash.addColorStop(1, `rgba(${washBase}, 0.92)`);
      ctx.fillStyle = darkWash;
      ctx.fillRect(photoX, photoTop, photoWidth, photoHeight);

      ctx.restore();
    } else {
      const emptyBg = isModern ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.03)';
      ctx.fillStyle = emptyBg;
      ctx.beginPath();
      ctx.roundRect(photoX, photoTop, photoWidth, photoHeight, isBold ? 0 : 20);
      ctx.fill();

      ctx.fillStyle = localTeamColor + '15';
      ctx.beginPath();
      ctx.arc(width * 0.25, photoTop + photoHeight * 0.4, 200, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = awayTeamColor + '15';
      ctx.beginPath();
      ctx.arc(width * 0.75, photoTop + photoHeight * 0.4, 200, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = 'bold 180px system-ui, sans-serif';
      ctx.fillStyle = isModern ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.04)';
      ctx.textAlign = 'center';
      ctx.fillText('VS', width / 2, photoTop + photoHeight * 0.4 + 60);
    }

    const boxPad = 40;
    const overlayBottom = photoBottom - 10;

    const logoSize = 60;
    const leftCenter = width * 0.22;
    const rightCenter = width * 0.78;

    const logoY = overlayBottom - 280;

    if (localLogoImg) {
      ctx.drawImage(localLogoImg, leftCenter - logoSize / 2, logoY, logoSize, logoSize);
    } else {
      ctx.fillStyle = localTeamColor;
      ctx.beginPath();
      ctx.arc(leftCenter, logoY + logoSize / 2, 24, 0, Math.PI * 2);
      ctx.fill();
    }

    if (awayLogoImg) {
      ctx.drawImage(awayLogoImg, rightCenter - logoSize / 2, logoY, logoSize, logoSize);
    } else {
      ctx.fillStyle = awayTeamColor;
      ctx.beginPath();
      ctx.arc(rightCenter, logoY + logoSize / 2, 24, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.font = isBold ? 'bold 28px system-ui, sans-serif' : 'bold 24px system-ui, sans-serif';
    ctx.fillStyle = isModern ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.4)';
    ctx.textAlign = 'center';
    ctx.fillText('VS', width / 2, logoY + logoSize / 2 + 9);

    const nameY = logoY + logoSize + 25;
    ctx.font = isBold ? 'bold 32px system-ui, sans-serif' : 'bold 28px system-ui, sans-serif';
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';

    const maxNameW = width * 0.35;
    const truncate = (name: string, maxW: number) => {
      let text = name.toUpperCase();
      if (ctx.measureText(text).width <= maxW) return text;
      while (text.length > 1 && ctx.measureText(text + '...').width > maxW) {
        text = text.slice(0, -1);
      }
      return text + '...';
    };

    ctx.fillText(truncate(localTeam, maxNameW), leftCenter, nameY);
    ctx.fillText(truncate(awayTeam, maxNameW), rightCenter, nameY);

    let detailY = nameY + 40;

    if (editDate) {
      ctx.font = isBold ? 'bold 32px system-ui, sans-serif' : 'bold 28px system-ui, sans-serif';
      ctx.fillStyle = isModern ? 'rgba(30, 41, 59, 0.85)' : 'rgba(255, 255, 255, 0.85)';
      ctx.fillText(editDate.toUpperCase(), width / 2, detailY);
      detailY += 50;
    }

    if (editTime) {
      ctx.font = isBold ? 'bold 68px system-ui, sans-serif' : 'bold 56px system-ui, sans-serif';
      if (isModern) {
        ctx.fillStyle = localTeamColor;
      } else {
        const timeGrad = ctx.createLinearGradient(width * 0.3, 0, width * 0.7, 0);
        timeGrad.addColorStop(0, localTeamColor);
        timeGrad.addColorStop(1, awayTeamColor);
        ctx.fillStyle = timeGrad;
      }
      ctx.fillText(editTime, width / 2, detailY + 5);
      detailY += 50;
    }

    if (editVenue) {
      ctx.font = '22px system-ui, sans-serif';
      ctx.fillStyle = isModern ? 'rgba(30, 41, 59, 0.55)' : 'rgba(255, 255, 255, 0.55)';
      ctx.fillText(editVenue, width / 2, detailY + 5);
    }

    const stripY = overlayBottom;
    const stripInset = boxPad + 20;
    const halfW = (width - stripInset * 2) / 2 - 4;
    ctx.fillStyle = localTeamColor;
    ctx.beginPath();
    ctx.roundRect(stripInset, stripY, Math.max(0, halfW), 4, 2);
    ctx.fill();
    ctx.fillStyle = awayTeamColor;
    ctx.beginPath();
    ctx.roundRect(width / 2 + 4, stripY, Math.max(0, halfW), 4, 2);
    ctx.fill();

    const sponsorBlockH = (showSponsor && sponsorName) ? 55 : 0;
    const brandingBaseY = height - 14;
    const brandingLabelY = height - 42;
    const sponsorBaseY = brandingLabelY - 10 - sponsorBlockH;

    const finalize = () => {
      ctx.fillStyle = isModern ? 'rgba(30, 41, 59, 0.4)' : 'rgba(255, 255, 255, 0.45)';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Sigue el marcador en directo en', width / 2, brandingLabelY);

      const brandGrad = ctx.createLinearGradient(width * 0.3, 0, width * 0.7, 0);
      brandGrad.addColorStop(0, '#22c55e');
      brandGrad.addColorStop(1, '#3b82f6');
      ctx.fillStyle = brandGrad;
      ctx.font = 'bold 24px system-ui, sans-serif';
      ctx.fillText('marcadorlive.com', width / 2, brandingBaseY);

      try {
        setGeneratedImage(canvas.toDataURL('image/jpeg', 0.92));
      } catch {
        setGeneratedImage(null);
      }
      setIsGenerating(false);
    };

    if (showSponsor && sponsorName) {
      const sponsorY = sponsorBaseY;
      ctx.fillStyle = isModern ? 'rgba(30, 41, 59, 0.35)' : 'rgba(255, 255, 255, 0.35)';
      ctx.font = '14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Patrocinado por', width / 2, sponsorY);

      if (sponsorLogo) {
        const sLogoImg = new Image();
        sLogoImg.crossOrigin = 'anonymous';
        sLogoImg.onload = () => {
          const maxH = 32;
          const scale = maxH / sLogoImg.height;
          const sW = sLogoImg.width * scale;
          ctx.font = 'bold 22px system-ui, sans-serif';
          const nameW = ctx.measureText(sponsorName).width;
          const totalW = sW + 10 + nameW;
          const startX = width / 2 - totalW / 2;
          ctx.drawImage(sLogoImg, startX, sponsorY + 8, sW, maxH);
          ctx.fillStyle = textColor;
          ctx.textAlign = 'left';
          ctx.fillText(sponsorName, startX + sW + 10, sponsorY + 30);
          ctx.textAlign = 'center';
          finalize();
        };
        sLogoImg.onerror = () => {
          ctx.fillStyle = textColor;
          ctx.font = 'bold 22px system-ui, sans-serif';
          ctx.fillText(sponsorName, width / 2, sponsorY + 28);
          finalize();
        };
        sLogoImg.src = sponsorLogo;
        return;
      } else {
        ctx.fillStyle = textColor;
        ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.fillText(sponsorName, width / 2, sponsorY + 28);
      }
    }

    finalize();
  }, [playerPhoto, localTeam, awayTeam, localTeamColor, awayTeamColor, localTeamLogo, awayTeamLogo, editDate, editTime, editVenue, editCategory, editLeague, photoZoom, photoPanX, photoPanY, showSponsor, sponsorName, sponsorLogo, template]);

  const handleShare = async () => {
    if (!generatedImage) return;
    const matchUrl = matchId ? `${window.location.origin}/match/${matchId}` : '';
    const dateTimeParts = [editDate, editTime ? `a las ${editTime}` : ''].filter(Boolean).join(' ');
    const shareText = `⚽ PARTIDO: ${localTeam.toUpperCase()} vs ${awayTeam.toUpperCase()}${dateTimeParts ? `\n📅 ${dateTimeParts}` : ''}${editVenue ? `\n📍 ${editVenue}` : ''}\n\n🔴 Sigue el partido en directo en MarcadorLIVE${matchUrl ? `\n👉 ${matchUrl}` : ''}`;
    try {
      const response = await fetch(generatedImage);
      const blob = await response.blob();
      const file = new File([blob], `matchday-${localTeam}-vs-${awayTeam}.jpg`, { type: 'image/jpeg' });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${localTeam} vs ${awayTeam} - Matchday`,
          text: shareText,
        });
      } else {
        navigator.clipboard.writeText(shareText);
        handleDownload();
      }
    } catch (err) {
      console.error('Share failed:', err);
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.download = `matchday-${localTeam}-vs-${awayTeam}.jpg`;
    link.href = generatedImage;
    link.click();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setGeneratedImage(null); } }}>
      <DialogTrigger asChild>
        <Button 
          variant="default" 
          className={`gap-2 bg-amber-500 ${fullWidth ? 'w-full' : ''}`}
          data-testid="button-generate-matchday"
        >
          <Megaphone className="w-4 h-4" />
          Generar Matchday
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-amber-500" />
            Crear imagen Matchday
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!generatedImage ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
                data-testid="input-matchday-photo"
              />

              <div 
                ref={previewRef}
                className={`border-2 border-dashed border-slate-300 rounded-xl overflow-hidden text-center ${playerPhoto ? '' : 'p-6 cursor-pointer hover-elevate'} transition-all`}
                onClick={() => { if (!playerPhoto) fileInputRef.current?.click(); }}
                data-testid="button-upload-matchday-photo"
              >
                {playerPhoto ? (
                  <div className="space-y-0">
                    <div 
                      className="w-full h-48 overflow-hidden cursor-grab active:cursor-grabbing relative select-none touch-none"
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                    >
                      <img 
                        src={playerPhoto} 
                        alt="Preview" 
                        className="w-full h-full object-cover pointer-events-none"
                        style={{
                          transform: `scale(${photoZoom})`,
                          transformOrigin: `${photoPanX * 100}% ${photoPanY * 100}%`,
                        }}
                        data-testid="img-matchday-preview"
                        draggable={false}
                      />
                      <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-md flex items-center gap-1 pointer-events-none">
                        <Move className="w-3 h-3" />
                        Arrastra para mover
                      </div>
                    </div>
                    <div className="px-4 py-3 space-y-2 bg-slate-50 dark:bg-slate-800">
                      <div className="flex items-center gap-2">
                        <ZoomIn className="w-4 h-4 text-slate-500 shrink-0" />
                        <Slider
                          value={[photoZoom]}
                          onValueChange={([v]) => setPhotoZoom(v)}
                          min={1}
                          max={3}
                          step={0.05}
                          className="flex-1"
                          data-testid="slider-photo-zoom"
                        />
                        <span className="text-xs text-slate-500 w-10 text-right">{Math.round(photoZoom * 100)}%</span>
                      </div>
                      <button
                        type="button"
                        className="text-xs text-primary underline w-full text-center"
                        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                        data-testid="button-change-matchday-photo"
                      >
                        Cambiar foto
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <ImagePlus className="w-10 h-10 mx-auto text-slate-400" />
                    <p className="font-medium text-slate-700 dark:text-slate-300">Sube una foto del equipo</p>
                    <p className="text-xs text-muted-foreground">(Opcional)</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha</Label>
                  <Input 
                    placeholder="Ej. Sábado 15 de Marzo" 
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    data-testid="input-matchday-date"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hora</Label>
                  <Input 
                    placeholder="Ej. 10:30" 
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    data-testid="input-matchday-time"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Categoría</Label>
                  <Input 
                    placeholder="Ej. PRE BENJAMIN" 
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    data-testid="input-matchday-category"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Liga</Label>
                  <Input 
                    placeholder="Ej. 2ª Andaluza" 
                    value={editLeague}
                    onChange={(e) => setEditLeague(e.target.value)}
                    data-testid="input-matchday-league"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Campo</Label>
                <Input 
                  placeholder="Ej. Campo Municipal" 
                  value={editVenue}
                  onChange={(e) => setEditVenue(e.target.value)}
                  data-testid="input-matchday-venue"
                />
              </div>

              {sponsorName && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="show-sponsor-matchday"
                    checked={showSponsor}
                    onCheckedChange={(checked) => setShowSponsor(!!checked)}
                    data-testid="checkbox-show-sponsor-matchday"
                  />
                  <Label htmlFor="show-sponsor-matchday" className="text-sm cursor-pointer">
                    Incluir patrocinador ({sponsorName})
                  </Label>
                </div>
              )}

              <Button 
                className="w-full gap-2 bg-amber-500" 
                onClick={generateImage}
                disabled={isGenerating}
                data-testid="button-generate-matchday-image"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Megaphone className="w-4 h-4" />
                )}
                Generar Matchday
              </Button>
            </>
          ) : (
            <>
              <div className="rounded-xl overflow-hidden shadow-lg mx-auto max-w-full">
                <img 
                  src={generatedImage} 
                  alt="Matchday" 
                  className="w-full max-w-full block" 
                  data-testid="img-generated-matchday"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant="outline" 
                  className="gap-2"
                  onClick={handleDownload}
                  data-testid="button-download-matchday"
                >
                  <Download className="w-4 h-4" />
                  Descargar
                </Button>
                <Button 
                  className="gap-2"
                  onClick={handleShare}
                  data-testid="button-share-matchday"
                >
                  <Share2 className="w-4 h-4" />
                  Compartir
                </Button>
              </div>

              <Button 
                variant="ghost" 
                className="w-full text-sm"
                onClick={() => {
                  setGeneratedImage(null);
                }}
                data-testid="button-create-another-matchday"
              >
                Crear otra imagen
              </Button>
            </>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
}
