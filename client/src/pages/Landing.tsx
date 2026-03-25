import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMatchSchema, type InsertMatch, type Match, type Team, MATCH_STATUS } from "@shared/schema";
import { useCreateMatch } from "@/hooks/use-matches";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Timer, ArrowRight, Shield, User, UserPlus, Trash2, Play, CheckCircle, LayoutDashboard, X, Settings, Code, Share2, Copy, Check, LogIn, LogOut } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLocation, Link } from "wouter";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PublicUser } from "@shared/schema";

export default function Landing() {
  const createMatch = useCreateMatch();
  const [, setLocation] = useLocation();
  const [view, setView] = useState<"choice" | "guest" | "registered">("choice");
  const [myMatchIds, setMyMatchIds] = useState<number[]>([]);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const qcLocal = useQueryClient();
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const hasLocalToken = !!localStorage.getItem("auth_token");
  const { data: localUser } = useQuery<PublicUser | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: hasLocalToken,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
  const [localTeamSelection, setLocalTeamSelection] = useState<string>("manual");
  const [awayTeamSelection, setAwayTeamSelection] = useState<string>("manual");
  const [sharePopupOpen, setSharePopupOpen] = useState(false);
  const [createdMatchId, setCreatedMatchId] = useState<number | null>(null);
  const [createdMatchTeams, setCreatedMatchTeams] = useState<{local: string, away: string}>({local: "", away: ""});
  const [linkCopied, setLinkCopied] = useState(false);

  const isLocalLoggedInEarly = !!localUser;
  const isAnyAuthenticated = isAuthenticated || isLocalLoggedInEarly;

  const { data: savedTeams = [] } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    enabled: isAnyAuthenticated,
  });

  const { data: adminCheck } = useQuery<{ isSuperAdmin: boolean } | null>({
    queryKey: ["/api/admin/check"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isAnyAuthenticated,
    retry: false,
  });

  const isSuperAdmin = adminCheck?.isSuperAdmin || false;

  const { data: myClub } = useQuery<{ slug: string } | null>({
    queryKey: ["/api/club/mine"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isAnyAuthenticated,
    retry: false,
  });

  useEffect(() => {
    if (myClub?.slug) {
      setLocation(`/club/${myClub.slug}/admin`);
    }
  }, [myClub, setLocation]);

  const createUserMatch = useMutation({
    mutationFn: async (data: InsertMatch) => {
      const res = await apiRequest("POST", "/api/user-matches", data);
      return res.json();
    },
    onSuccess: (match: Match) => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-matches"] });
      const matchPin = (match as any).adminPin || form.getValues().adminPin;
      if (matchPin) sessionStorage.setItem(`match_pin_${match.id}`, matchPin);
      setCreatedMatchId(match.id);
      setCreatedMatchTeams({ local: match.localTeam, away: match.awayTeam });
      setSharePopupOpen(true);
    }
  });

  // Load match IDs from localStorage
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("my_matches") || "[]");
    setMyMatchIds(stored);
  }, []);

  // Fetch match details for all stored IDs
  const { data: myMatches } = useQuery<Match[]>({
    queryKey: ["my-matches-details", myMatchIds],
    queryFn: async () => {
      if (myMatchIds.length === 0) return [];
      
      const results = await Promise.all(
        myMatchIds.map(async (id) => {
          try {
            const res = await fetch(`/api/matches/${id}`);
            if (!res.ok) return null;
            return res.json();
          } catch {
            return null;
          }
        })
      );
      
      return results.filter(Boolean) as Match[];
    },
    enabled: myMatchIds.length > 0,
  });

  // Check if a finished match should be hidden (older than 1 hour)
  const isExpiredFinishedMatch = (match: Match): boolean => {
    if (match.status !== MATCH_STATUS.FINISHED) return false;
    
    const lastActivity = new Date(match.lastActivityAt);
    const oneHourAgo = new Date(Date.now() - (1 * 60 * 60 * 1000));
    return lastActivity < oneHourAgo;
  };

  // Filter out finished matches older than 1 hour
  const activeMatches = myMatches?.filter((match) => !isExpiredFinishedMatch(match)) || [];

  // Hide match from list (remove from localStorage without deleting from server)
  const hideMatch = (id: number) => {
    const stored = JSON.parse(localStorage.getItem("my_matches") || "[]");
    const updated = stored.filter((matchId: number) => matchId !== id);
    localStorage.setItem("my_matches", JSON.stringify(updated));
    setMyMatchIds(updated);
    sessionStorage.removeItem(`match_pin_${id}`);
    toast({
      title: "Partido ocultado",
      description: "El partido se ha quitado de tu lista."
    });
  };

  // Update localStorage to remove stale matches (including 404s and expired)
  useEffect(() => {
    if (myMatches && myMatches.length > 0) {
      const storedIds: number[] = JSON.parse(localStorage.getItem("my_matches") || "[]");
      
      // Keep only matches that exist AND are not expired finished matches
      const validIds = myMatches
        .filter(match => !isExpiredFinishedMatch(match))
        .map(m => m.id);
      
      const cleanedIds = storedIds.filter(id => validIds.includes(id));
      
      if (cleanedIds.length !== storedIds.length) {
        localStorage.setItem("my_matches", JSON.stringify(cleanedIds));
        setMyMatchIds(cleanedIds);
      }
    }
  }, [myMatches]);

  const removeMatch = async (id: number) => {
    const pin = sessionStorage.getItem(`match_pin_${id}`);
    
    if (!pin) {
      toast({ 
        variant: "destructive", 
        title: "No puedes eliminar este partido",
        description: "No tienes el PIN guardado. Accede primero al panel de administración."
      });
      return;
    }

    if (!confirm("¿Estás seguro de que quieres BORRAR este partido permanentemente?")) {
      return;
    }

    setDeletingId(id);
    
    try {
      const res = await fetch(`/api/matches/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      if (!res.ok) {
        throw new Error("Error al eliminar");
      }

      // Remove from localStorage and sessionStorage
      const updated = myMatchIds.filter(mid => mid !== id);
      localStorage.setItem("my_matches", JSON.stringify(updated));
      sessionStorage.removeItem(`match_pin_${id}`);
      setMyMatchIds(updated);
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["my-matches-details"] });
      queryClient.invalidateQueries({ queryKey: ["/api/active-matches"] });
      
      toast({ title: "Partido eliminado", description: "El partido ha sido borrado permanentemente" });
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el partido" });
    } finally {
      setDeletingId(null);
    }
  };

  const form = useForm<InsertMatch>({
    resolver: zodResolver(insertMatchSchema),
    defaultValues: {
      localTeam: "",
      awayTeam: "",
      adminPin: "",
      scheduledTime: "",
      venue: "",
      category: "",
      league: "",
    },
  });

  const onSubmit = (data: InsertMatch) => {
    createMatch.mutate(data, {
      onSuccess: (match) => {
        const existingMatches = JSON.parse(localStorage.getItem("my_matches") || "[]");
        if (!existingMatches.includes(match.id)) {
          localStorage.setItem("my_matches", JSON.stringify([...existingMatches, match.id]));
        }
        sessionStorage.setItem(`match_pin_${match.id}`, data.adminPin);
        setCreatedMatchId(match.id);
        setCreatedMatchTeams({ local: data.localTeam, away: data.awayTeam });
        setSharePopupOpen(true);
      },
    });
  };

  const handleRegisteredSubmit = () => {
    const localTeam = localTeamSelection === "manual" 
      ? form.getValues().localTeam 
      : savedTeams.find(t => t.id.toString() === localTeamSelection)?.name || form.getValues().localTeam;
    
    const awayTeam = awayTeamSelection === "manual"
      ? form.getValues().awayTeam
      : savedTeams.find(t => t.id.toString() === awayTeamSelection)?.name || form.getValues().awayTeam;
    
    const data = {
      ...form.getValues(),
      localTeam,
      awayTeam
    };

    createUserMatch.mutate(data);
  };

  const sharePopup = (
    <Dialog open={sharePopupOpen} onOpenChange={(open) => {
      if (!open && createdMatchId) {
        setSharePopupOpen(false);
        setLocation(`/match/${createdMatchId}/admin`);
      }
    }}>
      <DialogContent className="max-w-sm w-[calc(100%-2rem)]">
        <DialogHeader>
          <DialogTitle className="text-center text-lg">
            <Share2 className="w-6 h-6 mx-auto mb-2 text-primary" />
            Partido creado
          </DialogTitle>
        </DialogHeader>
        <p className="text-center text-sm text-muted-foreground">
          Comparte el enlace para que puedan seguir el marcador en directo.
        </p>
        <div className="space-y-3">
          <Button
            className="w-full bg-[#25D366] border-[#25D366] text-white gap-2"
            onClick={() => {
              const url = `${window.location.origin}/match/${createdMatchId}`;
              const text = `Sigue en directo ${createdMatchTeams.local} vs ${createdMatchTeams.away}: ${url}`;
              window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
            }}
            data-testid="button-share-whatsapp"
          >
            <SiWhatsapp className="w-5 h-5" />
            Compartir por WhatsApp
          </Button>
          <div className="flex items-center gap-2">
            <Input
              className="flex-1 text-xs font-mono"
              readOnly
              value={createdMatchId ? `${window.location.origin}/match/${createdMatchId}` : ""}
              data-testid="input-share-url"
            />
            <Button
              size="icon"
              variant="outline"
              onClick={() => {
                if (createdMatchId) {
                  navigator.clipboard.writeText(`${window.location.origin}/match/${createdMatchId}`);
                  setLinkCopied(true);
                  toast({ title: "Copiado", description: "Enlace copiado al portapapeles" });
                  setTimeout(() => setLinkCopied(false), 2000);
                }
              }}
              data-testid="button-copy-share-link"
            >
              {linkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <Button
            className="w-full"
            onClick={() => {
              setSharePopupOpen(false);
              if (createdMatchId) setLocation(`/match/${createdMatchId}/admin`);
            }}
            data-testid="button-go-to-admin"
          >
            Ir al partido
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  const handleLocalLogout = () => {
    localStorage.removeItem("auth_token");
    queryClient.setQueryData(["/api/auth/me"], null);
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  };

  if (view === "choice") {
    return (
      <div className="min-h-screen w-full bg-slate-50 flex flex-col items-center justify-center p-4 md:p-8">
        {sharePopup}
        {isLocalLoggedInEarly && (
          <div className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur border-b border-slate-200 z-50">
            <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-xs font-bold text-white">{localUser.username.charAt(0).toUpperCase()}</span>
                </div>
                <span className="text-sm font-medium text-slate-700" data-testid="text-topbar-username">{localUser.username}</span>
              </div>
              <div className="flex items-center gap-1">
                <Link href="/dashboard">
                  <Button variant="ghost" size="sm" className="text-xs gap-1" data-testid="button-topbar-dashboard">
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    Panel
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" className="text-xs gap-1 text-slate-500" onClick={handleLocalLogout} data-testid="button-topbar-logout">
                  <LogOut className="w-3.5 h-3.5" />
                  Salir
                </Button>
              </div>
            </div>
          </div>
        )}
        <div className="w-full max-w-lg space-y-8">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
              <h1 className="text-4xl font-black tracking-tight text-slate-900 uppercase">
                Marcador<span className="text-primary">LIVE</span>
              </h1>
            </div>
            <p className="text-muted-foreground text-lg" data-testid="text-landing-subtitle">
              {localUser ? (
                <>Hola, <span className="font-semibold text-slate-700">{localUser.username}</span>!</>
              ) : (
                "Elige cómo quieres empezar a gestionar tus partidos."
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* My Matches Section */}
            {activeMatches.length > 0 && (
              <Card className="border-2 border-orange-200 bg-orange-50/50">
                <CardHeader className="py-3 pb-2">
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-orange-700 flex items-center gap-2">
                    <Timer className="w-4 h-4" />
                    Mis Marcadores ({activeMatches.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pb-4">
                  {activeMatches.map((match) => (
                    <div 
                      key={match.id} 
                      className="flex items-center gap-3 p-3 bg-white rounded-lg border shadow-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {match.status === MATCH_STATUS.FINISHED ? (
                            <CheckCircle className="w-3.5 h-3.5 text-slate-400" />
                          ) : (
                            <Play className="w-3.5 h-3.5 text-green-500 fill-green-500" />
                          )}
                          <span className="text-[10px] font-bold uppercase text-slate-500" data-testid={`text-match-status-${match.id}`}>
                            {match.status === MATCH_STATUS.FINISHED ? "Finalizado" : "En juego"}
                          </span>
                        </div>
                        <p className="font-bold text-sm truncate" data-testid={`text-match-teams-${match.id}`}>
                          {match.localTeam} vs {match.awayTeam}
                        </p>
                        <p className="font-mono text-lg font-black text-primary" data-testid={`text-match-score-${match.id}`}>
                          {match.localScore} - {match.awayScore}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Link href={`/match/${match.id}/admin`}>
                          <Button size="sm" className="text-[10px] font-bold uppercase" data-testid={`button-manage-match-${match.id}`}>
                            Gestionar
                          </Button>
                        </Link>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-[10px] text-muted-foreground"
                          onClick={() => hideMatch(match.id)}
                          data-testid={`button-hide-match-${match.id}`}
                        >
                          <X className="w-3 h-3 mr-1" />
                          Quitar
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-[10px] text-destructive"
                          onClick={() => removeMatch(match.id)}
                          disabled={deletingId === match.id}
                          data-testid={`button-delete-match-${match.id}`}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          {deletingId === match.id ? "Borrando..." : "Borrar"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {isAnyAuthenticated ? (
              <>
                <Card 
                  className="hover-elevate cursor-pointer border-2 border-green-300 hover:border-green-500 bg-green-50 transition-all group overflow-hidden shadow-md hover:shadow-lg" 
                  onClick={() => setView("registered")}
                  data-testid="card-create-registered"
                >
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center group-hover:bg-green-500 group-hover:text-white transition-all duration-300 shadow-inner">
                      <Shield className="w-7 h-7 text-green-600 group-hover:text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-xl group-hover:text-green-600 transition-colors">Crear Partido</h3>
                      <p className="text-sm text-muted-foreground">Usa tus equipos guardados y guarda historial.</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center group-hover:bg-green-500 group-hover:translate-x-1 transition-all duration-300">
                      <ArrowRight className="w-6 h-6 text-green-500 group-hover:text-white" />
                    </div>
                  </CardContent>
                </Card>
                <Link href="/dashboard">
                  <Card 
                    className="hover-elevate cursor-pointer border-2 border-blue-300 hover:border-blue-500 bg-blue-50 transition-all group overflow-hidden shadow-md hover:shadow-lg" 
                    data-testid="card-dashboard"
                  >
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-all duration-300 shadow-inner">
                        <LayoutDashboard className="w-7 h-7 text-blue-600 group-hover:text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-xl group-hover:text-blue-600 transition-colors">Mi Panel de Control</h3>
                        <p className="text-sm text-muted-foreground">Gestiona tus partidos, equipos e historial.</p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500 group-hover:translate-x-1 transition-all duration-300">
                        <ArrowRight className="w-6 h-6 text-blue-500 group-hover:text-white" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
                {isSuperAdmin && (
                  <Link href="/admin">
                    <Card 
                      className="hover-elevate cursor-pointer border-2 border-purple-300 hover:border-purple-500 bg-purple-50 transition-all group overflow-hidden shadow-md hover:shadow-lg" 
                      data-testid="card-admin-panel"
                    >
                      <CardContent className="p-6 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center group-hover:bg-purple-500 group-hover:text-white transition-all duration-300 shadow-inner">
                          <Settings className="w-7 h-7 text-purple-600 group-hover:text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-xl group-hover:text-purple-600 transition-colors">Administrar MarcadorLIVE</h3>
                          <p className="text-sm text-muted-foreground">Panel de control del sistema.</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500 group-hover:translate-x-1 transition-all duration-300">
                          <ArrowRight className="w-6 h-6 text-purple-500 group-hover:text-white" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                )}
                
                <Link href="/widget-embed">
                  <Card 
                    className="hover-elevate cursor-pointer border-2 border-cyan-300 hover:border-cyan-500 bg-cyan-50 transition-all group overflow-hidden shadow-md hover:shadow-lg" 
                    data-testid="card-widget-embed"
                  >
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-cyan-100 flex items-center justify-center group-hover:bg-cyan-500 group-hover:text-white transition-all duration-300 shadow-inner">
                        <Code className="w-7 h-7 text-cyan-600 group-hover:text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-xl group-hover:text-cyan-600 transition-colors">Widget Web</h3>
                        <p className="text-sm text-muted-foreground">Muestra partidos en tu web.</p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500 group-hover:translate-x-1 transition-all duration-300">
                        <ArrowRight className="w-6 h-6 text-cyan-500 group-hover:text-white" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </>
            ) : (
              <>
                <Card 
                  className="hover-elevate cursor-pointer border-2 border-slate-200 hover:border-primary bg-white transition-all group overflow-hidden shadow-md hover:shadow-lg" 
                  onClick={() => setView("guest")}
                  data-testid="card-guest-mode"
                >
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 shadow-inner">
                      <User className="w-7 h-7" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-xl group-hover:text-primary transition-colors">Usar como Invitado</h3>
                      <p className="text-sm text-muted-foreground">Crea un marcador rápido sin registro.</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:translate-x-1 transition-all duration-300">
                      <ArrowRight className="w-6 h-6 text-primary group-hover:text-white" />
                    </div>
                  </CardContent>
                </Card>
                <Link href="/registro">
                  <Card 
                    className="hover-elevate cursor-pointer border-2 border-green-200 hover:border-green-500 bg-green-50/50 transition-all group overflow-hidden shadow-md hover:shadow-lg" 
                    data-testid="card-register"
                  >
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center group-hover:bg-green-500 group-hover:text-white transition-all duration-300 shadow-inner">
                        <UserPlus className="w-7 h-7 text-green-600 group-hover:text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-xl group-hover:text-green-600 transition-colors">Crear una cuenta</h3>
                        <p className="text-sm text-muted-foreground">Guarda tus marcadores y estadísticas para siempre.</p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center group-hover:bg-green-500 group-hover:translate-x-1 transition-all duration-300">
                        <ArrowRight className="w-6 h-6 text-green-500 group-hover:text-white" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
                <Link href="/login">
                  <Card 
                    className="hover-elevate cursor-pointer border-2 border-slate-200 hover:border-primary bg-white transition-all group overflow-hidden shadow-md hover:shadow-lg" 
                    data-testid="card-login"
                  >
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all duration-300 shadow-inner">
                        <LogIn className="w-7 h-7 text-slate-600 group-hover:text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-xl group-hover:text-primary transition-colors">Entrar en mi cuenta</h3>
                        <p className="text-sm text-muted-foreground">Ya tengo cuenta, quiero iniciar sesión.</p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:translate-x-1 transition-all duration-300">
                        <ArrowRight className="w-6 h-6 text-primary group-hover:text-white" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>

                <div className="rounded-xl bg-green-600 p-5 shadow-md" data-testid="card-benefits">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white mb-4">Ventajas de registrarte</h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-white/20 backdrop-blur-sm rounded-lg border border-white/30">
                      <div className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Shield className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-white">Organiza tus partidos</p>
                        <p className="text-xs text-green-100">Crea carpetas para diferentes ligas, torneos o temporadas</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-white/20 backdrop-blur-sm rounded-lg border border-white/30">
                      <div className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Timer className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-white">Historial completo</p>
                        <p className="text-xs text-green-100">Accede a todos tus partidos pasados y estadísticas</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-white/20 backdrop-blur-sm rounded-lg border border-white/30">
                      <div className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Share2 className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-white">Sincronizado</p>
                        <p className="text-xs text-green-100">Accede desde cualquier dispositivo con tu cuenta</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-white/20 backdrop-blur-sm rounded-lg border border-white/30">
                      <div className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-white">Logros y recompensas</p>
                        <p className="text-xs text-green-100">Desbloquea funcionalidades premium con tu actividad</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-white/20 backdrop-blur-sm rounded-lg border border-white/30">
                      <div className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Settings className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-white">Delega la gestión</p>
                        <p className="text-xs text-green-100">Comparte el control del marcador con otros delegados</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === "registered") {
    return (
      <div className="min-h-screen w-full bg-slate-50 flex flex-col items-center justify-center p-4 md:p-8">
        {sharePopup}
        <div className="w-full max-w-lg space-y-8">
          
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
              <h1 className="text-4xl font-black tracking-tight text-slate-900 uppercase">
                Marcador<span className="text-primary">LIVE</span>
              </h1>
            </div>
            <p className="text-muted-foreground text-lg">
              Hola, {user?.firstName || 'Usuario'}! Crea tu partido.
            </p>
          </div>

          <Card className="border-0 shadow-xl overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-primary" />
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-green-500" />
                  Nuevo Partido
                </CardTitle>
                <CardDescription>Se guardará en tu historial.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={(e) => { e.preventDefault(); handleRegisteredSubmit(); }} className="space-y-6">
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <FormLabel className="font-bold text-slate-700 uppercase text-[10px] tracking-widest">EQUIPO LOCAL</FormLabel>
                      <Select value={localTeamSelection} onValueChange={setLocalTeamSelection}>
                        <SelectTrigger data-testid="select-local-team">
                          <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Escribir nombre</SelectItem>
                          {savedTeams.map(team => (
                            <SelectItem key={team.id} value={team.id.toString()}>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color || "#1e40af" }} />
                                {team.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {localTeamSelection === "manual" && (
                        <FormField
                          control={form.control}
                          name="localTeam"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input placeholder="Ej. Tigres" className="font-bold" {...field} data-testid="input-local-team" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

                    <div className="space-y-2">
                      <FormLabel className="font-bold text-slate-700 uppercase text-[10px] tracking-widest">EQUIPO VISITANTE</FormLabel>
                      <Select value={awayTeamSelection} onValueChange={setAwayTeamSelection}>
                        <SelectTrigger data-testid="select-away-team">
                          <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Escribir nombre</SelectItem>
                          {savedTeams.map(team => (
                            <SelectItem key={team.id} value={team.id.toString()}>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color || "#1e40af" }} />
                                {team.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {awayTeamSelection === "manual" && (
                        <FormField
                          control={form.control}
                          name="awayTeam"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input placeholder="Ej. Leones" className="font-bold" {...field} data-testid="input-away-team" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <FormLabel className="font-bold text-slate-700 uppercase text-[10px] tracking-widest">CATEGORÍA (opcional)</FormLabel>
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input placeholder="Ej. Pre Benjamín" {...field} value={field.value || ""} data-testid="input-category" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="space-y-1">
                      <FormLabel className="font-bold text-slate-700 uppercase text-[10px] tracking-widest">LIGA (opcional)</FormLabel>
                      <FormField
                        control={form.control}
                        name="league"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input placeholder="Ej. 2ª Andaluza" {...field} value={field.value || ""} data-testid="input-league" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <FormLabel className="font-bold text-slate-700 uppercase text-[10px] tracking-widest">HORA (opcional)</FormLabel>
                      <FormField
                        control={form.control}
                        name="scheduledTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input placeholder="Ej. 10:30" {...field} value={field.value || ""} data-testid="input-scheduled-time" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="space-y-1">
                      <FormLabel className="font-bold text-slate-700 uppercase text-[10px] tracking-widest">CAMPO (opcional)</FormLabel>
                      <FormField
                        control={form.control}
                        name="venue"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input placeholder="Ej. Campo Municipal" {...field} value={field.value || ""} data-testid="input-venue" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <Button 
                      type="submit" 
                      className="w-full text-lg font-bold shadow-lg shadow-green-500/25 transition-all uppercase tracking-tight bg-green-500"
                      size="lg"
                      disabled={createUserMatch.isPending}
                      data-testid="button-create-match-registered"
                    >
                      {createUserMatch.isPending ? "Preparando marcador..." : "Crear Nuevo Partido"}
                      {!createUserMatch.isPending && <ArrowRight className="ml-2 w-5 h-5" />}
                    </Button>
                    
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="sm"
                      className="w-full text-slate-500 font-bold"
                      onClick={() => setView("choice")}
                      data-testid="button-back-registered"
                    >
                      ← VOLVER
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          <div className="text-center text-sm text-slate-400">
            <p>© {new Date().getFullYear()} MarcadorLIVE</p>
          </div>
        </div>
      </div>
    );
  }

  // Guest view (default)
  return (
    <div className="min-h-screen w-full bg-slate-50 flex flex-col items-center justify-center p-4 md:p-8">
      {sharePopup}
      <div className="w-full max-w-lg space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
            <h1 className="text-4xl font-black tracking-tight text-slate-900 uppercase">
              Marcador<span className="text-primary">LIVE</span>
            </h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Modo Invitado: Crea tu marcador ahora.
          </p>
        </div>

        {/* Create Card */}
        <Card className="border-0 shadow-xl overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Nuevo Partido
              </CardTitle>
              <CardDescription>Controla el marcador en tiempo real.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="localTeam"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold text-slate-700 uppercase text-[10px] tracking-widest">EQUIPO LOCAL</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej. Tigres" className="font-bold" {...field} data-testid="input-local-team-guest" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="awayTeam"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold text-slate-700 uppercase text-[10px] tracking-widest">EQUIPO VISITANTE</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej. Leones" className="font-bold" {...field} data-testid="input-away-team-guest" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="adminPin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold text-slate-700 uppercase text-[10px] tracking-widest">PIN ADMIN (4 Dígitos)</FormLabel>
                      <FormControl>
                        <Input 
                          type="password"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={4} 
                          placeholder="••••" 
                          className="text-center text-2xl tracking-widest font-mono"
                          data-testid="input-admin-pin-guest"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-[10px] text-muted-foreground mt-2 italic leading-tight">
                        Importante: El PIN es necesario para actualizar el marcador. Si lo olvidas y cambias de dispositivo, no podrás recuperar el control del partido.
                      </p>
                    </FormItem>
                  )}
                />

                <div className="space-y-3 pt-2">
                  <Button 
                    type="submit" 
                    size="lg"
                    className="w-full text-lg font-bold shadow-lg shadow-primary/25 transition-all uppercase tracking-tight"
                    disabled={createMatch.isPending}
                    data-testid="button-create-match-guest"
                  >
                    {createMatch.isPending ? "Preparando marcador..." : "Crear Nuevo Partido"}
                    {!createMatch.isPending && <ArrowRight className="ml-2 w-5 h-5" />}
                  </Button>
                  
                  <Button 
                    type="button"
                    variant="ghost" 
                    size="sm"
                    className="w-full text-slate-500 font-bold"
                    onClick={() => setView("choice")}
                    data-testid="button-back-guest"
                  >
                    ← VOLVER
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-slate-400">
          <p>© {new Date().getFullYear()} MarcadorLIVE</p>
        </div>
      </div>
    </div>
  );
}
