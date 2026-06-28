import * as fs from 'fs';
import * as path from 'path';

const files = fs.readdirSync(process.cwd()).filter(f => f.startsWith("cached_"));
console.log("Cached files:", files);
files.forEach(f => {
  try {
    const data = JSON.parse(fs.readFileSync(f, 'utf-8'));
    console.log(`- ${f}: ${Array.isArray(data.matches) ? data.matches.length : (data.data && Array.isArray(data.data.matches) ? data.data.matches.length : "unknown")} matches`);
  } catch (e) {
    console.error(`Error reading ${f}:`, e);
  }
});
