CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO app_config (key, value, description)
VALUES
  ('local_ai_enabled', 'true', 'Enable local Depth Score pipeline'),
  ('embedding_model', '"BAAI/bge-m3"', 'Embedding model served by Hugging Face TEI'),
  ('embedding_dim', '1024', 'BGE-M3 embedding dimension'),
  ('depth_model_version', '"local-v0.1"', 'Formula, weight, and model version'),
  ('depth_score_threshold', '0.38', 'Basic PASS threshold'),
  ('fast_track_threshold', '0.55', 'Short-but-dense FAST_TRACK threshold'),
  ('min_answer_length', '12', 'Minimum answer length for BASIC pass'),
  ('fast_track_min_length', '8', 'Minimum answer length for FAST_TRACK pass'),
  ('depth_gray_band', '0.03', 'Manual/assistant review band around basic threshold'),
  ('qwen_review_enabled', 'false', 'Enable optional Qwen review for gray-band cases'),
  ('qwen_review_sample_rate', '0.10', 'Qwen review sample rate'),
  ('max_depth_latency_ms_p95', '1200', 'P95 latency target in milliseconds')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS answer_embeddings (
  answer_id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  question_id UUID NOT NULL,
  model_version TEXT NOT NULL,
  embedding VECTOR(1024) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS depth_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id UUID NOT NULL,
  user_id UUID NOT NULL,
  question_id UUID NOT NULL,
  depth_score NUMERIC(5,4) NOT NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('PASS','REVIEW','REJECT')),
  path TEXT NOT NULL CHECK (path IN ('BASIC','FAST_TRACK','GRAY_BAND','SPAM_REJECT','LOW_SCORE')),
  features JSONB NOT NULL,
  reason_codes TEXT[] NOT NULL DEFAULT '{}',
  threshold NUMERIC(5,4) NOT NULL,
  model_version TEXT NOT NULL,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_depth_eval_created ON depth_evaluations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_depth_eval_model ON depth_evaluations(model_version);
CREATE INDEX IF NOT EXISTS idx_depth_eval_answer ON depth_evaluations(answer_id);
CREATE INDEX IF NOT EXISTS idx_depth_eval_reason_codes ON depth_evaluations USING gin(reason_codes);
CREATE INDEX IF NOT EXISTS idx_depth_eval_features ON depth_evaluations USING gin(features);
CREATE INDEX IF NOT EXISTS idx_answer_embedding_vec
  ON answer_embeddings USING hnsw (embedding vector_cosine_ops);

