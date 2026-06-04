import { useEffect, useState } from 'react';
import { User } from '../types';
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

export default function LeaderboardView() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLeaderboard() {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('points', { ascending: false });
      
      if (!error && data) {
        setProfiles(data);
      }
      setLoading(false);
    }
    loadLeaderboard();
  }, []);

  if (loading) return null;

  return (
    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
      <div className="bg-emerald-600 text-white rounded-2xl p-6 shadow-lg mb-6 flex justify-between items-center bg-gradient-to-br from-emerald-600 to-emerald-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-300" />
            Classement Général
          </h2>
          <p className="text-emerald-100 text-sm mt-1">Saison en cours</p>
        </div>
        <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm">
          <Flame className="w-6 h-6 text-orange-300" />
        </div>
      </div>

      <div className="space-y-3">
        {profiles.length === 0 && (
          <div className="text-center p-8 text-gray-500 bg-white rounded-xl shadow-sm">
            Personne n'est encore inscrit !
          </div>
        )}
        {profiles.map((profile, index) => {
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
              
              <div className="ml-3 flex-1 flex flex-col">
                <span className={`font-semibold text-gray-800`}>
                  {profile.username}
                </span>
                {(profile.first_name || profile.last_name) && (
                  <span className="text-xs text-gray-400">
                    {[profile.first_name, profile.last_name].filter(Boolean).join(' ')}
                  </span>
                )}
              </div>
              
              <div className="font-black text-xl text-gray-800 mr-2">
                {profile.points} <span className="text-xs text-gray-400 font-medium ml-1">PTS</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
