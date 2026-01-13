/**
 * Sample TypeScript Test File
 * Contains various code patterns for testing the parser
 */

import express, { Request, Response } from 'express';
import { UserService, AuthService } from './services';
import * as utils from '../utils';
import axios from 'axios';

const fs = require('fs');
const { promisify } = require('util');

// Type definitions
interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

type UserRole = 'admin' | 'user' | 'guest';

type ApiResponse<T> = {
  success: boolean;
  data: T;
  error?: string;
};

/**
 * @class UserController
 * Handles all user-related HTTP endpoints
 */
class UserController {
  private userService: UserService;
  private authService: AuthService;

  constructor(userService: UserService, authService: AuthService) {
    this.userService = userService;
    this.authService = authService;
  }

  /**
   * Get user by ID
   * @param {Request} req - Express request
   * @param {Response} res - Express response
   * @returns {Promise<void>}
   */
  async getUser(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const user = await this.userService.findById(id);
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    res.json({ success: true, data: user });
  }

  /**
   * Create new user
   * @param {Request} req - Express request with user data
   * @param {Response} res - Express response
   */
  async createUser(req: Request, res: Response) {
    const { name, email, role } = req.body;
    
    if (!this.validateEmail(email)) {
      res.status(400).json({ error: 'Invalid email' });
      return;
    }

    const user = await this.userService.create({ name, email, role });
    res.status(201).json({ success: true, data: user });
  }

  private validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  _internalMethod() {
    console.log('Internal processing');
  }
}

/**
 * Utility functions for data processing
 */
const DataUtils = {
  /**
   * Transform array to map
   */
  arrayToMap<T>(arr: T[], key: keyof T): Map<string, T> {
    const map = new Map();
    for (const item of arr) {
      map.set(String(item[key]), item);
    }
    return map;
  },

  /**
   * Deep clone object
   */
  deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  },
};

/**
 * Initialize database connection
 * @param {string} connectionString - Database connection URL
 * @returns {Promise<boolean>} Connection success status
 */
async function initializeDatabase(connectionString: string): Promise<boolean> {
  try {
    console.log('Connecting to database...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Database connected');
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

/**
 * Fetch data from external API
 */
const fetchExternalData = async (endpoint: string) => {
  const response = await axios.get(endpoint);
  return response.data;
};

// Arrow function with implicit return
const calculateTotal = (items: number[]) => items.reduce((a, b) => a + b, 0);

// Regular function
function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

// Self-invoking setup
(async () => {
  const connected = await initializeDatabase('mongodb://localhost:27017');
  if (connected) {
    console.log('Application ready');
  }
})();

// Event handlers
process.on('SIGTERM', () => {
  console.log('Shutting down gracefully');
  process.exit(0);
});

// Exports
export { UserController, DataUtils, initializeDatabase };
export default UserController;
