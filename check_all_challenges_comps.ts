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
  const { data: challenges, error } = await supabase
    .from("challenges")
    .select("*");
    
  if (error) {
    console.error("Error fetching challenges:", error);
    return;
  }
  
  console.log(`Found ${challenges.length} challenges in DB:`);
  challenges.forEach((c: any) => {
    console.log(`- ID: ${c.id}`);
    console.log(`  Title: ${c.title}`);
    console.log(`  Competition ID: ${c.competition_id}`);
    console.log(`  Match ID: ${c.match_id}`);
    console.log(`  Resolved: ${c.resolved}`);
    console.log(`  Creator ID: ${c.creator_id}`);
  });
}

run();
