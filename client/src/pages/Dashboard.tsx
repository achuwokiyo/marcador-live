import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getQueryFn } from "@/lib/queryClient";
import { 
  Loader2, Plus, Clock, Trophy, Users, LogOut, ArrowLeft,
  Shield, Trash2, Edit2, X, Settings, Upload, Image
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpload } from "@/hooks/use-upload";
import type { Match, Team, PublicUser } from "@shared/schema";

export default function Dashboard() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [showTeamDialog, setShowTeamDialog] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamName, setTeamName] = useState("");
  const [teamColor, setTeamColor] = useState("#1e40af");
  const [teamCategory, setTeamCategory] = useState("");
  const [teamLogoUrl, setTeamLogoUrl] = useState("");
  const [logoPreview, setLogoPreview] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasLocalToken = !!localStorage.getItem("auth_token");
  const { data: localUser, isLoading: localAuthLoading } = useQuery<PublicUser | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: hasLocalToken,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
  const isLocalLoggedIn = !!localUser;
  const isAnyAuthenticated = isAuthenticated || isLocalLoggedIn;
  const anyLoading = isLoading || (hasLocalToken && localAuthLoading);

  const { uploadFile, isUploading } = useUpload({
    onSuccess: (response) => {
      setTeamLogoUrl(response.objectPath);
      setLogoPreview("");
    },
  });

  const { data: myClub } = useQuery<{ slug: string } | null>({
    queryKey: ["/api/club/mine"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isAnyAuthenticated,
    retry: false,
  });

  useEffect(() => {
    if (!anyLoading && !isAnyAuthenticated) {
      setLocation("/login");
    }
  }, [anyLoading, isAnyAuthenticated, setLocation]);

  useEffect(() => {
    if (myClub?.slug) {
      setLocation(`/club/${myClub.slug}/admin`);
    }
  }, [myClub, setLocation]);

  const { data: matches = [], isLoading: matchesLoading } = useQuery<Match[]>({
    queryKey: ["/api/my-matches"],
    enabled: isAnyAuthenticated,
  });

  const { data: teams = [], isLoading: teamsLoading } = useQuery<Team[]>({
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

  const createTeamMutation = useMutation({
    mutationFn: async (data: { name: string; color: string; category?: string; logoUrl?: string }) => {
      return apiRequest("POST", "/api/teams", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setShowTeamDialog(false);
      resetForm();
    }
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/teams/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
    }
  });

  const updateTeamMutation = useMutation({
    mutationFn: async (data: { id: number; name: string; color: string; category?: string; logoUrl?: string }) => {
      return apiRequest("PATCH", `/api/teams/${data.id}`, {
        name: data.name,
        color: data.color,
        category: data.category,
        logoUrl: data.logoUrl
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setShowTeamDialog(false);
      setEditingTeam(null);
      resetForm();
    }
  });

  const resetForm = () => {
    setTeamName("");
    setTeamColor("#1e40af");
    setTeamCategory("");
    setTeamLogoUrl("");
    setLogoPreview("");
  };

  if (anyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const userName = localUser?.username || user?.firstName || user?.email?.split('@')[0] || 'Usuario';

  const handleLogout = () => {
    if (isLocalLoggedIn) {
      localStorage.removeItem("auth_token");
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setLocation("/");
    } else {
      window.location.href = "/api/logout";
    }
  };

  const handleCreateTeam = () => {
    if (!teamName.trim()) return;
    createTeamMutation.mutate({
      name: teamName.trim(),
      color: teamColor,
      category: teamCategory.trim() || undefined,
      logoUrl: teamLogoUrl || undefined
    });
  };

  const handleEditTeam = (team: Team) => {
    setEditingTeam(team);
    setTeamName(team.name);
    setTeamColor(team.color || "#1e40af");
    setTeamCategory(team.category || "");
    setTeamLogoUrl(team.logoUrl || "");
    setLogoPreview("");
    setShowTeamDialog(true);
  };

  const handleSaveTeam = () => {
    if (!teamName.trim()) return;
    if (editingTeam) {
      updateTeamMutation.mutate({
        id: editingTeam.id,
        name: teamName.trim(),
        color: teamColor,
        category: teamCategory.trim() || undefined,
        logoUrl: teamLogoUrl || undefined
      });
    } else {
      handleCreateTeam();
    }
  };

  const handleCloseDialog = () => {
    setShowTeamDialog(false);
    setEditingTeam(null);
    resetForm();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      setLogoPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);

    await uploadFile(file);
  };

  const handleRemoveLogo = () => {
    setTeamLogoUrl("");
    setLogoPreview("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const currentLogoSrc = logoPreview || (teamLogoUrl ? teamLogoUrl : "");

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="p-4 flex items-center justify-between border-b bg-white">
        <Link href="/">
          <Button variant="ghost" size="lg" className="text-muted-foreground text-base">
            <ArrowLeft className="w-6 h-6 mr-2" />
            Inicio
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
          <span className="font-black text-lg tracking-tight uppercase">
            Marcador<span className="text-primary">LIVE</span>
          </span>
        </div>
        <Button 
          variant="ghost" 
          size="icon"
          onClick={handleLogout}
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </header>

      {isSuperAdmin && (
        <div className="px-4 pt-4 max-w-lg mx-auto w-full">
          <Link href="/admin">
            <Button 
              variant="outline" 
              className="w-full border-primary text-primary hover:bg-primary hover:text-white"
              data-testid="button-admin-panel"
            >
              <Settings className="w-4 h-4 mr-2" />
              Administrar MarcadorLIVE
            </Button>
          </Link>
        </div>
      )}

      <main className="flex-1 p-4 space-y-6 max-w-lg mx-auto w-full">
        <div className="pt-2">
          <h1 className="text-2xl font-bold text-slate-900" data-testid="text-greeting">
            Hola, {userName}
          </h1>
          <p className="text-muted-foreground text-sm">
            Gestiona tus partidos y equipos favoritos
          </p>
        </div>

        <Link href="/">
          <Button className="w-full h-14 text-lg font-semibold" data-testid="button-create-match">
            <Plus className="w-5 h-5 mr-2" />
            Crear nuevo partido
          </Button>
        </Link>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Mis equipos favoritos
              </CardTitle>
              <Dialog open={showTeamDialog} onOpenChange={(open) => { if (!open) handleCloseDialog(); else setShowTeamDialog(true); }}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" data-testid="button-add-team">
                    <Plus className="w-4 h-4 mr-1" />
                    Añadir
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingTeam ? "Editar equipo" : "Añadir equipo favorito"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div>
                      <Label htmlFor="team-name">Nombre del equipo *</Label>
                      <Input 
                        id="team-name"
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        placeholder="Ej: Atlético de Madrid"
                        data-testid="input-team-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="team-color">Color del equipo</Label>
                      <div className="flex gap-2 items-center">
                        <input 
                          type="color" 
                          id="team-color"
                          value={teamColor}
                          onChange={(e) => setTeamColor(e.target.value)}
                          className="w-12 h-10 rounded border cursor-pointer"
                          data-testid="input-team-color"
                        />
                        <span className="text-sm text-muted-foreground">{teamColor}</span>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="team-category">Categoría (opcional)</Label>
                      <Input 
                        id="team-category"
                        value={teamCategory}
                        onChange={(e) => setTeamCategory(e.target.value)}
                        placeholder="Ej: Alevin, Benjamin, Infantil..."
                        data-testid="input-team-category"
                      />
                    </div>
                    <div>
                      <Label>Escudo del equipo (opcional)</Label>
                      <div className="flex items-center gap-3 mt-1">
                        {currentLogoSrc ? (
                          <div className="relative">
                            <img 
                              src={currentLogoSrc} 
                              alt="Escudo" 
                              className="w-16 h-16 rounded-lg object-contain border bg-white p-1"
                              data-testid="img-team-logo-preview"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-white"
                              onClick={handleRemoveLogo}
                              data-testid="button-remove-logo"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/30">
                            <Image className="w-6 h-6 text-muted-foreground/40" />
                          </div>
                        )}
                        <div className="flex-1">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileSelect}
                            data-testid="input-team-logo-file"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            data-testid="button-upload-logo"
                          >
                            {isUploading ? (
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                              <Upload className="w-4 h-4 mr-1" />
                            )}
                            {isUploading ? "Subiendo..." : "Subir escudo"}
                          </Button>
                          <p className="text-xs text-muted-foreground mt-1">
                            PNG, JPG o SVG. Máx 5MB.
                          </p>
                        </div>
                      </div>
                    </div>
                    <Button 
                      className="w-full"
                      onClick={handleSaveTeam}
                      disabled={!teamName.trim() || createTeamMutation.isPending || updateTeamMutation.isPending || isUploading}
                      data-testid="button-save-team"
                    >
                      {(createTeamMutation.isPending || updateTeamMutation.isPending) ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      {editingTeam ? "Guardar cambios" : "Guardar equipo"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {teamsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : teams.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-4">
                No tienes equipos guardados. Añade tus equipos favoritos para crear partidos más rápido.
              </p>
            ) : (
              <div className="space-y-2">
                {teams.map((team) => (
                  <div 
                    key={team.id} 
                    className="flex items-center justify-between p-3 rounded-lg border bg-white"
                    data-testid={`team-item-${team.id}`}
                  >
                    <div className="flex items-center gap-3">
                      {team.logoUrl ? (
                        <img 
                          src={team.logoUrl} 
                          alt={team.name}
                          className="w-8 h-8 rounded-full object-contain border bg-white"
                          data-testid={`img-team-logo-${team.id}`}
                        />
                      ) : (
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: team.color || "#1e40af" }}
                        >
                          <Shield className="w-4 h-4 text-white" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-sm">{team.name}</p>
                        {team.category && (
                          <p className="text-xs text-muted-foreground">{team.category}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="text-muted-foreground hover:text-primary"
                        onClick={() => handleEditTeam(team)}
                        data-testid={`button-edit-team-${team.id}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteTeamMutation.mutate(team.id)}
                        disabled={deleteTeamMutation.isPending}
                        data-testid={`button-delete-team-${team.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Historial de partidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {matchesLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : matches.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-4">
                Aún no has creado ningún partido. ¡Crea tu primer marcador ahora!
              </p>
            ) : (
              <div className="space-y-2">
                {matches.slice(0, 5).map((match) => (
                  <Link key={match.id} href={`/match/${match.id}/admin`}>
                    <div 
                      className="flex items-center justify-between p-3 rounded-lg border bg-white hover-elevate cursor-pointer"
                      data-testid={`match-item-${match.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {match.localTeam} vs {match.awayTeam}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {match.localScore} - {match.awayScore}
                          {match.status === "finished" && (
                            <span className="ml-2 text-green-600">Finalizado</span>
                          )}
                        </p>
                      </div>
                      <Trophy className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </Link>
                ))}
                {matches.length > 5 && (
                  <p className="text-center text-xs text-muted-foreground pt-2">
                    Y {matches.length - 5} partidos más...
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <footer className="p-4 text-center text-xs text-muted-foreground border-t bg-white">
        © {new Date().getFullYear()} MarcadorLIVE
      </footer>
    </div>
  );
}
