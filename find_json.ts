import fs from "fs";
import path from "path";

function scan(dir: string) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (f === "node_modules" || f === ".next" || f === "dist" || f === ".git") continue;
    const p = path.join(dir, f);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      scan(p);
    } else if (f.endsWith(".json")) {
      console.log(p, "size:", stat.size);
    }
  }
}

scan(".");
