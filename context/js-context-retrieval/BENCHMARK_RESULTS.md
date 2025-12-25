# 🏆 Code Search Engine - Final Benchmark Results

> **Generated:** 25/12/2025 6:58:13 am
> **Test Files:** 3 files, 88 questions total

---

## 📊 Overall Results

| Rank | Engine | Type | Score | Percentage | Visual |
|:----:|--------|:----:|------:|:----------:|--------|
| 🥇 | **Claude (biased)** | ⚠️ Biased | 730.6 / 880 | 83% | `█████████████████░░░` |
| 🥈 | **Claude PURE** | ✅ PURE | 692.6 / 880 | 78.7% | `████████████████░░░░` |
| 🥉 | **Gemini (biased)** | ⚠️ Biased | 555.9 / 880 | 63.2% | `█████████████░░░░░░░` |
| 4 | **Gemini PURE** | ✅ PURE | 467.6 / 880 | 53.1% | `███████████░░░░░░░░░` |

---

## 📁 Results by Test File

### Task Queue System (`test.file.js`)

| Engine | Score | Percentage |
|--------|------:|:----------:|
| Claude PURE | 201.2 / 240 | 83.8% |
| Claude (biased) | 196.1 / 240 | 81.7% |
| Gemini (biased) | 102.7 / 240 | 42.8% |
| Gemini PURE | 98.8 / 240 | 41.2% |

### Web Framework (`test2.file.js`)

| Engine | Score | Percentage |
|--------|------:|:----------:|
| Claude PURE | 221.6 / 300 | 73.9% |
| Gemini (biased) | 220.0 / 300 | 73.3% |
| Claude (biased) | 214.7 / 300 | 71.6% |
| Gemini PURE | 143.3 / 300 | 47.8% |

### Microservices Patterns (`test3.file.js`)

| Engine | Score | Percentage |
|--------|------:|:----------:|
| Claude (biased) | 319.9 / 340 | 94.1% |
| Claude PURE | 269.8 / 340 | 79.3% |
| Gemini (biased) | 233.2 / 340 | 68.6% |
| Gemini PURE | 225.5 / 340 | 66.3% |

---

## 📂 Results by Category

| Category | Claude | Claude | Gemini | Gemini |
|----------|------:|------:|------:|------:|
| APIGateway | 8.0/10 | 9.5/10 | 9.8/10 | 9.8/10 |
| Auth | 5.0/10 | 9.0/10 | 0.0/10 | 10.0/10 |
| Cache | 7.5/10 | 10.0/10 | 5.0/10 | 5.0/10 |
| CircuitBreaker | 9.5/10 | 10.0/10 | 10.0/10 | 0.0/10 |
| Config | 2.9/10 | 6.5/10 | 7.6/10 | 7.6/10 |
| ConfigStore | 8.8/10 | 8.8/10 | 4.5/10 | 4.5/10 |
| Database | 7.5/10 | 9.2/10 | 10.0/10 | 5.0/10 |
| DistributedLock | 9.4/10 | 8.3/10 | 5.9/10 | 6.5/10 |
| Events | 10.0/10 | 9.9/10 | 5.0/10 | 2.5/10 |
| Filesystem | 10.0/10 | 10.0/10 | 10.0/10 | 10.0/10 |
| HealthMonitor | 10.0/10 | 8.6/10 | 6.6/10 | 4.1/10 |
| Lifecycle | 0.0/10 | 7.5/10 | 10.0/10 | 10.0/10 |
| LoadBalancer | 10.0/10 | 7.5/10 | 7.7/10 | 7.7/10 |
| Logger | 2.5/10 | 4.8/10 | 10.0/10 | 5.0/10 |
| MessageQueue | 9.4/10 | 7.4/10 | 6.4/10 | 4.4/10 |
| Metrics | 7.8/10 | 7.4/10 | 2.0/10 | 2.0/10 |
| Queue | 10.0/10 | 10.0/10 | 3.1/10 | 2.5/10 |
| RateLimiter | 5.0/10 | 5.0/10 | 7.5/10 | 3.3/10 |
| Retry | 10.0/10 | 10.0/10 | 5.0/10 | 5.0/10 |
| RetryHandler | 9.6/10 | 4.5/10 | 3.2/10 | 6.5/10 |
| Router | 10.0/10 | 5.0/10 | 7.5/10 | 7.5/10 |
| ServiceRegistry | 10.0/10 | 8.0/10 | 8.0/10 | 8.0/10 |
| Session | 10.0/10 | 7.5/10 | 7.5/10 | 5.0/10 |
| Status | 4.1/10 | 3.5/10 | 6.5/10 | 6.5/10 |
| Tasks | 0.0/10 | 0.0/10 | 0.0/10 | 0.0/10 |
| Validation | 8.4/10 | 8.4/10 | 6.7/10 | 3.3/10 |

