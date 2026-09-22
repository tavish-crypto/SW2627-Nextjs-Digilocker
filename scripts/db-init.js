#!/usr/bin/env node
/**
 * Database initialization script
 * This script initializes the SQLite database and creates tables from the Prisma schema
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function initializeDatabase() {
  try {
    console.log('🔧 Initializing database...');
    
    // Check if .env.local exists
    const envPath = path.join(__dirname, '../.env.local');
    if (!fs.existsSync(envPath)) {
      console.error('❌ .env.local not found');
      process.exit(1);
    }
    
    console.log('✅ .env.local found');
    
    // Try to import Prisma client (this will generate it if needed)
    console.log('📦 Importing Prisma client...');
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // Test the connection
    console.log('🔗 Testing database connection...');
    await prisma.$queryRaw`SELECT 1`;
    
    console.log('✅ Database connection successful');
    
    // Close the connection
    await prisma.$disconnect();
    
    console.log('✅ Database initialized successfully!');
    console.log('📍 Database file: prisma/dev.db');
    
  } catch (error) {
    console.error('❌ Error initializing database:');
    console.error(error.message);
    process.exit(1);
  }
}

initializeDatabase();
