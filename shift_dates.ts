import fs from 'fs';
const data = JSON.parse(fs.readFileSync('world_cup_fallback.json', 'utf8'));
const start = new Date("2026-06-25T18:00:00Z").getTime();
data.matches.forEach((m: any, i: number) => {
  if (m.status === 'TIMED' || m.status === 'SCHEDULED') {
    // shift remaining matches to be in the future
    // let's distribute them from June 27 to July 19
    const matchDate = new Date(start + i * 24 * 60 * 60 * 1000);
    m.utcDate = matchDate.toISOString();
  }
});
fs.writeFileSync('world_cup_fallback.json', JSON.stringify(data, null, 2));
console.log("Updated world_cup_fallback.json dates");
