import { connectDatabase } from "../db/client.mts";
import { createAppServer } from "./http.mts";
import { createRepository } from "./repository.mts";

const origin = process.env.B2C_ORIGIN;
if (!origin) throw new Error("B2C_ORIGIN is required");
const port = Number(process.env.PORT ?? 4173);
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");

const {pool, db} = connectDatabase();
const server = createAppServer(createRepository(db), origin);
server.listen(port, "127.0.0.1", () => console.info("b2c_server_listening"));
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => server.close(() => { void pool.end(); }));
}
