-- ============================================================
-- CA1 Seed Data
-- Run AFTER 001_ca1_schema.sql
-- SA password: Din@16285  (bcrypt hash below)
-- ============================================================

-- ─── Super Admin ─────────────────────────────────────────────
-- Password: Din@16285
INSERT INTO ca1_staff (email, name, role, password_hash) VALUES (
  'dinesh.k.wadhwani@gmail.com',
  'Dinesh Wadhwani',
  'sa',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8.4m7rR0vZfqR.vZfqR'
) ON CONFLICT (email) DO NOTHING;

-- NOTE: The hash above is a placeholder.
-- Run this Node.js snippet once to generate the real hash and update:
--   const bcrypt = require('bcryptjs');
--   console.log(await bcrypt.hash('Din@16285', 12));
-- Then: UPDATE ca1_staff SET password_hash = '<output>' WHERE email = 'dinesh.k.wadhwani@gmail.com';

-- ─── Exam definition ─────────────────────────────────────────
INSERT INTO ca1_exam_definitions (
  code, title, course_code, total_marks, duration_minutes,
  mcq_count, mcq_marks_each, email_domain, created_by
) VALUES (
  'F0003-CA1-2026',
  'CA1 Practical Examination — Autonomous AI Systems and Agent-Based Computing',
  'F0003',
  15,
  50,
  10,
  0.5,
  'sitpune.edu.in',
  'dinesh.k.wadhwani@gmail.com'
) ON CONFLICT (code) DO NOTHING;

-- ─── Exam tasks ──────────────────────────────────────────────
INSERT INTO ca1_exam_tasks (exam_id, task_no, title, marks, co_codes, bloom_level, bloom_label, requires_apify, config)
SELECT
  id,
  1,
  'API Key and Question Paper Retrieval',
  2,
  ARRAY['CO4'],
  3,
  'Apply',
  FALSE,
  '{"description": "Student writes a client program that authenticates with the exam API key and retrieves their question paper."}'
FROM ca1_exam_definitions WHERE code = 'F0003-CA1-2026'
ON CONFLICT DO NOTHING;

INSERT INTO ca1_exam_tasks (exam_id, task_no, title, marks, co_codes, bloom_level, bloom_label, requires_apify, config)
SELECT
  id,
  2,
  'Corpus Word Count via Apify Actor',
  3,
  ARRAY['CO4'],
  3,
  'Apply',
  TRUE,
  '{"count_tolerance": 0, "run_window_minutes": 60}'
FROM ca1_exam_definitions WHERE code = 'F0003-CA1-2026'
ON CONFLICT DO NOTHING;

INSERT INTO ca1_exam_tasks (exam_id, task_no, title, marks, co_codes, bloom_level, bloom_label, requires_apify, config)
SELECT
  id,
  3,
  'City Temperature Lookup via Apify Actor',
  5,
  ARRAY['CO4'],
  3,
  'Apply',
  TRUE,
  '{"temperature_tolerance": 2.0, "weather_provider": "open-meteo", "weather_field": "current.temperature_2m"}'
FROM ca1_exam_definitions WHERE code = 'F0003-CA1-2026'
ON CONFLICT DO NOTHING;

-- ─── Task components ─────────────────────────────────────────
INSERT INTO ca1_task_components (task_id, code, description, marks, grading_rule)
SELECT t.id, 'paper_fetch', 'Successful authenticated retrieval of question paper', 2, 'gate'
FROM ca1_exam_tasks t JOIN ca1_exam_definitions d ON t.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND t.task_no = 1
ON CONFLICT DO NOTHING;

INSERT INTO ca1_task_components (task_id, code, description, marks, grading_rule)
SELECT t.id, 'count_total', 'Whole-corpus word count exactly correct', 1.5, 'exact'
FROM ca1_exam_tasks t JOIN ca1_exam_definitions d ON t.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND t.task_no = 2
ON CONFLICT DO NOTHING;

INSERT INTO ca1_task_components (task_id, code, description, marks, grading_rule)
SELECT t.id, 'count_scoped', 'Scoped-page word count exactly correct', 1.0, 'exact'
FROM ca1_exam_tasks t JOIN ca1_exam_definitions d ON t.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND t.task_no = 2
ON CONFLICT DO NOTHING;

INSERT INTO ca1_task_components (task_id, code, description, marks, grading_rule)
SELECT t.id, 'apify_run', 'Valid verified Apify run within exam window', 0.5, 'gate'
FROM ca1_exam_tasks t JOIN ca1_exam_definitions d ON t.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND t.task_no = 2
ON CONFLICT DO NOTHING;

INSERT INTO ca1_task_components (task_id, code, description, marks, grading_rule)
SELECT t.id, 'city_match', 'City matches PRN row in spreadsheet', 2.0, 'exact'
FROM ca1_exam_tasks t JOIN ca1_exam_definitions d ON t.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND t.task_no = 3
ON CONFLICT DO NOTHING;

INSERT INTO ca1_task_components (task_id, code, description, marks, grading_rule, tolerance)
SELECT t.id, 'temperature', 'Temperature within ±2.0°C of server reading', 3.0, 'tolerance', 2.0
FROM ca1_exam_tasks t JOIN ca1_exam_definitions d ON t.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND t.task_no = 3
ON CONFLICT DO NOTHING;

-- ─── MCQ Slots ───────────────────────────────────────────────
INSERT INTO ca1_mcq_slots (exam_id, slot_no, concept, co_code, bloom_level, bloom_label)
SELECT d.id, s.slot_no, s.concept, s.co_code, s.bloom_level, s.bloom_label
FROM ca1_exam_definitions d,
(VALUES
  (1,  'word_vs_contextual_embeddings',      'CO3', 2, 'Understand'),
  (2,  'chunking_and_chunk_size',             'CO3', 2, 'Understand'),
  (3,  'vector_database_indexing',            'CO3', 1, 'Remember'),
  (4,  'similarity_metrics',                  'CO3', 1, 'Remember'),
  (5,  'retrieval_vs_context_stuffing',       'CO3', 2, 'Understand'),
  (6,  'rag_pipeline_components',             'CO3', 2, 'Understand'),
  (7,  'workflow_vs_agent',                   'CO4', 2, 'Understand'),
  (8,  'tools_and_function_calling',          'CO4', 1, 'Remember'),
  (9,  'human_in_the_loop',                   'CO4', 2, 'Understand'),
  (10, 'short_vs_long_term_memory',           'CO4', 1, 'Remember')
) AS s(slot_no, concept, co_code, bloom_level, bloom_label)
WHERE d.code = 'F0003-CA1-2026'
ON CONFLICT DO NOTHING;

