import fs from 'fs';

async function test() {
  try {
    // Force active API to "api-football"
    fs.writeFileSync("./api_config.json", JSON.stringify({ active_api: "api-football" }), "utf-8");
    console.log("Forced active API to: api-football");

    const compId = 2015; // Ligue 1
    const url = `http://localhost:3000/api/matches/${compId}`;
    console.log(`Fetching from server using API-Football: ${url}`);
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
