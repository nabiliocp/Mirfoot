import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

async function run() {
  if (!supabaseUrl || !supabaseKey) {
    console.error("Config missing");
    return;
  }
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: bets, error } = await supabase
    .from("bets")
    .select("*");
    
  if (error) {
    console.error("Error fetching bets:", error);
    return;
  }
  
  console.log(`Found ${bets.length} bets rows in total:`);
  bets.forEach((b: any) => {
    let preds = b.predictions;
    if (typeof preds === "string") {
      try {
        preds = JSON.parse(preds);
      } catch (e) {}
    }
    
    const matchesCount = preds && preds.matches ? Object.keys(preds.matches).length : 0;
    const matchIds = preds && preds.matches ? Object.keys(preds.matches) : [];
    
    // Check how many matches in predictions match mock IDs 9001-9016
    const matchingMockIds = matchIds.filter(id => {
      const numId = parseInt(id);
      return numId >= 9001 && numId <= 9016;
    });
    
    console.log(`- Bet ID: ${b.id}`);
    console.log(`  User ID: ${b.user_id}`);
    console.log(`  Challenge ID: ${b.challenge_id}`);
    console.log(`  Total Match predictions: ${matchesCount}`);
    console.log(`  Matching mock IDs (9001-9016): ${matchingMockIds.length}`);
    if (matchingMockIds.length > 0) {
      console.log(`    Matching IDs:`, matchingMockIds);
    }
  });
}

run();
