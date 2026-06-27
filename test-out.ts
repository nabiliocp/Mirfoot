import * as fs from "fs";

function test() {
  if (fs.existsSync("./out.json")) {
    const text = fs.readFileSync("./out.json", "utf-8");
    // If it has "◇ injected env", let's strip it!
    const lines = text.split("\n");
    let cleanText = text;
    if (lines[0].startsWith("◇")) {
      cleanText = lines.slice(1).join("\n");
    }
    try {
      const data = JSON.parse(cleanText);
      console.log("Parsed out.json successfully!");
      console.log("Type:", Array.isArray(data) ? "Array" : typeof data);
      if (Array.isArray(data)) {
        console.log("Count:", data.length);
        console.log("Sample match:", JSON.stringify(data[0], null, 2));
      } else {
        console.log("Keys:", Object.keys(data));
        if (data.response) {
          console.log("data.response count:", data.response.length);
          console.log("Sample response element:", JSON.stringify(data.response[0], null, 2));
        }
      }
    } catch (err: any) {
      console.error("Failed to parse out.json:", err.message);
    }
  } else {
    console.log("out.json does not exist");
  }
}

test();
