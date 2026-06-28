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
  const { data: challenges, error: err1 } = await supabase.from("challenges").select("id, competition_id").eq("competition_id", 2000);
  if (err1) {
    console.error("Error fetching World Cup challenges:", err1);
    return;
  }
  
  console.log(`Found ${challenges.length} World Cup challenges.`);
  for (const c of challenges) {
    const { data: bets, error: err2 } = await supabase.from("bets").select("*").eq("challenge_id", c.id);
    if (err2) {
      console.error(`Error fetching bets for challenge ${c.id}:`, err2);
      continue;
    }
    console.log(`Challenge ${c.id} has ${bets.length} bets.`);
    bets.forEach(b => {
      console.log(`- Bet ID: ${b.id}`);
      console.log(`  predictions:`, JSON.stringify(b.predictions).substring(0, 500));
    });
  }
}

run();
