export interface User {
  id: string;
  name: string;
  points: number;
}

export interface RulesSet {
  exact_score: number;
  correct_winner: number;
  closest_guess: number;
}

export interface KnockoutRulesSet extends RulesSet {
  exact_score_penalties: number;
  correct_winner_penalties: number;
  // New rules
  prolongation_winner: number;
  prolongation_score: number;
  penalties_winner: number;
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
  firstToScore?: string; // 'home', 'away', 'none'
  // New fields
  endStage?: 'regulation' | 'prolongation' | 'penalties';
  winner?: 'home' | 'away'; // applicable for prolongation or penalties
  prolongationHomeScore?: number; // Should I add these? The user said "Quel score Prolongation score"
  prolongationAwayScore?: number;
  
  penaltiesHomeScore?: number;
  penaltiesAwayScore?: number;
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
