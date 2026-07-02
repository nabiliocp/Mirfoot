import fs from "fs";
import path from "path";

// Search for 537327 in persistent caches
const cacheDir = "./cache";
if (fs.existsSync(cacheDir)) {
  const files = fs.readdirSync(cacheDir);
  console.log("Cached files found:", files);
  for (const f of files) {
    if (f.endsWith(".json")) {
      try {
        const content = fs.readFileSync(path.join(cacheDir, f), "utf-8");
        if (content.includes("537327")) {
          console.log(`Match 537327 found in cache file: ${f}`);
          const parsed = JSON.parse(content);
          const matches = parsed.matches || parsed.response || [];
          const match = matches.find((m: any) => String(m.id) === "537327" || String(m.fixture?.id) === "537327");
          console.log("Match sample from cache:", JSON.stringify(match, null, 2));
        }
      } catch (err) {}
    }
  }
} else {
  console.log("No cache directory found.");
}
