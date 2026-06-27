import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: challenges, error } = await supabase
    .from('challenges')
    .select('id, title, match_id, competition_id, resolved')
    .eq('creator_id', '1d5a780d-ea38-41a4-859b-14e648031930');
    
  if (error) {
    console.error(error);
    return;
  }
  
  challenges.forEach(c => {
    console.log(`Title: "${c.title}", Resolved: ${c.resolved}`);
  });
}
run();
