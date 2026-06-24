import React, { useState, useEffect } from "react";
import { 
  BRACKET_TEAMS, 
  STARTING_R32_MATCHES, 
  computeBracketState, 
  isBracketMatchStarted,
  BracketPredictions,
  createEmptyBracketPredictions,
  BRACKET_MATCH_TIMES
} from "../bracketData";
import { supabase } from "../lib/supabase";
import { Check, Lock, Trophy, AlertTriangle, Sparkles, HelpCircle } from "lucide-react";

interface BracketChallengeProps {
  challenge: any;
  userId: string;
  mode: "prediction" | "results"; // prediction for users, results for creator resolution
  onSaveSuccess?: () => void;
}

export const BracketChallenge: React.FC<BracketChallengeProps> = ({
  challenge,
  userId,
  mode,
  onSaveSuccess
}) => {
  const [activeTab, setActiveTab] = useState<"r32" | "r16" | "r8" | "r4" | "r2">("r32");
  const [picks, setPicks] = useState<BracketPredictions>(createEmptyBracketPredictions());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load existing prediction (if in prediction mode) or actual results (if in results mode)
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        if (mode === "results") {
          // In results mode, load the actual results stored in point_rules.actualBracketPicks
          const pointRules = typeof challenge.pointRules === "string"
            ? JSON.parse(challenge.pointRules)
            : challenge.pointRules || {};

          if (pointRules.actualBracketPicks) {
            setPicks(pointRules.actualBracketPicks);
          } else {
            setPicks(createEmptyBracketPredictions());
          }
        } else {
          // In prediction mode, load the user's prediction from bets table
          const { data, error } = await supabase
            .from("bets")
            .select("predictions")
            .eq("challenge_id", challenge.id)
            .eq("user_id", userId)
            .maybeSingle();

          if (error) {
            console.error("Error loading user bracket predictions:", error);
          } else if (data && data.predictions) {
            const savedPicks = typeof data.predictions === "string"
              ? JSON.parse(data.predictions)
              : data.predictions;
            setPicks(savedPicks);
          } else {
            setPicks(createEmptyBracketPredictions());
          }
        }
      } catch (err) {
        console.error("Error initializing bracket picks:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [challenge.id, challenge.pointRules, userId, mode]);

  // Compute the current state of matches in later rounds based on current picks
  const bracketState = computeBracketState(picks);

  // Determine slot progression mapping
  // maps previous round winner to subsequent round position key
  const handleSelectWinner = (round: "r32" | "r16" | "r8" | "r4" | "r2", matchId: string, teamId: string) => {
    // Check lock conditions if in prediction mode
    if (mode === "prediction" && isBracketMatchStarted(matchId)) {
      setMessage({ type: "error", text: "Ce match a déjà commencé. Les pronostics sont clôturés." });
      return;
    }

    setMessage(null);
    const updatedPicks = { ...picks };

    if (round === "r32") {
      // Maps R32 to R16 slots
      const r32Mapping: Record<string, { roundKey: "r16"; slotKey: string }> = {
        R32_L1: { roundKey: "r16", slotKey: "R16_L1_H" },
        R32_L2: { roundKey: "r16", slotKey: "R16_L1_A" },
        R32_L3: { roundKey: "r16", slotKey: "R16_L2_H" },
        R32_L4: { roundKey: "r16", slotKey: "R16_L2_A" },
        R32_L5: { roundKey: "r16", slotKey: "R16_L3_H" },
        R32_L6: { roundKey: "r16", slotKey: "R16_L3_A" },
        R32_L7: { roundKey: "r16", slotKey: "R16_L4_H" },
        R32_L8: { roundKey: "r16", slotKey: "R16_L4_A" },
        R32_R1: { roundKey: "r16", slotKey: "R16_R1_H" },
        R32_R2: { roundKey: "r16", slotKey: "R16_R1_A" },
        R32_R3: { roundKey: "r16", slotKey: "R16_R2_H" },
        R32_R4: { roundKey: "r16", slotKey: "R16_R2_A" },
        R32_R5: { roundKey: "r16", slotKey: "R16_R3_H" },
        R32_R6: { roundKey: "r16", slotKey: "R16_R3_A" },
        R32_R7: { roundKey: "r16", slotKey: "R16_R4_H" },
        R32_R8: { roundKey: "r16", slotKey: "R16_R4_A" },
      };

      const map = r32Mapping[matchId];
      if (map) {
        const oldWinner = updatedPicks.r16[map.slotKey];
        updatedPicks.r16[map.slotKey] = teamId;
        
        // Bubble-down: If the old team was selected further up, clear those selections
        if (oldWinner && oldWinner !== teamId) {
          clearSubsequentPicks(updatedPicks, oldWinner);
        }
      }
    } else if (round === "r16") {
      // Maps R16 to R8 slots
      const r16Mapping: Record<string, { roundKey: "r8"; slotKey: string }> = {
        R16_L1: { roundKey: "r8", slotKey: "R8_L1_H" },
        R16_L2: { roundKey: "r8", slotKey: "R8_L1_A" },
        R16_L3: { roundKey: "r8", slotKey: "R8_L2_H" },
        R16_L4: { roundKey: "r8", slotKey: "R8_L2_A" },
        R16_R1: { roundKey: "r8", slotKey: "R8_R1_H" },
        R16_R2: { roundKey: "r8", slotKey: "R8_R1_A" },
        R16_R3: { roundKey: "r8", slotKey: "R8_R2_H" },
        R16_R4: { roundKey: "r8", slotKey: "R8_R2_A" },
      };

      const map = r16Mapping[matchId];
      if (map) {
        const oldWinner = updatedPicks.r8[map.slotKey];
        updatedPicks.r8[map.slotKey] = teamId;
        if (oldWinner && oldWinner !== teamId) {
          clearSubsequentPicks(updatedPicks, oldWinner);
        }
      }
    } else if (round === "r8") {
      // Maps R8 to R4 slots
      const r8Mapping: Record<string, { roundKey: "r4"; slotKey: string }> = {
        R8_L1: { roundKey: "r4", slotKey: "R4_L1_H" },
        R8_L2: { roundKey: "r4", slotKey: "R4_L1_A" },
        R8_R1: { roundKey: "r4", slotKey: "R4_R1_H" },
        R8_R2: { roundKey: "r4", slotKey: "R4_R1_A" },
      };

      const map = r8Mapping[matchId];
      if (map) {
        const oldWinner = updatedPicks.r4[map.slotKey];
        updatedPicks.r4[map.slotKey] = teamId;
        if (oldWinner && oldWinner !== teamId) {
          clearSubsequentPicks(updatedPicks, oldWinner);
        }
      }
    } else if (round === "r4") {
      // Maps R4 to Final slots
      const r4Mapping: Record<string, { roundKey: "r2"; slotKey: string }> = {
        R4_L1: { roundKey: "r2", slotKey: "R2_L1_H" },
        R4_R1: { roundKey: "r2", slotKey: "R2_L1_A" },
      };

      const map = r4Mapping[matchId];
      if (map) {
        const oldWinner = updatedPicks.r2[map.slotKey];
        updatedPicks.r2[map.slotKey] = teamId;
        if (oldWinner && oldWinner !== teamId) {
          clearSubsequentPicks(updatedPicks, oldWinner);
        }
      }
    } else if (round === "r2") {
      // Set the Champion
      updatedPicks.winner = teamId;
    }

    setPicks(updatedPicks);
  };

  // Helper to clear invalid subsequent selections of a team that lost in an earlier round
  const clearSubsequentPicks = (updatedPicks: BracketPredictions, teamId: string) => {
    // Clean r8
    Object.keys(updatedPicks.r8).forEach(k => {
      if (updatedPicks.r8[k] === teamId) updatedPicks.r8[k] = "";
    });
    // Clean r4
    Object.keys(updatedPicks.r4).forEach(k => {
      if (updatedPicks.r4[k] === teamId) updatedPicks.r4[k] = "";
    });
    // Clean r2
    Object.keys(updatedPicks.r2).forEach(k => {
      if (updatedPicks.r2[k] === teamId) updatedPicks.r2[k] = "";
    });
    // Clean winner
    if (updatedPicks.winner === teamId) updatedPicks.winner = "";
  };

  const handleSavePredictions = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const { error } = await supabase
        .from("bets")
        .upsert({
          user_id: userId,
          challenge_id: challenge.id,
          predictions: picks,
        }, { onConflict: "user_id,challenge_id" });

      if (error) throw error;

      setMessage({ type: "success", text: "Vos pronostics ont été enregistrés avec succès !" });
      if (onSaveSuccess) onSaveSuccess();
    } catch (err: any) {
      console.error(err);
      setMessage({ type: "error", text: "Erreur lors de la sauvegarde : " + err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleResolveChallenge = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/challenges/resolve-bracket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge.id,
          actualBracketPicks: picks,
          userId: userId,
        }),
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || "Une erreur est survenue.");
      }

      setMessage({ type: "success", text: "Défi résolu et classements mis à jour !" });
      if (onSaveSuccess) onSaveSuccess();
    } catch (err: any) {
      console.error(err);
      setMessage({ type: "error", text: "Erreur lors de la résolution : " + err.message });
    } finally {
      setSaving(false);
    }
  };

  // Render a single match box
  const renderMatchCard = (round: "r32" | "r16" | "r8" | "r4" | "r2", matchId: string, teamAId: string, teamBId: string) => {
    const teamA = BRACKET_TEAMS[teamAId];
    const teamB = BRACKET_TEAMS[teamBId];
    
    // Check which team is predicted/selected as winner in this match
    // To do this, check the next round's slot value or winner value
    let isSelectedA = false;
    let isSelectedB = false;

    if (round === "r32") {
      const slotMap: Record<string, string> = {
        R32_L1: "R16_L1_H", R32_L2: "R16_L1_A",
        R32_L3: "R16_L2_H", R32_L4: "R16_L2_A",
        R32_L5: "R16_L3_H", R32_L6: "R16_L3_A",
        R32_L7: "R16_L4_H", R32_L8: "R16_L4_A",
        R32_R1: "R16_R1_H", R32_R2: "R16_R1_A",
        R32_R3: "R16_R2_H", R32_R4: "R16_R2_A",
        R32_R5: "R16_R3_H", R32_R6: "R16_R3_A",
        R32_R7: "R16_R4_H", R32_R8: "R16_R4_A",
      };
      const slot = slotMap[matchId];
      if (picks.r16[slot]) {
        isSelectedA = picks.r16[slot] === teamAId;
        isSelectedB = picks.r16[slot] === teamBId;
      }
    } else if (round === "r16") {
      const slotMap: Record<string, string> = {
        R16_L1: "R8_L1_H", R16_L2: "R8_L1_A",
        R16_L3: "R8_L2_H", R16_L4: "R8_L2_A",
        R16_R1: "R8_R1_H", R16_R2: "R8_R1_A",
        R16_R3: "R8_R2_H", R16_R4: "R8_R2_A",
      };
      const slot = slotMap[matchId];
      if (picks.r8[slot]) {
        isSelectedA = picks.r8[slot] === teamAId;
        isSelectedB = picks.r8[slot] === teamBId;
      }
    } else if (round === "r8") {
      const slotMap: Record<string, string> = {
        R8_L1: "R4_L1_H", R8_L2: "R4_L1_A",
        R8_R1: "R4_R1_H", R8_R2: "R4_R1_A",
      };
      const slot = slotMap[matchId];
      if (picks.r4[slot]) {
        isSelectedA = picks.r4[slot] === teamAId;
        isSelectedB = picks.r4[slot] === teamBId;
      }
    } else if (round === "r4") {
      const slotMap: Record<string, string> = {
        R4_L1: "R2_L1_H", R4_R1: "R2_L1_A",
      };
      const slot = slotMap[matchId];
      if (picks.r2[slot]) {
        isSelectedA = picks.r2[slot] === teamAId;
        isSelectedB = picks.r2[slot] === teamBId;
      }
    } else if (round === "r2") {
      if (picks.winner) {
        isSelectedA = picks.winner === teamAId;
        isSelectedB = picks.winner === teamBId;
      }
    }

    const locked = mode === "prediction" && isBracketMatchStarted(matchId);

    return (
      <div className="bg-white border border-gray-150 rounded-2xl p-3 shadow-xs hover:shadow-md transition-all duration-300 relative overflow-hidden">
        {locked && (
          <div className="absolute top-1.5 right-2 flex items-center gap-1 text-[9px] bg-red-50 text-red-600 font-bold px-1.5 py-0.5 rounded-full border border-red-100">
            <Lock className="w-2.5 h-2.5" /> Clôturé
          </div>
        )}
        
        <div className="space-y-1.5 mt-1">
          {/* Team A */}
          <button
            type="button"
            disabled={locked || !teamA}
            onClick={() => teamA && handleSelectWinner(round, matchId, teamAId)}
            className={`w-full flex items-center justify-between p-2 rounded-xl border text-sm font-bold transition-all ${
              !teamA 
                ? "bg-gray-55 border-dashed border-gray-200 text-gray-400 cursor-not-allowed"
                : isSelectedA
                  ? "bg-emerald-50 border-emerald-500 text-emerald-950 shadow-sm"
                  : locked
                    ? "bg-gray-50 border-gray-100 text-gray-500 cursor-not-allowed"
                    : "bg-white border-gray-100 text-gray-800 hover:bg-gray-50 cursor-pointer"
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="text-lg">{teamA ? teamA.flag : "❓"}</span>
              <span className="truncate">{teamA ? teamA.name : "À déterminer"}</span>
            </span>
            {isSelectedA && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
          </button>

          {/* VS Divider */}
          <div className="flex items-center justify-center py-0.5">
            <span className="text-[10px] text-gray-400 font-black tracking-widest uppercase">vs</span>
          </div>

          {/* Team B */}
          <button
            type="button"
            disabled={locked || !teamB}
            onClick={() => teamB && handleSelectWinner(round, matchId, teamBId)}
            className={`w-full flex items-center justify-between p-2 rounded-xl border text-sm font-bold transition-all ${
              !teamB 
                ? "bg-gray-55 border-dashed border-gray-200 text-gray-400 cursor-not-allowed"
                : isSelectedB
                  ? "bg-emerald-50 border-emerald-500 text-emerald-950 shadow-sm"
                  : locked
                    ? "bg-gray-50 border-gray-100 text-gray-500 cursor-not-allowed"
                    : "bg-white border-gray-100 text-gray-800 hover:bg-gray-50 cursor-pointer"
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="text-lg">{teamB ? teamB.flag : "❓"}</span>
              <span className="truncate">{teamB ? teamB.name : "À déterminer"}</span>
            </span>
            {isSelectedB && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-gray-500 font-semibold mt-4">Chargement du tableau...</p>
      </div>
    );
  }

  // Count progress
  const r16Progress = Object.keys(picks.r16).filter(k => picks.r16[k]).length;
  const r8Progress = Object.keys(picks.r8).filter(k => picks.r8[k]).length;
  const r4Progress = Object.keys(picks.r4).filter(k => picks.r4[k]).length;
  const r2Progress = Object.keys(picks.r2).filter(k => picks.r2[k]).length;
  const isWinnerPicked = !!picks.winner;

  const totalCompletedPicks = r16Progress + r8Progress + r4Progress + r2Progress + (isWinnerPicked ? 1 : 0);
  const totalSlots = 16 + 8 + 4 + 2 + 1; // 31 total slots to fill
  const progressPercent = Math.round((totalCompletedPicks / totalSlots) * 100);

  return (
    <div className="space-y-6">
      {/* Dynamic Header */}
      <div className="bg-gradient-to-br from-emerald-950 to-emerald-850 text-white rounded-3xl p-5 shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 translate-x-4 -translate-y-4">
          <Trophy className="w-48 h-48 text-white" />
        </div>
        <div className="relative z-10 space-y-3">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-500 text-emerald-950 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              {mode === "results" ? "Administration" : "Pronostic Spécial"}
            </span>
            <span className="text-xs text-emerald-200 font-bold">🎯 Tableau Phase Éliminatoire</span>
          </div>
          
          <h2 className="text-2xl font-black tracking-tight">
            {mode === "results" ? "Saisie des Résultats Officiels" : "Remplir le Tableau de Championnat"}
          </h2>
          
          <p className="text-xs text-emerald-100 max-w-xl leading-relaxed">
            {mode === "results" 
              ? "Sélectionnez les pays qui se sont réellement qualifiés à chaque étape du tournoi. En validant, les scores de tous les participants seront recalculés immédiatement."
              : "Cliquez sur l'équipe de votre choix dans chaque match pour la qualifier au tour de suivant. Complétez tout le tableau pour tenter de décrocher le bonus maximal de points !"}
          </p>

          {/* Progress bar */}
          <div className="pt-2">
            <div className="flex justify-between items-center text-xs font-bold text-emerald-100 mb-1">
              <span>Progression du tableau</span>
              <span>{totalCompletedPicks} / {totalSlots} ({progressPercent}%)</span>
            </div>
            <div className="w-full bg-emerald-900/50 rounded-full h-2.5 overflow-hidden border border-emerald-800/30">
              <div 
                className="bg-emerald-400 h-full transition-all duration-500 ease-out rounded-full"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Point Barème Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 bg-gray-50 p-4 rounded-2xl border border-gray-150">
        <div className="text-center p-2">
          <div className="text-xs text-gray-500 font-bold">Phase de 32</div>
          <div className="text-base font-black text-emerald-800">+100 pts <span className="text-xs font-medium text-gray-400">/qualif</span></div>
        </div>
        <div className="text-center p-2 border-l border-gray-200">
          <div className="text-xs text-gray-500 font-bold">Huitièmes (16)</div>
          <div className="text-base font-black text-emerald-800">+200 pts <span className="text-xs font-medium text-gray-400">/qualif</span></div>
        </div>
        <div className="text-center p-2 border-l border-gray-200">
          <div className="text-xs text-gray-500 font-bold">Quarts (8)</div>
          <div className="text-base font-black text-emerald-800">+300 pts <span className="text-xs font-medium text-gray-400">/qualif</span></div>
        </div>
        <div className="text-center p-2 border-l border-gray-200">
          <div className="text-xs text-gray-500 font-bold">Demis (4)</div>
          <div className="text-base font-black text-emerald-800">+400 pts <span className="text-xs font-medium text-gray-400">/qualif</span></div>
        </div>
      </div>

      {/* Bonus Box */}
      <div className="bg-pink-50/50 border border-pink-100/70 rounded-2xl p-3 px-4 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-pink-600 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-extrabold text-pink-950">🏆 Méga Bonus Spéciaux :</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-pink-900 font-medium">
            <p>⭐ <strong>4 Demis Exacts:</strong> +1000 pts</p>
            <p>⭐ <strong>2 Finalistes Exacts:</strong> +2000 pts</p>
            <p>⭐ <strong>Vainqueur Exact:</strong> +2000 pts</p>
          </div>
        </div>
      </div>

      {/* Tab Selectors for Rounds */}
      <div className="flex bg-gray-100 p-1 rounded-2xl gap-1">
        {(["r32", "r16", "r8", "r4", "r2"] as const).map((round) => {
          const labels = {
            r32: "1/16 Finales",
            r16: "Huitièmes",
            r8: "Quarts",
            r4: "Demi-finales",
            r2: "Finale"
          };
          const counts = {
            r32: "16 Matchs",
            r16: `${r16Progress}/8 Qualifiés`,
            r8: `${r8Progress}/4 Qualifiés`,
            r4: `${r4Progress}/2 Qualifiés`,
            r2: `${r2Progress}/1 Champion`
          };

          return (
            <button
              key={round}
              type="button"
              onClick={() => setActiveTab(round)}
              className={`flex-1 py-3 px-2 rounded-xl text-center transition cursor-pointer ${
                activeTab === round 
                  ? "bg-white text-emerald-950 font-black shadow-sm" 
                  : "text-gray-500 hover:text-gray-800 font-bold"
              }`}
            >
              <div className="text-xs">{labels[round]}</div>
              <div className="text-[9px] text-gray-400 mt-0.5 font-semibold">{counts[round]}</div>
            </button>
          );
        })}
      </div>

      {/* Tab Content Matches */}
      <div className="py-2">
        {activeTab === "r32" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STARTING_R32_MATCHES.map((m) => (
              <div key={m.id} className="space-y-1">
                <div className="text-[10px] text-gray-400 font-bold flex justify-between px-1">
                  <span>Match {m.id.replace("R32_", "")}</span>
                  <span>{new Date(BRACKET_MATCH_TIMES[m.id]).toLocaleDateString("fr-FR", {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"})}</span>
                </div>
                {renderMatchCard("r32", m.id, m.homeId, m.awayId)}
              </div>
            ))}
          </div>
        )}

        {activeTab === "r16" && (
          <div className="space-y-4">
            {r16Progress < 16 && (
              <div className="bg-amber-50 border border-amber-100 text-amber-900 rounded-xl p-3 flex items-start gap-2.5 text-xs font-semibold">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <span>Veuillez d'abord qualifier les équipes dans l'onglet "1/16 Finales" pour remplir les huitièmes de finale. ({r16Progress}/16 équipes qualifiées)</span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {bracketState.r16Matches.map((m) => (
                <div key={m.id} className="space-y-1">
                  <div className="text-[10px] text-gray-400 font-bold px-1">Match {m.id.replace("R16_", "")}</div>
                  {renderMatchCard("r16", m.id, m.homeId, m.awayId)}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "r8" && (
          <div className="space-y-4">
            {r8Progress < 8 && (
              <div className="bg-amber-50 border border-amber-100 text-amber-900 rounded-xl p-3 flex items-start gap-2.5 text-xs font-semibold">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <span>Veuillez qualifier les équipes dans l'onglet "Huitièmes" pour remplir les quarts de finale. ({r8Progress}/8 équipes qualifiées)</span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {bracketState.r8Matches.map((m) => (
                <div key={m.id} className="space-y-1">
                  <div className="text-[10px] text-gray-400 font-bold px-1">Quart {m.id.replace("R8_", "")}</div>
                  {renderMatchCard("r8", m.id, m.homeId, m.awayId)}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "r4" && (
          <div className="space-y-4">
            {r4Progress < 4 && (
              <div className="bg-amber-50 border border-amber-100 text-amber-900 rounded-xl p-3 flex items-start gap-2.5 text-xs font-semibold">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <span>Veuillez qualifier les équipes dans l'onglet "Quarts" pour remplir les demi-finales. ({r4Progress}/4 équipes qualifiées)</span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {bracketState.r4Matches.map((m) => (
                <div key={m.id} className="space-y-1">
                  <div className="text-[10px] text-gray-400 font-bold px-1">Demi {m.id.replace("R4_", "")}</div>
                  {renderMatchCard("r4", m.id, m.homeId, m.awayId)}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "r2" && (
          <div className="space-y-6 max-w-md mx-auto">
            {r2Progress < 2 && (
              <div className="bg-amber-50 border border-amber-100 text-amber-900 rounded-xl p-3 flex items-start gap-2.5 text-xs font-semibold">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <span>Veuillez qualifier les équipes dans l'onglet "Demi-finales" pour remplir la Finale. ({r2Progress}/2 équipes qualifiées)</span>
              </div>
            )}
            
            <div className="space-y-1.5">
              <div className="text-[10px] text-gray-400 font-bold text-center">🏆 Grande Finale 🏆</div>
              {renderMatchCard("r2", "R2_F1", bracketState.finalMatch.homeId, bracketState.finalMatch.awayId)}
            </div>

            {isWinnerPicked && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 text-center space-y-3 shadow-xs">
                <div className="w-14 h-14 bg-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-md">
                  <Trophy className="w-7 h-7 text-white" />
                </div>
                <div>
                  <div className="text-xs text-emerald-800 font-extrabold uppercase tracking-widest">Votre Champion Prédit</div>
                  <div className="text-2xl font-black text-gray-900 flex items-center justify-center gap-2 mt-1">
                    <span>{BRACKET_TEAMS[picks.winner]?.flag}</span>
                    <span>{BRACKET_TEAMS[picks.winner]?.name}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      {message && (
        <div className={`p-4 rounded-2xl text-sm font-semibold border ${
          message.type === "success" 
            ? "bg-emerald-50 border-emerald-100 text-emerald-800" 
            : "bg-red-50 border-red-100 text-red-800"
        }`}>
          {message.text}
        </div>
      )}

      {/* Action Buttons */}
      <div className="pt-4 border-t border-gray-100 flex justify-end">
        {mode === "results" ? (
          <button
            type="button"
            disabled={saving || totalCompletedPicks < totalSlots}
            onClick={handleResolveChallenge}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-black px-6 py-3.5 rounded-2xl shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2 cursor-pointer"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Enregistrement en cours...
              </>
            ) : (
              <>
                🎯 Enregistrer les résultats officiels & Résoudre le défi
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            disabled={saving || totalCompletedPicks < totalSlots}
            onClick={handleSavePredictions}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-3.5 rounded-2xl shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2 cursor-pointer"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Enregistrement...
              </>
            ) : (
              <>
                💾 Enregistrer mes pronostics ({totalCompletedPicks}/{totalSlots})
              </>
            )}
          </button>
        )}
      </div>
      {totalCompletedPicks < totalSlots && (
        <p className="text-[11px] text-gray-400 font-bold text-right mt-1">
          * Vous devez pronostiquer l'intégralité du tableau pour pouvoir enregistrer.
        </p>
      )}
    </div>
  );
};
