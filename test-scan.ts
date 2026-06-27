import * as fs from "fs";
import * as path from "path";

function scan(dir: string) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (f !== "node_modules" && f !== ".git") {
        scan(full);
      }
    } else {
      if (f.includes("2000") || f.includes("wc") || f.includes("cache")) {
        console.log("Found:", full);
      }
    }
  }
}

scan(process.cwd());
