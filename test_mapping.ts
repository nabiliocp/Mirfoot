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
  const { data: challenges, error } = await supabase.from("challenges").select("*");
  if (error) {
    console.error("Error fetching challenges:", error);
    return;
  }
  
  challenges.forEach(c => {
    try {
      const mapped = {
        id: c.id,
        competitionId: c.competition_id,
        matchId: c.match_id,
        matchHomeTeam: c.match_home_team,
        matchAwayTeam: c.match_away_team,
        matchDate: c.match_date,
        creatorId: c.creator_id,
        creatorUsername: c.creator_username || "Inconnu",
        title: c.title,
        rules: c.rules,
        code: c.rules || c.id.substring(0, 8).toUpperCase(),
        pointRules:
          typeof c.point_rules === "string"
            ? JSON.parse(c.point_rules)
            : c.point_rules,
        locked: c.locked,
        resolved: c.resolved,
        type: c.type,
      };
      console.log("Mapped successfully:", c.title, "pointRules:", typeof mapped.pointRules);
    } catch (err: any) {
      console.error("Failed mapping challenge:", c.title, err.message);
    }
  });
}

run();
