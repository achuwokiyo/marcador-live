import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, X, Save, Loader2, Info } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ChronicleConfig {
  tone: string;
  customTone: string;
  mentionScorers: boolean;
  hideBlowout: boolean;
  blowoutThreshold: number;
  slogans: string[];
  values: string[];
  extraInstructions: string;
}

const toneOptions = [
  { id: "cercano", label: "Cercano y familiar", desc: "Como un padre orgulloso", icon: "🏠" },
  { id: "profesional", label: "Profesional", desc: "Como un CM de club deportivo", icon: "📋" },
  { id: "epico", label: "Épico y emocionante", desc: "Como un narrador de Champions", icon: "🔥" },
  { id: "humor", label: "Humorístico", desc: "Con gracia y buen rollo", icon: "😄" },
  { id: "custom", label: "Personalizado", desc: "Describe tu propio tono", icon: "✏️" },
];

function TagInput({ items, onAdd, onRemove, placeholder, icon }: {
  items: string[];
  onAdd: (item: string) => void;
  onRemove: (index: number) => void;
  placeholder: string;
  icon: string;
}) {
  const [input, setInput] = useState("");

  const handleAdd = () => {
    const val = input.trim();
    if (val && !items.includes(val)) {
      onAdd(val);
      setInput("");
    }
  };

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <Badge key={i} variant="secondary" className="gap-1 pl-2 pr-1 py-1">
              <span className="text-xs">{icon}</span>
              <span className="text-xs">{item}</span>
              <button
                onClick={() => onRemove(i)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                data-testid={`button-remove-tag-${i}`}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAdd())}
          placeholder={placeholder}
          className="text-sm"
          data-testid="input-tag"
        />
        <Button variant="outline" size="sm" onClick={handleAdd} data-testid="button-add-tag">
          Añadir
        </Button>
      </div>
    </div>
  );
}

