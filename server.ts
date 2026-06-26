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

// Persistent file-based caching helper to prevent 0 scores during API rate limits or down-times
const persistentCachePath = (key: string) => path.join(process.cwd(), `cached_${key.replace(/[^a-zA-Z0-9_]/g, "_")}.json`);

function savePersistentCache(key: string, data: any) {
  try {
    fs.writeFileSync(persistentCachePath(key), JSON.stringify(data), "utf-8");
  } catch (err) {
    console.error(`Failed to save persistent cache for ${key}:`, err);
  }
}

function loadPersistentCache(key: string): any | null {
  try {
    const p = persistentCachePath(key);
    if (fs.existsSync(p)) {
      console.log(`Loading persistent cache for ${key}`);
      return JSON.parse(fs.readFileSync(p, "utf-8"));
    }
  } catch (err) {
    console.error(`Failed to load persistent cache for ${key}:`, err);
  }
  return null;
}

// Rate limiter queue logic to prevent 429 Too Many Requests or account bans
const fetchQueue: (() => Promise<void>)[] = [];
let isProcessingFetchQueue = false;
const fetchTimestamps: number[] = [];
const MAX_REQUESTS_PER_MINUTE = 15; // Safe margin below the typical 20 limit
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

async function processFetchQueue() {
  if (isProcessingFetchQueue) return;
  isProcessingFetchQueue = true;

  while (fetchQueue.length > 0) {
    const now = Date.now();
    // Remove timestamps older than 1 minute
    while (fetchTimestamps.length > 0 && now - fetchTimestamps[0] > RATE_LIMIT_WINDOW_MS) {
      fetchTimestamps.shift();
    }

    if (fetchTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
      // Calculate how long to wait until the oldest request falls out of the window
      const waitTime = RATE_LIMIT_WINDOW_MS - (now - fetchTimestamps[0]) + 100;
      console.log(`[Rate Limiter] Limit of ${MAX_REQUESTS_PER_MINUTE} req/min reached. Waiting ${Math.round(waitTime / 1000)}s...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      continue;
    }

    const task = fetchQueue.shift();
    if (task) {
      fetchTimestamps.push(Date.now());
      try {
        await task();
      } catch (err) {
        console.error("[Rate Limiter] Task error:", err);
      }
    }
  }

  isProcessingFetchQueue = false;
}

// Tracking Football-Data.org Rate Limit headers dynamically to proactively protect against 429 errors
let globalFootballDataAvailableRequests = 10;
let globalFootballDataResetSeconds = 60;
let globalFootballDataResetTimestamp = Date.now() + 60000;

function rateLimitedFetch(url: string, options?: any): Promise<Response> {
  return new Promise((resolve, reject) => {
    fetchQueue.push(async () => {
      try {
        console.log(`[Rate Limiter] Executing fetch for: ${url}`);
        const response = await fetch(url, options);
        
        // Intercept headers for Football-Data.org
        if (url.includes("football-data.org")) {
          const avail = response.headers.get("x-requests-available-minute");
          const reset = response.headers.get("x-requestcounter-reset");
          if (avail !== null) {
            const numAvail = parseInt(avail, 10);
            console.log(`[Rate Limiter] Football-Data.org Requests Available in current minute: ${numAvail}`);
            globalFootballDataAvailableRequests = numAvail;
          }
          if (reset !== null) {
            const numReset = parseInt(reset, 10);
            console.log(`[Rate Limiter] Football-Data.org Reset in: ${numReset} seconds`);
            globalFootballDataResetSeconds = numReset;
            globalFootballDataResetTimestamp = Date.now() + (numReset * 1000);
          }
        }
        
        resolve(response);
      } catch (err) {
        reject(err);
      }
    });
    processFetchQueue();
  });
}

// In-memory API Cache Layer to protect free tier rate limits (100 requests / day)
interface CacheEntry {
  data: any;
  timestamp: number;
}
const apiCache: Record<string, CacheEntry> = {};
const TODAY_CACHE_TTL = 60 * 1000; // 60 seconds (1 minute cache for live scores & matches of today)
const COMP_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours (saves huge amount of rate limits and loads instantaneously from the in-memory cache)

// Server-side cache for user profiles to drastically speed up queries and avoid DB bottlenecks
const profilesCache: Record<string, { data: any; timestamp: number }> = {};
const PROFILES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache is safe and extremely fast

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
  2018: 4, // Euro Championship
  679: 10, // Matchs Amicaux Internationaux
  2000: 1, // Coupe du Monde FIFA
};

const REVERSE_COMPETITION_ID_MAP: Record<number, number> = Object.fromEntries(
  Object.entries(COMPETITION_ID_MAP).map(([k, v]) => [v, Number(k)]),
);

const AVAILABLE_COMPETITIONS = [
  {
    id: 2018,
    name: "Euro Championship",
    emblem: "https://media.api-sports.io/football/leagues/4.png",
    type: "CUP",
  },
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
  {
    id: 2000,
    name: "Coupe du Monde FIFA",
    emblem: "https://media.api-sports.io/football/leagues/1.png",
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
  const live = ["1H", "2H", "HT", "ET", "P", "LIVE", "1P", "2P", "P1", "P2", "IN_PLAY", "MATCH_IN_PROGRESS", "1st HALF", "2nd HALF", "IN PROGRESS", "IN-PROGRESS"];
  const finished = ["FT", "AET", "PEN", "FINISHED"];
  const paused = ["BT", "SUSP", "INT", "PAUSED"];
  
  if (live.includes(apiStatus)) return "IN_PLAY";
  if (finished.includes(apiStatus)) return "FINISHED";
  if (paused.includes(apiStatus)) return "PAUSED";
  
  console.log(`DEBUG: Status not mapped to live: "${apiStatus}"`);
  return "TIMED";
};

function adjustMatchesDynamically(matches: any[]): any[] {
  if (!Array.isArray(matches)) return [];
  const now = Date.now();

  return matches.map((m: any) => {
    if (!m) return m;

    const statusUpper = String(m.status || "").toUpperCase();
    const isScheduled = ["TIMED", "SCHEDULED"].includes(statusUpper);

    if (m.utcDate) {
      const matchTime = new Date(m.utcDate).getTime();
      if (!isNaN(matchTime)) {
        if (now >= matchTime) {
          if (isScheduled) {
            // Less than 120 minutes since kickoff -> mark as IN_PLAY
            if (now - matchTime < 120 * 60 * 1000) {
              const updatedScore = m.score ? { ...m.score } : { fullTime: { home: 0, away: 0 } };
              if (!updatedScore.fullTime) {
                updatedScore.fullTime = { home: 0, away: 0 };
              } else {
                updatedScore.fullTime = {
                  home: updatedScore.fullTime.home ?? 0,
                  away: updatedScore.fullTime.away ?? 0
                };
              }
              return {
                ...m,
                status: "IN_PLAY",
                score: updatedScore
              };
            } else {
              // More than 120 minutes since kickoff -> mark as FINISHED
              const updatedScore = m.score ? { ...m.score } : { fullTime: { home: 0, away: 0 } };
              if (!updatedScore.fullTime) {
                updatedScore.fullTime = { home: 0, away: 0 };
              } else {
                updatedScore.fullTime = {
                  home: updatedScore.fullTime.home ?? 0,
                  away: updatedScore.fullTime.away ?? 0
                };
              }
              return {
                ...m,
                status: "FINISHED",
                score: updatedScore
              };
            }
          } else if (statusUpper === "IN_PLAY") {
            const updatedScore = m.score ? { ...m.score } : { fullTime: { home: 0, away: 0 } };
            if (!updatedScore.fullTime) {
              updatedScore.fullTime = { home: 0, away: 0 };
            } else {
              updatedScore.fullTime = {
                home: updatedScore.fullTime.home ?? 0,
                away: updatedScore.fullTime.away ?? 0
              };
            }
            return {
              ...m,
              score: updatedScore
            };
          }
        }
      }
    }
    return m;
  });
}

const getMockFriendlyMatchesForDate = (targetDate: string): any[] => {
  return [];
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

// Background sync system for matches cache
const lastCompetitionFetchTime: Record<string, number> = {};

async function updateActiveCompetitionsCache() {
  if (!supabase) return;
  try {
    const activeProvider = getActiveApiProvider();
    
    // 1. Get unresolved challenges to see what competitions are active
    const { data: challenges, error } = await supabase
      .from("challenges")
      .select("competition_id")
      .eq("resolved", false);

    if (error) {
      console.error("[Background Sync] Error fetching active challenges:", error);
      return;
    }

    const competitionIds = Array.from(
      new Set(
        (challenges || [])
          .map((c: any) => Number(c.competition_id))
          .filter((id) => id && !isNaN(id))
      )
    );

    // If there are no active competitions in unresolved challenges, default to Euros (2018) so we keep something warm
    if (competitionIds.length === 0) {
      competitionIds.push(2018);
    }

    const now = Date.now();

    for (const compId of competitionIds) {
      const cacheKey = `comp_${compId}_${activeProvider}_current`;
      
      // Determine if there is any live match currently or upcoming in the next 3 hours
      let isLiveOrUpcoming = false;
      const cached = apiCache[cacheKey] || loadPersistentCache(cacheKey);
      
      if (cached && cached.data && cached.data.matches) {
        const matches = cached.data.matches;
        const threeHours = 3 * 60 * 60 * 1000;
        
        isLiveOrUpcoming = matches.some((m: any) => {
          const isLiveStatus = ["IN_PLAY", "PAUSED", "LIVE"].includes(m.status);
          if (isLiveStatus) return true;
          
          if (m.utcDate) {
            const mTime = new Date(m.utcDate).getTime();
            const diff = mTime - now;
            // Starts in <= 3 hours or finished within the last 2 hours
            if (diff > -2 * 60 * 60 * 1000 && diff < threeHours) {
              return true;
            }
          }
          return false;
        });
      } else {
        // If there's no cache at all, force fetch it
        isLiveOrUpcoming = true;
      }

      // Check throttle:
      // - If live or upcoming: fetch every 30 seconds
      // - If quiet: fetch every 5 minutes (300,000 ms)
      const lastFetch = lastCompetitionFetchTime[cacheKey] || 0;
      const threshold = isLiveOrUpcoming ? 30000 : 300000;

      if (now - lastFetch < threshold) {
        // Still within throttle threshold, skip fetching this competition
        continue;
      }

      console.log(`[Background Sync] Fetching fresh data for competition ${compId} (${isLiveOrUpcoming ? "LIVE/UPCOMING" : "QUIET"})...`);
      lastCompetitionFetchTime[cacheKey] = now;

      let freshMatches: any[] = [];

      if (compId === 679) {
        // Matchs Amicaux (Special custom handling via api-football)
        const apiKey = process.env.API_FOOTBALL_KEY;
        if (!apiKey) continue;

        const todayStr = new Date().toISOString().split("T")[0];
        let todayFriendlies: any[] = [];
        try {
          const todayResponse = await rateLimitedFetch(
            `https://v3.football.api-sports.io/fixtures?date=${todayStr}`,
            { headers: { "x-apisports-key": apiKey } }
          );
          if (todayResponse.ok) {
            const todayData = await todayResponse.json();
            if (!(todayData.errors && todayData.errors.requests)) {
              const todayFixtures = todayData.response || [];
              const friendlyFixtures = todayFixtures.filter((f: any) => f.league && f.league.id === 10);
              todayFriendlies = friendlyFixtures.map(translateApiFootballMatchToFootballData).filter(Boolean);
            }
          }
        } catch (e) {
          console.error(`[Background Sync] Error today friendlies:`, e);
        }

        try {
          const response = await rateLimitedFetch(
            `https://v3.football.api-sports.io/fixtures?league=10&season=2024`,
            { headers: { "x-apisports-key": apiKey } }
          );
          if (response.ok) {
            const data = await response.json();
            const fixtures = data.response || [];
            freshMatches = fixtures.map(translateApiFootballMatchToFootballData).filter(Boolean);
            
            if (todayFriendlies.length > 0) {
              const existingIds = new Set(freshMatches.map((m: any) => m.id));
              todayFriendlies.forEach((m: any) => {
                if (!existingIds.has(m.id)) {
                  freshMatches.unshift(m);
                }
              });
            }
          }
        } catch (e) {
          console.error(`[Background Sync] Error friendly matches:`, e);
        }
      } else {
        if (activeProvider === "api-football") {
          const apiKey = process.env.API_FOOTBALL_KEY;
          if (!apiKey) continue;

          const mappedLeagueId = COMPETITION_ID_MAP[compId];
          if (mappedLeagueId) {
            try {
              const season = getSeasonYearForLeague(mappedLeagueId);
              const response = await rateLimitedFetch(
                `https://v3.football.api-sports.io/fixtures?league=${mappedLeagueId}&season=${season}`,
                { headers: { "x-apisports-key": apiKey } }
              );
              if (response.ok) {
                const data = await response.json();
                const fixtures = data.response || [];
                freshMatches = fixtures.map(translateApiFootballMatchToFootballData).filter(Boolean);
              }
            } catch (e) {
              console.error(`[Background Sync] Error api-football comp ${compId}:`, e);
            }
          }
        } else {
          // football-data.org
          const apiKey = process.env.FOOTBALL_DATA_KEY;
          if (!apiKey) continue;

          try {
            const response = await rateLimitedFetch(
              `https://api.football-data.org/v4/competitions/${compId}/matches`,
              { headers: { "X-Auth-Token": apiKey } }
            );
            if (response.ok) {
              const data = await response.json();
              freshMatches = data.matches || [];
            }
          } catch (e) {
            console.error(`[Background Sync] Error football-data comp ${compId}:`, e);
          }
        }
      }

      if (freshMatches && freshMatches.length > 0) {
        const cachedResult = { matches: freshMatches };
        apiCache[cacheKey] = { data: cachedResult, timestamp: now };
        savePersistentCache(cacheKey, cachedResult);
        console.log(`[Background Sync] Cache updated for ${cacheKey} (${freshMatches.length} matches)`);
      }
    }
  } catch (err) {
    console.error("[Background Sync] Error during background synchronization:", err);
  }
}

