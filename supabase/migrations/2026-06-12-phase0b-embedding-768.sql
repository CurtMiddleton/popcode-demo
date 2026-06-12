-- One-off: change pop_images.embedding from vector(512) -> vector(768).
--
-- Why: the chosen Replicate model (krthr/clip-embeddings) emits 768-dim
-- CLIP ViT-L/14-class vectors, the brief's higher-accuracy option. The Phase 0
-- migration created the column as vector(512). pop_images is still empty, so
-- this retype is instant and lossless.
--
-- RUN IN THE `identification` BRANCH SQL EDITOR (not production).
-- If you create a fresh branch from the (now updated) Phase 0 migration, you
-- do NOT need this — the column will already be vector(768).

drop index if exists pop_images_embedding_idx;

alter table pop_images alter column embedding type vector(768);

create index pop_images_embedding_idx
  on pop_images using ivfflat (embedding vector_cosine_ops) with (lists = 100);