---

## 🔬 Analysis

### Winner: **Claude (biased)**

- **Overall Score:** 730.6 / 880 (83%)
- **Lead over Runner-up:** +4.3 percentage points
- **Engine Type:** Keyword-Biased

### Key Insights

⚠️ **Biased engines still lead** - Keyword-specific tuning provides advantages on these test files.

### Per-File Performance

- **Task Queue System:** Claude PURE wins (83.8%) - ✅ PURE
- **Web Framework:** Claude PURE wins (73.9%) - ✅ PURE
- **Microservices Patterns:** Claude (biased) wins (94.1%) - ⚠️ Biased

---

## 📋 Detailed Question Results

<details>
<summary>Click to expand all 88 questions</summary>

### Task Queue System

| # | Category | Query | Truth | Claude (biased) | Claude PURE |
|---|----------|-------|-------|------|------|
| 1 | Retry | How does the system retry failed tasks with exp... | L78-93 | 10.0 | 10.0 |
| 2 | Retry | Where is the exponential delay calculated for r... | L86-92 | 10.0 | 10.0 |
| 3 | Retry | How many retry attempts are allowed per task? | L75-93 | 10.0 | 10.0 |
| 4 | Retry | Where are task attempts incremented? | L81-84 | 10.0 | 10.0 |
| 5 | Metrics | Where are system health metrics computed? | L96-105 | 9.0 | 0.0 |
| 6 | Metrics | How is system uptime calculated? | L96-101 | 10.0 | 10.0 |
| 7 | Metrics | Where is success rate derived from completed an... | L98-104 | 10.0 | 10.0 |
| 8 | Metrics | Where are active and queued tasks counted? | L97-100 | 10.0 | 10.0 |
| 9 | Queue | Where are tasks registered into the system? | L33-63 | 10.0 | 10.0 |
| 10 | Queue | How are tasks added to the execution queue? | L44-50 | 10.0 | 10.0 |
| 11 | Queue | Where does task processing start automatically? | L52-55 | 10.0 | 10.0 |
| 12 | Queue | How does the system enforce concurrency limits? | L57-70 | 10.0 | 10.0 |
| 13 | Queue | Where is running task count incremented and dec... | L65-74 | 10.0 | 10.0 |
| 14 | Queue | Where does task execution actually happen? | L60-74 | 10.0 | 10.0 |
| 15 | Events | Where are task success events emitted? | L66-69 | 10.0 | 10.0 |
| 16 | Events | Where are task failure events handled? | L69-73 | 10.0 | 10.0 |
| 17 | Database | Where is database cleanup simulated? | L155-160 | 10.0 | 6.7 |
| 18 | Database | What logic simulates database failure? | L156-159 | 10.0 | 10.0 |
| 19 | Tasks | Where are image processing tasks created? | L163-170 | 0.0 | 0.0 |
| 20 | Status | How does the system periodically report status? | L173-189 | 4.1 | 3.5 |
| 21 | Metrics | Where are metrics exported to disk? | L118-134 | 0.0 | 7.1 |
| 22 | Lifecycle | How does the system handle graceful shutdown on... | L229-232 | 0.0 | 7.5 |
| 23 | Filesystem | How is disk usage calculated recursively? | L247-260 | 10.0 | 10.0 |
| 24 | Config | Where is configuration loaded from environment ... | L268-284 | 2.9 | 6.5 |

