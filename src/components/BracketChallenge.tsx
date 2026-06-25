import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  BRACKET_TEAMS, 
  STARTING_R32_MATCHES, 
  computeBracketState, 
  isBracketMatchStarted,
  BracketPredictions,
  BracketMatch,
  createEmptyBracketPredictions,
  BRACKET_MATCH_TIMES,
  generateRandomBracketPicks,
  calculateBracketPoints
} from "../bracketData";
import { supabase } from "../lib/supabase";
import { Check, Lock, Trophy, AlertTriangle, Sparkles, HelpCircle } from "lucide-react";

interface BracketChallengeProps {
  challenge: any;
  userId: string;
  mode: "prediction" | "results"; // prediction for users, results for creator resolution
  onSaveSuccess?: () => void;
  onShowRules?: () => void;
  isSimulationMode?: boolean;
  detailTab?: "matches" | "leaderboard" | "participants" | "results";
}

const getFlagUrl = (teamName: string) => {
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
    "south korea": "kr", "corée du sud": "kr",
    "ecuador": "ec", "équateur": "ec",
    "qatar": "qa"
  };
  for (const [key, code] of Object.entries(mapping)) {
    if (nameLower.includes(key)) {
      return `https://flagcdn.com/w80/${code}.png`;
    }
  }
  // Fallbacks for top clubs
  if (nameLower.includes("real madrid")) return "https://crests.football-data.org/86.svg";
  if (nameLower.includes("barcelona") || nameLower.includes("barcelone")) return "https://crests.football-data.org/81.svg";
  if (nameLower.includes("manchester city")) return "https://crests.football-data.org/65.svg";
  if (nameLower.includes("manchester united")) return "https://crests.football-data.org/66.svg";
  if (nameLower.includes("liverpool")) return "https://crests.football-data.org/64.svg";
  if (nameLower.includes("arsenal")) return "https://crests.football-data.org/57.svg";
  if (nameLower.includes("bayern")) return "https://crests.football-data.org/5.svg";
  if (nameLower.includes("psg") || nameLower.includes("paris saint-germain")) return "https://crests.football-data.org/524.svg";
  if (nameLower.includes("milan")) return "https://crests.football-data.org/98.svg";
  if (nameLower.includes("inter")) return "https://crests.football-data.org/108.svg";
  if (nameLower.includes("juventus")) return "https://crests.football-data.org/109.svg";
  if (nameLower.includes("dortmund")) return "https://crests.football-data.org/4.svg";
  
  return null;
};

interface StandingTeam {
  id: string;
  points: number;
  goalDiff: number;
  goalsFor: number;
  played: number;
}

function getOfficialQualifiedTeams(matches: any[]): Set<string> {
  const qualified = new Set<string>();
  
  // 1. Priorité absolue : Vérifier si l'API officielle a déjà renseigné les équipes dans les matchs à élimination directe !
  // Si oui, nous extrayons ces équipes directement, ce qui garantit un alignement parfait à 100% avec les calculs officiels de la FIFA (y compris le système complexe de départage des meilleurs 3èmes).
  let foundKnockoutTeams = false;
  matches.forEach(m => {
    if (m.stage && m.stage !== "GROUP_STAGE") {
      const homeCode = (m.homeTeam?.tla || m.homeTeam?.id || "").toString().toUpperCase();
      const awayCode = (m.awayTeam?.tla || m.awayTeam?.id || "").toString().toUpperCase();
      
      // On s'assure qu'il s'agit de vrais codes de pays à 3 lettres et non de placeholders (ex: "TBD", "W49")
      if (homeCode && homeCode.length === 3 && /^[A-Z]{3}$/.test(homeCode)) {
        qualified.add(homeCode);
        foundKnockoutTeams = true;
      }
      if (awayCode && awayCode.length === 3 && /^[A-Z]{3}$/.test(awayCode)) {
        qualified.add(awayCode);
        foundKnockoutTeams = true;
      }
    }
  });

  if (foundKnockoutTeams && qualified.size > 0) {
    console.log("Qualifications obtenues directement depuis les matchs officiels de l'API (Knockout) :", Array.from(qualified));
    return qualified;
  }

  // 2. Stratégie de secours : Si aucun match à élimination directe n'est encore renseigné (ex: pendant la phase de poules),
  // nous calculons de manière robuste les qualifications mathématiques à partir des résultats des matchs de groupe.
  const groupMatches: Record<string, any[]> = {};
  matches.forEach(m => {
    if (m.stage === "GROUP_STAGE" && m.group) {
      if (!groupMatches[m.group]) groupMatches[m.group] = [];
      groupMatches[m.group].push(m);
    }
  });

  // Pour chaque groupe, calcul des classements en cours et vérification des qualifiés
  Object.entries(groupMatches).forEach(([groupName, matchesInGroup]) => {
    const teamsInGroup = new Set<string>();
    matchesInGroup.forEach(m => {
      const homeCode = (m.homeTeam?.tla || m.homeTeam?.id || "").toString().toUpperCase();
      const awayCode = (m.awayTeam?.tla || m.awayTeam?.id || "").toString().toUpperCase();
      if (homeCode && homeCode.length === 3) teamsInGroup.add(homeCode);
      if (awayCode && awayCode.length === 3) teamsInGroup.add(awayCode);
    });

    const teamStats: Record<string, StandingTeam> = {};
    teamsInGroup.forEach(tid => {
      teamStats[tid] = { id: tid, points: 0, goalDiff: 0, goalsFor: 0, played: 0 };
    });

    // Calcul des statistiques pour les matchs joués (status === "FINISHED")
    let finishedCount = 0;
    matchesInGroup.forEach(m => {
      if (m.status === "FINISHED") {
        finishedCount++;
        const homeId = (m.homeTeam?.tla || m.homeTeam?.id || "").toString().toUpperCase();
        const awayId = (m.awayTeam?.tla || m.awayTeam?.id || "").toString().toUpperCase();
        const hGoal = m.score?.fullTime?.home ?? 0;
        const aGoal = m.score?.fullTime?.away ?? 0;

        if (homeId && teamStats[homeId]) {
          teamStats[homeId].played++;
          teamStats[homeId].goalsFor += hGoal;
          teamStats[homeId].goalDiff += (hGoal - aGoal);
        }
        if (awayId && teamStats[awayId]) {
          teamStats[awayId].played++;
          teamStats[awayId].goalsFor += aGoal;
          teamStats[awayId].goalDiff += (aGoal - hGoal);
        }

        if (homeId && awayId && teamStats[homeId] && teamStats[awayId]) {
          if (hGoal > aGoal) {
            teamStats[homeId].points += 3;
          } else if (aGoal > hGoal) {
            teamStats[awayId].points += 3;
          } else {
            teamStats[homeId].points += 1;
            teamStats[awayId].points += 1;
          }
        }
      }
    });

    const totalGroupMatchesExpected = 6;
    const isGroupFullyFinished = finishedCount === totalGroupMatchesExpected;

    if (isGroupFullyFinished) {
      // Tri classique par points, différence de buts, et buts marqués
      const sorted = Object.values(teamStats).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
        return b.goalsFor - a.goalsFor;
      });
      if (sorted[0]) qualified.add(sorted[0].id);
      if (sorted[1]) qualified.add(sorted[1].id);
    } else {
      // Garantie mathématique en cours de poules
      Object.entries(teamStats).forEach(([tid, stats]) => {
        const minPoints = stats.points;
        const remainingMatches = 3 - stats.played;
        const maxPoints = stats.points + (remainingMatches > 0 ? remainingMatches * 3 : 0);

        const otherTeamsMaxPoints: number[] = [];
        Object.entries(teamStats).forEach(([oid, ostats]) => {
          if (oid !== tid) {
            const oRemaining = 3 - ostats.played;
            const oMax = ostats.points + (oRemaining > 0 ? oRemaining * 3 : 0);
            otherTeamsMaxPoints.push(oMax);
          }
        });

        otherTeamsMaxPoints.sort((a, b) => a - b);
        const secondHighestOtherMax = otherTeamsMaxPoints[1]; // Index 1 est le milieu dans un groupe de 4 (3 adversaires)

        if (minPoints > secondHighestOtherMax) {
          qualified.add(tid);
        }
      });
    }
  });

  // Gestion des meilleurs 3èmes (uniquement si TOUS les groupes sont complètement terminés)
  const allGroups = Object.keys(groupMatches);
  const finishedGroupsCount = allGroups.filter(gName => {
    return groupMatches[gName].filter(m => m.status === "FINISHED").length === 6;
  }).length;

  if (allGroups.length > 0 && finishedGroupsCount === allGroups.length) {
    const thirdPlacedTeams: StandingTeam[] = [];
    allGroups.forEach(gName => {
      const matchesInGroup = groupMatches[gName];
      const teamsInGroup = new Set<string>();
      matchesInGroup.forEach(m => {
        const homeCode = (m.homeTeam?.tla || m.homeTeam?.id || "").toString().toUpperCase();
        const awayCode = (m.awayTeam?.tla || m.awayTeam?.id || "").toString().toUpperCase();
        if (homeCode && homeCode.length === 3) teamsInGroup.add(homeCode);
        if (awayCode && awayCode.length === 3) teamsInGroup.add(awayCode);
      });

      const teamStats: Record<string, StandingTeam> = {};
      teamsInGroup.forEach(tid => {
        teamStats[tid] = { id: tid, points: 0, goalDiff: 0, goalsFor: 0, played: 3 };
      });

      matchesInGroup.forEach(m => {
        const homeId = (m.homeTeam?.tla || m.homeTeam?.id || "").toString().toUpperCase();
        const awayId = (m.awayTeam?.tla || m.awayTeam?.id || "").toString().toUpperCase();
        const hGoal = m.score?.fullTime?.home ?? 0;
        const aGoal = m.score?.fullTime?.away ?? 0;

        if (homeId && teamStats[homeId]) {
          teamStats[homeId].goalsFor += hGoal;
          teamStats[homeId].goalDiff += (hGoal - aGoal);
        }
        if (awayId && teamStats[awayId]) {
          teamStats[awayId].goalsFor += aGoal;
          teamStats[awayId].goalDiff += (aGoal - hGoal);
        }

        if (homeId && awayId) {
          if (hGoal > aGoal) {
            teamStats[homeId].points += 3;
          } else if (aGoal > hGoal) {
            teamStats[awayId].points += 3;
          } else {
            teamStats[homeId].points += 1;
            teamStats[awayId].points += 1;
          }
        }
      });

      const sorted = Object.values(teamStats).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
        return b.goalsFor - a.goalsFor;
      });

      if (sorted[2]) {
        thirdPlacedTeams.push(sorted[2]);
      }
    });

    thirdPlacedTeams.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
      return b.goalsFor - a.goalsFor;
    });

    thirdPlacedTeams.slice(0, 8).forEach(t => qualified.add(t.id));
  }

  return qualified;
}

