import fetch from 'node-fetch';

async function test() {
  try {
    for (const compId of [9999, 2000]) {
      console.log(`\nFetching /api/matches/${compId}...`);
      const res = await fetch(`http://localhost:3000/api/matches/${compId}`);
      console.log("Status:", res.status);
      const data: any = await res.json();
      console.log("Matches count:", data.matches?.length);
      if (data.matches && data.matches.length > 0) {
        console.log("Sample match status:", data.matches[0].status);
      }
    }
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

test();
