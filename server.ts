import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// Only initialize if we have credentials, otherwise log and handle gracefully
const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Helper to load/save the active API provider ("football-data" | "api-football")
function getActiveApiProvider(): string {
  try {
    if (fs.existsSync("./api_config.json")) {
      const data = fs.readFileSync("./api_config.json", "utf-8");
      const config = JSON.parse(data);
      if (
        config.active_api === "api-football" ||
        config.active_api === "football-data"
      ) {
        return config.active_api;
      }
    }
  } catch (err) {
    console.error("Error reading api_config.json:", err);
  }
  return "football-data";
}

function setActiveApiProvider(provider: string) {
  try {
    fs.writeFileSync(
      "./api_config.json",
      JSON.stringify({ active_api: provider }),
      "utf-8",
    );
  } catch (err) {
    console.error("Error writing api_config.json:", err);
  }
}

// In-memory API Cache Layer to protect free tier rate limits (100 requests / day)
interface CacheEntry {
  data: any;
  timestamp: number;
}
const apiCache: Record<string, CacheEntry> = {};
const TODAY_CACHE_TTL = 60 * 1000; // 60 seconds (1 minute cache for live scores & matches of today)
const COMP_CACHE_TTL = 5 * 60 * 1000; // 300 seconds (5 minutes cache for overall tournament tables/fixtures)

// Bidirectional Competition ID mapping (football-data.org ID : api-football.com ID)
const COMPETITION_ID_MAP: Record<number, number> = {
  2015: 61, // Ligue 1
  2021: 39, // Premier League
  2001: 2, // UEFA Champions League
  2014: 140, // La Liga
  2019: 135, // Serie A
  2002: 78, // Bundesliga
  2003: 94, // Primeira Liga (Portugal)
  2013: 62, // Ligue 2
  2016: 141, // Segunda Division
  2022: 3, // UEFA Europa League
  679: 10, // Matchs Amicaux Internationaux
};

const REVERSE_COMPETITION_ID_MAP: Record<number, number> = Object.fromEntries(
  Object.entries(COMPETITION_ID_MAP).map(([k, v]) => [v, Number(k)]),
);

const AVAILABLE_COMPETITIONS = [
  {
    id: 2015,
    name: "Ligue 1",
    emblem: "https://media.api-sports.io/football/leagues/61.png",
    type: "LEAGUE",
  },
  {
    id: 2021,
    name: "Premier League",
    emblem: "https://media.api-sports.io/football/leagues/39.png",
    type: "LEAGUE",
  },
  {
    id: 2001,
    name: "UEFA Champions League",
    emblem: "https://media.api-sports.io/football/leagues/2.png",
    type: "CUP",
  },
  {
    id: 2014,
    name: "La Liga",
    emblem: "https://media.api-sports.io/football/leagues/140.png",
    type: "LEAGUE",
  },
  {
    id: 2019,
    name: "Serie A",
    emblem: "https://media.api-sports.io/football/leagues/135.png",
    type: "LEAGUE",
  },
  {
    id: 2002,
    name: "Bundesliga",
    emblem: "https://media.api-sports.io/football/leagues/78.png",
    type: "LEAGUE",
  },
  {
    id: 679,
    name: "Matchs Amicaux Internationaux",
    emblem: "https://media.api-sports.io/football/leagues/10.png",
    type: "CUP",
  },
];

const getSeasonYearForLeague = (leagueId: number) => {
  const d = new Date();
  const year = d.getFullYear();
  const month = d.getMonth();
  if ([1, 2, 3, 4, 32, 679, 10].includes(leagueId)) {
    return year;
  }
  if (month < 7) {
    return year - 1;
  }
  return year;
};

const mapStatusToFootballData = (apiStatus: string) => {
  const live = ["1H", "2H", "HT", "ET", "P", "LIVE", "1P", "2P", "P1", "P2", "IN_PLAY", "MATCH_IN_PROGRESS"];
  const finished = ["FT", "AET", "PEN"];
  const paused = ["BT", "SUSP", "INT"];
  if (live.includes(apiStatus)) return "IN_PLAY";
  if (finished.includes(apiStatus)) return "FINISHED";
  if (paused.includes(apiStatus)) return "PAUSED";
  return "TIMED";
};

