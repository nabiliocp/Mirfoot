import fs from 'fs';

// Let's mock isChallengeCompleted logic
const allMatchesByComp: Record<string, any[]> = {};

// Load 2000 matches
const filePath = 'world_cup_fallback.json';
const fallbackData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
allMatchesByComp["2000"] = fallbackData.matches || [];

// Let's add other comps (e.g. 679, 9999 are empty/undefined)
allMatchesByComp["679"] = [];
allMatchesByComp["9999"] = [];

const challenges = [
  { id: "78020725", title: "Meknes 🐽 2026", competitionId: 2000, matchId: 0, resolved: false },
  { id: "cdc68308", title: "World cup 2026 familly ", competitionId: 2000, matchId: 0, resolved: false },
  { id: "34870150", title: "Défi: Morocco vs Norway", competitionId: 679, matchId: 1540950, resolved: true },
  { id: "5b4f94e0", title: "Phase Éliminatoire - Le véritable 🐖", competitionId: 9999, matchId: 999999, resolved: false },
  { id: "f39a2118", title: "Phase eliminatoire familly", competitionId: 9999, matchId: 999999, resolved: false },
  { id: "ae6fbd7c", title: "Abdou defi wc 2026", competitionId: 2000, matchId: 0, resolved: false },
  { id: "c66478c7", title: "Halloufa WC26 🐗 Saison 2 ", competitionId: 2000, matchId: 0, resolved: false }
];

const isChallengeCompleted = (challenge: any) => {
  if (challenge.resolved) return true;
  
  // Check if we have the matches loaded for this competition
  const compMatches = allMatchesByComp[String(challenge.competitionId)];
  if (compMatches && compMatches.length > 0) {
    if (Number(challenge.matchId) !== 0) {
      // Single match challenge
      const m = compMatches.find((x) => String(x.id) === String(challenge.matchId));
      if (m) {
        return ["FINISHED", "AWARDED"].includes(m.status);
      }
    } else {
      // Competition challenge (tournament, e.g. EURO or World Cup)
      // Check if ALL matches of the competition are finished
      const allFinished = compMatches.every((m: any) => ["FINISHED", "AWARDED"].includes(m.status));
      return allFinished;
    }
  }
  return false;
};

challenges.forEach(c => {
  console.log(`Title: "${c.title}" -> isCompleted: ${isChallengeCompleted(c)}`);
});
