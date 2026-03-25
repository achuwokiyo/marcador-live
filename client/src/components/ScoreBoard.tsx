import { useEffect, useState } from "react";
import { type Match, MATCH_STATUS } from "@shared/schema";
import { cn } from "@/lib/utils";

interface ScoreBoardProps {
  match: Match & { isInactive?: boolean };
  className?: string;
  isPublic?: boolean;
}

export function ScoreBoard({ match, className, isPublic = false }: ScoreBoardProps) {
  const [displayTime, setDisplayTime] = useState("00:00");

  useEffect(() => {
    const updateTimer = () => {
      let totalSeconds = match.timerElapsedSeconds;
      
      if (match.timerStartTime && match.status !== MATCH_STATUS.HALFTIME && match.status !== MATCH_STATUS.FINISHED) {
        const now = new Date();
        const start = new Date(match.timerStartTime);
        const diffSeconds = Math.floor((now.getTime() - start.getTime()) / 1000);
        totalSeconds += diffSeconds;
      }

      totalSeconds = Math.max(0, totalSeconds);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      setDisplayTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [match.timerElapsedSeconds, match.timerStartTime, match.status]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case MATCH_STATUS.SCHEDULED: return "PROGRAMADO";
      case MATCH_STATUS.FIRST_HALF: return "1ª PARTE";
      case MATCH_STATUS.HALFTIME: return "DESCANSO";
      case MATCH_STATUS.SECOND_HALF: return "2ª PARTE";
      case MATCH_STATUS.FINISHED: return "FINALIZADO";
      default: return status;
    }
  };

  const hasAnyLogo = !!(match.localTeamLogo || match.awayTeamLogo);

  return (
    <div className={cn("w-full rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-900 bg-slate-950", className)}>
      {/* Top Bar - Status & Time */}
      <div className="bg-slate-900 p-3 flex justify-between items-center text-xs md:text-sm font-bold tracking-widest text-slate-400 px-4 md:px-8 border-b border-slate-800">
        <span className={cn(
          "px-3 py-1 rounded text-[10px] md:text-xs",
          match.isInactive ? "bg-gray-500 text-white" :
          match.status === MATCH_STATUS.FINISHED ? "bg-red-500 text-white" :
          (match.status === MATCH_STATUS.FIRST_HALF || match.status === MATCH_STATUS.SECOND_HALF) ? "bg-primary text-white animate-pulse" : "bg-slate-800"
        )}>
          {match.isInactive ? "INACTIVO" : getStatusLabel(match.status)}
        </span>
        <span className="font-mono text-primary text-3xl md:text-4xl font-black tabular-nums">{displayTime}</span>
      </div>

      {/* Main Score Area */}
      <div className="grid grid-cols-3 gap-0 bg-gradient-to-b from-slate-900 to-slate-950">
        
        {/* Local Team */}
        <div className="col-span-1 p-3 md:p-6 flex flex-col items-center justify-end border-r border-slate-800/50">
          {hasAnyLogo && (
            <div className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center mb-1">
              {match.localTeamLogo && (
                <img 
                  src={match.localTeamLogo} 
                  alt={match.localTeam} 
                  className="w-6 h-6 md:w-8 md:h-8 object-contain"
                  data-testid="img-local-team-logo"
                />
              )}
            </div>
          )}
          <h3 className="text-xs md:text-base font-bold text-slate-400 text-center break-words leading-tight mb-2 md:mb-3 w-full">{match.localTeam}</h3>
          <div className="text-5xl md:text-8xl font-black text-white font-mono tracking-tighter text-glow">
            {match.localScore}
          </div>
        </div>

        {/* VS / Center */}
        <div className="col-span-1 py-4 flex flex-col items-center justify-center relative">
          <div className="text-white text-4xl md:text-5xl font-black italic opacity-60 flex items-center justify-center select-none pointer-events-none">
            VS
          </div>
        </div>

        {/* Away Team */}
        <div className="col-span-1 p-3 md:p-6 flex flex-col items-center justify-end border-l border-slate-800/50">
          {hasAnyLogo && (
            <div className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center mb-1">
              {match.awayTeamLogo && (
                <img 
                  src={match.awayTeamLogo} 
                  alt={match.awayTeam} 
                  className="w-6 h-6 md:w-8 md:h-8 object-contain"
                  data-testid="img-away-team-logo"
                />
              )}
            </div>
          )}
          <h3 className="text-xs md:text-base font-bold text-slate-400 text-center break-words leading-tight mb-2 md:mb-3 w-full">{match.awayTeam}</h3>
          <div className="text-5xl md:text-8xl font-black text-white font-mono tracking-tighter text-glow">
            {match.awayScore}
          </div>
        </div>
      </div>
      
      {/* Footer stripe with team colors */}
      <div className="h-1.5 w-full flex">
        <div className="h-full w-1/2" style={{ backgroundColor: match.localTeamColor || '#3b82f6' }} />
        <div className="h-full w-1/2" style={{ backgroundColor: match.awayTeamColor || '#ef4444' }} />
      </div>
    </div>
  );
}
