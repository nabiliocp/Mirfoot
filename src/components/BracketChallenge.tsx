import React, { useState, useEffect, useRef } from "react";
import { 
  BRACKET_TEAMS, 
  STARTING_R32_MATCHES, 
  computeBracketState, 
  isBracketMatchStarted,
  BracketPredictions,
  createEmptyBracketPredictions,
  BRACKET_MATCH_TIMES,
  generateRandomBracketPicks
} from "../bracketData";
import { supabase } from "../lib/supabase";
import { Check, Lock, Trophy, AlertTriangle, Sparkles, HelpCircle } from "lucide-react";

interface BracketChallengeProps {
  challenge: any;
  userId: string;
  mode: "prediction" | "results"; // prediction for users, results for creator resolution
  onSaveSuccess?: () => void;
  onShowRules?: () => void;
}

export const BracketChallenge: React.FC<BracketChallengeProps> = ({
  challenge,
  userId,
  mode,
  onSaveSuccess,
  onShowRules
}) => {
  const [picks, setPicks] = useState<BracketPredictions>(createEmptyBracketPredictions());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Participant list and selected participant for viewing bracket
  const [participants, setParticipants] = useState<any[]>([]);
  const [selectedParticipant, setSelectedParticipant] = useState<any | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"myBracket" | "leaderboard">("myBracket");

  // Test mode options
  const [testMode, setTestMode] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [forceLockMatches, setForceLockMatches] = useState(false);

  // Phase timeline state
  const [currentPhase, setCurrentPhase] = useState<"r32" | "r16" | "r8" | "r4" | "r2" | "winner">("r32");

  // Drag-to-scroll implementation for full-size view on both desktop/laptop and mobile (kept to avoid removing refs)
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const isMatchLocked = (matchId: string): boolean => {
    if (forceLockMatches) return true;
    return isBracketMatchStarted(matchId);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return;
    const target = e.target as HTMLElement;
    // Don't drag if clicking interactive elements inside a team button
    if (target.closest("button") || target.closest("a") || target.closest("input")) {
      return;
    }
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5; // multiplier
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const loadParticipants = async () => {
    try {
      const res = await fetch(`/api/challenges/${challenge.id}/bets`);
      if (res.ok) {
        const data = await res.json();
        if (data.bets) {
          setParticipants(data.bets);
        }
      }
    } catch (err) {
      console.error("Error loading challenge participants:", err);
    }
  };

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
          // In prediction mode, load the user's prediction from our secure backend API proxy
          const res = await fetch(`/api/bets?userId=${userId}&challengeId=${challenge.id}`);
          if (res.ok) {
            const result = await res.json();
            if (result.data && result.data.predictions) {
              const savedPicks = typeof result.data.predictions === "string"
                ? JSON.parse(result.data.predictions)
                : result.data.predictions;
              setPicks(savedPicks);
            } else {
              setPicks(createEmptyBracketPredictions());
            }
          } else {
            setPicks(createEmptyBracketPredictions());
          }
        }
      } catch (err) {
        console.error("Error initializing bracket picks:", err);
      } finally {
        setLoading(false);
      }
      
      // Load participants without blocking the UI
      loadParticipants();
    };

    loadData();
  }, [challenge.id, challenge.pointRules, userId, mode]);

  // Compute the current state of matches in later rounds based on current picks
  const bracketState = computeBracketState(picks);

  // Determine slot progression mapping
  // maps previous round winner to subsequent round position key
  const handleSelectWinner = (round: "r32" | "r16" | "r8" | "r4" | "r2", matchId: string, teamId: string) => {
    // Check lock conditions if in prediction mode
    if (mode === "prediction" && isMatchLocked(matchId)) {
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
      const response = await fetch("/api/bets/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          challenge_id: challenge.id,
          predictions: picks,
        }),
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || "Une erreur est survenue lors de l'enregistrement.");
      }

      setMessage({ type: "success", text: "Vos pronostics ont été enregistrés avec succès !" });
      await loadParticipants();
      if (onSaveSuccess) onSaveSuccess();
    } catch (err: any) {
      console.error(err);
      setMessage({ type: "error", text: "Erreur lors de la sauvegarde : " + err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSeedMockParticipants = async () => {
    setSeeding(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/challenges/${challenge.id}/seed-mock-bets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 5 }),
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || "Erreur lors de la génération.");
      }

      setMessage({ type: "success", text: `Génération réussie : ${resData.count} participants fictifs ajoutés !` });
      await loadParticipants();
    } catch (err: any) {
      console.error(err);
      setMessage({ type: "error", text: "Erreur de génération : " + err.message });
    } finally {
      setSeeding(false);
    }
  };

  const handleFillRandomPicks = () => {
    try {
      const randomPicks = generateRandomBracketPicks();
      setPicks(randomPicks);
      setMessage({ type: "success", text: "Pronostics aléatoires générés dans le tableau ! N'oubliez pas d'enregistrer." });
    } catch (err: any) {
      console.error(err);
      setMessage({ type: "error", text: "Erreur lors de la génération : " + err.message });
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

    const locked = mode === "prediction" && isMatchLocked(matchId);

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

  const getSelectedWinnerForPredictions = (pPicks: BracketPredictions, mId: string): string => {
    if (!pPicks) return "";
    if (mId.startsWith("R32_")) {
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
      return pPicks.r16?.[slotMap[mId]] || "";
    } else if (mId.startsWith("R16_")) {
      const slotMap: Record<string, string> = {
        R16_L1: "R8_L1_H", R16_L2: "R8_L1_A",
        R16_L3: "R8_L2_H", R16_L4: "R8_L2_A",
        R16_R1: "R8_R1_H", R16_R2: "R8_R1_A",
        R16_R3: "R8_R2_H", R16_R4: "R8_R2_A",
      };
      return pPicks.r8?.[slotMap[mId]] || "";
    } else if (mId.startsWith("R8_")) {
      const slotMap: Record<string, string> = {
        R8_L1: "R4_L1_H", R8_L2: "R4_L1_A",
        R8_R1: "R4_R1_H", R8_R2: "R4_R1_A",
      };
      return pPicks.r4?.[slotMap[mId]] || "";
    } else if (mId.startsWith("R4_")) {
      const slotMap: Record<string, string> = {
        R4_L1: "R2_L1_H", R4_R1: "R2_L1_A",
      };
      return pPicks.r2?.[slotMap[mId]] || "";
    } else if (mId === "R2_F1") {
      return pPicks.winner || "";
    }
    return "";
  };

  const renderTreeMatchNode = (
    round: "r32" | "r16" | "r8" | "r4" | "r2",
    matchId: string,
    teamAId: string,
    teamBId: string,
    direction: "left" | "right" | "center"
  ) => {
    const isViewingOther = selectedParticipant !== null;
    const currentPicks = isViewingOther ? selectedParticipant.predictions : picks;

    const teamA = BRACKET_TEAMS[teamAId];
    const teamB = BRACKET_TEAMS[teamBId];

    const winnerId = getSelectedWinnerForPredictions(currentPicks, matchId);
    
    const isStarted = isMatchLocked(matchId);
    const locked = mode === "prediction" && (isStarted || isViewingOther);

    const isWinnerA = winnerId === teamAId && teamAId !== "";
    const isWinnerB = winnerId === teamBId && teamBId !== "";

    // Mask predictions for other players if match has NOT started yet
    const maskPrediction = isViewingOther && !isStarted;

    // Get match betting statistics from all participants
    const getMatchStats = (mId: string, tAId: string, tBId: string) => {
      let votesA = 0;
      let votesB = 0;
      
      participants.forEach(p => {
        const pPicks = p.predictions;
        if (!pPicks) return;
        
        const pWinner = getSelectedWinnerForPredictions(pPicks, mId);
        if (pWinner === tAId) votesA++;
        else if (pWinner === tBId) votesB++;
      });
      
      const total = votesA + votesB;
      if (total === 0) return null;
      
      const percentA = Math.round((votesA / total) * 100);
      const percentB = Math.round((votesB / total) * 100);
      return { votesA, votesB, percentA, percentB };
    };

    const stats = isStarted ? getMatchStats(matchId, teamAId, teamBId) : null;

    return (
      <div className="relative w-full max-w-[200px] mx-auto bg-white border border-gray-200 rounded-2xl p-2.5 shadow-sm hover:shadow-md hover:border-slate-350 transition duration-300">
        {isStarted && (
          <div className="absolute -top-1.5 -right-1 flex items-center bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full border border-red-400 gap-0.5 shadow-xs">
            <Lock className="w-2.5 h-2.5" />
            <span>CLÔTURÉ</span>
          </div>
        )}

        <div className="text-[9px] text-gray-400 font-bold mb-1 px-1 flex justify-between">
          <span>{matchId.replace("R32_", "").replace("R16_", "").replace("R8_", "").replace("R4_", "")}</span>
          {BRACKET_MATCH_TIMES[matchId] && round === "r32" && (
            <span className="text-[8px] text-gray-400">
              {new Date(BRACKET_MATCH_TIMES[matchId]).toLocaleDateString("fr-FR", {day: "numeric", month: "short"})}
            </span>
          )}
        </div>

        <div className="space-y-1">
          <button
            type="button"
            disabled={locked || !teamA}
            onClick={() => teamA && handleSelectWinner(round, matchId, teamAId)}
            className={`w-full flex items-center justify-between p-1.5 rounded-lg text-xs font-bold transition-all ${
              !teamA
                ? "bg-gray-50 border border-dashed border-gray-200 text-gray-400 cursor-not-allowed"
                : isWinnerA
                  ? "bg-emerald-50 border border-emerald-500 text-emerald-950 font-black shadow-xs"
                  : "bg-white border border-gray-200 text-gray-750 hover:bg-gray-50 hover:border-gray-300 cursor-pointer"
            }`}
          >
            <span className="flex items-center gap-1.5 truncate">
              {maskPrediction ? (
                <>
                  <span className="text-xs shrink-0">🔒</span>
                  <span className="text-gray-400 italic">Masqué</span>
                </>
              ) : (
                <>
                  <span className="text-sm shrink-0">{teamA ? teamA.flag : "❓"}</span>
                  <span className="truncate">{teamA ? teamA.name : "À déterminer"}</span>
                </>
              )}
            </span>
            {isWinnerA && !maskPrediction && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
          </button>

          <button
            type="button"
            disabled={locked || !teamB}
            onClick={() => teamB && handleSelectWinner(round, matchId, teamBId)}
            className={`w-full flex items-center justify-between p-1.5 rounded-lg text-xs font-bold transition-all ${
              !teamB
                ? "bg-gray-55 border border-dashed border-gray-200 text-gray-400 cursor-not-allowed"
                : isWinnerB
                  ? "bg-emerald-50 border border-emerald-500 text-emerald-950 font-black shadow-xs"
                  : "bg-white border border-gray-200 text-gray-750 hover:bg-gray-50 hover:border-gray-300 cursor-pointer"
            }`}
          >
            <span className="flex items-center gap-1.5 truncate">
              {maskPrediction ? (
                <>
                  <span className="text-xs shrink-0">🔒</span>
                  <span className="text-gray-400 italic">Masqué</span>
                </>
              ) : (
                <>
                  <span className="text-sm shrink-0">{teamB ? teamB.flag : "❓"}</span>
                  <span className="truncate">{teamB ? teamB.name : "À déterminer"}</span>
                </>
              )}
            </span>
            {isWinnerB && !maskPrediction && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
          </button>
        </div>

        {stats && (
          <div className="mt-1.5 pt-1.5 border-t border-gray-100 flex flex-col gap-0.5">
            <div className="flex justify-between text-[7.5px] font-bold text-gray-400">
              <span>{stats.percentA}% {teamA?.flag}</span>
              <span>{stats.percentB}% {teamB?.flag}</span>
            </div>
            <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden flex">
              <div className="bg-emerald-500 h-full" style={{ width: `${stats.percentA}%` }}></div>
              <div className="bg-blue-400 h-full" style={{ width: `${stats.percentB}%` }}></div>
            </div>
          </div>
        )}

        {direction === "left" && (
          <div className={`absolute right-[-16px] top-1/2 -translate-y-1/2 w-4 h-[2px] transition ${
            winnerId ? "bg-emerald-500 shadow-sm" : "bg-gray-200"
          }`}></div>
        )}
        {direction === "right" && (
          <div className={`absolute left-[-16px] top-1/2 -translate-y-1/2 w-4 h-[2px] transition ${
            winnerId ? "bg-emerald-500 shadow-sm" : "bg-gray-200"
          }`}></div>
        )}
      </div>
    );
  };

  const renderBracketTree = () => {
    const r32Left = STARTING_R32_MATCHES.filter(m => m.id.includes("_L"));
    const r32Right = STARTING_R32_MATCHES.filter(m => m.id.includes("_R"));

    const r16Left = bracketState.r16Matches.filter(m => m.id.includes("_L"));
    const r16Right = bracketState.r16Matches.filter(m => m.id.includes("_R"));

    const r8Left = bracketState.r8Matches.filter(m => m.id.includes("_L"));
    const r8Right = bracketState.r8Matches.filter(m => m.id.includes("_R"));

    const r4Left = bracketState.r4Matches.filter(m => m.id.includes("_L"));
    const r4Right = bracketState.r4Matches.filter(m => m.id.includes("_R"));

    return (
      <div className="space-y-4">
        {/* Phase navigation timeline */}
        <div className="flex bg-gray-100 rounded-xl p-1 overflow-x-auto scrollbar-none snap-x border border-gray-200 shadow-inner">
          <button onClick={() => setCurrentPhase("r32")} className={`snap-center flex-1 min-w-[70px] py-2 px-2 rounded-lg text-[10px] font-black transition ${currentPhase === "r32" ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"}`}>1/16</button>
          <button onClick={() => setCurrentPhase("r16")} className={`snap-center flex-1 min-w-[70px] py-2 px-2 rounded-lg text-[10px] font-black transition ${currentPhase === "r16" ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"}`}>1/8</button>
          <button onClick={() => setCurrentPhase("r8")} className={`snap-center flex-1 min-w-[70px] py-2 px-2 rounded-lg text-[10px] font-black transition ${currentPhase === "r8" ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"}`}>Quarts</button>
          <button onClick={() => setCurrentPhase("r4")} className={`snap-center flex-1 min-w-[70px] py-2 px-2 rounded-lg text-[10px] font-black transition ${currentPhase === "r4" ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"}`}>Demies</button>
          <button onClick={() => setCurrentPhase("r2")} className={`snap-center flex-1 min-w-[70px] py-2 px-2 rounded-lg text-[10px] font-black transition ${currentPhase === "r2" ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"}`}>Finale</button>
          <button onClick={() => setCurrentPhase("winner")} className={`snap-center flex-1 min-w-[70px] py-2 px-2 rounded-lg text-[10px] font-black transition ${currentPhase === "winner" ? "bg-emerald-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"}`}>Champion</button>
        </div>

        {/* Phase content */}
        <div className="relative overflow-hidden min-h-[400px]">
          
          <div className="relative z-10 flex flex-row gap-2 md:gap-12 justify-center">
            
            {currentPhase === "r32" && (
              <>
                <div className="flex-1 min-w-0 space-y-4 bg-gray-50/80 border border-gray-150 rounded-2xl p-2 sm:p-4 shadow-sm">
                  <div className="text-[10px] text-gray-500 font-black tracking-widest uppercase text-center mb-4 leading-tight">1/16 Finales (G)</div>
                  <div className="grid grid-cols-1 gap-4">
                    {r32Left.map(m => <div key={m.id} className="relative">{renderTreeMatchNode("r32", m.id, m.homeId, m.awayId, "center")}</div>)}
                  </div>
                </div>
                <div className="hidden md:block w-px bg-gray-200"></div>
                <div className="flex-1 min-w-0 space-y-4 bg-gray-50/80 border border-gray-150 rounded-2xl p-2 sm:p-4 shadow-sm">
                  <div className="text-[10px] text-gray-500 font-black tracking-widest uppercase text-center mb-4 leading-tight">1/16 Finales (D)</div>
                  <div className="grid grid-cols-1 gap-4">
                    {r32Right.map(m => <div key={m.id} className="relative">{renderTreeMatchNode("r32", m.id, m.homeId, m.awayId, "center")}</div>)}
                  </div>
                </div>
              </>
            )}

            {currentPhase === "r16" && (
              <>
                <div className="flex-1 min-w-0 space-y-4 bg-gray-50/80 border border-gray-150 rounded-2xl p-2 sm:p-4 shadow-sm">
                  <div className="text-[10px] text-gray-500 font-black tracking-widest uppercase text-center mb-4 leading-tight">Huitièmes (G)</div>
                  <div className="grid grid-cols-1 gap-4">
                    {r16Left.map(m => <div key={m.id} className="relative">{renderTreeMatchNode("r16", m.id, m.homeId, m.awayId, "center")}</div>)}
                  </div>
                </div>
                <div className="hidden md:block w-px bg-gray-200"></div>
                <div className="flex-1 min-w-0 space-y-4 bg-gray-50/80 border border-gray-150 rounded-2xl p-2 sm:p-4 shadow-sm">
                  <div className="text-[10px] text-gray-500 font-black tracking-widest uppercase text-center mb-4 leading-tight">Huitièmes (D)</div>
                  <div className="grid grid-cols-1 gap-4">
                    {r16Right.map(m => <div key={m.id} className="relative">{renderTreeMatchNode("r16", m.id, m.homeId, m.awayId, "center")}</div>)}
                  </div>
                </div>
              </>
            )}

            {currentPhase === "r8" && (
              <>
                <div className="flex-1 min-w-0 space-y-4 bg-gray-50/80 border border-gray-150 rounded-2xl p-2 sm:p-4 shadow-sm">
                  <div className="text-[10px] text-gray-500 font-black tracking-widest uppercase text-center mb-4 leading-tight">Quarts (G)</div>
                  <div className="grid grid-cols-1 gap-4">
                    {r8Left.map(m => <div key={m.id} className="relative">{renderTreeMatchNode("r8", m.id, m.homeId, m.awayId, "center")}</div>)}
                  </div>
                </div>
                <div className="hidden md:block w-px bg-gray-200"></div>
                <div className="flex-1 min-w-0 space-y-4 bg-gray-50/80 border border-gray-150 rounded-2xl p-2 sm:p-4 shadow-sm">
                  <div className="text-[10px] text-gray-500 font-black tracking-widest uppercase text-center mb-4 leading-tight">Quarts (D)</div>
                  <div className="grid grid-cols-1 gap-4">
                    {r8Right.map(m => <div key={m.id} className="relative">{renderTreeMatchNode("r8", m.id, m.homeId, m.awayId, "center")}</div>)}
                  </div>
                </div>
              </>
            )}

            {currentPhase === "r4" && (
              <>
                <div className="flex-1 min-w-0 space-y-4 bg-gray-50/80 border border-gray-150 rounded-2xl p-2 sm:p-4 shadow-sm">
                  <div className="text-[10px] text-gray-500 font-black tracking-widest uppercase text-center mb-4 leading-tight">Demi-finale (G)</div>
                  <div className="grid grid-cols-1 gap-6 md:gap-12 md:py-8">
                    {r4Left.map(m => <div key={m.id} className="relative">{renderTreeMatchNode("r4", m.id, m.homeId, m.awayId, "center")}</div>)}
                  </div>
                </div>
                <div className="hidden md:block w-px bg-gray-200"></div>
                <div className="flex-1 min-w-0 space-y-4 bg-gray-50/80 border border-gray-150 rounded-2xl p-2 sm:p-4 shadow-sm">
                  <div className="text-[10px] text-gray-500 font-black tracking-widest uppercase text-center mb-4 leading-tight">Demi-finale (D)</div>
                  <div className="grid grid-cols-1 gap-6 md:gap-12 md:py-8">
                    {r4Right.map(m => <div key={m.id} className="relative">{renderTreeMatchNode("r4", m.id, m.homeId, m.awayId, "center")}</div>)}
                  </div>
                </div>
              </>
            )}

            {currentPhase === "r2" && (
              <div className="flex-1 space-y-4 flex flex-col items-center py-12 md:py-16">
                <div className="text-[12px] text-amber-600 font-extrabold uppercase tracking-widest text-center mb-8">🏆 Grande Finale 🏆</div>
                <div className="w-full max-w-md relative">
                  {renderTreeMatchNode("r2", "R2_F1", bracketState.finalMatch.homeId, bracketState.finalMatch.awayId, "center")}
                </div>
              </div>
            )}

            {currentPhase === "winner" && (
              <div className="flex-1 flex justify-center py-12 md:py-24">
                {picks.winner ? (
                  <div className="relative group w-full max-w-sm">
                    <div className="absolute inset-0 bg-amber-500/10 rounded-2xl blur-lg opacity-60"></div>
                    <div className="relative bg-gradient-to-b from-amber-400 to-yellow-500 border border-amber-300 rounded-3xl p-10 text-slate-950 shadow-md space-y-4 text-center">
                      <Trophy className="w-20 h-20 mx-auto text-amber-950 animate-bounce" />
                      <div>
                        <div className="text-xs font-extrabold uppercase tracking-widest text-amber-900">Champion Prédit</div>
                        <div className="text-3xl font-black flex items-center justify-center gap-3 mt-3">
                          <span className="text-4xl">{BRACKET_TEAMS[picks.winner]?.flag}</span>
                          <span>{BRACKET_TEAMS[picks.winner]?.name}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border-2 border-gray-200 border-dashed rounded-3xl p-16 text-gray-400 space-y-4 w-full max-w-sm text-center flex flex-col items-center justify-center">
                    <HelpCircle className="w-16 h-16 mx-auto text-gray-300 animate-pulse" />
                    <div className="text-base font-extrabold uppercase tracking-wider">Champion à prédire</div>
                    <div className="text-[11px] text-gray-400">Remplissez d'abord la finale pour choisir le vainqueur.</div>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Wizard Next Button */}
          <div className="mt-8 flex justify-center border-t border-gray-100 pt-6 relative z-10">
             {currentPhase === "r32" && (
                <button onClick={() => setCurrentPhase("r16")} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow-sm transition">Continuer vers 1/8 ➡️</button>
             )}
             {currentPhase === "r16" && (
                <button onClick={() => setCurrentPhase("r8")} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow-sm transition">Continuer vers Quarts ➡️</button>
             )}
             {currentPhase === "r8" && (
                <button onClick={() => setCurrentPhase("r4")} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow-sm transition">Continuer vers Demies ➡️</button>
             )}
             {currentPhase === "r4" && (
                <button onClick={() => setCurrentPhase("r2")} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow-sm transition">Continuer vers Finale ➡️</button>
             )}
             {currentPhase === "r2" && (
                <button onClick={() => setCurrentPhase("winner")} className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow-sm transition">Choisir le Vainqueur 🏆</button>
             )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Test / Simu Mode Toggle and Panel */}
      <div className="flex justify-between items-center bg-gray-50 p-3 rounded-2xl border border-gray-200 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-gray-800">🛠️ Mode Test / Simulateur</span>
          <span className="text-[9px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full font-bold">Bêta</span>
        </div>
        <button
          type="button"
          onClick={() => setTestMode(!testMode)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            testMode 
              ? "bg-amber-600 text-white hover:bg-amber-700" 
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          {testMode ? "Désactiver" : "Activer"}
        </button>
      </div>

      {testMode && (
        <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-4 space-y-3">
          <h4 className="text-xs font-extrabold text-amber-900 uppercase tracking-wider">Options de Simulation</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              disabled={seeding}
              onClick={handleSeedMockParticipants}
              className="bg-white border border-amber-300 hover:bg-amber-50 text-amber-950 font-black px-3 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {seeding ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-amber-800 border-t-transparent rounded-full animate-spin"></div>
                  Génération...
                </>
              ) : (
                <>👥 Générer 5 joueurs fictifs</>
              )}
            </button>

            <button
              type="button"
              onClick={handleFillRandomPicks}
              className="bg-white border border-amber-300 hover:bg-amber-50 text-amber-950 font-black px-3 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              🎲 Remplir mes pronos au hasard
            </button>

            <button
              type="button"
              onClick={() => setForceLockMatches(!forceLockMatches)}
              className={`font-black px-3 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer border ${
                forceLockMatches
                  ? "bg-amber-600 border-amber-600 text-white hover:bg-amber-700"
                  : "bg-white border-amber-300 hover:bg-amber-50 text-amber-950"
              }`}
            >
              🔒 {forceLockMatches ? "Matches Verrouillés (Activé)" : "Verrouiller tous les matches"}
            </button>
          </div>
          <p className="text-[10px] text-amber-700 font-semibold leading-relaxed">
            💡 <strong>Astuce :</strong> Activez "Verrouiller tous les matches" pour tester instantanément le dévoilement des pronostics des autres participants. Allez ensuite dans l'onglet "Participants & Classement" et cliquez sur un participant pour voir ses choix !
          </p>
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex bg-gray-100 p-1 rounded-2xl gap-1 max-w-md mx-auto border border-gray-200">
        <button
          type="button"
          onClick={() => {
            setActiveSubTab("myBracket");
            setSelectedParticipant(null);
          }}
          className={`flex-1 py-2 rounded-xl text-center text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeSubTab === "myBracket" && !selectedParticipant
              ? "bg-emerald-600 text-white shadow-xs" 
              : "text-gray-500 hover:text-gray-800 hover:bg-gray-200/50"
          }`}
        >
          🌿 {mode === "results" ? "Résultats Officiels" : "Mon Tableau de Pronos"}
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("leaderboard")}
          className={`flex-1 py-2 rounded-xl text-center text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeSubTab === "leaderboard" || selectedParticipant
              ? "bg-emerald-600 text-white shadow-xs" 
              : "text-gray-500 hover:text-gray-800 hover:bg-gray-200/50"
          }`}
        >
          🏆 Participants & Classement ({participants.length})
        </button>
      </div>

      {/* CONDITIONAL RENDERING OF CONTENT */}
      {selectedParticipant !== null ? (
        <div className="space-y-4">
          {/* Header of selected participant */}
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-xl shadow-md">
                {selectedParticipant.avatar_value}
              </div>
              <div>
                <div className="text-[9px] text-emerald-800 font-extrabold uppercase tracking-widest">Pronostics de :</div>
                <div className="text-base font-black text-gray-900">{selectedParticipant.username}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedParticipant(null)}
              className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-black text-xs px-3.5 py-2 rounded-xl transition cursor-pointer flex items-center gap-1 shadow-xs"
            >
              ⬅️ Retour au classement
            </button>
          </div>
          
          <div className="bg-amber-50/40 border border-amber-150 rounded-2xl p-3 text-[11px] text-amber-900 font-semibold text-center">
            🔒 Les matchs non commencés de ce joueur restent masqués par sécurité et équité.
          </div>

          {/* Render the other participant's bracket (read-only and auto-masked) */}
          {renderBracketTree()}
        </div>
      ) : activeSubTab === "leaderboard" ? (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-150 overflow-hidden shadow-xs">
            <div className="bg-gray-50/50 px-4 py-3 border-b border-gray-150 flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-gray-500 uppercase tracking-widest">Classement du Défi</h3>
              <span className="text-[10px] text-gray-400 font-bold">{participants.length} Participants</span>
            </div>
            
            {participants.length === 0 ? (
              <div className="p-8 text-center text-gray-400 space-y-2">
                <div className="text-3xl">👥</div>
                <p className="text-xs font-bold">Aucun participant pour le moment.</p>
                <p className="text-[10px] text-gray-400">Invitez vos amis en partageant le code du défi !</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-150">
                {[...participants]
                  .sort((a, b) => {
                    const ptsA = a.points_awarded || 0;
                    const ptsB = b.points_awarded || 0;
                    if (ptsA !== ptsB) return ptsB - ptsA;
                    return (b.profile_points || 0) - (a.profile_points || 0);
                  })
                  .map((p, index) => {
                    const isCurrentUser = p.user_id === userId;
                    const rank = index + 1;
                    
                    const pPicks = p.predictions || {};
                    const r16C = Object.keys(pPicks.r16 || {}).filter(k => pPicks.r16[k]).length;
                    const r8C = Object.keys(pPicks.r8 || {}).filter(k => pPicks.r8[k]).length;
                    const r4C = Object.keys(pPicks.r4 || {}).filter(k => pPicks.r4[k]).length;
                    const r2C = Object.keys(pPicks.r2 || {}).filter(k => pPicks.r2[k]).length;
                    const winC = pPicks.winner ? 1 : 0;
                    const totalC = r16C + r8C + r4C + r2C + winC;
                    
                    return (
                      <div 
                        key={p.id || p.user_id} 
                        className={`flex items-center justify-between p-4 transition hover:bg-gray-50/50 ${
                          isCurrentUser ? "bg-emerald-50/20" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-7 text-center font-black text-sm text-gray-500 shrink-0">
                            {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`}
                          </div>
                          
                          <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-lg shadow-inner shrink-0">
                            {p.avatar_value}
                          </div>
                          <div className="min-w-0">
                            <div className="font-extrabold text-sm text-gray-800 flex items-center gap-1.5 truncate">
                              <span className="truncate">{p.username}</span>
                              {isCurrentUser && (
                                <span className="text-[8px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-full font-black uppercase shrink-0">Vous</span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-400 font-semibold">
                              {totalC}/31 pronostics complétés
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className="text-sm font-black text-emerald-800">
                              {p.points_awarded || 0} pts
                            </div>
                            <div className="text-[9px] text-gray-400 font-bold">
                              Profil: {p.profile_points || 0} pts
                            </div>
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => setSelectedParticipant(p)}
                            className="bg-white hover:bg-gray-100 text-gray-750 border border-gray-200 font-black text-xs px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 shadow-xs"
                          >
                            👁️ Voir
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* USER'S OWN ACTIVE BRACKET WITH HEADERS */
        <>
          <div className="bg-gradient-to-br from-emerald-950 to-emerald-850 text-white rounded-3xl p-5 shadow-sm relative overflow-hidden">
            <div className="absolute right-0 top-0 opacity-10 translate-x-4 -translate-y-4">
              <Trophy className="w-48 h-48 text-white" />
            </div>
            
            <div className="relative z-10 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-500 text-emerald-950 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {mode === "results" ? "Administration" : "Pronostic Spécial"}
                    </span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-black tracking-tight mt-1">
                    {mode === "results" ? "Saisie des Résultats Officiels" : (challenge.title || "Remplir le Tableau de Championnat")}
                  </h2>
                </div>
                
                {onShowRules && (
                  <button
                    type="button"
                    onClick={onShowRules}
                    className="bg-emerald-800/80 hover:bg-emerald-700 border border-emerald-600 text-emerald-100 font-bold py-2 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <HelpCircle className="w-4 h-4 text-emerald-300" />
                    Barème
                  </button>
                )}
              </div>
              
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

          {/* Actual Bracket Tree */}
          {renderBracketTree()}

          {/* Save Messages */}
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
                disabled={saving}
                onClick={handleResolveChallenge}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-black px-6 py-3.5 rounded-2xl shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2 cursor-pointer"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Enregistrement en cours...
                  </>
                ) : (
                  <>🎯 Enregistrer les résultats officiels & Résoudre le défi</>
                )}
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={handleSavePredictions}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-3.5 rounded-2xl shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2 cursor-pointer"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Enregistrement...
                  </>
                ) : (
                  <>💾 Enregistrer mes pronostics ({totalCompletedPicks}/{totalSlots})</>
                )}
              </button>
            )}
          </div>
          <p className="text-[11px] text-gray-400 font-bold text-right mt-1">
            * Vous pouvez enregistrer vos pronostics à tout moment et modifier vos choix pour tous les matchs non débutés.
          </p>
        </>
      )}
    </div>
  );
};
