export type Match = {
  id: string;
  profileId: string;
  nickname: string;
  lastMessage?: string;
};

export type Message = {
  id: string;
  matchId: string;
  author: "me" | "them";
  body: string;
  createdAt: string;
};
