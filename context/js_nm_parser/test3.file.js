/**
 * Test File 3 - API Gateway & Microservices Patterns
 * Different coding patterns for unbiased testing
 */

// ============== Service Discovery ==============
class ServiceRegistry {
  constructor() {
    this.services = new Map();
    this.healthChecks = new Map();
    this.lastHeartbeat = new Map();
  }

  // Register a new service with its endpoint
  registerService(serviceName, endpoint, metadata = {}) {
    const serviceId = `${serviceName}-${Date.now()}`;
    this.services.set(serviceId, {
      name: serviceName,
      endpoint,
      metadata,
      registeredAt: new Date(),
      status: 'healthy'
    });
    this.lastHeartbeat.set(serviceId, Date.now());
    console.log(`Service registered: ${serviceName} at ${endpoint}`);
    return serviceId;
  }

  // Deregister a service by its ID
  deregisterService(serviceId) {
    if (this.services.has(serviceId)) {
      const service = this.services.get(serviceId);
      this.services.delete(serviceId);
      this.healthChecks.delete(serviceId);
      this.lastHeartbeat.delete(serviceId);
      console.log(`Service deregistered: ${service.name}`);
      return true;
    }
    return false;
  }

  // Find all instances of a service by name
  discoverService(serviceName) {
    const instances = [];
    for (const [id, service] of this.services) {
      if (service.name === serviceName && service.status === 'healthy') {
        instances.push({ id, ...service });
      }
    }
    return instances;
  }

  // Update heartbeat timestamp for a service
  heartbeat(serviceId) {
    if (this.services.has(serviceId)) {
      this.lastHeartbeat.set(serviceId, Date.now());
      return true;
    }
    return false;
  }

  // Check for stale services and mark them unhealthy
  checkStaleServices(timeoutMs = 30000) {
    const now = Date.now();
    for (const [serviceId, lastBeat] of this.lastHeartbeat) {
      if (now - lastBeat > timeoutMs) {
        const service = this.services.get(serviceId);
        if (service) {
          service.status = 'unhealthy';
          console.log(`Service marked unhealthy: ${service.name}`);
        }
      }
    }
  }
}

// ============== Load Balancer ==============
class LoadBalancer {
  constructor(strategy = 'round-robin') {
    this.strategy = strategy;
    this.currentIndex = 0;
    this.weights = new Map();
    this.activeConnections = new Map();
  }

  // Select next server using round-robin
  roundRobinSelect(servers) {
    if (servers.length === 0) return null;
    const server = servers[this.currentIndex % servers.length];
    this.currentIndex++;
    return server;
  }

  // Select server with least connections
  leastConnectionsSelect(servers) {
    if (servers.length === 0) return null;
    let minConnections = Infinity;
    let selectedServer = null;
    
    for (const server of servers) {
      const connections = this.activeConnections.get(server.id) || 0;
      if (connections < minConnections) {
        minConnections = connections;
        selectedServer = server;
      }
    }
    return selectedServer;
  }

  // Select server based on weighted distribution
  weightedSelect(servers) {
    if (servers.length === 0) return null;
    const totalWeight = servers.reduce((sum, s) => 
      sum + (this.weights.get(s.id) || 1), 0);
    let random = Math.random() * totalWeight;
    
    for (const server of servers) {
      const weight = this.weights.get(server.id) || 1;
      random -= weight;
      if (random <= 0) return server;
    }
    return servers[0];
  }

  // Main selection method
  selectServer(servers) {
    switch (this.strategy) {
      case 'round-robin':
        return this.roundRobinSelect(servers);
      case 'least-connections':
        return this.leastConnectionsSelect(servers);
      case 'weighted':
        return this.weightedSelect(servers);
      default:
        return this.roundRobinSelect(servers);
    }
  }

  // Track connection start
  connectionStart(serverId) {
    const current = this.activeConnections.get(serverId) || 0;
    this.activeConnections.set(serverId, current + 1);
  }

  // Track connection end
  connectionEnd(serverId) {
    const current = this.activeConnections.get(serverId) || 0;
    this.activeConnections.set(serverId, Math.max(0, current - 1));
  }
}

