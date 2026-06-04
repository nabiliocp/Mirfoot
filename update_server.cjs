const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

const regex = /if \(matchData\.status === "FINISHED"\) \{([\s\S]*?)resolvedCount\+\+;/;

const replacementText = `if (matchData.status === "FINISHED") {
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
                
                await supabase.from("bets").update({ points_awarded: points }).eq("id", bet.id);
                await supabase.rpc('increment_user_points', { user_uuid: bet.user_id, points_to_add: points });
              }
            }

            await supabase.from("challenges").update({ resolved: true }).eq("id", challenge.id);
            resolvedCount++;`;

if (regex.test(content)) {
    content = content.replace(regex, replacementText);
    fs.writeFileSync('server.ts', content, 'utf8');
    console.log('Update successful!');
} else {
    console.log('Regex failed.');
}
