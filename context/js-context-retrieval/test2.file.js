const http = require('http');
const url = require('url');
const querystring = require('querystring');

/**
 * Simple In-Memory Cache with TTL
 */
class CacheManager {
  constructor(defaultTTL = 60000) {
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
    this.hits = 0;
    this.misses = 0;
  }

  set(key, value, ttl = this.defaultTTL) {
    const expiry = Date.now() + ttl;
    this.cache.set(key, { value, expiry });
    this.scheduleCleanup(key, ttl);
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) {
      this.misses++;
      return null;
    }
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    this.hits++;
    return item.value;
  }

  scheduleCleanup(key, ttl) {
    setTimeout(() => {
      const item = this.cache.get(key);
      if (item && Date.now() > item.expiry) {
        this.cache.delete(key);
      }
    }, ttl + 100);
  }

  getStats() {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? (this.hits / total * 100).toFixed(2) : 0,
      size: this.cache.size
    };
  }

  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

/**
 * Rate Limiter using Token Bucket Algorithm
 */
class RateLimiter {
  constructor(maxTokens = 100, refillRate = 10) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
    this.blocked = new Map();
  }

  refillTokens() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = Math.floor(elapsed * this.refillRate);
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  tryConsume(clientId, tokens = 1) {
    if (this.blocked.has(clientId)) {
      const unblockTime = this.blocked.get(clientId);
      if (Date.now() < unblockTime) {
        return { allowed: false, reason: 'blocked', retryAfter: unblockTime - Date.now() };
      }
      this.blocked.delete(clientId);
    }

    this.refillTokens();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return { allowed: true, remaining: this.tokens };
    }
    
    return { allowed: false, reason: 'rate_limit', remaining: this.tokens };
  }

  blockClient(clientId, duration = 60000) {
    this.blocked.set(clientId, Date.now() + duration);
  }

  isBlocked(clientId) {
    if (!this.blocked.has(clientId)) return false;
    if (Date.now() >= this.blocked.get(clientId)) {
      this.blocked.delete(clientId);
      return false;
    }
    return true;
  }
}

/**
 * Request Logger with Rotation
 */
class RequestLogger {
  constructor(maxLogs = 1000) {
    this.logs = [];
    this.maxLogs = maxLogs;
    this.errorCount = 0;
    this.requestCount = 0;
  }

  log(request) {
    this.requestCount++;
    const entry = {
      id: this.requestCount,
      timestamp: new Date().toISOString(),
      method: request.method,
      path: request.path,
      statusCode: request.statusCode,
      duration: request.duration,
      clientIp: request.clientIp
    };

    this.logs.push(entry);
    
    if (request.statusCode >= 400) {
      this.errorCount++;
    }

    this.rotateIfNeeded();
    return entry;
  }

  rotateIfNeeded() {
    if (this.logs.length > this.maxLogs) {
      const overflow = this.logs.length - this.maxLogs;
      this.logs.splice(0, overflow);
    }
  }

  getRecentLogs(count = 10) {
    return this.logs.slice(-count);
  }

  getErrorRate() {
    if (this.requestCount === 0) return 0;
    return (this.errorCount / this.requestCount * 100).toFixed(2);
  }

  searchLogs(filter) {
    return this.logs.filter(log => {
      if (filter.method && log.method !== filter.method) return false;
      if (filter.path && !log.path.includes(filter.path)) return false;
      if (filter.statusCode && log.statusCode !== filter.statusCode) return false;
      if (filter.minDuration && log.duration < filter.minDuration) return false;
      return true;
    });
  }
}

/**
 * Simple Router
 */
class Router {
  constructor() {
    this.routes = new Map();
    this.middleware = [];
    this.notFoundHandler = null;
  }

  use(fn) {
    this.middleware.push(fn);
  }

  addRoute(method, path, handler) {
    const key = `${method.toUpperCase()}:${path}`;
    this.routes.set(key, handler);
  }

  get(path, handler) {
    this.addRoute('GET', path, handler);
  }

  post(path, handler) {
    this.addRoute('POST', path, handler);
  }

  put(path, handler) {
    this.addRoute('PUT', path, handler);
  }

  delete(path, handler) {
    this.addRoute('DELETE', path, handler);
  }

  setNotFound(handler) {
    this.notFoundHandler = handler;
  }

  async executeMiddleware(req, res, index = 0) {
    if (index >= this.middleware.length) return true;
    
    let nextCalled = false;
    const next = () => { nextCalled = true; };
    
    await this.middleware[index](req, res, next);
    
    if (nextCalled) {
      return this.executeMiddleware(req, res, index + 1);
    }
    return false;
  }

