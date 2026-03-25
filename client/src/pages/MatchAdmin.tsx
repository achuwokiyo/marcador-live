import { useEffect, useState } from "react";
import { startOfflineQueueProcessor } from "@/lib/offlineQueue";
import { useMatch, useUpdateScore, useUpdateStatus, useControlTimer, useUpdateColors, useVerifyPin, useCreateEvent, useDeleteEvent, useMatchEvents, useUpdateEvent, useDeleteMatch } from "@/hooks/use-matches";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ScoreBoard } from "@/components/ScoreBoard";
import { EventFeed } from "@/components/EventFeed";
import { ShareModal } from "@/components/ShareModal";
import { ShareResultImage } from "@/components/ShareResultImage";
import { MatchdayImage } from "@/components/MatchdayImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Minus, Play, Pause, RotateCcw, BellRing, Flag, Lock, Trash2, Eye, Key, Copy, Check, FileText, ImagePlus, Upload, Loader2 as Loader2Icon, Sparkles } from "lucide-react";
import { MATCH_STATUS, type MatchStatus } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import canvasConfetti from "canvas-confetti";

export default function MatchAdmin() {
  const [match, params] = useRoute("/match/:id/admin");
  const [, setLocation] = useLocation();
  const matchId = parseInt(params?.id || "0");
  const { data: matchData, isLoading } = useMatch(matchId);
  const { data: eventsData } = useMatchEvents(matchId);
  const { toast } = useToast();
  
  // Mutations
  const verifyPin = useVerifyPin(matchId);
  const updateScore = useUpdateScore(matchId);
  const updateStatus = useUpdateStatus(matchId);
  const controlTimer = useControlTimer(matchId);
  const updateColors = useUpdateColors(matchId);
  const createEvent = useCreateEvent(matchId);
  const deleteMatch = useDeleteMatch(matchId);

  const deleteEvent = useDeleteEvent(matchId);
  const updateEvent = useUpdateEvent(matchId);

  // Local State
  const [pin, setPin] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isDelegate, setIsDelegate] = useState(false);
  const [delegateClubSlug, setDelegateClubSlug] = useState<string | null>(null);
  const [newEventOpen, setNewEventOpen] = useState(false);
  const [selectedEventType, setSelectedEventType] = useState("yellow_card");
  const [selectedEventTeam, setSelectedEventTeam] = useState("local");
  const [pinCopied, setPinCopied] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [customPin, setCustomPin] = useState("");
  const [chronicleText, setChronicleText] = useState<string | null>(null);
  const [chronicleEditing, setChronicleEditing] = useState(false);
  const [chronicleCopied, setChronicleCopied] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => { startOfflineQueueProcessor(); }, []);

  const { data: sponsorData } = useQuery<{ name: string; logoUrl: string | null; websiteUrl: string | null } | null>({
    queryKey: ['/api/matches', matchId, 'sponsor'],
    enabled: !!matchId,
  });

  const { data: rosterData } = useQuery<{ local: any[]; away: any[] }>({
    queryKey: ['/api/matches', matchId, 'roster'],
    enabled: !!matchId,
    staleTime: 1000 * 60 * 5,
  });

  // Check if user is owner
  const { data: ownerData, isLoading: isOwnerLoading } = useQuery({
    queryKey: ['/api/matches', matchId, 'is-owner'],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      const token = localStorage.getItem("auth_token");
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`/api/matches/${matchId}/is-owner`, { credentials: 'include', headers });
      return res.json();
    },
    enabled: !!matchId
  });

  const clubSlugForTemplate = delegateClubSlug || (ownerData as any)?.clubSlug || null;
  const { data: templateConfig } = useQuery<{ templateMatchday: string; templateResult: string; templateWeekly: string }>({
    queryKey: ['/api/club', clubSlugForTemplate, 'template-config'],
    queryFn: async () => {
      const res = await fetch(`/api/club/${clubSlugForTemplate}/template-config`);
      if (!res.ok) return { templateMatchday: 'classic', templateResult: 'classic', templateWeekly: 'classic' };
      return res.json();
    },
    enabled: !!clubSlugForTemplate,
    staleTime: 1000 * 60 * 10,
  });

  // Generate PIN mutation
  const generatePin = useMutation({
    mutationFn: async (body?: { pin?: string }) => {
      const res = await apiRequest('POST', `/api/matches/${matchId}/generate-pin`, body || {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/matches', matchId, 'is-owner'] });
      queryClient.invalidateQueries({ queryKey: ['/api/matches', matchId] });
      toast({ title: "PIN generado", description: "Comparte este PIN para delegar control" });
    }
  });

  // Remove PIN mutation
  const removePin = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/matches/${matchId}/remove-pin`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/matches', matchId, 'is-owner'] });
      queryClient.invalidateQueries({ queryKey: ['/api/matches', matchId] });
      toast({ title: "PIN eliminado", description: "Solo tú puedes controlar el marcador" });
    }
  });
  
  const saveChronicle = useMutation({
    mutationFn: async (text: string) => {
      const urlParams = new URLSearchParams(window.location.search);
      const delegateToken = urlParams.get('delegateToken') || sessionStorage.getItem(`delegate_token_${matchId}`) || undefined;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const token = localStorage.getItem("auth_token");
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`/api/matches/${matchId}/chronicle`, {
        method: "POST",
        headers,
        body: JSON.stringify({ chronicle: text, pin, delegateToken }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/matches', matchId] });
      setChronicleEditing(false);
      toast({ title: "Crónica guardada" });
    },
    onError: () => toast({ title: "Error al guardar", variant: "destructive" }),
  });

  const generateChronicle = useMutation({
    mutationFn: async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const delegateToken = urlParams.get('delegateToken') || sessionStorage.getItem(`delegate_token_${matchId}`) || undefined;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const token = localStorage.getItem("auth_token");
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`/api/matches/${matchId}/generate-chronicle`, {
        method: "POST",
        headers,
        body: JSON.stringify({ pin, delegateToken }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Error al generar");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/matches', matchId] });
      if (data.alreadyGenerated) {
        toast({ title: "Crónica ya generada", description: "Se muestra la crónica existente" });
      } else {
        toast({ title: "Crónica generada con IA" });
      }
    },
    onError: (err: Error) => toast({ title: err.message || "Error al generar crónica", variant: "destructive" }),
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const urlRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      const { uploadURL, objectPath } = await urlRes.json();
      await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      const servePath = `/objects${objectPath}`;
      await apiRequest('POST', `/api/matches/${matchId}/summary-image`, { summaryImageUrl: servePath, pin });
      queryClient.invalidateQueries({ queryKey: ['/api/matches', matchId] });
      toast({ title: "Foto resumen subida" });
    } catch {
      toast({ title: "Error al subir imagen", variant: "destructive" });
    } finally {
      setUploadingImage(false);
    }
  };

  const removeSummaryImage = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/matches/${matchId}/summary-image`, { summaryImageUrl: null, pin });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/matches', matchId] });
      toast({ title: "Foto resumen eliminada" });
    },
  });

  // Check owner status, URL pin, delegate token, and session storage on load
  useEffect(() => {
    if (ownerData?.isOwner) {
      setIsOwner(true);
      setIsAuthenticated(true);
      const savedPin = sessionStorage.getItem(`match_pin_${matchId}`);
      if (savedPin) setPin(savedPin);
      else if (ownerData?.hasPin && matchData?.adminPin) {
        setPin(matchData.adminPin);
      }
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      const urlPin = urlParams.get('pin');
      const urlDelegateToken = urlParams.get('delegateToken');
      const savedPin = sessionStorage.getItem(`match_pin_${matchId}`);

      if (urlDelegateToken) {
        fetch(`/api/matches/${matchId}/verify-delegate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ delegateToken: urlDelegateToken }),
        })
          .then(r => r.json())
          .then(data => {
            if (data.authorized) {
              setIsAuthenticated(true);
              setIsDelegate(true);
              if (data.clubSlug) {
                setDelegateClubSlug(data.clubSlug);
                sessionStorage.setItem(`delegate_club_slug_${matchId}`, data.clubSlug);
              }
              if (data.adminPin) {
                setPin(data.adminPin);
                sessionStorage.setItem(`match_pin_${matchId}`, data.adminPin);
              }
              sessionStorage.setItem(`delegate_token_${matchId}`, urlDelegateToken);
              window.history.replaceState({}, '', window.location.pathname);
            }
          })
          .catch(() => {});
      } else {
        const pinToTry = urlPin || savedPin;
        if (pinToTry) {
          setPin(pinToTry);
          verifyPin.mutate(pinToTry, {
            onSuccess: () => {
              setIsAuthenticated(true);
              sessionStorage.setItem(`match_pin_${matchId}`, pinToTry);
              if (urlPin) {
                window.history.replaceState({}, '', window.location.pathname);
              }
            },
            onError: () => {
              if (savedPin) sessionStorage.removeItem(`match_pin_${matchId}`);
            }
          });
        }
      }
    }
  }, [matchId, ownerData, matchData?.adminPin]);

  // Handle Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    verifyPin.mutate(pin, {
      onSuccess: () => {
        setIsAuthenticated(true);
        sessionStorage.setItem(`match_pin_${matchId}`, pin);
      },
      onError: () => toast({ variant: "destructive", title: "Invalid PIN" })
    });
  };

  const hasPremiumAccess = isDelegate || ownerData?.userRole === "superadmin" || ownerData?.userRole === "coordinator";

  // Auth Guard
  if (isLoading || isOwnerLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  if (!matchData) return <div className="min-h-screen flex items-center justify-center">Partido no encontrado</div>;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-slate-500" />
            </div>
            <CardTitle>Acceso Administrador</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label>Introduce el PIN para {matchData.localTeam} vs {matchData.awayTeam}</Label>
                <Input 
                  type="password" 
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4} 
                  value={pin} 
                  onChange={(e) => setPin(e.target.value)}
                  className="text-center text-2xl tracking-widest font-mono"
                  placeholder="••••"
                  data-testid="input-pin"
                />
              </div>
              <Button type="submit" className="w-full" disabled={verifyPin.isPending}>
                {verifyPin.isPending ? "Verificando..." : "Desbloquear Panel"}
              </Button>
            </form>

            <div className="pt-4 border-t border-dashed mt-4">
              <p className="text-[10px] text-muted-foreground italic leading-tight">
                ¿Has olvidado el PIN? Si creaste este marcador desde este dispositivo, puedes intentar retomarlo desde el inicio. De lo contrario, contacta con el delegado del partido o crea un marcador nuevo.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- ACTIONS ---

  const handleScore = (team: "local" | "away", delta: number) => {
    updateScore.mutate({ team, delta, pin }, {
      onSuccess: () => {
        if (delta > 0) {
          canvasConfetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
          });
        }
      }
    });
  };

  const handleStatusChange = (status: MatchStatus) => {
    updateStatus.mutate({ status, pin }, {
      onSuccess: () => {
        // Only trigger start if moving to play state
        if (status === MATCH_STATUS.FIRST_HALF || status === MATCH_STATUS.SECOND_HALF) {
          handleTimer("start");
        } else if (status === MATCH_STATUS.HALFTIME || status === MATCH_STATUS.FINISHED) {
          handleTimer("pause");
        }
      }
    });
  };

  const handleTimer = (action: "start" | "pause" | "reset") => {
    controlTimer.mutate({ action, pin });
  };

  const handleEventSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const minute = getCurrentMinute(matchData);
    
    createEvent.mutate({
      matchId,
      type: selectedEventType,
      team: selectedEventTeam,
      player: formData.get("player") as string,
      description: formData.get("description") as string,
      minute,
      pin
    }, {
      onSuccess: () => setNewEventOpen(false)
    });
  };

  const handleDeleteEvent = (eventId: number) => {
    if (confirm("¿Estás seguro de que quieres borrar este evento?")) {
      deleteEvent.mutate({ eventId, pin });
    }
  };

  const handleUpdatePlayer = (eventId: number, player: string) => {
    updateEvent.mutate({ eventId, player, pin });
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Navbar */}
      <header className="bg-white border-b sticky top-0 z-10 px-4 py-2 shadow-sm">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="font-bold text-slate-800">Panel de Administración</h1>
            <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded-full text-xs text-slate-600">
              <Eye className="w-3 h-3" />
              <span className="font-mono font-bold">{matchData.spectatorCount}</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => {
            sessionStorage.removeItem(`match_pin_${matchId}`);
            setIsAuthenticated(false);
          }}>
            <Lock className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-4">
        
        <div className="pb-2 bg-slate-50">
          <ScoreBoard match={matchData} />
        </div>

        {/* Share button - always prominent */}
        <ShareModal matchId={matchId} localTeam={matchData.localTeam} awayTeam={matchData.awayTeam} fullWidth />

        {matchData.status === MATCH_STATUS.FINISHED && (
          <Card className="border-blue-200 bg-blue-50/30">
            <CardContent className="p-4 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wide flex items-center gap-2 text-blue-800">
                <FileText className="w-4 h-4" />
                Post-partido
              </h3>

              {hasPremiumAccess && (
                <ShareResultImage 
                  localTeam={matchData.localTeam} 
                  awayTeam={matchData.awayTeam} 
                  localScore={matchData.localScore} 
                  awayScore={matchData.awayScore}
                  localTeamColor={matchData.localTeamColor}
                  awayTeamColor={matchData.awayTeamColor}
                  localTeamLogo={matchData.localTeamLogo}
                  awayTeamLogo={matchData.awayTeamLogo}
                  matchStatus={matchData.status}
                  sponsorName={sponsorData?.name}
                  sponsorLogo={sponsorData?.logoUrl}
                  template={(templateConfig?.templateResult as any) || 'classic'}
                  fullWidth
                />
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Crónica del partido</Label>
                </div>

                {!matchData.chronicle && !chronicleEditing && (
                  <div className="space-y-2">
                    {hasPremiumAccess && (
                      <Button
                        variant="outline"
                        className="w-full gap-2 border-blue-300 text-blue-700"
                        onClick={() => generateChronicle.mutate()}
                        disabled={generateChronicle.isPending}
                        data-testid="button-ai-chronicle"
                      >
                        {generateChronicle.isPending ? (
                          <><Loader2Icon className="w-4 h-4 animate-spin" /> Generando crónica...</>
                        ) : (
                          <><Sparkles className="w-4 h-4" /> Generar crónica con IA</>
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setChronicleText("");
                        setChronicleEditing(true);
                      }}
                      data-testid="button-write-chronicle"
                    >
                      Escribir manualmente
                    </Button>
                  </div>
                )}

                {matchData.chronicle && !chronicleEditing && (
                  <div className="space-y-2">
                    <p className="text-sm whitespace-pre-wrap bg-white rounded-lg p-3 border" data-testid="text-chronicle">
                      {matchData.chronicle}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => {
                          navigator.clipboard.writeText(matchData.chronicle || "");
                          setChronicleCopied(true);
                          setTimeout(() => setChronicleCopied(false), 2000);
                          toast({ title: "Crónica copiada al portapapeles" });
                        }}
                        data-testid="button-copy-chronicle"
                      >
                        {chronicleCopied ? <><Check className="w-3 h-3" /> Copiado</> : <><Copy className="w-3 h-3" /> Copiar texto</>}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setChronicleText(matchData.chronicle || "");
                          setChronicleEditing(true);
                        }}
                        data-testid="button-edit-chronicle"
                      >
                        Editar
                      </Button>
                    </div>
                  </div>
                )}

                {chronicleEditing && (
                  <div className="space-y-2">
                    <Textarea
                      value={chronicleText || ""}
                      onChange={(e) => setChronicleText(e.target.value)}
                      placeholder="Escribe aquí la crónica del partido..."
                      rows={6}
                      data-testid="textarea-chronicle"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => saveChronicle.mutate(chronicleText || "")}
                        disabled={saveChronicle.isPending}
                        data-testid="button-save-chronicle"
                      >
                        {saveChronicle.isPending ? "Guardando..." : "Guardar crónica"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setChronicleEditing(false)}
                        data-testid="button-cancel-chronicle"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Matchday image - only when match is scheduled, for superadmin/coordinator/delegate */}
        {hasPremiumAccess && matchData.status === MATCH_STATUS.SCHEDULED && (
          <MatchdayImage
            matchId={matchData.id}
            localTeam={matchData.localTeam}
            awayTeam={matchData.awayTeam}
            localTeamColor={matchData.localTeamColor}
            awayTeamColor={matchData.awayTeamColor}
            localTeamLogo={matchData.localTeamLogo}
            awayTeamLogo={matchData.awayTeamLogo}
            scheduledDate={matchData.scheduledDate}
            scheduledTime={matchData.scheduledTime}
            venue={matchData.venue}
            category={matchData.category}
            league={matchData.league}
            sponsorName={sponsorData?.name}
            sponsorLogo={sponsorData?.logoUrl}
            template={(templateConfig?.templateMatchday as any) || 'classic'}
            fullWidth
          />
        )}

        

        {/* SCORE CONTROLS */}
        <div className="grid grid-cols-2 gap-3">
          <TeamControl 
            teamName={matchData.localTeam} 
            score={matchData.localScore} 
            onIncrement={() => handleScore("local", 1)}
            onDecrement={() => handleScore("local", -1)}
            side="Local"
            teamColor={matchData.localTeamColor || '#3b82f6'}
            onColorChange={(color: string) => updateColors.mutate({ localTeamColor: color, pin })}
            disabled={updateScore.isPending}
          />
          <TeamControl 
            teamName={matchData.awayTeam} 
            score={matchData.awayScore} 
            onIncrement={() => handleScore("away", 1)}
            onDecrement={() => handleScore("away", -1)}
            side="Visitante"
            teamColor={matchData.awayTeamColor || '#ef4444'}
            onColorChange={(color: string) => updateColors.mutate({ awayTeamColor: color, pin })}
            disabled={updateScore.isPending}
          />
        </div>

        {/* STATUS + TIMER CONTROLS */}
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* Next action button - highlighted */}
            {matchData.status === MATCH_STATUS.SCHEDULED && (
              <Button
                onClick={() => handleStatusChange(MATCH_STATUS.FIRST_HALF)}
                disabled={updateStatus.isPending || controlTimer.isPending}
                className="w-full h-14 text-base font-bold uppercase tracking-wide gap-2 bg-green-600 shadow-lg shadow-green-600/30 animate-pulse disabled:animate-none disabled:opacity-70"
                data-testid="button-start-match"
              >
                {updateStatus.isPending ? <Loader2Icon className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                {updateStatus.isPending ? "Iniciando..." : "Iniciar Partido"}
              </Button>
            )}
            {matchData.status === MATCH_STATUS.FIRST_HALF && (
              <Button
                onClick={() => handleStatusChange(MATCH_STATUS.HALFTIME)}
                disabled={updateStatus.isPending || controlTimer.isPending}
                className="w-full h-14 text-base font-bold uppercase tracking-wide gap-2 bg-orange-500 shadow-lg shadow-orange-500/30 disabled:opacity-70"
                data-testid="button-halftime"
              >
                {updateStatus.isPending ? <Loader2Icon className="w-5 h-5 animate-spin" /> : <Pause className="w-5 h-5" />}
                {updateStatus.isPending ? "Cambiando..." : "Descanso"}
              </Button>
            )}
            {matchData.status === MATCH_STATUS.HALFTIME && (
              <Button
                onClick={() => handleStatusChange(MATCH_STATUS.SECOND_HALF)}
                disabled={updateStatus.isPending || controlTimer.isPending}
                className="w-full h-14 text-base font-bold uppercase tracking-wide gap-2 bg-green-600 shadow-lg shadow-green-600/30 disabled:opacity-70"
                data-testid="button-second-half"
              >
                {updateStatus.isPending ? <Loader2Icon className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                {updateStatus.isPending ? "Iniciando..." : "2ª Parte"}
              </Button>
            )}
            {matchData.status === MATCH_STATUS.SECOND_HALF && (
              <Button
                onClick={() => handleStatusChange(MATCH_STATUS.FINISHED)}
                disabled={updateStatus.isPending || controlTimer.isPending}
                className="w-full h-14 text-base font-bold uppercase tracking-wide gap-2 bg-red-600 shadow-lg shadow-red-600/30 disabled:opacity-70"
                data-testid="button-finish"
              >
                {updateStatus.isPending ? <Loader2Icon className="w-5 h-5 animate-spin" /> : <Flag className="w-5 h-5" />}
                {updateStatus.isPending ? "Finalizando..." : "Finalizar Partido"}
              </Button>
            )}

            {/* All status buttons in smaller row for manual override */}
            <div className="grid grid-cols-4 gap-1.5">
              <Button 
                onClick={() => handleStatusChange(MATCH_STATUS.FIRST_HALF)} 
                disabled={updateStatus.isPending || controlTimer.isPending}
                className={cn("h-9 flex-col gap-0.5 text-[9px] font-bold uppercase", matchData.status === MATCH_STATUS.FIRST_HALF ? "bg-primary" : "bg-slate-100 text-slate-500")}
                variant={matchData.status === MATCH_STATUS.FIRST_HALF ? "default" : "ghost"}
                data-testid="button-status-first-half"
              >
                <Play className="w-3 h-3" />
                1ª Parte
              </Button>
              <Button 
                onClick={() => handleStatusChange(MATCH_STATUS.HALFTIME)} 
                disabled={updateStatus.isPending || controlTimer.isPending}
                className={cn("h-9 flex-col gap-0.5 text-[9px] font-bold uppercase", matchData.status === MATCH_STATUS.HALFTIME ? "bg-orange-500" : "bg-slate-100 text-slate-500")}
                variant={matchData.status === MATCH_STATUS.HALFTIME ? "default" : "ghost"}
                data-testid="button-status-halftime"
              >
                <Pause className="w-3 h-3" />
                Descanso
              </Button>
              <Button 
                onClick={() => handleStatusChange(MATCH_STATUS.SECOND_HALF)} 
                disabled={updateStatus.isPending || controlTimer.isPending}
                className={cn("h-9 flex-col gap-0.5 text-[9px] font-bold uppercase", matchData.status === MATCH_STATUS.SECOND_HALF ? "bg-green-600" : "bg-slate-100 text-slate-500")}
                variant={matchData.status === MATCH_STATUS.SECOND_HALF ? "default" : "ghost"}
                data-testid="button-status-second-half"
              >
                <Play className="w-3 h-3" />
                2ª Parte
              </Button>
              <Button 
                onClick={() => handleStatusChange(MATCH_STATUS.FINISHED)} 
                disabled={updateStatus.isPending || controlTimer.isPending}
                className={cn("h-9 flex-col gap-0.5 text-[9px] font-bold uppercase", matchData.status === MATCH_STATUS.FINISHED ? "bg-red-600" : "bg-slate-100 text-slate-500")}
                variant={matchData.status === MATCH_STATUS.FINISHED ? "default" : "ghost"}
                data-testid="button-status-finished"
              >
                <Flag className="w-3 h-3" />
                Final
              </Button>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => handleTimer(matchData.timerStartTime ? "pause" : "start")} variant="outline" size="sm" className="flex-1 h-10 gap-2" disabled={controlTimer.isPending || updateStatus.isPending}>
                {matchData.timerStartTime ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {matchData.timerStartTime ? "Pausar" : "Reanudar"}
              </Button>
              <Button onClick={() => handleTimer("reset")} variant="outline" size="sm" className="flex-1 h-10 gap-2" disabled={controlTimer.isPending || updateStatus.isPending}>
                <RotateCcw className="w-4 h-4" />
                Reiniciar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* EVENTS SECTION */}
        <div className="space-y-4">
           <Card>
             <CardHeader className="flex flex-row items-center justify-between py-3">
               <CardTitle className="text-base font-bold">Eventos</CardTitle>
               <Dialog open={newEventOpen} onOpenChange={setNewEventOpen}>
                 <DialogTrigger asChild>
                   <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
                     <Plus className="w-3.5 h-3.5" /> Evento
                   </Button>
                 </DialogTrigger>
                 <DialogContent>
                   <DialogHeader>
                     <DialogTitle>Registrar Evento del Partido</DialogTitle>
                   </DialogHeader>
                   <form onSubmit={handleEventSubmit} className="space-y-6">
                     <div className="space-y-3">
                       <Label className="text-xs uppercase font-bold text-slate-500">Tipo de Evento</Label>
                       <div className="grid grid-cols-2 gap-2">
                         <Button 
                           type="button" 
                           variant={selectedEventType === "yellow_card" ? "default" : "outline"}
                           className={cn("h-12 flex-col gap-1 text-[10px]", selectedEventType === "yellow_card" && "bg-yellow-500 hover:bg-yellow-600")}
                           onClick={() => setSelectedEventType("yellow_card")}
                         >
                           <span className="text-base">🟨</span>
                           Amarilla
                         </Button>
                         <Button 
                           type="button" 
                           variant={selectedEventType === "red_card" ? "default" : "outline"}
                           className={cn("h-12 flex-col gap-1 text-[10px]", selectedEventType === "red_card" && "bg-red-600 hover:bg-red-700")}
                           onClick={() => setSelectedEventType("red_card")}
                         >
                           <span className="text-base">🟥</span>
                           Roja
                         </Button>
                         <Button 
                           type="button" 
                           variant={selectedEventType === "sub" ? "default" : "outline"}
                           className={cn("h-12 flex-col gap-1 text-[10px]", selectedEventType === "sub" && "bg-blue-600 hover:bg-blue-700")}
                           onClick={() => setSelectedEventType("sub")}
                         >
                           <span className="text-base">🔄</span>
                           Cambio
                         </Button>
                         <Button 
                           type="button" 
                           variant={selectedEventType === "whistle" ? "default" : "outline"}
                           className={cn("h-12 flex-col gap-1 text-[10px]", selectedEventType === "whistle" && "bg-slate-600 hover:bg-slate-700")}
                           onClick={() => setSelectedEventType("whistle")}
                         >
                           <span className="text-base">📢</span>
                           Aviso
                         </Button>
                       </div>
                     </div>

                     <div className="space-y-3">
                       <Label className="text-xs uppercase font-bold text-slate-500">Equipo</Label>
                       <div className="grid grid-cols-2 gap-2">
                         <Button 
                           type="button" 
                           variant={selectedEventTeam === "local" ? "default" : "outline"}
                           className={cn("h-10 text-xs", selectedEventTeam === "local" && "bg-blue-600 hover:bg-blue-700")}
                           onClick={() => setSelectedEventTeam("local")}
                         >
                           {matchData.localTeam}
                         </Button>
                         <Button 
                           type="button" 
                           variant={selectedEventTeam === "away" ? "default" : "outline"}
                           className={cn("h-10 text-xs", selectedEventTeam === "away" && "bg-red-600 hover:bg-red-700")}
                           onClick={() => setSelectedEventTeam("away")}
                         >
                           {matchData.awayTeam}
                         </Button>
                       </div>
                     </div>

                     <div className="space-y-2">
                       <Label>Nombre del Jugador (Opcional)</Label>
                       <Input name="player" placeholder="ej. #10 Messi" />
                     </div>
                     <div className="space-y-2">
                       <Label>Descripción (Opcional)</Label>
                       <Textarea name="description" placeholder="Detalles..." />
                     </div>
                     <DialogFooter>
                       <Button type="submit" className="w-full" disabled={createEvent.isPending}>
                         {createEvent.isPending ? "Guardando..." : "Guardar Evento"}
                       </Button>
                     </DialogFooter>
                   </form>
                 </DialogContent>
               </Dialog>
             </CardHeader>
             <CardContent>
               <EventFeed 
                 events={eventsData || []} 
                 localTeam={matchData?.localTeam} 
                 awayTeam={matchData?.awayTeam}
                 localTeamColor={matchData?.localTeamColor}
                 awayTeamColor={matchData?.awayTeamColor}
                 onDelete={handleDeleteEvent} 
                 onUpdatePlayer={handleUpdatePlayer}
                 localRoster={rosterData?.local || []}
                 awayRoster={rosterData?.away || []}
               />
             </CardContent>
           </Card>
        </div>

        {/* PIN Management - visible to owners and PIN users */}
        {(isOwner || matchData.adminPin) && (
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800">Delegar control</span>
                </div>
                {matchData.adminPin ? (
                  <div className="flex items-center gap-2">
                    <code className="bg-amber-100 text-amber-800 px-2 py-1 rounded font-mono text-sm">
                      {matchData.adminPin}
                    </code>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => {
                        const adminUrl = `${window.location.origin}/match/${matchId}/admin?pin=${matchData.adminPin}`;
                        const message = `Controla el marcador de ${matchData.localTeam} vs ${matchData.awayTeam}:\n${adminUrl}\nRecuerda, el PIN es ${matchData.adminPin}`;
                        navigator.clipboard.writeText(message);
                        setPinCopied(true);
                        setTimeout(() => setPinCopied(false), 2000);
                      }}
                      data-testid="button-copy-pin"
                    >
                      {pinCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </Button>
                    {isOwner && (
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        onClick={() => removePin.mutate()}
                        disabled={removePin.isPending}
                        data-testid="button-remove-pin"
                      >
                        Quitar
                      </Button>
                    )}
                  </div>
                ) : isOwner ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      placeholder="PIN (4 dígitos)"
                      value={customPin}
                      onChange={(e) => setCustomPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      className="w-28 h-8 text-sm text-center font-mono"
                      data-testid="input-custom-pin"
                    />
                    <Button 
                      size="sm"
                      variant="outline"
                      className="border-amber-300 text-amber-700"
                      onClick={() => {
                        const body = customPin.length === 4 ? { pin: customPin } : {};
                        generatePin.mutate(body as any);
                        setCustomPin("");
                      }}
                      disabled={generatePin.isPending}
                      data-testid="button-generate-pin"
                    >
                      <Key className="w-3 h-3 mr-1" />
                      {customPin.length === 4 ? "Usar PIN" : "Generar PIN"}
                    </Button>
                  </div>
                ) : null}
              </div>
              <p className="text-xs text-amber-600 mt-2">
                {matchData.adminPin 
                  ? "Copia el enlace para compartir acceso directo al marcador" 
                  : "Escribe un PIN de 4 dígitos o genera uno aleatorio"}
              </p>
            </CardContent>
          </Card>
        )}


        {/* DELETE MATCH */}
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-red-700">Eliminar partido</p>
                <p className="text-xs text-red-600/70">Esta acción no se puede deshacer</p>
              </div>
              <Button 
                variant="destructive"
                size="sm"
                className="gap-2"
                disabled={deleteMatch.isPending}
                onClick={() => {
                  if (confirm("¿Estás seguro de que quieres BORRAR este partido permanentemente? Esta acción no se puede deshacer.")) {
                    deleteMatch.mutate(pin, {
                      onSuccess: () => {
                        sessionStorage.removeItem(`match_pin_${matchId}`);
                        setLocation("/");
                      }
                    });
                  }
                }}
                data-testid="button-delete-match"
              >
                <Trash2 className="w-4 h-4" />
                Borrar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* BACK BUTTON AT BOTTOM */}
        <div className="pt-4 text-center">
          <Button 
            variant="ghost" 
            className="text-slate-400 font-bold hover:text-slate-600 uppercase tracking-widest text-[10px]"
            onClick={() => {
              const slug = delegateClubSlug || sessionStorage.getItem(`delegate_club_slug_${matchId}`);
              if (isDelegate && slug) {
                const token = sessionStorage.getItem(`delegate_token_${matchId}`);
                window.location.href = `/club/${slug}/delegado${token ? `?token=${token}` : ''}`;
              } else if (ownerData?.userRole === "coordinator" && ownerData?.clubSlug) {
                window.location.href = `/club/${ownerData.clubSlug}/admin`;
              } else {
                window.location.href = "/";
              }
            }}
          >
            {isDelegate ? "← Volver al panel de delegado" : ownerData?.userRole === "coordinator" && ownerData?.clubSlug ? "← Volver al panel de coordinador" : "← Volver al Inicio"}
          </Button>
        </div>
      </main>
    </div>
  );
}

function TeamControl({ teamName, score, onIncrement, onDecrement, side, teamColor, onColorChange, disabled }: any) {
  return (
    <Card className="overflow-hidden">
      <div className="h-1.5 w-full" style={{ backgroundColor: teamColor }} />
      <CardContent className="p-4 flex flex-col items-center">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] uppercase font-bold text-muted-foreground">Equipo {side}</span>
          <input 
            type="color" 
            value={teamColor} 
            onChange={(e) => onColorChange?.(e.target.value)}
            className="w-5 h-5 rounded border-2 border-slate-300 cursor-pointer"
            style={{ padding: 0 }}
            aria-label={`Color del equipo ${side}`}
            data-testid={`input-color-${side.toLowerCase()}`}
          />
        </div>
        <h3 className="text-base font-bold mb-3 text-center h-10 flex items-center line-clamp-2">{teamName}</h3>
        
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-full border-2" onClick={onDecrement} disabled={disabled || score <= 0} data-testid={`button-decrement-${side.toLowerCase()}`}>
            <Minus className="w-5 h-5" />
          </Button>
          <div className="text-4xl font-mono font-black tabular-nums min-w-[2ch] text-center" data-testid={`text-score-${side.toLowerCase()}`}>
            {score}
          </div>
          <Button size="icon" className="h-10 w-10 rounded-full shadow-lg" onClick={onIncrement} disabled={disabled} data-testid={`button-increment-${side.toLowerCase()}`}>
            <Plus className="w-5 h-5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function getCurrentMinute(match: any): number {
  if (!match) return 0;
  let seconds = match.timerElapsedSeconds;
  if (match.timerStartTime && match.status !== MATCH_STATUS.HALFTIME && match.status !== MATCH_STATUS.FINISHED) {
    seconds += Math.floor((new Date().getTime() - new Date(match.timerStartTime).getTime()) / 1000);
  }
  return Math.ceil(seconds / 60) || 1; // Minimum minute 1
}
