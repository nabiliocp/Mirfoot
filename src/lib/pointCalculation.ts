import { PointRules } from '../types';

export const calculateMatchPoints = (
  m: any,
  pHome?: number,
  pAway?: number,
  isBonusActive?: boolean,
  pointRules?: PointRules
) => {
  if (pHome === undefined || pAway === undefined) return null;
  const rHome = m.score?.fullTime?.home ?? m.score?.regularTime?.home;
  const rAway = m.score?.fullTime?.away ?? m.score?.regularTime?.away;
  if (rHome === null || rAway === null || rHome === undefined || rAway === undefined) return null;

  const rules = (pointRules && (pointRules.exact_score !== undefined || pointRules.close_score !== undefined)) 
    ? pointRules 
    : { exact_score: 3, close_score: 2, correct_winner: 1, qualification: 1 };
  const isExact = pHome === rHome && pAway === rAway;
  const actualWinner = rHome > rAway ? 'home' : rHome < rAway ? 'away' : 'draw';
  const predWinner = pHome > pAway ? 'home' : pHome < pAway ? 'away' : 'draw';

  let matchPts = 0;
  if (isExact) {
    matchPts = rules.exact_score;
  } else if (actualWinner === predWinner) {
    const diff = Math.abs(pHome - rHome) + Math.abs(pAway - rAway);
    if (rules?.close_score && diff <= 2) {
      matchPts = rules.close_score;
    } else {
      matchPts = rules.correct_winner;
    }
  }

  if (isBonusActive) {
    if (matchPts > 0) {
      matchPts = matchPts * 2;
    } else {
      matchPts = -4;
    }
  }
  return matchPts;
};
