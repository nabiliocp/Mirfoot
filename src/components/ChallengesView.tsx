import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  Challenge,
  PointRules,
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
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";

const isTeamsNotDefinedYet = (homeTeam?: { name?: string; shortName?: string }, awayTeam?: { name?: string; shortName?: string }) => {
  if (!homeTeam || !awayTeam) return true;
  const homeName = homeTeam.name || homeTeam.shortName || "";
  const awayName = awayTeam.name || awayTeam.shortName || "";
  
  if (!homeName.trim() || !awayName.trim()) return true;

  const isMatchPlaceholder = (name: string) => {
    const n = name.toLowerCase().trim();
    if (
      n === "" || 
      n === "..." || 
      n === "tbd" || 
      n === "tbc" || 
      n === "à définir" || 
      n === "a definir" || 
      n === "non deﬁni" || 
      n === "non defini" || 
      n === "non défini" || 
      n === "qualifié" || 
      n === "qualifie" ||
      n === "aucun match" ||
      n === "programmé"
    ) return true;

    // Direct prefix checks
    if (
      n.startsWith("vainqueur") || 
      n.startsWith("winner") || 
      n.startsWith("perdant") || 
      n.startsWith("loser") || 
      n.startsWith("groupe") || 
      n.startsWith("group") ||
      n.startsWith("v. match") ||
      n.startsWith("p. match") ||
      n.startsWith("v. ") ||
      n.startsWith("p. ") ||
      n.startsWith("w. ") ||
      n.startsWith("l. ") ||
      n.startsWith("w_") ||
      n.startsWith("l_") ||
      n.startsWith("tbd") ||
      /^[wlp]\d+$/i.test(n) || // like w1, w12, l3, p5
      /^(winner\s|loser\s|vainqueur\s|perdant\s)/i.test(n)
    ) {
      return true;
    }

    // Checking broad keyword containment
    if (
      n.includes("vainqueur de") || 
      n.includes("winner of") || 
      n.includes("perdant de") || 
      n.includes("loser of") ||
      n.includes("tbd") ||
      n.includes("tbc") ||
      n.includes("à définir") ||
      n.includes("a definir")
    ) {
      return true;
    }

    return false;
  };

  return isMatchPlaceholder(homeName) || isMatchPlaceholder(awayName);
};

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
  const [joinedSuccessChallenge, setJoinedSuccessChallenge] = useState<Challenge | null>(null);
  const [customAlert, setCustomAlert] = useState<{ type: 'info' | 'error' | 'success'; title: string; message: string } | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string>("Moi");
  const [visibleMatchesCount, setVisibleMatchesCount] = useState<number>(4);
  const [activeTooltipId, setActiveTooltipId] = useState<number | null>(null);
  const [upcomingMatchesByComp, setUpcomingMatchesByComp] = useState<Record<string, Match>>({});

  // Challenge details page state
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [detailTab, setDetailTab] = useState<"matches" | "leaderboard" | "participants" | "results">("matches");
  const [challengeBets, setChallengeBets] = useState<any[]>([]);
  const [participants, setParticipants] = useState<string[]>([]);
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [loadingChallengeDetails, setLoadingChallengeDetails] = useState(false);

  // States for challenge editing
  const [editTitle, setEditTitle] = useState("");
  const [editCompId, setEditCompId] = useState<number | string>("");
  const [editPointRules, setEditPointRules] = useState<PointRules | null>(null);
  const [updatingChallenge, setUpdatingChallenge] = useState(false);
  const [deletingChallenge, setDeletingChallenge] = useState(false);

  const ruleLabels: Record<string, string> = {
    exact_score: "Score Exact",
    close_score: "Score Proche",
    correct_winner: "Bon Vainqueur",
    qualification: "Qualification (Tirs au but, etc)",
  };

  const renderReadableRules = (rules: PointRules) => {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-2 pl-4 border-l-2 border-emerald-100">
          <div className="flex justify-between text-xs items-center">
            <span className="text-gray-600 font-medium">Score Exact</span>
            <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">+{rules.exact_score ?? 0} pts</span>
          </div>
          <div className="flex justify-between text-xs items-center">
            <span className="text-gray-600 font-medium">Score Proche</span>
            <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">+{rules.close_score ?? 0} pts</span>
          </div>
          <div className="flex justify-between text-xs items-center">
            <span className="text-gray-600 font-medium">Bon Vainqueur</span>
            <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">+{rules.correct_winner ?? 0} pts</span>
          </div>
          <div className="flex justify-between text-xs items-center">
            <span className="text-gray-600 font-medium">Qualification</span>
            <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">+{rules.qualification || 0} pts</span>
          </div>
        </div>
        <p className="text-[10px] text-gray-500 italic mt-2 px-2 bg-gray-50 p-2 rounded">
          Score exact, Score proche et Bon vainqueur ne sont pas cumulables (seul le meilleur est retenu). La qualification est un bonus séparé.
        </p>

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
    close_score: { enabled: true, points: 3, label: "Score Proche" },
    correct_winner: { enabled: true, points: 2, label: "Bon Vainqueur" },
    qualification: { enabled: true, points: 2, label: "Qualification (Tirs au but, etc)" },
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

  const [confirmCancelBonus, setConfirmCancelBonus] = useState<{
    challengeId: string;
    matchId: number;
    isBonusActive: boolean;
    homeTeamName: string;
    awayTeamName: string;
    scoreHome?: number;
    scoreAway?: number;
    challenge: Challenge;
  } | null>(null);

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
  }, [selectedChallenge]);

  const loadChallengeData = async (challengeId: string) => {
    if (!supabase) return;
    setLoadingChallengeDetails(true);
    try {
        const [betsRes, invsRes] = await Promise.all([
          supabase.from("bets").select("*").eq("challenge_id", challengeId),
          supabase.from("challenge_invitations").select("user_id").eq("challenge_id", challengeId)
        ]);
        if (betsRes.data) setChallengeBets(betsRes.data);
        
        // Combine user IDs from bets and invitations to workaround RLS on invitations
        const participantIds = new Set<string>();
        if (betsRes.data) betsRes.data.forEach((b: any) => participantIds.add(b.user_id));
        if (invsRes.data) invsRes.data.forEach((i: any) => participantIds.add(i.user_id));
        
        if (userId) participantIds.add(userId);
        if (selectedChallenge && selectedChallenge.creatorId) participantIds.add(selectedChallenge.creatorId);
        
        setParticipants(Array.from(participantIds));
    } catch (err) {
        console.error("Error loading challenge data:", err);
    } finally {
        setLoadingChallengeDetails(false);
    }
  };

  useEffect(() => {
    if (!selectedChallenge) return;
    setDetailTab("matches");
    loadChallengeData(selectedChallenge.id);
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

    let challengesRes: any[] = [];
    try {
      const res = await fetch(`/api/challenges/user/${user.id}`);
      if (!res.ok) {
        throw new Error(`HTTP error: ${res.status}`);
      }
      const data = await res.json();
      challengesRes = data.challenges || [];
    } catch (err) {
      console.error("Error loading user challenges from backend:", err);
      // Fallback
      const { data: createdChallenges } = await supabase
        .from("challenges")
        .select("*")
        .eq("creator_id", user.id);
      challengesRes = createdChallenges || [];
    }

    const sortedChallenges = [...challengesRes].sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
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

    if (sortedChallenges) {
      const mapped = (Array.isArray(sortedChallenges) ? sortedChallenges : []).map((c: any) => ({
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
      }));
      setChallenges(mapped);

      // Removed automatic selection of challenged found from URL
      // If there are invited challenge IDs, fetch those challenges too
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
      setCustomAlert({
        type: "error",
        title: "Connexion requise",
        message: "Vous devez être connecté pour participer à un défi."
      });
      return;
    }

    setJoiningChallengeId(challengeToJoin.id);
    try {
      // Call the server API endpoint to safely insert/join the challenge
      const response = await fetch("/api/challenges/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          challengeId: challengeToJoin.id,
          userId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur lors de l'enregistrement");
      }

      const result = await response.json();
      if (result.wasAlreadyParticipant) {
        setCustomAlert({
          type: "info",
          title: "Déjà rejoint !",
          message: `Vous avez déjà rejoint le défi "${challengeToJoin.title}".`
        });
        return;
      }

      // Reload all challenges to fetch the newly joined challenge in local list, or append if missing
      await loadData();
      
      // Close the search modal
      setIsSearchModalOpen(false);
      setSearchCodeInput("");
      setSearchResult(null);
      
      // Select the joined challenge automatically to open its detailed predictions view!
      setSelectedChallenge(challengeToJoin);
      await loadChallengeData(challengeToJoin.id);
      
      // Open custom congratulations popup
      setJoinedSuccessChallenge(challengeToJoin);
    } catch (err: any) {
      console.error("Error joining challenge:", err);
      setCustomAlert({
        type: "error",
        title: "Impossible de rejoindre",
        message: "Impossible de rejoindre ce défi: " + (err.message || err)
      });
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
    const inviteUrl = `${appUrl}?invite=${challenge.code}`;
    
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
      exact_score: customRulesConfig.exact_score.enabled ? customRulesConfig.exact_score.points : 0,
      close_score: customRulesConfig.close_score.enabled ? customRulesConfig.close_score.points : 0,
      correct_winner: customRulesConfig.correct_winner.enabled ? customRulesConfig.correct_winner.points : 0,
      qualification: customRulesConfig.qualification.enabled ? customRulesConfig.qualification.points : 0,
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
    if (!supabase || !userId) return;
    
    setDeletingChallenge(true); // Need to add this state variable
    try {
      const response = await fetch(`/api/challenges/${challengeId}?userId=${userId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        await loadData(); // Reload data to sync with DB
        setActiveModal(null);
        setSelectedChallenge(null); // Return to list view
      } else {
        alert("Erreur: " + (data.error || "Impossible de supprimer le défi"));
      }
    } catch (err: any) {
      alert("Erreur réseau: " + err.message);
    } finally {
      setDeletingChallenge(false);
    }
  };

  useEffect(() => {
    if (activeModal && activeModal.type === "edit") {
      setEditTitle(activeModal.challenge.title || "");
      setEditCompId(activeModal.challenge.competitionId || "");
      setEditPointRules(activeModal.challenge.pointRules || null);
    }
  }, [activeModal]);

  const handleUpdateChallenge = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || !activeModal || activeModal.type !== "edit") return;

    setUpdatingChallenge(true);
    const challengeId = activeModal.challenge.id;

    try {
      const updates: any = {
        title: editTitle.trim(),
        point_rules: editPointRules,
      };

      // Only update competition if there are no other participants (double check)
      const otherBets = challengeBets ? challengeBets.filter(b => b.user_id !== activeModal.challenge.creatorId).length : 0;
      const otherInvites = participants ? participants.filter(id => id !== activeModal.challenge.creatorId).length : 0;
      const hasOtherUsers = otherBets > 0 || otherInvites > 0;

      if (!hasOtherUsers && activeModal.challenge.matchId === 0) {
        updates.competition_id = Number(editCompId);
      }

      const { data, error } = await supabase
        .from("challenges")
        .update(updates)
        .eq("id", challengeId)
        .select();

      if (error) {
        alert("Erreur lors de la mise à jour : " + error.message);
      } else if (data && data[0]) {
        // Update local state in challenges
        setChallenges((prev) =>
          prev.map((c) =>
            c.id === challengeId
              ? {
                  ...c,
                  title: data[0].title,
                  competitionId: data[0].competition_id,
                  pointRules: data[0].point_rules,
                }
              : c
          )
        );

        // Update selectedChallenge if it's currently opened
        if (selectedChallenge && selectedChallenge.id === challengeId) {
          const updatedChallenge = {
            ...selectedChallenge,
            title: data[0].title,
            competitionId: data[0].competition_id,
            pointRules: data[0].point_rules,
          };
          setSelectedChallenge(updatedChallenge);
        }

        setActiveModal(null);
      }
    } catch (err: any) {
      console.error(err);
      alert("Erreur : " + err.message);
    } finally {
      setUpdatingChallenge(false);
    }
  };

  const updatePredictionForm = (
    challengeId: string,
    updates: Partial<Prediction>,
  ) => {
    setPredictionForms((prev) => {
      const current = prev[challengeId] || {};
      const next = { ...current, ...updates };

      // Si le score change et n'est plus un match nul, on supprime la qualification
      if (
        updates.homeScore !== undefined || updates.awayScore !== undefined
      ) {
        if (next.homeScore !== next.awayScore) {
          next.qualifies = undefined;
        }
      }

      return {
        ...prev,
        [challengeId]: next,
      };
    });
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

  const toggleBonus = (
    challengeId: string,
    matchId: number,
    currentActive: boolean,
  ) => {
    setPredictionForms((prev) => {
      const currentChallengeForm = prev[challengeId] || {};
      const currentMatches = currentChallengeForm.matches || {};
      const currentMatchPred = currentMatches[matchId] || {};
      
      return {
        ...prev,
        [challengeId]: {
          ...currentChallengeForm,
          matches: {
            ...currentMatches,
            [matchId]: {
              ...currentMatchPred,
              bonus: !currentActive,
            },
          },
        },
      };
    });
  };

  const handleSaveBonusChange = async (
    challenge: Challenge,
    matchId: number,
    newStatus: boolean,
    hScore?: number,
    aScore?: number,
  ) => {
    // 1. Update form draft first
    setPredictionForms((prev) => {
      const currentChallengeForm = prev[challenge.id] || {};
      const currentMatches = currentChallengeForm.matches || {};
      const currentMatchPred = currentMatches[matchId] || {};
      return {
        ...prev,
        [challenge.id]: {
          ...currentChallengeForm,
          matches: {
            ...currentMatches,
            [matchId]: {
              ...currentMatchPred,
              bonus: newStatus,
            },
          },
        },
      };
    });

    // 2. Commit immediately to Supabase
    if (!supabase) { alert("Erreur de connexion"); return; }
    if (!userId) { alert("Vous devez être connecté"); return; }
    if (challenge.locked || challenge.resolved) { alert("Le défi est verrouillé ou terminé"); return; }

    const finalH = hScore !== undefined ? Number(hScore) : NaN;
    const finalA = aScore !== undefined ? Number(aScore) : NaN;

    if (isNaN(finalH) || isNaN(finalA)) {
      alert("Veuillez d'abord remplir vos scores de match !");
      return;
    }

    const currentPreds = userPredictions[challenge.id] || {};
    const matchesPreds = currentPreds.matches || {};

    const updatedMatches = {
      ...matchesPreds,
      [matchId]: {
        homeScore: finalH,
        awayScore: finalA,
        bonus: newStatus,
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
      console.error("Erreur d'enregistrement direct du bonus :", error);
      alert("Erreur lors de l'enregistrement de la modification du bonus: " + error.message);
    } else {
      setUserPredictions((prev) => ({
        ...prev,
        [challenge.id]: updatedChallengePreds,
      }));
    }
  };

  const submitPrediction = async (challenge: Challenge) => {
    if (!supabase) { alert("Erreur de connexion"); return; }
    if (!userId) { alert("Vous devez être connecté"); return; }
    if (challenge.locked || challenge.resolved) { alert("Le défi est verrouillé ou terminé"); return; }

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
        alert("Veuillez remplir les scores !");
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
      alert("Erreur lors de l'enregistrement : " + error.message);
    }
  };

  const submitCompetitionPrediction = async (
    challenge: Challenge,
    matchId: number,
    homeScore?: number,
    awayScore?: number,
  ) => {
    if (!supabase) { alert("Erreur de connexion"); return; }
    if (!userId) { alert("Vous devez être connecté"); return; }
    if (challenge.locked || challenge.resolved) { alert("Le défi est verrouillé ou terminé"); return; }

    const hScore = homeScore !== undefined ? Number(homeScore) : NaN;
    const aScore = awayScore !== undefined ? Number(awayScore) : NaN;

    if (isNaN(hScore) || isNaN(aScore)) {
      alert("Veuillez remplir les scores avant de valider !");
      return;
    }

    // Capture the current predictions map from state if it exists
    const currentPreds = userPredictions[challenge.id] || {};
    const matchesPreds = currentPreds.matches || {};
    
    // Get bonus from predictionForms
    const formMatch = predictionForms[challenge.id]?.matches?.[matchId] || {};

    const updatedMatches = {
      ...matchesPreds,
      [matchId]: {
        homeScore: hScore,
        awayScore: aScore,
        bonus: formMatch.bonus !== undefined ? formMatch.bonus : !!matchesPreds[matchId]?.bonus,
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
              <h3 className="font-bold text-sm text-emerald-800 mb-3 border-b border-gray-100 pb-2 uppercase tracking-wide">
                Règles Unifiées du Défi
              </h3>
              <div className="text-sm space-y-2">
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-gray-700">
                    <span>Score Exact</span>
                    <span className="text-emerald-600">+5 pts</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold text-gray-700">
                    <span>Score Proche</span>
                    <span className="text-emerald-600">+3 pts</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold text-gray-700">
                    <span>Bon Vainqueur</span>
                    <span className="text-emerald-600">+2 pts</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold text-gray-700">
                    <span>Qualification</span>
                    <span className="text-emerald-600">+2 pts</span>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 italic px-1">
                  Les règles sont identiques pour tous les matchs. 
                </p>
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
    const draftForm = predictionForms[challenge.id] || {};

    const activeForm = {
      homeScore: draftForm.homeScore !== undefined ? draftForm.homeScore : userPred?.homeScore,
      awayScore: draftForm.awayScore !== undefined ? draftForm.awayScore : userPred?.awayScore,
      qualifies: draftForm.qualifies !== undefined ? draftForm.qualifies : userPred?.qualifies,
      endStage: draftForm.endStage !== undefined ? draftForm.endStage : userPred?.endStage,
      prolongationHomeScore: draftForm.prolongationHomeScore !== undefined ? draftForm.prolongationHomeScore : userPred?.prolongationHomeScore,
      prolongationAwayScore: draftForm.prolongationAwayScore !== undefined ? draftForm.prolongationAwayScore : userPred?.prolongationAwayScore,
      winner: draftForm.winner !== undefined ? draftForm.winner : userPred?.winner,
      penaltiesHomeScore: draftForm.penaltiesHomeScore !== undefined ? draftForm.penaltiesHomeScore : userPred?.penaltiesHomeScore,
      penaltiesAwayScore: draftForm.penaltiesAwayScore !== undefined ? draftForm.penaltiesAwayScore : userPred?.penaltiesAwayScore,
    };

    const hasFormChange = 
      (draftForm.homeScore !== undefined && draftForm.homeScore !== userPred?.homeScore) ||
      (draftForm.awayScore !== undefined && draftForm.awayScore !== userPred?.awayScore) ||
      (draftForm.endStage !== undefined && draftForm.endStage !== userPred?.endStage) ||
      (draftForm.prolongationHomeScore !== undefined && draftForm.prolongationHomeScore !== userPred?.prolongationHomeScore) ||
      (draftForm.prolongationAwayScore !== undefined && draftForm.prolongationAwayScore !== userPred?.prolongationAwayScore) ||
      (draftForm.winner !== undefined && draftForm.winner !== userPred?.winner) ||
      (draftForm.penaltiesHomeScore !== undefined && draftForm.penaltiesHomeScore !== userPred?.penaltiesHomeScore) ||
      (draftForm.penaltiesAwayScore !== undefined && draftForm.penaltiesAwayScore !== userPred?.penaltiesAwayScore);

    const isNotDefinedYet = isTeamsNotDefinedYet({ name: challenge.matchHomeTeam }, { name: challenge.matchAwayTeam });
    const timeLeft = challenge.matchDate ? new Date(challenge.matchDate).getTime() - new Date().getTime() : Infinity;
    const isOpen = timeLeft > 0 && !isLocked && !isNotDefinedYet;

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
              disabled={!isOpen}
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
              disabled={!isOpen}
              className="w-16 h-12 text-center text-xl font-black rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 mx-auto block disabled:bg-gray-100 disabled:text-gray-500"
            />
          </div>
        </div>

        {/* Qualification / Elimination Match Prediction Field */}
        {(challenge.pointRules?.qualification! > 0) && 
         activeForm.homeScore !== undefined && 
         activeForm.awayScore !== undefined &&
         activeForm.homeScore === activeForm.awayScore && (
          <div className="mt-4 pt-4 border-t border-gray-200 animate-in fade-in duration-300">
            <label className="block text-xs font-bold text-gray-700 mb-2 text-center">
              Qui se qualifie ? (Obligatoire en cas de Nul)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`p-3 rounded-lg text-xs font-bold transition-all ${activeForm.qualifies === 'home' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                disabled={!isOpen}
                onClick={() => updatePredictionForm(challenge.id, {qualifies: 'home'})}
              >
                {challenge.matchHomeTeam}
              </button>
              <button
                type="button"
                className={`p-3 rounded-lg text-xs font-bold transition-all ${activeForm.qualifies === 'away' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                disabled={!isOpen}
                onClick={() => updatePredictionForm(challenge.id, {qualifies: 'away'})}
              >
                {challenge.matchAwayTeam}
              </button>
            </div>
          </div>
        )}

        {isNotDefinedYet ? (
          <div className="text-xs text-amber-850 bg-amber-50 border border-amber-200 text-center font-bold p-3.5 rounded-xl mt-4 flex flex-col items-center justify-center gap-1.5 shadow-xs">
            <Lock className="w-4 h-4 text-amber-600 animate-pulse" />
            <span>Pronostics indisponibles tant que les équipes qualifiées ne sont pas connues.</span>
          </div>
        ) : userPred ? (
          <div className="space-y-2 mt-4">
            <div className="flex items-center justify-center gap-2 text-indigo-700 font-bold bg-indigo-50 p-3 rounded-xl border border-indigo-100">
              <CheckCircle2 className="w-5 h-5 text-indigo-500" /> Ton prono est enregistré ! ({userPred.homeScore} - {userPred.awayScore})
            </div>
            {isOpen && hasFormChange && (
              <button
                type="button"
                onClick={() => submitPrediction(challenge)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-sm cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              >
                Modifier mon pronostic
              </button>
            )}
          </div>
        ) : isOpen ? (
          <button
            type="button"
            onClick={() => submitPrediction(challenge)}
            className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-all shadow-sm cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            Valider mon pronostic
          </button>
        ) : (
          <div className="text-xs text-secondary bg-gray-100 text-center font-bold p-3 rounded-xl mt-4">
            Pronostics fermés
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
          const rules = challenge.pointRules;
          
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
              // Note: client side "isWinner / close score" simulation won't account for minimum distance accurately
              const diff = Math.abs(pHome - rHome) + Math.abs(pAway - rAway);
              if (rules?.close_score && diff <= 2) { // rough simulation
                pts = rules.close_score;
              } else {
                pts = rules.correct_winner;
              }
              isWinner = true;
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
              const rules = challenge.pointRules;
              
              if (rHome !== null && rAway !== null) {
                const isExact = pMatch.homeScore === rHome && pMatch.awayScore === rAway;
                const actualWinner = rHome > rAway ? 'home' : rHome < rAway ? 'away' : 'draw';
                const predWinner = pMatch.homeScore > pMatch.awayScore ? 'home' : pMatch.homeScore < pMatch.awayScore ? 'away' : 'draw';
                
                if (isExact) {
                  pts += rules.exact_score;
                  exactCount++;
                } else if (actualWinner === predWinner) {
                  const diff = Math.abs(pMatch.homeScore - rHome) + Math.abs(pMatch.awayScore - rAway);
                  if (rules?.close_score && diff <= 2) {
                    pts += rules.close_score;
                  } else {
                    pts += rules.correct_winner;
                  }
                  winnerCount++;
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
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-black tracking-tight capitalize">{challenge.title}</h2>
                {challenge.creatorId === userId && (
                  <button
                    type="button"
                    onClick={() => setActiveModal({ type: 'edit', challenge })}
                    className="p-1.5 text-emerald-100 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer active:scale-90 flex items-center justify-center border border-white/5 shadow-sm"
                    title="Modifier mon défi"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </div>
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
                <h3 className="font-bold text-gray-800 text-sm">Veuillez entrer vos pronostics</h3>
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
                    const isNotDefinedYet = isTeamsNotDefinedYet(m.homeTeam, m.awayTeam);
                    const matchTime = new Date(m.utcDate).getTime();
                    const timeLeft = matchTime - new Date().getTime();
                    const isOpen = timeLeft > 0 && !challenge.locked && !challenge.resolved && !isNotDefinedYet;
                    
                    const scoreHome = formMatch?.homeScore !== undefined ? formMatch.homeScore : userPredMatch?.homeScore;
                    const scoreAway = formMatch?.awayScore !== undefined ? formMatch.awayScore : userPredMatch?.awayScore;
                    
                    const isBonusActive = formMatch?.bonus !== undefined ? formMatch.bonus : !!userPredMatch?.bonus;
                    const hasSubmitted = userPredMatch?.homeScore !== undefined && userPredMatch?.awayScore !== undefined;
                    const hasFormChange = 
                      (formMatch?.homeScore !== undefined && formMatch.homeScore !== userPredMatch?.homeScore) || 
                      (formMatch?.awayScore !== undefined && formMatch.awayScore !== userPredMatch?.awayScore) ||
                      (formMatch?.bonus !== undefined && formMatch.bonus !== !!userPredMatch?.bonus);

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
                              disabled={!isOpen}
                              className="w-10 h-10 text-center text-sm font-bold border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100 disabled:text-gray-400 select-none"
                            />
                            <span className="font-black text-gray-300 text-xs">VS</span>
                            <input 
                              type="number"
                              min="0"
                              value={scoreAway ?? ""}
                              onChange={(e) => updateCompetitionPredictionForm(challengeId, m.id, { awayScore: parseInt(e.target.value) })}
                              disabled={!isOpen}
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
                            {isBonusActive ? (
                              <div className="w-full text-xs font-black bg-amber-100/80 text-amber-800 py-2 px-3 rounded-lg flex items-center justify-between border border-amber-200 relative">
                                <div className="flex items-center gap-2 mx-auto justify-center">
                                  <Trophy className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
                                  Bonus X2 activé !
                                </div>
                                <button 
                                  type="button"
                                  className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-amber-200 hover:bg-amber-300 text-amber-800 flex items-center justify-center transition cursor-pointer font-bold shadow-xs border border-amber-300/40"
                                  onClick={() => setConfirmCancelBonus({ 
                                    challengeId, 
                                    matchId: m.id, 
                                    isBonusActive,
                                    homeTeamName: m.homeTeam.shortName || m.homeTeam.name,
                                    awayTeamName: m.awayTeam.shortName || m.awayTeam.name,
                                    scoreHome,
                                    scoreAway,
                                    challenge
                                  })}
                                  title="Désactiver le bonus"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button 
                                type="button"
                                className="w-full text-xs font-black bg-gradient-to-br from-amber-400 to-orange-500 text-white py-2 rounded-lg hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99]"
                                onClick={() => handleSaveBonusChange(challenge, m.id, !isBonusActive, scoreHome, scoreAway)}
                              >
                                 <Trophy className="w-3.5 h-3.5" />
                                 Jouer Bonus X2
                              </button>
                            )}
                            <p className="text-[9px] text-gray-400 mt-1">Si juste : Score x2 | Si faux : -4 pts</p>
                          </div>
                        )}

                        {/* Submit Button for Competition Match bet */}
                        <div className="mt-3">
                          {hasSubmitted ? (
                            <div className="space-y-2">
                              <div className="bg-indigo-50 border border-indigo-100/50 py-2 rounded-xl text-[11px] font-bold text-indigo-700 text-center flex items-center justify-center gap-1">
                                <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                                Pronostic enregistré ! ({userPredMatch.homeScore} - {userPredMatch.awayScore})
                              </div>
                              {isOpen && hasFormChange && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    submitCompetitionPrediction(challenge, m.id, scoreHome, scoreAway).then(() => {
                                      refreshChallengeBets();
                                    });
                                  }}
                                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-xs transition duration-200 active:scale-[0.98] cursor-pointer"
                                >
                                  Modifier mon pronostic
                                </button>
                              )}
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
                          ) : isNotDefinedYet ? (
                            <div className="text-[10px] text-amber-850 bg-amber-50 border border-amber-200 text-center font-bold p-3 rounded-xl flex items-center justify-center gap-1.5 shadow-xs">
                              <Lock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                              <span>Pronostic indisponible tant que les équipes qualifiées ne sont pas connues.</span>
                            </div>
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
              {console.log("Rendering participants tab. Participants state:", participants)}
              <h3 className="font-bold text-gray-800 text-sm border-b border-gray-100 pb-3 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                Liste des Participants ({participants.length})
              </h3>
              
              {loadingChallengeDetails ? (
                <div className="flex justify-center py-16">
                  <Clock className="w-8 h-8 text-emerald-500 animate-spin" />
                </div>
              ) : participants.length === 0 ? (
                <p className="text-center py-12 text-gray-400 text-sm italic">Aucun participant n'a encore rejoint ce défi.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {participants.map(userId => {
                    const profile = allProfiles.find(p => p.id === userId) || { username: "Joueur", first_name: "", last_name: "", points: 0, avatar_type: "emoji", avatar_value: "⚽" };
                    return (
                      <div key={userId} className="bg-gray-50/50 p-3 rounded-xl border border-gray-100 flex items-center gap-3">
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
              {activeModal.type === "rules" 
                ? "Barème de Points" 
                : activeModal.type === "edit" 
                ? "Modifier le Défi" 
                : activeModal.type === "confirm-delete" 
                ? "Supprimer le Défi" 
                : activeModal.type}
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
                              const isNotDefinedYet = isTeamsNotDefinedYet(m.homeTeam, m.awayTeam);
                              const matchTime = new Date(m.utcDate).getTime();
                              const timeLeft = matchTime - new Date().getTime();
                              const isOpen = timeLeft > 0 && !activeModal.challenge.locked && !activeModal.challenge.resolved && !isNotDefinedYet;
                              
                              const scoreHome = formMatch?.homeScore !== undefined ? formMatch.homeScore : userPredMatch?.homeScore;
                              const scoreAway = formMatch?.awayScore !== undefined ? formMatch.awayScore : userPredMatch?.awayScore;
                              
                              const isBonusActive = formMatch?.bonus !== undefined ? formMatch.bonus : !!userPredMatch?.bonus;
                              const hasSubmitted = userPredMatch?.homeScore !== undefined && userPredMatch?.awayScore !== undefined;
                              const hasFormChange = 
                                (formMatch?.homeScore !== undefined && formMatch.homeScore !== userPredMatch?.homeScore) || 
                                (formMatch?.awayScore !== undefined && formMatch.awayScore !== userPredMatch?.awayScore) ||
                                (formMatch?.bonus !== undefined && formMatch.bonus !== !!userPredMatch?.bonus);

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
                                         disabled={!isOpen}
                                         className="w-9 h-9 text-center text-xs font-bold border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100 disabled:text-gray-400 select-none animate-fade-in"
                                       />
                                       <span className="font-black text-gray-300 text-[10px]">VS</span>
                                       <input 
                                         type="number"
                                         min="0"
                                         value={scoreAway ?? ""}
                                         onChange={(e) => updateCompetitionPredictionForm(challengeId, m.id, { awayScore: parseInt(e.target.value) })}
                                         disabled={!isOpen}
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

                                  {hasSubmitted && isOpen && (
                                    <div className="text-center">
                                      {isBonusActive ? (
                                        <div className="w-full text-[10px] font-black bg-amber-100/80 text-amber-800 py-1.5 px-2.5 rounded-lg flex items-center justify-between border border-amber-200 relative">
                                          <div className="flex items-center gap-1 mx-auto justify-center">
                                            <Trophy className="w-3 h-3 text-amber-600 animate-bounce" />
                                            Bonus X2 activé !
                                          </div>
                                          <button
                                            type="button"
                                            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-amber-200 hover:bg-amber-300 text-amber-800 flex items-center justify-center transition cursor-pointer font-bold border border-amber-300/40"
                                            onClick={() => setConfirmCancelBonus({ 
                                              challengeId, 
                                              matchId: m.id, 
                                              isBonusActive,
                                              homeTeamName: m.homeTeam.shortName || m.homeTeam.name,
                                              awayTeamName: m.awayTeam.shortName || m.awayTeam.name,
                                              scoreHome,
                                              scoreAway,
                                              challenge: activeModal.challenge
                                            })}
                                            title="Désactiver le bonus"
                                          >
                                            <X className="w-2.5 h-2.5" />
                                          </button>
                                        </div>
                                      ) : (
                                        <button 
                                          type="button"
                                          className="w-full text-[10px] font-black bg-gradient-to-br from-amber-400 to-orange-500 text-white py-1.5 rounded-lg hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1 hover:scale-[1.01] active:scale-[0.99]"
                                          onClick={() => handleSaveBonusChange(activeModal.challenge, m.id, !isBonusActive, scoreHome, scoreAway)}
                                        >
                                           <Trophy className="w-3 h-3" />
                                           Jouer Bonus X2
                                        </button>
                                      )}
                                    </div>
                                  )}

                                  {/* Messages/State */}
                                  <div className="pt-2 border-t border-gray-50 text-center">
                                    {hasSubmitted ? (
                                      <div className="space-y-1.5">
                                        <div className="text-[10px] font-bold text-indigo-700 bg-indigo-50 py-1 rounded-lg flex items-center justify-center gap-1 border border-indigo-100">
                                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" /> Pronostic enregistré ! ({userPredMatch?.homeScore} - {userPredMatch?.awayScore})
                                        </div>
                                        {isOpen && hasFormChange && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              submitCompetitionPrediction(activeModal.challenge, m.id, scoreHome, scoreAway).then(() => {
                                                refreshChallengeBets();
                                              });
                                            }}
                                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 rounded-lg text-xs transition shadow-sm cursor-pointer"
                                          >
                                            Modifier mon pronostic
                                          </button>
                                        )}
                                      </div>
                                    ) : isOpen ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          submitCompetitionPrediction(activeModal.challenge, m.id, scoreHome, scoreAway).then(() => {
                                            refreshChallengeBets();
                                          });
                                        }}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 rounded-lg text-xs transition shadow-sm cursor-pointer"
                                      >
                                        Valider mon pronostic
                                      </button>
                                    ) : isNotDefinedYet ? (
                                      <div className="text-[10px] text-amber-850 bg-amber-50 border border-amber-200 text-center font-bold p-2.5 rounded-lg flex items-center justify-center gap-1 shadow-xs">
                                        <Lock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                                        <span>Pronostic indisponible tant que les équipes qualifiées ne sont pas connues.</span>
                                      </div>
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
                 <div className="flex flex-col items-center">
                   <div className="w-16 h-16 bg-red-50 border-2 border-red-100 rounded-full flex flex-col items-center justify-center mb-4 text-red-500 animate-pulse">
                     <X className="w-8 h-8" />
                   </div>
                   <p className="text-center font-extrabold text-gray-800 text-base mb-1">Êtes-vous sûr de vouloir supprimer ce défi ?</p>
                   <p className="text-center text-red-500 font-semibold text-xs px-4 mb-6">Tous les pronostics et invitations associés seront définitivement effacés. Cette action est irréversible.</p>
                   
                   <div className="flex gap-3 w-full">
                     <button 
                       onClick={() => setActiveModal(null)} 
                       disabled={deletingChallenge}
                       className="flex-1 bg-white border-2 border-gray-200 text-gray-700 py-3 rounded-xl font-bold cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-50"
                     >
                       Annuler
                     </button>
                     <button 
                       onClick={() => { performDelete(activeModal.challenge.id); }} 
                       disabled={deletingChallenge}
                       className="flex-1 bg-red-500 text-white py-3 rounded-xl font-bold cursor-pointer hover:bg-red-600 shadow-md shadow-red-200 hover:shadow-lg hover:shadow-red-300 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                     >
                       {deletingChallenge ? (
                         <>
                           <Clock className="w-4 h-4 animate-spin" /> Suppression...
                         </>
                       ) : (
                         "Oui, supprimer"
                       )}
                     </button>
                   </div>
                 </div>
               ) : activeModal.type === "edit" ? (
                 (() => {
                    const otherBets = challengeBets ? challengeBets.filter(b => b.user_id !== activeModal.challenge.creatorId).length : 0;
                    const otherInvites = participants ? participants.filter(id => id !== activeModal.challenge.creatorId).length : 0;
                    const hasOtherParticipants = otherBets > 0 || otherInvites > 0;

                    // For deletion and starting checks
                    const isMatchStarted = activeModal.challenge.matchDate ? new Date(activeModal.challenge.matchDate).getTime() <= Date.now() : false;
                    const isCompStarted = modalMatches && modalMatches.length > 0 && modalMatches.some((m: Match) => {
                      const matchTime = new Date(m.utcDate).getTime();
                      const isPast = matchTime <= Date.now();
                      const isLiveOrFinished = !["TIMED", "SCHEDULED"].includes(m.status);
                      return isPast || isLiveOrFinished;
                    });
                    const hasCompetitionStarted = activeModal.challenge.matchId !== 0 ? isMatchStarted : isCompStarted;
                    const canDelete = !hasCompetitionStarted;

                    return (
                      <form onSubmit={handleUpdateChallenge} className="space-y-4 text-left">
                        <div>
                          <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1.5">
                            Nom du défi
                          </label>
                          <input
                            type="text"
                            required
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 font-medium text-gray-900 bg-white"
                            placeholder="Nom du défi"
                          />
                        </div>

                        {activeModal.challenge.matchId === 0 && (
                          <div>
                            <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1.5">
                              Compétition
                            </label>
                            {hasOtherParticipants ? (
                              <div className="bg-amber-50 border border-amber-200/50 rounded-xl p-3 text-amber-800 text-xs font-medium space-y-1">
                                <p className="font-bold flex items-center gap-1">
                                  <span>🔒</span> Compétition verrouillée
                                </p>
                                <p className="text-amber-700">
                                  La compétition ne peut pas être modifiée car d'autres participants ont déjà intégré ce défi ou fait des pronostics.
                                </p>
                                <div className="mt-1 font-bold text-gray-800 bg-white/50 px-2 py-1 rounded w-max">
                                  🏆 {competitions.find(c => String(c.id) === String(activeModal.challenge.competitionId))?.name || "Compétition"}
                                </div>
                              </div>
                            ) : (
                              <select
                                value={editCompId}
                                onChange={(e) => setEditCompId(e.target.value)}
                                className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 font-medium text-gray-900 bg-white"
                              >
                                {competitions.map((comp) => (
                                  <option key={comp.id} value={comp.id}>
                                    {comp.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        )}

                        {editPointRules && (
                          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-2">
                              Règles Unifiées du Défi
                            </label>
                            <div className="space-y-1.5 pt-1">
                              <div className="flex justify-between text-[11px] font-semibold text-gray-700">
                                <span>Score Exact</span>
                                <span className="text-emerald-600">+{editPointRules.exact_score} pts</span>
                              </div>
                              <div className="flex justify-between text-[11px] font-semibold text-gray-700">
                                <span>Score Proche</span>
                                <span className="text-emerald-600">+{editPointRules.close_score} pts</span>
                              </div>
                              <div className="flex justify-between text-[11px] font-semibold text-gray-700">
                                <span>Bon Vainqueur</span>
                                <span className="text-emerald-600">+{editPointRules.correct_winner} pts</span>
                              </div>
                              <div className="flex justify-between text-[11px] font-semibold text-gray-700">
                                <span>Qualification</span>
                                <span className="text-emerald-600">+{editPointRules.qualification || 0} pts</span>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="pt-2 border-t border-gray-100 flex flex-col gap-2">
                          <button
                            type="submit"
                            disabled={updatingChallenge}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-all cursor-pointer shadow-sm select-none text-center"
                          >
                            {updatingChallenge ? "Enregistrement..." : "Enregistrer les modifications"}
                          </button>

                          {canDelete ? (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveModal({ type: 'confirm-delete', challenge: activeModal.challenge });
                              }}
                              className="w-full border-2 border-red-500 text-red-600 hover:bg-red-50 font-bold py-2.5 rounded-xl transition-all cursor-pointer text-center text-xs bg-transparent"
                            >
                              Supprimer le défi
                            </button>
                          ) : (
                            <div className="bg-red-50 border border-red-100 rounded-xl p-2.5 text-red-700 text-[11px] font-semibold text-center">
                              ⚠️ Ce défi ne peut plus être supprimé car la compétition ou le match a déjà commencé.
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => setActiveModal(null)}
                            className="w-full bg-gray-105 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl transition-all cursor-pointer text-center text-xs"
                          >
                            Annuler / Fermer
                          </button>
                        </div>
                      </form>
                    );
                  })()
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

      {/* Custom Congratulations Modal */}
      {joinedSuccessChallenge && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl border border-emerald-100 flex flex-col gap-5 animate-in zoom-in-95 duration-200 relative overflow-hidden">
            {/* Decorative top bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-500"></div>
            
            {/* Celebratory Icon */}
            <div className="mx-auto mt-2 w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 border border-emerald-100 shadow-inner relative animate-bounce">
              <Trophy className="w-8 h-8" />
              <span className="absolute -top-1 -right-1 text-xl">🎉</span>
              <span className="absolute -bottom-1 -left-1 text-xl">✨</span>
            </div>

            <div className="space-y-1.5">
              <h3 className="font-black text-xl text-emerald-800 tracking-tight">
                Félicitations !
              </h3>
              <p className="text-gray-600 font-semibold text-xs leading-relaxed px-1">
                Vous avez rejoint le défi avec succès. Placez vos pronostics maintenant pour rivaliser avec la communauté !
              </p>
            </div>

            {/* Small challenge card recap */}
            <div className="bg-emerald-50/60 border border-emerald-100/50 rounded-2xl p-3.5 text-left">
              <div className="text-[9px] uppercase font-black text-emerald-800 tracking-wider mb-1 bg-emerald-100/80 rounded-full w-max px-2 py-0.5">
                {joinedSuccessChallenge.matchId !== 0 ? "🎯 Match Unique" : "🏆 Compétition"}
              </div>
              <h4 className="font-black text-slate-800 text-sm leading-tight capitalize">
                {joinedSuccessChallenge.title}
              </h4>
              <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                Créé par : <span className="font-extrabold text-slate-700">{joinedSuccessChallenge.creatorUsername || "Inconnu"}</span>
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedChallenge(joinedSuccessChallenge);
                  setJoinedSuccessChallenge(null);
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-black py-3 rounded-xl text-xs transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                Accéder au défi & pronostiquer <ChevronRight className="w-4 h-4" />
              </button>
              
              <button
                type="button"
                onClick={() => setJoinedSuccessChallenge(null)}
                className="w-full bg-gray-105 hover:bg-gray-200 text-gray-700 font-extrabold py-2 rounded-xl text-xs transition cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Modal */}
      {customAlert && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl border border-gray-100 flex flex-col gap-5 animate-in zoom-in-95 duration-200 relative overflow-hidden">
            {/* Decorative top bar */}
            <div className={`absolute top-0 left-0 right-0 h-1.5 ${
              customAlert.type === 'error'
                ? 'bg-rose-500'
                : customAlert.type === 'success'
                ? 'bg-emerald-500'
                : 'bg-amber-500'
            }`}></div>
            
            {/* Icon */}
            <div className={`mx-auto mt-2 w-16 h-16 rounded-full flex items-center justify-center border shadow-inner relative ${
              customAlert.type === 'error'
                ? 'bg-rose-50 text-rose-500 border-rose-100'
                : customAlert.type === 'success'
                ? 'bg-emerald-50 text-emerald-500 border-emerald-100'
                : 'bg-amber-50 text-amber-500 border-amber-100'
            }`}>
              {customAlert.type === 'error' ? (
                <Lock className="w-8 h-8" />
              ) : customAlert.type === 'success' ? (
                <CheckCircle2 className="w-8 h-8" />
              ) : (
                <Info className="w-8 h-8" />
              )}
            </div>

            <div className="space-y-1.5">
              <h3 className={`font-black text-xl tracking-tight ${
                customAlert.type === 'error'
                  ? 'text-rose-800'
                  : customAlert.type === 'success'
                  ? 'text-emerald-800'
                  : 'text-amber-800'
              }`}>
                {customAlert.title}
              </h3>
              <p className="text-gray-600 font-semibold text-xs leading-relaxed px-1">
                {customAlert.message}
              </p>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => setCustomAlert(null)}
                className={`w-full text-white font-black py-3 rounded-xl text-xs transition-all shadow-md cursor-pointer hover:brightness-95 active:scale-[0.98] ${
                  customAlert.type === 'error'
                    ? 'bg-rose-600 shadow-rose-200 z-10'
                    : customAlert.type === 'success'
                    ? 'bg-emerald-600 shadow-emerald-200 z-10'
                    : 'bg-amber-600 shadow-amber-200 z-10'
                }`}
              >
                Compris !
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Bonus Confirmation Popup */}
      {confirmCancelBonus && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[60] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-5 relative border border-gray-100 overflow-hidden text-center">
            {/* Top decorative amber line */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500"></div>
            
            <div className="space-y-3.5">
              {/* Golden circular container with trophy icon */}
              <div className="mx-auto w-14 h-14 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500 shadow-inner relative animate-pulse">
                <Trophy className="w-7 h-7 text-amber-600" />
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center text-[9px] font-black border-2 border-white shadow-xs">
                  X2
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-extrabold text-lg text-indigo-950 tracking-tight">
                  Désactiver le Bonus X2 ?
                </h3>
                <div className="text-gray-600 text-xs font-semibold px-2 leading-relaxed space-y-2">
                  <p>
                    Es-tu sûr de vouloir retirer le Bonus X2 pour ton pronostic sur le match :
                  </p>
                  <div className="bg-indigo-50/50 rounded-xl p-2.5 font-bold text-indigo-900 border border-indigo-100/30 flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wide">
                    <span>{confirmCancelBonus.homeTeamName}</span>
                    <span className="text-gray-300 font-extrabold text-[9px]">VS</span>
                    <span>{confirmCancelBonus.awayTeamName}</span>
                    {confirmCancelBonus.scoreHome !== undefined && confirmCancelBonus.scoreAway !== undefined && (
                      <span className="text-amber-600 pl-1 font-black">
                        ({confirmCancelBonus.scoreHome} - {confirmCancelBonus.scoreAway})
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 font-medium pb-2 border-b border-gray-100/50">
                    Tu pourras à tout moment réactiver le Bonus X2 tant que le match n'a pas commencé.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  handleSaveBonusChange(
                    confirmCancelBonus.challenge,
                    confirmCancelBonus.matchId,
                    false,
                    confirmCancelBonus.scoreHome,
                    confirmCancelBonus.scoreAway
                  );
                  setConfirmCancelBonus(null);
                }}
                className="w-full bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white font-black py-3 rounded-xl text-xs transition-all shadow-md shadow-amber-200/50 cursor-pointer text-center"
              >
                Oui, désactiver le bonus
              </button>
              
              <button
                type="button"
                onClick={() => setConfirmCancelBonus(null)}
                className="w-full bg-gray-50 hover:bg-gray-100 active:scale-[0.98] text-gray-700 font-extrabold py-2.5 rounded-xl text-xs transition duration-200 border border-gray-200/80 cursor-pointer text-center"
              >
                Garder le bonus actif
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