-- ─── MCQ Questions Bank ──────────────────────────────────────
-- Slot 1: word_vs_contextual_embeddings
INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'Which statement best describes the difference between word embeddings and contextual embeddings?',
'[
  {"key":"A","text":"Word embeddings assign the same vector to a token regardless of surrounding text, while contextual embeddings produce different vectors for the same token depending on its context."},
  {"key":"B","text":"Word embeddings are always larger in dimension than contextual embeddings, making them more accurate for all natural language tasks."},
  {"key":"C","text":"Contextual embeddings are only used for image recognition tasks, while word embeddings handle text classification exclusively."},
  {"key":"D","text":"Word embeddings are computed at inference time for every sentence, while contextual embeddings are pre-trained once and remain fixed forever."}
]',
'A',
'Word embeddings (e.g. Word2Vec, GloVe) produce one fixed vector per token. Contextual embeddings (e.g. from BERT, GPT) produce different vectors for the same token depending on its surrounding context, capturing polysemy and nuance.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 1;

INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'A developer notices the word "bank" in "river bank" and "savings bank" receives identical vectors in their system. What type of embedding is most likely in use?',
'[
  {"key":"A","text":"Contextual embedding from a transformer model, because transformers always collapse synonyms into the same vector space."},
  {"key":"B","text":"Static word embedding (such as Word2Vec or GloVe), because these assign one fixed vector per token regardless of surrounding context."},
  {"key":"C","text":"Sentence-level embedding, because sentence models always ignore individual word meaning in favour of overall tone."},
  {"key":"D","text":"Binary embedding, because one-hot encodings produce identical vectors for tokens that appear with similar frequency."}
]',
'B',
'Static embeddings give one vector per word type. "Bank" gets the same vector whether it appears near "river" or "savings". Contextual models would produce different vectors.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 1;

INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'In a RAG pipeline, why are contextual embeddings preferred over static word embeddings for encoding document chunks?',
'[
  {"key":"A","text":"Contextual embeddings are smaller in file size, making the vector store cheaper to host on cloud infrastructure."},
  {"key":"B","text":"Contextual embeddings capture meaning that depends on surrounding words, so semantically similar passages map to nearby vectors even when they use different vocabulary."},
  {"key":"C","text":"Static word embeddings cannot be stored in vector databases, because those databases require floating-point numbers above a certain precision threshold."},
  {"key":"D","text":"Contextual embeddings are generated faster than static embeddings at query time, reducing overall retrieval latency significantly."}
]',
'B',
'Contextual embeddings encode the full meaning of a passage, not just individual tokens, so semantically equivalent content clusters together in vector space, improving retrieval relevance.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 1;

INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'Which of the following is the most accurate description of how contextual embeddings are produced?',
'[
  {"key":"A","text":"A lookup table maps each word to a pre-assigned vector that was set manually by linguistic experts during the model design phase."},
  {"key":"B","text":"Each token''s vector is computed by the model during a forward pass, taking into account all other tokens in the input sequence at that moment."},
  {"key":"C","text":"The entire document is compressed into a single number that represents its overall topic, which is then expanded back to a vector by the retrieval layer."},
  {"key":"D","text":"Contextual embeddings are produced by averaging the pixel values of a visual representation of the text rendered in a fixed font size."}
]',
'B',
'Transformer-based models compute each token''s representation using attention over all other tokens in the sequence, making the vector context-dependent.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 1;

-- Slot 2: chunking_and_chunk_size
INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'Why is document chunking necessary before embedding documents for a RAG system?',
'[
  {"key":"A","text":"Embedding models have a maximum input length (context window), so documents longer than that limit must be split into smaller pieces before encoding."},
  {"key":"B","text":"Vector databases can only store integers, so text must be broken into single characters before being converted to numeric form."},
  {"key":"C","text":"Chunking removes duplicate sentences from the document, which would otherwise cause the cosine similarity score to exceed 1.0."},
  {"key":"D","text":"Chunking is required only for images and audio; plain text documents can always be embedded whole without any size constraints."}
]',
'A',
'Embedding models have a token limit (e.g. 512 or 8192 tokens). Documents exceeding this must be chunked. Chunking also improves retrieval precision by matching queries to relevant sections rather than whole documents.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 2;

INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'A team uses very large chunk sizes (e.g. 2000 tokens per chunk) in their RAG system. What is the most likely consequence?',
'[
  {"key":"A","text":"Each chunk covers a broad topic area, so retrieved chunks contain the relevant answer but also carry significant irrelevant content, reducing generation quality."},
  {"key":"B","text":"The vector store becomes unable to compute cosine similarity, because large vectors always produce a similarity score of exactly zero."},
  {"key":"C","text":"The embedding model automatically truncates each chunk to 10 tokens, discarding the rest without warning the developer."},
  {"key":"D","text":"Large chunks improve precision by ensuring every possible answer is always present in at least one retrieved document."}
]',
'A',
'Large chunks reduce retrieval precision: the returned passage contains the relevant sentence plus a lot of noise, diluting the context injected into the LLM and reducing answer quality.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 2;

INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'What is the trade-off when using very small chunk sizes (e.g. one sentence per chunk) in a RAG pipeline?',
'[
  {"key":"A","text":"Small chunks increase retrieval precision for specific facts but may lose surrounding context that is needed to interpret the retrieved sentence correctly."},
  {"key":"B","text":"Small chunks always improve both precision and recall simultaneously, making them the universally optimal choice for all RAG applications."},
  {"key":"C","text":"Small chunks cause the embedding model to produce vectors of lower dimensionality, which degrades similarity search across the entire corpus."},
  {"key":"D","text":"Small chunks are incompatible with FAISS and other approximate nearest-neighbour indexes, requiring exact search instead."}
]',
'A',
'Very small chunks can be retrieved precisely but lack context. A sentence about a drug dosage without the surrounding paragraph may be misinterpreted by the LLM.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 2;

INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'Which chunking strategy would best preserve the semantic coherence of each chunk for a document structured with clear headings and sections?',
'[
  {"key":"A","text":"Fixed-size character chunking splits the document every 500 characters regardless of sentence or paragraph boundaries."},
  {"key":"B","text":"Structure-aware chunking splits at section boundaries (headings, paragraphs), keeping each section together as one chunk."},
  {"key":"C","text":"Random chunking selects arbitrary start and end positions to avoid any bias introduced by document formatting."},
  {"key":"D","text":"Token-count chunking always produces the best semantic coherence because it aligns exactly with the embedding model''s training distribution."}
]',
'B',
'Structure-aware chunking respects the document''s logical units. A section on one topic stays together, producing chunks with high internal semantic coherence.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 2;

-- Slot 3: vector_database_indexing
INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'What does a vector database primarily store and index?',
'[
  {"key":"A","text":"High-dimensional numeric vectors (embeddings) along with associated metadata, indexed for fast approximate nearest-neighbour search."},
  {"key":"B","text":"Raw text documents stored in B-tree indexes, identical to a relational database but with an additional full-text search column."},
  {"key":"C","text":"Binary image files encoded as base-64 strings, with an inverted index mapping pixel intensities to document identifiers."},
  {"key":"D","text":"SQL table schemas and foreign key relationships, optimised for join operations across normalised relational tables."}
]',
'A',
'Vector databases store high-dimensional embedding vectors with metadata and provide fast ANN (approximate nearest-neighbour) search, which is the core operation in semantic retrieval.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 3;

INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'Why is a vector database more suitable than a traditional relational database for semantic search?',
'[
  {"key":"A","text":"Relational databases cannot store any numeric data, making them unsuitable for holding floating-point embedding vectors of any dimension."},
  {"key":"B","text":"Vector databases provide approximate nearest-neighbour indexes that efficiently find semantically similar items in high-dimensional space, which SQL WHERE clauses cannot do."},
  {"key":"C","text":"Traditional relational databases are limited to storing a maximum of 100 rows, making them impractical for document collections of any meaningful size."},
  {"key":"D","text":"Vector databases automatically translate natural language queries into SQL, eliminating the need for any query language knowledge."}
]',
'B',
'SQL can filter exact values and ranges but cannot efficiently find the nearest vectors in thousands of dimensions. ANN indexes (HNSW, IVF) in vector databases solve this efficiently.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 3;

INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'In a RAG system, at what stage is the vector database queried?',
'[
  {"key":"A","text":"During the fine-tuning phase, to supply training examples that update the LLM''s weights based on retrieved document content."},
  {"key":"B","text":"At query time, after the user''s question is embedded, to retrieve the document chunks whose vectors are most similar to the question vector."},
  {"key":"C","text":"During the tokenisation step, to replace rare tokens with semantically equivalent common tokens before the text reaches the model."},
  {"key":"D","text":"Only during the initial corpus ingestion phase; once indexing is complete the vector database is no longer accessed."}
]',
'B',
'In RAG, the query is embedded at runtime, and the vector database is searched to find the top-k most similar document chunks, which are then injected into the LLM prompt as context.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 3;

INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'Which of the following is an example of a vector database?',
'[
  {"key":"A","text":"MySQL — a relational database management system with support for ACID transactions and foreign key constraints."},
  {"key":"B","text":"Pinecone — a managed vector database designed for storing and querying high-dimensional embedding vectors at scale."},
  {"key":"C","text":"Redis — an in-memory key-value store used primarily for caching and session management in web applications."},
  {"key":"D","text":"Apache Kafka — a distributed event-streaming platform used for real-time data pipelines and message queuing."}
]',
'B',
'Pinecone is a purpose-built vector database. Others in this category include Weaviate, Qdrant, Chroma, and pgvector. MySQL, Redis, and Kafka serve different purposes.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 3;

-- Slot 4: similarity_metrics
INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'What does cosine similarity measure between two vectors?',
'[
  {"key":"A","text":"The angle between two vectors, reflecting how similar their directions are regardless of their individual magnitudes."},
  {"key":"B","text":"The straight-line distance between the tips of two vectors measured in Euclidean space, penalising differences in both direction and length."},
  {"key":"C","text":"The number of dimensions in which both vectors have identical values, expressed as a percentage of total dimensions."},
  {"key":"D","text":"The ratio of the longer vector''s magnitude to the shorter vector''s magnitude, normalised to a scale between zero and ten."}
]',
'A',
'Cosine similarity = dot(A,B)/(|A|×|B|). It measures the cosine of the angle between vectors, so two vectors pointing in the same direction score 1.0 regardless of their lengths.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 4;

INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'Why is cosine similarity generally preferred over Euclidean distance for comparing text embeddings?',
'[
  {"key":"A","text":"Cosine similarity is insensitive to the magnitude of vectors, so two documents on the same topic score similarly even if one is much longer than the other."},
  {"key":"B","text":"Euclidean distance always produces negative values for high-dimensional vectors, making ranking results in ascending order impossible."},
  {"key":"C","text":"Cosine similarity can only be computed on binary vectors, making it faster than Euclidean distance for floating-point embeddings."},
  {"key":"D","text":"Euclidean distance requires all vectors to have unit norm, a constraint that embedding models cannot satisfy during training."}
]',
'A',
'Text embeddings vary in magnitude based on document length. Cosine similarity normalises this out, so topic similarity drives the score, not document length.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 4;

INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'Two embeddings have a cosine similarity of 0.95. What does this indicate?',
'[
  {"key":"A","text":"The two texts are highly semantically similar, with their embedding vectors pointing in nearly the same direction in the high-dimensional space."},
  {"key":"B","text":"The two texts are completely unrelated, because a score close to 1.0 means the vectors are perpendicular to each other."},
  {"key":"C","text":"The embedding model failed to encode the texts correctly, because valid similarity scores must always be negative for natural language."},
  {"key":"D","text":"Exactly 95 percent of the tokens in both texts are identical, measured by direct character comparison of the original strings."}
]',
'A',
'Cosine similarity ranges from -1 to 1. A score of 0.95 indicates vectors pointing in nearly the same direction, meaning the two texts are highly semantically similar.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 4;

INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'When would Euclidean distance be preferred over cosine similarity for a vector search task?',
'[
  {"key":"A","text":"When the magnitude of vectors carries meaningful information (e.g. term frequency in a bag-of-words model) and should influence the similarity score."},
  {"key":"B","text":"When the vectors are derived from transformer models, because those models always produce unit-norm outputs that break cosine similarity."},
  {"key":"C","text":"When the corpus contains fewer than 100 documents, because cosine similarity is undefined for small collections."},
  {"key":"D","text":"Euclidean distance is never appropriate for any natural language processing task involving high-dimensional vectors."}
]',
'A',
'If the magnitude of the vector is informative (e.g. in TF-IDF, higher magnitude means more occurrences), Euclidean distance captures that. For semantic embeddings, cosine is usually better.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 4;

