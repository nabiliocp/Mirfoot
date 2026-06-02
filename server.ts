import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Only initialize if we have credentials, otherwise log and handle gracefully
const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Real Integration with football-data.org
  app.get("/api/competitions", async (req, res) => {
    try {
      const apiKey = process.env.FOOTBALL_DATA_API_KEY;
      if (!apiKey) {
        return res.status(401).json({ error: "Configuration requise: Veuillez ajouter FOOTBALL_DATA_API_KEY dans les 'Secrets'." });
      }

      const response = await fetch("https://api.football-data.org/v4/competitions", {
        headers: { "X-Auth-Token": apiKey }
      });
      
      if (!response.ok) throw new Error("API Error");
      const data = await response.json();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: "Erreur réseau" });
    }
  });

  app.get("/api/matches/:competitionId", async (req, res) => {
    try {
      const apiKey = process.env.FOOTBALL_DATA_API_KEY;
      if (!apiKey) return res.status(401).json({ error: "Clé API manquante" });

      const response = await fetch(`https://api.football-data.org/v4/competitions/${req.params.competitionId}/matches`, {
        headers: { "X-Auth-Token": apiKey }
      });
      
      if (!response.ok) throw new Error("API Error");
      const data = await response.json();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: "Erreur réseau" });
    }
  });

  // Admin endpoint to manually resolve challenges
  app.post("/api/admin/resolve-challenges", async (req, res) => {
     if (!supabase) return res.status(500).json({ error: "Configuration Supabase manquante (Service Role Key requise)." });
     try {
       const apiKey = process.env.FOOTBALL_DATA_API_KEY;
       if (!apiKey) return res.status(401).json({ error: "Clé API manquante" });

       // 1. Get unresolved challenges
       const { data: challenges } = await supabase
         .from("challenges")
         .select("*")
         .eq("resolved", false);

       if (!challenges || challenges.length === 0) {
         return res.json({ message: "Aucun défi à résoudre" });
       }

       let resolvedCount = 0;

       for (const challenge of challenges) {
         // Check match status via API
         const matchRes = await fetch(`https://api.football-data.org/v4/matches/${challenge.match_id}`, {
           headers: { "X-Auth-Token": apiKey }
         });
         
         if (!matchRes.ok) continue;
         const matchData = await matchRes.json();

         if (matchData.status === "FINISHED") {
           const finalScore = matchData.score.fullTime;
           const homeScore = finalScore.home;
           const awayScore = finalScore.away;
           
           // Logic to calculate points for each user
           const { data: bets } = await supabase
             .from("bets")
             .select("*")
             .eq("challenge_id", challenge.id);

           if (bets) {
             for (const bet of bets) {
               const pred = typeof bet.predictions === 'string' ? JSON.parse(bet.predictions) : bet.predictions;
               const rules = typeof challenge.point_rules === 'string' ? JSON.parse(challenge.point_rules) : challenge.point_rules;
               
               let points = 0;
               const isExact = pred.homeScore === homeScore && pred.awayScore === awayScore;
               const actualWinner = homeScore > awayScore ? 'home' : homeScore < awayScore ? 'away' : 'draw';
               const predWinner = pred.homeScore > pred.awayScore ? 'home' : pred.homeScore < pred.awayScore ? 'away' : 'draw';
               
               if (isExact) {
                 points = rules.group_stage.exact_score;
               } else if (actualWinner === predWinner) {
                 // Check if it's the closest guess by absolute difference for matches
                 // (Simplified version: award correct_winner points, closest guess is usually used as a tiebreaker or separate points)
                 points = rules.group_stage.correct_winner;
               } else {
                 // Check for closest guess logic? 
                 // We'll award the 'closest_guess' points if they got the winner wrong but scores were close
                 const diff = Math.abs(pred.homeScore - homeScore) + Math.abs(pred.awayScore - awayScore);
                 if (diff <= 2) {
                    points = rules.group_stage.closest_guess;
                 }
               }
               
               // Knockout penalties logic
               if (matchData.score.winner === 'PENALTY_SHOOTOUT' && pred.penaltiesHomeScore !== undefined) {
                  const actualPenWinner = matchData.score.penalties.home > matchData.score.penalties.away ? 'home' : 'away';
                  const predPenWinner = pred.penaltiesHomeScore > pred.penaltiesAwayScore ? 'home' : 'away';
                  const isExactPen = pred.penaltiesHomeScore === matchData.score.penalties.home && pred.penaltiesAwayScore === matchData.score.penalties.away;
                  
                  if (isExactPen) {
                    points += rules.knockout_stage.exact_score_penalties;
                  } else if (actualPenWinner === predPenWinner) {
                    points += rules.knockout_stage.correct_winner_penalties;
                  }
               }
               
               await supabase.from("bets").update({ points_awarded: points }).eq("id", bet.id);
               await supabase.rpc('increment_user_points', { user_uuid: bet.user_id, points_to_add: points });
             }
           }

           await supabase.from("challenges").update({ resolved: true }).eq("id", challenge.id);
           resolvedCount++;
         }
       }

       res.json({ message: `Résolution terminée. ${resolvedCount} défis résolus.` });
     } catch (err) {
       console.error(err);
       res.status(500).json({ error: "Erreur serveur" });
     }
  });

  // Search challenge by code (bypasses RLS utilizing the service role key)
  app.get("/api/challenges/search/:code", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Configuration Supabase manquante." });
    try {
      const { code } = req.params;
      if (!code) {
        return res.status(400).json({ error: "Code requis" });
      }

      const cleanCode = code.trim().toUpperCase();

      // Query challenges where rules matches cleanCode OR id matches cleanCode (if cleanCode is valid uuid)
      let query = supabase.from("challenges").select("*");
      
      // If code looks like a UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanCode);
      if (isUUID) {
        query = query.or(`rules.eq.${cleanCode},id.eq.${cleanCode}`);
      } else {
        query = query.eq("rules", cleanCode);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Database error while searching challenge:", error);
        return res.status(500).json({ error: "Erreur lors de la recherche du défi" });
      }

      if (!data || data.length === 0) {
        return res.status(404).json({ error: "Défi introuvable avec ce code." });
      }

      // Fetch creator's username to enrich response
      const challengeObj = data[0];
      const { data: creatorProfile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", challengeObj.creator_id)
        .single();

      res.json({
        ...challengeObj,
        creator_username: creatorProfile?.username || "Inconnu"
      });
    } catch (err: any) {
      console.error("Error in search endpoint:", err);
      res.status(500).json({ error: "Erreur interne du serveur: " + err.message });
    }
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
