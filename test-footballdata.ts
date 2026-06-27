import dotenv from "dotenv";
dotenv.config();

async function test() {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    console.error("FOOTBALL_DATA_API_KEY is missing");
    return;
  }
  const url = `https://api.football-data.org/v4/competitions/2000/matches`;
  console.log("Fetching:", url);
  try {
    const res = await fetch(url, {
      headers: { "X-Auth-Token": apiKey }
    });
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response:", text);
  } catch (err: any) {
    console.error("Failed:", err.message);
  }
}

test();