export interface RobustBracketState {
  r16Matches: Array<{ id: string; homeId: string; awayId: string; winnerId: string }>;
  r8Matches: Array<{ id: string; homeId: string; awayId: string; winnerId: string }>;
  r4Matches: Array<{ id: string; homeId: string; awayId: string; winnerId: string }>;
  finalMatch: { id: string; homeId: string; awayId: string; winnerId: string };
  winner: string;
}

export function computeRobustBracketState(picks: BracketPredictions, r32Matches: BracketMatch[]): RobustBracketState {
  const r32Winners: Record<string, string> = {};
  
  const r32Mapping: Record<string, string> = {
    R32_L1: "R16_L1_H", R32_L2: "R16_L1_A",
    R32_L3: "R16_L2_H", R32_L4: "R16_L2_A",
    R32_L5: "R16_L3_H", R32_L6: "R16_L3_A",
    R32_L7: "R16_L4_H", R32_L8: "R16_L4_A",
    R32_R1: "R16_R1_H", R32_R2: "R16_R1_A",
    R32_R3: "R16_R2_H", R32_R4: "R16_R2_A",
    R32_R5: "R16_R3_H", R32_R6: "R16_R3_A",
    R32_R7: "R16_R4_H", R32_R8: "R16_R4_A",
  };

  r32Matches.forEach(m => {
    const hasBothOpponents = m.homeId !== "" && m.awayId !== "";
    let winner = "";
    if (hasBothOpponents) {
      const slotKey = r32Mapping[m.id];
      const pickedWinner = picks.r16?.[slotKey] || "";
      if (pickedWinner === m.homeId || pickedWinner === m.awayId) {
        winner = pickedWinner;
      }
    }
    r32Winners[m.id] = winner;
  });

  const r16Matches = [
    { id: "R16_L1", homeId: r32Winners["R32_L1"] || "", awayId: r32Winners["R32_L2"] || "", winnerId: "" },
    { id: "R16_L2", homeId: r32Winners["R32_L3"] || "", awayId: r32Winners["R32_L4"] || "", winnerId: "" },
    { id: "R16_L3", homeId: r32Winners["R32_L5"] || "", awayId: r32Winners["R32_L6"] || "", winnerId: "" },
    { id: "R16_L4", homeId: r32Winners["R32_L7"] || "", awayId: r32Winners["R32_L8"] || "", winnerId: "" },
    { id: "R16_R1", homeId: r32Winners["R32_R1"] || "", awayId: r32Winners["R32_R2"] || "", winnerId: "" },
    { id: "R16_R2", homeId: r32Winners["R32_R3"] || "", awayId: r32Winners["R32_R4"] || "", winnerId: "" },
    { id: "R16_R3", homeId: r32Winners["R32_R5"] || "", awayId: r32Winners["R32_R6"] || "", winnerId: "" },
    { id: "R16_R4", homeId: r32Winners["R32_R7"] || "", awayId: r32Winners["R32_R8"] || "", winnerId: "" },
  ];

  const r16Winners: Record<string, string> = {};
  const r16Mapping: Record<string, string> = {
    R16_L1: "R8_L1_H", R16_L2: "R8_L1_A",
    R16_L3: "R8_L2_H", R16_L4: "R8_L2_A",
    R16_R1: "R8_R1_H", R16_R2: "R8_R1_A",
    R16_R3: "R8_R2_H", R16_R4: "R8_R2_A",
  };

  r16Matches.forEach(m => {
    const hasBothOpponents = m.homeId !== "" && m.awayId !== "";
    let winner = "";
    if (hasBothOpponents) {
      const slotKey = r16Mapping[m.id];
      const pickedWinner = picks.r8?.[slotKey] || "";
      if (pickedWinner === m.homeId || pickedWinner === m.awayId) {
        winner = pickedWinner;
      }
    }
    r16Winners[m.id] = winner;
    m.winnerId = winner;
  });

  const r8Matches = [
    { id: "R8_L1", homeId: r16Winners["R16_L1"] || "", awayId: r16Winners["R16_L2"] || "", winnerId: "" },
    { id: "R8_L2", homeId: r16Winners["R16_L3"] || "", awayId: r16Winners["R16_L4"] || "", winnerId: "" },
    { id: "R8_R1", homeId: r16Winners["R16_R1"] || "", awayId: r16Winners["R16_R2"] || "", winnerId: "" },
    { id: "R8_R2", homeId: r16Winners["R16_R3"] || "", awayId: r16Winners["R16_R4"] || "", winnerId: "" },
  ];

  const r8Winners: Record<string, string> = {};
  const r8Mapping: Record<string, string> = {
    R8_L1: "R4_L1_H", R8_L2: "R4_L1_A",
    R8_R1: "R4_R1_H", R8_R2: "R4_R1_A",
  };

  r8Matches.forEach(m => {
    const hasBothOpponents = m.homeId !== "" && m.awayId !== "";
    let winner = "";
    if (hasBothOpponents) {
      const slotKey = r8Mapping[m.id];
      const pickedWinner = picks.r4?.[slotKey] || "";
      if (pickedWinner === m.homeId || pickedWinner === m.awayId) {
        winner = pickedWinner;
      }
    }
    r8Winners[m.id] = winner;
    m.winnerId = winner;
  });

  const r4Matches = [
    { id: "R4_L1", homeId: r8Winners["R8_L1"] || "", awayId: r8Winners["R8_L2"] || "", winnerId: "" },
    { id: "R4_R1", homeId: r8Winners["R8_R1"] || "", awayId: r8Winners["R8_R2"] || "", winnerId: "" },
  ];

  const r4Winners: Record<string, string> = {};
  const r4Mapping: Record<string, string> = {
    R4_L1: "R2_L1_H", R4_R1: "R2_L1_A",
  };

  r4Matches.forEach(m => {
    const hasBothOpponents = m.homeId !== "" && m.awayId !== "";
    let winner = "";
    if (hasBothOpponents) {
      const slotKey = r4Mapping[m.id];
      const pickedWinner = picks.r2?.[slotKey] || "";
      if (pickedWinner === m.homeId || pickedWinner === m.awayId) {
        winner = pickedWinner;
      }
    }
    r4Winners[m.id] = winner;
    m.winnerId = winner;
  });

  const finalMatch = {
    id: "R2_F1",
    homeId: r4Winners["R4_L1"] || "",
    awayId: r4Winners["R4_R1"] || "",
    winnerId: "",
  };

  let winner = "";
  const hasBothFinalOpponents = finalMatch.homeId !== "" && finalMatch.awayId !== "";
  if (hasBothFinalOpponents) {
    const pickedWinner = picks.winner || "";
    if (pickedWinner === finalMatch.homeId || pickedWinner === finalMatch.awayId) {
      winner = pickedWinner;
    }
  }
  finalMatch.winnerId = winner;

  return {
    r16Matches,
    r8Matches,
    r4Matches,
    finalMatch,
    winner,
  };
}

