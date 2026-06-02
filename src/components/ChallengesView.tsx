import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  Challenge,
  PointRules,
  RulesSet,
  KnockoutRulesSet,
  Prediction,
  Competition,
  Match,
} from "../types";
import {
  CheckCircle2,
  Plus,
  Info,
  Share2,
  Lock,
  ChevronRight,
  Clock,
  Trophy,
  Trash2,
  Edit2,
  Calendar,
  ArrowLeft,
  Users,
  CheckSquare,
  Search,
} from "lucide-react";
import { supabase } from "../lib/supabase";

interface ChallengesViewProps {
  preselectedMatch?: { match: Match; competitionId: number } | null;
  onClearPreselectedMatch?: () => void;
}

export default function ChallengesView({ preselectedMatch, onClearPreselectedMatch }: ChallengesViewProps = {}) {
  const [activeModal, setActiveModal] = useState<{
    type: "rules" | "participants" | "confirm-delete" | "edit" | "details";
    challenge: Challenge;
  } | null>(null);

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [userPredictions, setUserPredictions] = useState<
    Record<string, Prediction>
  >({});
  const [userId, setUserId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "create">("list");
  const [apiError, setApiError] = useState<string | null>(null);
  const [modalMatches, setModalMatches] = useState<Match[]>([]);
  const [modalMatchesError, setModalMatchesError] = useState<string | null>(null);
  const [loadingModalMatches, setLoadingModalMatches] = useState(false);
  
  // Search challenge states
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchCodeInput, setSearchCodeInput] = useState("");
  const [searchingChallenge, setSearchingChallenge] = useState(false);
  const [searchResult, setSearchResult] = useState<Challenge | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [joiningChallengeId, setJoiningChallengeId] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string>("Moi");
  const [visibleMatchesCount, setVisibleMatchesCount] = useState<number>(4);
  const [activeTooltipId, setActiveTooltipId] = useState<number | null>(null);
  const [upcomingMatchesByComp, setUpcomingMatchesByComp] = useState<Record<string, Match>>({});

  // Challenge details page state
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [detailTab, setDetailTab] = useState<"matches" | "leaderboard" | "participants" | "results">("matches");
  const [challengeBets, setChallengeBets] = useState<any[]>([]);
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [loadingChallengeDetails, setLoadingChallengeDetails] = useState(false);

  const ruleLabels: Record<string, string> = {
    exact_score: "Score Exact",
    correct_winner: "Bon Vainqueur (1N2)",
    closest_guess: "Plus proche du score",
    exact_score_penalties: "Score Exact Tab (Knockout)",
    correct_winner_penalties: "Vainqueur Tab (Knockout)",
    prolongation_winner: "Vainqueur Prolongation",
    prolongation_score: "Score Prolongation",
    penalties_winner: "Vainqueur Penalty",
  };

  const renderReadableRules = (rules: PointRules) => {
    return (
      <div className="space-y-4">
        <div>
          <h4 className="font-bold text-emerald-700 text-sm mb-2 flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full" />
            Phase de Groupes
          </h4>
          <div className="grid grid-cols-1 gap-2 pl-4 border-l-2 border-emerald-100">
            {Object.entries(rules.group_stage).map(([key, value]) => (
              value > 0 && (
                <div key={key} className="flex justify-between text-xs items-center">
                  <span className="text-gray-600 font-medium">{ruleLabels[key] || key}</span>
                  <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">+{value} pts</span>
                </div>
              )
            ))}
          </div>
        </div>
        
        <div>
          <h4 className="font-bold text-indigo-700 text-sm mb-2 flex items-center gap-2">
            <div className="w-2 h-2 bg-indigo-500 rounded-full" />
            Phase Éliminatoire
          </h4>
          <div className="grid grid-cols-1 gap-2 pl-4 border-l-2 border-indigo-100">
            {Object.entries(rules.knockout_stage).map(([key, value]) => (
              value > 0 && (
                <div key={key} className="flex justify-between text-xs items-center">
                  <span className="text-gray-600 font-medium">{ruleLabels[key] || key}</span>
                  <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold">+{value} pts</span>
                </div>
              )
            ))}
          </div>
        </div>

        <div>
          <h4 className="font-bold text-amber-700 text-sm mb-2 flex items-center gap-2">
            <div className="w-2 h-2 bg-amber-500 rounded-full" />
            Bonus
          </h4>
          <div className="pl-4 border-l-2 border-amber-100 text-amber-800 text-xs font-medium space-y-1">
            <p><strong>Bonus X2 :</strong> Si juste, les points sont doublés. Sinon, -4 pts.</p>
          </div>
        </div>

      </div>
    );
  };

  // Create form state
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompId, setSelectedCompId] = useState<number | null>(null);
  const [isTournamentSelected, setIsTournamentSelected] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [loadingComps, setLoadingComps] = useState(false);
  const [loadingMatches, setLoadingMatches] = useState(false);

  const [customRulesConfig, setCustomRulesConfig] = useState<{
    [key: string]: { enabled: boolean; points: number; label: string };
  }>({
    exact_score: { enabled: true, points: 5, label: "Score Exact" },
    correct_winner: { enabled: true, points: 2, label: "Bon Vainqueur (1N2)" },
    closest_guess: { enabled: true, points: 1, label: "Plus proche du score" },
    exact_score_penalties: { enabled: false, points: 5, label: "Score Exact Tab (Knockout)" },
    correct_winner_penalties: { enabled: false, points: 2, label: "Vainqueur Tab (Knockout)" },
    prolongation_winner: { enabled: false, points: 3, label: "Vainqueur Prolongation" },
    prolongation_score: { enabled: false, points: 5, label: "Score Prolongation" },
    penalties_winner: { enabled: false, points: 3, label: "Vainqueur Penalty" },
  });

  const toggleRule = (rule: string) => {
    setCustomRulesConfig(prev => ({
      ...prev,
      [rule]: { ...prev[rule], enabled: !prev[rule].enabled }
    }));
  };

  const updateRulePoints = (rule: string, points: number) => {
    setCustomRulesConfig(prev => ({
      ...prev,
      [rule]: { ...prev[rule], points }
    }));
  };

  // Betting form state
  const [predictionForms, setPredictionForms] = useState<
    Record<string, Prediction>
  >({});

  const getFlagUrl = (teamName: string, officialCrest?: string) => {
    if (officialCrest) return officialCrest;
    const nameLower = (teamName || "").toLowerCase().trim();
    const mapping: Record<string, string> = {
      "morocco": "ma", "maroc": "ma",
      "france": "fr",
      "brazil": "br", "brésil": "br",
      "argentina": "ar", "argentine": "ar",
      "spain": "es", "espagne": "es",
      "belgium": "be", "belgique": "be",
      "croatia": "hr", "croatie": "hr",
      "portugal": "pt",
      "england": "gb-eng", "angleterre": "gb-eng",
      "germany": "de", "allemagne": "de",
      "netherlands": "nl", "pays-bas": "nl",
      "senegal": "sn", "sénégal": "sn",
      "switzerland": "ch", "suisse": "ch",
      "usa": "us", "united states": "us", "états-unis": "us",
      "wales": "gb-wls", "pays de galles": "gb-wls",
      "tunisia": "tn", "tunisie": "tn",
      "saudi arabia": "sa", "arabie saoudite": "sa",
      "mexico": "mx", "mexique": "mx",
      "poland": "pl", "pologne": "pl",
      "australia": "au", "australie": "au",
      "denmark": "dk", "danemark": "dk",
      "costa rica": "cr",
      "japan": "jp", "japon": "jp",
      "canada": "ca",
      "cameroon": "cm", "cameroun": "cm",
      "serbia": "rs", "serbie": "rs",
      "ghana": "gh",
      "uruguay": "uy",
      "south korea": "kr", "corée du sud": "kr", "republic of korea": "kr",
      "ecuador": "ec", "équateur": "ec",
      "qatar": "qa"
    };
    for (const [key, code] of Object.entries(mapping)) {
      if (nameLower.includes(key)) {
        return `https://flagcdn.com/w80/${code}.png`;
      }
    }
    return "https://flagcdn.com/w80/un.png";
  };

  const translateStage = (stage?: string, group?: string, matchday?: number) => {
    if (!stage) return { name: "", type: "", isKnockout: false };
    
    const cleanStage = stage.toUpperCase().trim();
    let stageName = "";
    let isKnockout = false;
    
    switch (cleanStage) {
      case "GROUP_STAGE":
        stageName = group ? `Phase de Groupes (${group.replace("GROUP_", "Groupe ")})` : "Phase de Groupes";
        if (matchday) stageName += ` - Journée ${matchday}`;
        isKnockout = false;
        break;
      case "ROUND_OF_16":
      case "LAST_16":
        stageName = "Huitièmes de finale";
        isKnockout = true;
        break;
      case "QUARTER_FINALS":
        stageName = "Quarts de finale";
        isKnockout = true;
        break;
      case "SEMI_FINALS":
        stageName = "Demi-finales";
        isKnockout = true;
        break;
      case "FINAL":
        stageName = "Finale";
        isKnockout = true;
        break;
      case "PLAYOFFS":
        stageName = "Barrages / Playoffs";
        isKnockout = true;
        break;
      default:
        stageName = stage.toLowerCase().replace(/_/g, " ");
        stageName = stageName.charAt(0).toUpperCase() + stageName.slice(1);
        isKnockout = cleanStage.includes("FINAL") || cleanStage.includes("SEMI") || cleanStage.includes("QUARTER") || cleanStage.includes("ROUND") || cleanStage.includes("PLAYOFF");
        break;
    }
    
    return {
      name: stageName,
      type: isKnockout ? "Éliminatoire" : "Groupe",
      isKnockout
    };
  };

  useEffect(() => {
    loadData();
    loadCompetitions();
    if (supabase) {
      supabase.auth.onAuthStateChange((_event, session) => {
        setUserId(session?.user?.id || null);
      });
    }
    const params = new URLSearchParams(window.location.search);
    const invite = params.get("invite");
    if (invite) {
      setTimeout(() => {
        const el = document.getElementById(`challenge-${invite}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("ring-4", "ring-emerald-400", "ring-offset-2");
        }
      }, 500);
    }
  }, []);

  // Fetch upcoming matches for competition challenges when the challenges state updates
  useEffect(() => {
    if (challenges.length > 0) {
      const compIdsToFetch = Array.from(
        new Set(
          challenges
            .filter((c) => c.matchId === 0)
            .map((c) => c.competitionId)
        )
      ).filter(compId => !upcomingMatchesByComp[compId]);

      compIdsToFetch.forEach((compId) => {
        fetch(`/api/matches/${compId}`)
          .then((res) => {
            if (res.ok) return res.json();
            throw new Error("Failed to fetch matches");
          })
          .then((data) => {
            const matchesData = data.matches || [];
            const nowStr = new Date().toISOString();
            // Filter to get upcoming timed or scheduled matches
            const sortedUpcoming = matchesData
              .filter((m: Match) => {
                return ["TIMED", "SCHEDULED"].includes(m.status) && m.utcDate >= nowStr;
              })
              .sort((a: Match, b: Match) => a.utcDate.localeCompare(b.utcDate));

            if (sortedUpcoming.length > 0) {
              setUpcomingMatchesByComp((prev) => ({
                ...prev,
                [String(compId)]: sortedUpcoming[0],
              }));
            } else {
              // Fallback to latest live/finished/paused matches if none are scheduled in the future
              const latestMatches = matchesData
                .filter((m: Match) => ["IN_PLAY", "LIVE", "PAUSED", "FINISHED"].includes(m.status))
                .sort((a: Match, b: Match) => b.utcDate.localeCompare(a.utcDate));
              if (latestMatches.length > 0) {
                setUpcomingMatchesByComp((prev) => ({
                  ...prev,
                  [String(compId)]: latestMatches[0],
                }));
              } else {
                setUpcomingMatchesByComp((prev) => ({
                  ...prev,
                  [String(compId)]: { id: -1, status: "NO_MATCH", homeTeam: { name: "Aucun Match", crest: "" }, awayTeam: { name: "Programmé", crest: "" }, utcDate: "" } as any,
                }));
              }
            }
          })
          .catch((err) => {
            console.error(`Error loading upcoming match for comp ${compId}:`, err);
            setUpcomingMatchesByComp((prev) => ({
              ...prev,
              [String(compId)]: { id: -1, status: "ERROR", homeTeam: { name: "Aucun Match", crest: "" }, awayTeam: { name: "Programmé", crest: "" }, utcDate: "" } as any,
            }));
          });
      });
    }
  }, [challenges, upcomingMatchesByComp]);

  // Effect to automatically pre-fill/transition when a match is preselected
  useEffect(() => {
    if (preselectedMatch && !loading && challenges.length > 0) {
      // Check if there are any existing challenges for this match
      const matchingChallenge = challenges.find((c) => c.matchId === preselectedMatch.match.id);
      
      if (matchingChallenge) {
        // If an existing challenge exists, stay in "list" mode but open its details modal
        setActiveModal({ type: "details", challenge: matchingChallenge });
      } else {
        // If no matching challenge exists, switch to "create" mode and auto-select this match
        setViewMode("create");
        setSelectedCompId(preselectedMatch.competitionId);
        setSelectedMatch(preselectedMatch.match);
        setIsTournamentSelected(false);
        setNewTitle(`Défi: ${preselectedMatch.match.homeTeam.shortName} vs ${preselectedMatch.match.awayTeam.shortName}`);
        
        if (competitions.length === 0) {
          loadCompetitions();
        }
        
        setLoadingMatches(true);
        fetch(`/api/matches/${preselectedMatch.competitionId}`)
          .then((res) => res.json())
          .then((data) => {
            const matchesData = data.matches || [];
            const upcomingMatches = Array.isArray(matchesData) 
              ? matchesData.filter((m: Match) => ["TIMED", "SCHEDULED"].includes(m.status))
              : [];
            setMatches(upcomingMatches);
            setLoadingMatches(false);
          })
          .catch((err) => {
            console.error(err);
            setLoadingMatches(false);
          });
      }
    }
  }, [preselectedMatch, loading, challenges.length]);

  // Load predictions for selected challenge
  useEffect(() => {
    if (!selectedChallenge) {
      setChallengeBets([]);
      return;
    }

    setDetailTab("matches");
    setLoadingChallengeDetails(true);

    async function loadChallengeBets() {
      if (!supabase) return;
      try {
        const { data, error } = await supabase
          .from("bets")
          .select("*")
          .eq("challenge_id", selectedChallenge.id);

        if (!error && data) {
          setChallengeBets(data);
        }
      } catch (err) {
        console.error("Error loading challenge bets:", err);
      } finally {
        setLoadingChallengeDetails(false);
      }
    }

    loadChallengeBets();
  }, [selectedChallenge]);

  const refreshChallengeBets = async () => {
    if (!selectedChallenge || !supabase) return;
    try {
      const { data } = await supabase
        .from("bets")
        .select("*")
        .eq("challenge_id", selectedChallenge.id);
      if (data) {
        setChallengeBets(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    setVisibleMatchesCount(4);
    setActiveTooltipId(null);
    const targetChallenge = selectedChallenge || (activeModal && activeModal.type === "details" ? activeModal.challenge : null);
    if (targetChallenge && targetChallenge.competitionId) {
      setLoadingModalMatches(true);
      setModalMatchesError(null);
      fetch(`/api/matches/${targetChallenge.competitionId}`)
        .then((res) => {
          if (!res.ok) throw new Error("Erreur api");
          return res.json();
        })
        .then((data) => {
          let fetchedMatches = data.matches || [];
          if (targetChallenge.matchId && targetChallenge.matchId !== 0) {
            fetchedMatches = fetchedMatches.filter((m: Match) => m.id === targetChallenge.matchId);
          }
          setModalMatches(fetchedMatches);
          setLoadingModalMatches(false);
        })
        .catch((err) => {
          console.error(err);
          setModalMatchesError("Données temporairement indisponibles.");
          setLoadingModalMatches(false);
        });
    } else {
      setModalMatches([]);
      setModalMatchesError(null);
    }
  }, [activeModal, selectedChallenge]);

  async function loadData() {
    if (!supabase) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    setUserId(user.id);

    // Fetch only challenges where the user is creator OR invited
    const { data: challengesRes, error: challengesError } = await supabase
      .from("challenges")
      .select("*, challenge_invitations!left(*)")
      .or(`creator_id.eq.${user.id},challenge_invitations.user_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (challengesError) {
      console.error("Error loading challenges:", challengesError);
      return;
    }
    
    // Bets and profiles as before
    const [betsRes, profilesRes] = await Promise.all([
      supabase.from("bets").select("*").eq("user_id", user.id),
      supabase.from("profiles").select("*"),
    ]);

    const profileMap: Record<string, string> = {};
    if (profilesRes.data) {
      setAllProfiles(profilesRes.data);
      profilesRes.data.forEach((p: any) => {
        profileMap[p.id] = p.username;
        if (p.id === user.id) {
          setCurrentUsername(p.username);
        }
      });
    }

    if (challengesRes) {
      setChallenges(
        (Array.isArray(challengesRes) ? challengesRes : []).map((c: any) => ({
          id: c.id,
          competitionId: c.competition_id,
          matchId: c.match_id,
          matchHomeTeam: c.match_home_team,
          matchAwayTeam: c.match_away_team,
          matchDate: c.match_date,
          creatorId: c.creator_id,
          creatorUsername: profileMap[c.creator_id] || "Inconnu",
          title: c.title,
          rules: c.rules,
          code: c.rules || c.id.substring(0, 8).toUpperCase(),
          pointRules:
            typeof c.point_rules === "string"
              ? JSON.parse(c.point_rules)
              : c.point_rules,
          locked: c.locked,
          resolved: c.resolved,
        }))
      );
    }

    if (betsRes.data) {
      const predMap: Record<string, Prediction> = {};
      betsRes.data.forEach((bet: any) => {
        predMap[bet.challenge_id] =
          typeof bet.predictions === "string"
            ? JSON.parse(bet.predictions)
            : bet.predictions;
      });
      setUserPredictions(predMap);
    }
    setLoading(false);
  }

  const handleSearchByCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!searchCodeInput.trim()) return;
    setSearchingChallenge(true);
    setSearchError(null);
    setSearchResult(null);
    try {
      const res = await fetch(`/api/challenges/search/${encodeURIComponent(searchCodeInput.trim())}`);
      if (res.ok) {
        const data = await res.json();
        // Map backend's challenge object to local Challenge interface format
        const foundChallenge: Challenge = {
          id: data.id,
          competitionId: data.competition_id,
          matchId: data.match_id,
          matchHomeTeam: data.match_home_team,
          matchAwayTeam: data.match_away_team,
          matchDate: data.match_date,
          creatorId: data.creator_id,
          creatorUsername: data.creator_username,
          title: data.title,
          rules: data.rules,
          code: data.rules || data.id.substring(0, 8).toUpperCase(),
          pointRules:
            typeof data.point_rules === "string"
              ? JSON.parse(data.point_rules)
              : data.point_rules,
          locked: data.locked,
          resolved: data.resolved,
        };
        setSearchResult(foundChallenge);
      } else {
        const err = await res.json();
        setSearchError(err.error || "Aucun défi trouvé avec ce code.");
      }
    } catch (err: any) {
      console.error(err);
      setSearchError("Une erreur est survenue lors de la recherche.");
    } finally {
      setSearchingChallenge(false);
    }
  };

  const handleJoinChallenge = async (challengeToJoin: Challenge) => {
    if (!supabase || !userId) {
      alert("Vous devez être connecté pour rejoindre un défi.");
      return;
    }
    setJoiningChallengeId(challengeToJoin.id);
    try {
      // Create invitation entry for the user so they can view and participate
      const { error } = await supabase
        .from("challenge_invitations")
        .upsert(
          {
            challenge_id: challengeToJoin.id,
            user_id: userId,
            accepted: true,
          },
          { onConflict: "challenge_id, user_id" }
        );

      if (error) {
        throw error;
      }

      // Reload all challenges to fetch the newly joined challenge in local list, or append if missing
      await loadData();
      
      // Close the search modal
      setIsSearchModalOpen(false);
      setSearchCodeInput("");
      setSearchResult(null);
      
      // Select the joined challenge automatically to open its detailed predictions view!
      setSelectedChallenge(challengeToJoin);
      
      alert(`Félicitations! Vous avez rejoint le défi "${challengeToJoin.title}" avec succès.`);
    } catch (err: any) {
      console.error("Error joining challenge:", err);
      alert("Impossible de rejoindre ce défi: " + (err.message || err));
    } finally {
      setJoiningChallengeId(null);
    }
  };

  const loadCompetitions = async () => {
    setLoadingComps(true);
    setApiError(null);
    try {
      const res = await fetch("/api/competitions");
      if (res.ok) {
        const data = await res.json();
        setCompetitions(Array.isArray(data.competitions) ? data.competitions : []);
      } else {
        const errorData = await res.json();
        setApiError(errorData.error || "Erreur lors de la récupération des compétitions");
      }
    } catch (e) {
      console.error(e);
      setApiError("Erreur réseau");
    }
    setLoadingComps(false);
  };

  const loadMatches = async (compId: number) => {
    setSelectedCompId(compId);
    setSelectedMatch(null);
    setIsTournamentSelected(false);
    setLoadingMatches(true);
    setApiError(null);
    try {
      const res = await fetch(`/api/matches/${compId}`);
      if (res.ok) {
        const data = await res.json();
        const matchesData = data.matches || [];
        const upcomingMatches = Array.isArray(matchesData) 
          ? matchesData.filter((m: Match) =>
              ["TIMED", "SCHEDULED"].includes(m.status),
            )
          : [];
        setMatches(upcomingMatches);
      } else {
        const errorData = await res.json();
        setApiError(errorData.error || "Erreur lors de la récupération des matchs");
      }
    } catch (e) {
      console.error(e);
      setApiError("Erreur réseau");
    }
    setLoadingMatches(false);
  };

  const handleCreateView = () => {
    setViewMode("create");
    setSelectedChallenge(null);
    if (competitions.length === 0) {
      loadCompetitions();
    }
  };

  const shareOnWhatsApp = (challenge: Challenge) => {
    const appUrl =
      (import.meta as any).env?.VITE_APP_URL || window.location.origin;
    const inviteUrl = `${appUrl}?invite=${challenge.id}`;
    
    let desc = "";
    if (challenge.matchId === 0) {
      const comp = competitions.find(c => String(c.id) === String(challenge.competitionId));
      desc = `Rejoins mon défi sur Mirfoot : "${challenge.title}" pour toute la compétition ${comp?.name || "de football"} !\n\nParticipe ici : ${inviteUrl}`;
    } else {
      desc = `Rejoins mon défi sur Mirfoot : "${challenge.title}" pour le match ${challenge.matchHomeTeam} vs ${challenge.matchAwayTeam} !\n\nParticipe ici : ${inviteUrl}`;
    }
    
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(desc)}`;
    window.open(url, "_blank");
  };


  const handleCreateChallenge = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || !selectedMatch) {
      alert("Veuillez sélectionner un match d'abord.");
      return;
    }

    setCreating(true);
    
    // Get fresh user ID to be safe
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = user?.id || userId;

    if (!currentUserId) {
      alert("Session expirée. Veuillez vous reconnecter.");
      setCreating(false);
      return;
    }

    // Double check that the profile exists to avoid foreign key errors
    const { data: profileCheck } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", currentUserId)
      .single();

    if (!profileCheck) {
      alert("Votre profil n'a pas été trouvé. Redirection vers la configuration du profil...");
      window.location.reload(); // App.tsx will catch this and show ProfileSetupView
      setCreating(false);
      return;
    }

    const title = newTitle.trim()
      ? newTitle
      : selectedMatch.id === 0 
        ? `Défi: ${competitions.find(c => String(c.id) === String(selectedCompId))?.name || "Compétition"}`
        : `Défi: ${selectedMatch.homeTeam.shortName} vs ${selectedMatch.awayTeam.shortName}`;

    const savedRules: PointRules & {
      match_metadata?: {
        home_crest?: string;
        away_crest?: string;
      };
    } = {
      group_stage: {
        exact_score: customRulesConfig.exact_score.enabled ? customRulesConfig.exact_score.points : 0,
        correct_winner: customRulesConfig.correct_winner.enabled ? customRulesConfig.correct_winner.points : 0,
        closest_guess: customRulesConfig.closest_guess.enabled ? customRulesConfig.closest_guess.points : 0,
      },
      knockout_stage: {
        exact_score: customRulesConfig.exact_score.enabled ? customRulesConfig.exact_score.points : 0,
        correct_winner: customRulesConfig.correct_winner.enabled ? customRulesConfig.correct_winner.points : 0,
        closest_guess: customRulesConfig.closest_guess.enabled ? customRulesConfig.closest_guess.points : 0,
        exact_score_penalties: customRulesConfig.exact_score_penalties.enabled ? customRulesConfig.exact_score_penalties.points : 0,
        correct_winner_penalties: customRulesConfig.correct_winner_penalties.enabled ? customRulesConfig.correct_winner_penalties.points : 0,
        prolongation_winner: customRulesConfig.prolongation_winner.enabled ? customRulesConfig.prolongation_winner.points : 0,
        prolongation_score: customRulesConfig.prolongation_score.enabled ? customRulesConfig.prolongation_score.points : 0,
        penalties_winner: customRulesConfig.penalties_winner.enabled ? customRulesConfig.penalties_winner.points : 0,
      },
      match_metadata: {
        home_crest: selectedMatch.homeTeam?.crest || "",
        away_crest: selectedMatch.awayTeam?.crest || "",
      }
    };

    const generatedCode = "DEF-" + Math.random().toString(36).substring(2, 8).toUpperCase();

    const { data, error } = await supabase
      .from("challenges")
      .insert({
        competition_id: selectedCompId,
        match_id: selectedMatch.id,
        match_home_team: selectedMatch.homeTeam.name,
        match_away_team: selectedMatch.awayTeam.name,
        match_date: selectedMatch.utcDate,
        creator_id: currentUserId,
        title: title,
        point_rules: savedRules,
        locked: false,
        resolved: false,
        type: 'match',
        rules: generatedCode,
      })
      .select();

    if (!error && data) {
      const newCard: Challenge = {
        id: data[0].id,
        competitionId: data[0].competition_id,
        matchId: data[0].match_id,
        matchHomeTeam: data[0].match_home_team,
        matchAwayTeam: data[0].match_away_team,
        matchDate: data[0].match_date,
        creatorId: data[0].creator_id,
        creatorUsername: currentUsername,
        title: data[0].title,
        pointRules: data[0].point_rules,
        rules: data[0].rules,
        code: data[0].rules || data[0].id.substring(0, 8).toUpperCase(),
        locked: data[0].locked,
        resolved: data[0].resolved,
      };
      setChallenges((prev) => [newCard, ...prev]);
      setViewMode("list");
      setNewTitle("");
      setSelectedMatch(null);
    } else if (error) {
      console.error("Erreur de création:", error);
      alert("Erreur lors de la création du défi: " + error.message);
    }
    setCreating(false);
  };

  const handleLock = async (challengeId: string) => {
    if (!supabase) return;
    setChallenges((prev) =>
      (Array.isArray(prev) ? prev : []).map((c) => (c.id === challengeId ? { ...c, locked: true } : c)),
    );
    await supabase
      .from("challenges")
      .update({ locked: true })
      .eq("id", challengeId);
  };

  const performDelete = async (challengeId: string | number) => {
    if (!supabase) return;
    
    // First, delete associated bets
    const { error: betsError } = await supabase
      .from("bets")
      .delete()
      .eq("challenge_id", challengeId);

    if (betsError) {
      alert("Erreur lors de la suppression des paris: " + betsError.message);
      return;
    }

    // Then delete the challenge
    const { error } = await supabase
      .from("challenges")
      .delete()
      .eq("id", challengeId);

    if (!error) {
      await loadData(); // Reload data to sync with DB
    } else {
      alert("Erreur lors de la suppression du défi: " + error.message);
    }
  };

  const updatePredictionForm = (
    challengeId: string,
    updates: Partial<Prediction>,
  ) => {
    setPredictionForms((prev) => ({
      ...prev,
      [challengeId]: { ...(prev[challengeId] || {}), ...updates },
    }));
  };

  const updateCompetitionPredictionForm = (
    challengeId: string,
    matchId: number,
    updates: { homeScore?: number; awayScore?: number },
  ) => {
    setPredictionForms((prev) => {
      const currentChallengeForm = prev[challengeId] || {};
      const currentMatches = currentChallengeForm.matches || {};
      return {
        ...prev,
        [challengeId]: {
          ...currentChallengeForm,
          matches: {
            ...currentMatches,
            [matchId]: {
              ...(currentMatches[matchId] || {}),
              ...updates,
            },
          },
        },
      };
    });
  };

  const submitPrediction = async (challenge: Challenge) => {
    if (!supabase || !userId || challenge.locked || challenge.resolved) return;

    const pred = predictionForms[challenge.id];

    if (challenge.type === "custom") {
      if (!pred || !pred.customAnswer) {
        alert("Veuillez sélectionner une option !");
        return;
      }
    } else {
      if (
        !pred ||
        pred.homeScore === undefined ||
        pred.awayScore === undefined
      ) {
        alert("Veuillez remplir au moins les scores !");
        return;
      }
    }

    setUserPredictions((prev) => ({ ...prev, [challenge.id]: pred }));

    const { error } = await supabase.from("bets").upsert(
      {
        user_id: userId,
        challenge_id: challenge.id,
        predictions: pred,
      },
      { onConflict: "user_id,challenge_id" },
    );

    if (error) {
      console.error("Erreur lors de l'enregistrement du pari:", error);
    }
  };

  const submitCompetitionPrediction = async (
    challenge: Challenge,
    matchId: number,
    homeScore?: number,
    awayScore?: number,
  ) => {
    if (!supabase || !userId || challenge.locked || challenge.resolved) return;

    if (homeScore === undefined || awayScore === undefined || isNaN(homeScore) || isNaN(awayScore)) {
      alert("Veuillez remplir les scores avant de valider !");
      return;
    }

    // Capture the current predictions map from state if it exists
    const currentPreds = userPredictions[challenge.id] || {};
    const matchesPreds = currentPreds.matches || {};

    const updatedMatches = {
      ...matchesPreds,
      [matchId]: {
        homeScore,
        awayScore,
      },
    };

    const updatedChallengePreds = {
      ...currentPreds,
      matches: updatedMatches,
    };

    const { error } = await supabase.from("bets").upsert(
      {
        user_id: userId,
        challenge_id: challenge.id,
        predictions: updatedChallengePreds,
      },
      { onConflict: "user_id,challenge_id" },
    );

    if (error) {
      console.error("Erreur l'enregistrement du pari de compétition:", error);
      alert("Erreur lors de l'enregistrement: " + error.message);
    } else {
      setUserPredictions((prev) => ({
        ...prev,
        [challenge.id]: updatedChallengePreds,
      }));
    }
  };


  const renderCreateForm = () => {
    return (
      <form
        onSubmit={handleCreateChallenge}
        className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6"
      >
        <h3 className="font-bold text-lg text-emerald-800 border-b border-gray-100 pb-2">
          1. Choisir le Match
        </h3>

        {loadingComps ? (
          <div className="flex justify-center p-4">
            <Clock className="animate-spin text-emerald-500 w-6 h-6" />
          </div>
        ) : !selectedCompId ? (
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              Sélectionner une compétition
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Array.isArray(competitions) && competitions.map((comp) => (
                <button
                  key={comp.id}
                  type="button"
                  onClick={() => loadMatches(comp.id)}
                  className="p-3 border-2 border-gray-100 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition text-sm font-semibold text-gray-700 cursor-pointer"
                >
                  {comp.name}
                </button>
              ))}
            </div>
          </div>
        ) : !selectedMatch ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-semibold text-gray-700">
                Sélectionner un match
              </label>
              <button
                type="button"
                onClick={() => setSelectedCompId(null)}
                className="text-xs text-emerald-600 font-bold hover:underline"
              >
                Changer de compétition
              </button>
            </div>

            {loadingMatches ? (
              <div className="flex justify-center p-4">
                <Clock className="animate-spin text-emerald-500 w-6 h-6" />
              </div>
            ) : matches.length === 0 ? (
              <div className="text-sm text-gray-500 bg-gray-50 p-4 rounded-xl text-center">
                Aucun match à venir disponible pour cette compétition.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                <button
                  type="button"
                  onClick={() => setIsTournamentSelected(true)}
                  className={`w-full p-3 border-2 ${isTournamentSelected ? 'border-emerald-500 bg-emerald-50' : 'border-emerald-100'} rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition flex justify-between items-center text-sm font-semibold text-emerald-700 cursor-pointer`}
                >
                  <span>Toute la compétition</span>
                </button>
                {isTournamentSelected && (
                  <button
                    onClick={() => {
                      if (!selectedCompId) return;
                      setSelectedMatch({ 
                        id: 0, 
                        competitionId: selectedCompId,
                        homeTeam: { id: 0, shortName: "Comp", name: "Comp", crest: "", tla: "CMP" }, 
                        awayTeam: { id: 0, shortName: "Comp", name: "Comp", crest: "", tla: "CMP" }, 
                        utcDate: new Date().toISOString(), 
                        status: "SCHEDULED",
                        matchday: 0
                      } as unknown as Match);
                    }}
                    className="w-full bg-emerald-600 text-white font-bold p-3 rounded-xl mt-2 cursor-pointer hover:bg-emerald-700 transition-colors"
                  >
                    Continuer
                  </button>
                )}
                {Array.isArray(matches) && matches.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMatch(m)}
                    className="w-full p-3 border-2 border-gray-100 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition flex justify-between items-center text-sm font-semibold text-gray-700"
                  >
                    <span className="flex items-center gap-2">
                       {m.homeTeam.crest && <img src={m.homeTeam.crest} alt={m.homeTeam.shortName} className="w-6 h-6 object-contain" />}
                       {m.homeTeam.shortName}{" "}
                       <span className="text-gray-400 font-medium">vs</span>{" "}
                       {m.awayTeam.shortName}
                       {m.awayTeam.crest && <img src={m.awayTeam.crest} alt={m.awayTeam.shortName} className="w-6 h-6 object-contain" />}
                     </span>
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-500">
                      {new Date(m.utcDate).toLocaleDateString("fr-FR", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          selectedMatch ? (
          <div className="space-y-6">
            <div className="bg-emerald-50 p-4 py-3 rounded-xl flex justify-between items-center border border-emerald-100">
              <div className="flex items-center gap-3">
                {selectedMatch.id !== 0 && selectedMatch.homeTeam.crest && <img src={selectedMatch.homeTeam.crest} alt={selectedMatch.homeTeam.shortName} className="w-8 h-8 object-contain" />}
                <div>
                  <div className="text-xs text-emerald-600 font-bold mb-1 uppercase tracking-wider">
                    {selectedMatch.id === 0 ? "Compétition sélectionnée" : "Match sélectionné"}
                  </div>
                  <div className="font-bold text-gray-800">
                    {selectedMatch.id === 0 
                      ? competitions.find(c => String(c.id) === String(selectedCompId))?.name || "Toute la compétition"
                      : `${selectedMatch.homeTeam.shortName} vs ${selectedMatch.awayTeam.shortName}`
                    }
                  </div>
                </div>
                {selectedMatch.id !== 0 && selectedMatch.awayTeam.crest && <img src={selectedMatch.awayTeam.crest} alt={selectedMatch.awayTeam.shortName} className="w-8 h-8 object-contain" />}
              </div>
              <button
                type="button"
                onClick={() => setSelectedMatch(null)}
                className="text-xs text-emerald-700 font-bold bg-white px-2 py-1 rounded shadow-sm hover:bg-emerald-100"
              >
                Modifier
              </button>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Titre du défi (Optionnel)
              </label>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={selectedMatch.id === 0 
                  ? `Défi: ${competitions.find(c => String(c.id) === String(selectedCompId))?.name || "Compétition"}`
                  : `Défi: ${selectedMatch.homeTeam.shortName} vs ${selectedMatch.awayTeam.shortName}`}
                className="w-full border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none placeholder-gray-400 text-sm"
              />
            </div>

            <div className="border-t border-gray-100 pt-4">
              <h3 className="font-bold text-lg text-emerald-800 mb-3 border-b border-gray-100 pb-2">
                Configuration des Règles
              </h3>
              <div className="text-sm space-y-2">
                {Object.entries(customRulesConfig).map(([key, rule]: [string, any]) => (
                  <div key={key} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <label className="flex items-center gap-2 cursor-pointer font-semibold text-gray-700">
                      <input type="checkbox" checked={rule.enabled} onChange={() => toggleRule(key)} className="accent-emerald-600" />
                      <span className="text-xs">{rule.label}</span>
                    </label>
                    <input
                      type="number"
                      value={rule.points}
                      onChange={(e) => updateRulePoints(key, parseInt(e.target.value))}
                      className="w-16 p-1 rounded-lg border border-gray-200 text-center text-xs"
                      disabled={!rule.enabled}
                    />
                  </div>
                ))}
              </div>
            </div>

            <button
              disabled={creating}
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl transition mt-4 shadow-sm"
            >
              {creating ? "Création..." : "Créer le Défi et Inviter"}
            </button>
          </div>
          ) : null
        )}
      </form>
    );
  };

  const renderPredictionForm = (challenge: Challenge) => {
    const isLocked = challenge.locked || challenge.resolved;
    const userPred = userPredictions[challenge.id];
    // If they already subitted, use their previous subitted values, else use the active form edits
    const activeForm = userPred || predictionForms[challenge.id] || {};

    const timeLeft = challenge.matchDate ? new Date(challenge.matchDate).getTime() - new Date().getTime() : Infinity;
    const isOpen = timeLeft > 0 && !isLocked;

    return (
      <div className="space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-100 mt-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center flex flex-col items-center">
            <div className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-full overflow-hidden shrink-0 shadow-xs mb-1.5 p-1">
              <img 
                src={getFlagUrl(challenge.matchHomeTeam || "", (challenge.pointRules as any)?.match_metadata?.home_crest)} 
                alt="" 
                className="max-w-full max-h-full object-contain"
                onError={(e) => { e.currentTarget.src = "https://flagcdn.com/w80/un.png"; }}
              />
            </div>
            <label className="block text-xs font-bold text-gray-700 mb-2 truncate max-w-[120px]">
              {challenge.matchHomeTeam}
            </label>
            <input
              type="number"
              min="0"
              value={activeForm.homeScore ?? ""}
              onChange={(e) =>
                updatePredictionForm(challenge.id, {
                  homeScore: parseInt(e.target.value),
                })
              }
              disabled={!isOpen && !userPred}
              readOnly={!!userPred}
              className="w-16 h-12 text-center text-xl font-black rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 mx-auto block disabled:bg-gray-100 disabled:text-gray-500"
            />
          </div>
          <div className="text-center flex flex-col items-center">
            <div className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-full overflow-hidden shrink-0 shadow-xs mb-1.5 p-1">
              <img 
                src={getFlagUrl(challenge.matchAwayTeam || "", (challenge.pointRules as any)?.match_metadata?.away_crest)} 
                alt="" 
                className="max-w-full max-h-full object-contain"
                onError={(e) => { e.currentTarget.src = "https://flagcdn.com/w80/un.png"; }}
              />
            </div>
            <label className="block text-xs font-bold text-gray-700 mb-2 truncate max-w-[120px]">
              {challenge.matchAwayTeam}
            </label>
            <input
              type="number"
              min="0"
              value={activeForm.awayScore ?? ""}
              onChange={(e) =>
                updatePredictionForm(challenge.id, {
                  awayScore: parseInt(e.target.value),
                })
              }
              disabled={!isOpen && !userPred}
              readOnly={!!userPred}
              className="w-16 h-12 text-center text-xl font-black rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 mx-auto block disabled:bg-gray-100 disabled:text-gray-500"
            />
          </div>
        </div>

        {/* Knockout Match Prediction Fields */}
        {(challenge.pointRules as any)?.knockout_stage && 
         activeForm.homeScore !== undefined && 
         activeForm.homeScore === activeForm.awayScore && (
          <div className="mt-4 pt-4 border-t border-gray-200 animate-in fade-in duration-300">
            <p className="text-xs font-bold text-gray-500 mb-3 text-center">Le match se termine en :</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                className={`p-2 rounded-lg text-xs font-bold ${activeForm.endStage === 'prolongation' ? 'bg-emerald-600 text-white' : 'bg-gray-200'}`}
                onClick={() => updatePredictionForm(challenge.id, {endStage: 'prolongation'})}
              >Prolongation</button>
              <button
                className={`p-2 rounded-lg text-xs font-bold ${activeForm.endStage === 'penalties' ? 'bg-emerald-600 text-white' : 'bg-gray-200'}`}
                onClick={() => updatePredictionForm(challenge.id, {endStage: 'penalties'})}
              >Penalty</button>
            </div>
            
            {activeForm.endStage === 'prolongation' && (
                <div className="grid grid-cols-3 gap-2">
                    <input type="number" placeholder="Pr. Home Sc." className="text-center p-2 rounded-lg text-xs" value={activeForm.prolongationHomeScore ?? ""} onChange={(e) => updatePredictionForm(challenge.id, {prolongationHomeScore: parseInt(e.target.value)})} />
                    <input type="number" placeholder="Pr. Away Sc." className="text-center p-2 rounded-lg text-xs" value={activeForm.prolongationAwayScore ?? ""} onChange={(e) => updatePredictionForm(challenge.id, {prolongationAwayScore: parseInt(e.target.value)})} />
                    <select className="text-center p-2 rounded-lg text-xs" value={activeForm.winner ?? ""} onChange={(e) => updatePredictionForm(challenge.id, {winner: e.target.value as any})}>
                        <option value="">Vainqueur</option>
                        <option value="home">{challenge.matchHomeTeam}</option>
                        <option value="away">{challenge.matchAwayTeam}</option>
                    </select>
                </div>
            )}
            
            {activeForm.endStage === 'penalties' && (
                <div className="grid grid-cols-1 gap-2">
                    <select className="text-center p-2 rounded-lg text-xs" value={activeForm.winner ?? ""} onChange={(e) => updatePredictionForm(challenge.id, {winner: e.target.value as any})}>
                        <option value="">Vainqueur Penalty</option>
                        <option value="home">{challenge.matchHomeTeam}</option>
                        <option value="away">{challenge.matchAwayTeam}</option>
                    </select>
                </div>
            )}
          </div>
        )}

        <div className="space-y-3 pt-2">
          {challenge.pointRules?.knockout_stage.exact_score_penalties! > 0 && (
            <div className="flex border-t border-gray-100 pt-3 flex-col gap-2">
                <label className="block text-xs font-bold text-gray-700">
                   Score des Tirs au but (si égalité)
                </label>
                <div className="flex gap-2 justify-center font-bold">
                    <input
                      type="number"
                      placeholder="Dom."
                      value={activeForm.penaltiesHomeScore ?? ""}
                      onChange={(e) => updatePredictionForm(challenge.id, { penaltiesHomeScore: parseInt(e.target.value) })}
                      disabled={!isOpen && !userPred}
                      className="w-12 h-10 text-center border rounded-lg"
                    />
                    <span className="self-center">-</span>
                    <input
                        type="number"
                        placeholder="Ext."
                        value={activeForm.penaltiesAwayScore ?? ""}
                        onChange={(e) => updatePredictionForm(challenge.id, { penaltiesAwayScore: parseInt(e.target.value) })}
                        disabled={!isOpen && !userPred}
                        className="w-12 h-10 text-center border rounded-lg"
                    />
                </div>
            </div>
          )}
        </div>

        {!userPred && isOpen && (
          <button
            type="button"
            onClick={() => submitPrediction(challenge)}
            className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-sm cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            Valider mon pronostic
          </button>
        )}
        {userPred && (
          <div className="mt-4 flex items-center justify-center gap-2 text-indigo-700 font-bold bg-indigo-50 p-3 rounded-xl border border-indigo-100">
            <CheckCircle2 className="w-5 h-5" /> Ton prono est validé !
          </div>
        )}
      </div>
    );
  };

  const renderChallengeDetailView = (challenge: Challenge) => {
    // Look up creator
    const creatorProfile = allProfiles.find(p => p.id === challenge.creatorId);
    const competition = competitions.find(c => String(c.id) === String(challenge.competitionId));
    
    // WhatsApp Invitation Link
    const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=${challenge.id}`;
    const shareText = `Rejoins mon défi de pronostics sur Mirfoot : "${challenge.title}"\nParticipe ici : ${inviteUrl}`;
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;

    // Prepare leaderboard data
    let leaderboard: any[] = [];
    if (challenge.matchId !== 0) {
      // Single match challenge ranking calculation
      const singleMatch = modalMatches.find(m => m.id === challenge.matchId);
      leaderboard = challengeBets.map(bet => {
        const profile = allProfiles.find(p => p.id === bet.user_id) || { username: "Joueur", avatar_type: "emoji", avatar_value: "⚽" };
        let pts = 0;
        let isExact = false;
        let isWinner = false;
        
        if (singleMatch && singleMatch.status === "FINISHED") {
          const rHome = singleMatch.score.fullTime.home;
          const rAway = singleMatch.score.fullTime.away;
          const isKnockout = ["OCTOFINAL", "QUARTERFINAL", "SEMIFINAL", "FINAL"].includes(singleMatch.stage || "");
          const rules = isKnockout && challenge.pointRules?.knockout_stage ? challenge.pointRules.knockout_stage : challenge.pointRules?.group_stage;
          
          const predVal = typeof bet.predictions === 'string' ? JSON.parse(bet.predictions) : bet.predictions;
          const pHome = predVal?.homeScore;
          const pAway = predVal?.awayScore;
          
          if (pHome !== undefined && pAway !== undefined && rHome !== null && rAway !== null) {
            isExact = pHome === rHome && pAway === rAway;
            const actualWinner = rHome > rAway ? 'home' : rHome < rAway ? 'away' : 'draw';
            const predWinner = pHome > pAway ? 'home' : pHome < pAway ? 'away' : 'draw';
            
            if (isExact) {
              pts = rules.exact_score;
            } else if (actualWinner === predWinner) {
              pts = rules.correct_winner;
              isWinner = true;
            } else {
              const diff = Math.abs(pHome - rHome) + Math.abs(pAway - rAway);
              if (diff <= 2 && rules?.closest_guess) {
                pts = rules.closest_guess;
              }
            }
          }
        }
        
        return {
          userId: bet.user_id,
          username: profile.username,
          avatar_type: profile.avatar_type,
          avatar_value: profile.avatar_value,
          points: pts,
          isExact,
          isWinner,
          predictionsCount: 1
        };
      });
    } else {
      // Competition challenge ranking calculation
      leaderboard = challengeBets.map(bet => {
        const profile = allProfiles.find(p => p.id === bet.user_id) || { username: "Joueur", avatar_type: "emoji", avatar_value: "⚽" };
        let pts = 0;
        let exactCount = 0;
        let winnerCount = 0;
        let predictedCount = 0;
        
        const predVal = typeof bet.predictions === 'string' ? JSON.parse(bet.predictions) : bet.predictions;
        const matchesPreds = predVal?.matches || {};
        
        modalMatches.forEach(m => {
          const pMatch = matchesPreds[m.id];
          if (pMatch && pMatch.homeScore !== undefined && pMatch.awayScore !== undefined) {
            predictedCount++;
            
            if (m.status === "FINISHED") {
              const rHome = m.score.fullTime.home;
              const rAway = m.score.fullTime.away;
              const isKnockout = ["OCTOFINAL", "QUARTERFINAL", "SEMIFINAL", "FINAL"].includes(m.stage || "");
              const rules = isKnockout && challenge.pointRules?.knockout_stage ? challenge.pointRules.knockout_stage : challenge.pointRules?.group_stage;
              
              if (rHome !== null && rAway !== null) {
                const isExact = pMatch.homeScore === rHome && pMatch.awayScore === rAway;
                const actualWinner = rHome > rAway ? 'home' : rHome < rAway ? 'away' : 'draw';
                const predWinner = pMatch.homeScore > pMatch.awayScore ? 'home' : pMatch.homeScore < pMatch.awayScore ? 'away' : 'draw';
                
                if (isExact) {
                  pts += rules.exact_score;
                  exactCount++;
                } else if (actualWinner === predWinner) {
                  pts += rules.correct_winner;
                  winnerCount++;
                } else {
                  const diff = Math.abs(pMatch.homeScore - rHome) + Math.abs(pMatch.awayScore - rAway);
                  if (diff <= 2 && rules?.closest_guess) {
                    pts += rules.closest_guess;
                  }
                }
              }
            }
          }
        });

        return {
          userId: bet.user_id,
          username: profile.username,
          avatar_type: profile.avatar_type,
          avatar_value: profile.avatar_value,
          points: pts,
          exactCount,
          winnerCount,
          predictionsCount: predictedCount
        };
      });
    }

    // Sort leaderboard desc
    leaderboard.sort((a, b) => b.points - a.points);

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Back and Title header */}
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 text-white rounded-3xl p-6 shadow-md border border-emerald-500/10">
          <button 
            type="button"
            onClick={() => setSelectedChallenge(null)}
            className="flex items-center gap-2 text-xs font-bold text-emerald-100 hover:text-white mb-4 bg-white/10 px-3.5 py-1.5 rounded-xl backdrop-blur-sm transition cursor-pointer select-none"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à la liste des défis
          </button>
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="text-[10px] uppercase font-black text-emerald-200 tracking-wider flex items-center gap-1.5 mb-1 bg-white/10 px-2 py-0.5 rounded-full w-max">
                {challenge.matchId !== 0 ? "🎯 Match Unique" : "🏆 Compétition"}
              </div>
              <h2 className="text-2xl font-black tracking-tight capitalize">{challenge.title}</h2>
              <p className="text-emerald-100/90 text-sm font-semibold mt-1 flex flex-wrap items-center gap-2">
                Créé par : <span className="font-extrabold bg-white/10 px-2 py-0.5 rounded-md">{challenge.creatorUsername}</span>
                {challenge.code && (
                  <span 
                    className="flex flex-wrap items-center gap-1.5 cursor-pointer hover:text-white transition"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(challenge.code as string);
                      // Custom feedback instead of native alert
                      const toast = document.getElementById('copy-toast');
                      if (toast) {
                        toast.style.display = 'block';
                        setTimeout(() => toast.style.display = 'none', 2000);
                      }
                    }}
                    title="Cliquer pour copier"
                  >
                    <span>Code Invite:</span>
                    <span className="font-black bg-emerald-900/40 border border-emerald-500/30 text-emerald-100 px-2 py-0.5 rounded-lg text-sm select-all">
                      {challenge.code}
                    </span>
                    <div id="copy-toast" style={{display: 'none'}} className="absolute top-10 right-4 bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-lg">Code copié !</div>
                  </span>
                )}
              </p>
            </div>
            
            <div className="flex gap-2 shrink-0">
              <a 
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-white hover:bg-emerald-50 text-emerald-700 font-bold py-2.5 px-4 rounded-2xl text-xs transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
              >
                <Share2 className="w-4 h-4 text-emerald-600" />
                Inviter des amis
              </a>
              <button 
                type="button"
                onClick={() => setActiveModal({ type: 'rules', challenge })}
                className="bg-emerald-700/50 hover:bg-emerald-700 border border-emerald-500 text-emerald-100 font-bold py-2.5 px-4 rounded-2xl text-xs transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
              >
                <Info className="w-4 h-4 text-emerald-300" />
                Barème
              </button>
            </div>
          </div>
        </div>

        {/* Tab selection */}
        <div className="bg-white border border-gray-100 rounded-2xl p-1.5 shadow-xs flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setDetailTab("matches")}
            className={`flex-1 min-w-[70px] text-center py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              detailTab === "matches"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            Pronostics
          </button>
          <button
            type="button"
            onClick={() => setDetailTab("leaderboard")}
            className={`flex-1 min-w-[70px] text-center py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              detailTab === "leaderboard"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
            }`}
          >
            <Trophy className="w-4 h-4" />
            Classement
          </button>
          <button
            type="button"
            onClick={() => setDetailTab("participants")}
            className={`flex-1 min-w-[70px] text-center py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              detailTab === "participants"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
            }`}
          >
            <Users className="w-4 h-4" />
            Participants
          </button>
          <button
            type="button"
            onClick={() => setDetailTab("results")}
            className={`flex-1 min-w-[70px] text-center py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              detailTab === "results"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
            }`}
          >
            <Calendar className="w-4 h-4" />
            Résultats Réels
          </button>
        </div>

        {/* Tab contents */}
        <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm min-h-[300px]">
          {detailTab === "matches" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3 mb-3">
                <h3 className="font-bold text-gray-800 text-sm">Entrez vos pronostics pour les matchs de ce défi :</h3>
                {challenge.matchId === 0 && (
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded font-extrabold uppercase">
                    Compétition : {competition?.name || "Football"}
                  </span>
                )}
              </div>

              {loadingModalMatches ? (
                <div className="flex justify-center py-16">
                  <Clock className="w-8 h-8 text-emerald-500 animate-spin" />
                </div>
              ) : modalMatchesError ? (
                <p className="text-center py-12 text-sm text-red-500 italic bg-red-50 border border-red-100 rounded-2xl">{modalMatchesError}</p>
              ) : challenge.matchId !== 0 ? (
                // Single match predictions
                <div>
                  {renderPredictionForm(challenge)}
                </div>
              ) : modalMatches.length === 0 ? (
                <p className="text-center text-gray-400 py-12 text-sm italic">Aucun match programmé trouvé pour cette compétition.</p>
              ) : (
                // Competition match list predictions style
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                  {modalMatches.map((m) => {
                    const challengeId = challenge.id;
                    const userPredMap = userPredictions[challengeId]?.matches || {};
                    const userPredMatch = userPredMap[m.id];
                    
                    const formMap = predictionForms[challengeId]?.matches || {};
                    const formMatch = formMap[m.id] || {};
                    const matchTime = new Date(m.utcDate).getTime();
                    const timeLeft = matchTime - new Date().getTime();
                    const isOpen = timeLeft > 0 && !challenge.locked && !challenge.resolved;
                    
                    const scoreHome = userPredMatch?.homeScore !== undefined ? userPredMatch.homeScore : formMatch.homeScore;
                    const scoreAway = userPredMatch?.awayScore !== undefined ? userPredMatch.awayScore : formMatch.awayScore;
                    
                    const hasSubmitted = userPredMatch?.homeScore !== undefined && userPredMatch?.awayScore !== undefined;

                    return (
                      <div key={m.id} className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100 space-y-3.5">
                        <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100/50 pb-2">
                          <span>
                            {new Date(m.utcDate).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} • {new Date(m.utcDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className={isOpen ? "text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full animate-pulse" : "bg-gray-100 text-gray-500 px-2.5 py-0.5 rounded-full"}>
                            {timeLeft < 0 ? "Expiré" : isOpen ? "Ouvert" : "À venir"}
                          </span>
                        </div>

                        {m.stage && (() => {
                          const info = translateStage(m.stage, m.group, m.matchday);
                          return (
                            <div className="flex justify-between items-center text-[10px] font-semibold text-gray-500 bg-slate-100/40 p-1.5 rounded-lg border border-slate-100/30">
                              <span className="truncate max-w-[70%] font-bold text-indigo-950">{info.name}</span>
                              <span className={`px-1.5 py-0.5 rounded font-extrabold text-[8.5px] uppercase tracking-wider ${
                                info.isKnockout 
                                  ? "bg-rose-50 text-rose-600 border border-rose-100/60" 
                                  : "bg-indigo-50 text-indigo-600 border border-indigo-100/60"
                              }`}>
                                {info.type}
                              </span>
                            </div>
                          );
                        })()}

                        <div className="flex items-center justify-between">
                          <div className="flex flex-col items-center flex-1 min-w-0">
                            <div className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-full overflow-hidden shrink-0 shadow-xs mb-1.5 p-1">
                              <img 
                                src={getFlagUrl(m.homeTeam.name, m.homeTeam.crest)} 
                                alt="" 
                                className="max-w-full max-h-full object-contain"
                                onError={(e) => { e.currentTarget.src = "https://flagcdn.com/w80/un.png"; }}
                              />
                            </div>
                            <span className="font-bold text-center text-[11px] text-gray-800 truncate w-full">{m.homeTeam.shortName || m.homeTeam.name}</span>
                          </div>

                          <div className="relative flex px-2 justify-center items-center gap-1.5">
                            <input 
                              type="number"
                              min="0"
                              value={scoreHome ?? ""}
                              onChange={(e) => updateCompetitionPredictionForm(challengeId, m.id, { homeScore: parseInt(e.target.value) })}
                              disabled={!isOpen || hasSubmitted}
                              className="w-10 h-10 text-center text-sm font-bold border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100 disabled:text-gray-400 select-none"
                            />
                            <span className="font-black text-gray-300 text-xs">VS</span>
                            <input 
                              type="number"
                              min="0"
                              value={scoreAway ?? ""}
                              onChange={(e) => updateCompetitionPredictionForm(challengeId, m.id, { awayScore: parseInt(e.target.value) })}
                              disabled={!isOpen || hasSubmitted}
                              className="w-10 h-10 text-center text-sm font-bold border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100 disabled:text-gray-400 select-none"
                            />
                          </div>

                          <div className="flex flex-col items-center flex-1 min-w-0">
                            <div className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-full overflow-hidden shrink-0 shadow-xs mb-1.5 p-1">
                              <img 
                                src={getFlagUrl(m.awayTeam.name, m.awayTeam.crest)} 
                                alt="" 
                                className="max-w-full max-h-full object-contain"
                                onError={(e) => { e.currentTarget.src = "https://flagcdn.com/w80/un.png"; }}
                              />
                            </div>
                            <span className="font-bold text-center text-[11px] text-gray-800 truncate w-full">{m.awayTeam.shortName || m.awayTeam.name}</span>
                          </div>
                        </div>

                        {hasSubmitted && isOpen && (
                          <div className="mt-2 text-center">
                            <button 
                              className="w-full text-xs font-black bg-gradient-to-br from-amber-400 to-orange-500 text-white py-2 rounded-lg hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                              onClick={() => { /* Need: handler to toggle bonus */}}
                            >
                               <Trophy className="w-3.5 h-3.5" />
                               Jouer Bonus X2
                            </button>
                            <p className="text-[9px] text-gray-400 mt-1">Si juste : Score x2 | Si faux : -4 pts</p>
                          </div>
                        )}

                        {/* Submit Button for Competition Match bet */}
                        <div className="mt-3">
                          {hasSubmitted ? (
                            <div className="bg-emerald-50/50 border border-emerald-100/50 py-2 rounded-xl text-[11px] font-black text-emerald-800 text-center flex items-center justify-center gap-1">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              Pronostic validé ({scoreHome} - {scoreAway})
                            </div>
                          ) : isOpen ? (
                            <button
                              type="button"
                              onClick={() => {
                                submitCompetitionPrediction(challenge, m.id, scoreHome, scoreAway).then(() => {
                                  refreshChallengeBets();
                                });
                              }}
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-xs transition duration-200 active:scale-[0.98] cursor-pointer"
                            >
                              Valider mon pronostic
                            </button>
                          ) : (
                            <div className="text-[10px] text-gray-400 bg-gray-100 text-center font-bold p-1 rounded-lg">
                              Pronostics fermés
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {detailTab === "leaderboard" && (
            <div className="space-y-4">
              <h3 className="font-bold text-gray-800 text-sm border-b border-gray-100 pb-3 mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-500" />
                Classement Général de ce défi
              </h3>
              
              {loadingChallengeDetails ? (
                <div className="flex justify-center py-16">
                  <Clock className="w-8 h-8 text-emerald-500 animate-spin" />
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm italic">
                  Aucun participant n'a encore enregistré de pronostic pour ce défi !
                </div>
              ) : (
                <div className="space-y-3">
                  {leaderboard.map((player, index) => {
                    const isCurrentUser = player.userId === userId;

                    return (
                      <div 
                        key={player.userId}
                        className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                          isCurrentUser 
                            ? "bg-emerald-50/50 border-emerald-300 shadow-sm" 
                            : index === 0 
                              ? "bg-yellow-50/20 border-yellow-100" 
                              : "bg-white border-gray-100"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-6 text-center font-black text-xs ${index === 0 ? 'text-yellow-600' : 'text-gray-400'}`}>
                            #{index + 1}
                          </span>
                          
                          <div className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg text-lg">
                            {player.avatar_type === "emoji" ? player.avatar_value : "⚽"}
                          </div>
                          
                          <div>
                            <span className={`text-xs font-bold block ${isCurrentUser ? "text-emerald-950 font-black" : "text-gray-800"}`}>
                              {player.username} {isCurrentUser && <span className="font-black text-[9px] bg-emerald-100 text-emerald-800 px-1.5 rounded ml-1">Moi</span>}
                            </span>
                            <span className="text-[10px] text-gray-400 font-semibold">{player.predictionsCount} pronostic(s)</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          {challenge.matchId === 0 && (
                            <div className="flex gap-2 text-[9px] font-bold text-gray-400">
                              <span className="bg-emerald-50/30 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-100">{player.exactCount || 0} Exact</span>
                              <span className="bg-indigo-50/30 text-indigo-800 px-1.5 py-0.5 rounded border border-indigo-100">{player.winnerCount || 0} Winner</span>
                            </div>
                          )}
                          <div className="text-right">
                            <span className="block text-sm font-black text-slate-800">{player.points} pts</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {detailTab === "participants" && (
            <div className="space-y-4">
              <h3 className="font-bold text-gray-800 text-sm border-b border-gray-100 pb-3 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                Liste des Participants réels ({challengeBets.length})
              </h3>
              
              {loadingChallengeDetails ? (
                <div className="flex justify-center py-16">
                  <Clock className="w-8 h-8 text-emerald-500 animate-spin" />
                </div>
              ) : challengeBets.length === 0 ? (
                <p className="text-center py-12 text-gray-400 text-sm italic">Aucun participant n'a encore rejoint ce défi.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {challengeBets.map(bet => {
                    const profile = allProfiles.find(p => p.id === bet.user_id) || { username: "Joueur", first_name: "", last_name: "", points: 0, avatar_type: "emoji", avatar_value: "⚽" };
                    return (
                      <div key={bet.user_id} className="bg-gray-50/50 p-3 rounded-xl border border-gray-100 flex items-center gap-3">
                        <div className="w-9 h-9 flex items-center justify-center bg-white border border-gray-100 rounded-lg text-lg shrink-0">
                          {profile.avatar_type === "emoji" ? profile.avatar_value : "⚽"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="block font-bold text-xs text-gray-800 truncate">{profile.username}</span>
                          <span className="block text-[9px] text-gray-400 font-semibold truncate">Score Général: {profile.points || 0} pts</span>
                        </div>
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 font-extrabold px-2 py-0.5 rounded uppercase font-mono">Inscrit</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {detailTab === "results" && (
            <div className="space-y-4">
              <h3 className="font-bold text-gray-800 text-sm border-b border-gray-100 pb-3 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                Résultats réels en direct
              </h3>

              {loadingModalMatches ? (
                <div className="flex justify-center py-16">
                  <Clock className="w-8 h-8 text-emerald-500 animate-spin" />
                </div>
              ) : modalMatchesError ? (
                <p className="text-center py-12 text-sm text-red-500 italic bg-red-50 border border-red-100 rounded-2xl">{modalMatchesError}</p>
              ) : modalMatches.length === 0 ? (
                <p className="text-center py-12 text-gray-400 text-sm italic">Aucune information de match disponible.</p>
              ) : (
                <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
                  {modalMatches.map(m => {
                    const isFinished = m.status === "FINISHED";
                    const isLive = ["IN_PLAY", "LIVE", "PAUSED"].includes(m.status);
                    return (
                      <div key={m.id} className="bg-gray-50/50 border border-gray-100/70 p-4 rounded-2xl flex flex-col gap-2">
                        <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          <span>{new Date(m.utcDate).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                          <span className={`px-2 py-0.5 rounded-full font-extrabold ${isLive ? 'bg-rose-50 text-rose-600 border border-rose-100 animate-pulse' : isFinished ? 'bg-gray-100 text-gray-500' : 'bg-indigo-50 text-indigo-700'}`}>
                            {isLive ? "LIVE" : isFinished ? "TERMINÉ" : "PROGRAMMÉ"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between mt-1">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1 justify-end">
                            <span className="font-bold text-xs text-gray-800 truncate">{m.homeTeam.shortName || m.homeTeam.name}</span>
                            <div className="w-6 h-6 flex items-center justify-center bg-white border border-gray-200 rounded-full overflow-hidden shrink-0 shadow-xs p-0.5">
                              <img src={getFlagUrl(m.homeTeam.name, m.homeTeam.crest)} alt="" className="max-w-full max-h-full object-contain" onError={(e) => { e.currentTarget.src = "https://flagcdn.com/w80/un.png"; }} />
                            </div>
                          </div>

                          <div className="mx-4 flex items-center justify-center bg-slate-900 border border-slate-950 text-white font-extrabold rounded-lg px-3 py-1 shrink-0 text-sm font-mono tracking-tight self-center">
                            {isFinished || isLive ? `${m.score.fullTime.home} - ${m.score.fullTime.away}` : "vs"}
                          </div>

                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-6 h-6 flex items-center justify-center bg-white border border-gray-200 rounded-full overflow-hidden shrink-0 shadow-xs p-0.5">
                              <img src={getFlagUrl(m.awayTeam.name, m.awayTeam.crest)} alt="" className="max-w-full max-h-full object-contain" onError={(e) => { e.currentTarget.src = "https://flagcdn.com/w80/un.png"; }} />
                            </div>
                            <span className="font-bold text-xs text-gray-800 truncate">{m.awayTeam.shortName || m.awayTeam.name}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) return null;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300 pb-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">

          <div>
            {viewMode === "create" ? (
              <>
                <h2 className="text-xl font-bold text-gray-800">
                  Créer un Défi Match
                </h2>
                <p className="text-sm text-gray-500">Choisis une rencontre</p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-gray-800">
                  Défis & Pronos
                </h2>
                <p className="text-sm text-gray-500">
                  Misez sur les prochains matchs
                </p>
              </>
            )}
          </div>
        </div>

        {viewMode === "list" ? (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setIsSearchModalOpen(true);
                setSearchCodeInput("");
                setSearchResult(null);
                setSearchError(null);
              }}
              className="bg-slate-50 hover:bg-slate-100 text-slate-700 p-2 px-3 sm:px-4 rounded-xl transition shadow-xs flex items-center gap-1.5 sm:gap-2 font-bold text-xs sm:text-sm cursor-pointer border border-slate-200"
            >
              <Search className="w-3.5 h-3.5 text-slate-500" />
              Rechercher par code
            </button>
            <button
              onClick={handleCreateView}
              className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 px-3 sm:px-4 rounded-xl transition shadow-xs flex items-center gap-1.5 sm:gap-2 font-bold text-xs sm:text-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Créer
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setViewMode("list");
              if (onClearPreselectedMatch) onClearPreselectedMatch();
            }}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-full transition shadow-sm text-sm font-semibold cursor-pointer"
          >
            Retour
          </button>
        )}
      </div>

      {viewMode === "create" ? (
        renderCreateForm()
      ) : selectedChallenge ? (
        renderChallengeDetailView(selectedChallenge)
      ) : (
        <div className="space-y-6">
          {preselectedMatch && (
            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-sm font-semibold text-indigo-950 animate-fade-in shadow-xs">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-indigo-600 shrink-0" />
                <span>
                  Match ciblé : <strong className="text-indigo-950 font-bold">{preselectedMatch.match.homeTeam.shortName} vs {preselectedMatch.match.awayTeam.shortName}</strong>
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("create");
                    setSelectedCompId(preselectedMatch.competitionId);
                    setSelectedMatch(preselectedMatch.match);
                    setIsTournamentSelected(false);
                    setNewTitle(`Défi: ${preselectedMatch.match.homeTeam.shortName} vs ${preselectedMatch.match.awayTeam.shortName}`);
                    if (competitions.length === 0) loadCompetitions();
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-sm transition cursor-pointer select-none"
                >
                  Nouveau Défi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onClearPreselectedMatch) onClearPreselectedMatch();
                  }}
                  className="bg-white hover:bg-gray-100 text-indigo-600 text-xs font-bold py-1.5 px-3 rounded-lg border border-indigo-100 shadow-xs transition cursor-pointer select-none"
                >
                  Effacer
                </button>
              </div>
            </div>
          )}

          {apiError && (
            <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 text-sm font-semibold">
              {apiError}
            </div>
          )}
          {((preselectedMatch 
              ? challenges.filter(c => c.matchId === preselectedMatch.match.id) 
              : challenges
            ).length === 0) && !apiError && (
            <div className="text-center p-8 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col items-center">
              <Trophy className="w-12 h-12 text-gray-300 mb-3" />
              {preselectedMatch 
                ? "Aucun défi en cours pour ce match."
                : "Aucun défi en cours. Soit le premier à en créer un !"}
              <button
                onClick={() => {
                  if (preselectedMatch) {
                    setViewMode("create");
                    setSelectedCompId(preselectedMatch.competitionId);
                    setSelectedMatch(preselectedMatch.match);
                    setIsTournamentSelected(false);
                    setNewTitle(`Défi: ${preselectedMatch.match.homeTeam.shortName} vs ${preselectedMatch.match.awayTeam.shortName}`);
                    if (competitions.length === 0) loadCompetitions();
                  } else {
                    handleCreateView();
                  }
                }}
                className="mt-4 text-emerald-600 font-bold hover:underline cursor-pointer"
              >
                Créer un défi ici
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 gap-6 max-w-xl mx-auto w-full">
            {Array.isArray(challenges) && (preselectedMatch
              ? challenges.filter((c) => c.matchId === preselectedMatch.match.id)
              : challenges
            ).map((challenge) => {
              const isCreator = challenge.creatorId === userId;
              const upcomingMatch = upcomingMatchesByComp[challenge.competitionId];

              return (
                <div
                  id={`challenge-${challenge.id}`}
                  key={challenge.id}
                  className="bg-white border-2 border-emerald-100 rounded-3xl p-5 shadow-sm hover:shadow-emerald-100 transition-all duration-300 cursor-pointer relative overflow-hidden flex flex-col justify-between h-full"
                  onClick={() => setSelectedChallenge(challenge)}
                >
                <div className="flex justify-between items-start mb-1 pl-2">
                  <h3 className="font-black text-gray-950 text-xl tracking-tight flex-1 mr-2 capitalize">
                    {challenge.title}
                  </h3>
                  <button
                    onClick={(e) => { e.stopPropagation(); shareOnWhatsApp(challenge); }}
                    className="text-emerald-600 hover:bg-emerald-50 p-2 rounded-full transition cursor-pointer shrink-0"
                    title="Partager sur WhatsApp"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="text-xs text-gray-400 mb-2 font-semibold flex items-center justify-between gap-1.5 flex-wrap">
                  <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-bold">Créateur: {challenge.creatorUsername || "Inconnu"}</span>
                  {challenge.matchId !== 0 ? (
                    <span className="bg-indigo-50 border border-indigo-100/50 text-indigo-700 px-2.5 py-0.5 rounded-full font-bold text-[9px] uppercase tracking-wider">🎯 Match Unique</span>
                  ) : (
                    <span className="bg-emerald-50 border border-emerald-100/50 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold text-[9px] uppercase tracking-wider">🏆 Compétition</span>
                  )}
                </div>

                {/* Competition and Date Metadata (Single match or full competition) - Uniformed */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex flex-col gap-1.5">
                    {(() => {
                      const comp = competitions.find(c => String(c.id) === String(challenge.competitionId));
                      const isSingleMatch = challenge.matchId !== 0;
                      
                      return (
                        <>
                          <div className="flex items-center gap-2 text-xs font-bold text-gray-800">
                             <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                               {isSingleMatch ? "🎯 Match Unique" : "🏆 Compétition"}
                             </span>
                             <span className="truncate">{comp?.name || "Football"}</span>
                          </div>
                          
                          <div className="text-xs text-gray-500 font-semibold flex items-center gap-1.5 mt-0.5">
                            <Calendar className="w-3.5 h-3.5" />
                            {challenge.matchDate ? new Date(challenge.matchDate).toLocaleDateString("fr-FR", {
                                  weekday: "short",
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }) : "Date à venir"}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {challenge.locked && (
                  <div className="flex items-center gap-1 text-amber-600 text-xs font-bold uppercase tracking-wider mb-2 mt-2 border border-amber-200/50 bg-amber-50 rounded-lg p-2 w-max ml-2">
                    <Lock className="w-3 h-3" /> Paris verrouillés
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </div>
      )}
      {activeModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className={`bg-white rounded-3xl w-full p-6 shadow-2xl space-y-4 transition-all ${
            activeModal.type === "details" && activeModal.challenge.matchId === 0 ? "max-w-xl" : "max-w-sm"
          }`}>
            <h3 className="font-black text-xl text-gray-900 capitalize text-center">
              {activeModal.type === "rules" ? "Barème de Points" : activeModal.type}
            </h3>
            <div className="text-sm text-gray-600 bg-gray-50 p-4 rounded-xl border border-gray-100">
             {activeModal.type === "rules" ? (
                 activeModal.challenge.pointRules ? (
                   renderReadableRules(activeModal.challenge.pointRules)
                 ) : (
                   <p className="text-center italic py-4">Aucune règle définie</p>
                 )
               ) : activeModal.type === "details" ? (
                 <>
                   <div className="text-center border-b border-gray-100 pb-3 mb-3">
                      <h4 className="font-extrabold text-base text-indigo-900 uppercase tracking-tight">{activeModal.challenge.title}</h4>
                      <p className="text-[11px] text-gray-400 font-semibold mt-0.5">Créé par: {activeModal.challenge.creatorUsername || "Inconnu"}</p>
                    </div>
                   {activeModal.challenge.matchId === 0 ? (
                        // Competition Challenges Details View
                        <div className="space-y-4 pr-1 text-left max-h-[460px] overflow-y-auto">
                          {loadingModalMatches ? (
                            <div className="flex justify-center py-12">
                              <Clock className="animate-spin text-emerald-500 w-8 h-8" />
                            </div>
                          ) : modalMatches.length === 0 ? (
                            <p className="text-center text-gray-500 py-8 text-sm font-semibold">Aucun match programmé trouvé pour cette compétition.</p>
                          ) : (
                            modalMatches.slice(0, visibleMatchesCount).map((m) => {
                              const challengeId = activeModal.challenge.id;
                              const userPredMap = userPredictions[challengeId]?.matches || {};
                              const userPredMatch = userPredMap[m.id];
                              
                              const formMap = predictionForms[challengeId]?.matches || {};
                              const formMatch = formMap[m.id] || {};
                              
                              // Check if predictions are open (match hasn't started yet and challenge is not resolved/locked)
                              const matchTime = new Date(m.utcDate).getTime();
                              const timeLeft = matchTime - new Date().getTime();
                              const isOpen = timeLeft > 0 && !activeModal.challenge.locked && !activeModal.challenge.resolved;
                              
                              const scoreHome = userPredMatch?.homeScore !== undefined ? userPredMatch.homeScore : formMatch.homeScore;
                              const scoreAway = userPredMatch?.awayScore !== undefined ? userPredMatch.awayScore : formMatch.awayScore;
                              
                              const hasSubmitted = userPredMatch?.homeScore !== undefined && userPredMatch?.awayScore !== undefined;

                              return (
                                <div key={m.id} className="bg-white rounded-xl p-3.5 shadow-sm border border-gray-100 space-y-3">
                                  <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-50 pb-2">
                                    <span>
                                      {new Date(m.utcDate).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} • {new Date(m.utcDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <span className={isOpen ? "text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded animate-pulse" : "bg-gray-100 text-gray-500 px-2 py-0.5 rounded"}>
                                      {timeLeft < 0 ? "Expiré" : isOpen ? "Ouvert" : "À venir"}
                                    </span>
                                  </div>

                                  {/* API Phase and Stage Display */}
                                  {m.stage && (() => {
                                    const info = translateStage(m.stage, m.group, m.matchday);
                                    return (
                                      <div className="flex justify-between items-center text-[10px] font-semibold text-gray-500 bg-slate-50/60 p-1.5 rounded-lg border border-slate-100/40">
                                        <span className="truncate max-w-[70%] font-bold text-indigo-950">{info.name}</span>
                                        <span className={`px-1.5 py-0.5 rounded-md font-extrabold text-[8.5px] uppercase tracking-wider ${
                                          info.isKnockout 
                                            ? "bg-rose-50 text-rose-600 border border-rose-100/60" 
                                            : "bg-indigo-50 text-indigo-600 border border-indigo-100/60"
                                        }`}>
                                          {info.type}
                                        </span>
                                      </div>
                                    );
                                  })()}
                                  
                                  <div className="flex items-center justify-between">
                                    {/* Home Team */}
                                    <div className="flex flex-col items-center flex-1 min-w-0">
                                      <div className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-full overflow-hidden shrink-0 shadow-xs mb-1 p-1">
                                        <img 
                                          src={getFlagUrl(m.homeTeam.name, m.homeTeam.crest)} 
                                          alt="" 
                                          className="max-w-full max-h-full object-contain"
                                          onError={(e) => { e.currentTarget.src = "https://flagcdn.com/w80/un.png"; }}
                                        />
                                      </div>
                                      <span className="font-bold text-center text-[11px] text-gray-800 truncate w-full">{m.homeTeam.shortName || m.homeTeam.name}</span>
                                    </div>
                                    
                                    {/* VS Section */}
                                    <div className="relative flex px-1.5 justify-center items-center gap-1">
                                       <input 
                                         type="number"
                                         min="0"
                                         value={scoreHome ?? ""}
                                         onChange={(e) => updateCompetitionPredictionForm(challengeId, m.id, { homeScore: parseInt(e.target.value) })}
                                         disabled={!isOpen || hasSubmitted}
                                         className="w-9 h-9 text-center text-xs font-bold border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100 disabled:text-gray-400 select-none animate-fade-in"
                                       />
                                       <span className="font-black text-gray-300 text-[10px]">VS</span>
                                       <input 
                                         type="number"
                                         min="0"
                                         value={scoreAway ?? ""}
                                         onChange={(e) => updateCompetitionPredictionForm(challengeId, m.id, { awayScore: parseInt(e.target.value) })}
                                         disabled={!isOpen || hasSubmitted}
                                         className="w-9 h-9 text-center text-xs font-bold border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100 disabled:text-gray-400 select-none animate-fade-in"
                                       />
                                    </div>
                                    
                                    {/* Away Team */}
                                    <div className="flex flex-col items-center flex-1 min-w-0">
                                      <div className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-full overflow-hidden shrink-0 shadow-xs mb-1 p-1">
                                        <img 
                                          src={getFlagUrl(m.awayTeam.name, m.awayTeam.crest)} 
                                          alt="" 
                                          className="max-w-full max-h-full object-contain"
                                          onError={(e) => { e.currentTarget.src = "https://flagcdn.com/w80/un.png"; }}
                                        />
                                      </div>
                                      <span className="font-bold text-center text-[11px] text-gray-800 truncate w-full">{m.awayTeam.shortName || m.awayTeam.name}</span>
                                    </div>
                                  </div>

                                  {/* Messages/State */}
                                  <div className="pt-2 border-t border-gray-50 text-center">
                                    {hasSubmitted ? (
                                      <div className="text-[10px] font-bold text-emerald-700 bg-emerald-50 py-1 rounded-lg flex items-center justify-center gap-1 border border-emerald-100">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Pronostic validé ! ({userPredMatch?.homeScore} - {userPredMatch?.awayScore})
                                      </div>
                                    ) : isOpen ? (
                                      <button
                                        type="button"
                                        onClick={() => submitCompetitionPrediction(activeModal.challenge, m.id, scoreHome, scoreAway)}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 rounded-lg text-xs transition shadow-sm cursor-pointer"
                                      >
                                        Valider mon pronostic
                                      </button>
                                    ) : (
                                      <div className="text-[10px] text-gray-400 bg-gray-50 font-bold p-1 rounded">
                                        Pronostics fermés
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                          
                          {/* Voir plus ("See more") CTA */}
                          {!loadingModalMatches && modalMatches.length > visibleMatchesCount && (
                            <button
                              type="button"
                              onClick={() => setVisibleMatchesCount((prev) => prev + 5)}
                              className="w-full py-2.5 mt-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100/30 rounded-xl transition duration-200 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm select-none"
                            >
                              Voir plus ({modalMatches.length - visibleMatchesCount} restants)
                            </button>
                          )}
                        </div>
                      ) : (
                        renderPredictionForm(activeModal.challenge)
                      )}
                 </>
               ) : activeModal.type === "confirm-delete" ? (
                 <>
                   <p className="text-center font-semibold text-gray-800 mb-4">Êtes-vous sûr de vouloir supprimer ce défi ?</p>
                   <div className="flex gap-2">
                     <button onClick={() => setActiveModal(null)} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-bold cursor-pointer hover:bg-gray-300 transition-all">Annuler</button>
                     <button onClick={() => { performDelete(activeModal.challenge.id); setActiveModal(null); }} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold cursor-pointer hover:bg-red-700 transition-all">Supprimer</button>
                   </div>
                 </>
               ) : activeModal.type === "edit" ? (
                 <p className="text-center">Édition en cours d'implémentation</p>
               ) : (
                 "Participants bientôt disponibles"
               )}
            </div>
            <button
              onClick={() => setActiveModal(null)}
              className="w-full bg-emerald-600 text-white font-bold p-3 rounded-xl hover:bg-emerald-700 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Search by Code Modal */}
      {isSearchModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <h3 className="font-extrabold text-gray-800 text-lg flex items-center gap-2">
                <Search className="w-5 h-5 text-emerald-600" />
                Rechercher un Défi
              </h3>
              <button
                onClick={() => {
                  setIsSearchModalOpen(false);
                  setSearchCodeInput("");
                  setSearchResult(null);
                  setSearchError(null);
                }}
                className="text-gray-400 hover:text-gray-600 font-bold p-1 hover:bg-gray-100 rounded-full transition text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSearchByCode} className="space-y-3">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">
                Entrez le code du défi
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ex: DEF-A1B2C3"
                  value={searchCodeInput}
                  onChange={(e) => setSearchCodeInput(e.target.value)}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 font-mono font-bold text-gray-800 tracking-wider placeholder:font-sans placeholder:font-normal placeholder:tracking-normal focus:ring-2 focus:ring-emerald-500 text-sm focus:bg-white uppercase outline-none"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={searchingChallenge}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition shadow-sm flex items-center gap-2 cursor-pointer select-none shrink-0"
                >
                  {searchingChallenge ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    "Rechercher"
                  )}
                </button>
              </div>
            </form>

            {searchError && (
              <div className="bg-red-50 text-red-700 p-3.5 rounded-xl border border-red-200 text-xs font-bold animate-fade-in text-center">
                ⚠️ {searchError}
              </div>
            )}

            {searchResult && (
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 animate-in slide-in-from-bottom-2 duration-300">
                <h4 className="font-extrabold text-slate-800 text-base mb-1.5 capitalize">
                  {searchResult.title}
                </h4>
                
                <div className="space-y-2 text-xs font-semibold text-slate-600">
                  <div className="flex justify-between border-b border-slate-200/40 pb-1.5">
                    <span>Créateur:</span>
                    <span className="font-black text-slate-800">{searchResult.creatorUsername || "Inconnu"}</span>
                  </div>
                  
                  <div className="flex justify-between border-b border-slate-200/40 pb-1.5">
                    <span>Type:</span>
                    <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                      {searchResult.matchId !== 0 ? "🎯 Match Unique" : "🏆 Compétition"}
                    </span>
                  </div>

                  {searchResult.matchId !== 0 && (
                    <div className="flex justify-between pb-1 flex-wrap gap-1">
                      <span>Rencontre:</span>
                      <span className="text-right text-indigo-950 font-bold">
                        {searchResult.matchHomeTeam} vs {searchResult.matchAwayTeam}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-1">
                  {challenges.some((c) => c.id === searchResult.id) ? (
                    <div className="text-center font-bold text-xs text-emerald-700 bg-emerald-50 py-2.5 rounded-xl border border-emerald-100">
                      ✅ Vous participez déjà à ce défi !
                      <button
                        type="button"
                        onClick={() => {
                          setIsSearchModalOpen(false);
                          setSelectedChallenge(searchResult);
                        }}
                        className="mt-1.5 block mx-auto text-xs font-extrabold text-emerald-800 hover:underline cursor-pointer"
                      >
                        Voir les détails →
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleJoinChallenge(searchResult)}
                      disabled={joiningChallengeId === searchResult.id}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-black py-3 rounded-xl text-sm transition shadow-md flex items-center justify-center gap-2 cursor-pointer select-none"
                    >
                      {joiningChallengeId === searchResult.id ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          Rejoint en cours...
                        </>
                      ) : (
                        "Rejoindre le Défi"
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
