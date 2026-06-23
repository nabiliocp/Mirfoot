import { useEffect, useState } from 'react';
import { Trophy, Medal, Flame } from 'lucide-react';
import { supabase } from '../lib/supabase';

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
    exactCount: number;
    closeCount: number;
    winnerCount: number;
    zeroCount: number;
    bonusCount: number;
    malusCount: number;
    qualificationCount: number;
    predictionsCount: number;
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

      const compIds = Array.from(new Set(challenges?.map(c => c.competition_id).filter(id => id != null) || [])) as number[];
      console.log('Unique Comp IDs:', compIds);

      // 3. Fetch all challenges and bets for these competitions
      const { data: allChallenges, error: allChallengesError } = await supabase
        .from('challenges')
        .select('id, competition_id, title, resolved, point_rules, match_id')
        .in('competition_id', compIds);
      
      console.log('All Challenges fetched:', allChallenges, 'Error:', allChallengesError);

      const allChallengeIds = allChallenges?.map(c => c.id) || [];

      const { data: allBets, error: allBetsError } = await supabase
        .from('bets')
        .select('*')
        .in('challenge_id', allChallengeIds);

      console.log('All Bets fetched:', allBets, 'Error:', allBetsError);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('*');

      // Fetch matches for these competitions to compute live points
      let allMatches: any[] = [];
      for (const compId of compIds) {
        try {
          const res = await fetch(`/api/matches/${compId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.matches) {
              allMatches = allMatches.concat(data.matches);
            }
          }
        } catch (e) {
          console.error('Error fetching matches for comp', compId, e);
        }
      }

      // 4. Aggregate by competition
      const aggregated: Record<number, Record<string, { points: number; exact: number; close: number; winner: number; zero: number; bonus: number; malus: number; qualif: number; predictions: number }>> = {};
      
      // Initialize aggregation
      compIds.forEach(compId => {
        aggregated[compId] = {};
      });

      const calculateLivePointsAndBadges = (bet: any, challenge: any, matches: any[]) => {
        const stats = { points: bet.points_awarded || 0, exact: 0, close: 0, winner: 0, zero: 0, bonus: 0, malus: 0, qualif: 0, predictions: 0 };
        if (!challenge || !challenge.point_rules) return stats;
        const rawPtRules = typeof challenge.point_rules === 'string' ? JSON.parse(challenge.point_rules) : challenge.point_rules;
        const ptRules = {
          exact_score: Number(rawPtRules?.exact_score) || 3,
          close_score: Number(rawPtRules?.close_score) || 2,
          correct_winner: Number(rawPtRules?.correct_winner) || 1,
          qualification: Number(rawPtRules?.qualification) || 1,
          matches: rawPtRules?.matches || []
        };
        const predVal = typeof bet.predictions === 'string' ? JSON.parse(bet.predictions) : bet.predictions;
        let totalPts = 0;

        if (challenge.match_id && Number(challenge.match_id) !== 0) {
          // single match
          const m = matches.find(x => String(x.id) === String(challenge.match_id));
          if (m && ["FINISHED", "IN_PLAY", "LIVE", "PAUSED", "1H", "2H", "HT"].includes(m.status)) {
             let pts = 0;
             const rHome = m.score.fullTime.home ?? m.score.regularTime?.home ?? 0;
             const rAway = m.score.fullTime.away ?? m.score.regularTime?.away ?? 0;
             const pHome = predVal?.homeScore;
             const pAway = predVal?.awayScore;
             const isBonusActive = !!predVal?.bonus;
             const pQualifies = predVal?.qualifies;

             let actualQualifier = null;
             if (m.score.winner === 'HOME_TEAM') actualQualifier = 'home';
             else if (m.score.winner === 'AWAY_TEAM') actualQualifier = 'away';

             if (pHome !== undefined && pAway !== undefined && rHome !== null && rAway !== null) {
                stats.predictions = 1;
                const isExact = Number(pHome) === Number(rHome) && Number(pAway) === Number(rAway);
                const actualWinner = Number(rHome) > Number(rAway) ? 'home' : Number(rHome) < Number(rAway) ? 'away' : 'draw';
                const predWinner = Number(pHome) > Number(pAway) ? 'home' : Number(pHome) < Number(pAway) ? 'away' : 'draw';

                if (isExact) {
                  pts = Number(ptRules.exact_score);
                  stats.exact++;
                } else if (actualWinner === predWinner) {
                  const diff = Math.abs(Number(pHome) - Number(rHome)) + Math.abs(Number(pAway) - Number(rAway));
                  if (ptRules?.close_score && diff <= 2) {
                    pts = Number(ptRules.close_score);
                    stats.close++;
                  } else {
                    pts = Number(ptRules.correct_winner);
                    stats.winner++;
                  }
                }

                if (pQualifies && actualQualifier && pQualifies === actualQualifier) {
                  pts += Number(ptRules.qualification || 0);
                  stats.qualif++;
                }

                let isZero = pts === 0;

                if (isBonusActive) {
                  if (pts > 0) {
                    pts = pts * 2;
                    stats.bonus++;
                  } else {
                    pts = -4;
                    stats.malus++;
                  }
                } else if (isZero) {
                  stats.zero++;
                }
             }
             totalPts = pts;
             stats.points = totalPts;
          } else {
             // Return awarded points or 0 if unresolved/not started
             stats.points = bet.points_awarded || 0;
          }
        } else {
          // multi match
          const matchIds = (ptRules.matches || []).map(String);
          const activeMatches = matchIds.length > 0 ? matches.filter(m => matchIds.includes(String(m.id))) : matches;
          const matchesPreds = predVal?.matches || {};
          
          activeMatches.forEach(m => {
            const pMatch = matchesPreds[m.id];
            if (pMatch && pMatch.homeScore !== undefined && pMatch.awayScore !== undefined) {
               if (["FINISHED", "IN_PLAY", "LIVE", "PAUSED", "1H", "2H", "HT"].includes(m.status)) {
                 stats.predictions++;
                 const rHome = m.score.fullTime.home ?? m.score.regularTime?.home ?? 0;
                 const rAway = m.score.fullTime.away ?? m.score.regularTime?.away ?? 0;
                 const isMatchBonusActive = !!pMatch.bonus;
                 const pQualifies = pMatch.qualifies;

                 let actualQualifier = null;
                 if (m.score.winner === 'HOME_TEAM') actualQualifier = 'home';
                 else if (m.score.winner === 'AWAY_TEAM') actualQualifier = 'away';
                 
                 let matchPts = 0;
                 if (rHome !== null && rAway !== null) {
                    const isExact = Number(pMatch.homeScore) === Number(rHome) && Number(pMatch.awayScore) === Number(rAway);
                    const actualWinner = Number(rHome) > Number(rAway) ? 'home' : Number(rHome) < Number(rAway) ? 'away' : 'draw';
                    const predWinner = Number(pMatch.homeScore) > Number(pMatch.awayScore) ? 'home' : Number(pMatch.homeScore) < Number(pMatch.awayScore) ? 'away' : 'draw';
                    
                    if (isExact) {
                      matchPts = Number(ptRules.exact_score);
                      stats.exact++;
                    } else if (actualWinner === predWinner) {
                      const diff = Math.abs(Number(pMatch.homeScore) - Number(rHome)) + Math.abs(Number(pMatch.awayScore) - Number(rAway));
                      if (ptRules?.close_score && diff <= 2) {
                        matchPts = Number(ptRules.close_score);
                        stats.close++;
                      } else {
                        matchPts = Number(ptRules.correct_winner);
                        stats.winner++;
                      }
                    }

                    if (pQualifies && actualQualifier && pQualifies === actualQualifier) {
                      matchPts += Number(ptRules.qualification || 0);
                      stats.qualif++;
                    }

                    let isZero = matchPts === 0;

                    if (isMatchBonusActive) {
                      if (matchPts > 0) {
                        matchPts = matchPts * 2;
                        stats.bonus++;
                      } else {
                        matchPts = -4;
                        stats.malus++;
                      }
                    } else if (isZero) {
                      stats.zero++;
                    }
                 }
                 totalPts += matchPts;
               }
            }
          });
          
          if (!activeMatches.some(m => ["FINISHED", "IN_PLAY", "LIVE", "PAUSED", "1H", "2H", "HT"].includes(m.status))) {
             totalPts = bet.points_awarded || 0;
          }
          stats.points = totalPts;
        }
        return stats;
      };

      // Populate aggregation with maximum score selection per user per competition
      const userCompChallengeStats: Record<number, Record<string, Record<string, { points: number; exact: number; close: number; winner: number; zero: number; bonus: number; malus: number; qualif: number; predictions: number }>>> = {};
      
      compIds.forEach(compId => {
        userCompChallengeStats[compId] = {};
      });

      allBets?.forEach(bet => {
        const challenge = allChallenges?.find(c => c.id === bet.challenge_id);
        if (challenge && challenge.competition_id != null) {
          const compId = challenge.competition_id;
          if (bet.user_id) {
            if (!userCompChallengeStats[compId]) {
              userCompChallengeStats[compId] = {};
            }
            if (!userCompChallengeStats[compId][bet.user_id]) {
              userCompChallengeStats[compId][bet.user_id] = {};
            }
            
            const stats = calculateLivePointsAndBadges(bet, challenge, allMatches);
            userCompChallengeStats[compId][bet.user_id][challenge.id] = stats;
          }
        }
      });

      // Select the challenge with the highest score for each user
      compIds.forEach(compId => {
        const usersInComp = userCompChallengeStats[compId] || {};
        Object.entries(usersInComp).forEach(([userId, challengesMap]) => {
          let maxScore = -999999;
          let bestStatsRef: any = null;
          
          Object.entries(challengesMap).forEach(([challengeId, stats]) => {
            const guaranteedPoints = 
              (stats.exact * 3) + 
              (stats.close * 2) + 
              (stats.winner * 1) + 
              (stats.qualif * 1) + 
              (stats.bonus * 3) -
              (stats.malus * 4);
              
            const score = Math.max(Number(stats.points), guaranteedPoints, 0);
            if (score > maxScore) {
              maxScore = score;
              bestStatsRef = { ...stats, points: score };
            }
          });
          
          if (bestStatsRef) {
            aggregated[compId][userId] = bestStatsRef;
          }
        });
      });

      // 5. Structure data
      const leaderboardData: LeaderboardData[] = compIds
        .map(compId => ({
          competitionId: compId,
          participants: (Object.entries(aggregated[compId] || {}) as [string, any][]).map(([userId, stats]) => {
             return {
              profile: profiles?.find(p => p.id === userId) || { id: userId, username: 'Unknown', avatar_type: 'emoji', avatar_value: '👽', first_name: '', last_name: '', points: 0 },
              points: stats.points,
              exactCount: stats.exact,
              closeCount: stats.close,
              winnerCount: stats.winner,
              zeroCount: stats.zero,
              bonusCount: stats.bonus,
              malusCount: stats.malus,
              qualificationCount: stats.qualif,
              predictionsCount: stats.predictions
            };
          }).sort((a, b) => b.points - a.points)
        }))
        // No restriction on competition match count
        .filter(c => true);

      console.log('DEBUG: Final Aggregated Data:', aggregated);
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
                    {p.predictionsCount > 0 && <span className="text-[10px] text-gray-400 mt-0.5">{p.predictionsCount} pronostic(s)</span>}
                  </div>
                  
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex flex-wrap justify-end gap-1.5 text-[9px] font-bold text-gray-400 max-w-[140px]">
                      {p.exactCount > 0 && <span className="bg-emerald-50/70 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200">{p.exactCount} Exact</span>}
                      {p.closeCount > 0 && <span className="bg-amber-50/70 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200">{p.closeCount} Proche</span>}
                      {p.winnerCount > 0 && <span className="bg-indigo-50/70 text-indigo-800 px-1.5 py-0.5 rounded border border-indigo-200">{p.winnerCount} Winner</span>}
                      {p.qualificationCount > 0 && <span className="bg-blue-50/70 text-blue-800 px-1.5 py-0.5 rounded border border-blue-200">{p.qualificationCount} Qualif</span>}
                      {p.zeroCount > 0 && <span className="bg-rose-50/70 text-rose-800 px-1.5 py-0.5 rounded border border-rose-200">{p.zeroCount} x 0 pt</span>}
                    </div>
                    {(p.bonusCount > 0 || p.malusCount > 0) && (
                      <div className="flex gap-2 text-[9px] font-bold">
                        {p.bonusCount > 0 && <span className="text-emerald-600">{p.bonusCount}x Bonus</span>}
                        {p.malusCount > 0 && <span className="text-rose-600">{p.malusCount}x Malus</span>}
                      </div>
                    )}
                    <div className="font-black text-lg text-emerald-700">
                      {p.points} <span className="text-xs text-emerald-500 font-medium">pts</span>
                    </div>
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