export function sanitizePredictions(picks: BracketPredictions, r32Matches: BracketMatch[]): BracketPredictions {
  const robustState = computeRobustBracketState(picks, r32Matches);
  return {
    r16: {
      R16_L1_H: robustState.r16Matches[0].homeId,
      R16_L1_A: robustState.r16Matches[0].awayId,
      R16_L2_H: robustState.r16Matches[1].homeId,
      R16_L2_A: robustState.r16Matches[1].awayId,
      R16_L3_H: robustState.r16Matches[2].homeId,
      R16_L3_A: robustState.r16Matches[2].awayId,
      R16_L4_H: robustState.r16Matches[3].homeId,
      R16_L4_A: robustState.r16Matches[3].awayId,
      R16_R1_H: robustState.r16Matches[4].homeId,
      R16_R1_A: robustState.r16Matches[4].awayId,
      R16_R2_H: robustState.r16Matches[5].homeId,
      R16_R2_A: robustState.r16Matches[5].awayId,
      R16_R3_H: robustState.r16Matches[6].homeId,
      R16_R3_A: robustState.r16Matches[6].awayId,
      R16_R4_H: robustState.r16Matches[7].homeId,
      R16_R4_A: robustState.r16Matches[7].awayId,
    },
    r8: {
      R8_L1_H: robustState.r8Matches[0].homeId,
      R8_L1_A: robustState.r8Matches[0].awayId,
      R8_L2_H: robustState.r8Matches[1].homeId,
      R8_L2_A: robustState.r8Matches[1].awayId,
      R8_R1_H: robustState.r8Matches[2].homeId,
      R8_R1_A: robustState.r8Matches[2].awayId,
      R8_R2_H: robustState.r8Matches[3].homeId,
      R8_R2_A: robustState.r8Matches[3].awayId,
    },
    r4: {
      R4_L1_H: robustState.r4Matches[0].homeId,
      R4_L1_A: robustState.r4Matches[0].awayId,
      R4_R1_H: robustState.r4Matches[1].homeId,
      R4_R1_A: robustState.r4Matches[1].awayId,
    },
    r2: {
      R2_L1_H: robustState.finalMatch.homeId,
      R2_L1_A: robustState.finalMatch.awayId,
    },
    winner: robustState.winner,
  };
}

