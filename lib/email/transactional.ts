import "server-only";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export class EmailDeliveryUnavailableError extends Error {
  constructor() {
    super("Transactional email delivery is unavailable");
    this.name = "EmailDeliveryUnavailableError";
  }
}

function requiredEmailConfig(): { apiKey: string; from: string } {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.UNSTANDARD_EMAIL_FROM?.trim();
  if (!apiKey || !from) throw new EmailDeliveryUnavailableError();
  return { apiKey, from };
}

async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const { apiKey, from } = requiredEmailConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [input.to], subject: input.subject, text: input.text }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new EmailDeliveryUnavailableError();
    }
    await response.body?.cancel();
  } catch (error) {
    if (error instanceof EmailDeliveryUnavailableError) throw error;
    throw new EmailDeliveryUnavailableError();
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendInviteVerificationEmail(input: {
  to: string;
  code: string;
  expiresInMinutes: number;
}): Promise<void> {
  await sendTransactionalEmail({
    to: input.to,
    subject: "UNSTANDARD 이메일 인증 코드",
    text: [
      "UNSTANDARD Closed Alpha 가입을 계속하려면 아래 인증 코드를 입력해 주세요.",
      "",
      `인증 코드: ${input.code}`,
      `유효 시간: ${input.expiresInMinutes}분`,
      "",
      "본인이 요청하지 않았다면 이 메시지를 무시해 주세요.",
    ].join("\n"),
  });
}

export async function sendPasswordResetEmail(input: {
  to: string;
  url: string;
}): Promise<void> {
  await sendTransactionalEmail({
    to: input.to,
    subject: "UNSTANDARD 비밀번호 재설정",
    text: [
      "비밀번호 재설정을 요청했습니다.",
      "",
      `아래 링크를 열어 새 비밀번호를 설정해 주세요: ${input.url}`,
      "링크는 짧은 시간 동안만 유효하며, 요청하지 않았다면 무시해 주세요.",
    ].join("\n"),
  });
}
