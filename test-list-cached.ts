import * as fs from 'fs';

async function main() {
  // Let's search for any cached files matching "2000" or similar
  const files = fs.readdirSync('.');
  const cachedFiles = files.filter(f => f.includes('cache') || f.includes('comp') || f.includes('9999') || f.includes('2000') || f.endsWith('.json'));
  console.log("JSON/Cached files:", cachedFiles);

  // Let's read api_config.json if it exists
  if (fs.existsSync('api_config.json')) {
    console.log("api_config.json:", fs.readFileSync('api_config.json', 'utf8'));
  }
}
main();
