import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Users, Trophy, Activity, Trash2, UserCog, Loader2, ArrowLeft, Shield, Calendar, Eye, CheckCircle, Building2, Plus, Power, ExternalLink, Pencil } from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import type { AuthUser } from "@shared/models/auth";
import type { Match, Club } from "@shared/schema";

interface AdminStats {
  totalUsers: number;
  finishedMatches: number;
  activeMatches: number;
}

type TabView = "users" | "matches" | "clubs";
type MatchFilter = "all" | "active" | "finished";

interface ClubWithMeta extends Club {
  coordinatorUsername: string | null;
  teamsCount: number;
  delegatesCount: number;
}

interface LocalUser {
  id: number;
  username: string;
  role: string;
  createdAt: string;
}

interface MatchWithOwner extends Match {
  owner: AuthUser | null;
}

interface EditUserForm {
  username: string;
  password: string;
  role: string;
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabView>("users");
  const [matchFilter, setMatchFilter] = useState<MatchFilter>("all");
  const [showCreateClub, setShowCreateClub] = useState(false);
  const [showAssignCoordinator, setShowAssignCoordinator] = useState<number | null>(null);
  const [clubForm, setClubForm] = useState({ name: "", slug: "", primaryColor: "#1e3a5f", secondaryColor: "#ffffff" });
  const [coordForm, setCoordForm] = useState({ username: "", password: "" });
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [editForm, setEditForm] = useState<EditUserForm>({ username: "", password: "", role: "user" });

  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: users, isLoading: usersLoading } = useQuery<AuthUser[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: matches, isLoading: matchesLoading } = useQuery<MatchWithOwner[]>({
    queryKey: ["/api/admin/matches"],
  });

  const { data: clubs, isLoading: clubsLoading } = useQuery<ClubWithMeta[]>({
    queryKey: ["/api/admin/clubs"],
  });

  const { data: localUsers } = useQuery<LocalUser[]>({
    queryKey: ["/api/admin/local-users"],
  });

  const createClubMutation = useMutation({
    mutationFn: async (data: typeof clubForm) => {
      return apiRequest("POST", "/api/admin/clubs", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clubs"] });
      setShowCreateClub(false);
      setClubForm({ name: "", slug: "", primaryColor: "#1e3a5f", secondaryColor: "#ffffff" });
      toast({ title: "Club creado", description: "El club ha sido creado correctamente." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "No se pudo crear el club.", variant: "destructive" });
    },
  });

  const toggleClubStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return apiRequest("PATCH", `/api/admin/clubs/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clubs"] });
      toast({ title: "Estado actualizado" });
    },
  });

  const deleteClubMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/admin/clubs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clubs"] });
      toast({ title: "Club eliminado" });
    },
  });

  const assignCoordinatorMutation = useMutation({
    mutationFn: async ({ clubId, data }: { clubId: number; data: any }) => {
      return apiRequest("POST", `/api/admin/clubs/${clubId}/coordinator`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clubs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/local-users"] });
      setShowAssignCoordinator(null);
      setCoordForm({ username: "", password: "" });
      toast({ title: "Coordinador asignado" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "No se pudo asignar.", variant: "destructive" });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return apiRequest("PATCH", `/api/admin/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Rol actualizado", description: "El rol del usuario ha sido cambiado." });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar el rol.", variant: "destructive" });
    },
  });

  const editUserMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: Partial<EditUserForm> }) => {
      return apiRequest("PATCH", `/api/admin/users/${userId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setEditingUser(null);
      toast({ title: "Usuario actualizado", description: "Los datos del usuario han sido actualizados." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "No se pudo actualizar el usuario.", variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("DELETE", `/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/matches"] });
      toast({ title: "Usuario eliminado", description: "El usuario y sus datos han sido eliminados." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "No se pudo eliminar el usuario.", variant: "destructive" });
    },
  });

  const deleteMatchMutation = useMutation({
    mutationFn: async (matchId: number) => {
      return apiRequest("DELETE", `/api/admin/matches/${matchId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/matches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Partido eliminado", description: "El partido ha sido eliminado." });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo eliminar el partido.", variant: "destructive" });
    },
  });

  const assignMatchMutation = useMutation({
    mutationFn: async ({ matchId, authUserId }: { matchId: number; authUserId: string | null }) => {
      return apiRequest("PATCH", `/api/admin/matches/${matchId}/assign`, { authUserId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/matches"] });
      toast({ title: "Partido asignado", description: "El propietario del partido ha sido actualizado." });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo asignar el partido.", variant: "destructive" });
    },
  });

  const formatDate = (date: Date | string | null) => {
    if (!date) return "—";
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      scheduled: { label: "Programado", variant: "secondary" },
      first_half: { label: "1ª Parte", variant: "default" },
      halftime: { label: "Descanso", variant: "outline" },
      second_half: { label: "2ª Parte", variant: "default" },
      finished: { label: "Finalizado", variant: "destructive" },
    };
    const info = statusMap[status] || { label: status, variant: "secondary" as const };
    return <Badge variant={info.variant}>{info.label}</Badge>;
  };

  const openEditUser = (user: AuthUser) => {
    setEditingUser(user);
    setEditForm({
      username: user.firstName || "",
      password: "",
      role: user.role,
    });
  };

  const handleSaveUser = () => {
    if (!editingUser) return;
    const data: Partial<EditUserForm> = {};
    if (editForm.username && editForm.username !== editingUser.firstName) data.username = editForm.username;
    if (editForm.password) data.password = editForm.password;
    if (editForm.role !== editingUser.role) data.role = editForm.role;
    
    if (Object.keys(data).length === 0) {
      setEditingUser(null);
      return;
    }
    editUserMutation.mutate({ userId: editingUser.id, data });
  };

  const isLocalUser = (userId: string) => userId.startsWith("local_");

  const navigateToUsers = () => setActiveTab("users");
  const navigateToFinishedMatches = () => { setActiveTab("matches"); setMatchFilter("finished"); };
  const navigateToActiveMatches = () => { setActiveTab("matches"); setMatchFilter("active"); };

  const filteredMatches = matches?.filter((match) => {
    if (matchFilter === "all") return true;
    if (matchFilter === "finished") return match.status === "finished";
    if (matchFilter === "active") return match.status !== "finished";
    return true;
  });

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">
        <div className="flex items-center gap-3 mb-4 sm:mb-6">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back-home">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              Panel de Administración
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm">Gestión de usuarios y partidos</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <Card 
            className="cursor-pointer hover-elevate transition-all"
            onClick={navigateToUsers}
            data-testid="card-users"
          >
            <CardContent className="p-3 sm:pt-6 sm:p-6">
              <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
                <div className="p-2 sm:p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                  <Users className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-300" />
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-xl sm:text-2xl font-bold" data-testid="text-total-users">{stats?.totalUsers || 0}</p>
                  <p className="text-[10px] sm:text-sm text-muted-foreground leading-tight">Usuarios</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card 
            className="cursor-pointer hover-elevate transition-all"
            onClick={navigateToFinishedMatches}
            data-testid="card-finished-matches"
          >
            <CardContent className="p-3 sm:pt-6 sm:p-6">
              <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
                <div className="p-2 sm:p-3 bg-green-100 dark:bg-green-900 rounded-full">
                  <CheckCircle className="w-4 h-4 sm:w-6 sm:h-6 text-green-600 dark:text-green-300" />
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-xl sm:text-2xl font-bold" data-testid="text-finished-matches">{stats?.finishedMatches || 0}</p>
                  <p className="text-[10px] sm:text-sm text-muted-foreground leading-tight">Terminados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card 
            className="cursor-pointer hover-elevate transition-all"
            onClick={navigateToActiveMatches}
            data-testid="card-active-matches"
          >
            <CardContent className="p-3 sm:pt-6 sm:p-6">
              <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
                <div className="p-2 sm:p-3 bg-orange-100 dark:bg-orange-900 rounded-full">
                  <Activity className="w-4 h-4 sm:w-6 sm:h-6 text-orange-600 dark:text-orange-300" />
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-xl sm:text-2xl font-bold" data-testid="text-active-matches">{stats?.activeMatches || 0}</p>
                  <p className="text-[10px] sm:text-sm text-muted-foreground leading-tight">Activos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => { setActiveTab(value as TabView); setMatchFilter("all"); }} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="users" data-testid="tab-users">
              <Users className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="text-xs sm:text-sm">Usuarios</span>
            </TabsTrigger>
            <TabsTrigger value="matches" data-testid="tab-matches">
              <Trophy className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="text-xs sm:text-sm">Partidos</span>
            </TabsTrigger>
            <TabsTrigger value="clubs" data-testid="tab-clubs">
              <Building2 className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="text-xs sm:text-sm">Clubes</span>
            </TabsTrigger>
          </TabsList>

          {/* USERS TAB */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <UserCog className="w-5 h-5" />
                  Gestión de Usuarios
                </CardTitle>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : users && users.length > 0 ? (
                  <div className="space-y-2">
                    {users.map((user) => (
                      <div
                        key={user.id}
                        className="p-3 sm:p-4 border rounded-lg"
                        data-testid={`user-row-${user.id}`}
                      >
                        <div className="flex items-start gap-3">
                          {user.profileImageUrl ? (
                            <img
                              src={user.profileImageUrl}
                              alt={user.firstName || "User"}
                              className="w-9 h-9 rounded-full flex-shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                              <Users className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm truncate">
                                {user.firstName}{user.lastName ? ` ${user.lastName}` : ""}
                              </p>
                              <Badge variant={user.role === "superadmin" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                                {user.role === "superadmin" ? "Admin" : "Usuario"}
                              </Badge>
                              {isLocalUser(user.id) && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">Local</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {user.email || (isLocalUser(user.id) ? `ID: ${user.id}` : "Sin email")}
                              {" · "}
                              {formatDate(user.createdAt)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditUser(user)}
                              data-testid={`button-edit-user-${user.id}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  disabled={deleteUserMutation.isPending}
                                  data-testid={`button-delete-user-${user.id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Se eliminará a "{user.firstName}{user.lastName ? ` ${user.lastName}` : ""}" y todos sus partidos.
                                    Esta acción no se puede deshacer.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteUserMutation.mutate(user.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No hay usuarios registrados</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* MATCHES TAB */}
          <TabsContent value="matches">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Calendar className="w-5 h-5" />
                  Partidos
                </CardTitle>
                <Select value={matchFilter} onValueChange={(value) => setMatchFilter(value as MatchFilter)}>
                  <SelectTrigger className="w-28 sm:w-36 h-8 text-xs sm:text-sm" data-testid="select-match-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Activos</SelectItem>
                    <SelectItem value="finished">Terminados</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                {matchesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : filteredMatches && filteredMatches.length > 0 ? (
                  <div className="space-y-2">
                    {filteredMatches.map((match) => (
                      <div
                        key={match.id}
                        className="p-3 border rounded-lg"
                        data-testid={`match-row-${match.id}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            {getStatusBadge(match.status)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Link href={`/match/${match.id}`}>
                              <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`button-view-match-${match.id}`}>
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                            </Link>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  disabled={deleteMatchMutation.isPending}
                                  data-testid={`button-delete-match-${match.id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Eliminar partido?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Se eliminará "{match.localTeam} vs {match.awayTeam}" y todos sus eventos.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMatchMutation.mutate(match.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>

                        <div className="flex items-center justify-center gap-3 py-2">
                          <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
                            <span className="text-sm font-medium text-right truncate">{match.localTeam}</span>
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: match.localTeamColor }}
                            />
                          </div>
                          <div className="flex-shrink-0 text-center">
                            <span className="text-lg font-bold tabular-nums">
                              {match.localScore} - {match.awayScore}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: match.awayTeamColor }}
                            />
                            <span className="text-sm font-medium truncate">{match.awayTeam}</span>
                          </div>
                        </div>

                        <div className="mt-2 pt-2 border-t space-y-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>
                              <span className="font-medium text-foreground">
                                {match.owner
                                  ? `${match.owner.firstName || ""}${match.owner.lastName ? ` ${match.owner.lastName}` : ""}`.trim() || match.owner.email
                                  : "Sin asignar"}
                              </span>
                            </span>
                            <span>{formatDate(match.createdAt)}</span>
                          </div>
                          <Select
                            value={match.authUserId || "unassigned"}
                            onValueChange={(value) =>
                              assignMatchMutation.mutate({
                                matchId: match.id,
                                authUserId: value === "unassigned" ? null : value,
                              })
                            }
                            disabled={assignMatchMutation.isPending}
                          >
                            <SelectTrigger className="w-full h-8 text-xs" data-testid={`select-assign-${match.id}`}>
                              <SelectValue placeholder="Asignar a..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">Sin asignar</SelectItem>
                              {users?.map((user) => (
                                <SelectItem key={user.id} value={user.id}>
                                  {user.firstName}{user.lastName ? ` ${user.lastName}` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    {matchFilter === "all" 
                      ? "No hay partidos creados" 
                      : matchFilter === "active" 
                        ? "No hay partidos activos"
                        : "No hay partidos terminados"}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* CLUBS TAB */}
          <TabsContent value="clubs">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Building2 className="w-5 h-5" />
                  Clubes
                </CardTitle>
                <Button size="sm" onClick={() => setShowCreateClub(true)} data-testid="button-create-club">
                  <Plus className="w-4 h-4 mr-1" />
                  <span className="text-xs sm:text-sm">Crear Club</span>
                </Button>
              </CardHeader>
              <CardContent>
                {clubsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : clubs && clubs.length > 0 ? (
                  <div className="space-y-2">
                    {clubs.map((club) => (
                      <div
                        key={club.id}
                        className="p-3 border rounded-lg"
                        data-testid={`club-row-${club.id}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                              style={{ backgroundColor: club.primaryColor || "#1e3a5f" }}
                            >
                              {club.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{club.name}</p>
                              <p className="text-xs text-muted-foreground">/{club.slug}</p>
                            </div>
                          </div>
                          <Badge variant={club.status === "active" ? "default" : "secondary"} className="text-[10px] flex-shrink-0">
                            {club.status === "active" ? "Activo" : club.status === "trial" ? "Prueba" : "Inactivo"}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mb-2">
                          Coordinador: <span className="font-medium text-foreground">{club.coordinatorUsername || "Sin asignar"}</span>
                          <span className="mx-1">·</span>
                          {club.teamsCount} equipos
                          <span className="mx-1">·</span>
                          {club.delegatesCount} delegados
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setShowAssignCoordinator(club.id)}
                            data-testid={`button-assign-coord-${club.id}`}
                          >
                            <UserCog className="w-3 h-3 mr-1" />
                            Coord.
                          </Button>
                          <Link href={`/club/${club.slug}/admin`}>
                            <Button variant="outline" size="sm" className="h-7 text-xs" data-testid={`button-club-panel-${club.id}`}>
                              <ExternalLink className="w-3 h-3 mr-1" />
                              Panel
                            </Button>
                          </Link>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() =>
                              toggleClubStatusMutation.mutate({
                                id: club.id,
                                status: club.status === "active" ? "inactive" : "active",
                              })
                            }
                            data-testid={`button-toggle-club-${club.id}`}
                          >
                            <Power className="w-3 h-3 mr-1" />
                            {club.status === "active" ? "Desactivar" : "Activar"}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm" className="h-7 text-xs ml-auto" data-testid={`button-delete-club-${club.id}`}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar club?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Se eliminará "{club.name}" y todos sus datos. Esta acción no se puede deshacer.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteClubMutation.mutate(club.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No hay clubes creados</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit User Dialog */}
        <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar usuario</DialogTitle>
            </DialogHeader>
            {editingUser && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-username">Nombre de usuario</Label>
                  <Input
                    id="edit-username"
                    value={editForm.username}
                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                    disabled={!isLocalUser(editingUser.id)}
                    placeholder="Nombre de usuario"
                    data-testid="input-edit-username"
                  />
                  {!isLocalUser(editingUser.id) && (
                    <p className="text-xs text-muted-foreground mt-1">Solo se puede cambiar el nombre de usuarios locales</p>
                  )}
                </div>
                {isLocalUser(editingUser.id) && (
                  <div>
                    <Label htmlFor="edit-password">Nueva contraseña</Label>
                    <Input
                      id="edit-password"
                      type="password"
                      value={editForm.password}
                      onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                      placeholder="Dejar en blanco para no cambiar"
                      data-testid="input-edit-password"
                    />
                  </div>
                )}
                <div>
                  <Label htmlFor="edit-role">Rol</Label>
                  <Select value={editForm.role} onValueChange={(role) => setEditForm({ ...editForm, role })}>
                    <SelectTrigger data-testid="select-edit-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Usuario</SelectItem>
                      <SelectItem value="superadmin">Superadmin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingUser(null)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSaveUser}
                disabled={editUserMutation.isPending}
                data-testid="button-save-user"
              >
                {editUserMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Club Dialog */}
        <Dialog open={showCreateClub} onOpenChange={setShowCreateClub}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear nuevo club</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="club-name">Nombre del club</Label>
                <Input
                  id="club-name"
                  value={clubForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                    setClubForm({ ...clubForm, name, slug });
                  }}
                  placeholder="CD Ejemplo"
                  data-testid="input-club-name"
                />
              </div>
              <div>
                <Label htmlFor="club-slug">Slug (URL)</Label>
                <Input
                  id="club-slug"
                  value={clubForm.slug}
                  onChange={(e) => setClubForm({ ...clubForm, slug: e.target.value })}
                  placeholder="cd-ejemplo"
                  data-testid="input-club-slug"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="club-primary-color">Color principal</Label>
                  <Input
                    id="club-primary-color"
                    type="color"
                    value={clubForm.primaryColor}
                    onChange={(e) => setClubForm({ ...clubForm, primaryColor: e.target.value })}
                    data-testid="input-club-primary-color"
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="club-secondary-color">Color secundario</Label>
                  <Input
                    id="club-secondary-color"
                    type="color"
                    value={clubForm.secondaryColor}
                    onChange={(e) => setClubForm({ ...clubForm, secondaryColor: e.target.value })}
                    data-testid="input-club-secondary-color"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => createClubMutation.mutate(clubForm)}
                disabled={!clubForm.name || !clubForm.slug || createClubMutation.isPending}
                data-testid="button-submit-club"
              >
                {createClubMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Crear Club
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Coordinator Dialog */}
        <Dialog open={!!showAssignCoordinator} onOpenChange={(open) => !open && setShowAssignCoordinator(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Asignar coordinador</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Asignar usuario existente</Label>
                <Select
                  onValueChange={(val) => {
                    if (showAssignCoordinator) {
                      assignCoordinatorMutation.mutate({
                        clubId: showAssignCoordinator,
                        data: { userId: Number(val) },
                      });
                    }
                  }}
                >
                  <SelectTrigger data-testid="select-existing-user">
                    <SelectValue placeholder="Seleccionar usuario..." />
                  </SelectTrigger>
                  <SelectContent>
                    {localUsers?.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.username} ({u.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-center text-muted-foreground text-sm">— o crear nuevo —</div>
              <div>
                <Label htmlFor="coord-username">Usuario nuevo</Label>
                <Input
                  id="coord-username"
                  value={coordForm.username}
                  onChange={(e) => setCoordForm({ ...coordForm, username: e.target.value })}
                  placeholder="Nombre de usuario"
                  data-testid="input-coord-username"
                />
              </div>
              <div>
                <Label htmlFor="coord-password">Contraseña</Label>
                <Input
                  id="coord-password"
                  type="password"
                  value={coordForm.password}
                  onChange={(e) => setCoordForm({ ...coordForm, password: e.target.value })}
                  placeholder="Contraseña"
                  data-testid="input-coord-password"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => {
                  if (showAssignCoordinator && coordForm.username && coordForm.password) {
                    assignCoordinatorMutation.mutate({
                      clubId: showAssignCoordinator,
                      data: coordForm,
                    });
                  }
                }}
                disabled={!coordForm.username || !coordForm.password || assignCoordinatorMutation.isPending}
                data-testid="button-submit-coordinator"
              >
                {assignCoordinatorMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Crear y Asignar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
