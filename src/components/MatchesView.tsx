import { useEffect, useState } from 'react';
import { Match, Competition } from '../types';
import { AlertCircle, Clock, Search, ChevronRight, X, CalendarCheck } from 'lucide-react';

interface MatchesViewProps {
  onPronoClick?: (match: Match, competitionId: number) => void;
  userProfile?: {
    username: string;
    avatar_type: "emoji" | "jersey";
    avatar_value: string;
    favorite_club?: string;
    favorite_national?: string;
    favorite_competitions?: string;
  } | null;
  onProfileUpdate?: (updated: any) => void;
}

export default function MatchesView({ onPronoClick, userProfile, onProfileUpdate }: MatchesViewProps) {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompId, setSelectedCompId] = useState<number | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [todayMatches, setTodayMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [isAddingTeam, setIsAddingTeam] = useState<{type: 'club' | 'national' | 'competition'} | null>(null);
  const [newTeamName, setNewTeamName] = useState("");
  const [selectedCompObj, setSelectedCompObj] = useState<Competition | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // Fetch competitions and Today's matches
    setLoading(true);
    setError(null);

    Promise.all([
      fetch('/api/competitions').then(res => res.json()),
      fetch('/api/matches/today').then(res => res.json())
    ])
    .then(([compData, todayData]) => {
      setCompetitions(compData.competitions || []);
      setTodayMatches(todayData.matches || []);
      
      if (compData.competitions?.length > 0) {
        const defaultComp = compData.competitions.find((c: Competition) => c.id === 2015) || compData.competitions[0];
        setSelectedCompId(defaultComp.id);
      }
      setLoading(false);
    })
    .catch(err => {
      console.error(err);
      setError("Chargement temporairement indisponible.");
      setLoading(false);
    });
  }, [retryTrigger]);

  useEffect(() => {
    if (!selectedCompId) return;
    setLoading(true);
    fetch(`/api/matches/${selectedCompId}`)
      .then(res => res.json())
      .then(data => {
        setMatches(data.matches || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [selectedCompId]);

  // Helper to get multiple favorite teams from string
  const getFavoriteClubs = () => userProfile?.favorite_club?.split(',').map(s => s.trim()).filter(Boolean) || [];
  const getFavoriteNationals = () => userProfile?.favorite_national?.split(',').map(s => s.trim()).filter(Boolean) || [];
  const getFavoriteCompetitionNames = () => userProfile?.favorite_competitions?.split(',').map(s => s.trim()).filter(Boolean) || [];

  // Helper for robust name matching across multiple queries
  const matchesTeamWithQueryList = (team: any, queryList: string[]) => {
    const name = (team.name || "").toLowerCase();
    const short = (team.shortName || "").toLowerCase();
    const tla = (team.tla || "").toLowerCase();
    
    return queryList.some(query => {
      const q = query.toLowerCase();
      if (name.includes(q) || short.includes(q) || tla.includes(q)) return true;
      if (q === "maroc" && (name.includes("morocco") || tla === "mar")) return true;
      if (q === "real madrid" && (name.includes("real madrid") || tla === "rma")) return true;
      return false;
    });
  };

  // Combine matches to search favorites
  const allLoadedMatches = [...todayMatches, ...matches].reduce((acc, curr) => {
    if (!acc.find(m => m.id === curr.id)) acc.push(curr);
    return acc;
  }, [] as Match[]);

  // Compute Favorite Matches
  const userHeartMatches = userProfile && allLoadedMatches.filter(match => {
    const clubs = getFavoriteClubs();
    const nationals = getFavoriteNationals();
    if (clubs.length === 0 && nationals.length === 0) return false;

    const matchesClub = matchesTeamWithQueryList(match.homeTeam, clubs) || matchesTeamWithQueryList(match.awayTeam, clubs);
    const matchesNational = matchesTeamWithQueryList(match.homeTeam, nationals) || matchesTeamWithQueryList(match.awayTeam, nationals);

    return matchesClub || matchesNational;
  }) || [];

  // General other matches avoiding duplication
  const otherMatches = matches.filter(match => !userHeartMatches.some(hm => hm.id === match.id));

  // Compute grouped matches
  const liveMatches = otherMatches.filter(m => ['LIVE', 'IN_PLAY', 'PAUSED'].includes(m.status));
  const upcomingMatches = otherMatches.filter(m => ['TIMED', 'SCHEDULED', 'POSTPONED'].includes(m.status));

  // Helper to get team crest (national or club) fallback
  const getTeamCrest = (name: string) => {
    if (!name) return null;
    
    // Normalize string: remove accents, lowercase, trim
    const n = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    
    const mapping: Record<string, string> = {
      "maroc": "ma", "morocco": "ma",
      "france": "fr",
      "allemagne": "de", "germany": "de",
      "espagne": "es", "spain": "es",
      "italie": "it", "italy": "it",
      "portugal": "pt",
      "angleterre": "gb-eng", "england": "gb-eng", "royaume-uni": "gb",
      "belgique": "be", "belgium": "be",
      "pays-bas": "nl", "netherlands": "nl",
      "bresil": "br", "brazil": "br",
      "argentine": "ar", "argentia": "ar",
      "suisse": "ch", "switzerland": "ch",
      "croatie": "hr", "croatia": "hr",
      "senegal": "sn",
      "algerie": "dz", "algeria": "dz",
      "tunisie": "tn", "tunisia": "tn",
      "egypte": "eg", "egypt": "eg",
      "cote d'ivoire": "ci", "ivory coast": "ci", "cote divoire": "ci",
      "cameroun": "cm", "cameroon": "cm",
      "mali": "ml",
      "japon": "jp", "japan": "jp",
      "uruguay": "uy",
      "mexique": "mx", "mexico": "mx",
      "etats-unis": "us", "usa": "us",
      "canada": "ca",
      "australie": "au", "australia": "au"
    };
    
    for (const [key, code] of Object.entries(mapping)) {
      if (n.includes(key)) return `https://flagcdn.com/w160/${code}.png`;
    }

    // Top clubs fallback
    if (n.includes("real madrid")) return "https://crests.football-data.org/86.svg";
    if (n.includes("barcelona")) return "https://crests.football-data.org/81.svg";
    if (n.includes("manchester city")) return "https://crests.football-data.org/65.svg";
    if (n.includes("manchester united")) return "https://crests.football-data.org/66.svg";
    if (n.includes("liverpool")) return "https://crests.football-data.org/64.svg";
    if (n.includes("arsenal")) return "https://crests.football-data.org/57.svg";
    if (n.includes("bayern")) return "https://crests.football-data.org/5.svg";
    if (n.includes("psg") || n.includes("paris saint-germain")) return "https://crests.football-data.org/524.svg";
    if (n.includes("milan")) return "https://crests.football-data.org/98.svg";
    if (n.includes("inter")) return "https://crests.football-data.org/108.svg";
    if (n.includes("juventus")) return "https://crests.football-data.org/109.svg";
    if (n.includes("dortmund")) return "https://crests.football-data.org/4.svg";
    if (n.includes("monaco")) return "https://crests.football-data.org/548.svg";
    
    return null;
  };

  // Find next/last matches for a team
  const getMatchesForTeam = (teamName: string) => {
    const query = teamName.toLowerCase().trim();
    const matchesTeam = (team: any) => {
      const name = (team.name || "").toLowerCase();
      const short = (team.shortName || "").toLowerCase();
      const tla = (team.tla || "").toLowerCase();
      if (name.includes(query) || short.includes(query) || tla.includes(query)) return true;
      if (query === "maroc" && (name.includes("morocco") || tla === "mar")) return true;
      if (query === "real madrid" && (name.includes("real madrid") || tla === "rma")) return true;
      return false;
    };

    const teamMatches = allLoadedMatches.filter(m => matchesTeam(m.homeTeam) || matchesTeam(m.awayTeam));
    
    const next = teamMatches
      .filter(m => ['TIMED', 'SCHEDULED', 'LIVE', 'IN_PLAY'].includes(m.status))
      .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime())[0] || null;

    const last = teamMatches
      .filter(m => ['FINISHED'].includes(m.status))
      .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime())[0] || null;

    // Try to find the crest url
    let crest = "";
    const teamRecord = teamMatches.find(m => matchesTeam(m.homeTeam))?.homeTeam || teamMatches.find(m => matchesTeam(m.awayTeam))?.awayTeam;
    if (teamRecord) crest = teamRecord.crest;

    // Fallback for teams
    if (!crest) {
      crest = getTeamCrest(teamName) || "";
    }

    return { last, next, crest };
  };

  const handleAddTeam = async () => {
    const isComp = isAddingTeam?.type === 'competition';
    if (!isComp && !newTeamName.trim() || !userProfile || !onProfileUpdate) {
      if (isComp && !selectedCompObj) return;
      if (!isComp && !newTeamName.trim()) return;
    }
    
    setIsUpdating(true);
    
    const type = isAddingTeam?.type;
    let currentList: string[] = [];
    let nameToAdd = "";

    if (type === 'club') {
      currentList = getFavoriteClubs();
      nameToAdd = newTeamName.trim();
    } else if (type === 'national') {
      currentList = getFavoriteNationals();
      nameToAdd = newTeamName.trim();
    } else if (type === 'competition' && selectedCompObj) {
      currentList = getFavoriteCompetitionNames();
      nameToAdd = selectedCompObj.name;
    }
    
    if (!nameToAdd) {
      setIsUpdating(false);
      setIsAddingTeam(null);
      return;
    }

    // Check if already exists
    if (currentList.some(t => t.toLowerCase() === nameToAdd.toLowerCase())) {
      setIsAddingTeam(null);
      setNewTeamName("");
      setSelectedCompObj(null);
      setIsUpdating(false);
      return;
    }

    const newList = [...currentList, nameToAdd].join(', ');
    
    try {
      if (type === 'competition') {
          // Store locally for sessions where user is on this browser
          localStorage.setItem(`fav_comps_${userProfile.username}`, newList);
          onProfileUpdate({
            ...userProfile,
            favorite_competitions: newList
          });
      } else {
        const { supabase } = await import('../lib/supabase');
        if (supabase) {
          const { data: authUser } = await supabase.auth.getUser();
          if (authUser.user) {
            let updateData = {};
            if (type === 'club') updateData = { first_name: newList };
            else if (type === 'national') updateData = { last_name: newList };

            await supabase.from('profiles').update(updateData).eq('id', authUser.user.id);
            
            onProfileUpdate({
              ...userProfile,
              favorite_club: type === 'club' ? newList : userProfile.favorite_club,
              favorite_national: type === 'national' ? newList : userProfile.favorite_national,
            });
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsUpdating(false);
      setIsAddingTeam(null);
      setNewTeamName("");
      setSelectedCompObj(null);
    }
  };

  const handleRemoveTeam = async (name: string, type: 'club' | 'national' | 'competition') => {
    if (!userProfile || !onProfileUpdate) return;
    
    let currentList: string[] = [];
    if (type === 'club') currentList = getFavoriteClubs();
    else if (type === 'national') currentList = getFavoriteNationals();
    else if (type === 'competition') currentList = getFavoriteCompetitionNames();

    const newList = currentList.filter(n => n !== name).join(', ');

    try {
      if (type === 'competition') {
          // Store locally
          localStorage.setItem(`fav_comps_${userProfile.username}`, newList);
          onProfileUpdate({
            ...userProfile,
            favorite_competitions: newList
          });
      } else {
        const { supabase } = await import('../lib/supabase');
        if (supabase) {
          const { data: authUser } = await supabase.auth.getUser();
          if (authUser.user) {
            let updateData = {};
            if (type === 'club') updateData = { first_name: newList };
            else if (type === 'national') updateData = { last_name: newList };

            await supabase.from('profiles').update(updateData).eq('id', authUser.user.id);
            
            onProfileUpdate({
              ...userProfile,
              favorite_club: type === 'club' ? newList : userProfile.favorite_club,
              favorite_national: type === 'national' ? newList : userProfile.favorite_national,
            });
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

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
            ? "bg-emerald-50/30 border-emerald-200 shadow-md ring-2 ring-emerald-500/5 hover:shadow-lg" 
            : "bg-white border-slate-200/95 shadow-md hover:shadow-lg hover:border-emerald-300"
        }`}
      >
        {isHeart && (
          <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-bl-xl uppercase tracking-wider flex items-center gap-1">
            ⭐ Favori
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
              <img 
                src={match.homeTeam.crest} 
                alt={match.homeTeam.name} 
                className="w-12 h-12 object-contain mb-2" 
                onError={(e) => { 
                  const fallback = getTeamCrest(match.homeTeam.name);
                  if (fallback && e.currentTarget.src !== fallback) {
                    e.currentTarget.src = fallback;
                  } else {
                    e.currentTarget.src = "https://www.google.com/s2/favicons?domain=fifa.com&sz=128";
                  }
                }} 
              />
              <span className={`font-bold text-center text-sm md:text-base text-gray-800 ${isHomeHeart ? "text-emerald-700 underline decoration-emerald-400 decoration-2" : ""}`}>
                {match.homeTeam.shortName || match.homeTeam.name} {isHomeHeart && "⭐"}
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
              {match.venue && (
                <span className="text-[8px] font-bold text-gray-400 mt-2 uppercase text-center leading-tight">
                  🏟️ {match.venue}
                </span>
              )}
            </div>
            
            <div className="flex flex-col items-center flex-1 relative">
              <img 
                src={match.awayTeam.crest} 
                alt={match.awayTeam.name} 
                className="w-12 h-12 object-contain mb-2" 
                onError={(e) => { 
                  const fallback = getTeamCrest(match.awayTeam.name);
                  if (fallback && e.currentTarget.src !== fallback) {
                    e.currentTarget.src = fallback;
                  } else {
                    e.currentTarget.src = "https://www.google.com/s2/favicons?domain=fifa.com&sz=128";
                  }
                }} 
              />
            <span className={`font-bold text-center text-sm md:text-base text-gray-800 ${isAwayHeart ? "text-emerald-700 underline decoration-emerald-400 decoration-2" : ""}`}>
              {match.awayTeam.shortName || match.awayTeam.name} {isAwayHeart && "⭐"}
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
      {/* 1. Selector (Ligue) first */}
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

      {/* 4. Zone Matchs du Jour - MOVED ABOVE FOR BETTER VISIBILITY */}
      <div className="space-y-4">
        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest pl-1 border-l-4 border-slate-900 flex items-center gap-2">
          <span>⚡ Matchs du Jour (Toutes Compétitions)</span>
          <div className="h-[1px] bg-slate-100 flex-1"></div>
        </h3>
        
        {loading ? (
          <div className="flex justify-center p-8"><Clock className="animate-spin text-emerald-500 w-6 h-6" /></div>
        ) : todayMatches.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {todayMatches.map(match => renderMatchCard(match, userHeartMatches.some(hm => hm.id === match.id)))}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-2xl p-8 border-2 border-dashed border-gray-200 text-center flex flex-col items-center gap-3">
            <CalendarCheck className="w-8 h-8 text-gray-300" />
            <p className="text-sm font-bold text-gray-400">Aucun match détecté aujourd'hui.</p>
          </div>
        )}
      </div>

      {/* 2. Heart Teams & Compétitions Info Zone */}
      {userProfile && (
        <div className="bg-white border-2 border-slate-100 rounded-3xl p-6 shadow-sm relative overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-50">
            <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-800">
              ⭐ Mes Équipes & Compétitions Favorites
            </h3>
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => setIsAddingTeam({type: 'club'})}
                className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tight hover:bg-emerald-100 transition-colors flex items-center gap-1 cursor-pointer"
              >
                + Club
              </button>
              <button 
                onClick={() => setIsAddingTeam({type: 'national'})}
                className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tight hover:bg-indigo-100 transition-colors flex items-center gap-1 cursor-pointer"
              >
                + Nation
              </button>
              <button 
                onClick={() => setIsAddingTeam({type: 'competition'})}
                className="bg-amber-50 text-amber-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tight hover:bg-amber-100 transition-colors flex items-center gap-1 cursor-pointer"
              >
                + Ligue
              </button>
            </div>
          </div>

          {isAddingTeam && (
            <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100 animate-in slide-in-from-top-2 duration-200">
              <div className="flex gap-2">
                {isAddingTeam.type === 'competition' ? (
                  <select 
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500"
                    onChange={(e) => {
                      const comp = competitions.find(c => c.id === Number(e.target.value));
                      if (comp) setSelectedCompObj(comp);
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>Sélectionner une compétition...</option>
                    {competitions.map(comp => (
                      <option key={comp.id} value={comp.id}>{comp.name}</option>
                    ))}
                  </select>
                ) : (
                  <input 
                    type="text" 
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder={`Nom du ${isAddingTeam.type === 'club' ? 'club' : 'pays'}...`}
                    className={`flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 ${isAddingTeam.type === 'club' ? 'focus:ring-emerald-500' : 'focus:ring-indigo-500'}`}
                    autoFocus
                  />
                )}
                <button 
                  onClick={handleAddTeam}
                  disabled={isUpdating}
                  className={`${isAddingTeam.type === 'competition' ? 'bg-amber-600' : isAddingTeam.type === 'club' ? 'bg-emerald-600' : 'bg-indigo-600'} text-white px-4 py-2 rounded-xl text-xs font-black uppercase disabled:opacity-50 cursor-pointer transition-colors`}
                >
                  {isUpdating ? '...' : 'Ajouter'}
                </button>
                <button 
                  onClick={() => { setIsAddingTeam(null); setNewTeamName(""); setSelectedCompObj(null); }}
                  className="bg-gray-200 text-gray-500 px-3 py-2 rounded-xl text-xs font-black cursor-pointer"
                >
                  X
                </button>
              </div>
            </div>
          )}

          {getFavoriteClubs().length === 0 && getFavoriteNationals().length === 0 && getFavoriteCompetitionNames().length === 0 ? (
            <div className="py-12 bg-emerald-50/20 rounded-3xl border-2 border-dashed border-emerald-100 flex flex-col items-center gap-6 px-4">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-600/10 border-4 border-emerald-50">
                <Search className="w-10 h-10 text-emerald-500" />
              </div>
              <div className="text-center max-w-sm">
                <h4 className="text-lg font-black text-slate-900 mb-2">Configurez votre expérience</h4>
                <p className="text-sm font-bold text-slate-500 leading-relaxed mb-6">
                  Ajoutez vos clubs et nations de cœur pour ne plus jamais rater un match ou un résultat important !
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <button 
                    onClick={() => setIsAddingTeam({type: 'club'})}
                    className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200 cursor-pointer active:scale-95"
                  >
                    Ajouter mon Club
                  </button>
                  <button 
                    onClick={() => setIsAddingTeam({type: 'national'})}
                    className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 cursor-pointer active:scale-95"
                  >
                    Ajouter ma Nation
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
              {/* Display Competitions Favorites first */}
              {getFavoriteCompetitionNames().map((compName, idx) => {
                const compObj = competitions.find(c => c.name === compName);
                return (
                  <div key={`comp-${idx}`} className="bg-amber-50/20 rounded-2xl p-4 border border-amber-100/30 flex flex-col group relative">
                    <button 
                      onClick={() => handleRemoveTeam(compName, 'competition')}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-rose-500 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center p-1.5 shadow-sm">
                        {compObj?.emblem ? (
                          <img src={compObj.emblem} alt={compName} className="w-full h-full object-contain" />
                        ) : (
                          "🏆"
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="block text-[8px] font-black text-amber-500 uppercase tracking-tight">Compétition</span>
                        <span className="font-black text-slate-900 text-sm truncate block">{compName}</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Display Club Favorites */}
              {getFavoriteClubs().map((clubName, idx) => {
                const data = getMatchesForTeam(clubName);
                return (
                  <div key={`club-${idx}`} className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100/50 flex flex-col group relative">
                    <button 
                      onClick={() => handleRemoveTeam(clubName, 'club')}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-rose-500 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center p-1.5 shadow-sm">
                        {data.crest ? (
                          <img src={data.crest} alt={clubName} className="w-full h-full object-contain" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-gray-300" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="block text-[8px] font-black text-gray-400 uppercase tracking-tight">Club</span>
                        <span className="font-black text-slate-900 text-sm truncate block">{clubName}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      {/* Last Match */}
                      <div className="bg-white rounded-xl p-2.5 border border-gray-50 shadow-xs">
                        <span className="block text-[8px] font-black text-gray-300 uppercase mb-1 flex items-center gap-1">
                          Dernier Match
                        </span>
                        {data.last ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-1.5 min-w-0">
                              <span className="text-[10px] font-extrabold text-slate-800 truncate">{data.last.homeTeam.shortName || data.last.homeTeam.name}</span>
                              <div className="bg-slate-900 text-white px-1.5 py-0.5 rounded font-mono text-[9px] font-black">
                                {data.last.score.fullTime.home}-{data.last.score.fullTime.away}
                              </div>
                              <span className="text-[10px] font-extrabold text-slate-800 truncate">{data.last.awayTeam.shortName || data.last.awayTeam.name}</span>
                            </div>
                            <div className="flex justify-between items-center text-[7px] font-bold text-gray-400 uppercase tracking-tighter">
                              <span>{new Date(data.last.utcDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} • {new Date(data.last.utcDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                              <span className="text-right ml-1">{data.last.competition.name}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[8px] text-gray-400 font-medium italic">Aucun historique</span>
                        )}
                      </div>

                      {/* Next Match */}
                      <div className="bg-emerald-50/50 rounded-xl p-2.5 border border-emerald-50/50 shadow-xs">
                        <span className="block text-[8px] font-black text-emerald-600 uppercase mb-1 flex items-center gap-1">
                          Prochain Match
                        </span>
                        {data.next ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-emerald-950 truncate max-w-[100px]">
                                vs {data.next.homeTeam.name?.toLowerCase().includes(clubName.toLowerCase()) ? data.next.awayTeam.shortName : data.next.homeTeam.shortName}
                              </span>
                              <span className="text-[8px] font-black text-emerald-600 bg-white border border-emerald-100 px-1 rounded">
                                {new Date(data.next.utcDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-[7px] font-bold text-emerald-600/70 uppercase tracking-tighter">
                              <span>{new Date(data.next.utcDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                              <span className="text-right ml-1">{data.next.competition.name || "Match Amical"}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[8px] text-gray-400 font-medium italic">Aucun match détecté</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Display National Favorites */}
              {getFavoriteNationals().map((name, idx) => {
                const data = getMatchesForTeam(name);
                return (
                  <div key={`nat-${idx}`} className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100/50 flex flex-col group relative">
                    <button 
                      onClick={() => handleRemoveTeam(name, 'national')}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-rose-500 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-3 mb-4">
                             <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center p-1.5 shadow-sm font-bold text-lg">
                               {data.crest ? (
                                 <img 
                                   src={data.crest} 
                                   alt={name} 
                                   className="w-full h-full object-contain" 
                                   onError={(e) => {
                                     // If API crest fails, try the national flag fallback
                                     const fallback = getTeamCrest(name);
                                     if (fallback && e.currentTarget.src !== fallback) {
                                       e.currentTarget.src = fallback;
                                     } else {
                                       e.currentTarget.style.display = 'none';
                                     }
                                   }}
                                 />
                               ) : null}
                      {(!data.crest || data.crest === "") && (
                        <span className="text-2xl">🏳️</span>
                      )}
                    </div>
                      <div className="min-w-0">
                        <span className="block text-[8px] font-black text-gray-400 uppercase tracking-tight">Nation</span>
                        <span className="font-black text-slate-900 text-sm truncate block">{name}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      {/* Last Match */}
                      <div className="bg-white rounded-xl p-2.5 border border-gray-50 shadow-xs">
                        <span className="block text-[8px] font-black text-gray-300 uppercase mb-1 flex items-center gap-1">
                          Dernier Match
                        </span>
                        {data.last ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-1.5 min-w-0">
                              <span className="text-[10px] font-extrabold text-slate-800 truncate">{data.last.homeTeam.shortName || data.last.homeTeam.name}</span>
                              <div className="bg-slate-900 text-white px-1.5 py-0.5 rounded font-mono text-[9px] font-black">
                                {data.last.score.fullTime.home}-{data.last.score.fullTime.away}
                              </div>
                              <span className="text-[10px] font-extrabold text-slate-800 truncate">{data.last.awayTeam.shortName || data.last.awayTeam.name}</span>
                            </div>
                            <div className="flex justify-between items-center text-[7px] font-bold text-gray-400 uppercase tracking-tighter">
                              <span>{new Date(data.last.utcDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} • {new Date(data.last.utcDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                              <span className="text-right ml-1">{data.last.competition.name}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[8px] text-gray-400 font-medium italic">Aucun historique</span>
                        )}
                      </div>

                      {/* Next Match */}
                      <div className="bg-indigo-50/50 rounded-xl p-2.5 border border-indigo-50/50 shadow-xs">
                        <span className="block text-[8px] font-black text-indigo-600 uppercase mb-1 flex items-center gap-1">
                          Prochain Match
                        </span>
                        {data.next ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-indigo-950 truncate max-w-[100px]">
                                vs {data.next.homeTeam.name?.toLowerCase().includes(name.toLowerCase()) ? data.next.awayTeam.shortName : data.next.homeTeam.shortName}
                              </span>
                              <span className="text-[8px] font-black text-indigo-600 bg-white border border-indigo-100 px-1 rounded">
                                {new Date(data.next.utcDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-[7px] font-bold text-indigo-600/70 uppercase tracking-tighter">
                              <span>{new Date(data.next.utcDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                              <span className="text-right ml-1">{data.next.competition.name || "Match Amical"}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[8px] text-gray-400 font-medium italic">Aucun match détecté</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="space-y-8 pb-8">
        {!loading && matches.length === 0 && todayMatches.length === 0 && (
          <div className="text-center p-8 bg-white rounded-2xl shadow-sm text-gray-500 border border-gray-100">
            Aucun match programmé trouvé pour le moment dans cette compétition.
          </div>
        )}

        {/* Live Matches */}
        {!loading && liveMatches.length > 0 && (
          <div className="space-y-4 border-t border-slate-100 pt-6">
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
              <span>📅 Prochains Matchs de la Compétition</span>
              <div className="h-[1px] bg-emerald-100 flex-1"></div>
            </h3>
            <div className="grid grid-cols-1 gap-4">
              {upcomingMatches.map(match => renderMatchCard(match, false))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
