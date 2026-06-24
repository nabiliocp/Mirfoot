export interface BracketTeam {
  id: string;
  name: string;
  flag: string;
}

export const BRACKET_TEAMS: Record<string, BracketTeam> = {
  GER: { id: "GER", name: "Allemagne", flag: "🇩🇪" },
  SCO: { id: "SCO", name: "Écosse", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  FRA: { id: "FRA", name: "France", flag: "🇫🇷" },
  SWE: { id: "SWE", name: "Suède", flag: "🇸🇪" },
  KOR: { id: "KOR", name: "Corée du Sud", flag: "🇰🇷" },
  SUI: { id: "SUI", name: "Suisse", flag: "🇨🇭" },
  NED: { id: "NED", name: "Pays-Bas", flag: "🇳🇱" },
  MAR: { id: "MAR", name: "Maroc", flag: "🇲🇦" },
  COL: { id: "COL", name: "Colombie", flag: "🇨🇴" },
  GHA: { id: "GHA", name: "Ghana", flag: "🇬🇭" },
  ESP: { id: "ESP", name: "Espagne", flag: "🇪🇸" },
  AUT: { id: "AUT", name: "Autriche", flag: "🇦🇹" },
  USA: { id: "USA", name: "États-Unis", flag: "🇺🇸" },
  ALG: { id: "ALG", name: "Algérie", flag: "🇩🇿" },
  EGY: { id: "EGY", name: "Égypte", flag: "🇪🇬" },
  CZE: { id: "CZE", name: "Rép. Tchèque", flag: "🇨🇿" },
  BRA: { id: "BRA", name: "Brésil", flag: "🇧🇷" },
  JPN: { id: "JPN", name: "Japon", flag: "🇯🇵" },
  CIV: { id: "CIV", name: "Côte d'Ivoire", flag: "🇨🇮" },
  NOR: { id: "NOR", name: "Norvège", flag: "🇳🇴" },
  MEX: { id: "MEX", name: "Mexique", flag: "🇲🇽" },
  CPV: { id: "CPV", name: "Cap-Vert", flag: "🇨🇻" },
  ENG: { id: "ENG", name: "Angleterre", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  COD: { id: "COD", name: "RDC Congo", flag: "🇨🇩" },
  ARG: { id: "ARG", name: "Argentine", flag: "🇦🇷" },
  URU: { id: "URU", name: "Uruguay", flag: "🇺🇾" },
  AUS: { id: "AUS", name: "Australie", flag: "🇦🇺" },
  IRN: { id: "IRN", name: "Iran", flag: "🇮🇷" },
  CAN: { id: "CAN", name: "Canada", flag: "🇨🇦" },
  BEL: { id: "BEL", name: "Belgique", flag: "🇧🇪" },
  POR: { id: "POR", name: "Portugal", flag: "🇵🇹" },
  PAR: { id: "PAR", name: "Paraguay", flag: "🇵🇾" },
};

export interface BracketMatch {
  id: string; // e.g. "R32_L1"
  homeId: string; // Team ID or empty (computed from previous round predictions)
  awayId: string;
  winnerId?: string; // Filled when selected/predicted
  matchTime?: string; // Optional real-world match start time to close predictions
}

export const BRACKET_MATCH_TIMES: Record<string, string> = {
  // R32
  "R32_L1": "2026-06-26T18:00:00Z",
  "R32_L2": "2026-06-26T21:00:00Z",
  "R32_L3": "2026-06-27T15:00:00Z",
  "R32_L4": "2026-06-27T18:00:00Z",
  "R32_L5": "2026-06-27T21:00:00Z",
  "R32_L6": "2026-06-28T15:00:00Z",
  "R32_L7": "2026-06-28T18:00:00Z",
  "R32_L8": "2026-06-28T21:00:00Z",
  "R32_R1": "2026-06-29T15:00:00Z",
  "R32_R2": "2026-06-29T18:00:00Z",
  "R32_R3": "2026-06-29T21:00:00Z",
  "R32_R4": "2026-06-30T15:00:00Z",
  "R32_R5": "2026-06-30T18:00:00Z",
  "R32_R6": "2026-06-30T21:00:00Z",
  "R32_R7": "2026-07-01T18:00:00Z",
  "R32_R8": "2026-07-01T21:00:00Z",
  // R16
  "R16_L1": "2026-07-03T18:00:00Z",
  "R16_L2": "2026-07-03T21:00:00Z",
  "R16_L3": "2026-07-04T18:00:00Z",
  "R16_L4": "2026-07-04T21:00:00Z",
  "R16_R1": "2026-07-05T18:00:00Z",
  "R16_R2": "2026-07-05T21:00:00Z",
  "R16_R3": "2026-07-06T18:00:00Z",
  "R16_R4": "2026-07-06T21:00:00Z",
  // R8 (Quarterfinals)
  "R8_L1": "2026-07-08T18:00:00Z",
  "R8_L2": "2026-07-08T21:00:00Z",
  "R8_R1": "2026-07-09T18:00:00Z",
  "R8_R2": "2026-07-09T21:00:00Z",
  // R4 (Semifinals)
  "R4_L1": "2026-07-11T20:00:00Z",
  "R4_R1": "2026-07-12T20:00:00Z",
  // R2 (Final)
  "R2_F1": "2026-07-15T20:00:00Z",
};

export const isBracketMatchStarted = (matchId: string): boolean => {
  const kickOffStr = BRACKET_MATCH_TIMES[matchId];
  if (!kickOffStr) return false;
  return new Date().getTime() >= new Date(kickOffStr).getTime();
};

export const STARTING_R32_MATCHES: BracketMatch[] = [
  // Left Bracket
  { id: "R32_L1", homeId: "GER", awayId: "SCO", matchTime: BRACKET_MATCH_TIMES["R32_L1"] },
  { id: "R32_L2", homeId: "FRA", awayId: "SWE", matchTime: BRACKET_MATCH_TIMES["R32_L2"] },
  { id: "R32_L3", homeId: "KOR", awayId: "SUI", matchTime: BRACKET_MATCH_TIMES["R32_L3"] },
  { id: "R32_L4", homeId: "NED", awayId: "MAR", matchTime: BRACKET_MATCH_TIMES["R32_L4"] },
  { id: "R32_L5", homeId: "COL", awayId: "GHA", matchTime: BRACKET_MATCH_TIMES["R32_L5"] },
  { id: "R32_L6", homeId: "ESP", awayId: "AUT", matchTime: BRACKET_MATCH_TIMES["R32_L6"] },
  { id: "R32_L7", homeId: "USA", awayId: "ALG", matchTime: BRACKET_MATCH_TIMES["R32_L7"] },
  { id: "R32_L8", homeId: "EGY", awayId: "CZE", matchTime: BRACKET_MATCH_TIMES["R32_L8"] },
  // Right Bracket
  { id: "R32_R1", homeId: "BRA", awayId: "JPN", matchTime: BRACKET_MATCH_TIMES["R32_R1"] },
  { id: "R32_R2", homeId: "CIV", awayId: "NOR", matchTime: BRACKET_MATCH_TIMES["R32_R2"] },
  { id: "R32_R3", homeId: "MEX", awayId: "CPV", matchTime: BRACKET_MATCH_TIMES["R32_R3"] },
  { id: "R32_R4", homeId: "ENG", awayId: "COD", matchTime: BRACKET_MATCH_TIMES["R32_R4"] },
  { id: "R32_R5", homeId: "ARG", awayId: "URU", matchTime: BRACKET_MATCH_TIMES["R32_R5"] },
  { id: "R32_R6", homeId: "AUS", awayId: "IRN", matchTime: BRACKET_MATCH_TIMES["R32_R6"] },
  { id: "R32_R7", homeId: "CAN", awayId: "BEL", matchTime: BRACKET_MATCH_TIMES["R32_R7"] },
  { id: "R32_R8", homeId: "POR", awayId: "PAR", matchTime: BRACKET_MATCH_TIMES["R32_R8"] },
];

export interface BracketPredictions {
  r16: Record<string, string>; // e.g. "R16_L1_H" -> "GER", "R16_L1_A" -> "FRA", etc.
  r8: Record<string, string>;  // e.g. "R8_L1_H" -> "GER", etc.
  r4: Record<string, string>;  // e.g. "R4_L1_H" -> "GER", etc.
  r2: Record<string, string>;  // e.g. "R2_L1_H" -> "GER", etc.
  winner: string;              // e.g. "GER"
}

export const createEmptyBracketPredictions = (): BracketPredictions => ({
  r16: {},
  r8: {},
  r4: {},
  r2: {},
  winner: "",
});

/**
 * Calculates the complete state of the bracket based on Round of 32 starting matches
 * and the user's prediction / pick inputs.
 */
export function computeBracketState(picks: BracketPredictions) {
  // Round of 16 Matches (8 matches)
  const r16Matches = [
    { id: "R16_L1", homeId: picks.r16["R16_L1_H"] || "", awayId: picks.r16["R16_L1_A"] || "" },
    { id: "R16_L2", homeId: picks.r16["R16_L2_H"] || "", awayId: picks.r16["R16_L2_A"] || "" },
    { id: "R16_L3", homeId: picks.r16["R16_L3_H"] || "", awayId: picks.r16["R16_L3_A"] || "" },
    { id: "R16_L4", homeId: picks.r16["R16_L4_H"] || "", awayId: picks.r16["R16_L4_A"] || "" },
    { id: "R16_R1", homeId: picks.r16["R16_R1_H"] || "", awayId: picks.r16["R16_R1_A"] || "" },
    { id: "R16_R2", homeId: picks.r16["R16_R2_H"] || "", awayId: picks.r16["R16_R2_A"] || "" },
    { id: "R16_R3", homeId: picks.r16["R16_R3_H"] || "", awayId: picks.r16["R16_R3_A"] || "" },
    { id: "R16_R4", homeId: picks.r16["R16_R4_H"] || "", awayId: picks.r16["R16_R4_A"] || "" },
  ];

  // Quarter-final Matches (4 matches)
  const r8Matches = [
    { id: "R8_L1", homeId: picks.r8["R8_L1_H"] || "", awayId: picks.r8["R8_L1_A"] || "" },
    { id: "R8_L2", homeId: picks.r8["R8_L2_H"] || "", awayId: picks.r8["R8_L2_A"] || "" },
    { id: "R8_R1", homeId: picks.r8["R8_R1_H"] || "", awayId: picks.r8["R8_R1_A"] || "" },
    { id: "R8_R2", homeId: picks.r8["R8_R2_H"] || "", awayId: picks.r8["R8_R2_A"] || "" },
  ];

  // Semi-final Matches (2 matches)
  const r4Matches = [
    { id: "R4_L1", homeId: picks.r4["R4_L1_H"] || "", awayId: picks.r4["R4_L1_A"] || "" },
    { id: "R4_R1", homeId: picks.r4["R4_R1_H"] || "", awayId: picks.r4["R4_R1_A"] || "" },
  ];

  // Grand Final Match (1 match)
  const finalMatch = {
    id: "R2_F1",
    homeId: picks.r2["R2_L1_H"] || "",
    awayId: picks.r2["R2_L1_A"] || "",
  };

  return {
    r16Matches,
    r8Matches,
    r4Matches,
    finalMatch,
  };
}

/**
 * Calculates bracket score points for a given user prediction against the actual results.
 */
export function calculateBracketPoints(userPicks: BracketPredictions, actualResults: BracketPredictions): number {
  if (!actualResults || !userPicks) return 0;

  let points = 0;

  // 1. Round of 32 to Round of 16 qualification: 100 points per correct qualified team
  // There are up to 16 teams qualifying to R16. They are represented by the keys in actualResults.r16
  const actualR16Teams = Object.values(actualResults.r16).filter(id => id);
  const userR16Teams = Object.values(userPicks.r16).filter(id => id);
  actualR16Teams.forEach(teamId => {
    if (userR16Teams.includes(teamId)) {
      points += 100;
    }
  });

  // 2. Round of 16 to Quarter-finals qualification: 200 points per correct qualified team
  const actualR8Teams = Object.values(actualResults.r8).filter(id => id);
  const userR8Teams = Object.values(userPicks.r8).filter(id => id);
  actualR8Teams.forEach(teamId => {
    if (userR8Teams.includes(teamId)) {
      points += 200;
    }
  });

  // 3. Quarter-finals to Semis qualification: 300 points per correct qualified team
  const actualR4Teams = Object.values(actualResults.r4).filter(id => id);
  const userR4Teams = Object.values(userPicks.r4).filter(id => id);
  actualR4Teams.forEach(teamId => {
    if (userR4Teams.includes(teamId)) {
      points += 300;
    }
  });

  // 4. Semis to Final qualification: 400 points per correct qualified team
  const actualR2Teams = Object.values(actualResults.r2).filter(id => id);
  const userR2Teams = Object.values(userPicks.r2).filter(id => id);
  actualR2Teams.forEach(teamId => {
    if (userR2Teams.includes(teamId)) {
      points += 400;
    }
  });

  // 5. Bonus: Guessing all 4 Semifinalists correctly -> 1000 bonus points
  const correctR4Count = actualR4Teams.filter(teamId => userR4Teams.includes(teamId)).length;
  if (correctR4Count === 4 && actualR4Teams.length === 4) {
    points += 1000;
  }

  // 6. Bonus: Guessing the 2 exact finalists correctly -> 2000 bonus points
  const correctR2Count = actualR2Teams.filter(teamId => userR2Teams.includes(teamId)).length;
  if (correctR2Count === 2 && actualR2Teams.length === 2) {
    points += 2000;
  }

  // 7. Bonus: Guessing the exact winner correctly -> 2000 points
  if (actualResults.winner && userPicks.winner === actualResults.winner) {
    points += 2000;
  }

  return points;
}

export function generateRandomBracketPicks(): BracketPredictions {
  const picks = createEmptyBracketPredictions();

  // Helper to pick randomly from two options
  const pickRandom = (teamA: string, teamB: string) => (Math.random() < 0.5 ? teamA : teamB);

  // 1. R32 to R16
  picks.r16["R16_L1_H"] = pickRandom("GER", "SCO");
  picks.r16["R16_L1_A"] = pickRandom("FRA", "SWE");
  picks.r16["R16_L2_H"] = pickRandom("KOR", "SUI");
  picks.r16["R16_L2_A"] = pickRandom("NED", "MAR");
  picks.r16["R16_L3_H"] = pickRandom("COL", "GHA");
  picks.r16["R16_L3_A"] = pickRandom("ESP", "AUT");
  picks.r16["R16_L4_H"] = pickRandom("USA", "ALG");
  picks.r16["R16_L4_A"] = pickRandom("EGY", "CZE");

  picks.r16["R16_R1_H"] = pickRandom("BRA", "JPN");
  picks.r16["R16_R1_A"] = pickRandom("CIV", "NOR");
  picks.r16["R16_R2_H"] = pickRandom("MEX", "CPV");
  picks.r16["R16_R2_A"] = pickRandom("ENG", "COD");
  picks.r16["R16_R3_H"] = pickRandom("ARG", "URU");
  picks.r16["R16_R3_A"] = pickRandom("AUS", "IRN");
  picks.r16["R16_R4_H"] = pickRandom("CAN", "BEL");
  picks.r16["R16_R4_A"] = pickRandom("POR", "PAR");

  // 2. R16 to R8
  picks.r8["R8_L1_H"] = pickRandom(picks.r16["R16_L1_H"] || "GER", picks.r16["R16_L1_A"] || "FRA");
  picks.r8["R8_L1_A"] = pickRandom(picks.r16["R16_L2_H"] || "KOR", picks.r16["R16_L2_A"] || "NED");
  picks.r8["R8_L2_H"] = pickRandom(picks.r16["R16_L3_H"] || "COL", picks.r16["R16_L3_A"] || "ESP");
  picks.r8["R8_L2_A"] = pickRandom(picks.r16["R16_L4_H"] || "USA", picks.r16["R16_L4_A"] || "EGY");

  picks.r8["R8_R1_H"] = pickRandom(picks.r16["R16_R1_H"] || "BRA", picks.r16["R16_R1_A"] || "CIV");
  picks.r8["R8_R1_A"] = pickRandom(picks.r16["R16_R2_H"] || "MEX", picks.r16["R16_R2_A"] || "ENG");
  picks.r8["R8_R2_H"] = pickRandom(picks.r16["R16_R3_H"] || "ARG", picks.r16["R16_R3_A"] || "AUS");
  picks.r8["R8_R2_A"] = pickRandom(picks.r16["R16_R4_H"] || "CAN", picks.r16["R16_R4_A"] || "POR");

  // 3. R8 to R4
  picks.r4["R4_L1_H"] = pickRandom(picks.r8["R8_L1_H"] || "GER", picks.r8["R8_L1_A"] || "KOR");
  picks.r4["R4_L1_A"] = pickRandom(picks.r8["R8_L2_H"] || "COL", picks.r8["R8_L2_A"] || "USA");
  picks.r4["R4_R1_H"] = pickRandom(picks.r8["R8_R1_H"] || "BRA", picks.r8["R8_R1_A"] || "MEX");
  picks.r4["R4_R1_A"] = pickRandom(picks.r8["R8_R2_H"] || "ARG", picks.r8["R8_R2_A"] || "CAN");

  // 4. R4 to R2
  picks.r2["R2_L1_H"] = pickRandom(picks.r4["R4_L1_H"] || "GER", picks.r4["R4_L1_A"] || "COL");
  picks.r2["R2_L1_A"] = pickRandom(picks.r4["R4_R1_H"] || "BRA", picks.r4["R4_R1_A"] || "ARG");

  // 5. R2 to Winner
  picks.winner = pickRandom(picks.r2["R2_L1_H"] || "GER", picks.r2["R2_L1_A"] || "BRA");

  return picks;
}

