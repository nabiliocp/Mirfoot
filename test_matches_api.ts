import fetch from "node-fetch";

async function test() {
  try {
    const res = await fetch("http://localhost:3000/api/matches/2000");
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Number of matches:", data?.matches?.length);
    if (data?.matches?.length > 0) {
      console.log("First match sample:", JSON.stringify(data.matches[0], null, 2));
      console.log("Last match sample:", JSON.stringify(data.matches[data.matches.length - 1], null, 2));
    }
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

test();