// ============== API Gateway ==============
class APIGateway {
  constructor(registry, loadBalancer) {
    this.registry = registry;
    this.loadBalancer = loadBalancer;
    this.rateLimits = new Map();
    this.apiKeys = new Map();
    this.requestCount = 0;
  }

  // Validate API key
  validateApiKey(apiKey) {
    if (!apiKey) return { valid: false, reason: 'Missing API key' };
    const keyData = this.apiKeys.get(apiKey);
    if (!keyData) return { valid: false, reason: 'Invalid API key' };
    if (keyData.expiresAt && keyData.expiresAt < Date.now()) {
      return { valid: false, reason: 'API key expired' };
    }
    return { valid: true, permissions: keyData.permissions };
  }

  // Register a new API key
  registerApiKey(apiKey, permissions = [], expiresIn = null) {
    this.apiKeys.set(apiKey, {
      permissions,
      createdAt: Date.now(),
      expiresAt: expiresIn ? Date.now() + expiresIn : null
    });
  }

  // Check rate limit for a client
  checkRateLimit(clientId, limit = 100, windowMs = 60000) {
    const now = Date.now();
    const clientData = this.rateLimits.get(clientId) || { count: 0, windowStart: now };
    
    if (now - clientData.windowStart > windowMs) {
      clientData.count = 0;
      clientData.windowStart = now;
    }
    
    if (clientData.count >= limit) {
      return { allowed: false, retryAfter: clientData.windowStart + windowMs - now };
    }
    
    clientData.count++;
    this.rateLimits.set(clientId, clientData);
    return { allowed: true, remaining: limit - clientData.count };
  }

  // Route request to appropriate service
  async routeRequest(serviceName, request) {
    this.requestCount++;
    
    // Discover available instances
    const instances = this.registry.discoverService(serviceName);
    if (instances.length === 0) {
      return { error: 'Service unavailable', status: 503 };
    }
    
    // Select instance using load balancer
    const selected = this.loadBalancer.selectServer(instances);
    this.loadBalancer.connectionStart(selected.id);
    
    try {
      // Forward request to selected instance
      const response = await this.forwardRequest(selected.endpoint, request);
      return response;
    } finally {
      this.loadBalancer.connectionEnd(selected.id);
    }
  }

  // Forward request to backend service
  async forwardRequest(endpoint, request) {
    // Simulate HTTP request forwarding
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({ 
          status: 200, 
          data: { forwarded: true, endpoint },
          timestamp: Date.now()
        });
      }, Math.random() * 100);
    });
  }
}

// ============== Message Queue ==============
class MessageQueue {
  constructor(maxSize = 1000) {
    this.queues = new Map();
    this.maxSize = maxSize;
    this.subscribers = new Map();
    this.deadLetterQueue = [];
  }

  // Create a new queue
  createQueue(queueName, options = {}) {
    if (this.queues.has(queueName)) {
      return { success: false, reason: 'Queue already exists' };
    }
    this.queues.set(queueName, {
      messages: [],
      options: { retryLimit: 3, ...options },
      createdAt: Date.now()
    });
    this.subscribers.set(queueName, []);
    return { success: true };
  }

  // Publish message to queue
  publishMessage(queueName, message, priority = 0) {
    const queue = this.queues.get(queueName);
    if (!queue) return { success: false, reason: 'Queue not found' };
    
    if (queue.messages.length >= this.maxSize) {
      return { success: false, reason: 'Queue full' };
    }
    
    const msgObj = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      payload: message,
      priority,
      attempts: 0,
      publishedAt: Date.now()
    };
    
    // Insert by priority (higher priority first)
    const insertIdx = queue.messages.findIndex(m => m.priority < priority);
    if (insertIdx === -1) {
      queue.messages.push(msgObj);
    } else {
      queue.messages.splice(insertIdx, 0, msgObj);
    }
    