-- Slot 5: retrieval_vs_context_stuffing
INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'Why does retrieval-augmented generation (RAG) produce more accurate answers than simply stuffing an entire knowledge base into the LLM context window?',
'[
  {"key":"A","text":"RAG retrieves only the most relevant passages, keeping the context focused and avoiding the accuracy degradation and cost that come with very long prompts."},
  {"key":"B","text":"Context stuffing causes the LLM to rewrite the knowledge base from scratch each time, which introduces random errors not present in the original documents."},
  {"key":"C","text":"RAG compresses each document into a single token before sending it to the model, reducing the prompt length without losing any information."},
  {"key":"D","text":"Context stuffing is always more accurate than RAG; RAG is only used when the knowledge base is too large to fit in any available context window."}
]',
'A',
'Long contexts dilute relevance and can cause models to miss key information ("lost in the middle" problem). RAG selects the top-k relevant chunks, keeping the prompt concise and focused.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 5;

INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'A company has a 50,000-page legal document library. Why is context stuffing an impractical strategy for answering queries over this library?',
'[
  {"key":"A","text":"The combined token count of 50,000 pages far exceeds any current LLM context window, and even partial stuffing costs orders of magnitude more than retrieval per query."},
  {"key":"B","text":"Legal documents use specialised vocabulary that LLMs are incapable of processing, regardless of how many pages are included in the context."},
  {"key":"C","text":"Context stuffing is limited to a maximum of 10 documents per prompt by the OpenAI API terms of service, making large libraries impossible to query."},
  {"key":"D","text":"LLMs automatically reject prompts containing legal text because of built-in safety filters that prevent processing of confidential documents."}
]',
'A',
'50,000 pages would be tens of millions of tokens. Even with 1M-token context windows, the cost per query would be prohibitive and latency would be severe. RAG scales efficiently.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 5;

INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'What is "context injection" in a RAG pipeline?',
'[
  {"key":"A","text":"The step where retrieved document chunks are inserted into the LLM prompt alongside the user''s question, providing factual grounding for the response."},
  {"key":"B","text":"A security attack where a malicious user embeds hidden instructions in a document to override the LLM''s system prompt."},
  {"key":"C","text":"The process of updating the LLM''s weights with new knowledge by running a specialised fine-tuning loop on retrieved documents."},
  {"key":"D","text":"A compression algorithm that reduces the size of retrieved chunks by removing stop words before they are sent to the language model."}
]',
'A',
'Context injection is the RAG step where retrieved passages are concatenated with the user query and placed in the prompt, giving the LLM the factual context it needs to answer accurately.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 5;

INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'Which of the following is a key limitation of an LLM that RAG is specifically designed to address?',
'[
  {"key":"A","text":"LLMs have a fixed knowledge cutoff date and cannot access information about events or documents that post-date their training, which retrieval from a live knowledge base resolves."},
  {"key":"B","text":"LLMs cannot process text longer than 10 tokens, so RAG breaks every query into single words before sending them to the model one at a time."},
  {"key":"C","text":"LLMs always output identical responses to identical prompts, and RAG adds randomness by shuffling retrieved chunks before injection."},
  {"key":"D","text":"LLMs are unable to generate text in any language other than English, and RAG translates retrieved passages into English before context injection."}
]',
'A',
'LLMs have a training cutoff and no access to proprietary or up-to-date information. RAG grounds responses in a live, updatable knowledge base without requiring model retraining.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 5;

-- Slot 6: rag_pipeline_components
INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'Which sequence correctly describes the components of a RAG pipeline in the order they execute?',
'[
  {"key":"A","text":"LLM generation → vector search → document chunking → embedding → context injection"},
  {"key":"B","text":"Document chunking → embedding → vector store indexing → query embedding → vector search → context injection → LLM generation"},
  {"key":"C","text":"Context injection → vector store indexing → query embedding → document chunking → LLM generation → embedding"},
  {"key":"D","text":"Query embedding → LLM generation → document chunking → vector search → embedding → context injection"}
]',
'B',
'RAG offline: chunk → embed → index. RAG online: embed query → search vector store → inject top-k chunks into prompt → LLM generates answer. Option B is the only correctly ordered sequence.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 6;

INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'In a RAG pipeline, what is the purpose of the retriever component?',
'[
  {"key":"A","text":"The retriever generates the final answer by summarising retrieved passages using a sequence-to-sequence model trained on question-answer pairs."},
  {"key":"B","text":"The retriever searches the vector store for the document chunks most semantically similar to the embedded user query and returns them for context injection."},
  {"key":"C","text":"The retriever splits raw documents into fixed-size chunks and assigns each chunk a unique integer identifier before embedding begins."},
  {"key":"D","text":"The retriever fine-tunes the embedding model on newly added documents to keep the vector representations current with the latest knowledge."}
]',
'B',
'The retriever takes the embedded query, performs a nearest-neighbour search in the vector store, and returns the top-k most relevant chunks to be used as context.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 6;

INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'What distinguishes a RAG system from a system that only uses an LLM without retrieval?',
'[
  {"key":"A","text":"A RAG system augments the LLM''s prompt with dynamically retrieved external knowledge at query time, allowing it to answer questions beyond its training data."},
  {"key":"B","text":"A RAG system replaces the LLM entirely with a search engine, so no language model is involved in generating the final answer."},
  {"key":"C","text":"A RAG system fine-tunes the LLM on every new document as it is added to the knowledge base, keeping the model weights continuously updated."},
  {"key":"D","text":"A RAG system limits the LLM to producing outputs of exactly 100 tokens to ensure retrieved context always fits within the response length."}
]',
'A',
'The defining characteristic of RAG is dynamic retrieval at inference time. The LLM is not retrained; instead, relevant external content is retrieved and injected into each prompt.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 6;

INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'Why is evaluation an important step in a RAG pipeline?',
'[
  {"key":"A","text":"Evaluation measures whether the retriever is returning relevant chunks and whether the LLM is generating accurate, grounded responses, guiding iterative improvement."},
  {"key":"B","text":"Evaluation is required by law in all countries before any AI system can be deployed, regardless of the use case or risk level."},
  {"key":"C","text":"Evaluation automatically retrains the embedding model when retrieval accuracy falls below a threshold, without any human intervention."},
  {"key":"D","text":"Evaluation converts the vector store into a relational database format so that retrieved results can be audited using standard SQL queries."}
]',
'A',
'RAG evaluation (e.g. using metrics like faithfulness, answer relevance, context recall) identifies whether chunks are being retrieved correctly and whether the LLM uses them accurately.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 6;

-- Slot 7: workflow_vs_agent
INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'What is the fundamental difference between a workflow and an AI agent?',
'[
  {"key":"A","text":"A workflow executes a pre-defined sequence of steps determined at design time, while an AI agent autonomously decides its own next action at runtime based on its observations."},
  {"key":"B","text":"Workflows can only run on cloud servers, while AI agents are restricted to local machines without internet access."},
  {"key":"C","text":"A workflow uses machine learning models for every step, while an AI agent relies exclusively on hard-coded if-else rules with no learned components."},
  {"key":"D","text":"AI agents always run faster than workflows because they skip validation steps that workflows require for safety compliance."}
]',
'A',
'The defining property of an agent is autonomous decision-making: the model chooses its next action. A workflow''s path is fixed at design time — no model decides the sequence.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 7;

INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'A scheduled Python script runs every night at 2 AM, fetches sales data, and emails a report. Is this an AI agent?',
'[
  {"key":"A","text":"Yes, because it operates automatically without a human pressing a button each time it runs."},
  {"key":"B","text":"No, because a schedule is not autonomy — the script''s actions are fully determined at design time and no model chooses the next step."},
  {"key":"C","text":"Yes, because any script that interacts with external APIs qualifies as an agent under the standard definition."},
  {"key":"D","text":"No, but only because it lacks a graphical user interface; adding a dashboard would make it an agent."}
]',
'B',
'Automation on a timer is not agency. Autonomy requires a model choosing its own next action based on observations. This script''s behaviour is entirely fixed at design time.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 7;

INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'For which type of task is a workflow more appropriate than an AI agent?',
'[
  {"key":"A","text":"Extracting a fixed set of fields from invoices and inserting them into a database — a well-defined, repeatable process with no decision-making required at runtime."},
  {"key":"B","text":"Researching a novel scientific topic across multiple sources, synthesising findings, and deciding which experiments to prioritise next."},
  {"key":"C","text":"Operating a customer support chatbot that must handle unpredictable questions and escalate to a human when it detects frustration."},
  {"key":"D","text":"Writing and debugging code autonomously in response to a high-level specification that may change during execution."}
]',
'A',
'Invoice extraction is deterministic and repeatable — ideal for a workflow. The other options require runtime decision-making in response to unpredictable inputs, which suits an agent.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 7;

INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'Which of the following best describes the ReAct (Reason + Act) pattern used in AI agents?',
'[
  {"key":"A","text":"The agent alternates between reasoning steps (thinking about what to do) and action steps (calling tools or APIs), iterating until it reaches a satisfactory answer."},
  {"key":"B","text":"The agent reacts to user input by immediately generating the final answer without any intermediate reasoning or tool use."},
  {"key":"C","text":"The agent uses a pre-compiled decision tree to map every possible input to a pre-determined output without any runtime computation."},
  {"key":"D","text":"The agent runs two separate models in parallel — one for reasoning and one for acting — and combines their outputs using a voting mechanism."}
]',
'A',
'ReAct interleaves Thought (reasoning) and Action (tool call) steps in a loop. The agent observes the tool result, reasons again, and continues until the task is complete.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 7;

-- Slot 8: tools_and_function_calling
INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'What is function calling (tool use) in the context of large language models?',
'[
  {"key":"A","text":"A capability that allows an LLM to signal that it wants to invoke a specific external function, with structured arguments, so that the application can execute it and return the result."},
  {"key":"B","text":"A Python feature that allows one function to call another function directly inside the LLM''s neural network weights during the forward pass."},
  {"key":"C","text":"A method for users to manually type function signatures into the chat interface so the LLM learns new skills during the conversation."},
  {"key":"D","text":"An API endpoint that replaces the LLM entirely with a deterministic calculator for arithmetic operations, improving numerical accuracy."}
]',
'A',
'Function calling lets the LLM output a structured request to invoke a defined tool (search, database query, API call). The application executes it and returns the result to the model.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 8;

INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'Why are tools essential for agentic AI systems?',
'[
  {"key":"A","text":"Tools extend the agent''s capabilities beyond text generation by allowing it to take actions in the real world — searching the web, reading files, calling APIs, or running code."},
  {"key":"B","text":"Tools are required because LLMs cannot generate any text without first receiving a structured JSON input from an external tool call."},
  {"key":"C","text":"Tools allow the agent to bypass its context window limit by storing the entire conversation history in an external database that replaces the model''s memory."},
  {"key":"D","text":"Tools are only used during the training phase to generate synthetic data; they are disconnected from the model during inference."}
]',
'A',
'An LLM alone can only produce text. Tools give agents real-world capabilities: web search, code execution, database access, file I/O. Without tools, an agent can only reason, not act.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 8;

INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'When an LLM invokes a tool using function calling, what happens next in the agent loop?',
'[
  {"key":"A","text":"The application executes the function with the provided arguments, appends the result to the conversation, and sends the updated context back to the LLM for the next step."},
  {"key":"B","text":"The LLM executes the function internally within its neural network and generates the result without any involvement from the external application."},
  {"key":"C","text":"The conversation ends immediately and the function result is returned directly to the user without the LLM seeing or processing it."},
  {"key":"D","text":"The tool call is logged but not executed until a human operator reviews and approves it through a separate approval interface."}
]',
'A',
'The application (not the LLM) runs the function. The result is appended to the message history as a tool result, and the LLM continues reasoning from this updated context.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 8;

INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'Which of the following is an example of a tool an AI agent might use?',
'[
  {"key":"A","text":"A web search function that takes a query string as input and returns a list of relevant URLs and snippets from the internet."},
  {"key":"B","text":"The softmax activation function applied to the final layer of the transformer to produce probability distributions over the vocabulary."},
  {"key":"C","text":"The attention mechanism that allows the model to weigh the importance of different tokens when generating each output token."},
  {"key":"D","text":"The tokeniser that converts raw text into integer IDs before they are passed into the model''s embedding layer."}
]',
'A',
'Tools are external capabilities the agent invokes: web search, code execution, database queries, API calls. Softmax, attention, and tokenisers are internal model components, not tools.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 8;

