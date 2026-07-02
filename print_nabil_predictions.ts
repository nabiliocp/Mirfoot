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
    .select("*, challenges(*)")
    .eq("user_id", "1d5a780d-ea38-41a4-859b-14e648031930");
    
  if (error) {
    console.error("Error:", error);
    return;
  }
  
  bets.forEach((b: any) => {
    console.log("==========================================");
    console.log(`Bet ID: ${b.id}`);
    console.log(`Challenge Title: ${b.challenges?.title}`);
    console.log(`Competition ID: ${b.challenges?.competition_id}`);
    
    let preds = b.predictions;
    if (typeof preds === "string") {
      preds = JSON.parse(preds);
    }
    
    if (preds && preds.matches) {
      console.log(`Number of predictions: ${Object.keys(preds.matches).length}`);
      console.log("Sample predictions (first 10):");
      Object.entries(preds.matches).slice(0, 10).forEach(([matchId, val]: any) => {
        console.log(`- Match ${matchId}: ${val.homeScore} - ${val.awayScore}`);
      });
    }
    if (preds && preds.qualifiers) {
      console.log("Qualifiers predictions:", preds.qualifiers);
    }
  });
}

run();
