# Vector Database Assessment — Future-Proofing for Semantic Search

## Overview

This document outlines how we would integrate a vector database (specifically **pgvector** on PostgreSQL) into the MOMENTUM platform for semantic similarity search on stock behavior and charting patterns.

> **Status**: Architecture assessment only. No production code required yet.

---

## Use Cases

### 1. Chart Pattern Similarity
- **Query**: "Find me stocks whose 30-day chart looks like AAPL's breakout in Oct 2024"
- **Implementation**: Encode 30-day OHLCV windows into embeddings, query by cosine similarity
- **Embedding approach**: 1D-CNN autoencoder trained on normalized price series → 128-dim vector

### 2. Regime Similarity
- **Query**: "Which stocks behave similarly to NVDA in a trending regime?"
- **Implementation**: Multi-feature embedding combining ADX, TRIX, Stoch, Elder, and sector metadata
- **Vector**: `[adx, trix, stoch_k, stoch_d, elder_hist_z, composite, volatility, return_20d]` → 64-dim after PCA

### 3. Strategy Pattern Matching
- **Query**: "Show me past backtests where similar market conditions produced high returns"
- **Implementation**: Embed backtest context (entry signals, regime, sector sentiment) → match against historical runs

---

## Proposed Architecture

```
┌──────────────────────────────────┐
│  PostgreSQL + pgvector           │
│                                  │
│  stock_embeddings                │
│    ticker TEXT                   │
│    window_date DATE              │
│    embedding VECTOR(128)         │
│    metadata JSONB                │
│                                  │
│  regime_embeddings               │
│    ticker TEXT                   │
│    date DATE                     │
│    embedding VECTOR(64)          │
│    regime TEXT                   │
│    composite FLOAT               │
│                                  │
│  pattern_catalog                 │
│    pattern_id SERIAL             │
│    name TEXT                     │
│    reference_embedding VECTOR(128)│
│    description TEXT              │
└──────────────────┬───────────────┘
                   │
          SQL: SELECT * FROM stock_embeddings
               ORDER BY embedding <=> query_vector
               LIMIT 10;
```

### pgvector Integration Steps

1. **Install**: `pip install pgvector psycopg2-binary`
2. **Enable extension**: `CREATE EXTENSION IF NOT EXISTS vector;`
3. **Schema**: Add `VECTOR(128)` column to store embeddings
4. **Indexing**: Use `ivfflat` index for fast approximate nearest neighbor search:
   ```sql
   CREATE INDEX ON stock_embeddings
   USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
   ```
5. **Query**: Cosine similarity lookup:
   ```sql
   SELECT ticker, 1 - (embedding <=> $1) AS similarity
   FROM stock_embeddings
   ORDER BY embedding <=> $1
   LIMIT 10;
   ```

### Embedding Generation Pipeline

```python
# Future: pipelines/embeddings.py

def encode_price_window(df: pd.DataFrame, window: int = 30) -> np.ndarray:
    """Encode a price window into a 128-dim embedding."""
    # Normalize: min-max scale the window
    close = df["Close"].iloc[-window:].values
    normalized = (close - close.min()) / (close.max() - close.min() + 1e-8)
    
    # Option A: Simple feature engineering (no ML needed)
    features = np.concatenate([
        normalized,                          # 30 dims: raw normalized prices
        np.diff(normalized),                 # 29 dims: returns
        [np.std(normalized)],                # 1 dim: volatility
        [np.mean(np.diff(normalized))],      # 1 dim: trend
        # ... pad to 128 dims
    ])
    
    # Option B: Pre-trained autoencoder (better quality)
    # embedding = autoencoder.encode(normalized.reshape(1, -1, 1))
    
    return features[:128]
```

### Migration Path

| Phase | Action | Effort |
|-------|--------|--------|
| 1 | Install PostgreSQL + pgvector alongside SQLite | 2h |
| 2 | Implement simple feature-based embeddings | 4h |
| 3 | Add `/api/similar/{ticker}` endpoint | 2h |
| 4 | Train autoencoder for better embeddings | 1-2 days |
| 5 | Add pattern catalog UI (frontend) | 1 day |

### Considerations

- **SQLite stays as primary**: We keep SQLite for OHLCV, backtests, and strategies. pgvector is additive.
- **Batch updates**: Embeddings are recomputed after each pipeline run (not on every request).
- **Dimensionality**: Start with 64-128 dims. Higher dims = better recall but slower queries.
- **Alternative**: If PostgreSQL is too heavy, consider **ChromaDB** (embedded, Python-native) or **Qdrant** (Rust-based, very fast).
