export interface User {
  id: string;
  name: string;
  points: number;
}

export interface RulesSet {
  exact_score: number;
  good_result: number;
  close_score: number;
  first_to_score: number;
}

export interface KnockoutRulesSet extends RulesSet {
  extra_time: number;
  penalties: number;
}

export interface PointRules {
  group_stage: RulesSet;
  knockout_stage: KnockoutRulesSet;
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
  title: string;
  rules?: string;
  options?: string[];
  pointRules?: PointRules;
  stage?: 'group' | 'knockout';
  locked: boolean;
  resolved: boolean;
}

export interface Prediction {
  homeScore?: number;
  awayScore?: number;
  firstToScore?: string; // 'home', 'away', 'none'
  extraTime?: boolean;
  penalties?: boolean;
  customAnswer?: string;
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
