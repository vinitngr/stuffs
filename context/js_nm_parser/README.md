# JavaScript Code Retriever (test)

AST-guided heuristic engine for selecting precise code ranges from natural-language queries.
Used to pick the *right lines* from large files before passing context to other systems.

---

## What’s happening here (short)

* Multiple retrievers exist in this repo
* All of them work
* **the_chosen_one** is the final, configurable engine
* Other engines exist only for benchmarking and comparison
* Accuracy is measured by whether the correct line range appears in Top-K results

---

## Main engine results — `the_chosen_one`

### Full benchmark (88 questions)

| File          |    Top-1 Accuracy |    Top-3 Accuracy |    Top-5 Accuracy |
| ------------- | ----------------: | ----------------: | ----------------: |
| test.file.js  |               92% |              100% |                 — |
| test2.file.js |               73% |               97% |                 — |
| test3.file.js |               91% |               94% |                 — |
| **Overall**   | **85.2% (75/88)** | **96.6% (85/88)** | **98.9% (87/88)** |

Top-3 is treated as the practical cutoff for AI context injection.

---

### Lightweight / keyword-style queries (73 questions)

Examples:

* global error handler middleware
* where does server start listening
* how is password hashed before storing

| Metric |      Accuracy |
| ------ | ------------: |
| Top-1  | 68.5% (50/73) |
| Top-3  | 86.3% (63/73) |
| Top-5  | 91.8% (67/73) |

Short queries contain less signal, lowering Top-1 accuracy.
Top-3 remains stable and usable.

---

## Other engines (benchmark only)

These engines exist for comparison and learning, not for primary use.

### Full benchmark summary (88 questions)

| Engine          | Type   | Accuracy |
| --------------- | ------ | -------: |
| Claude (biased) | Biased |      83% |
| Claude PURE     | Pure   |    78.7% |
| Gemini (biased) | Biased |    63.2% |
| Gemini PURE     | Pure   |    53.1% |

---

## Notes

* the_chosen_one is the most complete and configurable implementation
* Other engines are kept to understand trade-offs and behavior
* Focus is on **structure + precision**, not generation