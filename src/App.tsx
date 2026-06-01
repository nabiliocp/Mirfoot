/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import MatchesView from "./components/MatchesView";
import LeaderboardView from "./components/LeaderboardView";
import ChallengesView from "./components/ChallengesView";
import LoginView from "./components/LoginView";
import ProfileSetupView from "./components/ProfileSetupView";
import {
  Trophy,
  CalendarCheck,
  Users,
  UsersRound,
  LogOut,
  Swords,
} from "lucide-react";
import { supabase } from "./lib/supabase";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import type { Session } from "@supabase/supabase-js";
// @ts-ignore
import logoImage from "./assets/images/pig_football_logo_1780308392869.png";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "matches" | "leaderboard" | "challenges"
  >("matches");

  const [inviteId, setInviteId] = useState<string | null>(null);
  const [inviteChallengeName, setInviteChallengeName] = useState<string | null>(
    null,
  );
  const [showInviteScreen, setShowInviteScreen] = useState(false);
  const [loadingInvite, setLoadingInvite] = useState(true);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session && !session.user.user_metadata?.username) {
        setNeedsProfileSetup(true);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session && !session.user.user_metadata?.username) {
        setNeedsProfileSetup(true);
      } else {
        setNeedsProfileSetup(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get("invite");
    if (invite && supabase) {
      setInviteId(invite);
      setActiveTab("challenges");

      // Fetch challenge details
      supabase
        .from("challenges")
        .select("title, match_home_team, match_away_team")
        .eq("id", invite)
        .single()
        .then(({ data }) => {
          if (data) {
            setInviteChallengeName(
              `${data.title} (${data.match_home_team} vs ${data.match_away_team})`,
            );
          }
          setLoadingInvite(false);
          // Only show invite screen if no session
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
              setShowInviteScreen(true);
            }
          });
        });
    } else {
      setLoadingInvite(false);
    }
  }, []);

  const handleAcceptInvite = () => {
    setShowInviteScreen(false);
    // Proceed to login
  };

  const handleDeclineInvite = () => {
    setShowInviteScreen(false);
    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  if (!session) {
    if (showInviteScreen) {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-6 text-center">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full border border-gray-100">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Swords className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              Tu as été invité !
            </h1>
            <p className="text-gray-500 mb-6">Rejoins le défi :</p>
            <div className="bg-emerald-50 p-4 rounded-xl mb-8 font-bold text-emerald-800 border border-emerald-100">
              {inviteChallengeName || "Défi en cours..."}
            </div>

            <div className="space-y-3">
              <button
                onClick={handleAcceptInvite}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-sm cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              >
                Rejoindre le défi
              </button>
              <button
                onClick={handleDeclineInvite}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3.5 rounded-xl transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      );
    }

    return <LoginView />;
  }

  if (needsProfileSetup) {
    return <ProfileSetupView onComplete={() => window.location.reload()} />;
  }

  const handleLogout = async () => {
    await supabase?.auth.signOut();
  };

  const getWhatsappLink = () => {
    const inviteText = encodeURIComponent(
      "Rejoins mon groupe de paris sportifs ! Prépare tes pronos pour les prochains matchs. ⚽️🏆",
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const appUrl =
      (import.meta as any).env?.VITE_APP_URL || window.location.origin;
    return `https://wa.me/?text=${inviteText}%20-%20${appUrl}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-emerald-700 text-white shadow-md pt-10 pb-4 px-6 md:px-12 flex justify-between items-center rounded-b-3xl">
        <div className="flex items-center gap-3">
          <img
            src={logoImage}
            alt="Mirfoot Logo"
            className="w-12 h-12 object-cover rounded-xl shadow-sm bg-white"
          />
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-0 text-emerald-300">
              Mirfoot
            </h1>
            <div className="font-handwriting text-xl text-white transform -rotate-2 -mt-1 mb-1">
              Halloufa 2026
            </div>
            <p className="text-emerald-100 text-sm font-medium">
              Ligue des Potes
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <a
            href={getWhatsappLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-emerald-500 hover:bg-emerald-400 text-white p-2 sm:px-4 rounded-full transition shadow-sm flex items-center justify-center gap-2 shadow-emerald-900/20"
          >
            <UsersRound className="w-5 h-5" />
            <span className="hidden sm:block text-sm font-semibold">
              Inviter
            </span>
          </a>
          <button
            onClick={handleLogout}
            className="bg-emerald-800 hover:bg-emerald-900 text-emerald-100 p-2 rounded-full transition-all cursor-pointer hover:scale-110"
            title="Se déconnecter"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto p-4 md:p-8 mt-2 overflow-y-auto">
        {activeTab === "matches" && <MatchesView />}
        {activeTab === "leaderboard" && <LeaderboardView />}
        {activeTab === "challenges" && <ChallengesView />}
      </main>

      <nav className="bg-white border-t border-gray-200 sticky bottom-0 z-10 safe-area-pb">
        <div className="max-w-md mx-auto flex justify-around">
          <button
            onClick={() => setActiveTab("matches")}
            className={`flex-1 flex flex-col items-center py-3 transition-colors cursor-pointer ${activeTab === "matches" ? "text-emerald-600" : "text-gray-400 hover:text-gray-600"}`}
          >
            <CalendarCheck className="w-6 h-6 mb-1" />
            <span className="text-xs font-semibold">Matchs</span>
          </button>

          <button
            onClick={() => setActiveTab("challenges")}
            className={`flex-1 flex flex-col items-center py-3 transition-colors cursor-pointer ${activeTab === "challenges" ? "text-emerald-600" : "text-gray-400 hover:text-gray-600"}`}
          >
            <Users className="w-6 h-6 mb-1" />
            <span className="text-xs font-semibold">Défis</span>
          </button>

          <button
            onClick={() => setActiveTab("leaderboard")}
            className={`flex-1 flex flex-col items-center py-3 transition-colors cursor-pointer ${activeTab === "leaderboard" ? "text-emerald-600" : "text-gray-400 hover:text-gray-600"}`}
          >
            <Trophy className="w-6 h-6 mb-1" />
            <span className="text-xs font-semibold">Classement</span>
          </button>
        </div>
        <div className="text-center pb-2 pt-1 border-t border-gray-100 bg-gray-50">
          <span className="text-[10px] text-gray-400">
            © 2026 Tous droits réservés NRINFRA
          </span>
        </div>
      </nav>
    </div>
  );
}
