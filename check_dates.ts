import fs from 'fs';
const matches = JSON.parse(fs.readFileSync('world_cup_fallback.json', 'utf8')).matches;
matches.forEach((m: any) => console.log(m.utcDate, m.status));
