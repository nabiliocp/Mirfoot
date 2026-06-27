async function test() {
  try {
    const res = await fetch("http://localhost:3000/api/matches/2000");
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response text:", text);
  } catch (err: any) {
    console.error("Failed:", err.message);
  }
}

test();
