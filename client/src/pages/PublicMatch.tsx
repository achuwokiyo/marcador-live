import { useRoute } from "wouter";
import { useMatch, useMatchEvents } from "@/hooks/use-matches";
import { useQuery } from "@tanstack/react-query";
import { ScoreBoard } from "@/components/ScoreBoard";
import { EventFeed } from "@/components/EventFeed";
import { ShareModal } from "@/components/ShareModal";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";
import { MATCH_STATUS } from "@shared/schema";
import { useEffect, useRef, useCallback } from "react";
import canvasConfetti from "canvas-confetti";

export default function PublicMatch() {
  const [match, params] = useRoute("/match/:id");
  const matchId = parseInt(params?.id || "0");
  const { data: matchData, isLoading, error } = useMatch(matchId);
  const { data: eventsData } = useMatchEvents(matchId);
  const { data: sponsorData } = useQuery<{ name: string; description: string | null; logoUrl: string | null; websiteUrl: string | null } | null>({
    queryKey: ["/api/matches", matchId, "sponsor"],
    enabled: matchId > 0,
  });
  const prevScoreRef = useRef<{ local: number; away: number } | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playGoalSound = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;

      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.3, now + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.12 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.25);
      });
    } catch (e) {
    }
  }, []);

  useEffect(() => {
    if (!matchData) return;
    const current = { local: matchData.localScore, away: matchData.awayScore };
    if (prevScoreRef.current !== null) {
      const prev = prevScoreRef.current;
      if (current.local !== prev.local || current.away !== prev.away) {
        playGoalSound();
      }
    }
    prevScoreRef.current = current;
  }, [matchData?.localScore, matchData?.awayScore, playGoalSound]);

  // Celebration effect on game end
  useEffect(() => {
    if (matchData?.status === MATCH_STATUS.FINISHED) {
      const end = Date.now() + 3 * 1000;
      const colors = ['#bb0000', '#ffffff'];
      (function frame() {
        canvasConfetti({
          particleCount: 2,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: colors
        });
        canvasConfetti({
          particleCount: 2,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: colors
        });
        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      }());
    }
  }, [matchData?.status]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary mb-4"></div>
        <p className="text-white font-mono animate-pulse">LOADING MATCH DATA...</p>
      </div>
    );
  }

  if (error || !matchData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-destructive/20 bg-destructive/5">
          <CardContent className="flex flex-col items-center py-10 text-center">
            <ShieldAlert className="w-16 h-16 text-destructive mb-4" />
            <h2 className="text-2xl font-bold text-destructive mb-2">Match Not Found</h2>
            <p className="text-muted-foreground">The match ID provided is invalid or has been deleted.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-12">
      {/* Header */}
      <div className="bg-slate-900 text-white p-4 shadow-lg sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="font-bold text-lg tracking-wide uppercase">Marcador<span className="text-primary">LIVE</span></h1>
          <ShareModal matchId={matchId} localTeam={matchData?.localTeam || ""} awayTeam={matchData?.awayTeam || ""} />
        </div>
      </div>

      <main className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Scoreboard */}
        <div className="mt-4">
          <ScoreBoard match={matchData} isPublic />
        </div>

        {/* Status Message (if any) */}
        {matchData.status === MATCH_STATUS.HALFTIME && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded shadow-sm" role="alert">
            <p className="font-bold">Descanso</p>
            <p className="text-sm">El partido está actualmente en el descanso.</p>
          </div>
        )}

        {/* Live Feed */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 p-4 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Eventos en Vivo
            </h2>
          </div>
          <div className="p-4">
            <EventFeed 
              events={eventsData || []} 
              localTeam={matchData?.localTeam}
              awayTeam={matchData?.awayTeam}
            />
          </div>
        </div>

        {matchData.status === MATCH_STATUS.FINISHED && (matchData.chronicle || matchData.summaryImageUrl) && (
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 p-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">Post-partido</h2>
            </div>
            <div className="p-4 space-y-4">
              {matchData.summaryImageUrl && (
                <img
                  src={matchData.summaryImageUrl}
                  alt="Foto resumen del partido"
                  className="w-full rounded-lg"
                  data-testid="img-public-summary"
                />
              )}
              {matchData.chronicle && (
                <div data-testid="text-public-chronicle">
                  <h3 className="text-sm font-bold uppercase text-muted-foreground mb-2">Crónica</h3>
                  <p className="text-sm whitespace-pre-wrap">{matchData.chronicle}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {sponsorData && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-center" data-testid="sponsor-banner">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Resultado del partido patrocinado por</p>
            <div className="flex items-center justify-center gap-3">
              {sponsorData.logoUrl && (
                <img src={sponsorData.logoUrl} alt={sponsorData.name} className="h-10 object-contain" data-testid="img-sponsor-logo" />
              )}
              {sponsorData.websiteUrl ? (
                <a href={sponsorData.websiteUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-lg text-primary hover:underline" data-testid="link-sponsor">
                  {sponsorData.name}
                </a>
              ) : (
                <span className="font-semibold text-lg" data-testid="text-sponsor-name">{sponsorData.name}</span>
              )}
            </div>
            {sponsorData.description && (
              <p className="text-sm text-muted-foreground mt-2 italic" data-testid="text-sponsor-description">{sponsorData.description}</p>
            )}
          </div>
        )}

        {/* Promotional Banner */}
        <a 
          href="/" 
          className="block bg-gradient-to-r from-primary to-primary/80 rounded-xl p-5 text-white text-center shadow-lg hover:shadow-xl transition-shadow"
          data-testid="link-create-scoreboard"
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="font-bold text-lg uppercase tracking-wide">MarcadorLIVE</span>
          </div>
          <p className="text-white/90 text-sm mb-3">
            Crea tu propio marcador en 10 segundos y retransmite tus partidos gratis
          </p>
          <span className="inline-block bg-white text-primary font-bold px-6 py-2 rounded-full text-sm uppercase tracking-wide">
            Crear mi marcador
          </span>
        </a>
      </main>
    </div>
  );
}
