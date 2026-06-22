# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is
Mini-monorepo with two deliverables:
- **Frontend** (repo root): Next.js 15 App Router + React 19 + Tailwind v4, package manager **npm**. This is the user-facing product and is the primary thing to run. Scripts in `package.json`: `dev`, `build`, `start`, `lint`, `typecheck`.
- **depth-service** (`services/depth-service`): Python 3.12 FastAPI "Depth Score" microservice. Deps in `requirements.txt`, tests via `pytest` (config in `pyproject.toml`).

### Running the frontend (primary product)
- Standard commands are in `package.json` (`npm run dev` serves on `http://localhost:3000`).
- The frontend runs **fully standalone on mock data** — most data comes from `lib/api/mock-data.ts` and auth is a `sessionStorage` mock (`lib/api/auth.ts`).
- **Important caveat for the answer-unlock flow**: `lib/api/answers.ts` calls the real depth-service only when `NEXT_PUBLIC_API_BASE_URL` is set; otherwise it uses the local `mockVerdict`. The shipped `.env.example` sets `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000` and uses Docker-internal hostnames (`postgres`, `tei`). If you copy it to `.env.local` and run `npm run dev` **without** the backend stack actually up, the unlock flow's fetch fails and the UI shows verdict `ERROR`. For standalone frontend development/testing, run with `NEXT_PUBLIC_API_BASE_URL=` empty (i.e. `NEXT_PUBLIC_API_BASE_URL= npm run dev`) so the full UI flow works via the local mock verdict.

### depth-service
- Python deps install into a venv at `services/depth-service/.venv` (the update script creates this).
- Run unit tests: `services/depth-service/.venv/bin/python -m pytest` from `services/depth-service`. These are **pure unit tests** and need no DB or embedding server.
- The service can boot standalone (`uvicorn app.main:app`) and `GET /health` works without a DB (the pool is `None` when `DATABASE_URL` is unset). However, `POST /internal/depth/evaluate` requires the TEI embedding server, or it returns 503.

### Full end-to-end depth scoring (heavy / optional)
- `docker-compose.yml` brings up `postgres` (pgvector), `tei` (HuggingFace BAAI/bge-m3 embeddings), and `depth-service`.
- **Docker is not installed in this environment**, and the TEI image downloads a large embedding model on first run. This full stack is **not required** to develop or demo the frontend product, which falls back to mock scoring. Bring it up only when specifically working on real Depth Score behavior.

### System dependency note
- Creating the Python venv requires the `python3-venv` system package (installed during environment setup; not part of the update script).
