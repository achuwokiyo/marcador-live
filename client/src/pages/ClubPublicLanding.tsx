import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, Trophy, Activity, ExternalLink, Filter } from "lucide-react";

interface PublicClubData {
  club: {
    name: string;
    slug: string;
    logoUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
  };
  teams: Array<{ id: number; name: string; category: string; color: string | null; branchId: number | null }>;
  branches: Array<{ id: number; name: string }>;
  sponsors: Array<{ id: number; name: string; logoUrl: string | null; websiteUrl: string | null; tier: string }>;
  thisWeek: Array<any>;
  liveMatches: Array<any>;
  recentResults: Array<any>;
  allMatchdays: Array<any>;
}

const categoryOrder = ["Prebenjamín", "Benjamín", "Alevín", "Infantil", "Cadete", "Juvenil", "Senior"];

export default function ClubPublicLanding() {
  const { slug } = useParams<{ slug: string }>();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<PublicClubData>({
    queryKey: ["/api/club", slug, "public"],
    queryFn: async () => {
      const res = await fetch(`/api/club/${slug}/public`);
      if (!res.ok) throw new Error("Club no encontrado");
      return res.json();
    },
    refetchInterval: 60000,
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
        <Trophy className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground">Club no encontrado</p>
        <Link href="/">
          <Button variant="outline" data-testid="button-back-home">Volver al inicio</Button>
        </Link>
      </div>
    );
  }

  const { club, teams: rawTeams, sponsors, liveMatches, recentResults, allMatchdays } = data;
  const primaryColor = club.primaryColor || "#1e3a5f";
  const secondaryColor = club.secondaryColor || "#ffffff";

  const teams = [...rawTeams].sort((a, b) => {
    const ai = categoryOrder.indexOf(a.category);
    const bi = categoryOrder.indexOf(b.category);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const categories = Array.from(new Set(teams.map(t => t.category))).sort((a, b) => {
    const ai = categoryOrder.indexOf(a);
    const bi = categoryOrder.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const teamIdsForFilter = selectedCategory
    ? teams.filter(t => t.category === selectedCategory).map(t => t.id)
    : teams.map(t => t.id);

  const filteredLiveMatches = selectedCategory
    ? liveMatches.filter((m: any) => {
        const matchday = allMatchdays.find((md: any) => md.matchId === m.id);
        return matchday && teamIdsForFilter.includes(matchday.teamId);
      })
    : liveMatches;

  const pendingMatchdays = allMatchdays
    .filter((md: any) => (md.status === "pending" || md.status === "next") && teamIdsForFilter.includes(md.teamId))
    .sort((a: any, b: any) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

  const nextMatchdays = (() => {
    const seen = new Set<number>();
    const result: any[] = [];
    for (const md of pendingMatchdays) {
      if (!seen.has(md.teamId)) {
        seen.add(md.teamId);
        result.push(md);
      }
    }
    return result;
  })();

  const filteredResults = allMatchdays
    .filter((md: any) => md.status === "played" && md.resultHome !== null && teamIdsForFilter.includes(md.teamId))
    .sort((a: any, b: any) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    })
    .slice(0, 10);

  const filteredTeams = selectedCategory
    ? teams.filter(t => t.category === selectedCategory)
    : teams;

  return (
    <div className="min-h-screen bg-background">
      <div
        className="py-10 px-4 text-center"
        style={{ backgroundColor: primaryColor, color: secondaryColor }}
      >
        {club.logoUrl ? (
          <img src={club.logoUrl} alt={club.name} className="w-20 h-20 mx-auto mb-3 rounded-full object-cover" data-testid="img-club-logo" />
        ) : (
          <div
            className="w-20 h-20 mx-auto mb-3 rounded-full flex items-center justify-center text-3xl font-bold"
            style={{ backgroundColor: secondaryColor, color: primaryColor }}
          >
            {club.name.substring(0, 2).toUpperCase()}
          </div>
        )}
        <h1 className="text-2xl font-bold" data-testid="text-club-name">{club.name}</h1>
        <p className="text-sm opacity-80 mt-1">{teams.length} equipos</p>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-2xl space-y-6">

        <div>
          <div className="flex items-center gap-2 mb-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Filtrar por categoría</span>
          </div>
          <div className="flex flex-wrap gap-2" data-testid="category-filter">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(null)}
              data-testid="button-filter-all"
            >
              Todas
            </Button>
            {categories.map(cat => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat)}
                data-testid={`button-filter-${cat}`}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <Activity className="w-5 h-5 text-red-500" />
            Partidos en vivo
          </h2>
          {filteredLiveMatches.length > 0 ? (
            <div className="space-y-3">
              {filteredLiveMatches.map((match: any) => (
                <Card key={match.id} className="border-red-300 dark:border-red-800" data-testid={`live-match-${match.id}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: match.localTeamColor }} />
                        <span className="font-medium text-sm">{match.localTeam}</span>
                      </div>
                      <div className="text-center px-4">
                        <span className="text-2xl font-bold">{match.localScore} - {match.awayScore}</span>
                        <Badge variant="destructive" className="block mt-1 text-xs">
                          {match.status === "first_half" ? "1ª Parte" : match.status === "halftime" ? "Descanso" : "2ª Parte"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 flex-1 justify-end">
                        <span className="font-medium text-sm">{match.awayTeam}</span>
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: match.awayTeamColor }} />
                      </div>
                    </div>
                    <div className="text-center mt-2">
                      <Link href={`/match/${match.id}`}>
                        <Button variant="outline" size="sm" data-testid={`button-watch-live-${match.id}`}>
                          <ExternalLink className="w-3 h-3 mr-1" />Ver en directo
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card data-testid="no-live-matches">
              <CardContent className="py-6 text-center">
                <Activity className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
                <p className="text-sm text-muted-foreground">No se está jugando ningún partido</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Próximos partidos
          </h2>
          {nextMatchdays.length > 0 ? (
            <div className="space-y-2">
              {nextMatchdays.map((md: any) => {
                const team = teams.find((t) => t.id === md.teamId);
                return (
                  <Card key={md.id} data-testid={`upcoming-matchday-${md.id}`}>
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {md.isHome ? `${team?.name || "?"} vs ${md.rival}` : `${md.rival} vs ${team?.name || "?"}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {md.date ? new Date(md.date).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }) : "Sin fecha"} {md.time || ""} · {md.venue || ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{team?.category}</Badge>
                          {md.matchId && (
                            <Link href={`/match/${md.matchId}`}>
                              <Button variant="outline" size="sm" data-testid={`button-goto-match-${md.id}`}>
                                <ExternalLink className="w-3 h-3 mr-1" />Ver
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card data-testid="no-upcoming">
              <CardContent className="py-6 text-center">
                <Calendar className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
                <p className="text-sm text-muted-foreground">No hay próximos partidos programados</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Últimos resultados
          </h2>
          {filteredResults.length > 0 ? (
            <div className="space-y-2">
              {filteredResults.map((md: any) => {
                const team = teams.find((t) => t.id === md.teamId);
                return (
                  <Card key={md.id} data-testid={`result-matchday-${md.id}`}>
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {md.isHome ? `${team?.name || "?"} vs ${md.rival}` : `${md.rival} vs ${team?.name || "?"}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            J{md.matchdayNumber} · {md.date ? new Date(md.date).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-sm font-bold">
                            {md.resultHome ?? "?"} - {md.resultAway ?? "?"}
                          </Badge>
                          {md.matchId && (
                            <Link href={`/match/${md.matchId}`}>
                              <Button variant="ghost" size="sm" data-testid={`button-goto-result-${md.id}`}>
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card data-testid="no-results">
              <CardContent className="py-6 text-center">
                <Trophy className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
                <p className="text-sm text-muted-foreground">Aún no hay resultados registrados</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          <h2 className="text-lg font-bold mb-3">Equipos</h2>
          <div className="grid grid-cols-2 gap-2">
            {filteredTeams.map((team) => (
              <Card key={team.id} data-testid={`team-card-${team.id}`}>
                <CardContent className="py-3 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full" style={{ backgroundColor: team.color || primaryColor }} />
                  <div>
                    <p className="font-medium text-sm">{team.name}</p>
                    <p className="text-xs text-muted-foreground">{team.category}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {sponsors.length > 0 && (
          <div>
            <h2 className="text-lg font-bold mb-3">Patrocinadores</h2>
            {sponsors.filter(sp => sp.tier === "gold").length > 0 && (
              <div className="mb-4">
                <div className="flex flex-wrap gap-4 justify-center">
                  {sponsors.filter(sp => sp.tier === "gold").map((sp) => (
                    <Card key={sp.id} className="border-yellow-400 dark:border-yellow-600 bg-yellow-50/50 dark:bg-yellow-900/10 w-full" data-testid={`sponsor-gold-${sp.id}`}>
                      <CardContent className="py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-yellow-600 dark:text-yellow-400 font-bold text-lg">
                            {sp.name.substring(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{sp.name}</p>
                            <Badge variant="outline" className="text-[10px] border-yellow-400 text-yellow-700 dark:text-yellow-400 mt-0.5">GOLD</Badge>
                          </div>
                        </div>
                        {sp.websiteUrl && (
                          <a href={sp.websiteUrl} target="_blank" rel="noopener noreferrer" data-testid={`link-sponsor-web-${sp.id}`}>
                            <Button variant="outline" size="sm" data-testid={`button-sponsor-web-${sp.id}`}><ExternalLink className="w-3 h-3 mr-1" />Web</Button>
                          </a>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {sponsors.filter(sp => sp.tier !== "gold").map((sp) => (
                <Card key={sp.id} className={sp.tier === "silver" ? "border-gray-300 dark:border-gray-600" : ""} data-testid={`sponsor-${sp.id}`}>
                  <CardContent className="py-3 text-center">
                    <div className="w-10 h-10 rounded-full bg-muted mx-auto mb-1.5 flex items-center justify-center text-muted-foreground font-bold">
                      {sp.name.substring(0, 1).toUpperCase()}
                    </div>
                    <p className="font-medium text-xs">{sp.name}</p>
                    {sp.tier === "silver" && (
                      <Badge variant="outline" className="text-[10px] mt-0.5 border-gray-400 text-gray-500">SILVER</Badge>
                    )}
                    {sp.websiteUrl && (
                      <a href={sp.websiteUrl} target="_blank" rel="noopener noreferrer" data-testid={`link-sponsor-web-${sp.id}`}>
                        <Button variant="ghost" size="sm" className="text-xs mt-1 h-auto py-1 px-2">Visitar web</Button>
                      </a>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div className="text-center text-xs text-muted-foreground pt-6 pb-4">
          Powered by <Link href="/" className="underline">MarcadorLIVE</Link>
        </div>
      </div>
    </div>
  );
}
