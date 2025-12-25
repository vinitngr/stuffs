const { search } = require('./index.js');
const fs = require('fs');
const path = require('path');

const TEST_FILE = path.join(__dirname, '../the_chosen_one/express.test.js');
const CODE = fs.readFileSync(TEST_FILE, 'utf8');
const LINES = CODE.split('\n');

const QUESTIONS = [
  { query: "memory leak in code", expect: "rateLimit" },
  { query: "jwt token never expiring", expect: "app.post('/api/auth/login'" },
  { query: "security bug leaking password hash", expect: "app.post('/api/auth/register'" },
  { query: "forgot password security issue", expect: "app.post('/api/auth/forgot-password'" },
  { query: "negative price bug product creation", expect: "app.post('/api/products'" },
  { query: "race condition stock update", expect: "app.patch('/api/products/:id/stock'" },
  { query: "cart does not check stock", expect: "app.post('/api/cart/items'" },
  { query: "floating point bug cart total", expect: "app.post('/api/cart/items'" },
  { query: "order stock not transactional", expect: "app.post('/api/orders'" },
  { query: "authorization bug view other orders", expect: "app.get('/api/orders/:id'" },
  { query: "search case sensitivity bug", expect: "app.get('/api/search'" },
  { query: "file upload security issue", expect: "storage" },
  { query: "old images not deleted", expect: "app.post('/api/products/:id/image'" },
  { query: "stack trace exposed to users", expect: "app.use((err, req, res, next)" },
  { query: "hardcoded jwt secret", expect: "JWT_SECRET" },

  { query: "user registration endpoint", expect: "app.post('/api/auth/register'" },
  { query: "login endpoint logic", expect: "app.post('/api/auth/login'" },
  { query: "jwt generation code", expect: "app.post('/api/auth/login'" },
  { query: "authentication middleware", expect: "authMiddleware" },
  { query: "admin check logic", expect: "adminOnly" },
  { query: "rate limiting implementation", expect: "rateLimit" },
  { query: "request logging middleware", expect: "requestLogger" },
  { query: "product pagination", expect: "app.get('/api/products'" },
  { query: "create new product api", expect: "app.post('/api/products'" },
  { query: "update product stock", expect: "app.patch('/api/products/:id/stock'" },
  { query: "delete product api", expect: "app.delete('/api/products/:id'" },
  { query: "get user cart", expect: "app.get('/api/cart'" },
  { query: "add item to cart", expect: "app.post('/api/cart/items'" },
  { query: "remove cart item", expect: "app.delete('/api/cart/items/:productId'" },
  { query: "checkout create order", expect: "app.post('/api/orders'" },
  { query: "order history", expect: "app.get('/api/orders'" },
  { query: "update order status", expect: "app.patch('/api/orders/:id/status'" },
  { query: "product search", expect: "app.get('/api/search'" },
  { query: "upload product image", expect: "app.post('/api/products/:id/image'" },
  { query: "multer storage config", expect: "storage" },
  { query: "admin get users", expect: "app.get('/api/admin/users'" },
  { query: "admin stats endpoint", expect: "app.get('/api/admin/stats'" },
  { query: "health check endpoint", expect: "app.get('/health'" },
  { query: "404 handler", expect: "app.use((req, res)" },
  { query: "global error handler", expect: "app.use((err, req, res, next)" },
  { query: "server listen port", expect: "app.listen" },

  { query: "authentication stuff", expect: "authMiddleware" },
  { query: "cart thing", expect: "app.get('/api/cart'" },
  { query: "order creation logic", expect: "app.post('/api/orders'" },
  { query: "product crud", expect: "app.post('/api/products'" },
  { query: "middleware that checks token", expect: "authMiddleware" },
  { query: "file upload stuff", expect: "upload" },
  { query: "admin only routes", expect: "adminOnly" },
  { query: "error handling", expect: "app.use((err, req, res, next)" }
];

function snippetContains(result, expected) {
  const snippet = LINES.slice(result.start - 1, result.end).join('\n');
  return snippet.includes(expected);
}

function run() {
  console.log('='.repeat(70));
  console.log('EXPRESS REAL-WORLD QUERY ACCURACY TEST');
  console.log(`Questions: ${QUESTIONS.length}`);
  console.log('='.repeat(70));
  console.log();

  let top1 = 0, top3 = 0, top5 = 0;

  QUESTIONS.forEach((q, i) => {
    const results = search(CODE, q.query, { topK: 5, minLines: 5, maxLines: 80 });
    const idx = results.findIndex(r => snippetContains(r, q.expect));

    if (idx === 0) top1++;
    if (idx >= 0 && idx < 3) top3++;
    if (idx >= 0 && idx < 5) top5++;

    const status =
      idx === 0 ? '✅ TOP-1' :
      idx < 3 ? '🟡 TOP-3' :
      idx < 5 ? '🟠 TOP-5' :
      '❌ MISS';

    console.log(`${String(i + 1).padStart(2)}. ${status} | ${q.query}`);
  });

  console.log('\n' + '='.repeat(70));
  console.log('RESULTS');
  console.log('='.repeat(70));
  console.log(`Top-1 Accuracy: ${(top1 / QUESTIONS.length * 100).toFixed(1)}% (${top1}/${QUESTIONS.length})`);
  console.log(`Top-3 Accuracy: ${(top3 / QUESTIONS.length * 100).toFixed(1)}% (${top3}/${QUESTIONS.length})`);
  console.log(`Top-5 Accuracy: ${(top5 / QUESTIONS.length * 100).toFixed(1)}% (${top5}/${QUESTIONS.length})`);
}

run();