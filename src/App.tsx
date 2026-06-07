/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import MatchesView from "./components/MatchesView";
import LeaderboardView from "./components/LeaderboardView";
import ChallengesView from "./components/ChallengesView";
import LoginView from "./components/LoginView";
import ProfileSetupView from "./components/ProfileSetupView";
import ProfileEditModal from "./components/ProfileEditModal";
import {
  Trophy,
  CalendarCheck,
  Users,
  UsersRound,
  LogOut,
  Swords,
  CheckSquare,
  Calendar,
} from "lucide-react";
import { supabase } from "./lib/supabase";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import type { Session } from "@supabase/supabase-js";
import { Match, Challenge } from "./types";
// @ts-ignore
import logoImage from "./assets/images/pig_football_logo_1780308392869.png";

const getNationalFlagEmoji = (countryName?: string): string => {
  if (!countryName) return "";
  const name = countryName.toLowerCase().trim();
  if (name.includes("france")) return "🇫🇷";
  if (name.includes("maroc") || name.includes("morocco")) return "🇲🇦";
  if (name.includes("alg") || name.includes("algeria")) return "🇩🇿";
  if (name.includes("tunis")) return "🇹🇳";
  if (name.includes("sénégal") || name.includes("senegal")) return "🇸🇳";
  if (name.includes("ivoire") || name.includes("ivory")) return "🇨🇮";
  if (name.includes("cameroun") || name.includes("cameroon")) return "🇨🇲";
  if (name.includes("égypte") || name.includes("egypt")) return "🇪🇬";
  if (name.includes("mali")) return "🇲🇱";
  if (name.includes("espagne") || name.includes("spain")) return "🇪🇸";
  if (name.includes("ital")) return "🇮🇹";
  if (name.includes("allemagne") || name.includes("germany")) return "🇩🇪";
  if (name.includes("angleterre") || name.includes("england") || name.includes("royaume-uni")) return "🇬🇧";
  if (name.includes("portugal")) return "🇵🇹";
  if (name.includes("belgique") || name.includes("belgium")) return "🇧🇪";
  if (name.includes("pays-bas") || name.includes("netherlands")) return "🇳🇱";
  if (name.includes("brésil") || name.includes("brazil")) return "🇧🇷";
  if (name.includes("argen")) return "🇦🇷";
  if (name.includes("croat")) return "🇭🇷";
  if (name.includes("urug")) return "🇺🇾";
  if (name.includes("japon") || name.includes("japan")) return "🇯🇵";
  if (name.includes("suisse") || name.includes("switzerland")) return "🇨🇭";
  return "🏳️";
};

