import { useEffect, useState, useMemo } from 'react';
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
  }[];
}

export default function LeaderboardView() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LeaderboardData[]>([]);

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

      // 2. Fetch challenges for these competitions
      const { data: challenges } = await supabase
        .from('challenges')
        .select('id, competition_id')
        .in('id', challengeIds);

      const compIds = Array.from(new Set(challenges?.map(c => c.competition_id).filter(id => id != null) || []));

      // 3. Fetch all challenges and bets for these competitions
      const { data: allChallenges } = await supabase
        .from('challenges')
        .select('id, competition_id')
        .in('competition_id', compIds);
      
      const allChallengeIds = allChallenges?.map(c => c.id) || [];

      const { data: allBets } = await supabase
        .from('bets')
        .select('user_id, challenge_id, points_awarded')
        .in('challenge_id', allChallengeIds);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('*');

      // 4. Aggregate by competition
      const aggregated: Record<number, Record<string, number>> = {};
      
      allChallenges?.filter(c => c.competition_id != null).forEach(c => {
        if (!aggregated[c.competition_id!]) aggregated[c.competition_id!] = {};
      });

      allBets?.forEach(bet => {
        const challenge = allChallenges?.find(c => c.id === bet.challenge_id);
        if (challenge && challenge.competition_id != null) {
          const compId = challenge.competition_id;
          if (!aggregated[compId][bet.user_id]) aggregated[compId][bet.user_id] = 0;
          aggregated[compId][bet.user_id] += (bet.points_awarded || 0);
        }
      });

      // 5. Structure data
      const leaderboardData: LeaderboardData[] = compIds.map(compId => ({
        competitionId: compId,
        participants: Object.entries(aggregated[compId] || {}).map(([userId, points]) => ({
          profile: profiles?.find(p => p.id === userId) || { id: userId, username: 'Unknown', avatar_type: 'emoji', avatar_value: '👽', points: 0 },
          points
        })).sort((a, b) => b.points - a.points)
      }));

      setData(leaderboardData);
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) return null;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
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
        <div className="text-center p-8 text-gray-500 bg-white rounded-xl shadow-sm">
          Aucun classement disponible pour vos compétitions !
        </div>
      )}

      {data.map((comp) => (
        <div key={comp.competitionId} className="space-y-2">
          <h3 className="font-bold text-gray-700">Compétition {comp.competitionId}</h3>
          <div className="space-y-3">
            {comp.participants.map((p, index) => {
              const profile = p.profile;
              const isTop3 = index < 3;
              const medals = ['text-yellow-400', 'text-gray-400', 'text-amber-600'];
              
              return (
                <div 
                  key={profile.id} 
                  className={`flex items-center p-4 rounded-xl shadow-sm border ${index === 0 ? 'bg-yellow-50/50 border-yellow-200' : 'bg-white border-gray-100'}`}
                >
                  <div className="w-10 flex justify-center items-center font-bold text-gray-500">
                    {isTop3 ? (
                      <Medal className={`w-6 h-6 ${medals[index]}`} />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>
                  
                  <div className="ml-2 w-10 flex justify-center">
                    {profile.avatar_type === 'emoji' ? (
                      <span className="text-2xl">{profile.avatar_value === '🐷' ? '👽' : profile.avatar_value}</span>
                    ) : (
                      <div className="w-8 h-8 rounded-md flex items-center justify-center text-white" style={{ backgroundColor: profile.avatar_value }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.38 3.46 16 2a8.86 8.86 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/></svg>
                      </div>
                    )}
                  </div>
                  
                  <div className="ml-3 flex-1 flex flex-col font-sans">
                    <span className="font-semibold text-gray-800 flex items-center gap-1.5 flex-wrap">
                      {profile.username}
                    </span>
                    {(profile.first_name || profile.last_name) && (
                      <div className="text-[11px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                        {profile.first_name && <span className="inline-flex items-center gap-0.5">⚽️ {profile.first_name}</span>}
                        {profile.first_name && profile.last_name && <span className="text-gray-300">|</span>}
                        {profile.last_name && <span className="inline-flex items-center gap-0.5">🏆 {profile.last_name}</span>}
                      </div>
                    )}
                  </div>
                  
                  <div className="font-black text-xl text-gray-800 mr-2">
                    {p.points} <span className="text-xs text-gray-400 font-medium ml-1">PTS</span>
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
