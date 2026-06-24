import fs from 'fs';

async function test() {
  try {
    // Read the active api provider from api_config.json
    let activeApi = "football-data";
    if (fs.existsSync("./api_config.json")) {
      activeApi = JSON.parse(fs.readFileSync("./api_config.json", "utf-8")).active_api;
    }
    console.log("Current active API:", activeApi);
    console.log("API_FOOTBALL_KEY from env:", process.env.API_FOOTBALL_KEY ? "PRESENT" : "MISSING");
    console.log("FOOTBALL_DATA_API_KEY from env:", process.env.FOOTBALL_DATA_API_KEY ? "PRESENT" : "MISSING");

    // Call the server's endpoint directly by simulating req/res or fetching
    const compId = 2015; // Ligue 1 (football-data ID)
    const url = `http://localhost:3000/api/matches/${compId}`;
    console.log(`Fetching from server: ${url}`);
    const res = await fetch(url);
    console.log(`Response Status: ${res.status}`);
    const data = await res.json();
    console.log(`Response Keys:`, Object.keys(data));
    if (data.error) {
      console.log(`Error returned:`, data.error);
    } else {
      console.log(`Matches count returned:`, data.matches?.length);
      if (data.matches && data.matches.length > 0) {
        console.log(`Sample match:`, JSON.stringify(data.matches[0], null, 2));
      }
    }
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

test();
