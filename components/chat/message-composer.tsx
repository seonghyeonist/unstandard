"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { FieldError, TextArea } from "@/components/ui/form-field";
import { sendMessage } from "@/lib/api/matches";

const schema = z.object({ body: z.string().trim().min(1, "빈 메시지는 보내지 않을게요.").max(500, "처음엔 조금 짧게 가볼까요?") });

type Values = z.infer<typeof schema>;

export function MessageComposer({ matchId }: { matchId: string }) {
  const queryClient = useQueryClient();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { body: "" } });
  const mutation = useMutation({
    mutationFn: (values: Values) => sendMessage(matchId, values.body),
    onSuccess: async () => {
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ["messages", matchId] });
    },
  });

  return (
    <form className="space-y-3" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
      <TextArea className="min-h-24" placeholder="처음이라면, 방금 열린 세계에서 본 작은 것을 말해보세요." {...form.register("body")} />
      <FieldError>{form.formState.errors.body?.message}</FieldError>
      <Button className="w-full" disabled={mutation.isPending}>{mutation.isPending ? "보내는 중" : "첫 메시지 보내기"}</Button>
    </form>
  );
}
