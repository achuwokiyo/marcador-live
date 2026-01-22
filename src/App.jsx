import React, { useState, useEffect } from 'react';
import { Trophy, Users, Clock, Edit3, Plus, QrCode, Lock, Unlock, AlertCircle, Play, Pause, Share2, Copy } from 'lucide-react';

const LiveScoreboard = () => {
  const [view, setView] = useState('home');
  const [matches, setMatches] = useState([]);
  const [currentMatch, setCurrentMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pinInput, setPinInput] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const POLL_INTERVAL = 3000;

  useEffect(() => {
    // Detectar si estamos en una URL de partido público
    const path = window.location.pathname;
    if (path.startsWith('/partido/')) {
      const matchId = path.split('/partido/')[1];
      loadMatchData(matchId);
      setView('public');
    } else {
      loadMatches();
    }
  }, []);

  useEffect(() => {
    if (view === 'public' && currentMatch) {
      const interval = setInterval(() => {
        loadMatchData(currentMatch.id);
      }, POLL_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [view, currentMatch]);

  useEffect(() => {
    let interval = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning]);

  const loadMatches = async () => {
    try {
      const stored = localStorage.getItem('matches');
      if (stored) {
        setMatches(JSON.parse(stored));
      }
    } catch (err) {
      console.log('No matches yet');
    }
    setLoading(false);
  };

  const loadMatchData = async (matchId) => {
    try {
      const stored = localStorage.getItem('matches');
      if (stored) {
        const allMatches = JSON.parse(stored);
        const match = allMatches.find(m => m.id === matchId);
        if (match) {
          setCurrentMatch(match);
          setTimer(match.timerSeconds || 0);
          setIsTimerRunning(match.timerRunning || false);
        }
      }
    } catch (err) {
      console.log('Error loading match data');
    }
  };

  const saveMatch = async (match) => {
    try {
      const stored = localStorage.getItem('matches');
      let allMatches = stored ? JSON.parse(stored) : [];
      
      const index = allMatches.findIndex(m => m.id === match.id);
      if (index >= 0) {
        allMatches[index] = match;
      } else {
        allMatches.push(match);
      }
      
      localStorage.setItem('matches', JSON.stringify(allMatches));
      setMatches(allMatches);
    } catch (err) {
      setError('Error al guardar el partido');
    }
  };

  const generateMatchId = () => {
    return 'M' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getPublicUrl = (matchId) => {
    return `${window.location.origin}/partido/${matchId}`;
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('¡URL copiada al portapapeles!');
  };

  const StatusBadge = ({ status }) => {
    const statusConfig = {
      scheduled: { text: 'Programado', color: 'bg-gray-500' },
      first_half: { text: '1ª Parte', color: 'bg-green-500' },
      halftime: { text: 'Descanso', color: 'bg-yellow-500' },
      second_half: { text: '2ª Parte', color: 'bg-green-500' },
      finished: { text: 'Finalizado', color: 'bg-red-500' }
    };

    const config = statusConfig[status] || statusConfig.scheduled;

    return (
      <span className={`${config.color} text-white px-3 py-1 rounded-full text-sm font-medium inline-block`}>
        {config.text}
      </span>
    );
  };

  const ShareModal = ({ matchId, onClose }) => {
    const url = getPublicUrl(matchId);
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Share2 className="w-6 h-6" />
            Compartir Marcador
          </h3>
          
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-600 mb-2">URL del marcador público:</p>
            <div className="bg-white border border-gray-300 rounded-lg p-3 break-all text-sm">
              {url}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => copyToClipboard(url)}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Copy className="w-4 h-4" />
              Copiar URL
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
            >
              Cerrar
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-4 text-center">
            Comparte esta URL con el público para que vean el marcador en tiempo real
          </p>
        </div>
      </div>
    );
  };

  const CreateMatchForm = () => {
    const [formData, setFormData] = useState({
      localTeam: '',
      awayTeam: '',
      pin: Math.floor(1000 + Math.random() * 9000).toString()
    });

    const handleCreate = async () => {
      if (!formData.localTeam || !formData.awayTeam || !formData.pin) {
        alert('Por favor completa todos los campos');
        return;
      }
      
      try {
        const newMatch = {
          id: generateMatchId(),
          localTeam: formData.localTeam,
          awayTeam: formData.awayTeam,
          localScore: 0,
          awayScore: 0,
          status: 'scheduled',
          pin: formData.pin,
          timerSeconds: 0,
          timerRunning: false,
          createdAt: new Date().toISOString()
        };

        await saveMatch(newMatch);
        setView('home');
      } catch (error) {
        alert('Error al crear el partido: ' + error.message);
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
        <div className="max-w-md mx-auto">
          <button onClick={() => setView('home')} className="mb-4 text-blue-600 hover:text-blue-800">
            ← Volver
          </button>
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Plus className="w-6 h-6" />
              Crear Partido
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Equipo Local</label>
                <input
                  type="text"
                  value={formData.localTeam}
                  onChange={(e) => setFormData({...formData, localTeam: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nombre del equipo local"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Equipo Visitante</label>
                <input
                  type="text"
                  value={formData.awayTeam}
                  onChange={(e) => setFormData({...formData, awayTeam: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nombre del equipo visitante"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PIN de Administración</label>
                <input
                  type="text"
                  value={formData.pin}
                  onChange={(e) => setFormData({...formData, pin: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="PIN de 4 dígitos"
                  maxLength="4"
                />
                <p className="text-xs text-gray-500 mt-1">Guarda este PIN para poder administrar el partido</p>
              </div>
              <button 
                onClick={handleCreate}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Crear Partido
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const HomePage = () => {
    const handleViewMatch = async (match) => {
      setShowShareModal(match.id);
    };

    const handleAdminMatch = async (match) => {
      setCurrentMatch(match);
      setPinInput('');
      setAuthenticated(false);
      setView('admin');
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-3">
              <Trophy className="w-10 h-10 text-yellow-500" />
              Marcador LIVE
            </h1>
            <p className="text-gray-600">Gestión de partidos en tiempo real</p>
          </div>

          <button onClick={() => setView('create')} className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold hover:bg-blue-700 transition-colors mb-6 flex items-center justify-center gap-2">
            <Plus className="w-5 h-5" />
            Crear Nuevo Partido
          </button>

          <div className="space-y-4">
            {matches.length === 0 ? (
              <div className="bg-white rounded-xl shadow-lg p-8 text-center">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No hay partidos creados aún</p>
              </div>
            ) : (
              matches.map(match => (
                <div key={match.id} className="bg-white rounded-xl shadow-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-center gap-4 mb-2">
                        <span className="text-lg font-semibold text-gray-800">{match.localTeam}</span>
                        <span className="text-3xl font-bold text-blue-600">{match.localScore} - {match.awayScore}</span>
                        <span className="text-lg font-semibold text-gray-800">{match.awayTeam}</span>
                      </div>
                      <div className="text-center">
                        <StatusBadge status={match.status} />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleViewMatch(match)} className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2">
                      <Share2 className="w-4 h-4" />
                      Compartir Marcador
                    </button>
                    <button onClick={() => handleAdminMatch(match)} className="flex-1 bg-orange-600 text-white py-2 rounded-lg font-medium hover:bg-orange-700 transition-colors flex items-center justify-center gap-2">
                      <Edit3 className="w-4 h-4" />
                      Administrar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {showShareModal && (
          <ShareModal 
            matchId={showShareModal} 
            onClose={() => setShowShareModal(false)} 
          />
        )}
      </div>
    );
  };

  const PublicView = () => {
    if (!currentMatch) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-green-900 to-blue-900 p-4 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Partido no encontrado</h2>
            <p className="text-gray-600">El partido que buscas no existe o ha sido eliminado.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 to-blue-900 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-green-600 p-8 text-white">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Clock className="w-5 h-5" />
                <StatusBadge status={currentMatch.status} />
              </div>
              
              {(currentMatch.status === 'first_half' || currentMatch.status === 'second_half') && (
                <div className="text-center mb-6">
                  <div className="text-5xl font-bold font-mono bg-black bg-opacity-20 rounded-lg py-3 px-6 inline-block">
                    {formatTime(timer)}
                  </div>
                  <div className="text-sm mt-2 opacity-90">Tiempo de juego</div>
                </div>
              )}

              <div className="text-center">
                <div className="flex items-center justify-around">
                  <div className="flex-1 text-center">
                    <div className="text-2xl font-bold mb-2">{currentMatch.localTeam}</div>
                    <div className="text-7xl font-bold">{currentMatch.localScore}</div>
                  </div>
                  <div className="text-5xl font-light px-6">-</div>
                  <div className="flex-1 text-center">
                    <div className="text-2xl font-bold mb-2">{currentMatch.awayTeam}</div>
                    <div className="text-7xl font-bold">{currentMatch.awayScore}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-gray-50 text-center">
              <p className="text-gray-600 text-sm">🔄 Actualización automática cada 3 segundos</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const AdminPanel = () => {
    const checkPin = () => {
      if (pinInput === currentMatch.pin) {
        setAuthenticated(true);
        loadMatchData(currentMatch.id);
        setError('');
      } else {
        setError('PIN incorrecto');
      }
    };

    const updateMatchStatus = async (newStatus) => {
      const updatedMatch = { ...currentMatch, status: newStatus };
      
      if (newStatus === 'first_half') {
        setTimer(0);
        setIsTimerRunning(true);
        updatedMatch.timerSeconds = 0;
        updatedMatch.timerRunning = true;
      } else if (newStatus === 'halftime') {
        setIsTimerRunning(false);
        updatedMatch.timerRunning = false;
        updatedMatch.timerSeconds = timer;
      } else if (newStatus === 'second_half') {
        setIsTimerRunning(true);
        updatedMatch.timerRunning = true;
        updatedMatch.timerSeconds = timer;
      } else if (newStatus === 'finished') {
        setIsTimerRunning(false);
        updatedMatch.timerRunning = false;
        updatedMatch.timerSeconds = timer;
      }
      
      setCurrentMatch(updatedMatch);
      await saveMatch(updatedMatch);
    };

    const toggleTimer = async () => {
      const newTimerState = !isTimerRunning;
      setIsTimerRunning(newTimerState);
      const updatedMatch = { 
        ...currentMatch, 
        timerRunning: newTimerState,
        timerSeconds: timer 
      };
      setCurrentMatch(updatedMatch);
      await saveMatch(updatedMatch);
    };

    const resetTimer = async () => {
      setTimer(0);
      setIsTimerRunning(false);
      const updatedMatch = { 
        ...currentMatch, 
        timerSeconds: 0,
        timerRunning: false 
      };
      setCurrentMatch(updatedMatch);
      await saveMatch(updatedMatch);
    };

    const updateScore = async (team, delta) => {
      const updatedMatch = { ...currentMatch, timerSeconds: timer, timerRunning: isTimerRunning };
      if (team === 'local') {
        updatedMatch.localScore = Math.max(0, updatedMatch.localScore + delta);
      } else {
        updatedMatch.awayScore = Math.max(0, updatedMatch.awayScore + delta);
      }
      setCurrentMatch(updatedMatch);
      await saveMatch(updatedMatch);
    };

    if (!authenticated) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 p-4 flex items-center justify-center">
          <div className="max-w-md w-full">
            <button onClick={() => setView('home')} className="mb-4 text-orange-600 hover:text-orange-800">← Volver</button>
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <Lock className="w-16 h-16 text-orange-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">Panel de Administración</h2>
              <p className="text-gray-600 text-center mb-6">{currentMatch.localTeam} vs {currentMatch.awayTeam}</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Introduce el PIN</label>
                  <input
                    type="text"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && checkPin()}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-center text-2xl tracking-widest"
                    placeholder="••••"
                    maxLength="4"
                  />
                </div>
                {error && (
                  <div className="flex items-center gap-2 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}
                <button
                  onClick={checkPin}
                  className="w-full bg-orange-600 text-white py-3 rounded-lg font-semibold hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Unlock className="w-5 h-5" />
                  Desbloquear
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 p-4">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => { setAuthenticated(false); setView('home'); }} className="mb-4 text-orange-600 hover:text-orange-800">
            ← Cerrar Sesión
          </button>

          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Edit3 className="w-6 h-6" />
              Panel de Control
            </h2>

            <div className="bg-gradient-to-r from-blue-600 to-green-600 rounded-xl p-6 mb-6 text-white">
              <div className="text-center mb-4">
                <div className="text-6xl font-bold font-mono mb-2">{formatTime(timer)}</div>
                <div className="text-sm opacity-90">Cronómetro del partido</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={toggleTimer}
                  className="flex-1 bg-white bg-opacity-20 hover:bg-opacity-30 py-2 rounded-lg font-medium flex items-center justify-center gap-2"
                >
                  {isTimerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {isTimerRunning ? 'Pausar' : 'Iniciar'}
                </button>
                <button
                  onClick={resetTimer}
                  className="flex-1 bg-white bg-opacity-20 hover:bg-opacity-30 py-2 rounded-lg font-medium"
                >
                  Reiniciar
                </button>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-around mb-2">
                <div className="text-center">
                  <div className="text-lg font-semibold">{currentMatch.localTeam}</div>
                  <div className="text-5xl font-bold text-blue-600 my-3">{currentMatch.localScore}</div>
                  <div className="flex gap-2">
                    <button onClick={() => updateScore('local', 1)} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-semibold">+1</button>
                    <button onClick={() => updateScore('local', -1)} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 font-semibold">-1</button>
                  </div>
                </div>
                <div className="text-3xl font-bold text-gray-400">-</div>
                <div className="text-center">
                  <div className="text-lg font-semibold">{currentMatch.awayTeam}</div>
                  <div className="text-5xl font-bold text-green-600 my-3">{currentMatch.awayScore}</div>
                  <div className="flex gap-2">
                    <button onClick={() => updateScore('away', 1)} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-semibold">+1</button>
                    <button onClick={() => updateScore('away', -1)} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 font-semibold">-1</button>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-700 mb-3">Estado del Partido</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { status: 'first_half', label: 'Iniciar 1ª Parte' },
                  { status: 'halftime', label: 'Descanso' },
                  { status: 'second_half', label: 'Iniciar 2ª Parte' },
                  { status: 'finished', label: 'Finalizar' }
                ].map(({ status, label }) => (
                  <button
                    key={status}
                    onClick={() => updateMatchStatus(status)}
                    className={`py-3 rounded-lg font-medium transition-colors ${
                      currentMatch.status === status
                        ? status === 'finished' ? 'bg-red-600 text-white' : status === 'halftime' ? 'bg-yellow-600 text-white' : 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <Trophy className="w-16 h-16 text-blue-600 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (view === 'create') return <CreateMatchForm />;
  if (view === 'public') return <PublicView />;
  if (view === 'admin') return <AdminPanel />;
  return <HomePage />;
};

export default LiveScoreboard;
