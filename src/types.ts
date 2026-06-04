export interface User {
  id: string;
  name: string;
  points: number;
}

export interface PointRules {
  exact_score: number;
  close_score: number;
  correct_winner: number;
  qualification: number;
}

export interface Challenge {
  id: string;
  type?: 'match' | 'custom';
  competitionId?: number;
  matchId?: number;
  matchHomeTeam?: string;
  matchAwayTeam?: string;
  matchDate?: string;
  creatorId?: string;
  creatorUsername?: string;
  title: string;
  rules?: string;
  code?: string;
  options?: string[];
  pointRules?: PointRules;
  stage?: 'group' | 'knockout';
  locked: boolean;
  resolved: boolean;
}

export interface Prediction {
  homeScore?: number;
  awayScore?: number;
  qualifies?: 'home' | 'away';
  customAnswer?: string;
  bonus?: boolean;
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
  stage?: string;
  group?: string;
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