// Start background sync job on startup
function startBackgroundSyncJob() {
  // Run first update after 5 seconds of server startup to give server time to boot fully
  setTimeout(() => {
    updateActiveCompetitionsCache();
  }, 5000);

  // Run every 30 seconds
  setInterval(() => {
    updateActiveCompetitionsCache();
  }, 30000);
}

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
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (body && Array.isArray(body.matches)) {
        body = {
          ...body,
          matches: adjustMatchesDynamically(body.matches)
        };
      }
      return originalJson(body);
    };

    const activeProvider = getActiveApiProvider();
    const targetDate = req.query.date ? String(req.query.date) : new Date().toISOString().split("T")[0];
    const cacheKey = `today_${activeProvider}_${targetDate}`;
    const now = Date.now();

    try {
      const bypassCache = req.query.refresh === "true";
      if (!bypassCache && apiCache[cacheKey] && (now - apiCache[cacheKey].timestamp < TODAY_CACHE_TTL)) {
        return res.json(apiCache[cacheKey].data);
      }

      // Proactive rate limit protection
      const forceCache = globalFootballDataAvailableRequests <= 1 && Date.now() < globalFootballDataResetTimestamp;
      const hasCache = !!apiCache[cacheKey];
      const persistentCache = loadPersistentCache(cacheKey);

      if (!bypassCache && forceCache && (hasCache || persistentCache)) {
        console.log(`[Rate Limiter] Proactively avoiding API call for today matches to protect rate limit (available: ${globalFootballDataAvailableRequests}). Serving cache.`);
        if (hasCache) {
          return res.json(apiCache[cacheKey].data);
        } else if (persistentCache) {
          apiCache[cacheKey] = { data: persistentCache, timestamp: now };
          return res.json(persistentCache);
        }
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

        try {
          const response = await rateLimitedFetch(
            `https://v3.football.api-sports.io/fixtures?date=${targetDate}`,
            {
              headers: { "x-apisports-key": apiKey },
            },
          );

          if (!response.ok) throw new Error("API-Football Error");
          const data = await response.json();

          // Handle API-Football rate limits gracefully
          if (data && data.errors && Object.keys(data.errors).length > 0) {
            console.error("API-Football returned errors in /api/matches/today:", data.errors);
            if (data.errors.requests || data.errors.token || data.errors.apiKey) {
              throw new Error(`API-Football error: ${JSON.stringify(data.errors)}`);
            }
          }

          const fixtures = data.response || [];
          
          fixtures.forEach((f: any) => {
              console.log(`DEBUG Match ${f.fixture.id}: ${f.teams.home.name} vs ${f.teams.away.name}, status code: ${f.fixture.status.short}`);
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
          savePersistentCache(cacheKey, cachedResult);
          return res.json(cachedResult);
        } catch (apiErr) {
          console.error("API-Football error in today's matches, attempting fallback:", apiErr);
          
          const persistentCache = loadPersistentCache(cacheKey);
          if (persistentCache) {
            apiCache[cacheKey] = { data: persistentCache, timestamp: now };
            return res.json(persistentCache);
          }

          // Try loading from World Cup fallback matches for today
          try {
            const fallbackData = JSON.parse(fs.readFileSync('./world_cup_fallback.json', 'utf-8'));
            const matches = fallbackData.matches || [];
            const matchesToday = matches.filter((m: any) => m.utcDate.startsWith(targetDate));
            if (matchesToday.length > 0) {
              console.log(`Loaded ${matchesToday.length} fallback World Cup matches for date ${targetDate}`);
              const fallbackResult = { matches: matchesToday };
              apiCache[cacheKey] = { data: fallbackResult, timestamp: now };
              return res.json(fallbackResult);
            }
          } catch (fallbackErr) {
            console.error("Failed to load today's fallback World Cup matches:", fallbackErr);
          }

          throw apiErr;
        }
      }

      // If activeProvider is football-data, we also fetch today's friendly matches (league 10) from api-football.com if available
      let friendlyMatches: any[] = getMockFriendlyMatchesForDate(targetDate);
      const apiKeyFootball = process.env.API_FOOTBALL_KEY;
      if (apiKeyFootball) {
        try {
          const response = await rateLimitedFetch(
            `https://v3.football.api-sports.io/fixtures?date=${targetDate}`,
            {
              headers: { "x-apisports-key": apiKeyFootball },
            },
          );
          if (response.ok) {
            const data = await response.json();
            if (data.errors && data.errors.requests) {
              console.error("API-football ratelimit hit for friendly matches");
            } else {
              const fixtures = data.response || [];
              const friendlyFixtures = fixtures.filter((f: any) => f.league && f.league.id === 10);
              const mapped = friendlyFixtures
                .map(translateApiFootballMatchToFootballData)
                .filter(Boolean);
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

      try {
        const response = await rateLimitedFetch(`https://api.football-data.org/v4/matches?dateFrom=${targetDate}&dateTo=${targetDate}`, {
          headers: { "X-Auth-Token": apiKey },
        });

        if (!response.ok) throw new Error(`API Error status ${response.status}`);
        const data = await response.json();

        if (data.errorCode || data.message || !data.matches) {
          throw new Error(`API error or missing matches: ${data.errorCode || data.message}`);
        }

        if (friendlyMatches.length > 0 && data && Array.isArray(data.matches)) {
          data.matches = [...data.matches, ...friendlyMatches];
        }
        
        apiCache[cacheKey] = { data: data, timestamp: now };
        savePersistentCache(cacheKey, data);
        res.json(data);
      } catch (fdErr) {
        console.error("Football-Data fetch error in today endpoint, trying fallback:", fdErr);

        const persistentCache = loadPersistentCache(cacheKey);
        if (persistentCache) {
          apiCache[cacheKey] = { data: persistentCache, timestamp: now };
          return res.json(persistentCache);
        }

        // Try loading from World Cup fallback matches for today
        try {
          const fallbackData = JSON.parse(fs.readFileSync('./world_cup_fallback.json', 'utf-8'));
          const matches = fallbackData.matches || [];
          const matchesToday = matches.filter((m: any) => m.utcDate.startsWith(targetDate));
          if (matchesToday.length > 0) {
            console.log(`Loaded ${matchesToday.length} fallback World Cup matches for date ${targetDate} (FD fallback)`);
            const fallbackResult = { matches: matchesToday };
            apiCache[cacheKey] = { data: fallbackResult, timestamp: now };
            return res.json(fallbackResult);
          }
        } catch (fallbackErr) {
          console.error("Failed to load today's fallback World Cup matches (FD fallback):", fallbackErr);
        }

        throw fdErr;
      }
    } catch (err) {
      console.error("All today's matches fetch strategies failed:", err);
      // Return empty matches array gracefully so front-end does not crash, but logs are clean
      res.json({ matches: [] });
    }
  });

  app.get("/api/matches/:competitionId", async (req, res) => {
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (body && Array.isArray(body.matches)) {
        body = {
          ...body,
          matches: adjustMatchesDynamically(body.matches)
        };
      }
      return originalJson(body);
    };

    const activeProvider = getActiveApiProvider();
    const fdCompId = Number(req.params.competitionId);
    const reqSeason = req.query.season ? Number(req.query.season) : null;

    const cacheKey = `comp_${fdCompId}_${activeProvider}_${reqSeason || "current"}`;
    const now = Date.now();

    try {
      const bypassCache = req.query.refresh === "true";
      if (!bypassCache && apiCache[cacheKey]) {
        let currentTtl = COMP_CACHE_TTL;
        const cachedData = apiCache[cacheKey].data;
        if (cachedData && Array.isArray(cachedData.matches)) {
          const todayStr = new Date().toISOString().split("T")[0];
          const fourHoursAgo = now - 4 * 60 * 60 * 1000;
          const fourHoursAhead = now + 4 * 60 * 60 * 1000;

          const hasActiveOrTodayMatch = cachedData.matches.some((m: any) => {
            const matchStatus = String(m.status || "").toUpperCase();
            const isLive = ["IN_PLAY", "LIVE", "PAUSED", "LIVE_FIRST_HALF", "LIVE_SECOND_HALF", "HT", "1H", "2H"].includes(matchStatus);
            if (isLive) return true;

            if (m.utcDate) {
              const matchTime = new Date(m.utcDate).getTime();
              const isAroundNow = matchTime >= fourHoursAgo && matchTime <= fourHoursAhead;
              const isToday = m.utcDate.startsWith(todayStr);
              return isAroundNow || isToday;
            }
            return false;
          });

          if (hasActiveOrTodayMatch) {
            currentTtl = TODAY_CACHE_TTL; // 60 seconds
          }
        }

        if (now - apiCache[cacheKey].timestamp < currentTtl) {
          return res.json(apiCache[cacheKey].data);
        }
      }

      // Proactive rate limit protection
      const forceCache = globalFootballDataAvailableRequests <= 1 && Date.now() < globalFootballDataResetTimestamp;
      const hasCache = !!apiCache[cacheKey];
      const persistentCache = loadPersistentCache(cacheKey);

      if (!bypassCache && forceCache && (hasCache || persistentCache)) {
        console.log(`[Rate Limiter] Proactively avoiding API call to protect rate limit (available: ${globalFootballDataAvailableRequests}). Serving cache.`);
        if (hasCache) {
          return res.json(apiCache[cacheKey].data);
        } else if (persistentCache) {
          apiCache[cacheKey] = { data: persistentCache, timestamp: now };
          return res.json(persistentCache);
        }
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
          const todayResponse = await rateLimitedFetch(
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

        try {
          let season = reqSeason || getSeasonYearForLeague(10);
          let response = await rateLimitedFetch(
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

          // Handle Free Plan restrictions or rate limits gracefully
          if (data && data.errors && Object.keys(data.errors).length > 0) {
            if (data.errors.requests || data.errors.token || data.errors.apiKey) {
              throw new Error(`API-Football error: ${JSON.stringify(data.errors)}`);
            }
            const hasPlanError = JSON.stringify(data.errors).toLowerCase().includes("plan");
            if (hasPlanError) {
              console.log("Free plan restriction detected for season", season, "- Falling back to season 2024.");
              season = 2024;
              response = await rateLimitedFetch(
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
          savePersistentCache(cacheKey, cachedResult);
          return res.json(cachedResult);
        } catch (apiErr) {
          console.error("API-Football error in 679 endpoint, trying fallback:", apiErr);
          const persistentCache = loadPersistentCache(cacheKey);
          if (persistentCache) {
            apiCache[cacheKey] = { data: persistentCache, timestamp: now };
            return res.json(persistentCache);
          }
          throw apiErr;
        }
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

        try {
          let season = reqSeason || getSeasonYearForLeague(mappedLeagueId);
          let response = await rateLimitedFetch(
            `https://v3.football.api-sports.io/fixtures?league=${mappedLeagueId}&season=${season}`,
            {
              headers: { "x-apisports-key": apiKey },
            },
          );

          if (!response.ok) throw new Error("API-Football Error");
          let data = await response.json();

          // Handle rate-limits or other API errors:
          if (data && data.errors && Object.keys(data.errors).length > 0) {
            console.error(`API-Football returned errors in /api/matches/${fdCompId}:`, data.errors);
            if (data.errors.requests || data.errors.token || data.errors.apiKey) {
              throw new Error(`API-Football error: ${JSON.stringify(data.errors)}`);
            }
          }

          // Handle Free Plan restrictions gracefully
          if (data && data.errors && Object.keys(data.errors).length > 0) {
            const hasPlanError = JSON.stringify(data.errors).toLowerCase().includes("plan");
            if (hasPlanError) {
              console.log("Free plan restriction detected for season", season, "- Falling back to season 2024.");
              season = 2024;
              response = await rateLimitedFetch(
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

          if (mappedMatches.length === 0) {
            throw new Error(`No matches returned from API-Football for competition ${fdCompId}`);
          }

          const cachedResult = { matches: mappedMatches };
          apiCache[cacheKey] = { data: cachedResult, timestamp: now };
          savePersistentCache(cacheKey, cachedResult);
          return res.json(cachedResult);
        } catch (apiErr) {
          console.error("API-Football error, trying fallback:", apiErr);
          
          const persistentCache = loadPersistentCache(cacheKey);
          if (persistentCache) {
            apiCache[cacheKey] = { data: persistentCache, timestamp: now };
            return res.json(persistentCache);
          }

          if (fdCompId === 2000) {
            console.log("Using local fallback for World Cup (competition 2000) on API-Football error");
            const fallbackData = JSON.parse(fs.readFileSync('./world_cup_fallback.json', 'utf-8'));
            apiCache[cacheKey] = { data: fallbackData, timestamp: now };
            return res.json(fallbackData);
          }
          throw apiErr;
        }
      }

      const apiKey = process.env.FOOTBALL_DATA_API_KEY;
      if (!apiKey) return res.status(401).json({ error: "Clé API manquante" });

      try {
        const response = await rateLimitedFetch(
          `https://api.football-data.org/v4/competitions/${req.params.competitionId}/matches`,
          {
            headers: { "X-Auth-Token": apiKey },
          },
        );

        if (!response.ok) throw new Error(`API Error status ${response.status}`);
        const data = await response.json();

        if (data.errorCode || data.message || !data.matches) {
          throw new Error(`API error or missing matches: ${data.errorCode || data.message}`);
        }
        // Additional sanity check: if the API somehow returned 0 matches but we expected a full competition,
        // we might want to throw to trigger fallback.
        if (Array.isArray(data.matches) && data.matches.length === 0) {
           throw new Error(`API returned 0 matches for competition ${fdCompId}, triggering fallback`);
        }

        apiCache[cacheKey] = { data, timestamp: now };
        savePersistentCache(cacheKey, data);
        res.json(data);
      } catch (apiErr) {
        console.error("Football-Data API error, trying fallback:", apiErr);

        const persistentCache = loadPersistentCache(cacheKey);
        if (persistentCache) {
          apiCache[cacheKey] = { data: persistentCache, timestamp: now };
          return res.json(persistentCache);
        }

        if (fdCompId === 2000) {
          console.log("Using local fallback for World Cup (competition 2000) on Football-Data error");
          const fallbackData = JSON.parse(fs.readFileSync('./world_cup_fallback.json', 'utf-8'));
          apiCache[cacheKey] = { data: fallbackData, timestamp: now };
          return res.json(fallbackData);
        }
        throw apiErr;
      }
    } catch (err) {
      console.error("All fetch strategies failed for competition:", err);
      res.status(500).json({ error: "Erreur réseau" });
    }
  });

  // Helper to auto-resolve unresolved challenges
  async function runChallengeResolution() {
    if (!supabase) return 0;
    try {
      const activeProvider = getActiveApiProvider();
      const apiKeyFD = process.env.FOOTBALL_DATA_API_KEY;
      const apiKeyFootball = process.env.API_FOOTBALL_KEY;

      const { data: challenges } = await supabase
        .from("challenges")
        .select("*")
        .eq("resolved", false);

      if (!challenges || challenges.length === 0) {
        return 0;
      }

      const now = Date.now();
      const eligibleChallenges = challenges.filter((c: any) => {
        if (c.type === "bracket" || c.match_id === 0 || c.match_id === 999999 || !c.match_id) {
          return false;
        }
        if (!c.match_date) return false;
        // Only resolve challenges whose match has started or finished (match_date is in the past)
        return new Date(c.match_date).getTime() < now;
      });

      if (eligibleChallenges.length === 0) {
        return 0;
      }

      let resolvedCount = 0;

      for (const challenge of eligibleChallenges) {
        let matchData: any = null;

        if (
          (challenge.competition_id === 679 ||
            activeProvider === "api-football") &&
          apiKeyFootball
        ) {
          try {
            const matchRes = await rateLimitedFetch(
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

        if (!matchData && apiKeyFD) {
          try {
            const matchRes = await rateLimitedFetch(
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
        if (challenge.match_id === 0) continue; // Multi-match resolution requires competition fetch

        const activeStatuses = ["FINISHED", "IN_PLAY", "LIVE", "PAUSED", "1H", "2H", "HT"];
        if (activeStatuses.includes(matchData.status)) {
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
                Number(pred.homeScore) === Number(homeScore) && Number(pred.awayScore) === Number(awayScore);

              let predWinner = "draw";
              if (Number(pred.homeScore) > Number(pred.awayScore)) predWinner = "home";
              else if (Number(pred.homeScore) < Number(pred.awayScore)) predWinner = "away";

              if (!isExact && predWinner === actualWinner) {
                const distance =
                  Math.abs(Number(pred.homeScore) - Number(homeScore)) +
                  Math.abs(Number(pred.awayScore) - Number(awayScore));
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
                Number(pred.homeScore) === Number(homeScore) && Number(pred.awayScore) === Number(awayScore);

              let predWinner = "draw";
              if (Number(pred.homeScore) > Number(pred.awayScore)) predWinner = "home";
              else if (Number(pred.homeScore) < Number(pred.awayScore)) predWinner = "away";

              const distance =
                Math.abs(Number(pred.homeScore) - Number(homeScore)) +
                Math.abs(Number(pred.awayScore) - Number(awayScore));

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
                
              if (matchData.status === "FINISHED") {
                try {
                  // First, try using the RPC function for atomicity
                  const { error: rpcError } = await supabase.rpc("increment_user_points", {
                    user_uuid: bet.user_id,
                    points_to_add: points,
                  });
                  
                  // Fallback: If RPC call fails or for safety, update directly by fetching then setting
                  if (rpcError) {
                    console.error("RPC increment_user_points failed, attempting direct update.", rpcError);
                    const { data: profileData, error: profileError } = await supabase
                      .from("profiles")
                      .select("points")
                      .eq("id", bet.user_id)
                      .single();
                    
                    if (!profileError && profileData) {
                      const newPoints = (profileData.points || 0) + points;
                      await supabase
                        .from("profiles")
                        .update({ points: newPoints })
                        .eq("id", bet.user_id);
                       console.log("Successfully updated points for", bet.user_id, "via direct update to", newPoints);
                    } else {
                        console.error("Failed to fetch/update profile directly", profileError);
                    }
                  } else {
                    console.log("Successfully incremented points for", bet.user_id, points);
                  }
                } catch (e) {
                  console.error("Exception in increment_user_points", e);
                }
              }
            }
          }

          if (matchData.status === "FINISHED") {
            await supabase
              .from("challenges")
              .update({ resolved: true })
              .eq("id", challenge.id);
            resolvedCount++;
          }
        }
      }
      return resolvedCount;
    } catch (e) {
      console.error("Exception during background runChallengeResolution:", e);
      return 0;
    }
  }

  // Auto-resolve cron/interval running every 5 minutes
  setInterval(async () => {
    try {
      const resolved = await runChallengeResolution();
      if (resolved > 0) {
        console.log(`[Auto-Resolve] Automatically resolved ${resolved} unresolved challenges.`);
      }
    } catch (err) {
      console.error("Auto-resolve setInterval error:", err);
    }
  }, 300000);

  // Admin endpoint to manually resolve challenges
  app.post("/api/admin/resolve-challenges", async (req, res) => {
    if (!supabase)
      return res
        .status(500)
        .json({
          error: "Configuration Supabase manquante (Service Role Key requise).",
        });
    try {
      const resolvedCount = await runChallengeResolution();
      res.json({
        message: `Résolution terminée. ${resolvedCount} défis résolus.`,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Dedicated endpoint to resolve tournament bracket challenges and calculate points
  app.post("/api/challenges/resolve-bracket", async (req, res) => {
    if (!supabase) {
      return res.status(500).json({ error: "Configuration Supabase manquante." });
    }
    try {
      const { challengeId, actualBracketPicks, userId } = req.body;
      if (!challengeId || !actualBracketPicks || !userId) {
        return res.status(400).json({ error: "Données requises manquantes." });
      }

      // 1. Fetch challenge and verify creator ownership
      const { data: challenge, error: challengeError } = await supabase
        .from("challenges")
        .select("*")
        .eq("id", challengeId)
        .single();

      if (challengeError || !challenge) {
        return res.status(404).json({ error: "Défi non trouvé." });
      }

      if (challenge.creator_id !== userId) {
        return res.status(403).json({ error: "Seul le créateur du défi peut le résoudre." });
      }

      // Helper function to calculate points
      const calculatePoints = (userPicksObj: any, actualResultsObj: any) => {
        if (!actualResultsObj || !userPicksObj) return 0;
        let points = 0;

        // Round of 16
        const actualR16 = Object.values(actualResultsObj.r16 || {}).filter(Boolean);
        const userR16 = Object.values(userPicksObj.r16 || {}).filter(Boolean);
        actualR16.forEach(teamId => {
          if (userR16.includes(teamId)) points += 100;
        });

        // Quarter-finals
        const actualR8 = Object.values(actualResultsObj.r8 || {}).filter(Boolean);
        const userR8 = Object.values(userPicksObj.r8 || {}).filter(Boolean);
        actualR8.forEach(teamId => {
          if (userR8.includes(teamId)) points += 200;
        });

        // Semi-finals
        const actualR4 = Object.values(actualResultsObj.r4 || {}).filter(Boolean);
        const userR4 = Object.values(userPicksObj.r4 || {}).filter(Boolean);
        actualR4.forEach(teamId => {
          if (userR4.includes(teamId)) points += 300;
        });

        // Finalists
        const actualR2 = Object.values(actualResultsObj.r2 || {}).filter(Boolean);
        const userR2 = Object.values(userPicksObj.r2 || {}).filter(Boolean);
        actualR2.forEach(teamId => {
          if (userR2.includes(teamId)) points += 400;
        });

        // Semis bonus (guess all 4 correct)
        const correctR4 = actualR4.filter(teamId => userR4.includes(teamId)).length;
        if (correctR4 === 4 && actualR4.length === 4) points += 1000;

        // Final bonus (guess 2 correct)
        const correctR2 = actualR2.filter(teamId => userR2.includes(teamId)).length;
        if (correctR2 === 2 && actualR2.length === 2) points += 2000;

        // Winner bonus
        if (actualResultsObj.winner && userPicksObj.winner === actualResultsObj.winner) {
          points += 2000;
        }

        return points;
      };

      // 2. Fetch all bets for this challenge
      const { data: bets, error: betsError } = await supabase
        .from("bets")
        .select("*")
        .eq("challenge_id", challengeId);

      if (betsError) {
        throw betsError;
      }

      // 3. Process each bet and update points
      if (bets && bets.length > 0) {
        for (const bet of bets) {
          const userPicks = typeof bet.predictions === "string" 
            ? JSON.parse(bet.predictions) 
            : bet.predictions;
          
          // Calculate new points
          const points = calculatePoints(userPicks, actualBracketPicks);

          // Get previous points awarded to calculate the delta (guarantees idempotence)
          const previousPoints = bet.points_awarded || 0;
          const delta = points - previousPoints;

          // Update the bet with points_awarded
          await supabase
            .from("bets")
            .update({ points_awarded: points })
            .eq("id", bet.id);

          // Update user profile total points
          if (delta !== 0) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("points")
              .eq("id", bet.user_id)
              .single();
            
            if (profile) {
              const newPoints = (profile.points || 0) + delta;
              await supabase
                .from("profiles")
                .update({ points: newPoints })
                .eq("id", bet.user_id);
            }
          }
        }
      }

      // 4. Update challenge point_rules with actual bracket picks and set resolved to true
      const currentPointRules = typeof challenge.point_rules === "string"
        ? JSON.parse(challenge.point_rules)
        : challenge.point_rules || {};

      const updatedPointRules = {
        ...currentPointRules,
        actualBracketPicks,
      };

      await supabase
        .from("challenges")
        .update({
          resolved: true,
          point_rules: updatedPointRules
        })
        .eq("id", challengeId);

      res.json({ success: true, message: "Défi bracket résolu avec succès." });
    } catch (err) {
      console.error("Error resolving bracket challenge:", err);
      res.status(500).json({ error: "Erreur serveur lors de la résolution du défi." });
    }
  });

  // Proxy endpoint to save bets safely and bypass client-side network blocks / CORS issues
  app.post("/api/bets/upsert", async (req, res) => {
    if (!supabase) {
      return res.status(500).json({ error: "Configuration Supabase manquante." });
    }
    try {
      const { user_id, challenge_id, predictions } = req.body;
      if (!user_id || !challenge_id || !predictions) {
        return res.status(400).json({ error: "Données requises manquantes." });
      }

      const { data, error } = await supabase
        .from("bets")
        .upsert({
          user_id,
          challenge_id,
          predictions,
        }, { onConflict: "user_id,challenge_id" })
        .select();

      if (error) {
        console.error("Error upserting bet in backend:", error);
        return res.status(500).json({ error: error.message });
      }

      res.json({ success: true, data });
    } catch (err: any) {
      console.error("Error in bets upsert endpoint:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Proxy endpoint to fetch a single bet
  app.get("/api/bets", async (req, res) => {
    if (!supabase) {
      return res.status(500).json({ error: "Configuration Supabase manquante." });
    }
    try {
      const { userId, challengeId } = req.query;
      if (!userId || !challengeId) {
        return res.status(400).json({ error: "userId et challengeId requis." });
      }

      const { data, error } = await supabase
        .from("bets")
        .select("*")
        .eq("challenge_id", challengeId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      res.json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Endpoint to fetch all bets for a challenge along with participant profiles
  app.get("/api/challenges/:challengeId/bets", async (req, res) => {
    if (!supabase) {
      return res.status(500).json({ error: "Configuration Supabase manquante." });
    }
    try {
      const { challengeId } = req.params;
      if (!challengeId) {
        return res.status(400).json({ error: "challengeId est requis." });
      }

      // 1. Fetch all bets for this challenge
      const { data: bets, error: betsError } = await supabase
        .from("bets")
        .select("*")
        .eq("challenge_id", challengeId);

      if (betsError) {
        console.error("Error fetching bets for challenge:", betsError);
        return res.status(500).json({ error: betsError.message });
      }

      // 1b. Fetch all accepted invitations for this challenge to find users who joined but didn't bet yet
      const { data: invites, error: invitesError } = await supabase
        .from("challenge_invitations")
        .select("user_id")
        .eq("challenge_id", challengeId);

      if (invitesError) {
        console.error("Error fetching invitations for challenge:", invitesError);
      }

      // 1c. Fetch challenge creator to ensure they are always included in the participant list
      const { data: challenge, error: challengeError } = await supabase
        .from("challenges")
        .select("creator_id")
        .eq("id", challengeId)
        .maybeSingle();

      if (challengeError) {
        console.error("Error fetching challenge creator:", challengeError);
      }

      // Combine user IDs
      const allUserIds = new Set<string>();
      if (bets) bets.forEach(b => { if (b.user_id) allUserIds.add(b.user_id); });
      if (invites) invites.forEach(i => { if (i.user_id) allUserIds.add(i.user_id); });
      if (challenge && challenge.creator_id) {
        allUserIds.add(challenge.creator_id);
      }

      const userIds = Array.from(allUserIds).filter(id => id && typeof id === "string" && id.trim() !== "");
      let profiles: any[] = [];
      if (userIds.length > 0) {
        const now = Date.now();
        // Determine which user IDs are missing from cache or have expired entries
        const missingUserIds = userIds.filter(id => {
          const cached = profilesCache[id];
          return !cached || (now - cached.timestamp > PROFILES_CACHE_TTL);
        });

        if (missingUserIds.length > 0) {
          console.log(`[Profiles Cache] Fetching ${missingUserIds.length} missing profiles from DB...`);
          const { data: profs, error: profsError } = await supabase
            .from("profiles")
            .select("id, username, first_name, last_name, avatar_type, avatar_value, points")
            .in("id", missingUserIds);
          
          if (profsError) {
            console.error("Error fetching profiles for bets:", profsError);
          } else if (profs) {
            profs.forEach(p => {
              profilesCache[p.id] = { data: p, timestamp: now };
            });
            // Mark any user ID that was requested but not returned in profs as data: null (so we don't query it again for PROFILES_CACHE_TTL)
            missingUserIds.forEach(id => {
              if (!profilesCache[id]) {
                profilesCache[id] = { data: null, timestamp: now };
              }
            });
          }
        }

        // Gather all profiles from the cache
        profiles = userIds.map(id => profilesCache[id]?.data).filter(Boolean);
      }

      // Map profiles to bets (or placeholders for users who haven't bet yet)
      const results = userIds.map(uId => {
        const bet = bets ? bets.find(b => b.user_id === uId) : null;
        const profile = profiles.find(p => p.id === uId);
        
        return {
          id: bet?.id || `placeholder-${uId}`,
          challenge_id: challengeId,
          user_id: uId,
          predictions: bet?.predictions || { r16: {}, r8: {}, r4: {}, r2: {}, winner: "" },
          points_awarded: bet?.points_awarded || 0,
          created_at: bet?.created_at || new Date().toISOString(),
          username: profile?.username || "Joueur Anonyme",
          first_name: profile?.first_name || "",
          last_name: profile?.last_name || "",
          avatar_type: profile?.avatar_type || "emoji",
          avatar_value: profile?.avatar_value || "⚽",
          profile_points: profile?.points || 0
        };
      });

      res.json({ bets: results });
    } catch (err: any) {
      console.error("Error in challenge bets endpoint:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Endpoint to generate random test/mock participants and predictions
  app.post("/api/challenges/:challengeId/seed-mock-bets", async (req, res) => {
    if (!supabase) {
      return res.status(500).json({ error: "Configuration Supabase manquante." });
    }
    try {
      const { challengeId } = req.params;
      const { count } = req.body;
      const seedCount = Number(count) || 5;

      const baseMockNames = [
        "Simulateur_Pro", "PronoBot_99", "LeSorcier", "L_Expert", "Footix_75", 
        "Tactico_Elite", "GoalBuster", "Challenger_3000", "GoldPredic"
      ];
      // Select random subset of names
      const mockNames = [...baseMockNames].sort(() => Math.random() - 0.5).slice(0, seedCount);
      const createdBets = [];

      const pickRandom = (teamA: string, teamB: string) => (Math.random() < 0.5 ? teamA : teamB);

      for (const name of mockNames) {
        // Create a unique deterministic UUID format for this mock user
        const fakeUserId = `00000000-0000-4000-a000-${name.toLowerCase().padEnd(12, '0').substring(0, 12)}`;

        // Check/Insert Profile
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", fakeUserId)
          .maybeSingle();

        if (!existingProfile) {
          await supabase.from("profiles").insert({
            id: fakeUserId,
            username: name,
            avatar_type: "emoji",
            avatar_value: ["⚽", "🏆", "🦁", "🔥", "👑", "🎯", "⚡", "🦊", "🐯", "🐼"][Math.floor(Math.random() * 10)],
            points: Math.floor(Math.random() * 3) * 100 // some starting virtual points
          });
        }

        // Generate a fully valid prediction bracket
        const picks: any = {
          r16: {},
          r8: {},
          r4: {},
          r2: {},
          winner: ""
        };

        // 1. R32 to R16
        picks.r16["R16_L1_H"] = pickRandom("GER", "SCO");
        picks.r16["R16_L1_A"] = pickRandom("FRA", "SWE");
        picks.r16["R16_L2_H"] = pickRandom("KOR", "SUI");
        picks.r16["R16_L2_A"] = pickRandom("NED", "MAR");
        picks.r16["R16_L3_H"] = pickRandom("COL", "GHA");
        picks.r16["R16_L3_A"] = pickRandom("ESP", "AUT");
        picks.r16["R16_L4_H"] = pickRandom("USA", "ALG");
        picks.r16["R16_L4_A"] = pickRandom("EGY", "CZE");

        picks.r16["R16_R1_H"] = pickRandom("BRA", "JPN");
        picks.r16["R16_R1_A"] = pickRandom("CIV", "NOR");
        picks.r16["R16_R2_H"] = pickRandom("MEX", "CPV");
        picks.r16["R16_R2_A"] = pickRandom("ENG", "COD");
        picks.r16["R16_R3_H"] = pickRandom("ARG", "URU");
        picks.r16["R16_R3_A"] = pickRandom("AUS", "IRN");
        picks.r16["R16_R4_H"] = pickRandom("CAN", "BEL");
        picks.r16["R16_R4_A"] = pickRandom("POR", "PAR");

        // 2. R16 to R8
        picks.r8["R8_L1_H"] = pickRandom(picks.r16["R16_L1_H"], picks.r16["R16_L1_A"]);
        picks.r8["R8_L1_A"] = pickRandom(picks.r16["R16_L2_H"], picks.r16["R16_L2_A"]);
        picks.r8["R8_L2_H"] = pickRandom(picks.r16["R16_L3_H"], picks.r16["R16_L3_A"]);
        picks.r8["R8_L2_A"] = pickRandom(picks.r16["R16_L4_H"], picks.r16["R16_L4_A"]);

        picks.r8["R8_R1_H"] = pickRandom(picks.r16["R16_R1_H"], picks.r16["R16_R1_A"]);
        picks.r8["R8_R1_A"] = pickRandom(picks.r16["R16_R2_H"], picks.r16["R16_R2_A"]);
        picks.r8["R8_R2_H"] = pickRandom(picks.r16["R16_R3_H"], picks.r16["R16_R3_A"]);
        picks.r8["R8_R2_A"] = pickRandom(picks.r16["R16_R4_H"], picks.r16["R16_R4_A"]);

        // 3. R8 to R4
        picks.r4["R4_L1_H"] = pickRandom(picks.r8["R8_L1_H"], picks.r8["R8_L1_A"]);
        picks.r4["R4_L1_A"] = pickRandom(picks.r8["R8_L2_H"], picks.r8["R8_L2_A"]);
        picks.r4["R4_R1_H"] = pickRandom(picks.r8["R8_R1_H"], picks.r8["R8_R1_A"]);
        picks.r4["R4_R1_A"] = pickRandom(picks.r8["R8_R2_H"], picks.r8["R8_R2_A"]);

        // 4. R4 to R2
        picks.r2["R2_L1_H"] = pickRandom(picks.r4["R4_L1_H"], picks.r4["R4_L1_A"]);
        picks.r2["R2_L1_A"] = pickRandom(picks.r4["R4_R1_H"], picks.r4["R4_R1_A"]);

        // 5. R2 to Winner
        picks.winner = pickRandom(picks.r2["R2_L1_H"], picks.r2["R2_L1_A"]);

        // Insert invitation
        await supabase
          .from("challenge_invitations")
          .upsert({
            challenge_id: challengeId,
            user_id: fakeUserId,
            accepted: true
          }, { onConflict: "challenge_id,user_id" });

        // Upsert bet
        const { data: bet, error: betError } = await supabase
          .from("bets")
          .upsert({
            user_id: fakeUserId,
            challenge_id: challengeId,
            predictions: picks,
            points_awarded: 0
          }, { onConflict: "user_id,challenge_id" })
          .select();

        if (betError) {
          console.error("Error seeding mock bet:", betError);
        } else if (bet) {
          createdBets.push(bet);
        }
      }

      res.json({ success: true, count: createdBets.length });
    } catch (err: any) {
      console.error("Exception in seeding mock bets:", err);
      res.status(500).json({ error: err.message });
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

      // 1. Verify ownership or admin access
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

      let userEmail = "";
      try {
        const { data: userData } = await supabase.auth.admin.getUserById(String(userId));
        if (userData && userData.user) {
          userEmail = userData.user.email || "";
        }
      } catch (e) {
        console.error("Error fetching user email from auth admin:", e);
      }

      const allowedEmails = [
        "rouijel.nabil@gmail.com",
        "rouijel.nabil.cp@gmail.com",
      ];
      const isAdmin = userEmail && allowedEmails.includes(userEmail.toLowerCase());

      if (!challenge || (challenge.creator_id !== userId && !isAdmin)) {
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
      
      // Fetch creator usernames for these challenges to enrich them
      const creatorIds = Array.from(new Set(challengesList.map((c: any) => c.creator_id).filter(Boolean)));
      const creatorsMap: Record<string, string> = {};
      
      if (creatorIds.length > 0) {
        const now = Date.now();
        const missingCreatorIds = creatorIds.filter(id => {
          const cached = profilesCache[id];
          return !cached || (now - cached.timestamp > PROFILES_CACHE_TTL);
        });

        if (missingCreatorIds.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, username")
            .in("id", missingCreatorIds);
          if (profs) {
            profs.forEach(p => {
              profilesCache[p.id] = { data: p, timestamp: now };
            });
            missingCreatorIds.forEach(id => {
              if (!profilesCache[id]) {
                profilesCache[id] = { data: null, timestamp: now };
              }
            });
          }
        }

        creatorIds.forEach(id => {
          const cached = profilesCache[id];
          if (cached && cached.data) {
            creatorsMap[id] = cached.data.username || "Joueur Anonyme";
          } else {
            creatorsMap[id] = "Joueur Anonyme";
          }
        });
      }

      const enrichedChallenges = challengesList.map((c: any) => ({
        ...c,
        creator_username: creatorsMap[c.creator_id] || "Joueur Anonyme"
      }));

      console.log(
        `Successfully combined and enriched ${enrichedChallenges.length} unique challenges for user ${userId}`,
      );
      return res.json({ challenges: enrichedChallenges });
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

  // Kick a participant from a challenge (Admin or Creator only)
  app.post("/api/challenges/:challengeId/kick", async (req, res) => {
    if (!supabase)
      return res
        .status(500)
        .json({ error: "Configuration Supabase manquante." });
    try {
      const { challengeId } = req.params;
      const { userId, targetUserId } = req.body;

      if (!challengeId || !userId || !targetUserId) {
        return res
          .status(400)
          .json({ error: "challengeId, userId, et targetUserId sont requis." });
      }

      // 1. Verify ownership or admin access
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

      let userEmail = "";
      try {
        const { data: userData } = await supabase.auth.admin.getUserById(String(userId));
        if (userData && userData.user) {
          userEmail = userData.user.email || "";
        }
      } catch (e) {
        console.error("Error fetching user email from auth admin:", e);
      }

      const allowedEmails = [
        "rouijel.nabil@gmail.com",
        "rouijel.nabil.cp@gmail.com",
      ];
      const isAdmin = userEmail && allowedEmails.includes(userEmail.toLowerCase());

      if (!challenge || (challenge.creator_id !== userId && !isAdmin)) {
        return res
          .status(403)
          .json({
            error: "Non autorisé: vous devez être le créateur de ce défi ou un administrateur.",
          });
      }

      // 2. Delete the user's invitation
      const { error: inviteError } = await supabase
        .from("challenge_invitations")
        .delete()
        .eq("challenge_id", challengeId)
        .eq("user_id", targetUserId);

      if (inviteError) {
        console.error("Error deleting challenge invitation:", inviteError);
        return res.status(500).json({ error: "Erreur lors de la suppression de la participation." });
      }

      // 3. Delete the user's bets for this challenge
      const { error: betsError } = await supabase
        .from("bets")
        .delete()
        .eq("challenge_id", challengeId)
        .eq("user_id", targetUserId);

      if (betsError) {
        console.error("Error deleting user bets:", betsError);
      }

      return res.json({ success: true, message: "Participant retiré avec succès." });
    } catch (err: any) {
      console.error("Error in kick endpoint:", err);
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
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Start background sync job for matches
  startBackgroundSyncJob();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
