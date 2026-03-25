import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import { Loader2, ArrowLeft, Users, Calendar, Handshake, UserCheck, Plus, Trash2, Edit, Play, Shield, Lock, Sparkles, Palette, X, Filter, RotateCcw, Upload, ImageIcon } from "lucide-react";
import type { Club, ClubTeam, ClubDelegate, ClubMatchday, ClubSponsor, ClubPlayer, ClubBranch } from "@shared/schema";
import { CLUB_CATEGORIES } from "@shared/schema";
import { ChronicleConfigTab } from "@/components/ChronicleConfigTab";
import { TemplateConfigTab } from "@/components/TemplateConfigTab";
import { WeeklyScheduleImage } from "@/components/WeeklyScheduleImage";

interface ClubAdminData {
  club: Club;
  teams: ClubTeam[];
  delegates: ClubDelegate[];
  matchdays: ClubMatchday[];
  sponsors: ClubSponsor[];
  branches: ClubBranch[];
}

type TabView = "teams" | "delegates" | "matchdays" | "sponsors" | "chronicles" | "templates";

function getMatchStatusLabel(md: any): string {
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
}

function MatchdayFilters({ teams, matchdays, mdFilterCategory, setMdFilterCategory, mdFilterLeague, setMdFilterLeague, mdFilterTeam, setMdFilterTeam, mdFilterMatchday, setMdFilterMatchday, mdFilterDate, setMdFilterDate, broadcastMutation, deleteMatchdayMutation, updateMatchdayMutation, slug }: {
  teams: ClubTeam[];
  matchdays: ClubMatchday[];
  mdFilterCategory: string;
  setMdFilterCategory: (v: string) => void;
  mdFilterLeague: string;
  setMdFilterLeague: (v: string) => void;
  mdFilterTeam: string;
  setMdFilterTeam: (v: string) => void;
  mdFilterMatchday: string;
  setMdFilterMatchday: (v: string) => void;
  mdFilterDate: string;
  setMdFilterDate: (v: string) => void;
  broadcastMutation: any;
  deleteMatchdayMutation: any;
  updateMatchdayMutation: any;
  slug: string;
}) {
  const [editingMatchday, setEditingMatchday] = useState<ClubMatchday | null>(null);
  const [editForm, setEditForm] = useState({ rival: "", date: "", time: "", venue: "", isHome: true, matchdayNumber: 1 });

  const uniqueCategories = [...new Set(teams.map(t => t.category).filter(Boolean))];
  const filteredTeamsByCategory = mdFilterCategory ? teams.filter(t => t.category === mdFilterCategory) : teams;
  const uniqueLeagues = [...new Set(filteredTeamsByCategory.map(t => t.league).filter(Boolean))] as string[];
  const uniqueMatchdays = [...new Set(matchdays.map(m => m.matchdayNumber).filter(Boolean))].sort((a, b) => (a ?? 0) - (b ?? 0));
  const hasAnyFilter = mdFilterCategory || mdFilterLeague || mdFilterTeam || mdFilterMatchday || mdFilterDate;

  const clearFilters = () => { setMdFilterCategory(""); setMdFilterLeague(""); setMdFilterTeam(""); setMdFilterMatchday(""); setMdFilterDate(""); };

  const filtered = matchdays.filter(md => {
    const team = teams.find(t => t.id === md.teamId);
    if (mdFilterCategory && team?.category !== mdFilterCategory) return false;
    if (mdFilterLeague && team?.league !== mdFilterLeague) return false;
    if (mdFilterTeam && md.teamId !== Number(mdFilterTeam)) return false;
    if (mdFilterMatchday && md.matchdayNumber !== Number(mdFilterMatchday)) return false;
    if (mdFilterDate) {
      if (!md.date) return false;
      const d = new Date(md.date);
      const mdDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (mdDate !== mdFilterDate) return false;
    }
    return true;
  });

  return (
    <CardContent>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mb-4" data-testid="matchday-filters">
        <Select value={mdFilterCategory} onValueChange={(v) => { setMdFilterCategory(v); setMdFilterTeam(""); setMdFilterLeague(""); }}>
          <SelectTrigger data-testid="filter-category" className="h-9 text-sm">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            {uniqueCategories.map(c => (
              <SelectItem key={c} value={c!}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={mdFilterLeague} onValueChange={setMdFilterLeague}>
          <SelectTrigger data-testid="filter-league" className="h-9 text-sm">
            <SelectValue placeholder="Division" />
          </SelectTrigger>
          <SelectContent>
            {uniqueLeagues.map(l => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={mdFilterTeam} onValueChange={setMdFilterTeam}>
          <SelectTrigger data-testid="filter-team" className="h-9 text-sm">
            <SelectValue placeholder="Equipo" />
          </SelectTrigger>
          <SelectContent>
            {teams.filter(t => !mdFilterCategory || t.category === mdFilterCategory).map(t => (
              <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={mdFilterMatchday} onValueChange={setMdFilterMatchday}>
          <SelectTrigger data-testid="filter-matchday-number" className="h-9 text-sm">
            <SelectValue placeholder="Jornada" />
          </SelectTrigger>
          <SelectContent>
            {uniqueMatchdays.map(n => (
              <SelectItem key={n} value={String(n)}>J{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1">
          <Input
            type="date"
            value={mdFilterDate}
            onChange={(e) => setMdFilterDate(e.target.value)}
            className="h-9 text-sm"
            data-testid="filter-date"
          />
          {hasAnyFilter && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-2 shrink-0"
              onClick={clearFilters}
              data-testid="button-clear-filters"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
      {hasAnyFilter && (
        <p className="text-xs text-muted-foreground mb-3" data-testid="text-filter-count">
          Mostrando {filtered.length} de {matchdays.length} partidos
        </p>
      )}
      {matchdays.length === 0 ? (
        <p className="text-center text-muted-foreground py-6">No hay partidos programados.</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-6">No hay partidos con esos filtros.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((md) => {
            const team = teams.find(t => t.id === md.teamId);
            return (
              <div key={md.id} className="p-3 border rounded-lg space-y-2" data-testid={`matchday-row-${md.id}`}>
                <div className="flex items-center gap-2">
                  <p className="font-medium flex-1">
                    {md.isHome ? `${team?.name || "?"} vs ${md.rival}` : `${md.rival} vs ${team?.name || "?"}`}
                  </p>
                  {team?.category && <Badge variant="secondary" className="text-xs">{team.category}</Badge>}
                </div>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-xs text-muted-foreground">
                    J{md.matchdayNumber} · {md.date ? new Date(md.date).toLocaleDateString("es-ES") : "Sin fecha"} {md.time || ""} · {md.venue || "Sin lugar"}
                    {team?.league ? ` · ${team.league}` : ""}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant={(md as any).matchStatus === "finished" ? "secondary" : md.matchId ? "default" : "outline"}>
                      {getMatchStatusLabel(md)}
                    </Badge>
                    {!md.matchId && md.status !== "played" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => broadcastMutation.mutate(md.id)}
                        disabled={broadcastMutation.isPending}
                        data-testid={`button-broadcast-${md.id}`}
                      >
                        <Play className="w-3 h-3 mr-1" />Retransmitir
                      </Button>
                    )}
                    {md.matchId && (
                      <Link href={`/match/${md.matchId}/admin`}>
                        <Button variant="outline" size="sm" data-testid={`button-go-match-${md.id}`}>
                          Gestionar
                        </Button>
                      </Link>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid={`button-edit-matchday-${md.id}`}
                      onClick={() => {
                        setEditingMatchday(md);
                        const d = md.date ? new Date(md.date) : null;
                        setEditForm({
                          rival: md.rival,
                          date: d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "",
                          time: md.time || "",
                          venue: md.venue || "",
                          isHome: md.isHome ?? true,
                          matchdayNumber: md.matchdayNumber ?? 1,
                        });
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" data-testid={`button-delete-matchday-${md.id}`}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar partido?</AlertDialogTitle>
                          <AlertDialogDescription>Se eliminará este partido.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMatchdayMutation.mutate(md.id)}>Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Dialog open={!!editingMatchday} onOpenChange={(o) => { if (!o) setEditingMatchday(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar partido</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Rival</Label>
              <Input value={editForm.rival} onChange={(e) => setEditForm({ ...editForm, rival: e.target.value })} placeholder="Equipo rival" data-testid="input-edit-rival" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Fecha</Label>
                <Input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} data-testid="input-edit-date" />
              </div>
              <div>
                <Label>Hora</Label>
                <Input type="time" value={editForm.time} onChange={(e) => setEditForm({ ...editForm, time: e.target.value })} data-testid="input-edit-time" />
              </div>
            </div>
            <div>
              <Label>Lugar</Label>
              <Input value={editForm.venue} onChange={(e) => setEditForm({ ...editForm, venue: e.target.value })} placeholder="Campo municipal" data-testid="input-edit-venue" />
            </div>
            <div className="flex items-center gap-2">
              <Label>Local</Label>
              <Switch checked={editForm.isHome} onCheckedChange={(v) => setEditForm({ ...editForm, isHome: v })} data-testid="switch-edit-home" />
            </div>
            <div>
              <Label>Jornada</Label>
              <Input type="number" min={1} value={editForm.matchdayNumber} onChange={(e) => setEditForm({ ...editForm, matchdayNumber: Number(e.target.value) })} data-testid="input-edit-matchday-number" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMatchday(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (editingMatchday) {
                  updateMatchdayMutation.mutate({ id: editingMatchday.id, body: { ...editForm, date: editForm.date ? new Date(editForm.date) : undefined } });
                  setEditingMatchday(null);
                }
              }}
              disabled={!editForm.rival || updateMatchdayMutation.isPending}
              data-testid="button-save-edit-matchday"
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CardContent>
  );
}

export default function ClubCoordinatorPanel() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabView>("teams");
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [editTeam, setEditTeam] = useState<ClubTeam | null>(null);
  const [showDelegateForm, setShowDelegateForm] = useState(false);
  const [showMatchdayForm, setShowMatchdayForm] = useState(false);
  const [showSponsorForm, setShowSponsorForm] = useState(false);
  const [editSponsor, setEditSponsor] = useState<ClubSponsor | null>(null);
  const [showPlayersFor, setShowPlayersFor] = useState<ClubTeam | null>(null);

  const [teamForm, setTeamForm] = useState({ name: "", category: "", league: "", color: "#1e3a5f", fieldName: "", delegateId: "", sponsorId: "", branchId: "" });
  const [inlineNewDelegate, setInlineNewDelegate] = useState<{ name: string; phone: string } | null>(null);
  const [delegateForm, setDelegateForm] = useState({ name: "", phone: "" });
  const [matchdayForm, setMatchdayForm] = useState({ teamId: "", rival: "", date: "", time: "", venue: "", isHome: true, matchdayNumber: 1 });
  const [sponsorForm, setSponsorForm] = useState({ name: "", description: "", logoUrl: "", websiteUrl: "", tier: "standard" });
  const sponsorLogoInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile: uploadSponsorLogo, isUploading: isUploadingLogo } = useUpload({
    onSuccess: (response) => {
      setSponsorForm(prev => ({ ...prev, logoUrl: response.objectPath }));
    },
    onError: (err) => {
      toast({ title: "Error al subir el logo", description: err.message, variant: "destructive" });
    },
  });
  const [playerForm, setPlayerForm] = useState({ name: "", number: "", position: "" });
  const [mdFilterCategory, setMdFilterCategory] = useState("");
  const [mdFilterLeague, setMdFilterLeague] = useState("");
  const [mdFilterTeam, setMdFilterTeam] = useState("");
  const [mdFilterMatchday, setMdFilterMatchday] = useState("");
  const [mdFilterDate, setMdFilterDate] = useState("");

  const { data, isLoading, error } = useQuery<ClubAdminData>({
    queryKey: ["/api/club", slug, "admin-data"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/club/${slug}/admin-data`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("No autorizado");
      return res.json();
    },
  });

  const createTeamMutation = useMutation({
    mutationFn: (body: any) => apiRequest("POST", `/api/club/${data?.club.id}/teams`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/club", slug, "admin-data"] });
      setShowTeamForm(false);
      setEditTeam(null);
      setTeamForm({ name: "", category: "", league: "", color: "#1e3a5f", fieldName: "", delegateId: "", sponsorId: "", branchId: "" });
      toast({ title: "Equipo guardado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateTeamMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: any }) => apiRequest("PATCH", `/api/club/teams/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/club", slug, "admin-data"] });
      setShowTeamForm(false);
      setEditTeam(null);
      toast({ title: "Equipo actualizado" });
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/club/teams/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/club", slug, "admin-data"] });
      toast({ title: "Equipo eliminado" });
    },
  });

  const createDelegateMutation = useMutation({
    mutationFn: (body: any) => apiRequest("POST", `/api/club/${data?.club.id}/delegates`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/club", slug, "admin-data"] });
      setShowDelegateForm(false);
      setDelegateForm({ name: "", phone: "" });
      toast({ title: "Delegado creado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteDelegateMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/club/delegates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/club", slug, "admin-data"] });
      toast({ title: "Delegado eliminado" });
    },
  });

  const createMatchdayMutation = useMutation({
    mutationFn: (body: any) => apiRequest("POST", `/api/club/${data?.club.id}/matchdays`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/club", slug, "admin-data"] });
      setShowMatchdayForm(false);
      setMatchdayForm({ teamId: "", rival: "", date: "", time: "", venue: "", isHome: true, matchdayNumber: 1 });
      toast({ title: "Jornada creada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMatchdayMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/club/matchdays/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/club", slug, "admin-data"] });
      toast({ title: "Jornada eliminada" });
    },
  });

  const broadcastMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/club/matchdays/${id}/broadcast`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/club", slug, "admin-data"] });
      toast({ title: "Partido en directo", description: "El partido ha sido creado y está en directo." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMatchdayMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: any }) => apiRequest("PATCH", `/api/club/matchdays/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/club", slug, "admin-data"] });
      toast({ title: "Partido actualizado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createSponsorMutation = useMutation({
    mutationFn: (body: any) => apiRequest("POST", `/api/club/${data?.club.id}/sponsors`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/club", slug, "admin-data"] });
      setShowSponsorForm(false);
      setSponsorForm({ name: "", description: "", logoUrl: "", websiteUrl: "", tier: "standard" });
      toast({ title: "Patrocinador creado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateSponsorMutation = useMutation({
    mutationFn: ({ id, ...body }: any) => apiRequest("PATCH", `/api/club/sponsors/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/club", slug, "admin-data"] });
      setShowSponsorForm(false);
      setEditSponsor(null);
      setSponsorForm({ name: "", description: "", logoUrl: "", websiteUrl: "", tier: "standard" });
      toast({ title: "Patrocinador actualizado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteSponsorMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/club/sponsors/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/club", slug, "admin-data"] });
      toast({ title: "Patrocinador eliminado" });
    },
  });

  const { data: players } = useQuery<ClubPlayer[]>({
    queryKey: ["/api/club/teams", showPlayersFor?.id, "players"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/club/teams/${showPlayersFor!.id}/players`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error cargando jugadores");
      return res.json();
    },
    enabled: !!showPlayersFor,
  });

  const createPlayerMutation = useMutation({
    mutationFn: (body: any) => apiRequest("POST", `/api/club/teams/${showPlayersFor!.id}/players`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/club/teams", showPlayersFor?.id, "players"] });
      setPlayerForm({ name: "", number: "", position: "" });
      toast({ title: "Jugador añadido" });
    },
  });

  const deletePlayerMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/club/players/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/club/teams", showPlayersFor?.id, "players"] });
      toast({ title: "Jugador eliminado" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Shield className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground">No tienes acceso a este panel</p>
        <Link href="/login">
          <Button>Iniciar sesión</Button>
        </Link>
      </div>
    );
  }

  const { club, teams, delegates, matchdays, sponsors } = data;

  const openEditTeam = (team: ClubTeam) => {
    setEditTeam(team);
    setTeamForm({
      name: team.name,
      category: team.category,
      league: (team as any).league || "",
      color: team.color || "#1e3a5f",
      fieldName: team.fieldName || "",
      delegateId: team.delegateId ? String(team.delegateId) : "",
      sponsorId: team.sponsorId ? String(team.sponsorId) : "",
      branchId: team.branchId ? String(team.branchId) : "",
    });
    setShowTeamForm(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: club.primaryColor || "#1e3a5f" }}
            >
              {club.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold">{club.name}</h1>
              <p className="text-sm text-muted-foreground">Panel de coordinador</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold">{teams.length}</p>
              <p className="text-xs text-muted-foreground">Equipos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold">{delegates.length}</p>
              <p className="text-xs text-muted-foreground">Delegados</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold">{matchdays.filter(m => m.status === "pending" || m.status === "next").length}</p>
              <p className="text-xs text-muted-foreground">Partidos pendientes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold">{sponsors.length}</p>
              <p className="text-xs text-muted-foreground">Patrocinadores</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabView)} className="space-y-4">
          <div className="space-y-1">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="teams"><Users className="w-4 h-4 mr-1" />Equipos</TabsTrigger>
              <TabsTrigger value="delegates"><UserCheck className="w-4 h-4 mr-1" />Delegados</TabsTrigger>
              <TabsTrigger value="matchdays"><Calendar className="w-4 h-4 mr-1" />Partidos</TabsTrigger>
            </TabsList>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="sponsors"><Handshake className="w-4 h-4 mr-1" />Sponsors</TabsTrigger>
              <TabsTrigger value="templates"><Palette className="w-4 h-4 mr-1" />Plantillas</TabsTrigger>
              <TabsTrigger value="chronicles"><Sparkles className="w-4 h-4 mr-1" />Crónicas</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="teams">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>Equipos del club</CardTitle>
                <Button size="sm" onClick={() => { setEditTeam(null); setTeamForm({ name: club.name, category: "", league: "", color: "#1e3a5f", fieldName: "", delegateId: "", sponsorId: "", branchId: "" }); setShowTeamForm(true); }} data-testid="button-add-team">
                  <Plus className="w-4 h-4 mr-1" />Añadir
                </Button>
              </CardHeader>
              <CardContent>
                {teams.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">No hay equipos. Crea el primero.</p>
                ) : (
                  <div className="space-y-3">
                    {teams.map((team) => {
                      const del = delegates.find(d => d.id === team.delegateId);
                      return (
                        <div key={team.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`team-row-${team.id}`}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full" style={{ backgroundColor: team.color || "#1e3a5f" }} />
                            <div>
                              <p className="font-medium">{team.name}</p>
                              <p className="text-xs text-muted-foreground">{team.category}{(team as any).league ? ` · ${(team as any).league}` : ""}{del ? ` · ${del.name}` : ""}</p>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setShowPlayersFor(team)} data-testid={`button-players-${team.id}`}>
                              <Users className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openEditTeam(team)} data-testid={`button-edit-team-${team.id}`}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" data-testid={`button-delete-team-${team.id}`}>
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Eliminar equipo?</AlertDialogTitle>
                                  <AlertDialogDescription>Se eliminará "{team.name}" y todos sus datos.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteTeamMutation.mutate(team.id)}>Eliminar</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="delegates">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>Delegados</CardTitle>
                <Button size="sm" onClick={() => { setDelegateForm({ name: "", phone: "" }); setShowDelegateForm(true); }} data-testid="button-add-delegate">
                  <Plus className="w-4 h-4 mr-1" />Añadir
                </Button>
              </CardHeader>
              <CardContent>
                {delegates.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">No hay delegados.</p>
                ) : (
                  <div className="space-y-3">
                    {delegates.map((del) => {
                      const assignedTeams = teams.filter(t => t.delegateId === del.id);
                      return (
                        <div key={del.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`delegate-row-${del.id}`}>
                          <div>
                            <p className="font-medium">{del.name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Lock className="w-3 h-3" />
                              <span>PIN: {del.pin}</span>
                              {del.phone && <span>· {del.phone}</span>}
                              {assignedTeams.length > 0 && (
                                <span>· {assignedTeams.map(t => t.name).join(", ")}</span>
                              )}
                            </div>
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" data-testid={`button-delete-delegate-${del.id}`}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar delegado?</AlertDialogTitle>
                                <AlertDialogDescription>Se eliminará "{del.name}".</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteDelegateMutation.mutate(del.id)}>Eliminar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="matchdays">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-2">
                <CardTitle>Partidos</CardTitle>
                <div className="flex items-center gap-2">
                  <WeeklyScheduleImage
                    clubName={club.name}
                    clubPrimaryColor={club.primaryColor || "#1e3a5f"}
                    clubSecondaryColor={club.secondaryColor || "#ffffff"}
                    clubLogoUrl={club.logoUrl}
                    matchdays={matchdays}
                    teams={teams}
                    sponsors={sponsors}
                  />
                  <Button size="sm" onClick={() => { setMatchdayForm({ teamId: teams[0]?.id ? String(teams[0].id) : "", rival: "", date: "", time: "", venue: "", isHome: true, matchdayNumber: 1 }); setShowMatchdayForm(true); }} data-testid="button-add-matchday" disabled={teams.length === 0}>
                    <Plus className="w-4 h-4 mr-1" />Añadir
                  </Button>
                </div>
              </CardHeader>
              <MatchdayFilters
                teams={teams}
                matchdays={matchdays}
                mdFilterCategory={mdFilterCategory}
                setMdFilterCategory={setMdFilterCategory}
                mdFilterLeague={mdFilterLeague}
                setMdFilterLeague={setMdFilterLeague}
                mdFilterTeam={mdFilterTeam}
                setMdFilterTeam={setMdFilterTeam}
                mdFilterMatchday={mdFilterMatchday}
                setMdFilterMatchday={setMdFilterMatchday}
                mdFilterDate={mdFilterDate}
                setMdFilterDate={setMdFilterDate}
                broadcastMutation={broadcastMutation}
                deleteMatchdayMutation={deleteMatchdayMutation}
                updateMatchdayMutation={updateMatchdayMutation}
                slug={slug!}
              />
            </Card>
          </TabsContent>

          <TabsContent value="sponsors">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>Patrocinadores</CardTitle>
                <Button size="sm" onClick={() => { setSponsorForm({ name: "", description: "", logoUrl: "", websiteUrl: "", tier: "standard" }); setShowSponsorForm(true); }} data-testid="button-add-sponsor">
                  <Plus className="w-4 h-4 mr-1" />Añadir
                </Button>
              </CardHeader>
              <CardContent>
                {sponsors.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">No hay patrocinadores.</p>
                ) : (
                  <div className="space-y-3">
                    {sponsors.map((sp) => (
                      <div key={sp.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`sponsor-row-${sp.id}`}>
                        <div className="flex items-center gap-3">
                          {sp.logoUrl ? (
                            <img src={sp.logoUrl} alt={sp.name} className="h-8 w-8 object-contain rounded" />
                          ) : (
                            <div className="h-8 w-8 bg-muted rounded flex items-center justify-center">
                              <ImageIcon className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{sp.name}</p>
                            <p className="text-xs text-muted-foreground">{sp.tier}{sp.websiteUrl ? ` · ${sp.websiteUrl}` : ""}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => {
                            setEditSponsor(sp);
                            setSponsorForm({ name: sp.name, description: sp.description || "", logoUrl: sp.logoUrl || "", websiteUrl: sp.websiteUrl || "", tier: sp.tier || "standard" });
                            setShowSponsorForm(true);
                          }} data-testid={`button-edit-sponsor-${sp.id}`}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" data-testid={`button-delete-sponsor-${sp.id}`}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar patrocinador?</AlertDialogTitle>
                              <AlertDialogDescription>Se eliminará "{sp.name}".</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteSponsorMutation.mutate(sp.id)}>Eliminar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates">
            <TemplateConfigTab
              slug={slug!}
              clubName={club.name}
              primaryColor={club.primaryColor || "#1e3a5f"}
              secondaryColor={club.secondaryColor || "#f59e0b"}
            />
          </TabsContent>

          <TabsContent value="chronicles">
            <ChronicleConfigTab slug={slug!} />
          </TabsContent>
        </Tabs>

        <Dialog open={showTeamForm} onOpenChange={(v) => { setShowTeamForm(v); if (!v) setInlineNewDelegate(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editTeam ? "Editar equipo" : "Nuevo equipo"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nombre</Label>
                <Input value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} placeholder="Alevín A" data-testid="input-team-name" />
              </div>
              <div>
                <Label>Categoría</Label>
                <Select value={teamForm.category} onValueChange={(v) => setTeamForm({ ...teamForm, category: v })}>
                  <SelectTrigger data-testid="select-team-category"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {CLUB_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Competición</Label>
                <Input
                  list="league-options"
                  value={teamForm.league}
                  onChange={(e) => setTeamForm({ ...teamForm, league: e.target.value })}
                  placeholder="Ej: 1ª Andaluza, 2ª Provincial..."
                  data-testid="input-team-league"
                />
                <datalist id="league-options">
                  {[...new Set(teams.map((t: any) => t.league).filter(Boolean))].map((l: string) => (
                    <option key={l} value={l} />
                  ))}
                </datalist>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label>Color</Label>
                  <Input type="color" value={teamForm.color} onChange={(e) => setTeamForm({ ...teamForm, color: e.target.value })} data-testid="input-team-color" />
                </div>
                <div className="flex-1">
                  <Label>Campo</Label>
                  <Input value={teamForm.fieldName} onChange={(e) => setTeamForm({ ...teamForm, fieldName: e.target.value })} placeholder="Campo municipal" data-testid="input-team-field" />
                </div>
              </div>
              <div>
                <Label>Delegado asignado</Label>
                {inlineNewDelegate ? (
                  <div className="space-y-2 p-3 border rounded-lg bg-slate-50">
                    <p className="text-sm font-medium text-slate-600">Nuevo delegado</p>
                    <Input
                      value={inlineNewDelegate.name}
                      onChange={(e) => setInlineNewDelegate({ ...inlineNewDelegate, name: e.target.value })}
                      placeholder="Nombre del delegado"
                      data-testid="input-inline-delegate-name"
                    />
                    <Input
                      value={inlineNewDelegate.phone}
                      onChange={(e) => setInlineNewDelegate({ ...inlineNewDelegate, phone: e.target.value })}
                      placeholder="Teléfono (opcional)"
                      data-testid="input-inline-delegate-phone"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setInlineNewDelegate(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Select value={teamForm.delegateId} onValueChange={(v) => setTeamForm({ ...teamForm, delegateId: v })}>
                      <SelectTrigger data-testid="select-team-delegate" className="flex-1"><SelectValue placeholder="Sin delegado" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin delegado</SelectItem>
                        {delegates.map((d) => (
                          <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setInlineNewDelegate({ name: "", phone: "" })}
                      title="Crear nuevo delegado"
                      data-testid="button-inline-new-delegate"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
              {sponsors.length > 0 && (
                <div>
                  <Label>Patrocinador</Label>
                  <Select value={teamForm.sponsorId} onValueChange={(v) => setTeamForm({ ...teamForm, sponsorId: v })}>
                    <SelectTrigger data-testid="select-team-sponsor"><SelectValue placeholder="Sin patrocinador" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin patrocinador</SelectItem>
                      {sponsors.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                onClick={async () => {
                  let delegateId: number | null = teamForm.delegateId && teamForm.delegateId !== "none" ? Number(teamForm.delegateId) : null;

                  if (inlineNewDelegate && inlineNewDelegate.name.trim()) {
                    try {
                      const res = await apiRequest("POST", `/api/club/${club.id}/delegates`, {
                        name: inlineNewDelegate.name.trim(),
                        phone: inlineNewDelegate.phone.trim() || undefined,
                      });
                      const newDelegate = await res.json();
                      delegateId = newDelegate.id;
                      queryClient.invalidateQueries({ queryKey: ["/api/club", slug, "admin-data"] });
                      setInlineNewDelegate(null);
                    } catch {
                      toast({ title: "Error al crear delegado", variant: "destructive" });
                      return;
                    }
                  }

                  const body = {
                    ...teamForm,
                    delegateId,
                    sponsorId: teamForm.sponsorId && teamForm.sponsorId !== "none" ? Number(teamForm.sponsorId) : null,
                    branchId: teamForm.branchId && teamForm.branchId !== "none" ? Number(teamForm.branchId) : null,
                  };
                  if (editTeam) {
                    updateTeamMutation.mutate({ id: editTeam.id, body });
                  } else {
                    createTeamMutation.mutate(body);
                  }
                }}
                disabled={!teamForm.name || !teamForm.category || createTeamMutation.isPending || updateTeamMutation.isPending || (!!inlineNewDelegate && !inlineNewDelegate.name.trim())}
                data-testid="button-submit-team"
              >
                {editTeam ? "Guardar" : "Crear"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showDelegateForm} onOpenChange={setShowDelegateForm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo delegado</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nombre</Label>
                <Input value={delegateForm.name} onChange={(e) => setDelegateForm({ ...delegateForm, name: e.target.value })} placeholder="Juan García" data-testid="input-delegate-name" />
              </div>
              <div>
                <Label>Teléfono (opcional)</Label>
                <Input value={delegateForm.phone} onChange={(e) => setDelegateForm({ ...delegateForm, phone: e.target.value })} placeholder="600 123 456" data-testid="input-delegate-phone" />
              </div>
              <p className="text-xs text-muted-foreground">Se generará un PIN de 4 dígitos automáticamente.</p>
            </div>
            <DialogFooter>
              <Button
                onClick={() => createDelegateMutation.mutate(delegateForm)}
                disabled={!delegateForm.name || createDelegateMutation.isPending}
                data-testid="button-submit-delegate"
              >
                Crear delegado
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showMatchdayForm} onOpenChange={setShowMatchdayForm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva jornada</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Equipo</Label>
                <Select value={matchdayForm.teamId} onValueChange={(v) => setMatchdayForm({ ...matchdayForm, teamId: v })}>
                  <SelectTrigger data-testid="select-matchday-team"><SelectValue placeholder="Seleccionar equipo" /></SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.name} ({t.category})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Rival</Label>
                <Input value={matchdayForm.rival} onChange={(e) => setMatchdayForm({ ...matchdayForm, rival: e.target.value })} placeholder="Equipo rival" data-testid="input-matchday-rival" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label>Fecha</Label>
                  <Input type="date" value={matchdayForm.date} onChange={(e) => setMatchdayForm({ ...matchdayForm, date: e.target.value })} data-testid="input-matchday-date" />
                </div>
                <div className="flex-1">
                  <Label>Hora</Label>
                  <Input type="time" value={matchdayForm.time} onChange={(e) => setMatchdayForm({ ...matchdayForm, time: e.target.value })} data-testid="input-matchday-time" />
                </div>
              </div>
              <div>
                <Label>Lugar</Label>
                <Input value={matchdayForm.venue} onChange={(e) => setMatchdayForm({ ...matchdayForm, venue: e.target.value })} placeholder="Campo municipal" data-testid="input-matchday-venue" />
              </div>
              <div className="flex items-center gap-3">
                <Label>Local</Label>
                <Switch checked={matchdayForm.isHome} onCheckedChange={(v) => setMatchdayForm({ ...matchdayForm, isHome: v })} data-testid="switch-matchday-home" />
              </div>
              <div>
                <Label>Jornada nº</Label>
                <Input type="number" min={1} value={matchdayForm.matchdayNumber} onChange={(e) => setMatchdayForm({ ...matchdayForm, matchdayNumber: Number(e.target.value) })} data-testid="input-matchday-journey" />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => createMatchdayMutation.mutate({
                  ...matchdayForm,
                  teamId: Number(matchdayForm.teamId),
                })}
                disabled={!matchdayForm.teamId || !matchdayForm.rival || createMatchdayMutation.isPending}
                data-testid="button-submit-matchday"
              >
                Crear jornada
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showSponsorForm} onOpenChange={(open) => { setShowSponsorForm(open); if (!open) setEditSponsor(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editSponsor ? "Editar patrocinador" : "Nuevo patrocinador"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nombre</Label>
                <Input value={sponsorForm.name} onChange={(e) => setSponsorForm({ ...sponsorForm, name: e.target.value })} placeholder="Empresa S.L." data-testid="input-sponsor-name" />
              </div>
              <div>
                <Label>Descripción breve (opcional)</Label>
                <textarea
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[60px] resize-none"
                  value={sponsorForm.description}
                  onChange={(e) => setSponsorForm({ ...sponsorForm, description: e.target.value })}
                  placeholder="Tu ferretería de confianza, más de 1000 productos a tu servicio"
                  maxLength={200}
                  rows={2}
                  data-testid="input-sponsor-description"
                />
                <p className="text-xs text-muted-foreground mt-1">{sponsorForm.description.length}/200 — Se muestra debajo del logo en el marcador</p>
              </div>
              <div>
                <Label>Logo (opcional)</Label>
                <input
                  ref={sponsorLogoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) await uploadSponsorLogo(file);
                    e.target.value = "";
                  }}
                  data-testid="input-sponsor-logo-file"
                />
                {sponsorForm.logoUrl ? (
                  <div className="flex items-center gap-2 mt-1">
                    <img src={sponsorForm.logoUrl} alt="Logo" className="h-10 w-10 object-contain rounded border" />
                    <span className="text-sm text-muted-foreground truncate flex-1">Logo subido</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setSponsorForm({ ...sponsorForm, logoUrl: "" })} data-testid="button-remove-sponsor-logo">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full mt-1 gap-2"
                    onClick={() => sponsorLogoInputRef.current?.click()}
                    disabled={isUploadingLogo}
                    data-testid="button-upload-sponsor-logo"
                  >
                    {isUploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {isUploadingLogo ? "Subiendo..." : "Subir logo"}
                  </Button>
                )}
              </div>
              <div>
                <Label>Web (opcional)</Label>
                <Input value={sponsorForm.websiteUrl} onChange={(e) => setSponsorForm({ ...sponsorForm, websiteUrl: e.target.value })} placeholder="https://..." data-testid="input-sponsor-website" />
              </div>
              <div>
                <Label>Nivel</Label>
                <Select value={sponsorForm.tier} onValueChange={(v) => setSponsorForm({ ...sponsorForm, tier: v })}>
                  <SelectTrigger data-testid="select-sponsor-tier"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gold">Gold</SelectItem>
                    <SelectItem value="silver">Silver</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => {
                  if (editSponsor) {
                    updateSponsorMutation.mutate({ id: editSponsor.id, ...sponsorForm });
                  } else {
                    createSponsorMutation.mutate(sponsorForm);
                  }
                }}
                disabled={!sponsorForm.name || createSponsorMutation.isPending || updateSponsorMutation.isPending || isUploadingLogo}
                data-testid="button-submit-sponsor"
              >
                {editSponsor ? "Guardar cambios" : "Crear patrocinador"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!showPlayersFor} onOpenChange={(open) => !open && setShowPlayersFor(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Jugadores de {showPlayersFor?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {players && players.length > 0 ? (
                players.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2 border rounded" data-testid={`player-row-${p.id}`}>
                    <div className="flex items-center gap-2">
                      {p.number && <Badge variant="outline">{p.number}</Badge>}
                      <span>{p.name}</span>
                      {p.position && <span className="text-xs text-muted-foreground">({p.position})</span>}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => deletePlayerMutation.mutate(p.id)}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-4">No hay jugadores</p>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Nombre del jugador"
                  value={playerForm.name}
                  onChange={(e) => setPlayerForm({ ...playerForm, name: e.target.value })}
                  data-testid="input-player-name"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && playerForm.name.trim()) {
                      createPlayerMutation.mutate(playerForm);
                    }
                  }}
                />
                <Input
                  placeholder="#"
                  className="w-16"
                  value={playerForm.number}
                  onChange={(e) => setPlayerForm({ ...playerForm, number: e.target.value })}
                  data-testid="input-player-number"
                />
                <Button
                  size="sm"
                  onClick={() => createPlayerMutation.mutate(playerForm)}
                  disabled={!playerForm.name.trim() || createPlayerMutation.isPending}
                  data-testid="button-submit-player"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <Button
                variant="default"
                className="w-full mt-2"
                onClick={() => { setShowPlayersFor(null); setPlayerForm({ name: "", number: "", position: "" }); }}
                data-testid="button-save-squad"
              >
                Guardar plantilla
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
