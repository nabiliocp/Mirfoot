export interface User {
  id: string;
  name: string;
  points: number;
}

export interface PointRules {
  exact_score: number;
  good_result: number;
  close_score: number;
  first_to_score: number;
  extra_time: number;
  penalties: number;
}

export interface Challenge {
  id: string;
  competitionId?: number;
  matchId: number;
  matchHomeTeam?: string;
  matchAwayTeam?: string;
  matchDate?: string;
  creatorId?: string;
  title: string;
  rules?: string;
  pointRules: PointRules;
  locked: boolean;
  resolved: boolean;
}

export interface Prediction {
  homeScore?: number;
  awayScore?: number;
  firstToScore?: string; // 'home', 'away', 'none'
  extraTime?: boolean;
  penalties?: boolean;
}

export interface Competition {
  id: number;
  name: string;
  emblem: string;
  type: string;
}

export interface Match {
  id: number;
  utcDate: string;
  status: string;
  matchday: number;
  homeTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
    crest: string;
  };
  awayTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
    crest: string;
  };
}