### Web Framework

| # | Category | Query | Truth | Claude (biased) | Claude PURE |
|---|----------|-------|-------|------|------|
| 1 | Cache | Where does the cache store values with TTL? | L16-21 | 10.0 | 10.0 |
| 2 | Cache | How does the cache retrieve values and track hi... | L22-35 | 10.0 | 10.0 |
| 3 | Cache | Where is automatic cache cleanup scheduled? | L37-44 | 10.0 | 10.0 |
| 4 | Cache | How are cache hit rate statistics calculated? | L46-56 | 0.0 | 10.0 |
| 5 | RateLimiter | Where are rate limiter tokens refilled over time? | L75-84 | 10.0 | 10.0 |
| 6 | RateLimiter | How does the system check if a request is rate ... | L85-102 | 0.0 | 0.0 |
| 7 | RateLimiter | Where are clients blocked for exceeding limits? | L104-107 | 10.0 | 10.0 |
| 8 | RateLimiter | How is client block status verified? | L108-116 | 0.0 | 0.0 |
| 9 | Logger | Where are HTTP requests logged with metadata? | L129-145 | 0.0 | 0.0 |
| 10 | Logger | How does the logger rotate old entries? | L147-152 | 0.0 | 10.0 |
| 11 | Logger | Where is the request error rate calculated? | L162-166 | 0.0 | 0.0 |
| 12 | Logger | How can logs be searched with filters? | L167-176 | 10.0 | 9.0 |
| 13 | Router | Where is middleware added to the router? | L188-190 | 10.0 | 10.0 |
| 14 | Router | How are routes added with method and path? | L192-195 | 10.0 | 0.0 |
| 15 | Router | How does the router execute middleware in seque... | L217-229 | 10.0 | 10.0 |
| 16 | Router | Where does the router match and dispatch to han... | L231-245 | 10.0 | 0.0 |
| 17 | Auth | Where is the Bearer token authentication checked? | L279-292 | 10.0 | 10.0 |
| 18 | Auth | How are authentication tokens validated? | L287-296 | 0.0 | 8.0 |
| 19 | Session | Where are user sessions created with IDs? | L349-361 | 10.0 | 10.0 |
| 20 | Session | How are unique session IDs generated? | L362-364 | 10.0 | 10.0 |
| 21 | Session | Where is session data retrieved and validated? | L365-377 | 10.0 | 0.0 |
| 22 | Session | How are expired sessions cleaned up? | L382-391 | 10.0 | 10.0 |
| 23 | Validation | Where is email format validated with regex? | L399-403 | 8.0 | 8.0 |
| 24 | Validation | How are password requirements enforced? | L404-409 | 8.3 | 8.3 |
| 25 | Validation | Where is user input sanitized for XSS? | L416-424 | 8.9 | 8.9 |
| 26 | Database | How does the pool acquire database connections? | L453-464 | 10.0 | 10.0 |
| 27 | Database | Where are connections released back to the pool? | L466-477 | 0.0 | 10.0 |
| 28 | Events | How are event listeners subscribed? | L498-508 | 10.0 | 10.0 |
| 29 | Events | Where are events published to subscribers? | L514-530 | 10.0 | 9.4 |
| 30 | CircuitBreaker | How does the circuit breaker protect function c... | L572-590 | 9.5 | 10.0 |

### Microservices Patterns