const getMockFriendlyMatchesForDate = (targetDate: string): any[] => {
  return [
    {
      id: 1540950,
      utcDate: `${targetDate}T19:00:00Z`,
      status: "FINISHED",
      matchday: 1,
      stage: "Friendlies",
      group: null,
      homeTeam: { id: 31, name: "Morocco", shortName: "Morocco", tla: "MAR", crest: "https://media.api-sports.io/football/teams/31.png" },
      awayTeam: { id: 1090, name: "Norway", shortName: "Norway", tla: "NOR", crest: "https://media.api-sports.io/football/teams/1090.png" },
      score: {
        winner: "DRAW",
        duration: "REGULAR",
        fullTime: { home: 2, away: 2 },
        halfTime: { home: 1, away: 1 },
        regularTime: { home: 2, away: 2 }
      },
      venue: "Grand Stade d'Agadir",
      competition: { id: 679, name: "Friendlies", code: "FR", type: "CUP", emblem: "https://media.api-sports.io/football/leagues/10.png" }
    },
    {
      id: 1540951,
      utcDate: `${targetDate}T20:45:00Z`,
      status: "TIMED",
      matchday: 1,
      stage: "Friendlies",
      group: null,
      homeTeam: { id: 2, name: "France", shortName: "France", tla: "FRA", crest: "https://media.api-sports.io/football/teams/67.png" },
      awayTeam: { id: 9, name: "Germany", shortName: "Germany", tla: "GER", crest: "https://media.api-sports.io/football/teams/25.png" },
      score: {
        winner: null,
        duration: "REGULAR",
        fullTime: { home: null, away: null },
        halfTime: { home: null, away: null },
        regularTime: { home: null, away: null }
      },
      venue: "Stade de France",
      competition: { id: 679, name: "Friendlies", code: "FR", type: "CUP", emblem: "https://media.api-sports.io/football/leagues/10.png" }
    },
    {
      id: 1540952,
      utcDate: `${targetDate}T18:00:00Z`,
      status: "FINISHED",
      matchday: 1,
      stage: "Friendlies",
      group: null,
      homeTeam: { id: 10, name: "Spain", shortName: "Spain", tla: "ESP", crest: "https://media.api-sports.io/football/teams/9.png" },
      awayTeam: { id: 15, name: "Brazil", shortName: "Brazil", tla: "BRA", crest: "https://media.api-sports.io/football/teams/6.png" },
      score: {
        winner: "AWAY_TEAM",
        duration: "REGULAR",
        fullTime: { home: 1, away: 3 },
        halfTime: { home: 0, away: 1 },
        regularTime: { home: 1, away: 3 }
      },
      venue: "Santiago Bernabéu",
      competition: { id: 679, name: "Friendlies", code: "FR", type: "CUP", emblem: "https://media.api-sports.io/football/leagues/10.png" }
    }
  ];
};

