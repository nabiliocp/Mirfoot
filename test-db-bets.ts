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
  const { data: bets, error } = await supabase.from("bets").select("*");
  if (error) {
    console.error("Error fetching bets:", error);
    return;
  }
  console.log("Total bets count:", bets.length);
  for (const b of bets) {
    console.log(`Bet ID: ${b.id}, User: ${b.user_id}, Challenge ID: ${b.challenge_id}, Score: ${b.home_score} - ${b.away_score}, Predictions:`, JSON.stringify(b.predictions));
  }
}

run();
