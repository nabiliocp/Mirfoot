import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const apiKey = process.env.API_FOOTBALL_KEY;
  try {
    for (const season of [2018, 2022]) {
      console.log(`Fetching league 1 season ${season}...`);
      const res = await fetch(`https://v3.football.api-sports.io/fixtures?league=1&season=${season}`, {
        headers: { "x-apisports-key": apiKey }
      });
      const data = await res.json();
      if (data.response && data.response.length > 0) {
        console.log(`Season ${season} matches count: ${data.response.length}`);
        const sample = data.response.slice(0, 5);
        sample.forEach(f => {
          console.log(`- ${f.fixture.id}: ${f.teams.home.name} vs ${f.teams.away.name} (${f.fixture.status.short})`);
        });
      } else {
        console.log(`Season ${season} response:`, data);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

run();
