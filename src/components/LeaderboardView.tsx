import { useEffect, useState, useMemo } from 'react';
import { Trophy, Medal, Flame } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { calculateMatchPoints } from '../lib/pointCalculation';
import { Match, Prediction } from '../types';

interface Profile {
  id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar_type: string;
  avatar_value: string;
  points: number;
}

interface LeaderboardData {
  competitionId: number;
  participants: {
    profile: Profile;
    points: number;
  }[];
}

const getTeamLogo = (teamName: string) => {
  const nameLower = (teamName || "").toLowerCase().trim();
  
  // Clubs
  const clubMapping: Record<string, string> = {
    "real madrid": "https://crests.football-data.org/86.svg",
    "barcelona": "https://crests.football-data.org/81.svg",
    "barcelone": "https://crests.football-data.org/81.svg",
    "manchester city": "https://crests.football-data.org/65.svg",
    "manchester united": "https://crests.football-data.org/66.svg",
    "liverpool": "https://crests.football-data.org/64.svg",
    "arsenal": "https://crests.football-data.org/57.svg",
    "bayern": "https://crests.football-data.org/5.svg",
    "psg": "https://crests.football-data.org/524.svg",
    "paris saint-germain": "https://crests.football-data.org/524.svg",
    "milan": "https://crests.football-data.org/98.svg",
    "inter": "https://crests.football-data.org/108.svg",
    "juventus": "https://crests.football-data.org/109.svg",
    "dortmund": "https://crests.football-data.org/4.svg",
    "marseille": "https://crests.football-data.org/516.svg",
    "monaco": "https://crests.football-data.org/548.svg",
  };
  
  for (const [key, url] of Object.entries(clubMapping)) {
    if (nameLower.includes(key)) return url;
  }
  
  // Nation Flags
  const nationMapping: Record<string, string> = {
    "maroc": "ma", "morocco": "ma",
    "france": "fr",
    "brésil": "br", "brazil": "br",
  };
  
  for (const [key, code] of Object.entries(nationMapping)) {
    if (nameLower.includes(key)) return `https://flagcdn.com/w80/${code}.png`;
  }
  
  return "https://flagcdn.com/w80/un.png";
};

