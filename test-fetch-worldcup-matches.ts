async function main() {
  try {
    const res = await fetch('http://localhost:3000/api/matches/2000');
    console.log("Status:", res.status);
    const data: any = await res.json();
    console.log("Matches count:", data.matches?.length);
    if (data.matches && data.matches.length > 0) {
      console.log("First match stage:", data.matches[0].stage);
      console.log("First match teams:", data.matches[0].homeTeam, "vs", data.matches[0].awayTeam);
      
      // Let's count stages
      const stages: Record<string, number> = {};
      data.matches.forEach((m: any) => {
        stages[m.stage] = (stages[m.stage] || 0) + 1;
      });
      console.log("Stages:", stages);
      
      // Filter for LAST_32 or ROUND_OF_32 or similar
      const r32 = data.matches.filter((m: any) => {
        const s = (m.stage || "").toUpperCase().replace(/ /g, "_");
        return s === "LAST_32" || s === "ROUND_OF_32" || s === "LAST_16" || s === "ROUND_OF_16" || s === "1ST_PHASE" || s === "8TH_FINALS";
      });
      console.log("R32 stage candidates count:", r32.length);
      if (r32.length > 0) {
        console.log("Sample candidates:");
        r32.slice(0, 10).forEach((m: any) => {
          console.log(`- ${m.id} (${m.stage}): ${m.homeTeam?.name} (${m.homeTeam?.tla}) vs ${m.awayTeam?.name} (${m.awayTeam?.tla})`);
        });
      }
    }
  } catch (err: any) {
    console.error("Error fetching 2000:", err.message);
  }
}
main();
