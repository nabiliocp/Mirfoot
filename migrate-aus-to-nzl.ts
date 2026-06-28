import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

async function main() {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.log("Supabase credentials missing.");
    return;
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Migrate bets
  const { data: bets, error: betsError } = await supabase.from('bets').select('*');
  if (betsError) {
    console.error("Error fetching bets:", betsError);
    return;
  }

  let betUpdates = 0;
  for (const b of bets || []) {
    if (b.predictions) {
      let picksStr = JSON.stringify(b.predictions);
      if (picksStr.includes('"AUS"')) {
        picksStr = picksStr.replace(/"AUS"/g, '"NZL"');
        const newPredictions = JSON.parse(picksStr);
        await supabase.from('bets').update({ predictions: newPredictions }).eq('id', b.id);
        betUpdates++;
        console.log(`Updated bet ${b.id}`);
      }
    }
  }
  console.log(`Updated ${betUpdates} bets.`);

  // Migrate challenges actual_results
  const { data: challenges, error: chalError } = await supabase.from('challenges').select('*');
  if (chalError) {
    console.error("Error fetching challenges:", chalError);
    return;
  }

  let chalUpdates = 0;
  for (const c of challenges || []) {
    if (c.actual_results) {
      let resultsStr = JSON.stringify(c.actual_results);
      if (resultsStr.includes('"AUS"')) {
        resultsStr = resultsStr.replace(/"AUS"/g, '"NZL"');
        const newResults = JSON.parse(resultsStr);
        await supabase.from('challenges').update({ actual_results: newResults }).eq('id', c.id);
        chalUpdates++;
        console.log(`Updated challenge ${c.id}`);
      }
    }
  }
  console.log(`Updated ${chalUpdates} challenges.`);
}
main();
