import { type MatchEvent } from "@shared/schema";
import { Goal, Flag, RefreshCw, Trash2, Pencil, Check, X, ChevronDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useRef, useEffect } from "react";

interface RosterPlayer {
  id: number;
  name: string;
  number: string | null;
  position: string | null;
}

interface EventFeedProps {
  events: MatchEvent[];
  localTeam?: string;
  awayTeam?: string;
  localTeamColor?: string;
  awayTeamColor?: string;
  onDelete?: (id: number) => void;
  onUpdatePlayer?: (eventId: number, player: string) => void;
  localRoster?: RosterPlayer[];
  awayRoster?: RosterPlayer[];
}

const getEventIcon = (type: string) => {
  switch (type) {
    case 'goal': return <Goal className="w-4 h-4 text-green-500" />;
    case 'yellow_card': return <div className="w-3 h-4 bg-yellow-400 rounded-sm" />;
    case 'red_card': return <div className="w-3 h-4 bg-red-600 rounded-sm" />;
    case 'sub': return <RefreshCw className="w-4 h-4 text-blue-500" />;
    default: return <Flag className="w-4 h-4 text-slate-400" />;
  }
};

const getEventStyle = (type: string, description?: string, team?: string | null, localTeamColor?: string, awayTeamColor?: string) => {
  const desc = (description || '').toLowerCase();
  
  if (desc.includes('inicio del partido') || desc.includes('inicio segunda parte')) {
    return { borderColor: '#16a34a', backgroundColor: 'rgba(22, 163, 74, 0.1)' };
  }
  if (desc.includes('descanso')) {
    return { borderColor: '#f97316', backgroundColor: 'rgba(249, 115, 22, 0.1)' };
  }
  if (desc.includes('finalizado')) {
    return { borderColor: '#dc2626', backgroundColor: 'rgba(220, 38, 38, 0.1)' };
  }

  if (type === 'goal' && team) {
    const color = team === 'local' ? (localTeamColor || '#3b82f6') : (awayTeamColor || '#ef4444');
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return { borderColor: color, backgroundColor: `rgba(${r}, ${g}, ${b}, 0.15)` };
  }

  switch (type) {
    case 'goal': return { borderColor: '#22c55e', backgroundColor: 'rgba(34, 197, 94, 0.1)' };
    case 'yellow_card': return { borderColor: '#facc15', backgroundColor: 'rgba(250, 204, 21, 0.1)' };
    case 'red_card': return { borderColor: '#dc2626', backgroundColor: 'rgba(220, 38, 38, 0.1)' };
    default: return { borderColor: '#cbd5e1', backgroundColor: 'rgba(203, 213, 225, 0.1)' };
  }
};

function PlayerPicker({ 
  roster, 
  value, 
  onChange, 
  onConfirm, 
  onCancel 
}: { 
  roster: RosterPlayer[];
  value: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [filter, setFilter] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const sortedRoster = [...roster].sort((a, b) => {
    const numA = a.number ? parseInt(a.number) : 999;
    const numB = b.number ? parseInt(b.number) : 999;
    return numA - numB;
  });

  const filteredPlayers = sortedRoster.filter(p => {
    if (!filter) return true;
    const search = filter.toLowerCase();
    return p.name.toLowerCase().includes(search) || 
           (p.number && String(p.number).includes(search));
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectPlayer = (p: RosterPlayer) => {
    const label = p.number ? `${p.number}. ${p.name}` : p.name;
    onChange(label);
    setShowDropdown(false);
    setFilter("");
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div className="flex items-center">
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setFilter(e.target.value);
              if (roster.length > 0) setShowDropdown(true);
            }}
            onFocus={() => { if (roster.length > 0) setShowDropdown(true); }}
            placeholder={roster.length > 0 ? "Buscar o escribir..." : "Nombre/Dorsal..."}
            className="h-7 text-xs w-44 pr-7"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') { setShowDropdown(false); onConfirm(); }
              if (e.key === 'Escape') { setShowDropdown(false); onCancel(); }
            }}
            data-testid="input-player-picker"
          />
          {roster.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 absolute right-0 text-slate-400"
              onClick={() => setShowDropdown(!showDropdown)}
              tabIndex={-1}
            >
              <ChevronDown className="w-3 h-3" />
            </Button>
          )}
        </div>
        {showDropdown && roster.length > 0 && (
          <div ref={dropdownRef} className="absolute z-50 top-8 left-0 w-56 max-h-48 overflow-y-auto bg-white border rounded-md shadow-lg">
            <button
              type="button"
              className="w-full text-left px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 italic border-b"
              onClick={() => { onChange("Propia puerta"); setShowDropdown(false); }}
              data-testid="option-own-goal"
            >
              Propia puerta
            </button>
            {filteredPlayers.map((p) => (
              <button
                key={p.id}
                type="button"
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-primary/10 flex items-center gap-2"
                onClick={() => selectPlayer(p)}
                data-testid={`option-player-${p.id}`}
              >
                {p.number && (
                  <span className="font-mono font-bold text-primary w-6 text-right">{p.number}</span>
                )}
                <span className="font-medium">{p.name}</span>
                {p.position && <span className="text-slate-400 ml-auto">{p.position}</span>}
              </button>
            ))}
            {filteredPlayers.length === 0 && (
              <div className="px-3 py-2 text-xs text-slate-400 italic">Sin resultados</div>
            )}
          </div>
        )}
      </div>
      <Button 
        size="icon" 
        variant="ghost" 
        className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-100"
        onClick={() => { setShowDropdown(false); onConfirm(); }}
      >
        <Check className="w-4 h-4" />
      </Button>
      <Button 
        size="icon" 
        variant="ghost" 
        className="h-7 w-7 text-slate-400 hover:text-slate-600"
        onClick={() => { setShowDropdown(false); onCancel(); }}
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}

