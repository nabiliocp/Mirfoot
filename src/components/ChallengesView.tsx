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
  Swords,
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
} from "lucide-react";
import { supabase } from "../lib/supabase";

export default function ChallengesView() {
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
  const [loadingModalMatches, setLoadingModalMatches] = useState(false);
  const [currentUsername, setCurrentUsername] = useState<string>("Moi");
  const [visibleMatchesCount, setVisibleMatchesCount] = useState<number>(4);
  const [activeTooltipId, setActiveTooltipId] = useState<number | null>(null);

  const ruleLabels: Record<string, string> = {
    exact_score: "Score Exact",
    correct_winner: "Bon Vainqueur (1N2)",
    closest_guess: "Plus proche du score",
    exact_score_penalties: "Score Exact Tab (Knockout)",
    correct_winner_penalties: "Vainqueur Tab (Knockout)",
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

  useEffect(() => {
    setVisibleMatchesCount(4);
    setActiveTooltipId(null);
    if (activeModal && activeModal.type === "details" && activeModal.challenge.matchId === 0 && activeModal.challenge.competitionId) {
      setLoadingModalMatches(true);
      fetch(`/api/matches/${activeModal.challenge.competitionId}`)
        .then((res) => res.json())
        .then((data) => {
          setModalMatches(data.matches || []);
          setLoadingModalMatches(false);
        })
        .catch((err) => {
          console.error(err);
          setLoadingModalMatches(false);
        });
    } else {
      setModalMatches([]);
    }
  }, [activeModal]);

  async function loadData() {
    if (!supabase) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    setUserId(user.id);

    const [challengesRes, betsRes, profilesRes] = await Promise.all([
      supabase
        .from("challenges")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("bets").select("*").eq("user_id", user.id),
      supabase.from("profiles").select("id, username"),
    ]);

    const profileMap: Record<string, string> = {};
    if (profilesRes.data) {
      profilesRes.data.forEach((p: any) => {
        profileMap[p.id] = p.username;
        if (p.id === user.id) {
          setCurrentUsername(p.username);
        }
      });
    }

    if (challengesRes.data) {
      setChallenges(
        (Array.isArray(challengesRes.data) ? challengesRes.data : []).map((c: any) => ({
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
      const comp = competitions.find(c => c.id === challenge.competitionId);
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
        ? `Défi: ${competitions.find(c => c.id === selectedCompId)?.name || "Compétition"}`
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
      },
      match_metadata: {
        home_crest: selectedMatch.homeTeam?.crest || "",
        away_crest: selectedMatch.awayTeam?.crest || "",
      }
    };

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
                      ? competitions.find(c => c.id === selectedCompId)?.name || "Toute la compétition"
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
                  ? `Défi: ${competitions.find(c => c.id === selectedCompId)?.name || "Compétition"}`
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

    const isMatchWithin24h = challenge.matchDate
      ? new Date(challenge.matchDate).getTime() - new Date().getTime() <=
        24 * 60 * 60 * 1000
      : false;
    
    // Prediction is only open if it is within 24h before the match AND not in the past.
    // The user said: "ne peuvent donner pronostic que 24 avant".
    const isMatchInPast = challenge.matchDate 
      ? new Date(challenge.matchDate).getTime() < new Date().getTime()
      : false;
      
    // Wait, the user said "ne peuvent donner pronostic que 24 avant". 
    // This usually means predictions open at 24h before.
    // So the condition should be:
    // isOpen = (timeLeft <= 24 hours AND timeLeft > 0)
    const timeLeft = challenge.matchDate ? new Date(challenge.matchDate).getTime() - new Date().getTime() : Infinity;
    const isOpen = timeLeft <= 24 * 60 * 60 * 1000 && timeLeft > 0 && !isLocked;

    return (
      <div className="space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-100 mt-4">
        {!isLocked && (timeLeft > 24 * 60 * 60 * 1000) && !userPred && (
          <div className="bg-indigo-50 text-indigo-700 p-3 rounded-lg text-xs font-semibold flex items-center gap-2 mb-2 border border-indigo-100">
            <Clock className="w-4 h-4 shrink-0" />
            Les pronostics ouvrent 24h avant le match, soit le{" "}
            {new Date(
              new Date(challenge.matchDate!).getTime() - 24 * 60 * 60 * 1000,
            ).toLocaleString("fr-FR", {
              weekday: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            .
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="text-center flex flex-col items-center">
            <img 
              src={getFlagUrl(challenge.matchHomeTeam || "", (challenge.pointRules as any)?.match_metadata?.home_crest)} 
              alt="" 
              className="w-10 h-10 object-contain mb-1.5 rounded-sm shadow-sm"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
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
            <img 
              src={getFlagUrl(challenge.matchAwayTeam || "", (challenge.pointRules as any)?.match_metadata?.away_crest)} 
              alt="" 
              className="w-10 h-10 object-contain mb-1.5 rounded-sm shadow-sm"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
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

  if (loading) return null;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300 pb-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-3 rounded-full text-indigo-600">
            <Swords className="w-6 h-6" />
          </div>
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
              onClick={handleCreateView}
              className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 px-3 rounded-xl transition shadow-sm flex items-center gap-2 font-semibold text-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Créer
            </button>
          </div>
        ) : (
          <button
            onClick={() => setViewMode("list")}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-full transition shadow-sm text-sm font-semibold cursor-pointer"
          >
            Retour
          </button>
        )}
      </div>

      {viewMode === "create" ? (
        renderCreateForm()
      ) : (
        <div className="space-y-6">
          {apiError && (
            <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 text-sm font-semibold">
              {apiError}
            </div>
          )}
          {challenges.length === 0 && !apiError && (
            <div className="text-center p-8 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col items-center">
              <Trophy className="w-12 h-12 text-gray-300 mb-3" />
              Aucun défi en cours. Soit le premier à en créer un !
              <button
                onClick={handleCreateView}
                className="mt-4 text-emerald-600 font-bold hover:underline"
              >
                Créer un défi ici
              </button>
            </div>
          )}
          {Array.isArray(challenges) && challenges.map((challenge) => {
            const isCreator = challenge.creatorId === userId;

            return (
              <div
                id={`challenge-${challenge.id}`}
                key={challenge.id}
                className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 transition-all duration-500 cursor-pointer hover:shadow-md hover:border-gray-200"
                onClick={() => setActiveModal({ type: 'details', challenge })}
              >
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-bold text-gray-800 text-lg flex-1 mr-2 capitalize">
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
                </div>

                {/* Competition and Date Metadata (Single match or full competition) */}
                {challenge.matchId !== 0 ? (
                  (() => {
                    const comp = competitions.find(c => c.id === challenge.competitionId);
                    return (
                      <div className="text-xs text-indigo-700 bg-indigo-50/50 px-2.5 py-1.5 rounded-xl border border-indigo-100/40 font-bold mb-3 mt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <span className="truncate max-w-[190px] font-extrabold text-indigo-950 uppercase tracking-wide text-[10.5px]">🎮 Compétition: {comp?.name || "Match Unique"}</span>
                        {challenge.matchDate && (
                          <span className="text-indigo-600/85 font-bold flex items-center gap-1 shrink-0 text-[10.5px]">
                            <Clock className="w-3 h-3" />
                            {new Date(challenge.matchDate).toLocaleString("fr-FR", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  (() => {
                    const comp = competitions.find(c => c.id === challenge.competitionId);
                    const startDate = (comp as any)?.currentSeason?.startDate;
                    const endDate = (comp as any)?.currentSeason?.endDate;
                    const dateStr = startDate && endDate 
                      ? `Du ${new Date(startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })} au ${new Date(endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
                      : "Saison 2026";
                    return (
                      <div className="text-xs text-emerald-800 bg-emerald-50/50 px-2.5 py-1.5 rounded-xl border border-emerald-100/40 font-bold mb-3 mt-1 flex flex-col gap-0.5">
                        <span className="text-emerald-950 font-extrabold uppercase tracking-wide text-[10.5px]">🏆 Compétition: {comp?.name || "Ligue de Football"}</span>
                        <span className="text-emerald-700 font-bold flex items-center gap-1 text-[10.5px]">
                          <Calendar className="w-3 h-3" />
                          {dateStr}
                        </span>
                      </div>
                    );
                  })()
                )}

                {/* Flag display logic: Single Match VS Competition banners */}
                {challenge.matchId !== 0 ? (
                  <div className="flex items-center gap-3 my-3 bg-gray-50/60 p-3 rounded-xl border border-gray-100/60 max-w-sm">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
                      <span className="font-bold text-xs text-gray-700 truncate">{challenge.matchHomeTeam}</span>
                      <img 
                        src={getFlagUrl(challenge.matchHomeTeam || "", (challenge.pointRules as any)?.match_metadata?.home_crest)} 
                        alt="" 
                        className="w-6 h-6 object-contain rounded-sm shadow-sm"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    </div>
                    <span className="text-[10px] font-black text-gray-400 shrink-0">VS</span>
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <img 
                        src={getFlagUrl(challenge.matchAwayTeam || "", (challenge.pointRules as any)?.match_metadata?.away_crest)} 
                        alt="" 
                        className="w-6 h-6 object-contain rounded-sm shadow-sm"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                      <span className="font-bold text-xs text-gray-700 truncate">{challenge.matchAwayTeam}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 my-3 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/40 text-emerald-800 max-w-sm">
                    <Trophy className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Défi Compétition</div>
                      <div className="text-xs font-semibold text-gray-600">Comprend l'ensemble des matchs de la compétition</div>
                    </div>
                  </div>
                )}

                {challenge.locked && (
                  <div className="flex items-center gap-1 text-amber-600 text-xs font-bold uppercase tracking-wider mb-3">
                    <Lock className="w-3 h-3" /> Paris verrouillés (Match en cours)
                  </div>
                )}

                <div className="flex gap-2 mb-3">
                  <button onClick={(e) => { e.stopPropagation(); setActiveModal({ type: 'rules', challenge }); }} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-all cursor-pointer hover:scale-[1.02]">Règles</button>
                  <button onClick={(e) => { e.stopPropagation(); setActiveModal({ type: 'participants', challenge }); }} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-all cursor-pointer hover:scale-[1.02]">Participants</button>
                </div>
                
                {challenge.matchId !== 0 && renderPredictionForm(challenge)}

                {isCreator && !challenge.locked && !challenge.resolved && (
                  <div className="mt-3 flex gap-2 border-t border-gray-100 pt-2.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); setActiveModal({ type: 'edit', challenge }); }}
                      className="text-xs font-semibold text-gray-500 hover:text-gray-700 flex items-center gap-1 p-1 cursor-pointer transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Éditer
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setActiveModal({ type: 'confirm-delete', challenge }); }}
                      className="text-xs font-semibold text-gray-400 hover:text-red-600 flex items-center gap-1 p-1 cursor-pointer transition-colors animate-pulse"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Supprimer
                    </button>
                  </div>
                )}
              </div>
            );
          })}
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
                              
                              // Check if predictions are open (less than 24h away and match hasn't started yet)
                              const matchTime = new Date(m.utcDate).getTime();
                              const timeLeft = matchTime - new Date().getTime();
                              const isOpen = timeLeft <= 24 * 60 * 60 * 1000 && timeLeft > 0 && !activeModal.challenge.locked && !activeModal.challenge.resolved;
                              
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
                                      <img 
                                        src={getFlagUrl(m.homeTeam.name, m.homeTeam.crest)} 
                                        alt="" 
                                        className="w-10 h-10 object-contain mb-1 rounded-sm shadow-sm"
                                        onError={(e) => { e.currentTarget.src = "https://flagcdn.com/w80/un.png"; }}
                                      />
                                      <span className="font-bold text-center text-[11px] text-gray-800 truncate w-full">{m.homeTeam.shortName || m.homeTeam.name}</span>
                                    </div>
                                    
                                    {/* VS Section with custom tooltip trigger */}
                                    <div 
                                      className="relative flex px-1.5 justify-center items-center gap-1 group cursor-help"
                                      onMouseEnter={() => {
                                        if (timeLeft > 24 * 60 * 60 * 1000) {
                                          setActiveTooltipId(m.id);
                                        }
                                      }}
                                      onMouseLeave={() => {
                                        setActiveTooltipId(null);
                                      }}
                                      onClick={() => {
                                        if (timeLeft > 24 * 60 * 60 * 1000) {
                                          setActiveTooltipId(prev => prev === m.id ? null : m.id);
                                        }
                                      }}
                                    >
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

                                       {/* Interactive tooltip shown when cursor hovers/focuses the closed prediction inputs */}
                                       {timeLeft > 24 * 60 * 60 * 1000 && activeTooltipId === m.id && (
                                         <div className="absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-800 text-white text-[10px] font-bold py-1.5 px-3 rounded-lg shadow-xl z-50 pointer-events-none transition-all duration-150 whitespace-nowrap">
                                           Les pronostics ouvrent 24h avant le match
                                           <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                                         </div>
                                       )}
                                    </div>
                                    
                                    {/* Away Team */}
                                    <div className="flex flex-col items-center flex-1 min-w-0">
                                      <img 
                                        src={getFlagUrl(m.awayTeam.name, m.awayTeam.crest)} 
                                        alt="" 
                                        className="w-10 h-10 object-contain mb-1 rounded-sm shadow-sm"
                                        onError={(e) => { e.currentTarget.src = "https://flagcdn.com/w80/un.png"; }}
                                      />
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
                                    ) : timeLeft > 24 * 60 * 60 * 1000 ? (
                                      <div className="text-[10px] text-indigo-500 font-bold bg-indigo-50/30 py-1.5 rounded-lg border border-indigo-100/20">
                                        En attente (ouvre à H-24)
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
    </div>
  );
}
