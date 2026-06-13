-- Phase 2: scoped nearest-neighbour search for identification.
--
-- Returns the closest pop_images rows to a query embedding, ALWAYS scoped to a
-- single creator (the privacy wall). `<=>` is pgvector's cosine distance (uses
-- the ivfflat vector_cosine_ops index); confidence = 1 - distance (1.0 = identical).
--
-- RUN IN THE `identification` BRANCH SQL EDITOR (not production).

create or replace function identify_match(
  p_creator_id uuid,
  p_embedding  vector(768),
  p_limit      int default 1
)
returns table (
  image_id      uuid,
  collection_id uuid,
  target_ref    text,
  video_url     text,
  confidence    double precision
)
language sql stable
as $$
  select id, collection_id, target_ref, video_url,
         1 - (embedding <=> p_embedding) as confidence
  from pop_images
  where creator_id = p_creator_id
  order by embedding <=> p_embedding
  limit p_limit;
$$;

-- Called only from the server with the service role; not exposed to anon.
grant execute on function identify_match(uuid, vector, int) to service_role;
