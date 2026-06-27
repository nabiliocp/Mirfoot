import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

async function test() {
  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase config missing. url:", supabaseUrl, "key:", supabaseKey ? "present" : "missing");
    return;
  }
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: challenges, error } = await supabase.from("challenges").select("*");
  if (error) {
    console.error("Error fetching challenges:", error);
    return;
  }
  console.log("Challenges count:", challenges.length);
  challenges.forEach(c => {
    console.log(`- Challenge ID: ${c.id}, Match ID: ${c.match_id}, Comp ID: ${c.competition_id}, Title: ${c.title}, Match: ${c.match_home_team} vs ${c.match_away_team}, Date: ${c.match_date}, Resolved: ${c.resolved}`);
  });
}

test();
