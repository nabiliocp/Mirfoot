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
} from "lucide-react";
import { supabase } from "../lib/supabase";

export default function ChallengesView() {
  const [activeModal, setActiveModal] = useState<{
    type: "rules" | "participants";
    challenge: Challenge;
  } | null>(null);

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [userPredictions, setUserPredictions] = useState<
    Record<string, Prediction>
  >({});
  const [userId, setUserId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "create">("list");

  // Create form state
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompId, setSelectedCompId] = useState<number | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [creating, setCreating] = useState(false);
  const [loadingComps, setLoadingComps] = useState(false);
  const [loadingMatches, setLoadingMatches] = useState(false);

  const [customRulesConfig, setCustomRulesConfig] = useState<{
    [key: string]: { enabled: boolean; points: number };
  }>({
    exact_score: { enabled: true, points: 5 },
    good_result: { enabled: true, points: 3 },
    close_score: { enabled: false, points: 1 },
    first_to_score: { enabled: false, points: 2 },
    extra_time: { enabled: false, points: 1 },
    penalties: { enabled: false, points: 1 },
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

  useEffect(() => {
    loadData();
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

  async function loadData() {
    if (!supabase) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    setUserId(user.id);

    const [challengesRes, betsRes] = await Promise.all([
      supabase
        .from("challenges")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("bets").select("*").eq("user_id", user.id),
    ]);

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
    try {
      const res = await fetch("/api/competitions");
      if (res.ok) {
        const data = await res.json();
        setCompetitions(Array.isArray(data.competitions) ? data.competitions : []);
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingComps(false);
  };

  const loadMatches = async (compId: number) => {
    setSelectedCompId(compId);
    setSelectedMatch(null);
    setLoadingMatches(true);
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
      }
    } catch (e) {
      console.error(e);
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
    const desc = `Rejoins mon défi sur Mirfoot : "${challenge.title}" pour le match ${challenge.matchHomeTeam} vs ${challenge.matchAwayTeam} !\n\nParticipe ici : ${inviteUrl}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(desc)}`;
    window.open(url, "_blank");
  };


  const handleCreateChallenge = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || !userId || !selectedMatch) {
      alert("Veuillez sélectionner un match d'abord.");
      return;
    }
    setCreating(true);

    const title = newTitle.trim()
      ? newTitle
      : `Défi: ${selectedMatch.homeTeam.shortName} vs ${selectedMatch.awayTeam.shortName}`;

    const savedRules: PointRules = {
      group_stage: {
        exact_score: customRulesConfig.exact_score.enabled ? customRulesConfig.exact_score.points : 0,
        good_result: customRulesConfig.good_result.enabled ? customRulesConfig.good_result.points : 0,
        close_score: customRulesConfig.close_score.enabled ? customRulesConfig.close_score.points : 0,
        first_to_score: customRulesConfig.first_to_score.enabled ? customRulesConfig.first_to_score.points : 0,
      },
      knockout_stage: {
        exact_score: customRulesConfig.exact_score.enabled ? customRulesConfig.exact_score.points : 0,
        good_result: customRulesConfig.good_result.enabled ? customRulesConfig.good_result.points : 0,
        close_score: customRulesConfig.close_score.enabled ? customRulesConfig.close_score.points : 0,
        first_to_score: customRulesConfig.first_to_score.enabled ? customRulesConfig.first_to_score.points : 0,
        extra_time: customRulesConfig.extra_time.enabled ? customRulesConfig.extra_time.points : 0,
        penalties: customRulesConfig.penalties.enabled ? customRulesConfig.penalties.points : 0,
      },
    };

    const { data, error } = await supabase
      .from("challenges")
      .insert({
        competition_id: selectedCompId,
        match_id: selectedMatch.id,
        match_home_team: selectedMatch.homeTeam.name,
        match_away_team: selectedMatch.awayTeam.name,
        match_date: selectedMatch.utcDate,
        creator_id: userId,
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

  const handleDelete = async (challengeId: string) => {
    if (!supabase) return;
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce défi ?")) return;

    const { error } = await supabase
      .from("challenges")
      .delete()
      .eq("id", challengeId);

    if (!error) {
      setChallenges((prev) => prev.filter((c) => String(c.id) !== String(challengeId)));
    } else {
      alert("Erreur lors de la suppression: " + error.message);
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
                  className="p-3 border-2 border-gray-100 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition text-sm font-semibold text-gray-700"
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
                  onClick={() => setSelectedMatch({ id: 0, homeTeam: { shortName: "Comp", name: "Comp", crest: "" }, awayTeam: { shortName: "Comp", name: "Comp", crest: "" }, utcDate: new Date().toISOString(), status: "SCHEDULED" } as any)}
                  className="w-full p-3 border-2 border-emerald-100 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition flex justify-between items-center text-sm font-semibold text-emerald-700 bg-emerald-50"
                >
                  <span>Toute la compétition</span>
                </button>
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
                {selectedMatch.homeTeam.crest && <img src={selectedMatch.homeTeam.crest} alt={selectedMatch.homeTeam.shortName} className="w-8 h-8 object-contain" />}
                <div>
                  <div className="text-xs text-emerald-600 font-bold mb-1 uppercase tracking-wider">
                    Match sélectionné
                  </div>
                  <div className="font-bold text-gray-800">
                    {selectedMatch.homeTeam.shortName} vs{" "}
                    {selectedMatch.awayTeam.shortName}
                  </div>
                </div>
                {selectedMatch.awayTeam.crest && <img src={selectedMatch.awayTeam.crest} alt={selectedMatch.awayTeam.shortName} className="w-8 h-8 object-contain" />}
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
                {Object.entries(customRulesConfig).map(([key, rule]) => (
                  <div key={key} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <label className="flex items-center gap-2 cursor-pointer font-semibold text-gray-700">
                      <input type="checkbox" checked={rule.enabled} onChange={() => toggleRule(key)} className="accent-emerald-600" />
                      <span className="capitalize text-xs">{key.replace('_', ' ')}</span>
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
          <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-sm font-semibold flex items-center gap-2 mb-2 border border-blue-100">
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
          <div className="text-center">
            <label className="block text-xs font-bold text-gray-700 mb-2 truncate">
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
          <div className="text-center">
            <label className="block text-xs font-bold text-gray-700 mb-2 truncate">
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
          {challenge.pointRules?.knockout_stage.first_to_score! > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                1er à marquer ({challenge.pointRules?.knockout_stage.first_to_score} pts)
              </label>
              <select
                value={activeForm.firstToScore || ""}
                onChange={(e) =>
                  updatePredictionForm(challenge.id, {
                    firstToScore: e.target.value,
                  })
                }
                disabled={!isOpen && !userPred}
                className="w-full p-2.5 rounded-lg border border-gray-300 text-sm disabled:bg-gray-100 disabled:text-gray-500"
              >
                <option value="">Sélectionner...</option>
                <option value="home">{challenge.matchHomeTeam}</option>
                <option value="away">{challenge.matchAwayTeam}</option>
                <option value="none">Aucun (0-0)</option>
              </select>
            </div>
          )}

          {challenge.pointRules?.knockout_stage.extra_time! > 0 && (
            <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
              <span className="text-xs font-semibold text-gray-700">
                Prolongations ? ({challenge.pointRules?.knockout_stage.extra_time} pts)
              </span>
              <div className="flex gap-2 text-sm">
                <button
                  type="button"
                  onClick={() =>
                    updatePredictionForm(challenge.id, { extraTime: true })
                  }
                  disabled={!isOpen && !userPred}
                  className={`px-4 py-1.5 rounded-md font-bold transition disabled:opacity-50 ${activeForm.extraTime === true ? "bg-indigo-100 text-indigo-700 border border-indigo-200" : "bg-gray-100 text-gray-600"}`}
                >
                  Oui
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updatePredictionForm(challenge.id, { extraTime: false })
                  }
                  disabled={!isOpen && !userPred}
                  className={`px-4 py-1.5 rounded-md font-bold transition disabled:opacity-50 ${activeForm.extraTime === false ? "bg-indigo-100 text-indigo-700 border border-indigo-200" : "bg-gray-100 text-gray-600"}`}
                >
                  Non
                </button>
              </div>
            </div>
          )}

          {challenge.pointRules?.knockout_stage.penalties! > 0 && (
            <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
              <span className="text-xs font-semibold text-gray-700">
                Tirs au but ? ({challenge.pointRules?.knockout_stage.penalties} pts)
              </span>
              <div className="flex gap-2 text-sm">
                <button
                  type="button"
                  onClick={() =>
                    updatePredictionForm(challenge.id, { penalties: true })
                  }
                  disabled={!isOpen && !userPred}
                  className={`px-4 py-1.5 rounded-md font-bold transition disabled:opacity-50 ${activeForm.penalties === true ? "bg-indigo-100 text-indigo-700 border border-indigo-200" : "bg-gray-100 text-gray-600"}`}
                >
                  Oui
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updatePredictionForm(challenge.id, { penalties: false })
                  }
                  disabled={!isOpen && !userPred}
                  className={`px-4 py-1.5 rounded-md font-bold transition disabled:opacity-50 ${activeForm.penalties === false ? "bg-indigo-100 text-indigo-700 border border-indigo-200" : "bg-gray-100 text-gray-600"}`}
                >
                  Non
                </button>
              </div>
            </div>
          )}
        </div>

        {!userPred && isOpen && (
          <button
            type="button"
            onClick={() => submitPrediction(challenge)}
            className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition shadow-sm"
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
          {challenges.length === 0 && (
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
                className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 transition-all duration-500"
              >
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-bold text-gray-800 text-lg flex-1 mr-2">
                    {challenge.title}
                  </h3>
                  <button
                    onClick={() => shareOnWhatsApp(challenge)}
                    className="text-emerald-600 hover:bg-emerald-50 p-2 rounded-full transition"
                    title="Partager sur WhatsApp"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="text-sm text-gray-500 mb-4 font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {challenge.matchDate
                    ? new Date(challenge.matchDate).toLocaleString("fr-FR", {
                        weekday: "long",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Date inconnue"}
                </div>

                {challenge.locked && (
                  <div className="flex items-center gap-1 text-amber-600 text-xs font-bold uppercase tracking-wider mb-3">
                    <Lock className="w-3 h-3" /> Paris verrouillés (Match en
                    cours)
                  </div>
                )}

                {challenge.matchId === 0 && (
                  <div className="flex gap-2 mb-4">
                    <button onClick={() => setActiveModal({ type: 'rules', challenge })} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition">Règles</button>
                    <button onClick={() => setActiveModal({ type: 'participants', challenge })} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition">Participants</button>
                  </div>
                )}
                {challenge.matchId !== 0 && renderPredictionForm(challenge)}

                {isCreator && !challenge.locked && !challenge.resolved && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => alert("Édition non implémentée")}
                      className="text-xs font-semibold text-gray-500 hover:text-gray-700 flex items-center gap-1 p-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Éditer
                    </button>
                    <button
                      onClick={() => handleDelete(challenge.id)}
                      className="text-xs font-semibold text-gray-400 hover:text-red-600 flex items-center gap-1 p-1"
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
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <h3 className="font-black text-xl text-gray-900 capitalize text-center">
              {activeModal.type}
            </h3>
            <div className="text-sm text-gray-600 bg-gray-50 p-4 rounded-xl border border-gray-100">
               {activeModal.type === "rules" ? (
                 <pre className="whitespace-pre-wrap">{JSON.stringify(activeModal.challenge.pointRules, null, 2)}</pre>
               ) : (
                 "Participants bientôt disponibles"
               )}
            </div>
            <button
              onClick={() => setActiveModal(null)}
              className="w-full bg-emerald-600 text-white font-bold p-3 rounded-xl hover:bg-emerald-700 transition"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
