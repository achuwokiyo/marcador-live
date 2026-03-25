import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertMatch, type InsertMatchEvent, type MatchStatus } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { enqueueOperation, startOfflineQueueProcessor } from "@/lib/offlineQueue";

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("auth_token");
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 5): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok || res.status === 401 || res.status === 400) return res;
      if (attempt < maxRetries && (res.status >= 500 || res.status === 404)) {
        const delays = [1000, 2000, 4000, 8000, 15000];
        const delay = delays[Math.min(attempt, delays.length - 1)];
        console.warn(`[MarcadorLIVE] Reintentando ${options.method} ${url} (intento ${attempt + 1}/${maxRetries}, status ${res.status}, espera ${delay}ms)`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        const delays = [1000, 2000, 4000, 8000, 15000];
        const delay = delays[Math.min(attempt, delays.length - 1)];
        console.warn(`[MarcadorLIVE] Error de red, reintentando ${options.method} ${url} (intento ${attempt + 1}/${maxRetries}, espera ${delay}ms):`, lastError.message);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
    }
  }
  throw lastError || new Error("Error de conexion");
}

function enqueueAndResolve(url: string, options: RequestInit, description: string): Response {
  enqueueOperation({
    url,
    method: options.method || "POST",
    headers: options.headers as Record<string, string>,
    body: options.body as string,
    description,
  });
  startOfflineQueueProcessor();
  return new Response(JSON.stringify({ queued: true }), { status: 200, headers: { "Content-Type": "application/json" } });
}

// ============================================
// MATCHES HOOKS
// ============================================

export function useMatch(id: number) {
  return useQuery({
    queryKey: [api.matches.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.matches.get.path, { id });
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch match");
      return api.matches.get.responses[200].parse(await res.json());
    },
    refetchInterval: 1000,
  });
}

export function useCreateMatch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (data: InsertMatch) => {
      const res = await fetch(api.matches.create.path, {
        method: api.matches.create.method,
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!res.ok) {
        if (res.status === 400) {
          const error = await res.json();
          throw new Error(error.message || "Validation failed");
        }
        throw new Error("Failed to create match");
      }
      return api.matches.create.responses[201].parse(await res.json());
    },
    onSuccess: (data) => {
      toast({ title: "¡Partido Creado!", description: "Redirigiendo al panel de administración..." });
    },
    onError: (err) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  });
}

export function useVerifyPin(matchId: number) {
  return useMutation({
    mutationFn: async (pin: string) => {
      const url = buildUrl(api.matches.verifyPin.path, { id: matchId });
      const res = await fetch(url, {
        method: api.matches.verifyPin.method,
        headers: getAuthHeaders(),
        body: JSON.stringify({ pin }),
      });
      
      if (res.status === 401) throw new Error("Invalid PIN");
      if (!res.ok) throw new Error("Verification failed");
      return api.matches.verifyPin.responses[200].parse(await res.json());
    }
  });
}

