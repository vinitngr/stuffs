/**
 * E-Commerce API - Express.js Backend
 * A realistic backend with various patterns and some bugs
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const multer = require('multer');
const app = express();

app.use(express.json());

// ============== DATABASE SIMULATION ==============
const db = {
  users: new Map(),
  products: new Map(),
  orders: new Map(),
  sessions: new Map(),
  carts: new Map()
};

let productIdCounter = 1;
let orderIdCounter = 1000;

// ============== CONFIG ==============
const JWT_SECRET = 'super-secret-key-123'; // BUG: Hardcoded secret in code
const SALT_ROUNDS = 10;

// ============== MIDDLEWARE ==============

// Request logger middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  next();
};

// Auth middleware - validates JWT token
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Admin check middleware
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Rate limiter - BUG: Memory leak, never cleans up old entries
const rateLimitStore = {};
const rateLimit = (limit = 100, windowMs = 60000) => {
  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    
    if (!rateLimitStore[ip]) {
      rateLimitStore[ip] = { count: 1, startTime: now };
    } else {
      // BUG: Should reset count when window expires, but doesn't properly
      if (now - rateLimitStore[ip].startTime > windowMs) {
        rateLimitStore[ip].count = 1;
        // Missing: rateLimitStore[ip].startTime = now;
      } else {
        rateLimitStore[ip].count++;
      }
    }
    
    if (rateLimitStore[ip].count > limit) {
      return res.status(429).json({ error: 'Too many requests' });
    }
    next();
  };
};

app.use(requestLogger);

// ============== AUTH ROUTES ==============

// User registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // BUG: No email format validation
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password too short' });
    }
    
    // Check if user exists
    if (db.users.has(email)) {
      return res.status(409).json({ error: 'User already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    
    // Create user
    const user = {
      email,
      password: hashedPassword,
      name,
      role: 'user',
      createdAt: new Date(),
      verified: false
    };
    
    db.users.set(email, user);
    
    // BUG: Returning password hash in response
    res.status(201).json({ message: 'User created', user });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// User login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = db.users.get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate token - BUG: Token never expires
    const token = jwt.sign(
      { email: user.email, role: user.role },
      JWT_SECRET
      // Missing: { expiresIn: '24h' }
    );
    
    res.json({ token, user: { email: user.email, name: user.name } });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Password reset request
app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body;
  const user = db.users.get(email);
  
  // BUG: Reveals if email exists in database (security issue)
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Generate reset token
  const resetToken = Math.random().toString(36).substring(2, 15);
  user.resetToken = resetToken;
  user.resetTokenExpiry = Date.now() + 3600000; // 1 hour
  
  // In real app, would send email here
  res.json({ message: 'Reset email sent', debug_token: resetToken }); // BUG: Exposing token
});

// ============== PRODUCT ROUTES ==============

// Get all products with pagination
app.get('/api/products', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const category = req.query.category;
  
  let products = Array.from(db.products.values());
  
  // Filter by category
  if (category) {
    products = products.filter(p => p.category === category);
  }
  
  // BUG: No input validation on page/limit - can cause performance issues
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  
  const paginatedProducts = products.slice(startIndex, endIndex);
  
  res.json({
    products: paginatedProducts,
    total: products.length,
    page,
    totalPages: Math.ceil(products.length / limit)
  });
});

// Get single product
app.get('/api/products/:id', (req, res) => {
  const productId = parseInt(req.params.id);
  const product = db.products.get(productId);
  
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  
  res.json(product);
});

// Create product (admin only)
app.post('/api/products', authMiddleware, adminOnly, (req, res) => {
  const { name, price, description, category, stock } = req.body;
  
  // Validation
  if (!name || !price) {
    return res.status(400).json({ error: 'Name and price required' });
  }
  
  // BUG: No price validation - can be negative
  const product = {
    id: productIdCounter++,
    name,
    price,
    description: description || '',
    category: category || 'general',
    stock: stock || 0,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  db.products.set(product.id, product);
  res.status(201).json(product);
});

// Update product stock
app.patch('/api/products/:id/stock', authMiddleware, adminOnly, (req, res) => {
  const productId = parseInt(req.params.id);
  const { quantity } = req.body;
  
  const product = db.products.get(productId);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  
  // BUG: Race condition - not atomic, can go negative
  product.stock += quantity;
  product.updatedAt = new Date();
  
  res.json(product);
});

// Delete product
app.delete('/api/products/:id', authMiddleware, adminOnly, (req, res) => {
  const productId = parseInt(req.params.id);
  
  if (!db.products.has(productId)) {
    return res.status(404).json({ error: 'Product not found' });
  }
  
  db.products.delete(productId);
  res.status(204).send();
});

// ============== CART ROUTES ==============

// Get user cart
app.get('/api/cart', authMiddleware, (req, res) => {
  const userEmail = req.user.email;
  const cart = db.carts.get(userEmail) || { items: [], total: 0 };
  res.json(cart);
});

// Add item to cart
app.post('/api/cart/items', authMiddleware, (req, res) => {
  const userEmail = req.user.email;
  const { productId, quantity } = req.body;
  
  const product = db.products.get(productId);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  
  // BUG: Not checking if enough stock available
  let cart = db.carts.get(userEmail);
  if (!cart) {
    cart = { items: [], total: 0 };
  }
  
  // Check if item already in cart
  const existingItem = cart.items.find(item => item.productId === productId);
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cart.items.push({
      productId,
      name: product.name,
      price: product.price,
      quantity
    });
  }
  
  // Recalculate total - BUG: Floating point precision issues
  cart.total = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  db.carts.set(userEmail, cart);
  res.json(cart);
});

// Remove item from cart
app.delete('/api/cart/items/:productId', authMiddleware, (req, res) => {
  const userEmail = req.user.email;
  const productId = parseInt(req.params.productId);
  
  const cart = db.carts.get(userEmail);
  if (!cart) {
    return res.status(404).json({ error: 'Cart not found' });
  }
  
  cart.items = cart.items.filter(item => item.productId !== productId);
  cart.total = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  db.carts.set(userEmail, cart);
  res.json(cart);
});

// ============== ORDER ROUTES ==============

// Create order from cart
app.post('/api/orders', authMiddleware, async (req, res) => {
  const userEmail = req.user.email;
  const { shippingAddress, paymentMethod } = req.body;
  
  const cart = db.carts.get(userEmail);
  if (!cart || cart.items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }
  
  // Validate stock for all items
  for (const item of cart.items) {
    const product = db.products.get(item.productId);
    if (!product || product.stock < item.quantity) {
      return res.status(400).json({ 
        error: `Insufficient stock for ${item.name}` 
      });
    }
  }
  
  // Deduct stock - BUG: Not transactional, partial failure possible
  for (const item of cart.items) {
    const product = db.products.get(item.productId);
    product.stock -= item.quantity;
  }
  
  // Create order
  const order = {
    id: orderIdCounter++,
    userEmail,
    items: [...cart.items],
    total: cart.total,
    shippingAddress,
    paymentMethod,
    status: 'pending',
    createdAt: new Date()
  };
  
  db.orders.set(order.id, order);
  
  // Clear cart
  db.carts.delete(userEmail);
  
  res.status(201).json(order);
});

// Get user orders
app.get('/api/orders', authMiddleware, (req, res) => {
  const userEmail = req.user.email;
  const orders = Array.from(db.orders.values())
    .filter(order => order.userEmail === userEmail)
    .sort((a, b) => b.createdAt - a.createdAt);
  
  res.json(orders);
});

// Get single order
app.get('/api/orders/:id', authMiddleware, (req, res) => {
  const orderId = parseInt(req.params.id);
  const order = db.orders.get(orderId);
  
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  
  // BUG: No check if order belongs to requesting user
  res.json(order);
});

// Update order status (admin)
app.patch('/api/orders/:id/status', authMiddleware, adminOnly, (req, res) => {
  const orderId = parseInt(req.params.id);
  const { status } = req.body;
  
  const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  
  const order = db.orders.get(orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  
  order.status = status;
  order.updatedAt = new Date();
  
  res.json(order);
});

// ============== SEARCH ROUTE ==============

// Search products - BUG: SQL injection vulnerable if using real DB
app.get('/api/search', (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Search query required' });
  }
  
  // BUG: Case sensitive search, inefficient
  const results = Array.from(db.products.values()).filter(product => 
    product.name.includes(query) || 
    product.description.includes(query)
  );
  
  res.json(results);
});

// ============== FILE UPLOAD ==============

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // BUG: No file type validation, can upload any file
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// Upload product image
app.post('/api/products/:id/image', authMiddleware, adminOnly, upload.single('image'), (req, res) => {
  const productId = parseInt(req.params.id);
  const product = db.products.get(productId);
  
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  // BUG: Old image file not deleted, causes storage bloat
  product.imageUrl = `/uploads/${req.file.filename}`;
  product.updatedAt = new Date();
  
  res.json(product);
});

// ============== ADMIN ROUTES ==============

// Get all users (admin only)
app.get('/api/admin/users', authMiddleware, adminOnly, (req, res) => {
  const users = Array.from(db.users.values()).map(user => ({
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    verified: user.verified
    // Password intentionally excluded
  }));
  
  res.json(users);
});

// Get dashboard stats
app.get('/api/admin/stats', authMiddleware, adminOnly, (req, res) => {
  const totalUsers = db.users.size;
  const totalProducts = db.products.size;
  const totalOrders = db.orders.size;
  
  const orders = Array.from(db.orders.values());
  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
  
  // BUG: Calculates on every request, should be cached
  const ordersByStatus = orders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {});
  
  res.json({
    totalUsers,
    totalProducts,
    totalOrders,
    totalRevenue,
    ordersByStatus
  });
});

// ============== HEALTH CHECK ==============

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// ============== ERROR HANDLER ==============

// Global error handler - BUG: Exposes stack trace in production
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Internal server error',
    stack: err.stack // Should not expose in production
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ============== START SERVER ==============

const PORT = process.env.PORT || 3000;

// BUG: Server listens on all interfaces by default
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