export function ChronicleConfigTab({ slug }: { slug: string }) {
  const { toast } = useToast();

  const { data: config, isLoading } = useQuery<ChronicleConfig>({
    queryKey: ['/api/club', slug, 'chronicle-config'],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/club/${slug}/chronicle-config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error al cargar");
      return res.json();
    },
  });

  const [tone, setTone] = useState("cercano");
  const [customTone, setCustomTone] = useState("");
  const [mentionScorers, setMentionScorers] = useState(true);
  const [hideBlowout, setHideBlowout] = useState(true);
  const [blowoutThreshold, setBlowoutThreshold] = useState(4);
  const [slogans, setSlogans] = useState<string[]>([]);
  const [values, setValues] = useState<string[]>([]);
  const [extraInstructions, setExtraInstructions] = useState("");

  useEffect(() => {
    if (config) {
      setTone(config.tone || "cercano");
      setCustomTone(config.customTone || "");
      setMentionScorers(config.mentionScorers ?? true);
      setHideBlowout(config.hideBlowout ?? true);
      setBlowoutThreshold(config.blowoutThreshold ?? 4);
      setSlogans(config.slogans || []);
      setValues(config.values || []);
      setExtraInstructions(config.extraInstructions || "");
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/club/${slug}/chronicle-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tone, customTone, mentionScorers, hideBlowout, blowoutThreshold, slogans, values, extraInstructions }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/club', slug, 'chronicle-config'] });
      toast({ title: "Configuración guardada" });
    },
    onError: () => toast({ title: "Error al guardar", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Crónicas automáticas
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Configura el estilo de las crónicas generadas por IA para tu club
          </p>
        </CardHeader>
        <CardContent className="space-y-6">

          <div className="space-y-2">
            <Label className="text-sm font-medium">Tono general</Label>
            <p className="text-xs text-muted-foreground">Define la personalidad de las crónicas</p>
            <div className="space-y-1.5">
              {toneOptions.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTone(t.id)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors ${
                    tone === t.id
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                  data-testid={`button-tone-${t.id}`}
                >
                  <span className="text-lg flex-shrink-0">{t.icon}</span>
                  <div>
                    <div className={`text-sm font-medium ${tone === t.id ? "text-primary" : ""}`}>{t.label}</div>
                    <div className="text-xs text-muted-foreground">{t.desc}</div>
                  </div>
                </button>
              ))}
            </div>
            {tone === "custom" && (
              <Textarea
                value={customTone}
                onChange={(e) => setCustomTone(e.target.value)}
                placeholder="Describe cómo quieres que suenen las crónicas..."
                rows={3}
                className="mt-2 text-sm"
                data-testid="textarea-custom-tone"
              />
            )}
          </div>

          <div className="flex items-center justify-between py-2 border-t">
            <div>
              <Label className="text-sm font-medium">Mencionar goleadores</Label>
              <p className="text-xs text-muted-foreground">
                {mentionScorers ? "La crónica nombrará a los jugadores que marcaron" : "Solo hablará del equipo en general"}
              </p>
            </div>
            <Switch checked={mentionScorers} onCheckedChange={setMentionScorers} data-testid="switch-mention-scorers" />
          </div>

          <div className="border-t pt-2 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Ocultar resultado en goleadas</Label>
                <p className="text-xs text-muted-foreground">
                  {hideBlowout
                    ? `Si la diferencia es de ${blowoutThreshold}+ goles, dirá "amplia victoria"`
                    : "Siempre se mostrará el resultado numérico"}
                </p>
              </div>
              <Switch checked={hideBlowout} onCheckedChange={setHideBlowout} data-testid="switch-hide-blowout" />
            </div>
            {hideBlowout && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Umbral de goleada</Label>
                <div className="flex gap-2">
                  {[3, 4, 5, 6].map((n) => (
                    <Button
                      key={n}
                      variant={blowoutThreshold === n ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setBlowoutThreshold(n)}
                      data-testid={`button-threshold-${n}`}
                    >
                      {n}+
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Ej: si eliges {blowoutThreshold}, un {blowoutThreshold + 3}-1 dirá "amplia victoria" pero un 3-0 mostrará el resultado
                </p>
              </div>
            )}
          </div>

          <div className="border-t pt-2 space-y-2">
            <Label className="text-sm font-medium">Eslóganes del club</Label>
            <p className="text-xs text-muted-foreground">Se añade uno aleatorio al final de cada crónica</p>
            <TagInput
              items={slogans}
              onAdd={(s) => setSlogans([...slogans, s])}
              onRemove={(i) => setSlogans(slogans.filter((_, j) => j !== i))}
              placeholder='Ej: "¡Vamos equipo! 💪"'
              icon="📣"
            />
          </div>

          <div className="border-t pt-2 space-y-2">
            <Label className="text-sm font-medium">Valores del club</Label>
            <p className="text-xs text-muted-foreground">Se incorporan de forma natural en las crónicas</p>
            <TagInput
              items={values}
              onAdd={(v) => setValues([...values, v])}
              onRemove={(i) => setValues(values.filter((_, j) => j !== i))}
              placeholder="Ej: trabajo en equipo"
              icon="💚"
            />
          </div>

          <div className="border-t pt-2 space-y-2">
            <Label className="text-sm font-medium">Instrucciones extra</Label>
            <p className="text-xs text-muted-foreground">Cualquier indicación adicional para las crónicas</p>
            <Textarea
              value={extraInstructions}
              onChange={(e) => setExtraInstructions(e.target.value)}
              placeholder="Ej: No mencionar árbitros. Siempre positivo. Usar pocos emojis..."
              rows={4}
              className="text-sm"
              data-testid="textarea-extra-instructions"
            />
          </div>

          <Button
            className="w-full gap-2"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            data-testid="button-save-chronicle-config"
          >
            {saveMutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
            ) : (
              <><Save className="w-4 h-4" /> Guardar configuración</>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">¿Cómo funciona?</p>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                Esta configuración se aplica a todas las crónicas del club. Cuando un delegado o tú pulséis "Generar crónica con IA" después de un partido, el texto se creará automáticamente siguiendo estas directrices. Se genera una sola crónica por partido.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}