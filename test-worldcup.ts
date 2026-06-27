import * as fs from "fs";

function test() {
  if (fs.existsSync("./wc2026.json")) {
    const data = JSON.parse(fs.readFileSync("./wc2026.json", "utf-8"));
    console.log("wc2026.json matches count:", data.matches?.length);
    const sample = data.matches?.slice(0, 2);
    console.log("wc2026.json sample:", JSON.stringify(sample, null, 2));
    
    // Find Croatia vs Ghana match in wc2026.json
    const croGhana = data.matches?.find((m: any) => 
      (m.homeTeam?.name?.toLowerCase().includes("croat") && m.awayTeam?.name?.toLowerCase().includes("ghan")) ||
      (m.awayTeam?.name?.toLowerCase().includes("croat") && m.homeTeam?.name?.toLowerCase().includes("ghan"))
    );
    console.log("Croatia vs Ghana match in wc2026.json:", JSON.stringify(croGhana, null, 2));
  } else {
    console.log("wc2026.json does not exist");
  }

  if (fs.existsSync("./wc_fd.json")) {
    const data = JSON.parse(fs.readFileSync("./wc_fd.json", "utf-8"));
    console.log("wc_fd.json matches count:", data.matches?.length);
  } else {
    console.log("wc_fd.json does not exist");
  }
}

test();
