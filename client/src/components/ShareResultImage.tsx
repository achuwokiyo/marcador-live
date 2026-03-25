import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Camera, Share2, Download, ImagePlus, Loader2 } from "lucide-react";
import type { TemplateName } from "@/lib/imageTemplates";

interface ShareResultImageProps {
  localTeam: string;
  awayTeam: string;
  localScore: number;
  awayScore: number;
  localTeamColor?: string;
  awayTeamColor?: string;
  localTeamLogo?: string | null;
  awayTeamLogo?: string | null;
  matchStatus?: string;
  fullWidth?: boolean;
  sponsorName?: string | null;
  sponsorLogo?: string | null;
  template?: TemplateName;
}

const getStatusLabel = (status?: string): string => {
  switch (status) {
    case 'first_half': return '1ª PARTE';
    case 'halftime': return 'DESCANSO';
    case 'second_half': return '2ª PARTE';
    case 'finished': return 'FINALIZADO';
    default: return '';
  }
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

export function ShareResultImage({ localTeam, awayTeam, localScore, awayScore, localTeamColor = '#3b82f6', awayTeamColor = '#ef4444', localTeamLogo, awayTeamLogo, matchStatus, fullWidth, sponsorName, sponsorLogo, template = 'classic' }: ShareResultImageProps) {
  const [open, setOpen] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setBackgroundImage(event.target?.result as string);
        setGeneratedImage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateImage = useCallback(async () => {
    if (!canvasRef.current) return;
    
    setIsGenerating(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setIsGenerating(false); return; }

    const width = 1080;
    const height = 1080;
    canvas.width = width;
    canvas.height = height;

    const [localLogoImg, awayLogoImg] = await Promise.all([
      localTeamLogo ? loadImage(localTeamLogo).catch(() => null) : Promise.resolve(null),
      awayTeamLogo ? loadImage(awayTeamLogo).catch(() => null) : Promise.resolve(null),
    ]);

    const isModern = template === 'modern';
    const isBold = template === 'bold';
    const isSport = template === 'sport';

    const truncateName = (name: string, maxW: number) => {
      let text = name.toUpperCase();
      if (ctx.measureText(text).width <= maxW) return text;
      while (text.length > 1 && ctx.measureText(text + '...').width > maxW) {
        text = text.slice(0, -1);
      }
      return text + '...';
    };

    const drawSponsorAndBranding = (finishCb: () => void) => {
      const brandingH = 50;
      const sponsorH = (showSponsor && sponsorName) ? 55 : 0;
      const footerStartY = height - brandingH - sponsorH;

      const finalizeDraw = () => {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('marcadorlive.com', width / 2, height - 14);
        finishCb();
      };

      if (showSponsor && sponsorName) {
        const sponsorY = footerStartY;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Patrocinado por', width / 2, sponsorY);

        if (sponsorLogo) {
          const sLogoImg = new Image();
          sLogoImg.crossOrigin = 'anonymous';
          sLogoImg.onload = () => {
            const maxH = 32;
            const sScale = maxH / sLogoImg.height;
            const sW = sLogoImg.width * sScale;
            ctx.font = 'bold 20px system-ui, sans-serif';
            const nameW = ctx.measureText(sponsorName).width;
            const totalW = sW + 10 + nameW;
            const startX = width / 2 - totalW / 2;
            ctx.drawImage(sLogoImg, startX, sponsorY + 4, sW, maxH);
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';
            ctx.fillText(sponsorName, startX + sW + 10, sponsorY + 26);
            ctx.textAlign = 'center';
            finalizeDraw();
          };
          sLogoImg.onerror = () => {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 20px system-ui, sans-serif';
            ctx.fillText(sponsorName, width / 2, sponsorY + 22);
            finalizeDraw();
          };
          sLogoImg.src = sponsorLogo;
          return;
        } else {
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 20px system-ui, sans-serif';
          ctx.fillText(sponsorName, width / 2, sponsorY + 22);
        }
      }

      finalizeDraw();
    };

    const saveImage = () => {
      try {
        setGeneratedImage(canvas.toDataURL('image/jpeg', 0.9));
      } catch {
        setGeneratedImage(null);
      }
      setIsGenerating(false);
    };

    const drawScoreboardSport = () => {
      const gradH = height * 0.65;
      const bottomGrad = ctx.createLinearGradient(0, height - gradH, 0, height);
      bottomGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      bottomGrad.addColorStop(0.3, 'rgba(0, 0, 0, 0.55)');
      bottomGrad.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
      ctx.fillStyle = bottomGrad;
      ctx.fillRect(0, height - gradH, width, gradH);

      const leftX = 60;
      const brandingBaseY = height - 14;
      const brandingLabelY = height - 42;

      const sponsorBlockH = (showSponsor && sponsorName) ? 55 : 0;
      const sponsorStartY = brandingLabelY - 10 - sponsorBlockH;

      const localNameX = width * 0.28;
      const awayNameRX = width * 0.72;
      const maxTeamW = width * 0.35;

      const titleH = 90;
      const scoreH = 140;
      const teamH = 45;
      const gaps = 30 + 25 + 25;
      const totalContent = titleH + scoreH + teamH + gaps;

      const contentBottom = sponsorStartY - 20;
      const contentTop = contentBottom - totalContent;

      const teamLineY = contentTop + teamH;
      const scoreBaseY = teamLineY + 25 + scoreH;
      const titleBaseY = scoreBaseY + 30 + titleH - 20;

      ctx.font = 'bold 32px system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(truncateName(localTeam, maxTeamW), localNameX, teamLineY);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = 'bold 26px system-ui, sans-serif';
      ctx.fillText('vs', width / 2, teamLineY);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px system-ui, sans-serif';
      ctx.fillText(truncateName(awayTeam, maxTeamW), awayNameRX, teamLineY);

      ctx.font = 'bold 140px system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(String(localScore), localNameX, scoreBaseY);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = 'bold 60px system-ui, sans-serif';
      ctx.fillText('-', width / 2, scoreBaseY - 25);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 140px system-ui, sans-serif';
      ctx.fillText(String(awayScore), awayNameRX, scoreBaseY);

      ctx.font = 'bold italic 80px system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      const resText = 'RESULTADO';
      const finText = 'FINAL';
      const resW = ctx.measureText(resText).width;
      const finW = ctx.measureText(finText).width;
      const totalTitleW = resW + 16 + finW;
      const titleStartX = width / 2 - totalTitleW / 2;
      ctx.textAlign = 'left';
      ctx.fillText(resText, titleStartX, titleBaseY);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.fillStyle = 'transparent';
      ctx.strokeText(finText, titleStartX + resW + 16, titleBaseY);

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
        saveImage();
      };

      if (showSponsor && sponsorName) {
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.font = '14px system-ui, sans-serif';
        ctx.fillText('Patrocinado por', width / 2, sponsorStartY);
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
            ctx.drawImage(sLogoImg, startX, sponsorStartY + 8, sW, maxH);
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';
            ctx.fillText(sponsorName, startX + sW + 10, sponsorStartY + 30);
            finalizeSport();
          };
          sLogoImg.onerror = () => {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 22px system-ui, sans-serif';
            ctx.fillText(sponsorName, width / 2, sponsorStartY + 28);
            finalizeSport();
          };
          sLogoImg.src = sponsorLogo;
          return;
        } else {
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 22px system-ui, sans-serif';
          ctx.fillText(sponsorName, width / 2, sponsorStartY + 28);
        }
      }
      finalizeSport();
    };

    const drawScoreboard = () => {
      const gradientHeight = 420;
      const washBase = isModern ? '248, 250, 252' : isBold ? '0, 0, 0' : '15, 23, 42';
      const gradient = ctx.createLinearGradient(0, height - gradientHeight, 0, height);
      gradient.addColorStop(0, `rgba(${washBase}, 0)`);
      gradient.addColorStop(0.3, `rgba(${washBase}, 0.85)`);
      gradient.addColorStop(1, `rgba(${washBase}, 0.95)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, height - gradientHeight, width, gradientHeight);

      const boxMargin = 40;
      const boxWidth = width - boxMargin * 2;
      const boxHeight = 200;
      const boxBottom = height - 70;
      const boxTop = boxBottom - boxHeight;

      const boxBg = isModern ? 'rgba(255, 255, 255, 0.92)' : isBold ? 'rgba(0, 0, 0, 0.9)' : 'rgba(15, 23, 42, 0.9)';
      ctx.fillStyle = boxBg;
      ctx.beginPath();
      ctx.roundRect(boxMargin, boxTop, boxWidth, boxHeight, isBold ? 4 : 20);
      ctx.fill();
      if (isBold) {
        ctx.strokeStyle = localTeamColor;
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      const statusLabel = getStatusLabel(matchStatus);
      if (statusLabel) {
        ctx.font = 'bold 20px system-ui, sans-serif';
        const badgeWidth = ctx.measureText(statusLabel).width + 40;
        const badgeX = width / 2 - badgeWidth / 2;
        const badgeY = boxTop - 35;
        
        let badgeColor = '#22c55e';
        if (matchStatus === 'halftime') badgeColor = '#f97316';
        else if (matchStatus === 'first_half' || matchStatus === 'second_half') badgeColor = '#22c55e';
        
        ctx.fillStyle = badgeColor;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeWidth, 36, 18);
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(statusLabel, width / 2, badgeY + 24);
      }

      const maxNameWidth = boxWidth * 0.4;
      const localNameX = width * 0.25;
      const awayNameX = width * 0.75;

      ctx.font = 'bold 30px system-ui, sans-serif';

      const hasLogos = localLogoImg || awayLogoImg;
      const logoSize = 40;
      let nameY: number;

      if (hasLogos) {
        const logoY = boxTop + 18;
        if (localLogoImg) {
          ctx.drawImage(localLogoImg, localNameX - logoSize / 2, logoY, logoSize, logoSize);
        }
        if (awayLogoImg) {
          ctx.drawImage(awayLogoImg, awayNameX - logoSize / 2, logoY, logoSize, logoSize);
        }
        nameY = logoY + logoSize + 28;
      } else {
        nameY = boxTop + 55;
      }

      ctx.fillStyle = isModern ? '#64748b' : '#94a3b8';
      ctx.font = isBold ? 'bold 34px system-ui, sans-serif' : 'bold 30px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(truncateName(localTeam, maxNameWidth), localNameX, nameY);
      ctx.fillText(truncateName(awayTeam, maxNameWidth), awayNameX, nameY);

      const scoreNumY = hasLogos ? nameY + 85 : nameY + 105;
      ctx.fillStyle = isModern ? '#1e293b' : '#ffffff';
      ctx.font = hasLogos ? (isBold ? 'bold 100px system-ui, sans-serif' : 'bold 90px system-ui, sans-serif') : (isBold ? 'bold 120px system-ui, sans-serif' : 'bold 110px system-ui, sans-serif');
      ctx.textAlign = 'center';
      ctx.fillText(String(localScore), localNameX, scoreNumY);
      ctx.fillText(String(awayScore), awayNameX, scoreNumY);

      const vsY = hasLogos ? nameY + 50 : nameY + 65;
      ctx.fillStyle = isModern ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.5)';
      ctx.font = 'italic bold 40px system-ui, sans-serif';
      ctx.fillText('VS', width * 0.5, vsY);

      const stripWidth = Math.max(0, (boxWidth / 2) - 24);
      ctx.fillStyle = localTeamColor;
      ctx.beginPath();
      ctx.roundRect(boxMargin + 8, boxTop + boxHeight - 7, stripWidth, 5, 3);
      ctx.fill();
      ctx.fillStyle = awayTeamColor;
      ctx.beginPath();
      ctx.roundRect(width / 2 + 8, boxTop + boxHeight - 7, stripWidth, 5, 3);
      ctx.fill();

      drawSponsorAndBranding(saveImage);
    };

    const drawDefaultBackground = () => {
      if (isSport) {
        const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
        bgGradient.addColorStop(0, '#1a1a2e');
        bgGradient.addColorStop(1, '#0a0a15');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);
      } else if (isModern) {
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
        const bgGradient = ctx.createLinearGradient(0, 0, width, height);
        bgGradient.addColorStop(0, '#0f172a');
        bgGradient.addColorStop(0.5, '#1e293b');
        bgGradient.addColorStop(1, '#0f172a');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);
      }
      
      if (!isSport) {
        ctx.fillStyle = localTeamColor + '18';
        ctx.beginPath();
        ctx.arc(width * 0.2, height * 0.3, 200, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = awayTeamColor + '18';
        ctx.beginPath();
        ctx.arc(width * 0.8, height * 0.4, 250, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const scoreboardFn = isSport ? drawScoreboardSport : drawScoreboard;

    if (backgroundImage) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const scale = Math.max(width / img.width, height / img.height);
        const x = (width - img.width * scale) / 2;
        const y = (height - img.height * scale) / 2;
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        scoreboardFn();
      };
      img.onerror = () => {
        drawDefaultBackground();
        scoreboardFn();
      };
      img.src = backgroundImage;
    } else {
      drawDefaultBackground();
      scoreboardFn();
    }
  }, [backgroundImage, localTeam, awayTeam, localScore, awayScore, localTeamColor, awayTeamColor, localTeamLogo, awayTeamLogo, matchStatus, showSponsor, sponsorName, sponsorLogo, template]);

  const handleShare = async () => {
    if (!generatedImage) return;

    try {
      const response = await fetch(generatedImage);
      const blob = await response.blob();
      const file = new File([blob], `${localTeam}-vs-${awayTeam}.jpg`, { type: 'image/jpeg' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${localTeam} ${localScore} - ${awayScore} ${awayTeam}`,
          text: `Resultado final: ${localTeam} ${localScore} - ${awayScore} ${awayTeam}`,
        });
      } else {
        handleDownload();
      }
    } catch (err) {
      console.error('Share failed:', err);
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.download = `${localTeam}-vs-${awayTeam}.jpg`;
    link.href = generatedImage;
    link.click();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className={`gap-2 border-blue-300 text-blue-700 ${fullWidth ? 'w-full' : ''}`}
          data-testid="button-share-result-image"
        >
          <Camera className="w-4 h-4" />
          Crear imagen resultado
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            Crear imagen para compartir
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
            data-testid="input-file-upload"
          />

          {!generatedImage ? (
            <>
              <div 
                className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover-elevate transition-all"
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-upload-photo"
              >
                {backgroundImage ? (
                  <div className="space-y-2">
                    <img 
                      src={backgroundImage} 
                      alt="Preview" 
                      className="w-full h-40 object-cover rounded-lg"
                      data-testid="img-preview"
                    />
                    <p className="text-sm text-muted-foreground">Pulsa para cambiar la foto</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <ImagePlus className="w-12 h-12 mx-auto text-slate-400" />
                    <div>
                      <p className="font-medium text-slate-700">Sube una foto del equipo</p>
                      <p className="text-sm text-muted-foreground">(Opcional - puedes generar sin foto)</p>
                    </div>
                  </div>
                )}
              </div>

              {sponsorName && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="show-sponsor-result"
                    checked={showSponsor}
                    onCheckedChange={(checked) => setShowSponsor(!!checked)}
                    data-testid="checkbox-show-sponsor-result"
                  />
                  <Label htmlFor="show-sponsor-result" className="text-sm cursor-pointer">
                    Incluir patrocinador ({sponsorName})
                  </Label>
                </div>
              )}

              <Button 
                className="w-full gap-2" 
                onClick={generateImage}
                disabled={isGenerating}
                data-testid="button-generate-image"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
                Generar imagen
              </Button>
            </>
          ) : (
            <>
              <div className="rounded-xl overflow-hidden shadow-lg mx-auto max-w-full">
                <img 
                  src={generatedImage} 
                  alt="Resultado" 
                  className="w-full max-w-full block" 
                  data-testid="img-generated-result"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant="outline" 
                  className="gap-2"
                  onClick={handleDownload}
                  data-testid="button-download-image"
                >
                  <Download className="w-4 h-4" />
                  Descargar
                </Button>
                <Button 
                  className="gap-2"
                  onClick={handleShare}
                  data-testid="button-share-image"
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
                  setBackgroundImage(null);
                }}
                data-testid="button-create-another"
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