export function EventFeed({ events, localTeam, awayTeam, localTeamColor, awayTeamColor, onDelete, onUpdatePlayer, localRoster = [], awayRoster = [] }: EventFeedProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const sortedEvents = [...events].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const filteredEvents = sortedEvents;

  const getTeamName = (team: string | null) => {
    if (!team) return "";
    if (team === 'local') return localTeam || 'LOCAL';
    if (team === 'away') return awayTeam || 'VISITANTE';
    return team;
  };

  const getRosterForTeam = (team: string | null): RosterPlayer[] => {
    if (team === 'local') return localRoster;
    if (team === 'away') return awayRoster;
    return [];
  };

  const startEditing = (event: MatchEvent) => {
    setEditingId(event.id);
    setEditValue(event.player || "");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValue("");
  };

  const confirmEdit = (eventId: number) => {
    if (editValue.trim() && onUpdatePlayer) {
      onUpdatePlayer(eventId, editValue.trim());
    }
    setEditingId(null);
    setEditValue("");
  };

  if (filteredEvents.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground italic text-sm border-2 border-dashed rounded-xl">
        No hay eventos todavía. ¡El partido está a punto de empezar!
      </div>
    );
  }

  return (
    <div className="w-full">
      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-3">
          {filteredEvents.map((event) => {
            const isGoal = event.type === 'goal';
            const isEditing = editingId === event.id;
            const teamName = getTeamName(event.team);

            const eventStyle = getEventStyle(event.type, event.description || '', event.team, localTeamColor, awayTeamColor);

            return (
              <div 
                key={event.id}
                className="p-3 rounded-r-lg border-l-4 shadow-sm flex items-start gap-3"
                style={{ borderLeftColor: eventStyle.borderColor, backgroundColor: eventStyle.backgroundColor }}
              >
                <div className="font-mono font-bold text-sm bg-white px-1.5 py-0.5 rounded border shadow-sm min-w-[3.5rem] text-center">
                  {event.minute}' <span className="text-[10px] text-slate-400">{event.half === 2 ? '2ª' : '1ª'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getEventIcon(event.type)}
                    
                    {isGoal ? (
                      <>
                        <span className="font-bold text-slate-900 text-sm uppercase">
                          GOL {teamName}
                        </span>
                        {event.currentScore && (
                          <span className="font-mono font-black text-sm text-primary">
                            ({event.currentScore})
                          </span>
                        )}
                        {event.player && !isEditing && (
                          <span className="text-sm text-slate-600 font-medium">
                            - {event.player}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="font-bold text-slate-900 text-sm uppercase">
                          {event.description || 'EVENTO'}
                        </span>
                        {event.currentScore && (
                          <span className="font-mono font-black text-sm text-primary ml-1">
                            ({event.currentScore})
                          </span>
                        )}
                        {event.team && (
                          <span className="text-xs font-semibold px-1.5 py-0.5 bg-slate-200 rounded text-slate-600 ml-auto">
                            {teamName}
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {isGoal && onUpdatePlayer && (
                    <div className="mt-2">
                      {isEditing ? (
                        <PlayerPicker
                          roster={getRosterForTeam(event.team)}
                          value={editValue}
                          onChange={setEditValue}
                          onConfirm={() => confirmEdit(event.id)}
                          onCancel={cancelEditing}
                        />
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 px-2 text-[10px] text-slate-400 hover:text-primary gap-1"
                          onClick={() => startEditing(event)}
                        >
                          <Pencil className="w-3 h-3" />
                          {event.player ? 'Editar goleador' : 'Añadir goleador'}
                        </Button>
                      )}
                    </div>
                  )}

                  {!isGoal && event.description && event.type !== 'whistle' && (
                    <p className="text-xs text-slate-500 mt-1">{event.description}</p>
                  )}
                </div>
                {onDelete && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-slate-300 hover:text-destructive shrink-0"
                    onClick={() => onDelete(event.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
