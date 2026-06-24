import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const apiKey = process.env.API_FOOTBALL_KEY;
  console.log(`Fetching fixtures for UEFA Euro (league 4) season 2024...`);
  try {
    const res = await fetch(`https://v3.football.api-sports.io/fixtures?league=4&season=2024`, {
      headers: { "x-apisports-key": apiKey }
    });
    const data = await res.json();
    if (data.response) {
      console.log(`Total matches in Euro 2024: ${data.response.length}`);
      if (data.response.length > 0) {
        console.log("First fixture sample:");
        const f = data.response[0];
        console.log(`ID: ${f.fixture.id}, Date: ${f.fixture.date}`);
        console.log(`Teams: ${f.teams.home.name} vs ${f.teams.away.name}`);
        console.log(`Status: ${f.fixture.status.short}`);
        
        console.log("\nSome other fixtures:");
        data.response.slice(0, 5).forEach(x => {
          console.log(`- ${x.fixture.id}: ${x.teams.home.name} vs ${x.teams.away.name} (${x.fixture.status.short})`);
        });
      }
    } else {
      console.log("No response:", data);
    }
  } catch (err) {
    console.error(err);
  }
}

run();