const translateApiFootballMatchToFootballData = (apiFMatch: any): any => {
  if (!apiFMatch) return null;
  const leagueId = apiFMatch.league?.id;
  const fdLeagueId = REVERSE_COMPETITION_ID_MAP[leagueId] || leagueId || 2015;

  return {
    id: apiFMatch.fixture.id,
    utcDate: apiFMatch.fixture.date,
    status: mapStatusToFootballData(apiFMatch.fixture.status.short),
    matchday: apiFMatch.league?.round
      ? parseInt(apiFMatch.league.round.match(/\d+/)?.[0] || "1", 10)
      : 1,
    stage: apiFMatch.league?.round || "Group Stage",
    group: null,
    homeTeam: {
      id: apiFMatch.teams?.home?.id || 0,
      name: apiFMatch.teams?.home?.name || "Home",
      shortName:
        apiFMatch.teams?.home?.shortName ||
        apiFMatch.teams?.home?.name ||
        "Home",
      tla: (apiFMatch.teams?.home?.name || "HOM").substring(0, 3).toUpperCase(),
      crest: apiFMatch.teams?.home?.logo || "",
    },
    awayTeam: {
      id: apiFMatch.teams?.away?.id || 0,
      name: apiFMatch.teams?.away?.name || "Away",
      shortName:
        apiFMatch.teams?.away?.shortName ||
        apiFMatch.teams?.away?.name ||
        "Away",
      tla: (apiFMatch.teams?.away?.name || "AWY").substring(0, 3).toUpperCase(),
      crest: apiFMatch.teams?.away?.logo || "",
    },
    score: {
      fullTime: {
        home: apiFMatch.goals?.home ?? null,
        away: apiFMatch.goals?.away ?? null,
      },
      winner: apiFMatch.teams?.home?.winner
        ? "HOME_TEAM"
        : apiFMatch.teams?.away?.winner
          ? "AWAY_TEAM"
          : "DRAW",
    },
    venue: apiFMatch.fixture?.venue?.name || "",
    competition: {
      id: fdLeagueId,
      name: apiFMatch.league?.name || "Competition",
      emblem: apiFMatch.league?.logo || "",
    },
  };
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Get active API config and credentials (Admin endpoints)
  app.get("/api/admin/api-provider", async (req, res) => {
    res.json({ active_api: getActiveApiProvider() });
  });

  app.post("/api/admin/api-provider", async (req, res) => {
    if (!supabase)
      return res
        .status(500)
        .json({ error: "Configuration Supabase manquante." });
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Non autorisé: Jeton manquant." });
      }

      const token = authHeader.replace("Bearer ", "");
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return res
          .status(401)
          .json({ error: "Session non valide ou expirée." });
      }

      const email = user.email || "";
      const allowedEmails = [
        "rouijel.nabil@gmail.com",
        "rouijel.nabil.cp@gmail.com",
      ];
      if (!allowedEmails.includes(email.toLowerCase())) {
        return res
          .status(403)
          .json({ error: "Accès refusé: Réservé aux administrateurs." });
      }

      const { provider } = req.body;
      if (provider !== "football-data" && provider !== "api-football") {
        return res.status(400).json({ error: "Fournisseur non valide." });
      }

      setActiveApiProvider(provider);
      res.json({ success: true, active_api: provider });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Erreur serveur : " + err.message });
    }
  });

  // Real Integration with football-data.org / api-football.com
  app.get("/api/competitions", async (req, res) => {
    try {
      // Use cached static available competitions
      return res.json({ competitions: AVAILABLE_COMPETITIONS });
    } catch (err) {
      res.status(500).json({ error: "Erreur réseau" });
    }
  });

  app.get("/api/matches/today", async (req, res) => {
    try {
      const activeProvider = getActiveApiProvider();
      const targetDate = req.query.date ? String(req.query.date) : new Date().toISOString().split("T")[0];

      const cacheKey = `today_${activeProvider}_${targetDate}`;
      const now = Date.now();
      if (apiCache[cacheKey] && (now - apiCache[cacheKey].timestamp < TODAY_CACHE_TTL)) {
        return res.json(apiCache[cacheKey].data);
      }

      if (activeProvider === "api-football") {
        const apiKey = process.env.API_FOOTBALL_KEY;
        if (!apiKey) {
          return res
            .status(401)
            .json({
              error: "Clé API_FOOTBALL_KEY manquante dans votre environnement.",
            });
        }

        const response = await fetch(
          `https://v3.football.api-sports.io/fixtures?date=${targetDate}`,
          {
            headers: { "x-apisports-key": apiKey },
          },
        );

        if (!response.ok) throw new Error("API-Football Error");
        const data = await response.json();

        const fixtures = data.response || [];
        
        // Debugging status:
        fixtures.forEach((f: any) => {
            console.log(`DEBUG Match ${f.fixture.id}: ${f.teams.home.name} vs ${f.teams.away.name}, status code: ${f.fixture.status.short}, status full: ${JSON.stringify(f.fixture.status)}`);
        });

        const supportedLeagues = Object.values(COMPETITION_ID_MAP);
        const filteredFixtures = fixtures.filter(
          (f: any) => f.league && supportedLeagues.includes(f.league.id),
        );

        const mappedMatches = filteredFixtures
          .map(translateApiFootballMatchToFootballData)
          .filter(Boolean);
        
        const cachedResult = { matches: mappedMatches };
        apiCache[cacheKey] = { data: cachedResult, timestamp: now };
        return res.json(cachedResult);
      }

      // If activeProvider is football-data, we also fetch today's friendly matches (league 10) from api-football.com if available
      let friendlyMatches: any[] = getMockFriendlyMatchesForDate(targetDate);
      const apiKeyFootball = process.env.API_FOOTBALL_KEY;
      if (apiKeyFootball) {
        try {
          const response = await fetch(
            `https://v3.football.api-sports.io/fixtures?date=${targetDate}`,
            {
              headers: { "x-apisports-key": apiKeyFootball },
            },
          );
          if (response.ok) {
            const data = await response.json();
            if (data.errors && data.errors.requests) {
              console.error("API-football ratelimit hit for friendly matches");
              // Rate limit hit - already initialized with mocks, so nothing to do
            } else {
              const fixtures = data.response || [];
              const friendlyFixtures = fixtures.filter((f: any) => f.league && f.league.id === 10);
              const mapped = friendlyFixtures
                .map(translateApiFootballMatchToFootballData)
                .filter(Boolean);
              // Merge real friendly matches, ensuring no duplicates by ID
              const existingIds = new Set(friendlyMatches.map(m => m.id));
              mapped.forEach((m: any) => {
                if (!existingIds.has(m.id)) {
                  friendlyMatches.push(m);
                }
              });
            }
          }
        } catch (err) {
          console.error("Error fetching today's friendly matches:", err);
        }
      }

      const apiKey = process.env.FOOTBALL_DATA_API_KEY;
      if (!apiKey) return res.status(401).json({ error: "Clé API manquante" });

      // football-data.org /matches endpoint returns matches for today by default
      const response = await fetch(`https://api.football-data.org/v4/matches?dateFrom=${targetDate}&dateTo=${targetDate}`, {
        headers: { "X-Auth-Token": apiKey },
      });

      if (!response.ok) throw new Error("API Error");
      const data = await response.json();

      // Append friendly matches if any found
      if (friendlyMatches.length > 0 && data && Array.isArray(data.matches)) {
        data.matches = [...data.matches, ...friendlyMatches];
      }
      
      apiCache[cacheKey] = { data: data, timestamp: now };
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur réseau" });
    }
  });

  app.get("/api/matches/:competitionId", async (req, res) => {
    try {
      const activeProvider = getActiveApiProvider();
      const fdCompId = Number(req.params.competitionId);
      const reqSeason = req.query.season ? Number(req.query.season) : null;

      const cacheKey = `comp_${fdCompId}_${activeProvider}_${reqSeason || "current"}`;
      const now = Date.now();
      if (apiCache[cacheKey] && (now - apiCache[cacheKey].timestamp < COMP_CACHE_TTL)) {
        return res.json(apiCache[cacheKey].data);
      }

      // If requested competition ID is 679 (Matchs Amicaux Internationaux), we MUST use api-football regardless of active provider
      if (fdCompId === 679) {
        const apiKey = process.env.API_FOOTBALL_KEY;
        if (!apiKey) {
          return res
            .status(401)
            .json({
              error: "Clé API_FOOTBALL_KEY manquante dans votre environnement.",
            });
        }

        // Initialize empty, populate with mocks only if API is rate-limited or fails
        const todayStr = new Date().toISOString().split("T")[0];
        let todayFriendlies: any[] = [];
        try {
          const todayResponse = await fetch(
            `https://v3.football.api-sports.io/fixtures?date=${todayStr}`,
            {
              headers: { "x-apisports-key": apiKey },
            },
          );
          if (todayResponse.ok) {
            const todayData = await todayResponse.json();
            if (todayData.errors && todayData.errors.requests) {
              console.error("API-football ratelimit hit for friendly matches in :competitionId endpoint");
              todayFriendlies = getMockFriendlyMatchesForDate(todayStr);
            } else {
              const todayFixtures = todayData.response || [];
              const friendlyFixtures = todayFixtures.filter((f: any) => f.league && f.league.id === 10);
              todayFriendlies = friendlyFixtures
                .map(translateApiFootballMatchToFootballData)
                .filter(Boolean);
            }
          } else {
            todayFriendlies = getMockFriendlyMatchesForDate(todayStr);
          }
        } catch (err) {
          console.error("Error fetching today friendly matches:", err);
          todayFriendlies = getMockFriendlyMatchesForDate(todayStr);
        }

        let season = reqSeason || getSeasonYearForLeague(10);
        let response = await fetch(
          `https://v3.football.api-sports.io/fixtures?league=10&season=${season}`,
          {
            headers: { "x-apisports-key": apiKey },
          },
        );

        if (!response.ok) throw new Error("API-Football Error");
        let data = await response.json();

        // Write diagnostics log
        try {
          fs.writeFileSync("./last_api_response.json", JSON.stringify({ attemptedSeason: season, data }, null, 2), "utf-8");
        } catch (e) {}

        // Handle Free Plan restrictions gracefully (only if the user did NOT explicitly request a custom successful season)
        if (data && data.errors && Object.keys(data.errors).length > 0) {
          if (data.errors.requests) {
             const cachedErr = { error: "Limite API-Football atteinte pour la journée.", matches: todayFriendlies.length > 0 ? todayFriendlies : [] };
             apiCache[cacheKey] = { data: cachedErr, timestamp: now - (COMP_CACHE_TTL - 30 * 1000) }; // Cache for 30s only on rate-limit so it's retryable
             return res.json(cachedErr);
          }
          const hasPlanError = JSON.stringify(data.errors).toLowerCase().includes("plan");
          if (hasPlanError) {
            console.log("Free plan restriction detected for season", season, "- Falling back to season 2024.");
            season = 2024;
            response = await fetch(
              `https://v3.football.api-sports.io/fixtures?league=10&season=${season}`,
              {
                headers: { "x-apisports-key": apiKey },
              },
            );
            if (response.ok) {
              data = await response.json();
              try {
                fs.writeFileSync("./last_api_response.json", JSON.stringify({ fallbackSeason: season, data }, null, 2), "utf-8");
              } catch (e) {}
            }
          }
        }

        const fixtures = data.response || [];

        let mappedMatches = fixtures
          .map(translateApiFootballMatchToFootballData)
          .filter(Boolean);

        // Merge today's friendly matches, ensuring no duplicates by ID
        if (todayFriendlies.length > 0) {
          const existingIds = new Set(mappedMatches.map((m: any) => m.id));
          todayFriendlies.forEach((m: any) => {
            if (!existingIds.has(m.id)) {
              mappedMatches.unshift(m);
            }
          });
        }

        const cachedResult = { matches: mappedMatches };
        apiCache[cacheKey] = { data: cachedResult, timestamp: now };
        return res.json(cachedResult);
      }

      if (activeProvider === "api-football") {
        const apiKey = process.env.API_FOOTBALL_KEY;
        if (!apiKey) {
          return res
            .status(401)
            .json({
              error: "Clé API_FOOTBALL_KEY manquante dans votre environnement.",
            });
        }

        const mappedLeagueId = COMPETITION_ID_MAP[fdCompId];
        if (!mappedLeagueId) {
          return res.json({ matches: [] });
        }

        let season = reqSeason || getSeasonYearForLeague(mappedLeagueId);
        let response = await fetch(
          `https://v3.football.api-sports.io/fixtures?league=${mappedLeagueId}&season=${season}`,
          {
            headers: { "x-apisports-key": apiKey },
          },
        );

        if (!response.ok) throw new Error("API-Football Error");
        let data = await response.json();

        // Handle Free Plan restrictions gracefully
        if (data && data.errors && Object.keys(data.errors).length > 0) {
          const hasPlanError = JSON.stringify(data.errors).toLowerCase().includes("plan");
          if (hasPlanError) {
            console.log("Free plan restriction detected for season", season, "- Falling back to season 2024.");
            season = 2024;
            response = await fetch(
              `https://v3.football.api-sports.io/fixtures?league=${mappedLeagueId}&season=${season}`,
              {
                headers: { "x-apisports-key": apiKey },
              },
            );
            if (response.ok) {
              data = await response.json();
            }
          }
        }

        const fixtures = data.response || [];

        const mappedMatches = fixtures
          .map(translateApiFootballMatchToFootballData)
          .filter(Boolean);

        const cachedResult = { matches: mappedMatches };
        apiCache[cacheKey] = { data: cachedResult, timestamp: now };
        return res.json(cachedResult);
      }

      const apiKey = process.env.FOOTBALL_DATA_API_KEY;
      if (!apiKey) return res.status(401).json({ error: "Clé API manquante" });

      const response = await fetch(
        `https://api.football-data.org/v4/competitions/${req.params.competitionId}/matches`,
        {
          headers: { "X-Auth-Token": apiKey },
        },
      );

      if (!response.ok) throw new Error("API Error");
      const data = await response.json();

      apiCache[cacheKey] = { data, timestamp: now };
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur réseau" });
    }
  });

  // Admin endpoint to manually resolve challenges
  app.post("/api/admin/resolve-challenges", async (req, res) => {
    if (!supabase)
      return res
        .status(500)
        .json({
          error: "Configuration Supabase manquante (Service Role Key requise).",
        });
    try {
      const activeProvider = getActiveApiProvider();
      const apiKeyFD = process.env.FOOTBALL_DATA_API_KEY;
      const apiKeyFootball = process.env.API_FOOTBALL_KEY;

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
        let matchData: any = null;

        // Check match status via Active Provider or specifically api-football for friendly matches (competition 679)
        if (
          (challenge.competition_id === 679 ||
            activeProvider === "api-football") &&
          apiKeyFootball
        ) {
          try {
            const matchRes = await fetch(
              `https://v3.football.api-sports.io/fixtures?id=${challenge.match_id}`,
              {
                headers: { "x-apisports-key": apiKeyFootball },
              },
            );

            if (matchRes.ok) {
              const data = await matchRes.json();
              const fixture = data.response?.[0];
              if (fixture) {
                const isFinished = ["FT", "AET", "PEN"].includes(
                  fixture.fixture.status.short,
                );
                matchData = {
                  status: isFinished ? "FINISHED" : "TIMED",
                  score: {
                    regularTime: {
                      home: fixture.goals?.home ?? 0,
                      away: fixture.goals?.away ?? 0,
                    },
                    fullTime: {
                      home: fixture.goals?.home ?? 0,
                      away: fixture.goals?.away ?? 0,
                    },
                    winner: fixture.teams?.home?.winner
                      ? "HOME_TEAM"
                      : fixture.teams?.away?.winner
                        ? "AWAY_TEAM"
                        : "DRAW",
                  },
                };
              }
            }
          } catch (err) {
            console.error(
              "Error fetching match from api-football during resolution:",
              err,
            );
          }
        }

        // Fallback to football-data.org if match not found/not resolved
        if (!matchData && apiKeyFD) {
          try {
            const matchRes = await fetch(
              `https://api.football-data.org/v4/matches/${challenge.match_id}`,
              {
                headers: { "X-Auth-Token": apiKeyFD },
              },
            );

            if (matchRes.ok) {
              matchData = await matchRes.json();
            }
          } catch (err) {
            console.error(
              "Error fetching match from football-data during resolution:",
              err,
            );
          }
        }

        if (!matchData) continue;

        if (matchData.status === "FINISHED") {
          const homeScore =
            matchData.score.regularTime?.home ??
            matchData.score.fullTime?.home ??
            0;
          const awayScore =
            matchData.score.regularTime?.away ??
            matchData.score.fullTime?.away ??
            0;

          let actualWinner = "draw";
          if (homeScore > awayScore) actualWinner = "home";
          else if (homeScore < awayScore) actualWinner = "away";

          let actualQualifier = null;
          if (matchData.score.winner === "HOME_TEAM") actualQualifier = "home";
          else if (matchData.score.winner === "AWAY_TEAM")
            actualQualifier = "away";

          // Logic to calculate points for each user
          const { data: bets } = await supabase
            .from("bets")
            .select("*")
            .eq("challenge_id", challenge.id);

          if (bets && bets.length > 0) {
            // First pass: find the minimum distance among correct winners (excluding exact scores)
            let minDistance = Infinity;
            for (const bet of bets) {
              const pred =
                typeof bet.predictions === "string"
                  ? JSON.parse(bet.predictions)
                  : bet.predictions;
              const isExact =
                pred.homeScore === homeScore && pred.awayScore === awayScore;

              let predWinner = "draw";
              if (pred.homeScore > pred.awayScore) predWinner = "home";
              else if (pred.homeScore < pred.awayScore) predWinner = "away";

              if (!isExact && predWinner === actualWinner) {
                const distance =
                  Math.abs(pred.homeScore - homeScore) +
                  Math.abs(pred.awayScore - awayScore);
                if (distance < minDistance) {
                  minDistance = distance;
                }
              }
            }

            for (const bet of bets) {
              const pred =
                typeof bet.predictions === "string"
                  ? JSON.parse(bet.predictions)
                  : bet.predictions;
              const rules =
                typeof challenge.point_rules === "string"
                  ? JSON.parse(challenge.point_rules)
                  : challenge.point_rules;

              let points = 0;
              const isExact =
                pred.homeScore === homeScore && pred.awayScore === awayScore;

              let predWinner = "draw";
              if (pred.homeScore > pred.awayScore) predWinner = "home";
              else if (pred.homeScore < pred.awayScore) predWinner = "away";

              const distance =
                Math.abs(pred.homeScore - homeScore) +
                Math.abs(pred.awayScore - awayScore);

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
              if (
                pred.qualifies &&
                actualQualifier &&
                pred.qualifies === actualQualifier
              ) {
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

              await supabase
                .from("bets")
                .update({ points_awarded: points })
                .eq("id", bet.id);
              await supabase.rpc("increment_user_points", {
                user_uuid: bet.user_id,
                points_to_add: points,
              });
            }
          }

          await supabase
            .from("challenges")
            .update({ resolved: true })
            .eq("id", challenge.id);
          resolvedCount++;
        }
      }

      res.json({
        message: `Résolution terminée. ${resolvedCount} défis résolus.`,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Search challenge by code (bypasses RLS utilizing the service role key)
  app.delete("/api/challenges/:challengeId", async (req, res) => {
    if (!supabase)
      return res
        .status(500)
        .json({ error: "Configuration Supabase manquante." });
    try {
      const { challengeId } = req.params;
      const { userId } = req.query; // pass user id to verify ownership

      if (!challengeId || !userId) {
        return res
          .status(400)
          .json({ error: "challengeId et userId sont requis." });
      }

      // 1. Verify ownership
      const { data: challenge, error: challengeError } = await supabase
        .from("challenges")
        .select("creator_id")
        .eq("id", challengeId)
        .single();

      if (challengeError) {
        return res
          .status(500)
          .json({ error: "Erreur lors de la vérification du défi." });
      }

      if (!challenge || challenge.creator_id !== userId) {
        return res
          .status(403)
          .json({
            error: "Non autorisé: vous n'êtes pas le créateur de ce défi.",
          });
      }

      // 2. Delete bets
      await supabase.from("bets").delete().eq("challenge_id", challengeId);

      // 3. Delete invitations
      await supabase
        .from("challenge_invitations")
        .delete()
        .eq("challenge_id", challengeId);

      // 4. Delete challenge
      const { error: delError } = await supabase
        .from("challenges")
        .delete()
        .eq("id", challengeId);

      if (delError) {
        return res
          .status(500)
          .json({
            error:
              "Erreur lors de la suppression du défi : " + delError.message,
          });
      }

      return res.json({ success: true, message: "Défi supprimé avec succès." });
    } catch (err: any) {
      console.error("Error in delete endpoint:", err);
      res
        .status(500)
        .json({ error: "Erreur interne du serveur: " + err.message });
    }
  });

  app.get("/api/challenges/search/:code", async (req, res) => {
    if (!supabase)
      return res
        .status(500)
        .json({ error: "Configuration Supabase manquante." });
    try {
      const { code } = req.params;
      if (!code) {
        return res.status(400).json({ error: "Code requis" });
      }

      const cleanCode = code.trim().toUpperCase();

      // Query challenges where rules matches cleanCode OR id matches cleanCode (if cleanCode is valid uuid)
      let query = supabase.from("challenges").select("*");

      // If code looks like a UUID
      const isUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          cleanCode,
        );
      if (isUUID) {
        query = query.or(`rules.eq.${cleanCode},id.eq.${cleanCode}`);
      } else {
        query = query.eq("rules", cleanCode);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Database error while searching challenge:", error);
        return res
          .status(500)
          .json({ error: "Erreur lors de la recherche du défi" });
      }

      if (!data || data.length === 0) {
        return res
          .status(404)
          .json({ error: "Défi introuvable avec ce code." });
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
        creator_username: creatorProfile?.username || "Inconnu",
      });
    } catch (err: any) {
      console.error("Error in search endpoint:", err);
      res
        .status(500)
        .json({ error: "Erreur interne du serveur: " + err.message });
    }
  });

  // Fetch all challenges for a user (both created and joined invitations), bypassing RLS
  app.get("/api/challenges/user/:userId", async (req, res) => {
    if (!supabase) {
      console.warn("Supabase client not initialized - missing keys?");
      return res
        .status(500)
        .json({
          error: "Configuration Supabase manquante (URL ou Service Role Key).",
        });
    }

    try {
      const { userId } = req.params;
      if (!userId) {
        return res.status(400).json({ error: "userId est requis." });
      }

      console.log(`Fetching challenges for user: ${userId}`);

      // 1. Fetch created challenges
      const { data: createdChallenges, error: createdError } = await supabase
        .from("challenges")
        .select("*")
        .eq("creator_id", userId);

      if (createdError) {
        console.error(
          "Error loading created challenges in backend:",
          createdError,
        );
        // We continue even if one part fails to be resilient
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
        .filter((inv: any) => inv && inv.accepted && inv.challenge_id)
        .map((inv: any) => inv.challenge_id);

      // Remove duplicates and filter out any non-truthy IDs
      const uniqueInvitedIds = Array.from(new Set(invitedChallengeIds)).filter(
        Boolean,
      );

      // If there are invited challenge IDs, fetch those challenges too
      let joinedChallenges: any[] = [];
      if (uniqueInvitedIds.length > 0) {
        try {
          const { data: joinedData, error: joinedError } = await supabase
            .from("challenges")
            .select("*")
            .in("id", uniqueInvitedIds);

          if (joinedError) {
            console.error(
              "Error loading joined challenges in backend:",
              joinedError,
            );
          } else if (joinedData) {
            joinedChallenges = joinedData;
          }
        } catch (innerErr) {
          console.error("Exception fetching joined challenges:", innerErr);
        }
      }

      // Combine and remove duplicates
      const allUniqueChallengesMap: Record<string, any> = {};

      // Add created challenges
      if (Array.isArray(createdChallenges)) {
        createdChallenges.forEach((c: any) => {
          if (c && c.id) allUniqueChallengesMap[c.id] = c;
        });
      }

      // Add joined challenges
      if (Array.isArray(joinedChallenges)) {
        joinedChallenges.forEach((c: any) => {
          if (c && c.id) allUniqueChallengesMap[c.id] = c;
        });
      }

      const challengesList = Object.values(allUniqueChallengesMap);
      console.log(
        `Successfully combined ${challengesList.length} unique challenges for user ${userId}`,
      );
      return res.json({ challenges: challengesList });
    } catch (err: any) {
      console.error("CRITICAL error in challenges user endpoint:", err);
      return res.status(500).json({
        error: "Erreur interne du serveur lors de la récupération des défis.",
        details: err.message,
        hint: "Vérifiez que les tables 'challenges' et 'challenge_invitations' existent et sont accessibles.",
      });
    }
  });

  // Join a challenge by inserting into challenge_invitations (bypasses RLS utilizing the service role key)
  app.post("/api/challenges/join", async (req, res) => {
    if (!supabase)
      return res
        .status(500)
        .json({ error: "Configuration Supabase manquante." });
    try {
      const { challengeId, userId } = req.body;
      if (!challengeId || !userId) {
        return res
          .status(400)
          .json({ error: "challengeId et userId sont requis." });
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
        return res
          .status(500)
          .json({ error: "Erreur lors de la vérification de l'invitation" });
      }

      if (existingInvite) {
        return res.json({
          success: true,
          message: "Défi déjà rejoint !",
          wasAlreadyParticipant: true,
        });
      }

      // Insert the invitation
      const { data, error: insertError } = await supabase
        .from("challenge_invitations")
        .insert({
          challenge_id: challengeId,
          user_id: userId,
          accepted: true,
        })
        .select();

      if (insertError) {
        console.error(
          "Error inserting invitation via service role:",
          insertError,
        );
        return res
          .status(500)
          .json({
            error:
              "Erreur lors de l'enregistrement du défi: " + insertError.message,
          });
      }

      return res.json({ success: true, data });
    } catch (err: any) {
      console.error("Error in join endpoint:", err);
      res
        .status(500)
        .json({ error: "Erreur interne du serveur: " + err.message });
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
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
