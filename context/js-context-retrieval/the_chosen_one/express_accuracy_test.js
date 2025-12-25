/**
 * Express API Accuracy Test
 * Real-world questions a backend developer would ask an AI agent
 */

const { search } = require('./search_engine');
const path = require('path');

const TEST_FILE = path.join(__dirname, 'express.test.js');

// Questions a REAL vibe coder would ask about their Express backend
const QUESTIONS = [
  // === BUG HUNTING (what devs ask most) ===
  {
    query: "there's a memory leak somewhere in my code, where is it?",
    expectedFunction: "rateLimit"
  },
  {
    query: "why is the token never expiring? jwt issue",
    expectedFunction: "app.post('/api/auth/login'"
  },
  {
    query: "security bug exposing user info in registration",
    expectedFunction: "app.post('/api/auth/register'"
  },
  {
    query: "where am i leaking the password hash to client?",
    expectedFunction: "app.post('/api/auth/register'"
  },
  {
    query: "forgot password endpoint has security issue, which one?",
    expectedFunction: "app.post('/api/auth/forgot-password'"
  },
  {
    query: "bug where price can be negative, product creation",
    expectedFunction: "app.post('/api/products'"
  },
  {
    query: "race condition in stock update, where?",
    expectedFunction: "app.patch('/api/products/:id/stock'"
  },
  {
    query: "not checking stock when adding to cart bug",
    expectedFunction: "app.post('/api/cart/items'"
  },
  {
    query: "floating point precision issue in cart total",
    expectedFunction: "app.post('/api/cart/items'"
  },
  {
    query: "order stock deduction not transactional bug",
    expectedFunction: "app.post('/api/orders'"
  },
  {
    query: "any user can view any order, authorization bug",
    expectedFunction: "app.get('/api/orders/:id'"
  },
  {
    query: "search is case sensitive bug fix needed",
    expectedFunction: "app.get('/api/search'"
  },
  {
    query: "no file type validation in upload, security hole",
    expectedFunction: "storage"
  },
  {
    query: "old images not deleted, storage bloat issue",
    expectedFunction: "app.post('/api/products/:id/image'"
  },
  {
    query: "stack trace exposed to users, production bug",
    expectedFunction: "app.use((err, req, res, next)"
  },
  {
    query: "hardcoded secret key in code, where?",
    expectedFunction: "JWT_SECRET"
  },
  
  // === FEATURE LOCATION ===
  {
    query: "where is user registration handled?",
    expectedFunction: "app.post('/api/auth/register'"
  },
  {
    query: "how does login work in this api?",
    expectedFunction: "app.post('/api/auth/login'"
  },
  {
    query: "where is jwt token generated?",
    expectedFunction: "app.post('/api/auth/login'"
  },
  {
    query: "show me the auth middleware",
    expectedFunction: "authMiddleware"
  },
  {
    query: "how do i check if user is admin?",
    expectedFunction: "adminOnly"
  },
  {
    query: "where is rate limiting implemented?",
    expectedFunction: "rateLimit"
  },
  {
    query: "request logging middleware code",
    expectedFunction: "requestLogger"
  },
  {
    query: "how does pagination work for products?",
    expectedFunction: "app.get('/api/products'"
  },
  {
    query: "where do i create a new product?",
    expectedFunction: "app.post('/api/products'"
  },
  {
    query: "how to update product stock?",
    expectedFunction: "app.patch('/api/products/:id/stock'"
  },
  {
    query: "delete product endpoint",
    expectedFunction: "app.delete('/api/products/:id'"
  },
  {
    query: "get user's shopping cart",
    expectedFunction: "app.get('/api/cart'"
  },
  {
    query: "add item to cart route",
    expectedFunction: "app.post('/api/cart/items'"
  },
  {
    query: "remove item from cart api",
    expectedFunction: "app.delete('/api/cart/items/:productId'"
  },
  {
    query: "checkout and create order from cart",
    expectedFunction: "app.post('/api/orders'"
  },
  {
    query: "list user's order history",
    expectedFunction: "app.get('/api/orders'"
  },
  {
    query: "update order status shipping",
    expectedFunction: "app.patch('/api/orders/:id/status'"
  },
  {
    query: "product search functionality",
    expectedFunction: "app.get('/api/search'"
  },
  {
    query: "upload image for product",
    expectedFunction: "app.post('/api/products/:id/image'"
  },
  {
    query: "multer file storage config",
    expectedFunction: "storage"
  },
  {
    query: "get all users admin endpoint",
    expectedFunction: "app.get('/api/admin/users'"
  },
  {
    query: "admin dashboard statistics",
    expectedFunction: "app.get('/api/admin/stats'"
  },
  {
    query: "health check endpoint",
    expectedFunction: "app.get('/health'"
  },
  {
    query: "404 not found handler",
    expectedFunction: "app.use((req, res)"
  },
  {
    query: "global error handler middleware",
    expectedFunction: "app.use((err, req, res, next)"
  },
  {
    query: "where does server start listening?",
    expectedFunction: "app.listen"
  },
  
  // === HOW DOES X WORK ===
  {
    query: "how is password hashed before storing?",
    expectedFunction: "app.post('/api/auth/register'"
  },
  {
    query: "how does token verification work?",
    expectedFunction: "authMiddleware"
  },
  {
    query: "how is cart total calculated?",
    expectedFunction: "app.post('/api/cart/items'"
  },
  {
    query: "how does stock validation work in orders?",
    expectedFunction: "app.post('/api/orders'"
  },
  {
    query: "how are orders filtered by user?",
    expectedFunction: "app.get('/api/orders'"
  },
  {
    query: "how does admin stats revenue calculation work?",
    expectedFunction: "app.get('/api/admin/stats'"
  },
  
  // === WHY IS X HAPPENING ===
  {
    query: "why am i getting 401 unauthorized?",
    expectedFunction: "authMiddleware"
  },
  {
    query: "why is admin check failing?",
    expectedFunction: "adminOnly"
  },
  {
    query: "why getting 429 too many requests?",
    expectedFunction: "rateLimit"
  },
  {
    query: "why is product creation returning 400?",
    expectedFunction: "app.post('/api/products'"
  },
  {
    query: "why cant i checkout, cart empty error?",
    expectedFunction: "app.post('/api/orders'"
  },
  
  // === REAL DEBUGGING SCENARIOS ===
  {
    query: "users complain password reset reveals if email exists",
    expectedFunction: "app.post('/api/auth/forgot-password'"
  },
  {
    query: "performance issue, stats endpoint slow",
    expectedFunction: "app.get('/api/admin/stats'"
  },
  {
    query: "rate limiter not resetting properly after window",
    expectedFunction: "rateLimit"
  },
  {
    query: "someone uploaded malicious file to server",
    expectedFunction: "storage"
  },
  {
    query: "user accessed another users order somehow",
    expectedFunction: "app.get('/api/orders/:id'"
  },
  
  // === DATABASE / DATA ===
  {
    query: "where is database initialized?",
    expectedFunction: "db"
  },
  {
    query: "where are users stored?",
    expectedFunction: "db"
  },
  {
    query: "order id auto increment logic",
    expectedFunction: "orderIdCounter"
  },
  {
    query: "product id generation",
    expectedFunction: "productIdCounter"
  },
  
  // === CONFIGURATION ===
  {
    query: "what port does server run on?",
    expectedFunction: "PORT"
  },
  {
    query: "bcrypt salt rounds setting",
    expectedFunction: "SALT_ROUNDS"
  },
  {
    query: "jwt secret configuration",
    expectedFunction: "JWT_SECRET"
  },
  
  // === VAGUE REAL-WORLD QUERIES ===
  {
    query: "authentication stuff",
    expectedFunction: "authMiddleware"
  },
  {
    query: "the cart thing",
    expectedFunction: "app.get('/api/cart'"
  },
  {
    query: "order creation logic",
    expectedFunction: "app.post('/api/orders'"
  },
  {
    query: "product crud operations",
    expectedFunction: "app.post('/api/products'"
  },
  {
    query: "middleware that checks token",
    expectedFunction: "authMiddleware"
  },
  {
    query: "file upload stuff",
    expectedFunction: "upload"
  },
  {
    query: "admin only routes",
    expectedFunction: "adminOnly"
  },
  {
    query: "error handling",
    expectedFunction: "app.use((err, req, res, next)"
  }
];

