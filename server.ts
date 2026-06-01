import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // In-memory data store for the prototype (ideally a database like Firebase/PostgreSQL)
  const db = {
    users: [
      { id: "1", name: "You (Admin)", points: 0 },
      { id: "2", name: "Marc", points: 12 },
      { id: "3", name: "Sophie", points: 8 },
      { id: "4", name: "Julien", points: 15 },
    ],
    challenges: [
      { id: "1", matchId: 1, title: "Qui marquera le premier but ?", options: ["Équipe Domicile", "Équipe Extérieur", "Aucun"], resolved: false },
      { id: "2", matchId: 1, title: "Y aura-t-il un carton rouge ?", options: ["Oui", "Non"], resolved: false }
    ],
    bets: []
  };

  // API Endpoints
  
  // Real Integration with football-data.org
  app.get("/api/competitions", async (req, res) => {
    try {
      const apiKey = process.env.FOOTBALL_DATA_API_KEY;
      if (!apiKey) {
        return res.status(401).json({ error: "Missing FOOTBALL_DATA_API_KEY. Configure it in AI Studio settings." });
      }

      const response = await fetch("https://api.football-data.org/v4/competitions", {
        headers: { "X-Auth-Token": apiKey }
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch competitions from external API");
      }
      
      const data = await response.json();
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error connecting to Football Data API" });
    }
  });

  app.get("/api/matches/:competitionId", async (req, res) => {
    try {
      const apiKey = process.env.FOOTBALL_DATA_API_KEY;
      if (!apiKey) {
        return res.status(401).json({ error: "Missing FOOTBALL_DATA_API_KEY. Configure it in AI Studio settings." });
      }

      const response = await fetch(`https://api.football-data.org/v4/competitions/${req.params.competitionId}/matches?status=SCHEDULED`, {
        headers: { "X-Auth-Token": apiKey }
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch matches from external API");
      }
      
      const data = await response.json();
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error connecting to Football Data API" });
    }
  });

  // App API endpoints for leaderboard and challenges
  app.get("/api/leaderboard", (req, res) => {
    const sortedUsers = [...db.users].sort((a, b) => b.points - a.points);
    res.json(sortedUsers);
  });

  app.get("/api/challenges", (req, res) => {
    res.json(db.challenges);
  });

  // Vite middleware for development
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