    // Notify subscribers
    this.notifySubscribers(queueName, msgObj);
    return { success: true, messageId: msgObj.id };
  }

  // Consume message from queue
  consumeMessage(queueName) {
    const queue = this.queues.get(queueName);
    if (!queue || queue.messages.length === 0) {
      return null;
    }
    
    const message = queue.messages.shift();
    message.attempts++;
    return message;
  }

  // Acknowledge message processing
  acknowledgeMessage(queueName, messageId) {
    // Message already removed during consume
    console.log(`Message acknowledged: ${messageId}`);
    return true;
  }

  // Move failed message to dead letter queue
  moveToDeadLetter(message, reason) {
    this.deadLetterQueue.push({
      ...message,
      failedAt: Date.now(),
      failureReason: reason
    });
    console.log(`Message moved to DLQ: ${message.id}`);
  }

  // Subscribe to queue notifications
  subscribe(queueName, callback) {
    const subs = this.subscribers.get(queueName);
    if (!subs) return false;
    subs.push(callback);
    return true;
  }

  // Notify all subscribers
  notifySubscribers(queueName, message) {
    const subs = this.subscribers.get(queueName) || [];
    subs.forEach(callback => {
      try {
        callback(message);
      } catch (err) {
        console.error('Subscriber error:', err);
      }
    });
  }
}

// ============== Distributed Lock ==============
class DistributedLock {
  constructor() {
    this.locks = new Map();
    this.waitingQueue = new Map();
  }

  // Acquire a lock with timeout
  async acquireLock(resourceId, ownerId, timeoutMs = 5000) {
    const existingLock = this.locks.get(resourceId);
    
    if (existingLock) {
      // Check if lock expired
      if (Date.now() > existingLock.expiresAt) {
        this.locks.delete(resourceId);
      } else if (existingLock.ownerId !== ownerId) {
        // Wait for lock release
        return this.waitForLock(resourceId, ownerId, timeoutMs);
      }
    }
    
    // Acquire the lock
    this.locks.set(resourceId, {
      ownerId,
      acquiredAt: Date.now(),
      expiresAt: Date.now() + timeoutMs
    });
    
    return { acquired: true, resourceId };
  }

  // Wait for lock to be released
  waitForLock(resourceId, ownerId, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Lock acquisition timeout'));
      }, timeoutMs);
      
      const waiting = this.waitingQueue.get(resourceId) || [];
      waiting.push({ ownerId, resolve, reject, timeout });
      this.waitingQueue.set(resourceId, waiting);
    });
  }

  // Release a lock
  releaseLock(resourceId, ownerId) {
    const lock = this.locks.get(resourceId);
    if (!lock || lock.ownerId !== ownerId) {
      return { released: false, reason: 'Not lock owner' };
    }
    
    this.locks.delete(resourceId);
    
    // Process waiting queue
    const waiting = this.waitingQueue.get(resourceId) || [];
    if (waiting.length > 0) {
      const next = waiting.shift();
      clearTimeout(next.timeout);
      this.locks.set(resourceId, {
        ownerId: next.ownerId,
        acquiredAt: Date.now(),
        expiresAt: Date.now() + 5000
      });
      next.resolve({ acquired: true, resourceId });
      this.waitingQueue.set(resourceId, waiting);
    }
    
    return { released: true };
  }

  // Extend lock duration
  extendLock(resourceId, ownerId, extensionMs = 5000) {
    const lock = this.locks.get(resourceId);
    if (!lock || lock.ownerId !== ownerId) {
      return { extended: false, reason: 'Not lock owner' };
    }
    
    lock.expiresAt = Date.now() + extensionMs;
    return { extended: true, newExpiry: lock.expiresAt };
  }
}

// ============== Health Monitor ==============
class HealthMonitor {
  constructor(checkInterval = 10000) {
    this.checks = new Map();
    this.results = new Map();
    this.checkInterval = checkInterval;
    this.isRunning = false;
  }

  // Register a health check
  registerCheck(name, checkFn, options = {}) {
    this.checks.set(name, {
      fn: checkFn,
      timeout: options.timeout || 5000,
      critical: options.critical || false
    });
  }

