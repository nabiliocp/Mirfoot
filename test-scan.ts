import fs from 'fs';
import path from 'path';

const files = fs.readdirSync('.');
const cachedFiles = files.filter(f => f.startsWith('cached_comp_'));
console.log("Cached files:", cachedFiles);

cachedFiles.forEach(f => {
  try {
    const data = JSON.parse(fs.readFileSync(f, 'utf8'));
    console.log(`File: ${f}, matches count: ${data.matches ? data.matches.length : 0}`);
    if (f.includes('2000')) {
      const r32 = (data.matches || []).filter((m: any) => {
        const s = (m.stage || "").toUpperCase().replace(/ /g, "_");
        return s === "LAST_32" || s === "ROUND_OF_32" || s === "LAST_16" || s === "ROUND_OF_16" || s === "1ST_PHASE" || s === "8TH_FINALS";
      });
      console.log(`- R32 matches: ${r32.length}`);
      r32.forEach((m: any, idx: number) => {
        console.log(`  ${idx}: [${m.stage}] id=${m.id} ${m.homeTeam?.name} (${m.homeTeam?.tla}) vs ${m.awayTeam?.name} (${m.awayTeam?.tla})`);
      });
    }
  } catch (e) {
    console.error("Error reading", f, e);
  }
});
