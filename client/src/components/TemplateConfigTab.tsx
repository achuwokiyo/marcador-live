import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Palette } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { type TemplateName, TEMPLATE_OPTIONS, darkenColor, lightenColor, loadImage, drawRoundedRect, truncateText } from "@/lib/imageTemplates";

interface TemplateConfigTabProps {
  slug: string;
  clubName: string;
  primaryColor: string;
  secondaryColor: string;
}

interface TemplateConfig {
  templateMatchday: TemplateName;
  templateResult: TemplateName;
  templateWeekly: TemplateName;
}

function TemplatePreviewer({ type, template, primaryColor, secondaryColor }: { type: string; template: TemplateName; primaryColor: string; secondaryColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = 200;
    const h = 140;
    canvas.width = w;
    canvas.height = h;

    if (template === "classic") {
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, darkenColor(primaryColor, 0.1));
      bg.addColorStop(1, darkenColor(primaryColor, 0.6));
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = secondaryColor;
      ctx.fillRect(0, 0, w, 3);

      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.beginPath();
      ctx.roundRect(12, 50, w - 24, 24, 4);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(12, 80, w - 24, 24, 4);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(type === 'weekly' ? 'PARTIDOS' : type === 'matchday' ? 'MATCHDAY' : 'RESULTADO', w / 2, 35);
      ctx.fillStyle = secondaryColor;
      ctx.font = '9px system-ui';
      ctx.fillText('Clasica', w / 2, h - 10);
    } else if (template === "modern") {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = primaryColor;
      ctx.fillRect(0, 0, w, 40);

      ctx.shadowColor = 'rgba(0,0,0,0.06)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(12, 50, w - 24, 24, 4);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(12, 80, w - 24, 24, 4);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(type === 'weekly' ? 'PARTIDOS' : type === 'matchday' ? 'MATCHDAY' : 'RESULTADO', w / 2, 26);
      ctx.fillStyle = primaryColor;
      ctx.font = '9px system-ui';
      ctx.fillText('Moderna', w / 2, h - 10);
    } else if (template === "bold") {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = primaryColor;
      ctx.fillRect(0, 0, w, 5);
      ctx.fillStyle = secondaryColor;
      ctx.fillRect(0, 5, w, 2);

      const g1 = ctx.createLinearGradient(12, 50, w - 12, 50);
      g1.addColorStop(0, primaryColor + '40');
      g1.addColorStop(1, 'rgba(255,255,255,0.03)');
      ctx.fillStyle = g1;
      ctx.beginPath();
      ctx.roundRect(12, 50, w - 24, 24, 4);
      ctx.fill();
      ctx.strokeStyle = primaryColor + '60';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = g1;
      ctx.beginPath();
      ctx.roundRect(12, 80, w - 24, 24, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(type === 'weekly' ? 'PARTIDOS' : type === 'matchday' ? 'MATCHDAY' : 'RESULTADO', w / 2, 38);
      ctx.fillStyle = secondaryColor;
      ctx.font = '9px system-ui';
      ctx.fillText('Impacto', w / 2, h - 10);
    } else {
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#2a2a3e');
      bg.addColorStop(1, '#0a0a15');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(0, h * 0.3, w, h * 0.4);

      const grad = ctx.createLinearGradient(0, h * 0.5, 0, h);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.4, 'rgba(0,0,0,0.7)');
      grad.addColorStop(1, 'rgba(0,0,0,0.95)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, h * 0.4, w, h * 0.6);

      ctx.fillStyle = primaryColor;
      ctx.beginPath();
      ctx.arc(w * 0.35, h * 0.72, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.arc(w * 0.65, h * 0.72, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h * 0.67);
      ctx.lineTo(w * 0.5, h * 0.77);
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold italic 13px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText('NEXT', 14, h * 0.9);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 0.8;
      ctx.strokeText('MATCH', 52, h * 0.9);

      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '7px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Deportivo', w / 2, h - 4);
    }
  }, [template, primaryColor, secondaryColor, type]);

  useEffect(() => { draw(); }, [draw]);

  return <canvas ref={canvasRef} className="w-full h-auto rounded-lg" style={{ imageRendering: 'auto' }} />;
}

export function TemplateConfigTab({ slug, clubName, primaryColor, secondaryColor }: TemplateConfigTabProps) {
  const { toast } = useToast();

  const { data: config, isLoading } = useQuery<TemplateConfig>({
    queryKey: ["/api/club", slug, "template-config"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/club/${slug}/template-config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error loading template config");
      return res.json();
    },
  });

  const [matchday, setMatchday] = useState<TemplateName>("classic");
  const [result, setResult] = useState<TemplateName>("classic");
  const [weekly, setWeekly] = useState<TemplateName>("classic");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (config) {
      setMatchday(config.templateMatchday || "classic");
      setResult(config.templateResult || "classic");
      setWeekly(config.templateWeekly || "classic");
      setHasChanges(false);
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/club/${slug}/template-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ templateMatchday: matchday, templateResult: result, templateWeekly: weekly }),
      });
      if (!res.ok) throw new Error("Error saving");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/club", slug, "template-config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/club", slug, "admin-data"] });
      setHasChanges(false);
      toast({ title: "Plantillas guardadas" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudieron guardar las plantillas.", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const renderSelector = (label: string, description: string, value: TemplateName, onChange: (v: TemplateName) => void, type: string) => {
    const options = type === 'weekly' ? TEMPLATE_OPTIONS.filter(o => o.value !== 'sport') : TEMPLATE_OPTIONS;
    const cols = options.length <= 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4';
    return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold">{label}</Label>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className={`grid ${cols} gap-2`}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`rounded-xl overflow-hidden border-2 transition-all p-1.5 ${value === opt.value ? 'border-primary ring-2 ring-primary/30' : 'border-transparent hover:border-muted-foreground/20'}`}
            onClick={() => { onChange(opt.value); setHasChanges(true); }}
            data-testid={`template-${type}-${opt.value}`}
          >
            <TemplatePreviewer type={type} template={opt.value} primaryColor={primaryColor} secondaryColor={secondaryColor} />
            <p className="text-[11px] font-medium mt-1 text-center">{opt.label}</p>
          </button>
        ))}
      </div>
    </div>
  );
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        <div className="flex items-center gap-2 mb-2">
          <Palette className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Plantillas de imagen</h3>
        </div>
        <p className="text-sm text-muted-foreground -mt-4">
          Elige una plantilla visual para cada tipo de imagen que se genera en tu club.
        </p>

        {renderSelector(
          "Imagen de Partido (Matchday)",
          "Poster individual de un partido programado, para promocionarlo en redes.",
          matchday,
          setMatchday,
          "matchday"
        )}

        {renderSelector(
          "Imagen de Resultado",
          "Imagen con el marcador final para compartir despues del partido.",
          result,
          setResult,
          "result"
        )}

        {renderSelector(
          "Imagen Semanal",
          "Poster con todos los partidos de la semana, agrupados por categoria.",
          weekly,
          setWeekly,
          "weekly"
        )}

        <Button
          className="w-full gap-2"
          disabled={!hasChanges || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          data-testid="button-save-templates"
        >
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar plantillas
        </Button>
      </CardContent>
    </Card>
  );
}
