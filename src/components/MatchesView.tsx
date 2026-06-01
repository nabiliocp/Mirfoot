import { useEffect, useState } from 'react';
import { Match, Competition } from '../types';
import { AlertCircle, Clock, Search, ChevronRight } from 'lucide-react';

export default function MatchesView() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompId, setSelectedCompId] = useState<number | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/competitions')
      .then(res => {
        if (!res.ok) {
          if (res.status === 401) throw new Error("Clé d'API Football Data manquante.");
          throw new Error("Erreur réseau");
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
        setError(err.message);
        setLoading(false);
      });
  }, []);

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

  if (loading && !competitions.length && !error) {
    return <div className="flex justify-center p-12 text-emerald-600"><Clock className="animate-spin w-8 h-8" /></div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-700 p-6 rounded-2xl border border-red-100 flex flex-col items-center text-center mt-8">
        <AlertCircle className="w-12 h-12 mb-4 text-red-500" />
        <h3 className="font-bold text-lg mb-2">Configuration requise</h3>
        <p className="text-sm">
          {error} Veuillez ajouter <span className="font-mono bg-red-100 px-1 rounded">FOOTBALL_DATA_API_KEY</span> dans les 'Secrets' via le menu de Google AI Studio pour récupérer les compétitions en direct. Vous pouvez obtenir une clé gratuite sur football-data.org.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
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

      <div className="space-y-4">
        {loading && <div className="flex justify-center p-6"><Clock className="animate-spin text-emerald-500 w-6 h-6" /></div>}
        
        {!loading && matches.length === 0 && (
          <div className="text-center p-8 bg-white rounded-2xl shadow-sm text-gray-500 border border-gray-100">
            Aucun match programmé trouvé pour le moment.
          </div>
        )}

        {!loading && matches.map(match => (
          <div key={match.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 transition hover:shadow-md">
            <div className="flex justify-between items-center mb-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              <span>{new Date(match.utcDate).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} • {new Date(match.utcDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded">À venir</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex flex-col items-center flex-1">
                <img src={match.homeTeam.crest} alt={match.homeTeam.name} className="w-12 h-12 object-contain mb-2" fallback-src="https://via.placeholder.com/48" onError={(e) => { e.currentTarget.style.display='none' }} />
                <span className="font-bold text-center text-sm md:text-base text-gray-800">{match.homeTeam.shortName}</span>
              </div>
              
              <div className="flex-1 flex justify-center items-center font-black text-gray-300 text-xl px-4">
                VS
              </div>
              
              <div className="flex flex-col items-center flex-1">
                <img src={match.awayTeam.crest} alt={match.awayTeam.name} className="w-12 h-12 object-contain mb-2" onError={(e) => { e.currentTarget.style.display='none' }} />
                <span className="font-bold text-center text-sm md:text-base text-gray-800">{match.awayTeam.shortName}</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-50 flex justify-center">
              <button className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-all cursor-pointer hover:scale-105 active:scale-95">
                Faire mon prono <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