  async handle(req, res) {
    const shouldContinue = await this.executeMiddleware(req, res);
    if (!shouldContinue) return;

    const key = `${req.method}:${req.pathname}`;
    const handler = this.routes.get(key);
    
    if (handler) {
      await handler(req, res);
    } else if (this.notFoundHandler) {
      this.notFoundHandler(req, res);
    } else {
      res.statusCode = 404;
      res.end('Not Found');
    }
  }
}

/**
 * JSON Response Helper
 */
const jsonResponse = (res, data, statusCode = 200) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
};

/**
 * Parse Request Body
 */
const parseBody = (req) => {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
};

/**
 * Authentication Middleware
 */
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    jsonResponse(res, { error: 'Unauthorized' }, 401);
    return;
  }
  
  const token = authHeader.substring(7);
  if (!validateToken(token)) {
    jsonResponse(res, { error: 'Invalid token' }, 403);
    return;
  }
  
  req.user = decodeToken(token);
  next();
};

/**
 * Token Validation
 */
const validateToken = (token) => {
  // Simple validation - in real app would verify JWT
  return token && token.length > 10;
};

const decodeToken = (token) => {
  // Mock decode - in real app would decode JWT
  return { id: 'user123', role: 'admin' };
};

/**
 * CORS Middleware
 */
const corsMiddleware = (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  next();
};

/**
 * Request Timing Middleware
 */
const timingMiddleware = (req, res, next) => {
  req.startTime = Date.now();
  
  const originalEnd = res.end;
  res.end = function(...args) {
    req.duration = Date.now() - req.startTime;
    originalEnd.apply(res, args);
  };
  
  next();
};

/**
 * User Session Manager
 */
class SessionManager {
  constructor(sessionTimeout = 3600000) {
    this.sessions = new Map();
    this.sessionTimeout = sessionTimeout;
  }

  createSession(userId, data = {}) {
    const sessionId = this.generateSessionId();
    const session = {
      userId,
      data,
      createdAt: Date.now(),
      lastAccess: Date.now()
    };
    this.sessions.set(sessionId, session);
    return sessionId;
  }

  generateSessionId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    
    if (Date.now() - session.lastAccess > this.sessionTimeout) {
      this.sessions.delete(sessionId);
      return null;
    }
    
    session.lastAccess = Date.now();
    return session;
  }

  destroySession(sessionId) {
    return this.sessions.delete(sessionId);
  }

  cleanupExpiredSessions() {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.lastAccess > this.sessionTimeout) {
        this.sessions.delete(id);
      }
    }
  }

  getActiveSessions() {
    return this.sessions.size;
  }
}

/**
 * Data Validator
 */
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  // At least 8 chars, 1 uppercase, 1 lowercase, 1 number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  return passwordRegex.test(password);
};

const validateUsername = (username) => {
  // 3-20 chars, alphanumeric and underscore only
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
};

const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};

/**
 * Database Connection Pool Simulator
 */
class ConnectionPool {
  constructor(maxConnections = 10) {
    this.maxConnections = maxConnections;
    this.available = [];
    this.inUse = new Set();
    this.waiting = [];
    
    // Initialize pool
    for (let i = 0; i < maxConnections; i++) {
      this.available.push(this.createConnection(i));
    }
  }

  createConnection(id) {
    return {
      id,
      createdAt: Date.now(),
      query: async (sql) => {
        // Simulate query execution
        await new Promise(r => setTimeout(r, Math.random() * 100));
        return { rows: [], affected: 0 };
      }
    };
  }

  async acquire() {
    if (this.available.length > 0) {
      const conn = this.available.pop();
      this.inUse.add(conn);
      return conn;
    }
    
    // Wait for available connection
    return new Promise((resolve) => {
      this.waiting.push(resolve);
    });
  }

  release(conn) {
    this.inUse.delete(conn);
    
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift();
      this.inUse.add(conn);
      resolve(conn);
    } else {
      this.available.push(conn);
    }
  }

  getPoolStatus() {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      waiting: this.waiting.length,
      total: this.maxConnections
    };
  }
}

/**
 * Event Bus for Pub/Sub
 */
class EventBus {
  constructor() {
    this.subscribers = new Map();
    this.eventHistory = [];
    this.maxHistory = 100;
  }

