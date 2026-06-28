import * as fs from 'fs';
import * as path from 'path';

function search() {
  const dir = process.cwd();
  const files = fs.readdirSync(dir);
  files.forEach(f => {
    const p = path.join(dir, f);
    if (fs.statSync(p).isFile() && (f.endsWith(".json") || f.endsWith(".ts") || f.endsWith(".js"))) {
      try {
        const content = fs.readFileSync(p, 'utf-8');
        if (content.toLowerCase().includes("algér") || content.toLowerCase().includes("suisse") || content.toLowerCase().includes("égypte") || content.toLowerCase().includes("egypte")) {
          console.log(`Found in: ${f}`);
        }
      } catch (e) {}
    }
  });
}
search();
