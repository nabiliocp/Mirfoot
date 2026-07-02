import fs from "fs";

async function run() {
  const file = "cached_comp_2018_api_football_current.json";
  if (fs.existsSync(file)) {
    const data = JSON.parse(fs.readFileSync(file, "utf-8"));
    const matches = data.matches || [];
    console.log("Number of matches in cached 2018:", matches.length);
    if (matches.length > 0) {
      console.log("Sample 2018 match IDs:", matches.slice(0, 10).map((m: any) => m.id));
    }
  } else {
    console.log("cached_comp_2018_api_football_current.json does not exist");
  }
}

run();
