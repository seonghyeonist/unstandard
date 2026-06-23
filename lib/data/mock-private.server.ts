import "server-only";

import type { ProfilePrivate } from "@/types/profile";

/**
 * Private profile payloads — SERVER ONLY.
 * Never import this module from client components.
 */
const privateByProfileId: Record<string, ProfilePrivate> = {
  c1: {
    letter: "요즘은 빠른 확신보다 편안한 궁금함이 좋아요. 서로의 하루를 조금씩 빌려 읽는 느낌이면 충분해요.",
    smallJoys: ["늦은 저녁 귤", "길에서 만난 낯선 고양이", "조용히 같은 노래 듣기"],
  },
  c2: {
    letter: "크게 꾸미지 않은 대화가 오래 남는다고 믿어요. 웃긴 실패담이나 별것 아닌 루틴을 나누는 쪽이 더 좋아요.",
    smallJoys: ["늦은 저녁 귤", "길에서 만난 낯선 고양이", "조용히 같은 노래 듣기"],
  },
  c3: {
    letter: "크게 꾸미지 않은 대화가 오래 남는다고 믿어요. 웃긴 실패담이나 별것 아닌 루틴을 나누는 쪽이 더 좋아요.",
    smallJoys: ["늦은 저녁 귤", "길에서 만난 낯선 고양이", "조용히 같은 노래 듣기"],
  },
};

export function getPrivateProfileContent(profileId: string): ProfilePrivate | null {
  return privateByProfileId[profileId] ?? null;
}