| # | Category | Query | Truth | Claude (biased) | Claude PURE |
|---|----------|-------|-------|------|------|
| 1 | ServiceRegistry | How are new services registered with endpoints? | L14-27 | 10.0 | 0.0 |
| 2 | ServiceRegistry | Where is a service deregistered by ID? | L30-40 | 10.0 | 10.0 |
| 3 | ServiceRegistry | How does service discovery find healthy instances? | L43-51 | 10.0 | 10.0 |
| 4 | ServiceRegistry | Where is heartbeat updated for a service? | L54-60 | 10.0 | 10.0 |
| 5 | ServiceRegistry | How are stale services detected and marked unhe... | L63-73 | 10.0 | 10.0 |
| 6 | LoadBalancer | How does round-robin select the next server? | L82-88 | 10.0 | 10.0 |
| 7 | LoadBalancer | Where is the server with least connections sele... | L91-107 | 10.0 | 10.0 |
| 8 | LoadBalancer | How does weighted selection distribute traffic? | L110-123 | 10.0 | 10.0 |
| 9 | LoadBalancer | Where is connection tracking started for a server? | L139-142 | 10.0 | 7.5 |
| 10 | LoadBalancer | How are active connections decremented? | L145-148 | 10.0 | 0.0 |
| 11 | APIGateway | How is API key validated for expiry? | L161-169 | 10.0 | 10.0 |
| 12 | APIGateway | Where are new API keys registered? | L172-179 | 10.0 | 7.5 |
| 13 | APIGateway | How does rate limiting check request counts? | L182-196 | 10.0 | 10.0 |
| 14 | APIGateway | Where are requests routed to backend services? | L199-217 | 0.0 | 10.0 |
| 15 | APIGateway | How is the request forwarded to the endpoint? | L220-232 | 10.0 | 10.0 |
| 16 | MessageQueue | Where is a new message queue created? | L242-253 | 10.0 | 10.0 |
| 17 | MessageQueue | How are messages published with priority? | L256-280 | 7.2 | 7.2 |
| 18 | MessageQueue | Where is a message consumed from the queue? | L283-293 | 10.0 | 10.0 |
| 19 | MessageQueue | How are failed messages moved to dead letter qu... | L301-308 | 10.0 | 0.0 |
| 20 | MessageQueue | Where are queue subscribers notified? | L318-328 | 10.0 | 10.0 |
| 21 | DistributedLock | How is a distributed lock acquired with timeout? | L338-357 | 7.5 | 7.5 |
| 22 | DistributedLock | Where does the system wait for lock release? | L360-372 | 10.0 | 10.0 |
| 23 | DistributedLock | How is a lock released and waiting queue proces... | L375-410 | 10.0 | 6.7 |
| 24 | DistributedLock | Where is lock duration extended? | L413-422 | 10.0 | 9.0 |
| 25 | HealthMonitor | How is a single health check executed? | L441-466 | 10.0 | 9.2 |
| 26 | HealthMonitor | Where are all health checks run together? | L469-475 | 10.0 | 10.0 |
| 27 | HealthMonitor | How is overall system health status determined? | L478-494 | 10.0 | 5.3 |
| 28 | HealthMonitor | Where is periodic health monitoring started? | L497-505 | 10.0 | 10.0 |
| 29 | RetryHandler | How is exponential backoff delay calculated wit... | L524-531 | 8.8 | 8.8 |
| 30 | RetryHandler | Where is function executed with retry logic? | L534-550 | 10.0 | 4.7 |
| 31 | RetryHandler | How does the system determine if an error is re... | L553-563 | 10.0 | 0.0 |
| 32 | ConfigStore | Where is configuration value set with versioning? | L578-591 | 6.4 | 6.4 |
| 33 | ConfigStore | How are configuration watchers notified of chan... | L607-616 | 10.0 | 10.0 |
| 34 | ConfigStore | Where is configuration loaded from an object? | L628-632 | 10.0 | 10.0 |

</details>

---

## 🛠️ Methodology

- **Scoring:** Partial credit based on line overlap (0-10 per question)
- **PURE Engines:** Use only universal programming synonyms, no test-file-specific keywords
- **Biased Engines:** May contain keywords tuned to specific test files
- **Fair Comparison:** All engines tested on same questions with identical ground truth

---

*Generated by Comprehensive Benchmark Suite*
