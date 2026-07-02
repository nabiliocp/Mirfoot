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
    .select("*")
    .eq("user_id", "1d5a780d-ea38-41a4-859b-14e648031930");
    
  if (error) {
    console.error("Error fetching bets:", error);
    return;
  }
  
  console.log(`User has ${bets.length} rows in 'bets' table:`);
  bets.forEach((b: any) => {
    let preds = b.predictions;
    if (typeof preds === "string") {
      try {
        preds = JSON.parse(preds);
      } catch (e) {}
    }
    const numPreds = preds ? (preds.matches ? Object.keys(preds.matches).length : 0) : 0;
    console.log(`- Bet ID: ${b.id}`);
    console.log(`  Challenge ID: ${b.challenge_id}`);
    console.log(`  Created At: ${b.created_at}`);
    console.log(`  Number of match predictions: ${numPreds}`);
    if (preds && preds.matches) {
      console.log(`  Match IDs:`, Object.keys(preds.matches));
    }
    if (preds && preds.qualifiers) {
      console.log(`  Qualifiers:`, preds.qualifiers);
    }
  });
}

run();