async function runAccuracyTest() {
  console.log('='.repeat(60));
  console.log('EXPRESS API ACCURACY TEST');
  console.log(`Testing ${QUESTIONS.length} real-world developer questions`);
  console.log('='.repeat(60));
  console.log();
  
  const results = {
    top1: 0,
    top3: 0,
    top5: 0,
    failures: []
  };
  
  for (let i = 0; i < QUESTIONS.length; i++) {
    const { query, expectedFunction } = QUESTIONS[i];
    
    try {
      const searchResults = await search(TEST_FILE, query, {
        topK: 5,
        minLines: 5,
        maxLines: 80
      });
      
      // Check if expected function is in results
      const foundIndex = searchResults.findIndex(r => {
        const nameMatches = r.name && (r.name.includes(expectedFunction) || expectedFunction.includes(r.name));
        const codeMatches = r.code && r.code.includes(expectedFunction);
        return nameMatches || codeMatches;
      });
      
      const passed = foundIndex !== -1;
      const inTop1 = foundIndex === 0;
      const inTop3 = foundIndex >= 0 && foundIndex < 3;
      const inTop5 = foundIndex >= 0 && foundIndex < 5;
      
      if (inTop1) results.top1++;
      if (inTop3) results.top3++;
      if (inTop5) results.top5++;
      
      const status = inTop1 ? '✅ TOP-1' : (inTop3 ? '🟡 TOP-3' : (inTop5 ? '🟠 TOP-5' : '❌ MISS'));
      
      console.log(`${String(i + 1).padStart(2)}. ${status} | "${query.substring(0, 45)}..."`);
      
      if (!passed) {
        results.failures.push({
          question: query,
          expected: expectedFunction,
          got: searchResults.slice(0, 3).map(r => r.name || `[lines ${r.start}-${r.end}]`)
        });
      }
    } catch (err) {
      console.log(`${String(i + 1).padStart(2)}. ❌ ERROR | "${query.substring(0, 45)}..." - ${err.message}`);
      results.failures.push({
        question: query,
        expected: expectedFunction,
        got: `ERROR: ${err.message}`
      });
    }
  }
  
  // Summary
  console.log();
  console.log('='.repeat(60));
  console.log('RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Questions: ${QUESTIONS.length}`);
  console.log();
  console.log(`Top-1 Accuracy: ${((results.top1 / QUESTIONS.length) * 100).toFixed(1)}% (${results.top1}/${QUESTIONS.length})`);
  console.log(`Top-3 Accuracy: ${((results.top3 / QUESTIONS.length) * 100).toFixed(1)}% (${results.top3}/${QUESTIONS.length}) ← FOR AI`);
  console.log(`Top-5 Accuracy: ${((results.top5 / QUESTIONS.length) * 100).toFixed(1)}% (${results.top5}/${QUESTIONS.length})`);
  
  if (results.failures.length > 0) {
    console.log();
    console.log('='.repeat(60));
    console.log(`FAILURES (${results.failures.length}):`);
    console.log('='.repeat(60));
    results.failures.forEach((f, i) => {
      console.log(`\n${i + 1}. Query: "${f.question}"`);
      console.log(`   Expected: ${f.expected}`);
      console.log(`   Got: ${Array.isArray(f.got) ? f.got.join(', ') : f.got}`);
    });
  }
  
  return results;
}

runAccuracyTest().catch(console.error);
