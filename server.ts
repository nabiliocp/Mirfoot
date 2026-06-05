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
            const homeScore = matchData.score.regularTime?.home ?? matchData.score.fullTime?.home ?? 0;
            const awayScore = matchData.score.regularTime?.away ?? matchData.score.fullTime?.away ?? 0;
            
            let actualWinner = 'draw';
            if (homeScore > awayScore) actualWinner = 'home';
            else if (homeScore < awayScore) actualWinner = 'away';

            let actualQualifier = null;
            if (matchData.score.winner === 'HOME_TEAM') actualQualifier = 'home';
            else if (matchData.score.winner === 'AWAY_TEAM') actualQualifier = 'away';

            // Logic to calculate points for each user
            const { data: bets } = await supabase
              .from("bets")
              .select("*")
              .eq("challenge_id", challenge.id);

            if (bets && bets.length > 0) {
              // First pass: find the minimum distance among correct winners (excluding exact scores)
              let minDistance = Infinity;
              for (const bet of bets) {
                const pred = typeof bet.predictions === 'string' ? JSON.parse(bet.predictions) : bet.predictions;
                const isExact = pred.homeScore === homeScore && pred.awayScore === awayScore;
                
                let predWinner = 'draw';
                if (pred.homeScore > pred.awayScore) predWinner = 'home';
                else if (pred.homeScore < pred.awayScore) predWinner = 'away';
                
                if (!isExact && predWinner === actualWinner) {
                  const distance = Math.abs(pred.homeScore - homeScore) + Math.abs(pred.awayScore - awayScore);
                  if (distance < minDistance) {
                    minDistance = distance;
                  }
                }
              }

              for (const bet of bets) {
                const pred = typeof bet.predictions === 'string' ? JSON.parse(bet.predictions) : bet.predictions;
                const rules = typeof challenge.point_rules === 'string' ? JSON.parse(challenge.point_rules) : challenge.point_rules;
                
                let points = 0;
                const isExact = pred.homeScore === homeScore && pred.awayScore === awayScore;
                
                let predWinner = 'draw';
                if (pred.homeScore > pred.awayScore) predWinner = 'home';
                else if (pred.homeScore < pred.awayScore) predWinner = 'away';
                
                const distance = Math.abs(pred.homeScore - homeScore) + Math.abs(pred.awayScore - awayScore);
                
                if (isExact) {
                  points += rules.exact_score || 0;
                } else if (predWinner === actualWinner) {
                  if (distance === minDistance && minDistance !== Infinity) {
                    points += rules.close_score || 0;
                  } else {
                    points += rules.correct_winner || 0;
                  }
                }
                
                // Bonus qualification
                if (pred.qualifies && actualQualifier && pred.qualifies === actualQualifier) {
                  points += rules.qualification || 0;
                }

                // Bonus X2 logic
                const isBonusActive = !!pred.bonus;
                if (isBonusActive) {
                  if (points > 0) {
                    points = points * 2;
                  } else {
                    points = -4;
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
  app.delete("/api/challenges/:challengeId", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Configuration Supabase manquante." });
    try {
      const { challengeId } = req.params;
      const { userId } = req.query; // pass user id to verify ownership

      if (!challengeId || !userId) {
        return res.status(400).json({ error: "challengeId et userId sont requis." });
      }

      // 1. Verify ownership
      const { data: challenge, error: challengeError } = await supabase
        .from("challenges")
        .select("creator_id")
        .eq("id", challengeId)
        .single();
      
      if (challengeError) {
        return res.status(500).json({ error: "Erreur lors de la vérification du défi." });
      }
      
      if (!challenge || challenge.creator_id !== userId) {
        return res.status(403).json({ error: "Non autorisé: vous n'êtes pas le créateur de ce défi." });
      }

      // 2. Delete bets
      await supabase.from("bets").delete().eq("challenge_id", challengeId);
      
      // 3. Delete invitations
      await supabase.from("challenge_invitations").delete().eq("challenge_id", challengeId);
      
      // 4. Delete challenge
      const { error: delError } = await supabase.from("challenges").delete().eq("id", challengeId);
      
      if (delError) {
        return res.status(500).json({ error: "Erreur lors de la suppression du défi : " + delError.message });
      }
      
      return res.json({ success: true, message: "Défi supprimé avec succès." });
      
    } catch (err: any) {
      console.error("Error in delete endpoint:", err);
      res.status(500).json({ error: "Erreur interne du serveur: " + err.message });
    }
  });

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

  // Fetch all challenges for a user (both created and joined invitations), bypassing RLS
  app.get("/api/challenges/user/:userId", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Configuration Supabase manquante." });
    try {
      const { userId } = req.params;
      if (!userId) {
        return res.status(400).json({ error: "userId est requis." });
      }

      // 1. Fetch created challenges
      const { data: createdChallenges, error: createdError } = await supabase
        .from("challenges")
        .select("*")
        .eq("creator_id", userId);

      if (createdError) {
        console.error("Error loading created challenges in backend:", createdError);
      }

      // 2. Fetch invitations for this user
      const { data: invitations, error: invsError } = await supabase
        .from("challenge_invitations")
        .select("challenge_id, accepted")
        .eq("user_id", userId);

      if (invsError) {
        console.error("Error loading invitations in backend:", invsError);
      }

      // Extract challenge IDs from accepted invitations
      const invitedChallengeIds = (invitations || [])
        .filter((inv: any) => inv.accepted)
        .map((inv: any) => inv.challenge_id);

      // If there are invited challenge IDs, fetch those challenges too
      let joinedChallenges: any[] = [];
      if (invitedChallengeIds.length > 0) {
        const { data: joinedData, error: joinedError } = await supabase
          .from("challenges")
          .select("*")
          .in("id", invitedChallengeIds);

        if (joinedError) {
          console.error("Error loading joined challenges in backend:", joinedError);
        } else if (joinedData) {
          joinedChallenges = joinedData;
        }
      }

      // Combine and remove duplicates
      const allUniqueChallengesMap: Record<string, any> = {};
      (createdChallenges || []).forEach((c: any) => {
        allUniqueChallengesMap[c.id] = c;
      });
      joinedChallenges.forEach((c: any) => {
        allUniqueChallengesMap[c.id] = c;
      });

      const challengesList = Object.values(allUniqueChallengesMap);
      return res.json({ challenges: challengesList });
    } catch (err: any) {
      console.error("Error in challenges user endpoint:", err);
      res.status(500).json({ error: "Erreur interne du serveur: " + err.message });
    }
  });

  // Join a challenge by inserting into challenge_invitations (bypasses RLS utilizing the service role key)
  app.post("/api/challenges/join", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Configuration Supabase manquante." });
    try {
      const { challengeId, userId } = req.body;
      if (!challengeId || !userId) {
        return res.status(400).json({ error: "challengeId et userId sont requis." });
      }

      // Check if invitation already exists
      const { data: existingInvite, error: checkError } = await supabase
        .from("challenge_invitations")
        .select("id")
        .eq("challenge_id", challengeId)
        .eq("user_id", userId)
        .maybeSingle();

      if (checkError) {
        console.error("Error checking existing invite:", checkError);
        return res.status(500).json({ error: "Erreur lors de la vérification de l'invitation" });
      }

      if (existingInvite) {
        return res.json({ success: true, message: "Défi déjà rejoint !", wasAlreadyParticipant: true });
      }

      // Insert the invitation
      const { data, error: insertError } = await supabase
        .from("challenge_invitations")
        .insert({
          challenge_id: challengeId,
          user_id: userId,
          accepted: true
        })
        .select();

      if (insertError) {
        console.error("Error inserting invitation via service role:", insertError);
        return res.status(500).json({ error: "Erreur lors de l'enregistrement du défi: " + insertError.message });
      }

      return res.json({ success: true, data });
    } catch (err: any) {
      console.error("Error in join endpoint:", err);
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
