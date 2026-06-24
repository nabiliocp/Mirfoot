import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const apiKey = process.env.API_FOOTBALL_KEY;
  const matchId = 537328;
  console.log(`Fetching fixture ${matchId} info...`);
  try {
    const res = await fetch(`https://v3.football.api-sports.io/fixtures?id=${matchId}`, {
      headers: { "x-apisports-key": apiKey }
    });
    const data = await res.json();
    if (data.response && data.response.length > 0) {
      const f = data.response[0];
      console.log(`Fixture ID: ${f.fixture.id}`);
      console.log(`League ID: ${f.league.id}, Name: ${f.league.name}, Season: ${f.league.season}`);
      console.log(`Teams: ${f.teams.home.name} vs ${f.teams.away.name}`);
      console.log(`Score: ${f.goals.home}-${f.goals.away}`);
    } else {
      console.log("No response or error:", data);
    }
  } catch (err) {
    console.error(err);
  }
}

run();
