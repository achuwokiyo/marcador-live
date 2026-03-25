import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Radio, Eye, Clock } from "lucide-react";

interface WidgetMatch {
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
  statusLabel: string;
  timerStartTime: string | null;
  timerElapsedSeconds: number;
  spectatorCount: number;
  createdAt: string;
  isInactive?: boolean;
}

interface WidgetData {
  live: WidgetMatch[];
  recent: WidgetMatch[];
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}'${secs.toString().padStart(2, "0")}`;
}

function MatchTimer({ match }: { match: WidgetMatch }) {
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

  return <span>{formatTime(currentTime)}</span>;
}

function MatchCard({ match, isLive }: { match: WidgetMatch; isLive: boolean }) {
  const baseUrl = import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin;
  
  return (
    <a
      href={`${baseUrl}/match/${match.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border border-gray-100 dark:border-gray-700"
      data-testid={`widget-match-${match.id}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {isLive && !match.isInactive && (
            <span className="flex items-center gap-1 text-xs font-medium text-red-500 flex-shrink-0">
              <Radio className="w-3 h-3 animate-pulse" />
              EN VIVO
            </span>
          )}
          {match.isInactive && (
            <span className="flex items-center gap-1 text-xs font-medium text-gray-400 flex-shrink-0">
              INACTIVO
            </span>
          )}
          <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{match.statusLabel}</span>
        </div>
        {isLive && (
          <span className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
            <Clock className="w-3 h-3" />
            <MatchTimer match={match} />
          </span>
        )}
      </div>
      
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2">
            {match.localTeamLogo ? (
              <img src={match.localTeamLogo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
            ) : (
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0" 
                style={{ backgroundColor: match.localTeamColor }}
              />
            )}
            <span className="text-sm font-medium truncate">
              {match.localTeam}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {match.awayTeamLogo ? (
              <img src={match.awayTeamLogo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
            ) : (
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0" 
                style={{ backgroundColor: match.awayTeamColor }}
              />
            )}
            <span className="text-sm font-medium truncate">
              {match.awayTeam}
            </span>
          </div>
        </div>
        
        <div className="text-right flex-shrink-0">
          <div className="text-lg font-bold">{match.localScore}</div>
          <div className="text-lg font-bold">{match.awayScore}</div>
        </div>
      </div>
      
      {match.spectatorCount > 0 && (
        <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
          <Eye className="w-3 h-3" />
          <span>{match.spectatorCount}</span>
        </div>
      )}
    </a>
  );
}

export default function Widget() {
  const params = new URLSearchParams(window.location.search);
  const type = params.get("type") || "all";
  const limit = params.get("limit") || "5";
  const theme = params.get("theme") || "light";
  const teams = params.get("teams") || "";

  const apiUrl = teams
    ? `/api/widget/matches?type=${type}&limit=${limit}&teams=${encodeURIComponent(teams)}`
    : `/api/widget/matches?type=${type}&limit=${limit}`;

  const { data, isLoading } = useQuery<WidgetData>({
    queryKey: [apiUrl],
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  if (isLoading) {
    return (
      <div className={`min-h-screen p-4 ${theme === "dark" ? "bg-gray-900" : "bg-gray-50"}`}>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const hasLive = data?.live && data.live.length > 0;
  const hasRecent = data?.recent && data.recent.length > 0;

  return (
    <div className={`min-h-screen p-4 ${theme === "dark" ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"}`}>
      {hasLive && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Radio className="w-4 h-4 text-red-500" />
            Partidos en Directo
          </h3>
          <div className="space-y-2">
            {data?.live.map((match) => (
              <MatchCard key={match.id} match={match} isLive={true} />
            ))}
          </div>
        </div>
      )}
      
      {hasRecent && type !== "live" && (
        <div>
          <h3 className="text-sm font-semibold mb-2">
            {type === "recent" ? "Partidos Recientes" : "Todos los Partidos"}
          </h3>
          <div className="space-y-2">
            {data?.recent
              .filter((m) => !data?.live.some((l) => l.id === m.id))
              .map((match) => (
                <MatchCard 
                  key={match.id} 
                  match={match} 
                  isLive={["first_half", "halftime", "second_half"].includes(match.status)} 
                />
              ))}
          </div>
        </div>
      )}
      
      {!hasLive && !hasRecent && (
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          <p>No hay partidos disponibles</p>
        </div>
      )}
      
      <div className="mt-4 text-center">
        <a 
          href={window.location.origin}
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