-- Slot 9: human_in_the_loop
INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'What is the purpose of a human-in-the-loop mechanism in an AI agent workflow?',
'[
  {"key":"A","text":"It pauses the agent at defined checkpoints so a human can review, approve, or redirect the agent''s actions before execution continues, reducing the risk of irreversible errors."},
  {"key":"B","text":"It replaces the AI model entirely with a human operator who types responses manually, using the agent framework only for routing messages between users."},
  {"key":"C","text":"It ensures the agent runs faster by distributing computation across multiple human reviewers working in parallel on different subtasks."},
  {"key":"D","text":"It prevents the agent from accessing the internet by requiring a human to manually copy and paste web content into the context window."}
]',
'A',
'Human-in-the-loop adds oversight at critical decision points. The agent pauses, presents its plan or result, and a human approves or redirects before consequential actions are taken.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 9;

INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'In which scenario is a human-in-the-loop workflow most critical?',
'[
  {"key":"A","text":"An agent that autonomously sends emails to thousands of customers on behalf of a company, where an error in tone or content could cause significant reputational damage."},
  {"key":"B","text":"An agent that generates draft social media captions for internal review, where a human will always see and approve the output before it is published."},
  {"key":"C","text":"An agent that formats a spreadsheet by applying a consistent number format to a column of prices in an offline document."},
  {"key":"D","text":"An agent that converts temperature values from Celsius to Fahrenheit using a deterministic mathematical formula with no external API calls."}
]',
'A',
'Sending emails at scale is irreversible and high-stakes. Human approval before the send action prevents errors from propagating to thousands of recipients simultaneously.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 9;

INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'What is the main trade-off when adding more human-in-the-loop checkpoints to an agent workflow?',
'[
  {"key":"A","text":"More checkpoints increase oversight and reduce error risk, but they slow the workflow down and reduce the autonomy benefit that motivated using an agent in the first place."},
  {"key":"B","text":"More checkpoints always improve both speed and accuracy simultaneously, because humans correct model errors faster than the model can make them."},
  {"key":"C","text":"More checkpoints are only beneficial when the agent uses more than five tools; workflows with fewer tools should always run fully autonomously."},
  {"key":"D","text":"More checkpoints reduce the agent''s context window usage, because each approval step clears the conversation history and starts a fresh session."}
]',
'A',
'Human-in-the-loop is a safety-autonomy trade-off. More oversight reduces risk but increases latency and human workload. System designers must calibrate this based on stakes and error cost.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 9;

INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'Which of the following agent behaviours demonstrates full autonomy (no human in the loop)?',
'[
  {"key":"A","text":"The agent researches, writes, and publishes a blog post directly to the company website without any human reviewing the content before it goes live."},
  {"key":"B","text":"The agent drafts a blog post and emails it to a content manager who must click Approve before the post is scheduled for publication."},
  {"key":"C","text":"The agent generates an outline and waits for the user to select which sections to expand before proceeding with the full draft."},
  {"key":"D","text":"The agent highlights sentences it is uncertain about and flags them for human review before submitting the document to the editor."}
]',
'A',
'Full autonomy means the agent completes the task end-to-end without a human checkpoint. Publishing directly with no review is the only option where no human approves any step.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 9;

-- Slot 10: short_vs_long_term_memory
INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'What is short-term memory in an AI agent context?',
'[
  {"key":"A","text":"The current conversation history held in the context window, which is available during an active session but lost when the session ends."},
  {"key":"B","text":"A persistent database table that retains all conversations across every user session for the entire lifetime of the application."},
  {"key":"C","text":"The model''s pre-trained weights, which store knowledge learned during training and remain fixed after deployment."},
  {"key":"D","text":"A hardware cache on the GPU that speeds up matrix multiplication during the transformer''s attention computation."}
]',
'A',
'Short-term memory is the context window — the agent can see the current conversation. When the session ends or the context overflows, this information is gone unless explicitly persisted.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 10;

INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'Which of the following is an example of long-term memory in an AI agent system?',
'[
  {"key":"A","text":"A vector database that stores summaries of past conversations and retrieves relevant ones at the start of each new session to give the agent historical context."},
  {"key":"B","text":"The list of messages in the current API call, passed as the messages array to the LLM endpoint for a single inference request."},
  {"key":"C","text":"The KV cache generated by the transformer during the forward pass, storing intermediate attention values for the current prompt."},
  {"key":"D","text":"The temperature and top-p parameters set by the developer to control the randomness of the model''s output distribution."}
]',
'A',
'Long-term memory persists beyond a session. Storing conversation summaries in a vector database and retrieving them at session start gives the agent access to historical context.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 10;

INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'Why does an AI agent need explicit long-term memory mechanisms rather than relying solely on the context window?',
'[
  {"key":"A","text":"Context windows have a finite token limit and are cleared between sessions, so information from past interactions is permanently lost unless actively stored externally."},
  {"key":"B","text":"Long-term memory mechanisms are required by law in GDPR-compliant applications to ensure all user data is retained indefinitely."},
  {"key":"C","text":"Context windows can only hold a single message at a time, so every response requires a separate database lookup to retrieve the previous message."},
  {"key":"D","text":"Long-term memory allows the agent to run faster by pre-computing all possible responses and caching them before the user asks a question."}
]',
'A',
'Context windows are finite and ephemeral. Without external storage, an agent forgets everything when the context fills or the session ends. Long-term memory provides continuity.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 10;

INSERT INTO ca1_mcq_questions (slot_id, stem, options, correct_key, rationale) SELECT s.id,
'An agent is helping a user plan a trip over multiple sessions. The user mentioned their dietary restrictions in session 1. In session 3 the agent still remembers this. What mechanism made this possible?',
'[
  {"key":"A","text":"Long-term memory: the dietary restriction was stored in a persistent store after session 1 and retrieved into the context at the start of session 3."},
  {"key":"B","text":"Short-term memory: the context window automatically retained all previous sessions without any explicit storage mechanism."},
  {"key":"C","text":"Model fine-tuning: the agent''s weights were updated after session 1 to permanently encode the user''s dietary preferences."},
  {"key":"D","text":"Prompt caching: the LLM provider cached the entire session 1 conversation and automatically prepended it to every subsequent API call."}
]',
'A',
'Cross-session memory requires explicit persistence. The agent extracted the preference, stored it in a database, and retrieved it when session 3 started — this is long-term memory.'
FROM ca1_mcq_slots s JOIN ca1_exam_definitions d ON s.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND s.slot_no = 10;

