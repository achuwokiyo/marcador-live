import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type Match, MATCH_STATUS } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { Play, Lock, Trash2, CheckCircle, Edit2, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function ActiveMatches() {
  const [accessPin, setAccessPin] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: matches, isLoading } = useQuery<(Match & { isInactive?: boolean })[]>({
    queryKey: ["/api/active-matches"],
    enabled: isAuthorized,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, pin }: { id: number; status: string; pin: string }) => {
      const url = buildUrl(api.matches.updateStatus.path, { id });
      const res = await fetch(url, {
        method: api.matches.updateStatus.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, pin }),
      });
      if (!res.ok) throw new Error("Error al actualizar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/active-matches"] });
      toast({ title: "Estado actualizado" });
    }
  });

  const deleteMatch = useMutation({
    mutationFn: async ({ id, pin }: { id: number; pin: string }) => {
      const res = await fetch(`/api/matches/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) throw new Error("Error al eliminar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/active-matches"] });
      toast({ title: "Partido eliminado" });
    }
  });

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (accessPin === "4134") {
      setIsAuthorized(true);
    } else {
      toast({ variant: "destructive", title: "PIN incorrecto" });
    }
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-sm shadow-xl border-t-4 border-t-primary">
          <CardContent className="p-8 space-y-6 text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black uppercase tracking-tight">Acceso Central</h2>
              <p className="text-sm text-muted-foreground">Introduce el código maestro para gestionar partidos.</p>
            </div>
            <form onSubmit={handleAuth} className="space-y-4">
              <Input 
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="••••" 
                value={accessPin} 
                onChange={(e) => setAccessPin(e.target.value)}
                className="text-center text-3xl h-14 tracking-[0.5em] font-mono border-2"
                autoFocus
                data-testid="input-access-pin"
              />
              <Button type="submit" className="w-full h-12 text-lg font-bold uppercase">Entrar al Panel</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-12">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Gestión de Partidos</h1>
          </div>
          <Link href="/">
            <Button variant="ghost" className="font-bold">VOLVER</Button>
          </Link>
        </div>

        {matches?.length === 0 ? (
          <Card className="border-2 border-dashed">
            <CardContent className="p-12 text-center text-slate-400">
              <p className="text-lg">No hay partidos registrados en este momento.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {matches?.map((match) => (
              <Card key={match.id} className="overflow-hidden border-2 hover:border-slate-300 transition-all shadow-sm">
                <CardContent className="p-0">
                  <div className="bg-white p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex gap-2 items-center">
                        {match.status === MATCH_STATUS.FINISHED ? (
                          <Badge variant="secondary" className="uppercase text-[10px]">FINALIZADO</Badge>
                        ) : (match as any).isInactive ? (
                          <Badge className="bg-gray-500 hover:bg-gray-500 uppercase text-[10px]">INACTIVO</Badge>
                        ) : (
                          <Badge className="bg-green-500 hover:bg-green-500 animate-pulse uppercase text-[10px]">EN VIVO</Badge>
                        )}
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ID: #{match.id}</span>
                      </div>
                      
                      <div className="flex gap-1.5">
                        {match.status !== MATCH_STATUS.FINISHED && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 text-[10px] font-bold gap-1 border-orange-200 text-orange-600 hover:bg-orange-50"
                            onClick={() => updateStatus.mutate({ id: match.id, status: MATCH_STATUS.FINISHED, pin: match.adminPin })}
                            disabled={updateStatus.isPending}
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            FINALIZAR
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 text-[10px] font-bold gap-1 border-blue-200 text-blue-600 hover:bg-blue-50"
                          onClick={() => {
                            sessionStorage.setItem(`match_pin_${match.id}`, match.adminPin);
                            setLocation(`/match/${match.id}/admin`);
                          }}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          EDITAR
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 text-[10px] font-bold gap-1 border-red-200 text-red-600 hover:bg-red-50"
                          onClick={() => {
                            if (confirm("¿Estás seguro de borrar este partido permanentemente?")) {
                              deleteMatch.mutate({ id: match.id, pin: match.adminPin });
                            }
                          }}
                          disabled={deleteMatch.isPending}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          BORRAR
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex-1 text-right font-black text-slate-900 pr-4 truncate uppercase tracking-tight">{match.localTeam}</div>
                      <div className="bg-slate-900 text-white px-4 py-1.5 rounded-lg font-mono text-2xl font-black shadow-lg">
                        {match.localScore} - {match.awayScore}
                      </div>
                      <div className="flex-1 text-left font-black text-slate-900 pl-4 truncate uppercase tracking-tight">{match.awayTeam}</div>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 border-t px-4 py-2 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">PIN: <code className="bg-slate-200 px-1 rounded">{match.adminPin}</code></span>
                    <Link href={`/match/${match.id}`} className="text-[10px] font-bold text-primary hover:underline uppercase">Ver vista pública →</Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}