<!-- Mockup for plans/deployment.md: the tech stack drawn in Mermaid (compare tech-stack.html and tech-stack.excalidraw). Kept to small diagrams with plain labels, since Mermaid lays out large ones badly. -->

# ByTheBook tech stack (Mermaid)

## Runtime: who calls whom

```mermaid
%%{init: {'theme': 'neutral'}}%%
flowchart LR
  subgraph Browser
    UI[App UI]
    LIB[useLibrary]
    IDB[(Guest books: IndexedDB)]
    CAT[Opening catalog: bundled JSON]
    ENG[Stockfish WASM]
  end

  subgraph Vercel
    PROXY[proxy.ts]
    API[Route handlers /api]
    USE[recordUsage]
  end

  subgraph Supabase
    AUTH[Auth]
    BOOKS[(opening_books)]
    PC[(position_cache)]
    CNT[(usage_counters)]
  end

  LI{{Lichess Explorer}}

  UI -->|pages and fetches| PROXY
  LIB -->|account books| PROXY
  LIB -->|guest books| IDB
  PROXY --> API
  API --> USE
  USE --> CNT
  API --> AUTH
  API --> BOOKS
  API --> PC
  API -->|cache miss, signed-in only| LI
```

## Scripts you run locally

```mermaid
%%{init: {'theme': 'neutral'}}%%
flowchart LR
  PRE[cache:prefill] -->|thousands of calls| LI{{Lichess Explorer}}
  PRE -->|writes| PC[(position_cache)]
  INV[invites:create] -->|writes hashes| CODES[(access_codes)]
  CATB[catalog:download and :index] -->|generates| CAT[Opening catalog: bundled JSON]
  EX[books:examples] -->|writes files| PUB[public/books/examples]
```