export const BracketChallenge: React.FC<BracketChallengeProps> = ({
  challenge,
  userId,
  mode,
  onSaveSuccess,
  onShowRules,
  isSimulationMode = false,
  detailTab = "matches"
}) => {
  const [picks, setPicks] = useState<BracketPredictions>(createEmptyBracketPredictions());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Participant list and selected participant for viewing bracket
  const [participants, setParticipants] = useState<any[]>([]);
  const [selectedParticipant, setSelectedParticipant] = useState<any | null>(null);

  // Test mode options
  const [testMode, setTestMode] = useState<boolean>(() => {
    const saved = localStorage.getItem(`bracket_test_mode_${challenge.id}`);
    if (saved !== null) {
      return saved === "true";
    }
    return isSimulationMode;
  });
  const [activeSimulationTab, setActiveSimulationTab] = useState<"picks" | "simulation">(() => {
    return (localStorage.getItem(`bracket_active_sim_tab_${challenge.id}`) as "picks" | "simulation") || "picks";
  });
  const [simulatedResults, setSimulatedResults] = useState<BracketPredictions | null>(() => {
    const saved = localStorage.getItem(`bracket_simulated_results_${challenge.id}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return null;
  });
  const [seeding, setSeeding] = useState(false);
  const [forceLockMatches, setForceLockMatches] = useState(false);
  const [isSimulationPanelExpanded, setIsSimulationPanelExpanded] = useState<boolean>(() => {
    const saved = localStorage.getItem(`bracket_sim_expanded_${challenge.id}`);
    return saved !== null ? saved === "true" : true;
  });
  const [activeSimPhase, setActiveSimPhase] = useState<string>("all");

  const [qualifiedTeams, setQualifiedTeams] = useState<Set<string>>(new Set());
  const [loadingQualifications, setLoadingQualifications] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    const fetchMatchesAndComputeQualifications = async () => {
      setLoadingQualifications(true);
      try {
        const res = await fetch("/api/matches/2000");
        if (res.ok) {
          const data = await res.json();
          if (active && data && data.matches) {
            const qualified = getOfficialQualifiedTeams(data.matches);
            setQualifiedTeams(qualified);
          }
        }
      } catch (err) {
        console.error("Error fetching matches for bracket qualifications:", err);
      } finally {
        if (active) {
          setLoadingQualifications(false);
        }
      }
    };

    fetchMatchesAndComputeQualifications();
    return () => {
      active = false;
    };
  }, []);

  const dynamicR32Matches = useMemo(() => {
    // If we haven't loaded qualifications, or if they are empty (e.g. failed fetch or offline),
    // we fallback to treating all preset teams as qualified to keep the challenge completely playable.
    if (!qualifiedTeams || qualifiedTeams.size === 0) {
      return STARTING_R32_MATCHES;
    }
    return STARTING_R32_MATCHES.map(m => {
      const homeQualified = qualifiedTeams.has(m.homeId);
      const awayQualified = qualifiedTeams.has(m.awayId);
      return {
        ...m,
        homeId: homeQualified ? m.homeId : "",
        awayId: awayQualified ? m.awayId : "",
      };
    });
  }, [qualifiedTeams]);

  // State update helpers with localStorage persistence
  const updateTestMode = (val: boolean) => {
    setTestMode(val);
    localStorage.setItem(`bracket_test_mode_${challenge.id}`, String(val));
    if (val) {
      const savedSim = localStorage.getItem(`bracket_simulated_results_${challenge.id}`);
      if (savedSim) {
        try {
          setSimulatedResults(JSON.parse(savedSim));
        } catch (e) {
          const empty = createEmptyBracketPredictions();
          setSimulatedResults(empty);
          localStorage.setItem(`bracket_simulated_results_${challenge.id}`, JSON.stringify(empty));
        }
      } else {
        const actual = typeof challenge.pointRules === "string"
          ? JSON.parse(challenge.pointRules)
          : (challenge.pointRules || {});
        const results = actual.actualBracketPicks || createEmptyBracketPredictions();
        setSimulatedResults(results);
        localStorage.setItem(`bracket_simulated_results_${challenge.id}`, JSON.stringify(results));
      }
    } else {
      setSimulatedResults(null);
    }
  };

  const updateSimulatedResults = (res: BracketPredictions | null) => {
    setSimulatedResults(res);
    if (res) {
      localStorage.setItem(`bracket_simulated_results_${challenge.id}`, JSON.stringify(res));
    } else {
      localStorage.removeItem(`bracket_simulated_results_${challenge.id}`);
    }
  };

  const updateActiveSimulationTab = (tab: "picks" | "simulation") => {
    setActiveSimulationTab(tab);
    localStorage.setItem(`bracket_active_sim_tab_${challenge.id}`, tab);
  };

  const updateSimulationPanelExpanded = (expanded: boolean) => {
    setIsSimulationPanelExpanded(expanded);
    localStorage.setItem(`bracket_sim_expanded_${challenge.id}`, String(expanded));
  };

  const handleToggleTestMode = () => {
    updateTestMode(!testMode);
  };

  // Phase timeline state
  const [currentPhase, setCurrentPhase] = useState<"r32" | "r16" | "r8" | "r4" | "r2" | "winner">("r32");

  // Synchronize with parent app's simulation mode state
  useEffect(() => {
    if (isSimulationMode) {
      updateTestMode(true);
    }
  }, [isSimulationMode]);

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
  const challengeId = challenge.id;
  const pointRulesStr = typeof challenge.pointRules === "string" 
    ? challenge.pointRules 
    : JSON.stringify(challenge.pointRules || {});

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        if (mode === "results") {
          // In results mode, load the actual results stored in point_rules.actualBracketPicks
          const pointRules = pointRulesStr ? JSON.parse(pointRulesStr) : {};

          if (pointRules.actualBracketPicks) {
            setPicks(pointRules.actualBracketPicks);
          } else {
            setPicks(createEmptyBracketPredictions());
          }
        } else {
          // In prediction mode, load the user's prediction from our secure backend API proxy
          const res = await fetch(`/api/bets?userId=${userId}&challengeId=${challengeId}`);
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
  }, [challengeId, pointRulesStr, userId, mode]);

  // Determine which predictions are currently active for the bracket tree
  const isViewingOther = !!selectedParticipant;
  const activePicks = (testMode && activeSimulationTab === "simulation" && simulatedResults)
    ? simulatedResults
    : (selectedParticipant ? selectedParticipant.predictions : picks);

  // Compute the current state of matches in later rounds based on active predictions
  const bracketState = computeRobustBracketState(activePicks, dynamicR32Matches);

  // Determine slot progression mapping
  // maps previous round winner to subsequent round position key
  const handleSelectWinner = (round: "r32" | "r16" | "r8" | "r4" | "r2", matchId: string, teamId: string) => {
    // Check lock conditions if in prediction mode
    if (mode === "prediction" && isMatchLocked(matchId) && !(testMode && activeSimulationTab === "simulation")) {
      setMessage({ type: "error", text: "Ce match a déjà commencé. Les pronostics sont clôturés." });
      return;
    }

    setMessage(null);
    const updatedPicks = { ...activePicks };

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

    if (testMode && activeSimulationTab === "simulation") {
      updateSimulatedResults(updatedPicks);
    } else {
      setPicks(updatedPicks);
    }
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
      const sanitized = sanitizePredictions(picks, dynamicR32Matches);
      const response = await fetch("/api/bets/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          challenge_id: challenge.id,
          predictions: sanitized,
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

  const handleSeedMockParticipants = async (count: number = 2) => {
    setSeeding(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/challenges/${challenge.id}/seed-mock-bets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || "Erreur lors de la génération.");
      }

      setMessage({ type: "success", text: `Génération réussie : ${resData.count} participant(s) fictif(s) ajouté(s) avec des pronostics !` });
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

  const handleSimulatePhase = (phase: "all" | "r32" | "r16" | "r8" | "r4" | "r2") => {
    try {
      setActiveSimPhase(phase);
      const isSim = (testMode && activeSimulationTab === "simulation");
      const currentSim = isSim 
        ? (simulatedResults || createEmptyBracketPredictions())
        : picks;
      const targetPicks = JSON.parse(JSON.stringify(currentSim));

      const r32Mapping: Record<string, string> = {
        R32_L1: "R16_L1_H", R32_L2: "R16_L1_A", R32_L3: "R16_L2_H", R32_L4: "R16_L2_A",
        R32_L5: "R16_L3_H", R32_L6: "R16_L3_A", R32_L7: "R16_L4_H", R32_L8: "R16_L4_A",
        R32_R1: "R16_R1_H", R32_R2: "R16_R1_A", R32_R3: "R16_R2_H", R32_R4: "R16_R2_A",
        R32_R5: "R16_R3_H", R32_R6: "R16_R3_A", R32_R7: "R16_R4_H", R32_R8: "R16_R4_A",
      };

      const r16Mapping: Record<string, string> = {
        R16_L1: "R8_L1_H", R16_L2: "R8_L1_A", R16_L3: "R8_L2_H", R16_L4: "R8_L2_A",
        R16_R1: "R8_R1_H", R16_R2: "R8_R1_A", R16_R3: "R8_R2_H", R16_R4: "R8_R2_A",
      };

      const r8Mapping: Record<string, string> = {
        R8_L1: "R4_L1_H", R8_L2: "R4_L1_A", R8_R1: "R4_R1_H", R8_R2: "R4_R1_A",
      };

      const r4Mapping: Record<string, string> = {
        R4_L1: "R2_L1_H", R4_R1: "R2_L1_A",
      };

      const pickRandom = (teamA: string, teamB: string) => {
        if (!teamA && !teamB) return "";
        if (!teamA) return teamB;
        if (!teamB) return teamA;
        return Math.random() < 0.5 ? teamA : teamB;
      };

      // 1. R32
      if (phase === "all" || phase === "r32" || !Object.keys(targetPicks.r16 || {}).length) {
        if (!targetPicks.r16) targetPicks.r16 = {};
        dynamicR32Matches.forEach(m => {
          const slotKey = r32Mapping[m.id];
          if (slotKey) {
            targetPicks.r16[slotKey] = pickRandom(m.homeId, m.awayId);
          }
        });
        if (phase === "r32") {
          targetPicks.r8 = {};
          targetPicks.r4 = {};
          targetPicks.r2 = {};
          targetPicks.winner = "";
        }
      }

      // 2. R16
      if (phase === "all" || phase === "r16" || (["r8", "r4", "r2"].includes(phase) && !Object.keys(targetPicks.r8 || {}).length)) {
        if (!targetPicks.r8) targetPicks.r8 = {};
        const matches = [
          { id: "R16_L1", home: targetPicks.r16["R16_L1_H"], away: targetPicks.r16["R16_L1_A"] },
          { id: "R16_L2", home: targetPicks.r16["R16_L2_H"], away: targetPicks.r16["R16_L2_A"] },
          { id: "R16_L3", home: targetPicks.r16["R16_L3_H"], away: targetPicks.r16["R16_L3_A"] },
          { id: "R16_L4", home: targetPicks.r16["R16_L4_H"], away: targetPicks.r16["R16_L4_A"] },
          { id: "R16_R1", home: targetPicks.r16["R16_R1_H"], away: targetPicks.r16["R16_R1_A"] },
          { id: "R16_R2", home: targetPicks.r16["R16_R2_H"], away: targetPicks.r16["R16_R2_A"] },
          { id: "R16_R3", home: targetPicks.r16["R16_R3_H"], away: targetPicks.r16["R16_R3_A"] },
          { id: "R16_R4", home: targetPicks.r16["R16_R4_H"], away: targetPicks.r16["R16_R4_A"] },
        ];

        matches.forEach(m => {
          const slotKey = r16Mapping[m.id];
          if (slotKey) {
            targetPicks.r8[slotKey] = pickRandom(m.home, m.away);
          }
        });

        if (phase === "r16") {
          targetPicks.r4 = {};
          targetPicks.r2 = {};
          targetPicks.winner = "";
        }
      }

      // 3. R8
      if (phase === "all" || phase === "r8" || (["r4", "r2"].includes(phase) && !Object.keys(targetPicks.r4 || {}).length)) {
        if (!targetPicks.r4) targetPicks.r4 = {};
        const matches = [
          { id: "R8_L1", home: targetPicks.r8["R8_L1_H"], away: targetPicks.r8["R8_L1_A"] },
          { id: "R8_L2", home: targetPicks.r8["R8_L2_H"], away: targetPicks.r8["R8_L2_A"] },
          { id: "R8_R1", home: targetPicks.r8["R8_R1_H"], away: targetPicks.r8["R8_R1_A"] },
          { id: "R8_R2", home: targetPicks.r8["R8_R2_H"], away: targetPicks.r8["R8_R2_A"] },
        ];

        matches.forEach(m => {
          const slotKey = r8Mapping[m.id];
          if (slotKey) {
            targetPicks.r4[slotKey] = pickRandom(m.home, m.away);
          }
        });

        if (phase === "r8") {
          targetPicks.r2 = {};
          targetPicks.winner = "";
        }
      }

      // 4. R4
      if (phase === "all" || phase === "r4" || (phase === "r2" && !Object.keys(targetPicks.r2 || {}).length)) {
        if (!targetPicks.r2) targetPicks.r2 = {};
        const matches = [
          { id: "R4_L1", home: targetPicks.r4["R4_L1_H"], away: targetPicks.r4["R4_L1_A"] },
          { id: "R4_R1", home: targetPicks.r4["R4_R1_H"], away: targetPicks.r4["R4_R1_A"] },
        ];

        matches.forEach(m => {
          const slotKey = r4Mapping[m.id];
          if (slotKey) {
            targetPicks.r2[slotKey] = pickRandom(m.home, m.away);
          }
        });

        if (phase === "r4") {
          targetPicks.winner = "";
        }
      }

      // 5. R2
      if (phase === "all" || phase === "r2") {
        const home = targetPicks.r2["R2_L1_H"];
        const away = targetPicks.r2["R2_L1_A"];
        targetPicks.winner = pickRandom(home, away);
      }

      if (isSim) {
        updateSimulatedResults(targetPicks);
      } else {
        setPicks(targetPicks);
      }

      let phaseLabel = "";
      if (phase === "all") phaseLabel = "Toutes les phases";
      else if (phase === "r32") phaseLabel = "Seizièmes de finale (1/16)";
      else if (phase === "r16") phaseLabel = "Huitièmes de finale (1/8)";
      else if (phase === "r8") phaseLabel = "Quarts de finale (1/4)";
      else if (phase === "r4") phaseLabel = "Demi-finales (1/2)";
      else if (phase === "r2") phaseLabel = "Finale & Champion";

      const editorLabel = isSim ? "les Résultats Réels Simulés" : "Mes Pronostics";
      setMessage({
        type: "success",
        text: `⚡ Résultats factices de [${phaseLabel}] générés avec succès pour ${editorLabel}. Vous pouvez voir l'évolution en direct !`
      });
    } catch (err: any) {
      console.error(err);
      setMessage({ type: "error", text: "Erreur lors de la simulation de phase : " + err.message });
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
    const currentPicks = activePicks;
    
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
      if (currentPicks.r16[slot]) {
        isSelectedA = currentPicks.r16[slot] === teamAId;
        isSelectedB = currentPicks.r16[slot] === teamBId;
      }
    } else if (round === "r16") {
      const slotMap: Record<string, string> = {
        R16_L1: "R8_L1_H", R16_L2: "R8_L1_A",
        R16_L3: "R8_L2_H", R16_L4: "R8_L2_A",
        R16_R1: "R8_R1_H", R16_R2: "R8_R1_A",
        R16_R3: "R8_R2_H", R16_R4: "R8_R2_A",
      };
      const slot = slotMap[matchId];
      if (currentPicks.r8[slot]) {
        isSelectedA = currentPicks.r8[slot] === teamAId;
        isSelectedB = currentPicks.r8[slot] === teamBId;
      }
    } else if (round === "r8") {
      const slotMap: Record<string, string> = {
        R8_L1: "R4_L1_H", R8_L2: "R4_L1_A",
        R8_R1: "R4_R1_H", R8_R2: "R4_R1_A",
      };
      const slot = slotMap[matchId];
      if (currentPicks.r4[slot]) {
        isSelectedA = currentPicks.r4[slot] === teamAId;
        isSelectedB = currentPicks.r4[slot] === teamBId;
      }
    } else if (round === "r4") {
      const slotMap: Record<string, string> = {
        R4_L1: "R2_L1_H", R4_R1: "R2_L1_A",
      };
      const slot = slotMap[matchId];
      if (currentPicks.r2[slot]) {
        isSelectedA = currentPicks.r2[slot] === teamAId;
        isSelectedB = currentPicks.r2[slot] === teamBId;
      }
    } else if (round === "r2") {
      if (currentPicks.winner) {
        isSelectedA = currentPicks.winner === teamAId;
        isSelectedB = currentPicks.winner === teamBId;
      }
    }

    if (!teamA || !teamB || teamAId === "" || teamBId === "") {
      isSelectedA = false;
      isSelectedB = false;
    }

    const locked = mode === "prediction" && isMatchLocked(matchId);

    return (
      <div className="bg-white border border-gray-150 rounded-2xl p-3 shadow-xs hover:shadow-md transition-all duration-300 relative overflow-hidden">
        {locked ? (
          <div className="absolute top-1.5 right-2 flex items-center gap-1 text-[9px] bg-red-50 text-red-600 font-bold px-1.5 py-0.5 rounded-full border border-red-100">
            <Lock className="w-2.5 h-2.5" /> Clôturé
          </div>
        ) : (!teamA || !teamB) ? (
          <div className="absolute top-1.5 right-2 flex items-center gap-1 text-[9px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded-full border border-slate-200">
            <Lock className="w-2.5 h-2.5" /> Verrouillé
          </div>
        ) : null}
        
        <div className="space-y-1.5 mt-1">
          {/* Team A */}
          <button
            type="button"
            disabled={locked || !teamA || !teamB}
            onClick={() => teamA && teamB && handleSelectWinner(round, matchId, teamAId)}
            className={`w-full flex items-center justify-between p-2 rounded-xl border text-sm font-bold transition-all ${
              !teamA 
                ? "bg-gray-55 border-dashed border-gray-200 text-gray-400 cursor-not-allowed"
                : !teamB
                  ? "bg-gray-50/50 border-gray-150 text-gray-500 opacity-75 cursor-not-allowed"
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
            disabled={locked || !teamA || !teamB}
            onClick={() => teamA && teamB && handleSelectWinner(round, matchId, teamBId)}
            className={`w-full flex items-center justify-between p-2 rounded-xl border text-sm font-bold transition-all ${
              !teamB 
                ? "bg-gray-55 border-dashed border-gray-200 text-gray-400 cursor-not-allowed"
                : !teamA
                  ? "bg-gray-50/50 border-gray-150 text-gray-500 opacity-75 cursor-not-allowed"
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
  const r16Progress = Object.keys(activePicks.r16).filter(k => activePicks.r16[k]).length;
  const r8Progress = Object.keys(activePicks.r8).filter(k => activePicks.r8[k]).length;
  const r4Progress = Object.keys(activePicks.r4).filter(k => activePicks.r4[k]).length;
  const r2Progress = Object.keys(activePicks.r2).filter(k => activePicks.r2[k]).length;
  const isWinnerPicked = !!activePicks.winner;

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

    const isWinnerA = teamAId !== "" && teamBId !== "" && winnerId === teamAId;
    const isWinnerB = teamAId !== "" && teamBId !== "" && winnerId === teamBId;

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
          {(() => {
            const simWinnerId = (testMode && simulatedResults) ? getSelectedWinnerForPredictions(simulatedResults, matchId) : "";
            const isSimWinnerA = simWinnerId === teamAId && teamAId !== "";
            const isSimWinnerB = simWinnerId === teamBId && teamBId !== "";
            const showValidation = testMode && simulatedResults && simWinnerId && activeSimulationTab !== "simulation";

            let btnClassA = "";
            if (!teamA) {
              btnClassA = "bg-gray-55 border border-dashed border-gray-200 text-gray-400 cursor-not-allowed";
            } else if (!teamB && !showValidation) {
              btnClassA = "bg-gray-50 border border-gray-150 text-gray-500 opacity-75 cursor-not-allowed";
            } else if (showValidation) {
              if (isWinnerA) {
                if (isSimWinnerA) {
                  btnClassA = "bg-emerald-50/80 border-emerald-500 text-emerald-950 font-black shadow-sm ring-1 ring-emerald-500/30";
                } else {
                  btnClassA = "bg-rose-50 border-rose-400 text-rose-950 font-bold shadow-xs";
                }
              } else {
                if (isSimWinnerA) {
                  btnClassA = "bg-amber-50/30 border-amber-300 text-amber-950 font-bold";
                } else {
                  btnClassA = "bg-white border-gray-150 text-gray-400 opacity-60 hover:opacity-100";
                }
              }
            } else {
              btnClassA = isWinnerA
                ? "bg-emerald-50 border-emerald-500 text-emerald-950 font-black shadow-xs"
                : "bg-white border-gray-200 text-gray-750 hover:bg-gray-50 hover:border-gray-300 cursor-pointer";
            }

            let btnClassB = "";
            if (!teamB) {
              btnClassB = "bg-gray-55 border border-dashed border-gray-200 text-gray-400 cursor-not-allowed";
            } else if (!teamA && !showValidation) {
              btnClassB = "bg-gray-50 border border-gray-150 text-gray-500 opacity-75 cursor-not-allowed";
            } else if (showValidation) {
              if (isWinnerB) {
                if (isSimWinnerB) {
                  btnClassB = "bg-emerald-50/80 border-emerald-500 text-emerald-950 font-black shadow-sm ring-1 ring-emerald-500/30";
                } else {
                  btnClassB = "bg-rose-50 border-rose-400 text-rose-950 font-bold shadow-xs";
                }
              } else {
                if (isSimWinnerB) {
                  btnClassB = "bg-amber-50/30 border-amber-300 text-amber-950 font-bold";
                } else {
                  btnClassB = "bg-white border-gray-150 text-gray-400 opacity-60 hover:opacity-100";
                }
              }
            } else {
              btnClassB = isWinnerB
                ? "bg-emerald-50 border-emerald-500 text-emerald-950 font-black shadow-xs"
                : "bg-white border-gray-200 text-gray-750 hover:bg-gray-50 hover:border-gray-300 cursor-pointer";
            }

            const getSimTeamsForMatch = (mId: string) => {
              if (!simulatedResults) return { homeId: "", awayId: "" };
              if (mId.startsWith("R32_")) {
                const startMatch = dynamicR32Matches.find(m => m.id === mId);
                return { homeId: startMatch?.homeId || "", awayId: startMatch?.awayId || "" };
              }
              const simState = computeRobustBracketState(simulatedResults, dynamicR32Matches);
              if (mId.startsWith("R16_")) {
                const match = simState.r16Matches.find(m => m.id === mId);
                return { homeId: match?.homeId || "", awayId: match?.awayId || "" };
              } else if (mId.startsWith("R8_")) {
                const match = simState.r8Matches.find(m => m.id === mId);
                return { homeId: match?.homeId || "", awayId: match?.awayId || "" };
              } else if (mId.startsWith("R4_")) {
                const match = simState.r4Matches.find(m => m.id === mId);
                return { homeId: match?.homeId || "", awayId: match?.awayId || "" };
              } else if (mId === "R2_F1") {
                return { homeId: simState.finalMatch.homeId || "", awayId: simState.finalMatch.awayId || "" };
              }
              return { homeId: "", awayId: "" };
            };

            const simTeams = showValidation ? getSimTeamsForMatch(matchId) : null;
            const simHome = simTeams ? BRACKET_TEAMS[simTeams.homeId] : null;
            const simAway = simTeams ? BRACKET_TEAMS[simTeams.awayId] : null;
            const simWinner = simWinnerId ? BRACKET_TEAMS[simWinnerId] : null;

            return (
              <>
                <button
                  type="button"
                  disabled={locked || !teamA || !teamB}
                  onClick={() => teamA && teamB && handleSelectWinner(round, matchId, teamAId)}
                  className={`w-full flex items-center justify-between p-1.5 rounded-lg text-xs font-bold transition-all ${btnClassA}`}
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
                        {showValidation && !maskPrediction && teamA && (
                          <>
                            {isWinnerA && isSimWinnerA && (
                              <span className="text-[7px] bg-emerald-600 text-white font-black px-1 py-0.2 rounded shrink-0 uppercase tracking-wider">Correct</span>
                            )}
                            {isWinnerA && !isSimWinnerA && (
                              <span className="text-[7px] bg-rose-600 text-white font-black px-1 py-0.2 rounded shrink-0 uppercase tracking-wider">Faux</span>
                            )}
                            {!isWinnerA && isSimWinnerA && (
                              <span className="text-[7px] bg-amber-500 text-white font-black px-1 py-0.2 rounded shrink-0 uppercase tracking-wider">Gagnant</span>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </span>
                  {isWinnerA && !maskPrediction && (
                    showValidation ? (
                      isSimWinnerA ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <span className="text-rose-600 text-[10px] font-black shrink-0">❌</span>
                      )
                    ) : (
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    )
                  )}
                  {!isWinnerA && showValidation && isSimWinnerA && !maskPrediction && (
                    <span className="text-amber-500 text-[10px] font-black shrink-0">🏆</span>
                  )}
                </button>

                <button
                  type="button"
                  disabled={locked || !teamA || !teamB}
                  onClick={() => teamA && teamB && handleSelectWinner(round, matchId, teamBId)}
                  className={`w-full flex items-center justify-between p-1.5 rounded-lg text-xs font-bold transition-all ${btnClassB}`}
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
                        {showValidation && !maskPrediction && teamB && (
                          <>
                            {isWinnerB && isSimWinnerB && (
                              <span className="text-[7px] bg-emerald-600 text-white font-black px-1 py-0.2 rounded shrink-0 uppercase tracking-wider">Correct</span>
                            )}
                            {isWinnerB && !isSimWinnerB && (
                              <span className="text-[7px] bg-rose-600 text-white font-black px-1 py-0.2 rounded shrink-0 uppercase tracking-wider">Faux</span>
                            )}
                            {!isWinnerB && isSimWinnerB && (
                              <span className="text-[7px] bg-amber-500 text-white font-black px-1 py-0.2 rounded shrink-0 uppercase tracking-wider">Gagnant</span>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </span>
                  {isWinnerB && !maskPrediction && (
                    showValidation ? (
                      isSimWinnerB ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <span className="text-rose-600 text-[10px] font-black shrink-0">❌</span>
                      )
                    ) : (
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    )
                  )}
                  {!isWinnerB && showValidation && isSimWinnerB && !maskPrediction && (
                    <span className="text-amber-500 text-[10px] font-black shrink-0">🏆</span>
                  )}
                </button>

                {showValidation && (
                  <div className="mt-1.5 pt-1.5 border-t border-dashed border-gray-150 bg-amber-50/40 rounded-lg p-1 text-[8.5px] leading-tight text-amber-950 font-bold">
                    <div className="flex items-center justify-between text-amber-800 font-extrabold uppercase tracking-wider text-[7px] mb-1">
                      <span>Simulé Réel</span>
                      <span>🏆 {simWinner ? `${simWinner.flag} ${simWinner.name}` : "Aucun"}</span>
                    </div>
                    {simHome && simAway ? (
                      <div className="flex items-center gap-1 text-gray-500 font-medium">
                        <span className="truncate">
                          {simHome.flag} {simHome.name} vs {simAway.flag} {simAway.name}
                        </span>
                      </div>
                    ) : (
                      <div className="text-gray-400 italic text-[7.5px]">Équipes précédentes non qualifiées</div>
                    )}
                  </div>
                )}
              </>
            );
          })()}
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
    const r32Left = dynamicR32Matches.filter(m => m.id.includes("_L"));
    const r32Right = dynamicR32Matches.filter(m => m.id.includes("_R"));

    const r16Left = bracketState.r16Matches.filter(m => m.id.includes("_L"));
    const r16Right = bracketState.r16Matches.filter(m => m.id.includes("_R"));

    const r8Left = bracketState.r8Matches.filter(m => m.id.includes("_L"));
    const r8Right = bracketState.r8Matches.filter(m => m.id.includes("_R"));

    const r4Left = bracketState.r4Matches.filter(m => m.id.includes("_L"));
    const r4Right = bracketState.r4Matches.filter(m => m.id.includes("_R"));

    const liveScore = testMode && simulatedResults ? calculateBracketPoints(sanitizePredictions(picks, dynamicR32Matches), sanitizePredictions(simulatedResults, dynamicR32Matches)) : 0;

    return (
      <div className="space-y-4">
        {testMode && simulatedResults && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs animate-fade-in">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-xl shrink-0">📊</span>
              <div className="min-w-0">
                <div className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                  <span>Score Simulé en Direct</span>
                  <span className="text-[8px] bg-amber-600 text-white px-1.5 py-0.5 rounded-full font-bold uppercase animate-pulse">Live</span>
                </div>
                <p className="text-[10px] text-amber-800 leading-normal font-medium">
                  Modifiez vos pronostics ci-dessous : votre score est recalculé instantanément par rapport aux résultats simulés !
                </p>
              </div>
            </div>
            <div className="bg-amber-600 text-white font-black text-xs px-3.5 py-2 rounded-xl shadow-sm text-center shrink-0">
              Score Simulé : {liveScore} pts
            </div>
          </div>
        )}

        {/* Call to action to invite user to predict */}
        <div className="bg-emerald-50/40 border border-emerald-100 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-start gap-3 text-left">
            <span className="text-xl mt-0.5 shrink-0 select-none">🔮</span>
            <div>
              <span className="text-[11px] font-extrabold text-emerald-950 uppercase tracking-wide block">
                Faites vos jeux !
              </span>
              <p className="text-[10px] text-emerald-800 leading-relaxed font-semibold">
                Remplissez votre tableau de pronostics de la phase finale, défiez vos amis et tentez de décrocher le titre suprême ! 🏆
              </p>
            </div>
          </div>
        </div>

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
                {activePicks.winner ? (
                  <div className="relative group w-full max-w-sm">
                    <div className="absolute inset-0 bg-amber-500/10 rounded-2xl blur-lg opacity-60"></div>
                    <div className="relative bg-gradient-to-b from-amber-400 to-yellow-500 border border-amber-300 rounded-3xl p-10 text-slate-950 shadow-md space-y-4 text-center">
                      <Trophy className="w-20 h-20 mx-auto text-amber-950 animate-bounce" />
                      <div>
                        <div className="text-xs font-extrabold uppercase tracking-widest text-amber-900">Champion Prédit</div>
                        <div className="text-3xl font-black flex items-center justify-center gap-3 mt-3">
                          <span className="text-4xl">{BRACKET_TEAMS[activePicks.winner]?.flag}</span>
                          <span>{BRACKET_TEAMS[activePicks.winner]?.name}</span>
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
          onClick={handleToggleTestMode}
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
          <div className="flex justify-between items-center pb-2 border-b border-amber-100">
            <h4 className="text-xs font-extrabold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
              <span>⚙️ Options de Simulation</span>
            </h4>
            <button
              type="button"
              onClick={() => updateSimulationPanelExpanded(!isSimulationPanelExpanded)}
              className="bg-amber-100 hover:bg-amber-200 text-amber-950 font-black text-[10px] px-2.5 py-1 rounded-lg transition"
            >
              {isSimulationPanelExpanded ? "[- Réduire]" : "[+ Déplier]"}
            </button>
          </div>

          {isSimulationPanelExpanded ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    disabled={seeding}
                    onClick={() => handleSeedMockParticipants(1)}
                    className="bg-white border border-amber-300 hover:bg-amber-50 text-amber-950 font-black px-3 py-1.5 rounded-xl text-[11px] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {seeding ? (
                      <>
                        <div className="w-3 h-3 border-2 border-amber-800 border-t-transparent rounded-full animate-spin"></div>
                        Génération...
                      </>
                    ) : (
                      <>👤 Générer 1 joueur fictif</>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={seeding}
                    onClick={() => handleSeedMockParticipants(2)}
                    className="bg-white border border-amber-300 hover:bg-amber-50 text-amber-950 font-black px-3 py-1.5 rounded-xl text-[11px] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {seeding ? (
                      <>
                        <div className="w-3 h-3 border-2 border-amber-800 border-t-transparent rounded-full animate-spin"></div>
                        Génération...
                      </>
                    ) : (
                      <>👥 Générer 2 joueurs fictifs (max)</>
                    )}
                  </button>
                </div>

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
              
              <div className="bg-amber-100/40 p-2.5 rounded-xl flex flex-col sm:flex-row items-center justify-between border border-amber-200/65 mt-2 gap-2">
                <div className="text-xs font-black text-amber-950">
                  ⚡ Saisie active dans l'éditeur :
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      updateActiveSimulationTab("picks");
                      setSelectedParticipant(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                      activeSimulationTab === "picks"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
                    }`}
                  >
                    🎯 Mes Pronostics
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      updateActiveSimulationTab("simulation");
                      setSelectedParticipant(null);
                      if (!simulatedResults) {
                        updateSimulatedResults(createEmptyBracketPredictions());
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                      activeSimulationTab === "simulation"
                        ? "bg-amber-600 text-white shadow-xs"
                        : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
                    }`}
                  >
                    🏆 Résultats Réels Simulés
                  </button>
                </div>
              </div>

              <p className="text-[10px] text-amber-700 font-semibold leading-relaxed mt-2 bg-amber-50 p-2 rounded-lg">
                💡 <strong>Comment ça marche ?</strong> Sélectionnez <strong>"Résultats Réels Simulés"</strong> pour remplir les vainqueurs réels sur le tableau ci-dessous. Allez ensuite dans l'onglet <strong>"Participants & Classement"</strong> : le score et le classement de chaque joueur seront recalculés <strong>en direct</strong> selon votre simulation !
              </p>

              {/* Phase Simulation Selector */}
              <div className="bg-amber-100/40 p-3 rounded-xl border border-amber-200/60 space-y-2 mt-2">
                <div className="flex items-center gap-1.5 text-xs font-black text-amber-950">
                  <span>🎲 Simuler des résultats factis :</span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSimulatePhase("all")}
                    className={`font-extrabold px-2 py-1.5 rounded-lg text-[10px] text-center transition cursor-pointer shadow-xs ${
                      activeSimPhase === "all"
                        ? "bg-amber-600 hover:bg-amber-700 text-white"
                        : "bg-white border border-amber-300 hover:bg-amber-50 text-amber-950"
                    }`}
                    title="Simuler toutes les phases"
                  >
                    🔥 Toutes phases
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => handleSimulatePhase("r32")}
                    className={`font-extrabold px-2 py-1.5 rounded-lg text-[10px] text-center transition cursor-pointer shadow-xs ${
                      activeSimPhase === "r32"
                        ? "bg-amber-600 hover:bg-amber-700 text-white"
                        : "bg-white border border-amber-300 hover:bg-amber-50 text-amber-950"
                    }`}
                    title="Simuler les 1/16 de finale"
                  >
                    1/16 de finale
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => handleSimulatePhase("r16")}
                    className={`font-extrabold px-2 py-1.5 rounded-lg text-[10px] text-center transition cursor-pointer shadow-xs ${
                      activeSimPhase === "r16"
                        ? "bg-amber-600 hover:bg-amber-700 text-white"
                        : "bg-white border border-amber-300 hover:bg-amber-50 text-amber-950"
                    }`}
                    title="Simuler les 1/8 de finale"
                  >
                    1/8 de finale
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => handleSimulatePhase("r8")}
                    className={`font-extrabold px-2 py-1.5 rounded-lg text-[10px] text-center transition cursor-pointer shadow-xs ${
                      activeSimPhase === "r8"
                        ? "bg-amber-600 hover:bg-amber-700 text-white"
                        : "bg-white border border-amber-300 hover:bg-amber-50 text-amber-950"
                    }`}
                    title="Simuler les Quarts de finale"
                  >
                    Quarts (1/4)
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => handleSimulatePhase("r4")}
                    className={`font-extrabold px-2 py-1.5 rounded-lg text-[10px] text-center transition cursor-pointer shadow-xs ${
                      activeSimPhase === "r4"
                        ? "bg-amber-600 hover:bg-amber-700 text-white"
                        : "bg-white border border-amber-300 hover:bg-amber-50 text-amber-950"
                    }`}
                    title="Simuler les Demi-finales"
                  >
                    Demis (1/2)
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => handleSimulatePhase("r2")}
                    className={`font-extrabold px-2 py-1.5 rounded-lg text-[10px] text-center transition cursor-pointer shadow-xs ${
                      activeSimPhase === "r2"
                        ? "bg-amber-600 hover:bg-amber-700 text-white"
                        : "bg-white border border-amber-300 hover:bg-amber-50 text-amber-950"
                    }`}
                    title="Simuler la Finale"
                  >
                    🏆 Finale
                  </button>
                </div>
                
                <p className="text-[9px] text-amber-800 leading-normal font-medium">
                  💡 Cette action génère des vainqueurs aléatoires pour la phase sélectionnée et l'applique au tableau actif ci-dessous (<strong>{activeSimulationTab === "simulation" ? "🏆 Résultats Réels Simulés" : "🎯 Mes Pronostics"}</strong>).
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                <span>Mode Test actif (réduit). Classements basés sur vos scores simulés.</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    updateActiveSimulationTab("picks");
                    setSelectedParticipant(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition cursor-pointer ${
                    activeSimulationTab === "picks"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
                  }`}
                >
                  🎯 Mes Pronostics
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateActiveSimulationTab("simulation");
                    setSelectedParticipant(null);
                    if (!simulatedResults) {
                      updateSimulatedResults(createEmptyBracketPredictions());
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition cursor-pointer ${
                    activeSimulationTab === "simulation"
                      ? "bg-amber-600 text-white shadow-xs"
                      : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
                  }`}
                >
                  🏆 Résultats Simulés
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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
      ) : (detailTab === "leaderboard" || detailTab === "participants") ? (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-150 overflow-hidden shadow-xs">
            <div className="bg-gray-50/50 px-4 py-3.5 border-b border-gray-150 flex items-center justify-between">
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
              <div className="p-4 space-y-3">
                {[...participants]
                  .sort((a, b) => {
                    const predictionsA = a.user_id === userId ? picks : (a.predictions || {});
                    const predictionsB = b.user_id === userId ? picks : (b.predictions || {});
                    const ptsA = (testMode && simulatedResults)
                      ? calculateBracketPoints(sanitizePredictions(predictionsA, dynamicR32Matches), sanitizePredictions(simulatedResults, dynamicR32Matches))
                      : (a.points_awarded || 0);
                    const ptsB = (testMode && simulatedResults)
                      ? calculateBracketPoints(sanitizePredictions(predictionsB, dynamicR32Matches), sanitizePredictions(simulatedResults, dynamicR32Matches))
                      : (b.points_awarded || 0);
                    if (ptsA !== ptsB) return ptsB - ptsA;
                    return (b.profile_points || 0) - (a.profile_points || 0);
                  })
                  .map((p, index) => {
                    const isCurrentUser = p.user_id === userId;
                    const isLast = index === participants.length - 1 && participants.length > 1;
                    const rank = index + 1;
                    
                    const pPicks = isCurrentUser ? picks : (p.predictions || {});
                    const r16C = Object.keys(pPicks.r16 || {}).filter(k => pPicks.r16[k]).length;
                    const r8C = Object.keys(pPicks.r8 || {}).filter(k => pPicks.r8[k]).length;
                    const r4C = Object.keys(pPicks.r4 || {}).filter(k => pPicks.r4[k]).length;
                    const r2C = Object.keys(pPicks.r2 || {}).filter(k => pPicks.r2[k]).length;
                    const winC = pPicks.winner ? 1 : 0;
                    const totalC = r16C + r8C + r4C + r2C + winC;

                    const displayPoints = (testMode && simulatedResults)
                      ? calculateBracketPoints(sanitizePredictions(pPicks, dynamicR32Matches), sanitizePredictions(simulatedResults, dynamicR32Matches))
                      : (p.points_awarded || 0);
                    
                    return (
                      <div 
                        key={p.id || p.user_id} 
                        className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                          isCurrentUser 
                            ? "bg-emerald-50/50 border-emerald-300 shadow-sm" 
                            : index === 0 
                              ? "bg-yellow-50/20 border-yellow-100" 
                              : isLast 
                                ? "bg-pink-50/20 border-pink-100"
                                : "bg-white border-gray-100 hover:border-gray-200"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`w-6 text-center font-black text-xs ${index === 0 ? 'text-yellow-600' : 'text-gray-400'}`}>
                            {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`}
                          </span>
                          
                          <div className="w-8 h-8 flex items-center justify-center shrink-0">
                            {p.avatar_type === 'emoji' ? (
                              <span className="text-xl">{p.avatar_value === '🐷' ? '👽' : p.avatar_value}</span>
                            ) : (
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-inner" style={{ backgroundColor: p.avatar_value || '#3b82f6' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.38 3.46 16 2a8.86 8.86 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/></svg>
                              </div>
                            )}
                          </div>
                          
                          <div className="min-w-0">
                            <span className={`text-xs font-bold flex items-center gap-1.5 flex-wrap ${isCurrentUser ? "text-emerald-950 font-black" : "text-gray-800"}`}>
                              <span className="truncate">{p.username || "Joueur"}</span>
                              {isCurrentUser && (
                                <span className="font-black text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded shrink-0">Moi</span>
                              )}
                              
                              <div className="flex items-center gap-1 shrink-0">
                                {p.first_name && (
                                  <div className="w-3.5 h-3.5 bg-white rounded-full overflow-hidden border border-gray-100 flex items-center justify-center shadow-xs" title={p.first_name}>
                                    <img 
                                      src={getFlagUrl(p.first_name) || "https://flagcdn.com/w80/un.png"} 
                                      className="w-full h-full object-contain" 
                                      onError={(e) => { e.currentTarget.style.display='none' }}
                                    />
                                  </div>
                                )}
                                {p.last_name && (
                                  <div className="w-3.5 h-3.5 bg-white rounded-full overflow-hidden border border-gray-100 flex items-center justify-center shadow-xs" title={p.last_name}>
                                    <img 
                                      src={getFlagUrl(p.last_name) || "https://flagcdn.com/w80/un.png"} 
                                      className="w-full h-full object-contain" 
                                      onError={(e) => { e.currentTarget.style.display='none' }}
                                    />
                                  </div>
                                )}
                              </div>
                            </span>
                            <div className="text-[10px] text-gray-400 font-semibold mt-0.5">
                              {totalC}/31 pronostics complétés
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className="text-xs font-extrabold text-emerald-800 flex items-center gap-1">
                              <span>{displayPoints} pts</span>
                              {testMode && simulatedResults && (
                                <span className="text-[8px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-extrabold">Simulé</span>
                              )}
                            </div>
                            <div className="text-[9px] text-gray-400 font-bold">
                              Profil: {p.profile_points || 0} pts
                            </div>
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => setSelectedParticipant(p)}
                            className="bg-white hover:bg-gray-150 text-gray-750 border border-gray-200 font-black text-[11px] px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 shadow-xs"
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
