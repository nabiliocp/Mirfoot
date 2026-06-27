import dotenv from "dotenv";
dotenv.config();

async function test() {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    console.error("API_FOOTBALL_KEY is missing");
    return;
  }
  const url = `https://v3.football.api-sports.io/fixtures?league=1&season=2026`;
  console.log("Fetching:", url);
  try {
    const res = await fetch(url, {
      headers: { "x-apisports-key": apiKey }
    });
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Errors:", data.errors);
    console.log("Results count:", data.results);
    if (data.response && data.response.length > 0) {
      console.log("Sample response:", JSON.stringify(data.response.slice(0, 1), null, 2));
    }
  } catch (err: any) {
    console.error("Failed:", err.message);
  }
}

test();
