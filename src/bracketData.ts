export interface BracketTeam {
  id: string;
  name: string;
  flag: string;
}

export const BRACKET_TEAMS: Record<string, BracketTeam> = {
  ECU: { id: 'ECU', name: 'Équateur', flag: '🇪🇨' },
  RSA: { id: 'RSA', name: 'Afrique du Sud', flag: '🇿🇦' },
  CRO: { id: 'CRO', name: 'Croatie', flag: '🇭🇷' },
  BIH: { id: 'BIH', name: 'Bosnie-Herzégovine', flag: '🇧🇦' },
  SEN: { id: 'SEN', name: 'Sénégal', flag: '🇸🇳' },
  GER: { id: 'GER', name: 'Allemagne', flag: '🇩🇪' },
  SCO: { id: 'SCO', name: 'Écosse', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  FRA: { id: 'FRA', name: 'France', flag: '🇫🇷' },
  SWE: { id: 'SWE', name: 'Suède', flag: '🇸🇪' },
  KOR: { id: 'KOR', name: 'Corée du Sud', flag: '🇰🇷' },
  SUI: { id: 'SUI', name: 'Suisse', flag: '🇨🇭' },
  NED: { id: 'NED', name: 'Pays-Bas', flag: '🇳🇱' },
  MAR: { id: 'MAR', name: 'Maroc', flag: '🇲🇦' },
  COL: { id: 'COL', name: 'Colombie', flag: '🇨🇴' },
  GHA: { id: 'GHA', name: 'Ghana', flag: '🇬🇭' },
  ESP: { id: 'ESP', name: 'Espagne', flag: '🇪🇸' },
  AUT: { id: 'AUT', name: 'Autriche', flag: '🇦🇹' },
  USA: { id: 'USA', name: 'États-Unis', flag: '🇺🇸' },
  ALG: { id: 'ALG', name: 'Algérie', flag: '🇩🇿' },
  EGY: { id: 'EGY', name: 'Égypte', flag: '🇪🇬' },
  CZE: { id: 'CZE', name: 'Rép. Tchèque', flag: '🇨🇿' },
  BRA: { id: 'BRA', name: 'Brésil', flag: '🇧🇷' },
  JPN: { id: 'JPN', name: 'Japon', flag: '🇯🇵' },
  CIV: { id: 'CIV', name: "Côte d'Ivoire", flag: '🇨🇮' },
  NOR: { id: 'NOR', name: 'Norvège', flag: '🇳🇴' },
  MEX: { id: 'MEX', name: 'Mexique', flag: '🇲🇽' },
  CPV: { id: 'CPV', name: 'Cap-Vert', flag: '🇨🇻' },
  ENG: { id: 'ENG', name: 'Angleterre', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  COD: { id: 'COD', name: 'RDC Congo', flag: '🇨🇩' },
  ARG: { id: 'ARG', name: 'Argentine', flag: '🇦🇷' },
  URU: { id: 'URU', name: 'Uruguay', flag: '🇺🇾' },
  AUS: { id: 'AUS', name: 'Australie', flag: '🇦🇺' },
  NZL: { id: 'NZL', name: 'Nouvelle-Zélande', flag: '🇳🇿' },
  IRN: { id: 'IRN', name: 'Iran', flag: '🇮🇷' },
  CAN: { id: 'CAN', name: 'Canada', flag: '🇨🇦' },
  BEL: { id: 'BEL', name: 'Belgique', flag: '🇧🇪' },
  POR: { id: 'POR', name: 'Portugal', flag: '🇵🇹' },
  PAR: { id: 'PAR', name: 'Paraguay', flag: '🇵🇾' },
  '1A': { id: '1A', name: '1er Groupe A', flag: '❓' },
  '2A': { id: '2A', name: '2e Groupe A', flag: '❓' },
  '1B': { id: '1B', name: '1er Groupe B', flag: '❓' },
  '2B': { id: '2B', name: '2e Groupe B', flag: '❓' },
  '1C': { id: '1C', name: '1er Groupe C', flag: '❓' },
  '2C': { id: '2C', name: '2e Groupe C', flag: '❓' },
  '1D': { id: '1D', name: '1er Groupe D', flag: '❓' },
  '2D': { id: '2D', name: '2e Groupe D', flag: '❓' },
  '1E': { id: '1E', name: '1er Groupe E', flag: '❓' },
  '2E': { id: '2E', name: '2e Groupe E', flag: '❓' },
  '1F': { id: '1F', name: '1er Groupe F', flag: '❓' },
  '2F': { id: '2F', name: '2e Groupe F', flag: '❓' },
  '1G': { id: '1G', name: '1er Groupe G', flag: '❓' },
  '2G': { id: '2G', name: '2e Groupe G', flag: '❓' },
  '1H': { id: '1H', name: '1er Groupe H', flag: '❓' },
  '2H': { id: '2H', name: '2e Groupe H', flag: '❓' },
  '1I': { id: '1I', name: '1er Groupe I', flag: '❓' },
  '2I': { id: '2I', name: '2e Groupe I', flag: '❓' },
  '1J': { id: '1J', name: '1er Groupe J', flag: '❓' },
  '2J': { id: '2J', name: '2e Groupe J', flag: '❓' },
  '1K': { id: '1K', name: '1er Groupe K', flag: '❓' },
  '2K': { id: '2K', name: '2e Groupe K', flag: '❓' },
  '1L': { id: '1L', name: '1er Groupe L', flag: '❓' },
  '2L': { id: '2L', name: '2e Groupe L', flag: '❓' },
  '3rd1': { id: '3rd1', name: 'Meilleur 3e (1)', flag: '❓' },
  '3rd2': { id: '3rd2', name: 'Meilleur 3e (2)', flag: '❓' },
  '3rd3': { id: '3rd3', name: 'Meilleur 3e (3)', flag: '❓' },
  '3rd4': { id: '3rd4', name: 'Meilleur 3e (4)', flag: '❓' },
  '3rd5': { id: '3rd5', name: 'Meilleur 3e (5)', flag: '❓' },
  '3rd6': { id: '3rd6', name: 'Meilleur 3e (6)', flag: '❓' },
  '3rd7': { id: '3rd7', name: 'Meilleur 3e (7)', flag: '❓' },
  '3rd8': { id: '3rd8', name: 'Meilleur 3e (8)', flag: '❓' },
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
  "R32_L1": "2026-06-29T18:00:00Z",
  "R32_L2": "2026-06-30T21:00:00Z",
  "R32_L3": "2026-07-01T15:00:00Z",
  "R32_L4": "2026-07-01T18:00:00Z",
  "R32_L5": "2026-07-04T21:00:00Z",
  "R32_L6": "2026-07-03T15:00:00Z",
  "R32_L7": "2026-07-03T18:00:00Z",
  "R32_L8": "2026-07-04T21:00:00Z",
  "R32_R1": "2026-06-29T15:00:00Z",
  "R32_R2": "2026-07-01T21:00:00Z",
  "R32_R3": "2026-06-28T18:00:00Z",
  "R32_R4": "2026-06-30T15:00:00Z",
  "R32_R5": "2026-07-06T18:00:00Z",
  "R32_R6": "2026-07-02T15:00:00Z",
  "R32_R7": "2026-07-02T21:00:00Z",
  "R32_R8": "2026-07-01T18:00:00Z",
  // R16
  "R16_L1": "2026-07-05T18:00:00Z",
  "R16_L2": "2026-07-06T21:00:00Z",
  "R16_L3": "2026-07-07T18:00:00Z",
  "R16_L4": "2026-07-07T21:00:00Z",
  "R16_R1": "2026-07-05T21:00:00Z",
  "R16_R2": "2026-07-04T18:00:00Z",
  "R16_R3": "2026-07-06T18:00:00Z",
  "R16_R4": "2026-07-07T21:00:00Z",
  // R8 (Quarterfinals)
  "R8_L1": "2026-07-12T18:00:00Z",
  "R8_L2": "2026-07-12T21:00:00Z",
  "R8_R1": "2026-07-09T18:00:00Z",
  "R8_R2": "2026-07-10T21:00:00Z",
  // R4 (Semifinals)
  "R4_L1": "2026-07-15T20:00:00Z",
  "R4_R1": "2026-07-14T20:00:00Z",
  // R2 (Final)
  "R2_F1": "2026-07-19T20:00:00Z",
};

export const isBracketMatchStarted = (matchId: string): boolean => {
  const kickOffStr = BRACKET_MATCH_TIMES[matchId];
  if (!kickOffStr) return false;
  return new Date().getTime() >= new Date(kickOffStr).getTime();
};

export const STARTING_R32_MATCHES: BracketMatch[] = [
  // Left Bracket (L1 to L8)
  { id: 'R32_L1', homeId: 'BRA', awayId: 'JPN', matchTime: BRACKET_MATCH_TIMES['R32_L1'] },
  { id: 'R32_L2', homeId: 'CIV', awayId: 'NOR', matchTime: BRACKET_MATCH_TIMES['R32_L2'] },
  { id: 'R32_L3', homeId: 'MEX', awayId: 'ECU', matchTime: BRACKET_MATCH_TIMES['R32_L3'] },
  { id: 'R32_L4', homeId: 'ENG', awayId: 'COD', matchTime: BRACKET_MATCH_TIMES['R32_L4'] },
  { id: 'R32_L5', homeId: 'ARG', awayId: 'CPV', matchTime: BRACKET_MATCH_TIMES['R32_L5'] },
  { id: 'R32_L6', homeId: 'NZL', awayId: 'EGY', matchTime: BRACKET_MATCH_TIMES['R32_L6'] },
  { id: 'R32_L7', homeId: 'SUI', awayId: 'ALG', matchTime: BRACKET_MATCH_TIMES['R32_L7'] },
  { id: 'R32_L8', homeId: 'COL', awayId: 'GHA', matchTime: BRACKET_MATCH_TIMES['R32_L8'] },
  // Right Bracket (R1 to R8)
  { id: 'R32_R1', homeId: 'GER', awayId: 'PAR', matchTime: BRACKET_MATCH_TIMES['R32_R1'] },
  { id: 'R32_R2', homeId: 'FRA', awayId: 'SWE', matchTime: BRACKET_MATCH_TIMES['R32_R2'] },
  { id: 'R32_R3', homeId: 'RSA', awayId: 'CAN', matchTime: BRACKET_MATCH_TIMES['R32_R3'] },
  { id: 'R32_R4', homeId: 'NED', awayId: 'MAR', matchTime: BRACKET_MATCH_TIMES['R32_R4'] },
  { id: 'R32_R5', homeId: 'POR', awayId: 'CRO', matchTime: BRACKET_MATCH_TIMES['R32_R5'] },
  { id: 'R32_R6', homeId: 'ESP', awayId: 'AUT', matchTime: BRACKET_MATCH_TIMES['R32_R6'] },
  { id: 'R32_R7', homeId: 'USA', awayId: 'BIH', matchTime: BRACKET_MATCH_TIMES['R32_R7'] },
  { id: 'R32_R8', homeId: 'BEL', awayId: 'SEN', matchTime: BRACKET_MATCH_TIMES['R32_R8'] },
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




export const isPlaceholderTeam = (teamId: string): boolean => {
  return !teamId || teamId === '' || teamId.match(/^[12][A-L]$/) !== null || teamId.startsWith('3rd');
};
