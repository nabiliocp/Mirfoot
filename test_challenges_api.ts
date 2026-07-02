import fetch from "node-fetch";

async function test() {
  try {
    const res = await fetch("http://localhost:3000/api/challenges/user/1d5a780d-ea38-41a4-859b-14e648031930");
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

test();