  subscribe(event, callback) {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, []);
    }
    this.subscribers.get(event).push(callback);
    
    return () => this.unsubscribe(event, callback);
  }

  unsubscribe(event, callback) {
    if (!this.subscribers.has(event)) return;
    const callbacks = this.subscribers.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) callbacks.splice(index, 1);
  }

  publish(event, data) {
    this.eventHistory.push({ event, data, timestamp: Date.now() });
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.shift();
    }

    if (!this.subscribers.has(event)) return;
    
    this.subscribers.get(event).forEach(callback => {
      try {
        callback(data);
      } catch (e) {
        console.error(`Error in event handler for ${event}:`, e);
      }
    });
  }

  getEventHistory(event = null) {
    if (event) {
      return this.eventHistory.filter(e => e.event === event);
    }
    return this.eventHistory;
  }
}

/**
 * Retry with Exponential Backoff
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Circuit Breaker Pattern
 */
class CircuitBreaker {
  constructor(threshold = 5, resetTimeout = 30000) {
    this.threshold = threshold;
    this.resetTimeout = resetTimeout;
    this.failures = 0;
    this.state = 'CLOSED';
    this.lastFailure = null;
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailure > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      threshold: this.threshold
    };
  }
}

/**
 * Health Check Endpoint Handler
 */
const healthCheck = async (cache, pool, sessions) => {
  const status = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cache: cache.getStats(),
    database: pool.getPoolStatus(),
    sessions: sessions.getActiveSessions()
  };
  
  // Check critical components
  if (pool.getPoolStatus().available === 0 && pool.getPoolStatus().waiting > 5) {
    status.status = 'degraded';
    status.warnings = ['Database pool exhausted'];
  }
  
  return status;
};

/**
 * Graceful Shutdown Handler
 */
const setupGracefulShutdown = (server, pool, sessions) => {
  const shutdown = async (signal) => {
    console.log(`Received ${signal}, starting graceful shutdown...`);
    
    server.close(() => {
      console.log('HTTP server closed');
    });
    
    // Cleanup sessions
    sessions.cleanupExpiredSessions();
    
    // Wait for active connections
    const poolStatus = pool.getPoolStatus();
    if (poolStatus.inUse > 0) {
      console.log(`Waiting for ${poolStatus.inUse} connections to finish...`);
      await new Promise(r => setTimeout(r, 5000));
    }
    
    console.log('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

/**
 * Main Server Setup
 */
async function startServer(port = 3000) {
  const cache = new CacheManager();
  const rateLimiter = new RateLimiter();
  const logger = new RequestLogger();
  const router = new Router();
  const sessions = new SessionManager();
  const pool = new ConnectionPool();
  const eventBus = new EventBus();

  // Setup middleware
  router.use(corsMiddleware);
  router.use(timingMiddleware);

  // Routes
  router.get('/health', async (req, res) => {
    const status = await healthCheck(cache, pool, sessions);
    jsonResponse(res, status);
  });

  router.get('/api/cache/stats', (req, res) => {
    jsonResponse(res, cache.getStats());
  });

  router.post('/api/login', async (req, res) => {
    const body = await parseBody(req);
    if (!validateEmail(body.email) || !validatePassword(body.password)) {
      jsonResponse(res, { error: 'Invalid credentials' }, 400);
      return;
    }
    const sessionId = sessions.createSession(body.email);
    jsonResponse(res, { sessionId });
  });

  router.get('/api/logs', (req, res) => {
    const logs = logger.getRecentLogs(20);
    jsonResponse(res, { logs, errorRate: logger.getErrorRate() });
  });

  router.setNotFound((req, res) => {
    jsonResponse(res, { error: 'Endpoint not found' }, 404);
  });

  // Create server
  const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    req.pathname = parsedUrl.pathname;
    req.query = parsedUrl.query;
    req.clientIp = req.socket.remoteAddress;

    // Rate limiting
    const rateCheck = rateLimiter.tryConsume(req.clientIp);
    if (!rateCheck.allowed) {
      jsonResponse(res, { error: 'Rate limit exceeded', retryAfter: rateCheck.retryAfter }, 429);
      return;
    }

    try {
      await router.handle(req, res);
    } catch (error) {
      console.error('Request error:', error);
      jsonResponse(res, { error: 'Internal server error' }, 500);
    }

    // Log request
    logger.log({
      method: req.method,
      path: req.pathname,
      statusCode: res.statusCode,
      duration: req.duration,
      clientIp: req.clientIp
    });
  });

  setupGracefulShutdown(server, pool, sessions);

  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
    eventBus.publish('server:started', { port, timestamp: Date.now() });
  });

  return server;
}

// Export for testing
module.exports = {
  CacheManager,
  RateLimiter,
  RequestLogger,
  Router,
  SessionManager,
  ConnectionPool,
  EventBus,
  CircuitBreaker,
  validateEmail,
  validatePassword,
  validateUsername,
  sanitizeInput,
  retryWithBackoff,
  startServer
};
