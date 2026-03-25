import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Copy, Check, Code, Eye, List, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface Match {
  id: number;
  localTeam: string;
  awayTeam: string;
  status: string;
}

interface Team {
  id: number;
  name: string;
  color: string;
}

export default function WidgetEmbed() {
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [copied, setCopied] = useState(false);
  
  const [matchSource, setMatchSource] = useState("all");
  const [type, setType] = useState("all");
  const [limit, setLimit] = useState("5");
  const [theme, setTheme] = useState("light");
  const [width, setWidth] = useState("350");
  const [height, setHeight] = useState("500");

  const [matchId, setMatchId] = useState("");
  const [matchTheme, setMatchTheme] = useState("light");
  const [matchCompact, setMatchCompact] = useState("false");
  const [matchWidth, setMatchWidth] = useState("400");
  const [matchHeight, setMatchHeight] = useState("250");
  const [singleMatchSource, setSingleMatchSource] = useState("all");

  const { data: allMatches } = useQuery<Match[]>({
    queryKey: ["/api/active-matches"],
    enabled: !!user,
  });

  const { data: teamMatches } = useQuery<Match[]>({
    queryKey: ["/api/my-team-matches"],
    enabled: !!user,
  });

  const { data: userTeams } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    enabled: !!user,
  });

  const displayedMatches = matchSource === "teams" ? (teamMatches || []) : (allMatches || []);
  const singleDisplayedMatches = singleMatchSource === "teams" ? (teamMatches || []) : (allMatches || []);

  const teamNamesParam = userTeams?.map(t => t.name).join(",") || "";

  const baseUrl = import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin;
  
  const listWidgetUrl = matchSource === "teams" && teamNamesParam
    ? `${baseUrl}/widget?type=${type}&limit=${limit}&theme=${theme}&teams=${encodeURIComponent(teamNamesParam)}`
    : `${baseUrl}/widget?type=${type}&limit=${limit}&theme=${theme}`;
  const listEmbedCode = `<iframe
  src="${listWidgetUrl}"
  width="${width}"
  height="${height}"
  frameborder="0"
  style="border-radius: 12px; overflow: hidden;"
  title="MarcadorLIVE Widget"
></iframe>`;

  const matchWidgetUrl = matchId ? `${baseUrl}/match/${matchId}/widget?theme=${matchTheme}&compact=${matchCompact}` : "";
  const matchEmbedCode = matchId ? `<iframe
  src="${matchWidgetUrl}"
  width="${matchWidth}"
  height="${matchCompact === "true" ? "60" : matchHeight}"
  frameborder="0"
  style="border-radius: 12px; overflow: hidden;"
  title="MarcadorLIVE - Partido en Vivo"
></iframe>` : "";

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast({
        title: "Copiado",
        description: "El código ha sido copiado al portapapeles",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Error",
        description: "No se pudo copiar el código",
        variant: "destructive",
      });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    window.location.href = "/";
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/dashboard">
            <Button variant="outline" size="lg" data-testid="button-back">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Volver
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Widget Web</h1>
        </div>

        <Tabs defaultValue="list" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="list" className="flex items-center gap-2" data-testid="tab-list-widget">
              <List className="w-4 h-4" />
              Lista de Partidos
            </TabsTrigger>
            <TabsTrigger value="match" className="flex items-center gap-2" data-testid="tab-match-widget">
              <Trophy className="w-4 h-4" />
              Partido Individual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Code className="w-5 h-5" />
                      Configuración
                    </CardTitle>
                    <CardDescription>
                      Muestra una lista de partidos en tu web
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="matchSource">Origen de partidos</Label>
                      <Select value={matchSource} onValueChange={setMatchSource}>
                        <SelectTrigger id="matchSource" data-testid="select-match-source">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos los partidos</SelectItem>
                          <SelectItem value="teams">Solo mis equipos</SelectItem>
                        </SelectContent>
                      </Select>
                      {matchSource === "teams" && (teamMatches?.length === 0) && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          No tienes equipos guardados. Ve a tu panel para crear equipos.
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="type">Tipo de partidos</Label>
                      <Select value={type} onValueChange={setType}>
                        <SelectTrigger id="type" data-testid="select-widget-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos (en directo + recientes)</SelectItem>
                          <SelectItem value="live">Solo en directo</SelectItem>
                          <SelectItem value="recent">Solo recientes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="limit">Número de partidos</Label>
                      <Select value={limit} onValueChange={setLimit}>
                        <SelectTrigger id="limit" data-testid="select-widget-limit">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3">3 partidos</SelectItem>
                          <SelectItem value="5">5 partidos</SelectItem>
                          <SelectItem value="10">10 partidos</SelectItem>
                          <SelectItem value="15">15 partidos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="theme">Tema</Label>
                      <Select value={theme} onValueChange={setTheme}>
                        <SelectTrigger id="theme" data-testid="select-widget-theme">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">Claro</SelectItem>
                          <SelectItem value="dark">Oscuro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="width">Ancho (px)</Label>
                        <Input
                          id="width"
                          type="number"
                          value={width}
                          onChange={(e) => setWidth(e.target.value)}
                          min="250"
                          max="800"
                          data-testid="input-widget-width"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="height">Alto (px)</Label>
                        <Input
                          id="height"
                          type="number"
                          value={height}
                          onChange={(e) => setHeight(e.target.value)}
                          min="300"
                          max="1000"
                          data-testid="input-widget-height"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Código para incrustar</CardTitle>
                    <CardDescription>
                      Copia este código HTML en tu sitio web
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="relative">
                      <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap break-all">
                        {listEmbedCode}
                      </pre>
                      <Button
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => handleCopy(listEmbedCode)}
                        data-testid="button-copy-embed"
                      >
                        {copied ? (
                          <>
                            <Check className="w-4 h-4 mr-1" />
                            Copiado
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-1" />
                            Copiar
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="w-5 h-5" />
                      Vista previa
                    </CardTitle>
                    <CardDescription>
                      Así se verá el widget en tu sitio
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div 
                      className="border rounded-lg overflow-hidden mx-auto"
                      style={{ 
                        width: `${Math.min(Number(width), 400)}px`,
                        height: `${Math.min(Number(height), 600)}px`
                      }}
                    >
                      <iframe
                        src={listWidgetUrl}
                        width="100%"
                        height="100%"
                        frameBorder="0"
                        title="Widget Preview"
                        data-testid="widget-preview"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="match">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="w-5 h-5" />
                      Configuración del Marcador
                    </CardTitle>
                    <CardDescription>
                      Incrusta un partido específico en tu web
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="singleMatchSource">Origen de partidos</Label>
                      <Select value={singleMatchSource} onValueChange={(v) => { setSingleMatchSource(v); setMatchId(""); }}>
                        <SelectTrigger id="singleMatchSource" data-testid="select-single-match-source">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos los partidos</SelectItem>
                          <SelectItem value="teams">Solo mis equipos</SelectItem>
                        </SelectContent>
                      </Select>
                      {singleMatchSource === "teams" && (teamMatches?.length === 0) && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          No tienes equipos guardados. Ve a tu panel para crear equipos.
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="matchId">Seleccionar partido</Label>
                      <Select value={matchId} onValueChange={setMatchId}>
                        <SelectTrigger id="matchId" data-testid="select-match-id">
                          <SelectValue placeholder="Elige un partido..." />
                        </SelectTrigger>
                        <SelectContent>
                          {singleDisplayedMatches.map((match) => (
                            <SelectItem key={match.id} value={String(match.id)}>
                              {match.localTeam} vs {match.awayTeam}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        O introduce el ID del partido manualmente:
                      </p>
                      <Input
                        type="number"
                        placeholder="ID del partido"
                        value={matchId}
                        onChange={(e) => setMatchId(e.target.value)}
                        data-testid="input-match-id"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="matchTheme">Tema</Label>
                      <Select value={matchTheme} onValueChange={setMatchTheme}>
                        <SelectTrigger id="matchTheme" data-testid="select-match-theme">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">Claro</SelectItem>
                          <SelectItem value="dark">Oscuro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="matchCompact">Estilo</Label>
                      <Select value={matchCompact} onValueChange={setMatchCompact}>
                        <SelectTrigger id="matchCompact" data-testid="select-match-compact">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="false">Completo (con logos)</SelectItem>
                          <SelectItem value="true">Compacto (una línea)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {matchCompact === "false" && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="matchWidth">Ancho (px)</Label>
                          <Input
                            id="matchWidth"
                            type="number"
                            value={matchWidth}
                            onChange={(e) => setMatchWidth(e.target.value)}
                            min="300"
                            max="600"
                            data-testid="input-match-width"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="matchHeight">Alto (px)</Label>
                          <Input
                            id="matchHeight"
                            type="number"
                            value={matchHeight}
                            onChange={(e) => setMatchHeight(e.target.value)}
                            min="150"
                            max="400"
                            data-testid="input-match-height"
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {matchId && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Código para incrustar</CardTitle>
                      <CardDescription>
                        Copia este código HTML en tu sitio web
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="relative">
                        <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap break-all">
                          {matchEmbedCode}
                        </pre>
                        <Button
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => handleCopy(matchEmbedCode)}
                          data-testid="button-copy-match-embed"
                        >
                          {copied ? (
                            <>
                              <Check className="w-4 h-4 mr-1" />
                              Copiado
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4 mr-1" />
                              Copiar
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="w-5 h-5" />
                      Vista previa
                    </CardTitle>
                    <CardDescription>
                      Así se verá el marcador en tu sitio
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {matchId ? (
                      <div 
                        className="border rounded-lg overflow-hidden mx-auto"
                        style={{ 
                          width: matchCompact === "true" ? "100%" : `${Math.min(Number(matchWidth), 400)}px`,
                          height: matchCompact === "true" ? "60px" : `${Math.min(Number(matchHeight), 300)}px`
                        }}
                      >
                        <iframe
                          src={matchWidgetUrl}
                          width="100%"
                          height="100%"
                          frameBorder="0"
                          title="Match Widget Preview"
                          data-testid="match-widget-preview"
                        />
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Selecciona un partido para ver la vista previa</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