export default function LeaderboardView() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LeaderboardData[]>([]);
  const [competitions, setCompetitions] = useState<Record<number, string>>({});

  useEffect(() => {
    async function loadData() {
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch user competitions (those they are invited to OR created)
      const { data: invs } = await supabase
        .from('challenge_invitations')
        .select('challenge_id')
        .eq('user_id', user.id)
        .eq('accepted', true);
      
      const { data: created } = await supabase
        .from('challenges')
        .select('id')
        .eq('creator_id', user.id);
      
      const invitedChallengeIds = invs?.map(i => i.challenge_id) || [];
      const createdChallengeIds = created?.map(c => c.id) || [];
      const challengeIds = Array.from(new Set([...invitedChallengeIds, ...createdChallengeIds]));
      console.log('DEBUG: Challenge IDs for user:', challengeIds);

      // 2. Fetch challenges for these competitions
      const { data: challenges, error: challengesError } = await supabase
        .from('challenges')
        .select('id, competition_id')
        .in('id', challengeIds);
        
      console.log('DEBUG: Challenges fetched:', challenges);

      const compIds = Array.from(new Set(challenges?.map(c => c.competition_id).filter(id => id != null) || []));
      console.log('Unique Comp IDs:', compIds);

      // 3. Fetch all challenges and bets for these competitions
      const { data: allChallenges, error: allChallengesError } = await supabase
        .from('challenges')
        .select('id, competition_id, title, resolved, point_rules, match_id')
        .in('competition_id', compIds);
      
      console.log('All Challenges fetched:', allChallenges, 'Error:', allChallengesError);

      // 3.5 Fetch matches for competitions
      const matchesByComp: Record<number, Match[]> = {};
      for (const compId of compIds) {
        try {
          const res = await fetch(`/api/matches/${compId}`);
          if (res.ok) {
            const data = await res.json();
            matchesByComp[compId] = data.matches || [];
          }
        } catch (e) {
          console.error(`Error fetching matches for comp ${compId}:`, e);
        }
      }

      const allChallengeIds = allChallenges?.map(c => c.id) || [];

      const { data: allBets, error: allBetsError } = await supabase
        .from('bets')
        .select('*')
        .in('challenge_id', allChallengeIds);

      console.log('All Bets fetched:', allBets, 'Error:', allBetsError);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('*');

      // 4. Aggregate by competition
      const aggregated: Record<number, Record<string, number>> = {};
      
      // Initialize aggregation
      compIds.forEach(compId => {
        aggregated[compId] = {};
      });

      // Populate aggregation
      allBets?.forEach(bet => {
        const challenge = allChallenges?.find(c => c.id === bet.challenge_id);
        if (challenge && challenge.competition_id != null) {
          const compId = challenge.competition_id;
          if (bet.user_id) {
            if (!aggregated[compId][bet.user_id]) aggregated[compId][bet.user_id] = 0;
            
            let pointsValue = (bet.points !== undefined && bet.points !== null) ? bet.points : (bet.points_awarded || 0);

            // Calculation on the fly
            if (pointsValue === 0 && !challenge.resolved) {
              const matches = matchesByComp[compId] || [];
              const match = matches.find(m => String(m.id) === String(challenge.match_id));
              console.log(`DEBUG: Bet point calculation for user ${bet.user_id} challenge ${challenge.id}. Found match:`, !!match);
              if (match) {
                const pred = (typeof bet.predictions === 'string' ? JSON.parse(bet.predictions) : bet.predictions) as Prediction;
                const pointRules = (typeof challenge.point_rules === 'string' ? JSON.parse(challenge.point_rules) : challenge.point_rules);
                console.log(`DEBUG: Using pointRules:`, pointRules);
                
                const calcPoints = calculateMatchPoints(match, pred.homeScore, pred.awayScore, !!pred.bonus, pointRules);
                console.log(`DEBUG: Calculated points: ${calcPoints}`);
                if (calcPoints !== null) pointsValue = calcPoints;
              }
            }
            
            aggregated[compId][bet.user_id] += pointsValue;
            
            console.log(`DEBUG: Bet: user=${bet.user_id}, comp=${compId}, points=${pointsValue}, total=${aggregated[compId][bet.user_id]}`);
          }
        }
      });

      // 5. Structure data
      const leaderboardData: LeaderboardData[] = compIds
        .map(compId => ({
          competitionId: compId,
          participants: Object.entries(aggregated[compId] || {}).map(([userId, points]) => ({
            profile: profiles?.find(p => p.id === userId) || { id: userId, username: 'Unknown', avatar_type: 'emoji', avatar_value: '👽', first_name: '', last_name: '', points: 0 },
            points
          })).sort((a, b) => b.points - a.points)
        }))
        // Only include competitions with multiple matches (multiple challenges in this competition)
        .filter(c => allChallenges.filter(ch => ch.competition_id === c.competitionId).length > 1);

      setData(leaderboardData);

      // Fetch competition names
      const compMap: Record<number, string> = {};
      try {
        const res = await fetch('/api/competitions');
        if (res.ok) {
          const data = await res.json();
          console.log('DEBUG COMP: Competitions fetched from API:', data.competitions);
          data.competitions?.forEach((c: any) => {
            compMap[c.id] = c.name;
          });
        }
      } catch (err) {
        console.error('DEBUG COMP: Error fetching competitions from API:', err);
      }
      setCompetitions(compMap);
      console.log('DEBUG COMP: Competition map finalized:', compMap);
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) return null;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300 min-h-screen pb-10">
      <div className="bg-emerald-600 text-white rounded-2xl p-6 shadow-lg flex justify-between items-center bg-gradient-to-br from-emerald-600 to-emerald-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-300" />
            Classement Général par Compétition
          </h2>
          <p className="text-emerald-100 text-sm mt-1">Saison en cours</p>
        </div>
        <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm">
          <Flame className="w-6 h-6 text-orange-300" />
        </div>
      </div>

      {data.length === 0 && (
        <div className="text-center p-8 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">
          Aucun classement disponible pour vos compétitions !
        </div>
      )}

      {data.map((comp) => (
        <div key={comp.competitionId} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 overflow-hidden">
          <h3 className="font-extrabold text-lg text-emerald-900 mb-4 border-b border-gray-50 pb-3">{competitions[comp.competitionId] || `Compétition ${comp.competitionId}`}</h3>
          <div className="space-y-3">
            {comp.participants.map((p, index) => {
              const profile = p.profile;
              const isTop3 = index < 3;
              const medals = ['text-yellow-400', 'text-gray-400', 'text-amber-600'];
              
              return (
                <div 
                  key={profile.id} 
                  className={`flex items-center p-3 rounded-xl border ${index === 0 ? 'bg-yellow-50/50 border-yellow-100' : 'bg-gray-50/50 border-gray-100'}`}
                >
                  <div className="w-8 flex justify-center items-center font-bold text-sm text-gray-500">
                    {isTop3 ? (
                      <Medal className={`w-5 h-5 ${medals[index]}`} />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>
                  
                  <div className="w-10 flex justify-center mr-3">
                    {profile.avatar_type === 'emoji' ? (
                      <span className="text-2xl">{profile.avatar_value === '🐷' ? '👽' : profile.avatar_value}</span>
                    ) : (
                      <div className="w-8 h-8 rounded-md flex items-center justify-center text-white" style={{ backgroundColor: profile.avatar_value }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.38 3.46 16 2a8.86 8.86 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/></svg>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 flex flex-col font-sans">
                    <span className="font-semibold text-sm text-gray-800">{profile.username}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      {profile.first_name && <img src={getTeamLogo(profile.first_name)} alt="Club" className="w-4 h-4 object-contain" title={profile.first_name} />}
                      {profile.last_name && <img src={getTeamLogo(profile.last_name)} alt="Nation" className="w-4 h-4 object-contain" title={profile.last_name} />}
                    </div>
                  </div>
                  
                  <div className="font-black text-lg text-emerald-700">
                    {p.points} <span className="text-xs text-emerald-500 font-medium">PTS</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

