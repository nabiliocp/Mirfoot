import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const apiKeyFootball = process.env.API_FOOTBALL_KEY || "";

async function check() {
  if (!apiKeyFootball) return;
  for (const s of [2022, 2023]) {
    try {
      const res = await fetch(`https://v3.football.api-sports.io/fixtures?league=10&season=${s}`, {
        headers: { "x-apisports-key": apiKeyFootball }
      });
      const d: any = await res.json();
      const fixtures = d.response || [];
      const moroccoMatches = fixtures.filter((f: any) => 
        (f.teams.home.name.toLowerCase().includes("morocco") && f.teams.away.name.toLowerCase().includes("brazil")) ||
        (f.teams.home.name.toLowerCase().includes("brazil") && f.teams.away.name.toLowerCase().includes("morocco"))
      );
      console.log(`Morocco vs Brazil in season ${s}:`, moroccoMatches.length);
      moroccoMatches.forEach((f: any) => {
        console.log(`- Date: ${f.fixture.date}, ${f.teams.home.name} vs ${f.teams.away.name}`);
      });
    } catch (e) {
      console.error("Error:", e);
    }
  }
}

check();
