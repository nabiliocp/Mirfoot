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
    .select("*, challenges(*)");
    
  if (error) {
    console.error("Error:", error);
    return;
  }
  
  const allMatchIds = new Set<string>();
  bets.forEach((b: any) => {
    if (b.challenges?.competition_id === 2000) {
      let preds = b.predictions;
      if (typeof preds === "string") {
        preds = JSON.parse(preds);
      }
      if (preds && preds.matches) {
        Object.keys(preds.matches).forEach(id => allMatchIds.add(id));
      }
    }
  });
  
  console.log(`All distinct match IDs in WC bets:`, Array.from(allMatchIds).sort());
}

run();
