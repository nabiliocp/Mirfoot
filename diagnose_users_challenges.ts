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
  
  // Get all profiles
  const { data: profiles, error: pError } = await supabase.from("profiles").select("*");
  if (pError) console.error("pError", pError);
  else {
    console.log("=== PROFILES ===");
    profiles.forEach(p => console.log(`Profile: ID=${p.id}, Username=${p.username}, Email=${p.email}`));
  }

  // Get all challenges
  const { data: challenges, error: cError } = await supabase.from("challenges").select("*");
  if (cError) console.error("cError", cError);
  else {
    console.log("=== CHALLENGES ===");
    challenges.forEach(c => console.log(`Challenge: ID=${c.id}, Title=${c.title}, Creator=${c.creator_id}`));
  }

  // Get all challenge_invitations
  const { data: invitations, error: iError } = await supabase.from("challenge_invitations").select("*");
  if (iError) console.error("iError", iError);
  else {
    console.log("=== INVITATIONS ===");
    invitations.forEach(i => console.log(`Invitation: ChallengeID=${i.challenge_id}, UserID=${i.user_id}, Accepted=${i.accepted}`));
  }
}

run();
