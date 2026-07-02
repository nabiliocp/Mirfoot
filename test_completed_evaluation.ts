import fetch from "node-fetch";

// Replicate isChallengeCompleted logic
function isChallengeCompleted(challenge: any, allMatchesByComp: any) {
  if (challenge.resolved) return { completed: true, reason: "challenge.resolved is true" };
  
  if (challenge.type === "bracket") {
    return { completed: false, reason: "type is bracket" };
  }
  
  const compMatches = allMatchesByComp[String(challenge.competitionId)];
  if (compMatches && compMatches.length > 0) {
    if (Number(challenge.matchId) !== 0) {
      // Single match challenge
      const m = compMatches.find((x: any) => String(x.id) === String(challenge.matchId));
      if (m) {
        const completed = ["FINISHED", "AWARDED"].includes(m.status);
        return { completed, reason: `single match status is ${m.status}` };
      } else {
        return { completed: false, reason: `single match with id ${challenge.matchId} not found in matches` };
      }
    } else {
      // Competition challenge - finished if all matches are finished, or no matches are left to play (non-finished)
      const pendingMatches = compMatches.filter((m: any) => !["FINISHED", "AWARDED", "CANCELLED", "POSTPONED"].includes(m.status));
      const completed = pendingMatches.length === 0;
      return { completed, reason: `competition challenge has ${pendingMatches.length} pending matches left` };
    }
  }
  
  // Fallback: If matchDate is in the past by more than 1 day for a single match
  if (challenge.matchId !== 0 && challenge.matchDate) {
    const matchTime = new Date(challenge.matchDate).getTime();
    const oneDay = 24 * 60 * 60 * 1000;
    if (Date.now() - matchTime > oneDay) {
      return { completed: true, reason: "fallback: match date is older than 1 day" };
    }
  }
  
  return { completed: false, reason: "default fallback" };
}

async function test() {
  try {
    const userId = "1d5a780d-ea38-41a4-859b-14e648031930";
    const chalRes = await fetch(`http://localhost:3000/api/challenges/user/${userId}`);
    const chalData = await chalRes.json();
    const challenges = chalData.challenges || [];
    
    console.log(`Fetched ${challenges.length} challenges for Nabil`);
    
    // Fetch matches for each unique competition
    const compIds = Array.from(new Set(challenges.map((c: any) => String(c.competition_id))));
    const allMatchesByComp: any = {};
    for (const compId of compIds) {
      const matchRes = await fetch(`http://localhost:3000/api/matches/${compId}`);
      if (matchRes.ok) {
        const matchData = await matchRes.json();
        allMatchesByComp[compId] = matchData.matches || [];
        console.log(`Competition ${compId} matches fetched:`, allMatchesByComp[compId].length);
      } else {
        console.log(`Failed to fetch matches for competition ${compId}`);
      }
    }
    
    challenges.forEach((c: any) => {
      const res = isChallengeCompleted(c, allMatchesByComp);
      console.log(`- Challenge: "${c.title}" (ID: ${c.id})`);
      console.log(`  Type: ${c.type}, CompID: ${c.competition_id}, MatchID: ${c.match_id}, Resolved: ${c.resolved}`);
      console.log(`  Completed evaluation: ${res.completed} (${res.reason})`);
    });
  } catch (err) {
    console.error("Test error:", err);
  }
}

test();
