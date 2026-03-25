import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, Calendar, Users, Plus, Play, Trash2, KeyRound, Radio, ExternalLink, Pencil } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Link } from "wouter";
import type { Club, ClubTeam, ClubDelegate, ClubMatchday, ClubPlayer } from "@shared/schema";

interface DelegateData {
  delegate: ClubDelegate;
  teams: ClubTeam[];
  club: Club;
}

export default function ClubDelegatePanel() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [delegateToken, setDelegateToken] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<ClubTeam | null>(null);
  const [showMatchdayForm, setShowMatchdayForm] = useState(false);
  const [showEditMatchdayForm, setShowEditMatchdayForm] = useState(false);
  const [editingMatchday, setEditingMatchday] = useState<ClubMatchday | null>(null);
  const [showChangePinForm, setShowChangePinForm] = useState(false);
  const [showPlayerForm, setShowPlayerForm] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [matchdayForm, setMatchdayForm] = useState({ rival: "", date: "", time: "", venue: "", isHome: true, matchdayNumber: 1 });
  const [editMatchdayForm, setEditMatchdayForm] = useState({ rival: "", date: "", time: "", venue: "", isHome: true, matchdayNumber: 1 });
  const [playerForm, setPlayerForm] = useState({ name: "", number: "" });

  useEffect(() => {
    const saved = localStorage.getItem(`delegate_token_${slug}`);
    if (saved) setDelegateToken(saved);
  }, [slug]);

  const handleLogin = async () => {
    setLoggingIn(true);
    setLoginError("");
    try {
      const res = await fetch(`/api/club/${slug}/delegate-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.message || "PIN incorrecto");
        return;
      }
      localStorage.setItem(`delegate_token_${slug}`, data.token);
      setDelegateToken(data.token);
    } catch {
      setLoginError("Error de conexión");
    } finally {
      setLoggingIn(false);
    }
  };

  const delegateFetch = async (url: string) => {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${delegateToken}` },
    });
    if (res.status === 401) {
      localStorage.removeItem(`delegate_token_${slug}`);
      setDelegateToken(null);
      throw new Error("Sesión expirada");
    }
    if (!res.ok) throw new Error("Error");
    return res.json();
  };

  const { data: delegateData, isLoading } = useQuery<DelegateData>({
    queryKey: ["/api/delegate/my-data", delegateToken],
    queryFn: () => delegateFetch("/api/delegate/my-data"),
    enabled: !!delegateToken,
  });

  const { data: matchdays } = useQuery<ClubMatchday[]>({
    queryKey: ["/api/delegate/teams", selectedTeam?.id, "matchdays"],
    queryFn: () => delegateFetch(`/api/delegate/teams/${selectedTeam!.id}/matchdays`),
    enabled: !!delegateToken && !!selectedTeam,
  });

  const { data: players } = useQuery<ClubPlayer[]>({
    queryKey: ["/api/delegate/teams", selectedTeam?.id, "players"],
    queryFn: () => delegateFetch(`/api/delegate/teams/${selectedTeam!.id}/players`),
    enabled: !!delegateToken && !!selectedTeam,
  });

  const createMatchdayMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await fetch("/api/delegate/matchdays", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${delegateToken}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delegate/teams", selectedTeam?.id, "matchdays"] });
      setShowMatchdayForm(false);
      toast({ title: "Jornada creada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const editMatchdayMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: any }) => {
      const res = await fetch(`/api/delegate/matchdays/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${delegateToken}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delegate/teams", selectedTeam?.id, "matchdays"] });
      setShowEditMatchdayForm(false);
      setEditingMatchday(null);
      toast({ title: "Jornada actualizada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const broadcastMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/delegate/matchdays/${id}/broadcast`, {
        method: "POST",
        headers: { Authorization: `Bearer ${delegateToken}` },
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/delegate/teams", selectedTeam?.id, "matchdays"] });
      toast({ title: "Partido emitido en directo" });
      if (data.match?.id) {
        setLocation(`/match/${data.match.id}/admin?delegateToken=${delegateToken}`);
      }
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const changePinMutation = useMutation({
    mutationFn: async (newPinVal: string) => {
      const res = await fetch("/api/delegate/change-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${delegateToken}` },
        body: JSON.stringify({ newPin: newPinVal }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      return res.json();
    },
    onSuccess: () => {
      setShowChangePinForm(false);
      setNewPin("");
      toast({ title: "PIN cambiado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createPlayerMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await fetch(`/api/delegate/teams/${selectedTeam!.id}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${delegateToken}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delegate/teams", selectedTeam?.id, "players"] });
      setShowPlayerForm(false);
      setPlayerForm({ name: "", number: "" });
      toast({ title: "Jugador añadido" });
    },
  });

  if (!delegateToken) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <Lock className="w-12 h-12 mx-auto text-primary mb-2" />
            <CardTitle>Acceso delegado</CardTitle>
            <p className="text-sm text-muted-foreground">Introduce tu PIN de 4 dígitos</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="text-center text-2xl tracking-widest"
              placeholder="····"
              data-testid="input-delegate-pin"
              onKeyDown={(e) => e.key === "Enter" && pin.length === 4 && handleLogin()}
            />
            {loginError && <p className="text-sm text-destructive text-center">{loginError}</p>}
            <Button
              className="w-full"
              onClick={handleLogin}
              disabled={pin.length !== 4 || loggingIn}
              data-testid="button-delegate-login"
            >
              {loggingIn && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Entrar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !delegateData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const { delegate, teams, club } = delegateData;

  const getMatchStatusLabel = (md: any): string => {
    if (!md.matchId) return "Programado";
    const status = md.matchStatus;
    switch (status) {
      case "scheduled": return "Programado";
      case "first_half": return "1ª Parte";
      case "halftime": return "Descanso";
      case "second_half": return "2ª Parte";
      case "finished": return "Terminado";
      default: return "Programado";
    }
  };

  if (!selectedTeam && teams.length > 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 max-w-md">
          <div className="text-center mb-6">
            <div
              className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-white font-bold text-lg mb-2"
              style={{ backgroundColor: club.primaryColor || "#1e3a5f" }}
            >
              {club.name.substring(0, 2).toUpperCase()}
            </div>
            <h1 className="text-xl font-bold">{club.name}</h1>
            <p className="text-sm text-muted-foreground">Hola, {delegate.name}</p>
          </div>
          <div className="space-y-3">
            {teams.map((team) => (
              <Card
                key={team.id}
                className="cursor-pointer hover-elevate transition-all"
                onClick={() => setSelectedTeam(team)}
                data-testid={`card-select-team-${team.id}`}
              >
                <CardContent className="pt-4 pb-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full" style={{ backgroundColor: team.color || "#1e3a5f" }} />
                  <div>
                    <p className="font-medium">{team.name}</p>
                    <p className="text-sm text-muted-foreground">{team.category}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setShowChangePinForm(true)} data-testid="button-change-pin">
              <KeyRound className="w-4 h-4 mr-1" />Cambiar PIN
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                localStorage.removeItem(`delegate_token_${slug}`);
                setDelegateToken(null);
                setPin("");
              }}
              data-testid="button-delegate-logout"
            >
              Salir
            </Button>
          </div>

          <Dialog open={showChangePinForm} onOpenChange={setShowChangePinForm}>
            <DialogContent>
              <DialogHeader><DialogTitle>Cambiar PIN</DialogTitle></DialogHeader>
              <div>
                <Label>Nuevo PIN (4 dígitos)</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="text-center text-xl tracking-widest"
                  data-testid="input-new-pin"
                />
              </div>
              <DialogFooter>
                <Button onClick={() => changePinMutation.mutate(newPin)} disabled={newPin.length !== 4 || changePinMutation.isPending} data-testid="button-submit-pin">
                  Cambiar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedTeam(null)} data-testid="button-back-teams">
              ← 
            </Button>
            <div>
              <h1 className="text-lg font-bold">{selectedTeam?.name}</h1>
              <p className="text-xs text-muted-foreground">{selectedTeam?.category} · {delegate.name}</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="w-4 h-4" />Jornadas
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => { setMatchdayForm({ rival: "", date: "", time: "", venue: "", isHome: true, matchdayNumber: 1 }); setShowMatchdayForm(true); }} data-testid="button-add-matchday-delegate">
                <Plus className="w-4 h-4 mr-1" />Añadir
              </Button>
            </CardHeader>
            <CardContent>
              {!matchdays || matchdays.length === 0 ? (
                <p className="text-center text-muted-foreground py-4 text-sm">No hay jornadas</p>
              ) : (
                <div className="space-y-2">
                  {matchdays.map((md) => (
                    <div key={md.id} className="p-3 border rounded-lg text-sm space-y-2" data-testid={`delegate-matchday-${md.id}`}>
                      <p className="font-medium">
                        {md.isHome ? `${selectedTeam?.name} vs ${md.rival}` : `${md.rival} vs ${selectedTeam?.name}`}
                      </p>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-xs text-muted-foreground">
                          J{md.matchdayNumber} · {md.date ? new Date(md.date).toLocaleDateString("es-ES") : "?"} {md.time || ""}
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingMatchday(md);
                              setEditMatchdayForm({
                                rival: md.rival,
                                date: md.date ? new Date(md.date).toISOString().split("T")[0] : "",
                                time: md.time || "",
                                venue: md.venue || "",
                                isHome: md.isHome,
                                matchdayNumber: md.matchdayNumber,
                              });
                              setShowEditMatchdayForm(true);
                            }}
                            data-testid={`button-delegate-edit-matchday-${md.id}`}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                          {!md.matchId && (
                            <Button
                              size="sm"
                              onClick={() => broadcastMutation.mutate(md.id)}
                              disabled={broadcastMutation.isPending}
                              data-testid={`button-delegate-broadcast-${md.id}`}
                              className="gap-1"
                            >
                              <Radio className="w-3 h-3" />
                              Retransmitir
                            </Button>
                          )}
                          {md.matchId && (
                            <Link href={`/match/${md.matchId}/admin?delegateToken=${delegateToken}`}>
                              <Button variant="outline" size="sm" data-testid={`button-delegate-manage-${md.id}`} className="gap-1">
                                <ExternalLink className="w-3 h-3" />
                                Gestionar
                              </Button>
                            </Link>
                          )}
                          <Badge variant={md.matchId && (md as any).matchStatus === "finished" ? "secondary" : md.matchId ? "default" : "outline"}>
                            {getMatchStatusLabel(md)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4" />Plantilla
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => { setPlayerForm({ name: "", number: "" }); setShowPlayerForm(true); }} data-testid="button-add-player-delegate">
                <Plus className="w-4 h-4 mr-1" />Añadir
              </Button>
            </CardHeader>
            <CardContent>
              {!players || players.length === 0 ? (
                <p className="text-center text-muted-foreground py-4 text-sm">No hay jugadores</p>
              ) : (
                <div className="space-y-1">
                  {players.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-2 text-sm">
                      <div className="flex items-center gap-2">
                        {p.number && <Badge variant="outline" className="text-xs">{p.number}</Badge>}
                        <span>{p.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog open={showMatchdayForm} onOpenChange={setShowMatchdayForm}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nueva jornada</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Rival</Label>
                <Input value={matchdayForm.rival} onChange={(e) => setMatchdayForm({ ...matchdayForm, rival: e.target.value })} placeholder="Equipo rival" data-testid="input-delegate-rival" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label>Fecha</Label>
                  <Input type="date" value={matchdayForm.date} onChange={(e) => setMatchdayForm({ ...matchdayForm, date: e.target.value })} />
                </div>
                <div className="flex-1">
                  <Label>Hora</Label>
                  <Input type="time" value={matchdayForm.time} onChange={(e) => setMatchdayForm({ ...matchdayForm, time: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Lugar</Label>
                <Input value={matchdayForm.venue} onChange={(e) => setMatchdayForm({ ...matchdayForm, venue: e.target.value })} placeholder="Campo" />
              </div>
              <div className="flex items-center gap-3">
                <Label>Local</Label>
                <Switch checked={matchdayForm.isHome} onCheckedChange={(v) => setMatchdayForm({ ...matchdayForm, isHome: v })} />
              </div>
              <div>
                <Label>Jornada nº</Label>
                <Input type="number" min={1} value={matchdayForm.matchdayNumber} onChange={(e) => setMatchdayForm({ ...matchdayForm, matchdayNumber: Number(e.target.value) })} />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => createMatchdayMutation.mutate({
                  ...matchdayForm,
                  teamId: selectedTeam!.id,
                })}
                disabled={!matchdayForm.rival || createMatchdayMutation.isPending}
                data-testid="button-delegate-submit-matchday"
              >
                Crear jornada
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showPlayerForm} onOpenChange={setShowPlayerForm}>
          <DialogContent>
            <DialogHeader><DialogTitle>Añadir jugador</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nombre</Label>
                <Input value={playerForm.name} onChange={(e) => setPlayerForm({ ...playerForm, name: e.target.value })} placeholder="Nombre del jugador" data-testid="input-delegate-player-name" />
              </div>
              <div>
                <Label>Dorsal</Label>
                <Input value={playerForm.number} onChange={(e) => setPlayerForm({ ...playerForm, number: e.target.value })} placeholder="#" data-testid="input-delegate-player-number" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => createPlayerMutation.mutate(playerForm)} disabled={!playerForm.name || createPlayerMutation.isPending} data-testid="button-delegate-submit-player">
                Añadir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showEditMatchdayForm} onOpenChange={(open) => { if (!open) { setShowEditMatchdayForm(false); setEditingMatchday(null); } }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Editar jornada</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Rival</Label>
                <Input value={editMatchdayForm.rival} onChange={(e) => setEditMatchdayForm({ ...editMatchdayForm, rival: e.target.value })} placeholder="Equipo rival" data-testid="input-delegate-edit-rival" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label>Fecha</Label>
                  <Input type="date" value={editMatchdayForm.date} onChange={(e) => setEditMatchdayForm({ ...editMatchdayForm, date: e.target.value })} data-testid="input-delegate-edit-date" />
                </div>
                <div className="flex-1">
                  <Label>Hora</Label>
                  <Input type="time" value={editMatchdayForm.time} onChange={(e) => setEditMatchdayForm({ ...editMatchdayForm, time: e.target.value })} data-testid="input-delegate-edit-time" />
                </div>
              </div>
              <div>
                <Label>Lugar</Label>
                <Input value={editMatchdayForm.venue} onChange={(e) => setEditMatchdayForm({ ...editMatchdayForm, venue: e.target.value })} placeholder="Campo" data-testid="input-delegate-edit-venue" />
              </div>
              <div className="flex items-center gap-3">
                <Label>Local</Label>
                <Switch checked={editMatchdayForm.isHome} onCheckedChange={(v) => setEditMatchdayForm({ ...editMatchdayForm, isHome: v })} />
              </div>
              <div>
                <Label>Jornada nº</Label>
                <Input type="number" min={1} value={editMatchdayForm.matchdayNumber} onChange={(e) => setEditMatchdayForm({ ...editMatchdayForm, matchdayNumber: Number(e.target.value) })} data-testid="input-delegate-edit-matchday-number" />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => editingMatchday && editMatchdayMutation.mutate({ id: editingMatchday.id, body: editMatchdayForm })}
                disabled={!editMatchdayForm.rival || editMatchdayMutation.isPending}
                data-testid="button-delegate-save-matchday"
              >
                Guardar cambios
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
