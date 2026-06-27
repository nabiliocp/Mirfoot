import fs from 'fs';

function adjustMatchesDynamically(matches: any[]): any[] {
  if (!Array.isArray(matches)) return [];
  const now = Date.now();
  return matches.map((m: any) => {
    if (!m) return m;
    const statusUpper = String(m.status || "").toUpperCase();
    const isScheduled = ["TIMED", "SCHEDULED"].includes(statusUpper);
    if (m.utcDate) {
      const matchTime = new Date(m.utcDate).getTime();
      if (!isNaN(matchTime)) {
        if (now >= matchTime) {
          if (isScheduled) {
            if (now - matchTime < 120 * 60 * 1000) {
              return { ...m, status: "IN_PLAY" };
            } else {
              return { ...m, status: "FINISHED" };
            }
          }
        }
      }
    }
    return m;
  });
}

const matches = JSON.parse(fs.readFileSync('world_cup_fallback.json', 'utf8')).matches;
const adjusted = adjustMatchesDynamically(matches);
const finishedCount = adjusted.filter(m => m.status === 'FINISHED').length;
console.log(`Total matches: ${adjusted.length}`);
console.log(`Finished matches: ${finishedCount}`);
