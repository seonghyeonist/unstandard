import type { HttpRequest, HttpResponse } from "./request.mts";

const scriptPath = "/api/b2c/checkout-script";
const checkoutScript = String.raw`
const app = document.querySelector("main");
const status = document.querySelector("[role=status]");
const button = document.querySelector("#buy");
const korean = new URLSearchParams(location.search).get("lang") === "ko";
document.documentElement.lang = korean ? "ko" : "en";
const words = (en, ko) => korean ? ko : en;
const say = (en, ko) => { status.textContent = words(en, ko); };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function post(path, value, idempotencyKey) {
  const headers = {"Content-Type": "application/json"};
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const response = await fetch("/api/b2c/" + path, {
    method: "POST", headers, body: JSON.stringify(value),
  });
  return [response.status, await response.json()];
}
if (button) {
  const attempt = JSON.parse(sessionStorage.getItem("b2c-checkout") || "null") ||
    {key: crypto.randomUUID(), locale: korean ? "ko" : "en"};
  button.textContent = words("Open Sandbox checkout", "샌드박스 결제창 열기");
  let checking = false;
  async function claim() {
    if (checking || !attempt.orderId) return;
    checking = true;
    say("Checking payment with the server…", "서버에서 결제를 확인하고 있어요…");
    try {
      for (let i = 0; i < 30; i++) {
        const [code] = await post("orders/claim", {orderId: attempt.orderId});
        if (code === 200) {
          sessionStorage.removeItem("b2c-checkout");
          say("Payment confirmed. The personal card is being prepared.", "결제를 확인했어요. 개인 카드를 준비하고 있어요.");
          return;
        }
        if (code !== 202 && code !== 503) break;
        await sleep(2000);
      }
    } catch {}
    checking = false;
    say("Payment is still being checked. Use Check payment or your receipt email to recover access.", "결제를 확인 중이에요. 다시 확인하거나 결제 이메일로 접근을 복구할 수 있어요.");
  }
  const check = document.querySelector("#check");
  check.textContent = words("Check payment", "결제 확인");
  check.onclick = claim;
  check.hidden = !attempt.orderId;
  if (!window.Paddle) {
    button.disabled = true;
    say("Sandbox checkout could not load.", "샌드박스 결제창을 불러오지 못했어요.");
  } else {
    window.Paddle.Environment.set("sandbox");
    window.Paddle.Initialize({token: app.dataset.token, eventCallback(event) {
      if (event.name === "checkout.completed") void claim();
    }});
    button.onclick = async () => {
      button.disabled = true;
      try {
        const [ready] = await post("purchase-proof", {});
        if (ready !== 200) throw new Error();
        sessionStorage.setItem("b2c-checkout", JSON.stringify(attempt));
        const [code, order] = await post("orders", {sku: "recontact-v4", locale: attempt.locale}, attempt.key);
        if (code === 202) {
          say("The server is preparing the same transaction. Retry here shortly.", "같은 거래를 준비하고 있어요. 잠시 후 여기서 다시 시도해 주세요.");
          return;
        }
        if (code !== 200 && code !== 201) throw new Error();
        Object.assign(attempt, order);
        sessionStorage.setItem("b2c-checkout", JSON.stringify(attempt));
        check.hidden = false;
        window.Paddle.Checkout.open({transactionId: order.transactionId,
          settings: {locale: attempt.locale, allowLogout: false, showAddDiscounts: false}});
      } catch {
        say("Checkout unavailable. Check your payment or try again with the same browser.", "결제창을 열 수 없어요. 결제를 확인하거나 같은 브라우저에서 다시 시도해 주세요.");
      } finally { button.disabled = false; }
    };
  }
} else {
  const form = document.querySelector("form");
  const token = new URLSearchParams(location.hash.slice(1)).get("token");
  history.replaceState(null, "", location.pathname + location.search);
  document.querySelector("h1").textContent = words("Recover access", "구매 접근 복구");
  form.querySelector("label").hidden = Boolean(token);
  form.querySelector("input").required = !token;
  form.querySelector("button").textContent = token ? words("Recover", "복구하기") : words("Send recovery link", "복구 링크 받기");
  form.onsubmit = async (event) => {
    event.preventDefault();
    try {
      if (token) {
        const [code] = await post("recovery/claim", {token});
        if (code !== 200) throw new Error();
        say("Access recovered.", "구매 접근을 복구했어요.");
      } else {
        const [code] = await post("recovery/request", {email: form.email.value});
        if (code !== 202) throw new Error();
        say("If the purchase is eligible, a recovery link will be sent to that email.", "복구 가능한 주문이라면 해당 이메일로 링크를 보내요.");
      }
    } catch { say("Recovery unavailable. Request a new link if needed.", "복구할 수 없어요. 필요하면 새 링크를 요청해 주세요."); }
  };
}
`;

export function serveCheckout(req: HttpRequest, res: HttpResponse, path: string, token: string) {
  const script = path === scriptPath;
  const checkout = path === "/checkout";
  if ((!script && !checkout && path !== "/recover") || !["GET", "HEAD"].includes(req.method ?? "")) return false;
  const html = checkout
    ? `<main data-token="${token}"><h1>UNSTANDARD Sandbox · USD $8.99</h1><button id="buy">Open Sandbox checkout</button> <button id="check" hidden>Check payment</button><p role="status"></p><a href="/recover">Recover access / 구매 복구</a></main>`
    : '<main><h1>Recover access</h1><form><label>Email <input name="email" type="email" maxlength="254"></label><button>Continue</button></form><p role="status"></p></main>';
  const csp = checkout
    ? "default-src 'none'; script-src 'self' https://cdn.paddle.com; frame-src https://*.paddle.com; connect-src 'self' https://*.paddle.com; img-src https://*.paddle.com; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
    : "default-src 'none'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
  res.writeHead(200, {
    "Content-Type": script ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8",
    "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "Content-Security-Policy": csp,
    "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex",
  });
  const paddleScript = checkout ? '<script defer src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>' : "";
  res.end(req.method === "HEAD" ? undefined : script ? checkoutScript :
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>UNSTANDARD</title>${paddleScript}<script defer src="${scriptPath}"></script>${html}</html>`);
  return true;
}
