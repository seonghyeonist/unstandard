import type { Candidate, Profile } from "@/types/profile";
import type { Match, Message } from "@/types/match";
import type { OnboardingQuestion } from "@/types/user";

export const onboardingQuestion: OnboardingQuestion = {
  id: "22222222-2222-2222-2222-222222222222",
  prompt: "요즘 당신을 작게 웃게 만든 장면은 뭐였나요?",
  helper: "거창하지 않아도 좋아요. 2~4문장 정도면 충분해요.",
};

export const candidates: Candidate[] = [
  {
    id: "c1",
    nickname: "민",
    age: 31,
    city: "서울",
    teaser: "비 오는 날엔 일부러 조금 먼 카페로 돌아가요.",
    question: "최근에 마음이 느슨해졌던 순간은 언제였나요?",
  },
  {
    id: "c2",
    nickname: "서우",
    age: 29,
    city: "부산",
    teaser: "새벽 시장의 첫 국물 냄새를 좋아해요.",
    question: "하루가 별로였는데도 괜찮아진 이유가 있었나요?",
  },
  {
    id: "c3",
    nickname: "해준",
    age: 33,
    city: "대전",
    teaser: "책갈피 대신 영수증을 끼워두는 사람입니다.",
    question: "나만 이상하게 아끼는 작은 습관이 있나요?",
  },
];

export const profiles: Profile[] = candidates.map((candidate) => ({
  ...candidate,
  locked: {
    softFacts: ["답장을 천천히 다정하게 하는 편", "주말 오전 산책을 좋아함", "첫 만남은 조용한 곳 선호"],
    blurredNote: "이 사람의 취향과 첫 메시지 힌트가 아직 가려져 있어요.",
  },
  unlocked: {
    letter:
      candidate.id === "c1"
        ? "요즘은 빠른 확신보다 편안한 궁금함이 좋아요. 서로의 하루를 조금씩 빌려 읽는 느낌이면 충분해요."
        : "크게 꾸미지 않은 대화가 오래 남는다고 믿어요. 웃긴 실패담이나 별것 아닌 루틴을 나누는 쪽이 더 좋아요.",
    smallJoys: ["늦은 저녁 귤", "길에서 만난 낯선 고양이", "조용히 같은 노래 듣기"],
  },
}));

export const matches: Match[] = [
  { id: "m1", profileId: "c1", nickname: "민", lastMessage: "그 장면, 조금 더 듣고 싶어요." },
];

export const messages: Message[] = [
  {
    id: "msg1",
    matchId: "m1",
    author: "them",
    body: "그 장면, 조금 더 듣고 싶어요.",
    createdAt: new Date().toISOString(),
  },
];
