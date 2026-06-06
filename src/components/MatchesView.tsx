import { useEffect, useState } from 'react';
import { Match, Competition } from '../types';
import { AlertCircle, Clock, Search, ChevronRight } from 'lucide-react';

interface MatchesViewProps {
  onPronoClick?: (match: Match, competitionId: number) => void;
  userProfile?: {
    username: string;
    avatar_type: "emoji" | "jersey";
    avatar_value: string;
    favorite_club?: string;
    favorite_national?: string;
  } | null;
}

export default function MatchesView({ onPronoClick, userProfile }: MatchesViewProps) {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompId, setSelectedCompId] = useState<number | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch('/api/competitions')
      .then(res => {
        if (!res.ok) {
          throw new Error("Temporairement indisponible");
        }
        return res.json();
      })
      .then(data => {
        // Football Data API puts competitions in 'competitions'
        setCompetitions(data.competitions || []);
        if (data.competitions?.length > 0) {
          // Premier League, Ligue 1, Champions League... try to pick Ligue 1 (FL1, id 2015) if available, else first
          const defaultComp = data.competitions.find((c: Competition) => c.id === 2015) || data.competitions[0];
          setSelectedCompId(defaultComp.id);
        }
        setLoading(false);
      })
      .catch(err => {
        setError("Chargement temporairement indisponible.");
        setLoading(false);
      });
  }, [retryTrigger]);

  useEffect(() => {
    if (!selectedCompId) return;
    setLoading(true);
    fetch(`/api/matches/${selectedCompId}`)
      .then(res => {
        if (!res.ok) throw new Error("Temporairement indisponible");
        return res.json();
      })
      .then(data => {
        setMatches(data.matches || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError("Chargement temporairement indisponible.");
        setLoading(false);
      });
  }, [selectedCompId]);

  // Compute Favorite Matches
  const userHeartMatches = userProfile && matches.filter(match => {
    const club = userProfile.favorite_club?.toLowerCase().trim();
    const national = userProfile.favorite_national?.toLowerCase().trim();
    if (!club && !national) return false;

    const homeName = (match.homeTeam.name || "").toLowerCase();
    const homeShort = (match.homeTeam.shortName || "").toLowerCase();
    const awayName = (match.awayTeam.name || "").toLowerCase();
    const awayShort = (match.awayTeam.shortName || "").toLowerCase();

    const matchesClub = club && (
      homeName.includes(club) || 
      homeShort.includes(club) || 
      awayName.includes(club) || 
      awayShort.includes(club)
    );

    const matchesNational = national && (
      homeName.includes(national) || 
      homeShort.includes(national) || 
      awayName.includes(national) || 
      awayShort.includes(national)
    );

    return matchesClub || matchesNational;
  }) || [];

  // General other matches avoiding duplication
  const otherMatches = matches.filter(match => !userHeartMatches.some(hm => hm.id === match.id));

  // Compute grouped matches
  const liveMatches = otherMatches.filter(m => ['LIVE', 'IN_PLAY', 'PAUSED'].includes(m.status));
  const upcomingMatches = otherMatches.filter(m => ['TIMED', 'SCHEDULED', 'POSTPONED'].includes(m.status));
  const finishedMatches = otherMatches.filter(m => ['FINISHED'].includes(m.status));

  // Compute Today's Matches across all matches in current view
  const todayMatches = matches.filter(m => {
    const matchDate = new Date(m.utcDate).toDateString();
    const today = new Date().toDateString();
    return matchDate === today;
  });

  // Find next match for favorites more explicitly
  const getNextMatchForTeam = (teamName?: string) => {
    if (!teamName) return null;
    const name = teamName.toLowerCase().trim();
    return matches
      .filter(m => 
        (m.homeTeam.name?.toLowerCase().includes(name) || m.homeTeam.shortName?.toLowerCase().includes(name)) ||
        (m.awayTeam.name?.toLowerCase().includes(name) || m.awayTeam.shortName?.toLowerCase().includes(name))
      )
      .filter(m => ['TIMED', 'SCHEDULED', 'LIVE', 'IN_PLAY'].includes(m.status))
      .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime())[0];
  };

  const nextClubMatch = getNextMatchForTeam(userProfile?.favorite_club);
  const nextNationalMatch = getNextMatchForTeam(userProfile?.favorite_national);

  if (loading && !competitions.length && !error) {
    return <div className="flex justify-center p-12 text-emerald-600"><Clock className="animate-spin w-8 h-8" /></div>;
  }

  if (error) {
    return (
      <div className="bg-emerald-50/50 text-emerald-850 p-8 rounded-2xl border border-emerald-100 flex flex-col items-center text-center mt-8 space-y-4">
        <Clock className="w-12 h-12 text-emerald-600 animate-pulse" />
        <h3 className="font-bold text-lg text-emerald-950">Mise à jour des matchs en cours...</h3>
        <p className="text-sm max-w-md text-emerald-800 font-medium leading-relaxed">
          Le service de données footballistiques est momentanément surchargé par un grand nombre de connexions. Vos défis et pronostics restent actifs et sécurisés. Veuillez patienter une minute puis réessayer le chargement.
        </p>
        <button
          onClick={() => {
            setLoading(true);
            setError(null);
            setRetryTrigger(prev => prev + 1);
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-5 rounded-xl text-sm transition-all shadow-sm shadow-emerald-700/20 active:scale-95 cursor-pointer mt-2"
        >
          Réessayer le chargement
        </button>
      </div>
    );
  }

  const renderMatchCard = (match: Match, isHeart = false) => {
    // Detect which team is the favorite one
    const club = userProfile?.favorite_club?.toLowerCase().trim();
    const national = userProfile?.favorite_national?.toLowerCase().trim();
    const isHomeHeart = club && ((match.homeTeam.name || "").toLowerCase().includes(club) || (match.homeTeam.shortName || "").toLowerCase().includes(club)) ||
                        national && ((match.homeTeam.name || "").toLowerCase().includes(national) || (match.homeTeam.shortName || "").toLowerCase().includes(national));
    const isAwayHeart = club && ((match.awayTeam.name || "").toLowerCase().includes(club) || (match.awayTeam.shortName || "").toLowerCase().includes(club)) ||
                        national && ((match.awayTeam.name || "").toLowerCase().includes(national) || (match.awayTeam.shortName || "").toLowerCase().includes(national));

    const isLive = ['LIVE', 'IN_PLAY', 'PAUSED'].includes(match.status);
    const isFinished = match.status === 'FINISHED';

    return (
      <div 
        key={match.id} 
        className={`rounded-2xl p-5 border-2 transition duration-200 relative overflow-hidden ${
          isHeart 
            ? "bg-rose-50/50 border-rose-300 shadow-md ring-2 ring-rose-500/10 hover:shadow-lg" 
            : "bg-white border-slate-200/95 shadow-md hover:shadow-lg hover:border-emerald-300"
        }`}
      >
        {isHeart && (
          <div className="absolute top-0 right-0 bg-rose-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-bl-xl uppercase tracking-wider flex items-center gap-1">
            ❤️ Cœur ♥️
          </div>
        )}

        <div className="flex justify-between items-center mb-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          <span>{new Date(match.utcDate).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} • {new Date(match.utcDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
          {isLive ? (
            <span className="bg-rose-100 text-rose-600 px-2 py-1 rounded animate-pulse border border-rose-200 font-black">EN DIRECT</span>
          ) : isFinished ? (
            <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded font-bold">TERMINÉ</span>
          ) : (
            <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded font-bold">À VENIR</span>
          )}
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center flex-1 relative">
            <img src={match.homeTeam.crest} alt={match.homeTeam.name} className="w-12 h-12 object-contain mb-2" onError={(e) => { e.currentTarget.style.display='none' }} />
            <span className={`font-bold text-center text-sm md:text-base text-gray-800 ${isHomeHeart ? "text-rose-650 underline decoration-rose-450 decoration-2" : ""}`}>
              {match.homeTeam.shortName || match.homeTeam.name} {isHomeHeart && "❤️"}
            </span>
          </div>
          
          <div className="flex-1 flex flex-col justify-center items-center px-4">
            {(isLive || isFinished) ? (
              <div className="font-black text-slate-900 text-2xl tracking-tighter flex items-center gap-1.5">
                <span>{match.score.fullTime.home}</span>
                <span className="text-gray-300">-</span>
                <span>{match.score.fullTime.away}</span>
              </div>
            ) : (
              <div className="font-black text-gray-300 text-xl">VS</div>
            )}
            {isLive && <span className="text-[10px] font-bold text-rose-500 mt-1 uppercase">Match en cours</span>}
          </div>
          
          <div className="flex flex-col items-center flex-1 relative">
            <img src={match.awayTeam.crest} alt={match.awayTeam.name} className="w-12 h-12 object-contain mb-2" onError={(e) => { e.currentTarget.style.display='none' }} />
            <span className={`font-bold text-center text-sm md:text-base text-gray-800 ${isAwayHeart ? "text-rose-650 underline decoration-rose-450 decoration-2" : ""}`}>
              {match.awayTeam.shortName || match.awayTeam.name} {isAwayHeart && "❤️"}
            </span>
          </div>
        </div>

        {!isFinished && (
          <div className="mt-4 pt-4 border-t border-gray-50 flex justify-center">
            <button 
              onClick={() => onPronoClick?.(match, selectedCompId!)}
              className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-all cursor-pointer hover:scale-105 active:scale-95"
            >
              Faire mon prono <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      {/* Heart Teams Info Zone - Refined Design */}
      {userProfile && (userProfile.favorite_club || userProfile.favorite_national) && (
        <div className="bg-white border-2 border-slate-100 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-50">
            <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-800">
              ⭐ Mes Équipes Favoris
            </h3>
            <div className="bg-emerald-50 text-emerald-600 p-1.5 rounded-lg">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
            {/* Club Card */}
            <div className="bg-gray-50/50 rounded-xl p-4 border border-gray-100">
              <span className="block text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-tight">Club Favori</span>
              <span className="block font-black text-slate-900 truncate mb-2">{userProfile.favorite_club || "Non défini"}</span>
              {nextClubMatch ? (
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full self-start">
                    Prochain: {new Date(nextClubMatch.utcDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                  <span className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter">
                    {competitions.find(c => c.id === selectedCompId)?.name || "Compétition"}
                  </span>
                  <span className="text-[9px] text-gray-400 truncate font-semibold italic">
                    vs {nextClubMatch.homeTeam.name?.toLowerCase().includes(userProfile.favorite_club?.toLowerCase() || "") ? nextClubMatch.awayTeam.shortName : nextClubMatch.homeTeam.shortName}
                  </span>
                </div>
              ) : (
                <span className="text-[9px] text-gray-400 font-medium italic">Aucun match détecté</span>
              )}
            </div>

            {/* National Card */}
            <div className="bg-gray-50/50 rounded-xl p-4 border border-gray-100">
              <span className="block text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-tight">Équipe Nationale</span>
              <span className="block font-black text-slate-900 truncate mb-2">{userProfile.favorite_national || "Non défini"}</span>
              {nextNationalMatch ? (
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full self-start">
                    Prochain: {new Date(nextNationalMatch.utcDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                  <span className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter">
                    {competitions.find(c => c.id === selectedCompId)?.name || "Compétition"}
                  </span>
                  <span className="text-[9px] text-gray-400 truncate font-semibold italic">
                    vs {nextNationalMatch.homeTeam.name?.toLowerCase().includes(userProfile.favorite_national?.toLowerCase() || "") ? nextNationalMatch.awayTeam.shortName : nextNationalMatch.homeTeam.shortName}
                  </span>
                </div>
              ) : (
                <span className="text-[9px] text-gray-400 font-medium italic">Aucun match détecté</span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center space-x-2 bg-white rounded-xl shadow-sm px-4 py-2 border border-gray-100">
        <Search className="w-5 h-5 text-gray-400" />
        <select 
          className="flex-1 bg-transparent py-2 text-sm font-medium outline-none text-gray-700 w-full"
          value={selectedCompId || ''}
          onChange={(e) => setSelectedCompId(Number(e.target.value))}
        >
          {competitions.map(comp => (
            <option key={comp.id} value={comp.id}>{comp.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-8 pb-8">
        {loading && <div className="flex justify-center p-6"><Clock className="animate-spin text-emerald-500 w-6 h-6" /></div>}
        
        {!loading && matches.length === 0 && (
          <div className="text-center p-8 bg-white rounded-2xl shadow-sm text-gray-500 border border-gray-100">
            Aucun match programmé trouvé pour le moment.
          </div>
        )}

        {/* Matches of Today Section */}
        {!loading && todayMatches.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest pl-1 border-l-4 border-slate-900 flex items-center gap-2">
              <span>⚡ Matchs du Jour</span>
              <div className="h-[1px] bg-slate-100 flex-1"></div>
            </h3>
            <div className="grid grid-cols-1 gap-4">
              {todayMatches.map(match => renderMatchCard(match, userHeartMatches.some(hm => hm.id === match.id)))}
            </div>
          </div>
        )}

        {/* Heart Matches Section */}
        {!loading && userHeartMatches.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xs font-black text-rose-600 uppercase tracking-widest pl-1 border-l-4 border-rose-500 flex items-center gap-2">
              <span>❤️ Focus : Mes Équipes ❤️</span>
              <div className="h-[1px] bg-rose-200 flex-1"></div>
            </h3>
            <div className="grid grid-cols-1 gap-4">
              {userHeartMatches.map(match => renderMatchCard(match, true))}
            </div>
          </div>
        )}

        {/* Live Matches */}
        {!loading && liveMatches.length > 0 && (
          <div className="space-y-4 border-t border-rose-100 pt-6">
            <h3 className="text-xs font-black text-rose-500 uppercase tracking-widest pl-1 border-l-4 border-rose-400 flex items-center gap-2">
              <span className="flex items-center gap-1.5">🔴 En Direct <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping"></span></span>
              <div className="h-[1px] bg-rose-100 flex-1"></div>
            </h3>
            <div className="grid grid-cols-1 gap-4">
              {liveMatches.map(match => renderMatchCard(match, false))}
            </div>
          </div>
        )}

        {/* Upcoming Matches */}
        {!loading && upcomingMatches.length > 0 && (
          <div className="space-y-4 border-t border-emerald-100 pt-6">
            <h3 className="text-xs font-black text-emerald-600 uppercase tracking-widest pl-1 border-l-4 border-emerald-500 flex items-center gap-2">
              <span>📅 Prochains Matchs</span>
              <div className="h-[1px] bg-emerald-100 flex-1"></div>
            </h3>
            <div className="grid grid-cols-1 gap-4">
              {upcomingMatches.map(match => renderMatchCard(match, false))}
            </div>
          </div>
        )}

        {/* Finished Matches */}
        {!loading && finishedMatches.length > 0 && (
          <div className="space-y-4 border-t border-slate-100 pt-6">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1 border-l-4 border-slate-400 flex items-center gap-2">
              <span>✅ Matchs Terminés</span>
              <div className="h-[1px] bg-slate-100 flex-1"></div>
            </h3>
            <div className="grid grid-cols-1 gap-4">
              {finishedMatches.map(match => renderMatchCard(match, false))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
