import fs from 'fs';

async function testFetch() {
  try {
    const res = await fetch("http://localhost:3000/api/matches/2000");
    if (!res.ok) {
      console.error("HTTP error:", res.status);
      return;
    }
    const data: any = await res.json();
    console.log("Total matches count from API:", data.matches?.length);
    const r32 = (data.matches || []).filter((m: any) => {
      const s = (m.stage || "").toUpperCase().replace(/ /g, "_");
      return s === "LAST_32" || s === "ROUND_OF_32" || s === "LAST_16" || s === "ROUND_OF_16" || s === "1ST_PHASE" || s === "8TH_FINALS";
    });
    console.log("R32 matches count:", r32.length);
    r32.forEach((m: any, idx: number) => {
      console.log(`${idx}: [${m.stage}] id=${m.id} ${m.homeTeam?.name} (${m.homeTeam?.tla || m.homeTeam?.id}) vs ${m.awayTeam?.name} (${m.awayTeam?.tla || m.awayTeam?.id})`);
    });
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

testFetch();