const getClubCrest = (clubName?: string): string | null => {
  if (!clubName) return null;
  const name = clubName.toLowerCase().trim();
  if (name.includes("real madrid")) return "https://crests.football-data.org/86.svg";
  if (name.includes("barcelon") || name.includes("barca") || name.includes("barça")) return "https://crests.football-data.org/81.svg";
  if (name.includes("manchester city")) return "https://crests.football-data.org/65.svg";
  if (name.includes("manchester united") || name.includes("man united") || name.includes("manutd")) return "https://crests.football-data.org/66.svg";
  if (name.includes("liverpool")) return "https://crests.football-data.org/64.svg";
  if (name.includes("arsenal")) return "https://crests.football-data.org/57.svg";
  if (name.includes("chelsea")) return "https://crests.football-data.org/61.svg";
  if (name.includes("tottenham") || name.includes("spurs")) return "https://crests.football-data.org/73.svg";
  if (name.includes("bayern") || name.includes("munich")) return "https://crests.football-data.org/5.svg";
  if (name.includes("dortmund") || name.includes("borussia")) return "https://crests.football-data.org/4.svg";
  if (name.includes("psg") || name.includes("paris saint-germain") || name.includes("paris")) return "https://crests.football-data.org/524.svg";
  if (name.includes("marseille") || name.includes("om")) return "https://crests.football-data.org/516.svg";
  if (name.includes("lyon") || name.includes("ol")) return "https://crests.football-data.org/523.svg";
  if (name.includes("monaco")) return "https://crests.football-data.org/548.svg";
  if (name.includes("lille")) return "https://crests.football-data.org/521.svg";
  if (name.includes("lens")) return "https://crests.football-data.org/546.svg";
  if (name.includes("nice")) return "https://crests.football-data.org/522.svg";
  if (name.includes("milan") && !name.includes("inter")) return "https://crests.football-data.org/98.svg";
  if (name.includes("inter")) return "https://crests.football-data.org/108.svg";
  if (name.includes("juventus") || name.includes("juve")) return "https://crests.football-data.org/109.svg";
  if (name.includes("napoli")) return "https://crests.football-data.org/113.svg";
  if (name.includes("roma")) return "https://crests.football-data.org/100.svg";
  if (name.includes("atletico") || name.includes("atlético")) return "https://crests.football-data.org/78.svg";
  
  return null;
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  const [userProfile, setUserProfile] = useState<{
    username: string;
    avatar_type: "emoji" | "jersey";
    avatar_value: string;
    favorite_club?: string;
    favorite_national?: string;
    favorite_competitions?: string;
  } | null>(null);

  const profileCheckedRef = useRef(false);

  // Fix double hash immediately on component render to ensure Supabase SDK can parse the parameters
  if (typeof window !== "undefined" && window.location.href.includes("##")) {
    const cleanUrl = window.location.href.replace("##", "#");
    window.history.replaceState({}, document.title, cleanUrl);
  }

  // Safe URL cleaner: only clears the authentication tokens from the address bar
  // AFTER Supabase has successfully processed them and established a session
  useEffect(() => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      const hasTokens =
        url.hash.includes("access_token") || 
        url.hash.includes("id_token") || 
        url.searchParams.has("code") ||
        url.searchParams.has("type") || 
        url.searchParams.has("error");

      if (hasTokens) {
        if (session) {
          // Session is established! We can safely and immediately clear the tokens from the URL.
          const freshUrl = new URL(window.location.href);
          freshUrl.hash = "";
          freshUrl.searchParams.delete("code");
          freshUrl.searchParams.delete("type");
          freshUrl.searchParams.delete("error");
          freshUrl.searchParams.delete("error_description");
          window.history.replaceState({}, document.title, freshUrl.pathname + freshUrl.search);
          console.log("[App] Session established! Cleared auth tokens from address bar safely.");
        } else {
          // If there's an auth error in the URL, let's clear it on a fallback delay
          if (url.searchParams.has("error") || url.hash.includes("error")) {
            const errorTimer = setTimeout(() => {
              const freshUrl = new URL(window.location.href);
              freshUrl.hash = "";
              freshUrl.searchParams.delete("code");
              freshUrl.searchParams.delete("type");
              freshUrl.searchParams.delete("error");
              freshUrl.searchParams.delete("error_description");
              window.history.replaceState({}, document.title, freshUrl.pathname + freshUrl.search);
              console.log("[App] Cleared auth errors from address bar after fallback timeout.");
            }, 5000);
            return () => clearTimeout(errorTimer);
          }
        }
      }
    }
  }, [session]);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "matches" | "leaderboard" | "challenges"
  >("challenges");
  const [selectedMatchForProno, setSelectedMatchForProno] = useState<{ match: Match; competitionId: number } | null>(null);

  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [detailTab, setDetailTab] = useState<"matches" | "leaderboard" | "participants" | "results">("matches");

  useEffect(() => {
    setDetailTab("matches");
  }, [selectedChallenge]);

  const [inviteId, setInviteId] = useState<string | null>(null);
  const [inviteChallengeName, setInviteChallengeName] = useState<string | null>(
    null,
  );
  const [showInviteScreen, setShowInviteScreen] = useState(false);
  const [loadingInvite, setLoadingInvite] = useState(true);

  useEffect(() => {
    const storedInvite = inviteId || localStorage.getItem("pending_invite_id");
    if (session && storedInvite && supabase) {
      console.log("Processing invite for session:", session.user.id, "invite:", storedInvite);
      
      const proceedWithCleanup = () => {
        console.log("Invite processed successfully");
        localStorage.removeItem("pending_invite_id");
        setInviteId(null);
        // Remove invite parameter from current URL to avoid re-triggering invite UI
        const url = new URL(window.location.href);
        url.searchParams.delete("invite");
        window.history.replaceState({}, document.title, url.pathname + url.search);
      };

      // Safe API call to join challenge via server (bypassing Client RLS)
      fetch("/api/challenges/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          challengeId: storedInvite,
          userId: session.user.id,
        })
      })
      .then((res) => {
        if (!res.ok) {
          throw new Error("HTTP error while joining");
        }
        return res.json();
      })
      .then((result) => {
        console.log("Joined challenge via server endpoint:", result);
        proceedWithCleanup();
      })
      .catch((err) => {
        console.error("Error processing invite through endpoint:", err);
        // Clean up even if failed to avoid infinite alerts/retries
        proceedWithCleanup();
      });
    }
  }, [session, inviteId]);

  useEffect(() => {
    if (!supabase) {
      setLoadingSession(false);
      return;
    }

    const checkProfile = async (userId: string, silent = false) => {
      try {
        if (!supabase) return;
        if (!silent && !profileCheckedRef.current) {
          setLoadingProfile(true);
        }
        // Only wait 1s if we haven't successfully loaded/checked a profile yet
        if (!profileCheckedRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        console.log("Forcing profile check for", userId);
        const { data, error } = await supabase
          .from("profiles")
          .select("username, avatar_type, avatar_value, first_name, last_name")
          .eq("id", userId)
          .single();
        
        console.log("Resultat verif profil:", { data, error });

        const isAutoGenerated = data?.username && data.username.startsWith("user_") && data.username.length === 13;
        const needsSetup = error || !data || !data.username || data.username.trim() === "" || isAutoGenerated;

        // Si erreur ou si données manquantes ou auto-généré, FORCER le setup
        if (needsSetup) {
          console.log("Profil incomplet, auto-généré ou inexistant, affichage FORCÉ du setup.", { error, data });
          setNeedsProfileSetup(true);
          setUserProfile(null);
        } else {
          console.log("Profil valide trouvé pour:", data.username);
          setNeedsProfileSetup(false);
          setUserProfile({
            username: data.username,
            avatar_type: (data.avatar_type as "emoji" | "jersey") || "emoji",
            avatar_value: data.avatar_value || "👽",
            favorite_club: data.first_name || "",
            favorite_national: data.last_name || "",
            favorite_competitions: localStorage.getItem(`fav_comps_${data.username}`) || "",
          });
          profileCheckedRef.current = true;
        }
      } catch (err) {
        console.error("Erreur critique verif profil:", err);
        setNeedsProfileSetup(true);
      } finally {
        setLoadingProfile(false);
      }
    };

    // Safe timeout fallback so the user is never locked in "Connexion en cours..." indefinitely
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        console.warn("Auth check taking longer than 5s! Forcing loadingSession to false for stability.");
        setLoadingSession(false);
      }
    }, 5000);

    const hasAuthParams = typeof window !== "undefined" && (
      window.location.hash.includes("access_token") ||
      window.location.hash.includes("id_token") ||
      window.location.href.includes("access_token=") ||
      new URLSearchParams(window.location.search).has("code")
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      resolved = true;
      clearTimeout(timeout);
      console.log("getSession resolved. Session exists:", !!session, "hasAuthParams:", hasAuthParams);
      
      if (session) {
        setSession(session);
        setLoadingSession(false);
        const shouldSkipLoader = profileCheckedRef.current;
        if (!shouldSkipLoader) {
          setLoadingProfile(true);
        }
        checkProfile(session.user.id, shouldSkipLoader);
      } else if (!hasAuthParams) {
        // Only set loading to false if we don't have active oauth/magic link handshake params in URL
        setLoadingSession(false);
      }
    }).catch(err => {
      console.error("Error in getSession:", err);
      resolved = true;
      clearTimeout(timeout);
      if (!hasAuthParams) {
        setLoadingSession(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      resolved = true;
      clearTimeout(timeout);
      console.log("AuthStateChange event emitted:", _event, "Session exists:", !!session);
      setSession(session);
      setLoadingSession(false);
      if (session) {
        const shouldSkipLoader = profileCheckedRef.current;
        if (!shouldSkipLoader) {
          setLoadingProfile(true);
        }
        checkProfile(session.user.id, shouldSkipLoader);
      } else {
        setNeedsProfileSetup(false);
        setLoadingProfile(false);
        profileCheckedRef.current = false;
      }
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get("invite");
    const search = params.get("search");
    
    if (invite && supabase) {
      setInviteId(invite);
      localStorage.setItem("pending_invite_id", invite);
      setActiveTab("challenges");

      // Fetch challenge details
      supabase
        .from("challenges")
        .select("id, title, match_home_team, match_away_team")
        .eq("rules", invite)
        .single()
        .then(({ data }) => {
          if (data) {
            localStorage.setItem("pending_invite_id", data.id);
            if (data.match_home_team === "Comp" && data.match_away_team === "Comp") {
              setInviteChallengeName(`${data.title} (Compétition)`);
            } else {
              setInviteChallengeName(
                `${data.title} (${data.match_home_team} vs ${data.match_away_team})`,
              );
            }
          }
          setLoadingInvite(false);
          // Only show invite screen if no session
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
              setShowInviteScreen(true);
            }
          });
        });
    } else if (search && supabase) {
      setActiveTab("challenges");
      setLoadingInvite(false);
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
    localStorage.removeItem("pending_invite_id");
    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  if (loadingSession || loadingProfile) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-6">
        <div className="animate-pulse text-emerald-700 font-bold">Connexion en cours...</div>
      </div>
    );
  }

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
            <p className="text-gray-500 mb-6">Connecte-toi pour rejoindre le défi :</p>
            <div className="bg-emerald-50 p-4 rounded-xl mb-8 font-bold text-emerald-800 border border-emerald-100">
              {inviteChallengeName || "Défi en cours..."}
            </div>

            <div className="space-y-3">
              <button
                onClick={handleAcceptInvite}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-sm cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              >
                Se connecter pour rejoindre
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
      <header className="bg-emerald-700 text-white shadow-md pt-8 pb-5 px-4 sm:px-6 md:px-12 rounded-b-3xl">
        <div className="flex justify-between items-center w-full gap-3 sm:gap-4">
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <img
              src={logoImage}
              alt="Mirfoot Logo"
              className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded-xl shadow-sm bg-white"
            />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight mb-0 text-emerald-300">
                Mirfoot
              </h1>
              <div className="font-handwriting text-base sm:text-xl text-white transform -rotate-2 -mt-1 mb-0.5">
                Halloufa world cup 2026
              </div>
              <p className="text-emerald-100 text-[10.5px] sm:text-xs font-medium uppercase tracking-wider">
                Ligue des Potes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Dynamic User Profile Block - Display Username text with custom heart flags/logos */}
            {userProfile && (
              <div 
                onClick={() => setIsProfileModalOpen(true)}
                className="flex items-center gap-2 bg-emerald-800/40 hover:bg-emerald-800/70 border border-emerald-600/30 hover:border-emerald-500/40 px-3 py-1.5 rounded-full transition cursor-pointer select-none"
                title="Modifier mon profil"
              >
                <span className="font-extrabold text-xs sm:text-sm text-emerald-50 hover:text-white">
                  {userProfile.username}
                </span>
                
                {(userProfile.favorite_national || userProfile.favorite_club) && (
                  <div className="flex items-center gap-1.5 border-l border-emerald-600/40 pl-2">
                    {userProfile.favorite_national && (
                      <span 
                        className="text-sm hover:scale-110 transition duration-150 inline-flex" 
                        title={`Équipe nationale de cœur : ${userProfile.favorite_national}`}
                      >
                        {getNationalFlagEmoji(userProfile.favorite_national)}
                      </span>
                    )}
                    {userProfile.favorite_club && (
                      <span 
                        className="text-xs hover:scale-110 transition duration-150 flex items-center justify-center w-5 h-5 bg-white rounded-full overflow-hidden shadow-sm border border-emerald-100 shrink-0" 
                        title={`Club de cœur : ${userProfile.favorite_club}`}
                      >
                        {getClubCrest(userProfile.favorite_club) ? (
                          <img src={getClubCrest(userProfile.favorite_club)!} className="w-[14px] h-[14px] object-contain" alt="Club" />
                        ) : (
                          <span className="text-[10px] font-black text-emerald-800">{userProfile.favorite_club.substring(0, 2).toUpperCase()}</span>
                        )}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="bg-emerald-800 hover:bg-emerald-900 text-emerald-100 p-2 sm:p-2.5 rounded-full transition-all cursor-pointer hover:scale-110"
              title="Se déconnecter"
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Profile Edit Modal */}
      {userProfile && session && (
        <ProfileEditModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          email={session.user.email || ""}
          initialProfile={userProfile}
          onSave={(updated) => {
            setUserProfile(updated);
            // Refresh components/pages where names could be hardcached
            // (especially we can just update local userProfile state, and/or trigger a tiny refresh)
          }}
        />
      )}

      <main className="flex-1 w-full max-w-3xl mx-auto p-4 md:p-8 mt-2 overflow-y-auto">
        {activeTab === "matches" && (
          <MatchesView 
            userProfile={userProfile}
            onPronoClick={(match, competitionId) => {
              setSelectedMatchForProno({ match, competitionId });
              setActiveTab("challenges");
            }} 
            onProfileUpdate={(updated) => setUserProfile(updated)}
          />
        )}
        {activeTab === "leaderboard" && <LeaderboardView />}
        {activeTab === "challenges" && (
          <ChallengesView 
            preselectedMatch={selectedMatchForProno}
            onClearPreselectedMatch={() => setSelectedMatchForProno(null)}
            selectedChallenge={selectedChallenge}
            setSelectedChallenge={setSelectedChallenge}
            detailTab={detailTab}
            setDetailTab={setDetailTab}
          />
        )}
      </main>

      <nav className="bg-white border-t border-gray-200 sticky bottom-0 z-10 safe-area-pb">
        {activeTab === "challenges" && selectedChallenge ? (
          <div className="max-w-md mx-auto flex justify-around animate-in slide-in-from-bottom duration-200">
            <button
              onClick={() => setDetailTab("matches")}
              className={`flex-1 flex flex-col items-center py-3 transition-colors cursor-pointer ${detailTab === "matches" ? "text-emerald-600 font-bold" : "text-gray-400 hover:text-gray-600"}`}
            >
              <CheckSquare className="w-6 h-6 mb-1" />
              <span className="text-xs font-semibold">Pronostics</span>
            </button>

            <button
              onClick={() => setDetailTab("leaderboard")}
              className={`flex-1 flex flex-col items-center py-3 transition-colors cursor-pointer ${detailTab === "leaderboard" ? "text-emerald-600 font-bold" : "text-gray-400 hover:text-gray-600"}`}
            >
              <Trophy className="w-6 h-6 mb-1" />
              <span className="text-xs font-semibold">Classement</span>
            </button>

            <button
              onClick={() => setDetailTab("participants")}
              className={`flex-1 flex flex-col items-center py-3 transition-colors cursor-pointer ${detailTab === "participants" ? "text-emerald-600 font-bold" : "text-gray-400 hover:text-gray-600"}`}
            >
              <Users className="w-6 h-6 mb-1" />
              <span className="text-xs font-semibold">Participants</span>
            </button>

            <button
              onClick={() => setDetailTab("results")}
              className={`flex-1 flex flex-col items-center py-3 transition-colors cursor-pointer ${detailTab === "results" ? "text-emerald-600 font-bold" : "text-gray-400 hover:text-gray-600"}`}
            >
              <Calendar className="w-6 h-6 mb-1" />
              <span className="text-xs font-semibold">Résultats</span>
            </button>
          </div>
        ) : (
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
        )}
        <div className="text-center pb-2 pt-1 border-t border-gray-100 bg-gray-50">
          <span className="text-[10px] text-gray-400">
            © 2026 Tous droits réservés NRINFRA
          </span>
        </div>
      </nav>
    </div>
  );
}
