import * as cheerio from "cheerio";

function getTeamSynonyms(name: string): string[] {
  const norm = name.toLowerCase();
  const synonyms: string[] = [];
  synonyms.push(norm);

  if (norm.includes("croatia") || norm.includes("croatie")) {
    synonyms.push("croatia");
    synonyms.push("croatie");
  }
  if (norm.includes("ghana")) {
    synonyms.push("ghana");
  }
  return synonyms;
}

function normalizeTeam(name: string): string {
  return name.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(fc|cf|ac|real|ud|rcd|sd|sc|afc|fk|bvb|sv|as|ol|olympique|juventus|club|de|la|os)\b/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function extractScore(snippet: string, home: string, away: string): { homeScore: number, awayScore: number } | null {
  const normalizedSnippet = snippet.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  console.log("Analyzing snippet:", normalizedSnippet);
  
  const homeSyns = getTeamSynonyms(home).map(s => normalizeTeam(s));
  const awaySyns = getTeamSynonyms(away).map(s => normalizeTeam(s));

  console.log("Home synonyms:", homeSyns);
  console.log("Away synonyms:", awaySyns);

  let matchedHomeSyn = "";
  for (const syn of homeSyns) {
    if (syn && normalizedSnippet.includes(syn)) {
      matchedHomeSyn = syn;
      break;
    }
  }

  let matchedAwaySyn = "";
  for (const syn of awaySyns) {
    if (syn && normalizedSnippet.includes(syn)) {
      matchedAwaySyn = syn;
      break;
    }
  }

  if (!matchedHomeSyn) {
    const norm = normalizeTeam(home);
    const words = norm.split(" ").filter(w => w.length > 2);
    matchedHomeSyn = words[0] || norm;
  }
  if (!matchedAwaySyn) {
    const norm = normalizeTeam(away);
    const words = norm.split(" ").filter(w => w.length > 2);
    matchedAwaySyn = words[0] || norm;
  }

  console.log("Matched Home Syn:", matchedHomeSyn);
  console.log("Matched Away Syn:", matchedAwaySyn);

  if (!matchedHomeSyn || !matchedAwaySyn) return null;

  const scoreRegex = /(\d+)\s*[-–:]\s*(\d+)/g;
  let match;
  while ((match = scoreRegex.exec(normalizedSnippet)) !== null) {
    const score1 = parseInt(match[1]);
    const score2 = parseInt(match[2]);
    if (score1 > 15 || score2 > 15) continue;

    const scoreIndex = match.index;
    const hIndex = normalizedSnippet.indexOf(matchedHomeSyn);
    const aIndex = normalizedSnippet.indexOf(matchedAwaySyn);

    console.log(`Checking score candidate: ${score1}-${score2} at index ${scoreIndex}. hIndex: ${hIndex}, aIndex: ${aIndex}`);

    if (hIndex !== -1 && aIndex !== -1) {
      if (hIndex < aIndex) {
        if (scoreIndex > hIndex && scoreIndex < aIndex + 80) {
          console.log("Success A");
          return { homeScore: score1, awayScore: score2 };
        }
        if (scoreIndex > aIndex) {
          console.log("Success B");
          return { homeScore: score1, awayScore: score2 };
        }
      } else {
        if (scoreIndex > aIndex && scoreIndex < hIndex + 80) {
          console.log("Success C");
          return { homeScore: score2, awayScore: score1 };
        }
        if (scoreIndex > hIndex) {
          console.log("Success D");
          return { homeScore: score2, awayScore: score1 };
        }
      }
    }
  }

  const hasHome = normalizedSnippet.includes(matchedHomeSyn);
  const hasAway = normalizedSnippet.includes(matchedAwaySyn);
  if (hasHome && hasAway) {
    scoreRegex.lastIndex = 0;
    const firstScoreMatch = scoreRegex.exec(normalizedSnippet);
    if (firstScoreMatch) {
      const score1 = parseInt(firstScoreMatch[1]);
      const score2 = parseInt(firstScoreMatch[2]);
      if (score1 <= 15 && score2 <= 15) {
        const hIndex = normalizedSnippet.indexOf(matchedHomeSyn);
        const aIndex = normalizedSnippet.indexOf(matchedAwaySyn);
        if (hIndex < aIndex) {
          console.log("Fallback Success A");
          return { homeScore: score1, awayScore: score2 };
        } else {
          console.log("Fallback Success B");
          return { homeScore: score2, awayScore: score1 };
        }
      }
    }
  }

  return null;
}

async function test(query: string) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  console.log("Fetching url:", url);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
      }
    });
    console.log("Status:", res.status);
    const text = await res.text();
    const $ = cheerio.load(text);
    const results: string[] = [];
    $(".links_main").each((i, el) => {
      const title = $(el).find(".result__title").text().trim();
      const snippet = $(el).find(".result__snippet").text().trim();
      results.push(`${title} | ${snippet}`);
    });
    console.log("Found snippets count:", results.length);
    for (const r of results) {
      console.log("- Result:", r);
      const score = extractScore(r, "Croatia", "Ghana");
      if (score) {
        console.log("👉 MATCHED SCORE:", score);
        break;
      }
    }
  } catch (err: any) {
    console.error("Failed:", err.message);
  }
}

test("Croatia vs Ghana 2026 score");
