import { createServer } from "node:http";
import { createRuntime } from "./runtime.mts";

const port = Number(process.env.PORT ?? 4173);
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");

const { pool, handler } = createRuntime(process.env);
const server = createServer(handler);
server.listen(port, "127.0.0.1", () => console.info("b2c_server_listening"));
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => server.close(() => { void pool.end(); }));
}