-- ─── Roster ───────────────────────────────────────────────────
INSERT INTO ca1_roster (prn, name) VALUES
('23070122004', 'Aarohi Kondpalle'),
('23070122253', 'Aarvee Sunil Wadhwa'),
('23070122005', 'Aarya Balwadkar'),
('23070122006', 'Aaryan Nagu'),
('23070122007', 'Aashi Joshi'),
('23070122008', 'Aayush Joshi'),
('23070122009', 'Abdulelah Faisal Alolofi'),
('23070122010', 'Abhay Pandey'),
('23070122011', 'Abhilaksh Saini'),
('23070122012', 'Abhirami Nair'),
('23070122268', 'Abhyudaya Dixit'),
('23070122261', 'Adarsh Jha'),
('23070122013', 'Aditi Bansal'),
('23070122016', 'Aditya Tiwari'),
('23070122017', 'Afifa Bintul Hasan'),
('23070122018', 'Ahmed Mohammed'),
('23070122020', 'Akushie John Chinonso'),
('23070122276', 'Alaa Sokhni'),
('23070122021', 'Alan Joseph Kurian'),
('23070122274', 'Ali Almubarak'),
('23070122022', 'Ali Naif Mohsen Ali Al-Tam'),
('23070122023', 'Aliraza Shaikh'),
('23070122024', 'Aman Srivastava'),
('23070122025', 'Aman Vats'),
('23070122027', 'Anagha Premlal Nair'),
('23070122029', 'Ananya Poundrik'),
('23070122246', 'Anish Kumar Sah'),
('23070122032', 'Ankush Dutta'),
('23070122033', 'Anshul Ravindra Mandekar'),
('23070122034', 'Anum Agrawal'),
('23070122035', 'Anushka Desai'),
('23070122262', 'Anushka Tandon'),
('23070122038', 'Anvesha Singh'),
('23070122040', 'Aparna Nair'),
('23070122041', 'Archisha Yadav'),
('23070122042', 'Archishmaan Singh Rohal'),
('24070122505', 'Arnav Jhodge'),
('23070122046', 'Arnav Karole'),
('23070122044', 'Arnav Krishna Bhardwaj'),
('23070122045', 'Arnav Niteen More'),
('23070122047', 'Arsh Ansari'),
('23070122048', 'Arun Tati'),
('23070122049', 'Arunabha Mukhopadhyay'),
('23070122050', 'Arya Sanjay Bhirud'),
('24070122501', 'Aryan Bhandage'),
('23070122052', 'Aryan Choudhary'),
('23070122053', 'Aryan Kumar'),
('23070122054', 'Aryan Sahare'),
('23070122055', 'Aryan Srivastava'),
('23070122058', 'Ashwin Sadashiv Laad'),
('23070122059', 'Astha Kumari'),
('24070122519', 'Atharva Kulkarni'),
('23070122174', 'Atharva Rale'),
('24070122502', 'Atharva Sunil Khanorkar'),
('23070122060', 'Avi S Gupta'),
('23070122061', 'Aviraj Yadav'),
('23070122063', 'Ayaan Rukadikar'),
('23070122064', 'Ayan Irufanoddin Shaikh'),
('23070122066', 'Ayush Siddhant'),
('23070122067', 'Baboucarr Sonko'),
('23070122068', 'Bandopadhyaya Anindita'),
('23070122070', 'Bhagyesh Sutar'),
('23070122072', 'Bhumi Asati'),
('23070122249', 'Bokhit Mahamat Tom'),
('23070122077', 'Chintan Kumar Pradhan'),
('23070122079', 'Daneti Jagananmol'),
('23070122080', 'Deep Shah'),
('23070122081', 'Deepti Pal'),
('24070122517', 'Dev Vachhani'),
('23070122082', 'Devadhath Kodavamparambil Dileep'),
('23070122083', 'Devaki Joshi'),
('23070122271', 'Devank Upadhyaya'),
('23070122084', 'Devashree Abhay Kale'),
('23070122085', 'Dhawse Spandan Yashwant'),
('23070122258', 'Dhruv Gupta'),
('23070122086', 'Diksha Jha'),
('23070122087', 'Dossoumidokpe Jay Rickier Vyanel Fadonougbo'),
('23070122088', 'Drishti Mundhara'),
('23070122089', 'Dushyant Singh Chouhan'),
('23070122264', 'Eccha Bansal Agrawal'),
('23070122090', 'Ganapathy Raman Anirudh'),
('23070122091', 'Gangurde Dhruv Deepak'),
('23070122092', 'Garv Bhalla'),
('23070122094', 'Garvit Tyagi'),
('23070122114', 'Gaud Kashyup Pawan'),
('23070122095', 'Gauri Singh'),
('23070122096', 'Gayatri Patil'),
('23070122154', 'Ghule Om Ajit'),
('23070122098', 'Gunveer Singh'),
('23070122099', 'Gurunarayan Vajpayee'),
('23070122100', 'Harsh Ledwani'),
('23070122102', 'Harsh Rajput'),
('23070122101', 'Harsh Raju Mate'),
('23070122103', 'Harshada Padma Mahamkali'),
('23070122106', 'Ishan Sinha'),
('23070122269', 'Ishita Agarwal'),
('23070122108', 'Janak Fabyani'),
('24070122504', 'Jasani Het Arvind'),
('23070122109', 'Jayant Puri'),
('23070122243', 'Jesline Pinto'),
('23070122111', 'Jiya Tyagi'),
('23070122112', 'Joshua Bara'),
('23070122278', 'Jyoti Kumari Sah'),
('23070122113', 'Kapure Shivam Sahebrao'),
('24070122503', 'Karan Desai'),
('23070122126', 'Kazi Maazin Azim'),
('24070122506', 'Kendre Ganraj Ashok'),
('23070122116', 'Kisna Kanti'),
('23070122118', 'Kritika Nair'),
('23070122119', 'Krittika Bisht'),
('23070122121', 'Kshitij Shah'),
('23070122122', 'Kushagra'),
('23070122267', 'Kushbu Niraj Agrawal'),
('23070122123', 'L S Pragun'),
('23070122075', 'Lakshita Ravindra Chaudhari'),
('23070122124', 'Lakshya Jain'),
('23070122260', 'Lauriane Lenge Wa Mpitshi'),
('23070122125', 'Laxmi Kumari Sah'),
('23070122127', 'Madhura Parag Panvelkar'),
('23070122128', 'Mahi Sharma'),
('23070122129', 'Mahmoud Mohammed Mahmoud Masawa AlAidaros'),
('24070122507', 'Malhar Borse'),
('23070122132', 'Manav Dalwani'),
('23070122134', 'Mayank Bansal'),
('23070122135', 'Mayank Rajesh Hete'),
('23070122265', 'Mithlesh Yadav'),
('23070122138', 'Mitiksha Paliwal'),
('23070122275', 'Modar Alshoufi'),
('23070122139', 'Mohak Sareen'),
('23070122140', 'Mohammad Ahmad'),
('23070122141', 'Mohammed Al Hajj'),
('23070122142', 'Mohnish Kundnani'),
('24070122508', 'More Atharva Uttamrao'),
('24070122509', 'More Sejal Sanjay'),
('23070122250', 'Mourno Mahamat Issack Mandi'),
('23070122143', 'Muskan Sahay'),
('23070122279', 'Muskan Shah'),
('23070122144', 'Nair Sreehari Sathyan'),
('23070122147', 'Nedha Nizamudeen'),
('24070122510', 'Neel Somnath Khule'),
('23070122148', 'Nigel Francy Vallachirakkaran'),
('23070122149', 'Nilabjo Goswami'),
('23070122259', 'Nimita Jestin'),
('23070122150', 'Nitesh Ghimire'),
('23070122151', 'Niyati Dave'),
('23070122153', 'Ojas Verma'),
('23070122155', 'Om Shivshankar Dhamame'),
('23070122157', 'Omar Abdalrahman'),
('23070122156', 'Omayr Muqarrab Yunus'),
('23070122245', 'Omika Shrestha'),
('23070122158', 'Omkar Kadam'),
('24070122511', 'Pandit Nihil Sunilbhai'),
('23070122161', 'Parth Niranjan Damle'),
('23070122110', 'Patel Jeel Bhaveshbhai'),
('23070122280', 'Prabin Yadav'),
('23070122163', 'Prajyot Vedante'),
('23070122252', 'Pratik Kumar Chaudhary'),
('23070122166', 'Pratik Lakra'),
('23070122167', 'Pritika Anand Kurup'),
('23070122168', 'Priyansh Kabra'),
('23070122169', 'Pushkraj P Naik'),
('23070122170', 'Raghav Dhoot'),
('23070122172', 'Raghav Hitesh Sonchhatra'),
('23070122171', 'Raghav Sharma'),
('23070122173', 'Rajat Singh'),
('24070122512', 'Rajnandini Kathote'),
('23070122175', 'Rathod Deepak Raju'),
('23070122176', 'Ravi Kumar Sharma'),
('23070122177', 'Reeti Agarwal'),
('23070122178', 'Reuel Menon'),
('23070122179', 'Ria Vinod'),
('23070122180', 'Rishi Modi'),
('23070122181', 'Rishi Saxena'),
('23070122183', 'Rishika Arora'),
('23070122184', 'Riya Agrawal'),
('24070122513', 'Rudra Rajendra Khandelwal'),
('23070122186', 'Rut Vaghani'),
('23070122247', 'Saara Jagdale'),
('23070122073', 'Sahoo Bishwajeet Laxman'),
('23070122189', 'Samartha Shrestha'),
('23070122191', 'Sameer Shekhar'),
('23070122192', 'Sanidhya Rajendra Awasthi'),
('23070122193', 'Sanskriti Shrivastava'),
('23070122194', 'Sanyukt Ramola'),
('23070122273', 'Sara Suleiman'),
('23070122277', 'Sashank Karn'),
('23070122195', 'Saumya Kumar'),
('23070122196', 'Sayyed Faheemuddin Muqeemuddin'),
('23070122051', 'Shah Arya Amit'),
('24070122514', 'Shantanu Doifode'),
('23070122197', 'Shanvi Srivastava'),
('23070122198', 'Shashank Singh'),
('23070122202', 'Sheladia Aryan Ashish'),
('23070122203', 'Shivam Bhartiya'),
('23070122205', 'Shreyansh Suresh Saboo'),
('23070122214', 'Shreyash Sure'),
('23070122263', 'Shrivali Dutt'),
('23070122206', 'Shubhankar Sarangi'),
('23070122266', 'Sonali Gupta'),
('23070122207', 'Sonalika Singha'),
('23070122208', 'Soni Saumya Jaideep'),
('23070122209', 'Soniya Pandey'),
('23070122210', 'Soumyadev Adhikary'),
('23070122257', 'Sourav Singh'),
('23070122212', 'Sujit Nitin Gunjal'),
('23070122244', 'Sujit Singh'),
('23070122213', 'Sukaran Singh'),
('23070122255', 'Sumit Pathak'),
('23070122215', 'Sushant Kumar Yadav'),
('23070122216', 'Swarali Dhananjay Bhalerao'),
('23070122218', 'Tanisha Sirohi'),
('23070122220', 'Tanishka Tanaji Mane'),
('24070122515', 'Tanmay Sunil Salunkhe'),
('23070122221', 'Tanvee Kirankumar Patil'),
('23070122222', 'Tej Narayan Sah'),
('23070122223', 'Tiparadi Amit Avinash'),
('23070122224', 'Tisha Malkani'),
('24070122516', 'Trivedi Harsh Prahoshbhai'),
('23070122256', 'Utsav Raj Singh'),
('23070122227', 'Uttkarsh Ruparel'),
('23070122228', 'Vanshika Dhawan'),
('23070122229', 'Vedant Chavle'),
('23070122230', 'Vedant Nair'),
('23070122231', 'Vedika Kodgire'),
('23070122232', 'Velagala Prapul Krishna Reddy'),
('23070122074', 'Viraj Sheoran'),
('23070122234', 'Yash Pandey'),
('23070122235', 'Yash Patel'),
('23070122236', 'Yashmit Kotekar'),
('23070122237', 'Yashraj Shrivastava'),
('23070122238', 'Yudhveer'),
('23070122239', 'Yug Choubey'),
('1234',        'Dinesh Wadhwani')
ON CONFLICT (prn) DO NOTHING;
