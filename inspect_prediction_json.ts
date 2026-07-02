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
  const { data: bet, error } = await supabase
    .from("bets")
    .select("*")
    .eq("id", "18499ae1-d563-4fd8-a067-4cf188d54054")
    .single();
    
  if (error) {
    console.error("Error fetching bet:", error);
    return;
  }
  
  const preds = typeof bet.predictions === "string" ? JSON.parse(bet.predictions) : bet.predictions;
  const matches = preds?.matches || {};
  console.log("Predictions from 537408 onwards:");
  Object.entries(matches).forEach(([matchId, val]: any) => {
    if (Number(matchId) >= 537408) {
      console.log(`- Match ${matchId}: ${val.homeScore} - ${val.awayScore}`);
    }
  });
}

run();
