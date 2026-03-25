import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { Radio, Eye, Clock, Trophy } from "lucide-react";

interface Match {
  id: number;
  localTeam: string;
  awayTeam: string;
  localTeamColor: string;
  awayTeamColor: string;
  localTeamLogo: string | null;
  awayTeamLogo: string | null;
  localScore: number;
  awayScore: number;
  status: string;
  timerStartTime: string | null;
  timerElapsedSeconds: number;
  spectatorCount: number;
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Programado",
  first_half: "Primera parte",
  halftime: "Descanso",
  second_half: "Segunda parte",
  finished: "Finalizado",
};

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}'${secs.toString().padStart(2, "0")}`;
}

function MatchTimer({ match }: { match: Match }) {
  const [currentTime, setCurrentTime] = useState(() => {
    if (match.timerStartTime) {
      const startTime = new Date(match.timerStartTime).getTime();
      const now = Date.now();
      return match.timerElapsedSeconds + Math.floor((now - startTime) / 1000);
    }
    return match.timerElapsedSeconds;
  });

  useEffect(() => {
    if (!match.timerStartTime) {
      setCurrentTime(match.timerElapsedSeconds);
      return;
    }

    const interval = setInterval(() => {
      const startTime = new Date(match.timerStartTime!).getTime();
      const now = Date.now();
      setCurrentTime(match.timerElapsedSeconds + Math.floor((now - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [match.timerStartTime, match.timerElapsedSeconds]);

  return <span className="font-mono">{formatTime(currentTime)}</span>;
}

export default function MatchWidget() {
  const params = useParams<{ id: string }>();
  const matchId = params.id;
  
  const urlParams = new URLSearchParams(window.location.search);
  const theme = urlParams.get("theme") || "light";
  const compact = urlParams.get("compact") === "true";

  const { data: match, isLoading } = useQuery<Match>({
    queryKey: [`/api/matches/${matchId}`],
    refetchInterval: 2000,
  });

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  const isLive = match && ["first_half", "halftime", "second_half"].includes(match.status) && !(match as any).isInactive;
  const baseUrl = import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin;

  if (isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === "dark" ? "bg-gray-900" : "bg-gray-50"}`}>
        <div className="animate-pulse w-full max-w-md h-40 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === "dark" ? "bg-gray-900 text-white" : "bg-gray-50"}`}>
        <p className="text-gray-500">Partido no encontrado</p>
      </div>
    );
  }

  if (compact) {
    return (
      <a
        href={`${baseUrl}/match/${match.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`block w-full h-full ${theme === "dark" ? "bg-gray-900 text-white" : "bg-white"}`}
        data-testid="match-widget-compact"
      >
        <div className="p-3 h-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {match.localTeamLogo ? (
              <img src={match.localTeamLogo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
            ) : (
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: match.localTeamColor }} />
            )}
            <span className="font-medium truncate text-sm">{match.localTeam}</span>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xl font-bold">{match.localScore}</span>
            <span className="text-gray-400">-</span>
            <span className="text-xl font-bold">{match.awayScore}</span>
          </div>
          
          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            <span className="font-medium truncate text-sm text-right">{match.awayTeam}</span>
            {match.awayTeamLogo ? (
              <img src={match.awayTeamLogo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
            ) : (
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: match.awayTeamColor }} />
            )}
          </div>
          
          {isLive && (
            <Radio className="w-4 h-4 text-red-500 animate-pulse flex-shrink-0" />
          )}
        </div>
      </a>
    );
  }

  return (
    <div className={`min-h-screen p-4 ${theme === "dark" ? "bg-gray-900 text-white" : "bg-gray-50"}`}>
      <a
        href={`${baseUrl}/match/${match.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`block rounded-xl overflow-hidden shadow-lg ${theme === "dark" ? "bg-gray-800" : "bg-white"}`}
        data-testid="match-widget-full"
      >
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isLive ? (
                <span className="flex items-center gap-1.5 text-sm font-medium text-red-500">
                  <Radio className="w-4 h-4 animate-pulse" />
                  EN VIVO
                </span>
              ) : (match as any).isInactive ? (
                <span className="flex items-center gap-1.5 text-sm font-medium text-gray-400">
                  INACTIVO
                </span>
              ) : match.status === "finished" ? (
                <span className="flex items-center gap-1.5 text-sm font-medium text-gray-500">
                  <Trophy className="w-4 h-4" />
                  Finalizado
                </span>
              ) : (
                <span className="text-sm text-gray-500">{STATUS_LABELS[match.status] || match.status}</span>
              )}
            </div>
            
            {isLive && (
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <Clock className="w-4 h-4" />
                <MatchTimer match={match} />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 text-center">
              {match.localTeamLogo ? (
                <img src={match.localTeamLogo} alt={match.localTeam} className="w-12 h-12 object-contain mx-auto mb-2" />
              ) : (
                <div 
                  className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: match.localTeamColor }}
                >
                  {match.localTeam.charAt(0).toUpperCase()}
                </div>
              )}
              <p className="font-semibold truncate text-sm">{match.localTeam}</p>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-4xl font-black">{match.localScore}</span>
              <span className="text-2xl text-gray-400">-</span>
              <span className="text-4xl font-black">{match.awayScore}</span>
            </div>
            
            <div className="flex-1 text-center">
              {match.awayTeamLogo ? (
                <img src={match.awayTeamLogo} alt={match.awayTeam} className="w-12 h-12 object-contain mx-auto mb-2" />
              ) : (
                <div 
                  className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: match.awayTeamColor }}
                >
                  {match.awayTeam.charAt(0).toUpperCase()}
                </div>
              )}
              <p className="font-semibold truncate text-sm">{match.awayTeam}</p>
            </div>
          </div>

          {match.spectatorCount > 0 && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
              <Eye className="w-3.5 h-3.5" />
              <span>{match.spectatorCount} espectadores</span>
            </div>
          )}
        </div>
      </a>
      
      <div className="mt-3 text-center">
        <a 
          href={baseUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          Powered by MarcadorLIVE
        </a>
      </div>
    </div>
  );
}
