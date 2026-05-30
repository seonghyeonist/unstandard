export type Candidate = {
  id: string;
  nickname: string;
  age: number;
  city: string;
  teaser: string;
  question: string;
};

export type Profile = Candidate & {
  locked: {
    softFacts: string[];
    blurredNote: string;
  };
  unlocked: {
    letter: string;
    smallJoys: string[];
  };
};