export function useDeleteMatch(matchId: number) {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (pin: string) => {
      const res = await fetch(`/api/matches/${matchId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
        body: JSON.stringify({ pin }),
      });

      if (!res.ok) throw new Error("Error al eliminar el partido");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Partido eliminado", description: "El partido ha sido borrado permanentemente" });
    },
    onError: (err) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  });
}

export function useUpdateScore(matchId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ team, delta, pin }: { team: "local" | "away", delta: number, pin: string }) => {
      const url = buildUrl(api.matches.updateScore.path, { id: matchId });
      const reqOptions = {
        method: api.matches.updateScore.method,
        headers: getAuthHeaders(),
        body: JSON.stringify({ team, delta, pin }),
      };
      try {
        const res = await fetchWithRetry(url, reqOptions);
        if (!res.ok) throw new Error("No se pudo actualizar el marcador");
        return await res.json();
      } catch (err) {
        const fakeRes = enqueueAndResolve(url, reqOptions, `Gol ${team} delta=${delta} match=${matchId}`);
        toast({ title: "Sin conexion", description: "El gol se guardara automaticamente cuando vuelva la conexion." });
        return await fakeRes.json();
      }
    },
    onMutate: async ({ team, delta }) => {
      await queryClient.cancelQueries({ queryKey: [api.matches.get.path, matchId] });
      const previous = queryClient.getQueryData([api.matches.get.path, matchId]);
      queryClient.setQueryData([api.matches.get.path, matchId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          localScore: team === "local" ? Math.max(0, old.localScore + delta) : old.localScore,
          awayScore: team === "away" ? Math.max(0, old.awayScore + delta) : old.awayScore,
        };
      });
      return { previous };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [api.matches.get.path, matchId] });
    }
  });
}

export function useUpdateStatus(matchId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ status, pin }: { status: MatchStatus, pin: string }) => {
      const url = buildUrl(api.matches.updateStatus.path, { id: matchId });
      const reqOptions = {
        method: api.matches.updateStatus.method,
        headers: getAuthHeaders(),
        body: JSON.stringify({ status, pin }),
      };
      try {
        const res = await fetchWithRetry(url, reqOptions);
        if (!res.ok) throw new Error("No se pudo cambiar el estado");
        return await res.json();
      } catch (err) {
        const fakeRes = enqueueAndResolve(url, reqOptions, `Estado ${status} match=${matchId}`);
        toast({ title: "Sin conexion", description: "El cambio de estado se guardara cuando vuelva la conexion." });
        return await fakeRes.json();
      }
    },
    onMutate: async ({ status }) => {
      await queryClient.cancelQueries({ queryKey: [api.matches.get.path, matchId] });
      const previous = queryClient.getQueryData([api.matches.get.path, matchId]);
      queryClient.setQueryData([api.matches.get.path, matchId], (old: any) => {
        if (!old) return old;
        return { ...old, status };
      });
      return { previous };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [api.matches.get.path, matchId] });
    }
  });
}

export function useControlTimer(matchId: number) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ action, pin }: { action: "start" | "pause" | "reset", pin: string }) => {
      const url = buildUrl(api.matches.controlTimer.path, { id: matchId });
      const reqOptions = {
        method: api.matches.controlTimer.method,
        headers: getAuthHeaders(),
        body: JSON.stringify({ action, pin }),
      };
      try {
        const res = await fetchWithRetry(url, reqOptions);
        if (!res.ok) throw new Error("No se pudo controlar el cronometro");
        return await res.json();
      } catch (err) {
        const fakeRes = enqueueAndResolve(url, reqOptions, `Timer ${action} match=${matchId}`);
        return await fakeRes.json();
      }
    },
    onMutate: async ({ action }) => {
      await queryClient.cancelQueries({ queryKey: [api.matches.get.path, matchId] });
      const previous = queryClient.getQueryData([api.matches.get.path, matchId]);
      queryClient.setQueryData([api.matches.get.path, matchId], (old: any) => {
        if (!old) return old;
        if (action === "start") return { ...old, timerStartTime: new Date().toISOString() };
        if (action === "pause") {
          const elapsed = old.timerStartTime
            ? old.timerElapsedSeconds + Math.floor((Date.now() - new Date(old.timerStartTime).getTime()) / 1000)
            : old.timerElapsedSeconds;
          return { ...old, timerStartTime: null, timerElapsedSeconds: elapsed };
        }
        return { ...old, timerStartTime: null, timerElapsedSeconds: 0 };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData([api.matches.get.path, matchId], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [api.matches.get.path, matchId] });
    }
  });
}

export function useUpdateColors(matchId: number) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ localTeamColor, awayTeamColor, pin }: { localTeamColor?: string, awayTeamColor?: string, pin: string }) => {
      const url = buildUrl(api.matches.updateColors.path, { id: matchId });
      const res = await fetch(url, {
        method: api.matches.updateColors.method,
        headers: getAuthHeaders(),
        body: JSON.stringify({ localTeamColor, awayTeamColor, pin }),
      });

      if (!res.ok) throw new Error("Failed to update colors");
      return api.matches.updateColors.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.matches.get.path, matchId] });
    }
  });
}

// ============================================
// EVENTS HOOKS
// ============================================

export function useMatchEvents(matchId: number) {
  return useQuery({
    queryKey: [api.events.list.path, matchId],
    queryFn: async () => {
      const url = buildUrl(api.events.list.path, { id: matchId });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch events");
      return api.events.list.responses[200].parse(await res.json());
    },
    refetchInterval: 2000,
  });
}

export function useCreateEvent(matchId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertMatchEvent & { pin: string }) => {
      const url = buildUrl(api.events.create.path, { id: matchId });
      const res = await fetch(url, {
        method: api.events.create.method,
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Failed to create event");
      return api.events.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.events.list.path, matchId] });
      toast({ title: "Evento registrado" });
    },
    onError: (err) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  });
}

export function useDeleteEvent(matchId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ eventId, pin }: { eventId: number; pin: string }) => {
      const url = buildUrl(api.events.delete.path, { id: matchId, eventId });
      const res = await fetch(url, {
        method: api.events.delete.method,
        headers: getAuthHeaders(),
        body: JSON.stringify({ pin }),
      });

      if (!res.ok) throw new Error("Failed to delete event");
      return api.events.delete.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.events.list.path, matchId] });
      toast({ title: "Evento eliminado" });
    },
    onError: (err) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  });
}

export function useUpdateEvent(matchId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ eventId, player, pin }: { eventId: number; player: string; pin: string }) => {
      const res = await fetch(`/api/matches/${matchId}/events/${eventId}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ pin, player }),
      });

      if (!res.ok) throw new Error("Failed to update event");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.events.list.path, matchId] });
      toast({ title: "Goleador añadido" });
    },
    onError: (err) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  });
}
