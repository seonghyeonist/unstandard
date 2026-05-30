"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError, TextArea } from "@/components/ui/form-field";
import { submitUnlockAnswer } from "@/lib/api/answers";
import { VerdictMessage } from "@/components/question/verdict-message";
import { UnlockAnimation } from "@/components/question/unlock-animation";

const schema = z.object({ answer: z.string().trim().min(12, "조금만 더 적어주세요.").max(800, "첫 답은 가볍게 남겨도 괜찮아요.") });

type Values = z.infer<typeof schema>;

export function AnswerForm({ profileId, question }: { profileId: string; question: string }) {
  const queryClient = useQueryClient();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { answer: "" } });
  const mutation = useMutation({
    mutationFn: (values: Values) => submitUnlockAnswer(profileId, values.answer),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["unlock-status", profileId] }),
  });
  const verdict = mutation.data?.verdict;

  return (
    <Card>
      <form className="space-y-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <div>
          <p className="mb-2 text-sm font-semibold text-accent">열쇠 질문</p>
          <h1 className="text-3xl font-black leading-tight tracking-[-0.05em]">{question}</h1>
          <p className="mt-3 text-sm leading-6 text-foreground/65">정답은 없어요. 장면 하나만 구체적으로 적어주세요.</p>
        </div>
        <TextArea placeholder="예: 어제 편의점 앞에서..." {...form.register("answer")} />
        <FieldError>{form.formState.errors.answer?.message}</FieldError>
        <VerdictMessage verdict={verdict} />
        {verdict === "PASS" ? <UnlockAnimation /> : null}
        <Button className="w-full" disabled={mutation.isPending}>{mutation.isPending ? "살펴보는 중" : verdict === "PASS" ? "한 번 더 남기기" : "답 보내기"}</Button>
      </form>
    </Card>
  );
}
