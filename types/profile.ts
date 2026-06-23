export type Candidate = {
  id: string;
  nickname: string;
  age: number;
  city: string;
  teaser: string;
  question: string;
};

/** Public card + locked preview only — no private letter in client bundles. */
export type PublicProfile = Candidate & {
  locked: {
    softFacts: string[];
    blurredNote: string;
  };
};

export type ProfilePrivate = {
  letter: string;
  smallJoys: string[];
};

/** @deprecated Use PublicProfile — full Profile with embedded private fields is removed. */
export type Profile = PublicProfile;