  // Run a single health check
  async runCheck(name) {
    const check = this.checks.get(name);
    if (!check) return null;
    
    const startTime = Date.now();
    try {
      const result = await Promise.race([
        check.fn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), check.timeout)
        )
      ]);
      
      const status = {
        healthy: true,
        latency: Date.now() - startTime,
        lastCheck: Date.now(),
        result
      };
      this.results.set(name, status);
      return status;
    } catch (error) {
      const status = {
        healthy: false,
        latency: Date.now() - startTime,
        lastCheck: Date.now(),
        error: error.message
      };
      this.results.set(name, status);
      return status;
    }
  }

  // Run all health checks
  async runAllChecks() {
    const results = {};
    for (const name of this.checks.keys()) {
      results[name] = await this.runCheck(name);
    }
    return results;
  }

  // Get overall system health
  getOverallHealth() {
    let healthy = true;
    let criticalFailure = false;
    
    for (const [name, check] of this.checks) {
      const result = this.results.get(name);
      if (!result || !result.healthy) {
        healthy = false;
        if (check.critical) criticalFailure = true;
      }
    }
    
    return {
      status: criticalFailure ? 'critical' : (healthy ? 'healthy' : 'degraded'),
      checks: Object.fromEntries(this.results),
      timestamp: Date.now()
    };
  }

  // Start periodic health checks
  startMonitoring() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    this.intervalId = setInterval(() => {
      this.runAllChecks();
    }, this.checkInterval);
  }

  // Stop health monitoring
  stopMonitoring() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.isRunning = false;
    }
  }
}

// ============== Request Retry Handler ==============
class RetryHandler {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 30000;
    this.backoffMultiplier = options.backoffMultiplier || 2;
  }

  // Calculate delay with exponential backoff and jitter
  calculateDelay(attempt) {
    const exponentialDelay = this.baseDelay * Math.pow(this.backoffMultiplier, attempt);
    const cappedDelay = Math.min(exponentialDelay, this.maxDelay);
    // Add jitter (±25%)
    const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);
    return Math.round(cappedDelay + jitter);
  }

  // Execute with retry logic
  async executeWithRetry(fn, context = {}) {
    let lastError;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt === this.maxRetries) break;
        if (!this.shouldRetry(error)) break;
        
        const delay = this.calculateDelay(attempt);
        console.log(`Retry ${attempt + 1}/${this.maxRetries} after ${delay}ms`);
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  // Determine if error is retryable
  shouldRetry(error) {
    const retryableCodes = [408, 429, 500, 502, 503, 504];
    if (error.statusCode && retryableCodes.includes(error.statusCode)) {
      return true;
    }
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return true;
    }
    return false;
  }

  // Sleep helper
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============== Configuration Store ==============
class ConfigStore {
  constructor() {
    this.config = new Map();
    this.watchers = new Map();
    this.versions = new Map();
  }

  // Set configuration value
  setValue(key, value, metadata = {}) {
    const version = (this.versions.get(key) || 0) + 1;
    this.config.set(key, {
      value,
      metadata,
      updatedAt: Date.now(),
      version
    });
    this.versions.set(key, version);
    
    // Notify watchers
    this.notifyWatchers(key, value);
    return { success: true, version };
  }

  // Get configuration value
  getValue(key, defaultValue = null) {
    const entry = this.config.get(key);
    return entry ? entry.value : defaultValue;
  }

  // Watch for configuration changes
  watch(key, callback) {
    const watchers = this.watchers.get(key) || [];
    watchers.push(callback);
    this.watchers.set(key, watchers);
    
    return () => {
      const idx = watchers.indexOf(callback);
      if (idx > -1) watchers.splice(idx, 1);
    };
  }

  // Notify watchers of changes
  notifyWatchers(key, value) {
    const watchers = this.watchers.get(key) || [];
    watchers.forEach(cb => {
      try { cb(value, key); }
      catch (e) { console.error('Watcher error:', e); }
    });
  }

  // Get all configuration as object
  getAllConfig() {
    const result = {};
    for (const [key, entry] of this.config) {
      result[key] = entry.value;
    }
    return result;
  }

  // Load configuration from object
  loadFromObject(obj) {
    for (const [key, value] of Object.entries(obj)) {
      this.setValue(key, value);
    }
  }
}

// ============== Export Classes ==============
module.exports = {
  ServiceRegistry,
  LoadBalancer,
  APIGateway,
  MessageQueue,
  DistributedLock,
  HealthMonitor,
  RetryHandler,
  ConfigStore
};
