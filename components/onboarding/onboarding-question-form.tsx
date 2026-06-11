"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError, TextArea, TextInput } from "@/components/ui/form-field";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { getOnboardingQuestion, submitOnboardingAnswer } from "@/lib/api/onboarding";

const schema = z.object({
  nickname: z.string().trim().min(1, "불릴 이름을 알려주세요.").max(16, "조금 더 짧게 불러볼까요?"),
  answer: z.string().trim().min(20, "두 문장 정도만 더 적어주세요.").max(600, "알파에서는 짧은 답부터 시작해요."),
});

type FormValues = z.infer<typeof schema>;

export function OnboardingQuestionForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const question = useQuery({ queryKey: ["onboarding-question"], queryFn: getOnboardingQuestion });
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { nickname: "", answer: "" } });
  const mutation = useMutation({
    mutationFn: submitOnboardingAnswer,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["current-user"] });
      router.push("/app/home");
    },
  });

  if (question.isLoading) return <LoadingState />;
  if (question.isError || !question.data) return <ErrorState body="질문을 불러오지 못했어요." onRetry={() => question.refetch()} />;

  return (
    <Card>
      <form className="space-y-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <div>
          <label className="mb-2 block text-sm font-semibold">닉네임</label>
          <TextInput placeholder="예: 여름" {...form.register("nickname")} />
          <FieldError>{form.formState.errors.nickname?.message}</FieldError>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold">첫 질문</p>
          <h2 className="text-2xl font-black leading-tight tracking-[-0.04em]">{question.data.prompt}</h2>
          <p className="mt-2 text-sm leading-6 text-foreground/65">{question.data.helper}</p>
        </div>
        <div>
          <TextArea placeholder="오늘 있었던 작고 진짜인 장면을 적어주세요." {...form.register("answer")} />
          <FieldError>{form.formState.errors.answer?.message}</FieldError>
        </div>
        <Button className="w-full" disabled={mutation.isPending}>{mutation.isPending ? "저장하는 중" : "시작하기"}</Button>
        {mutation.isError ? <p className="text-sm text-danger">저장하지 못했어요. 다시 시도해주세요.</p> : null}
      </form>
    </Card>
  );
}
