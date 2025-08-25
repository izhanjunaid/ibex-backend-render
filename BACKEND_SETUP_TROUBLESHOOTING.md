# Backend Setup Troubleshooting Guide

## 🚨 Common Issues & Solutions

### 1. "Invalid URL" Error

#### Problem
```
TypeError: Invalid URL
    at new URL (node:internal/url:818:25)
    at new SupabaseClient
    input: 'your_supabase_url/'
```

#### Root Cause
The Supabase URL environment variable is not properly configured or contains placeholder values.

#### Solution Steps

1. **Check Environment Variables**
   ```bash
   # Check if .env file exists
   ls -la .env
   
   # View current environment variables
   echo $SUPABASE_URL
   echo $SUPABASE_SERVICE_ROLE_KEY
   ```

2. **Create/Update .env File**
   ```bash
   # Create .env file if it doesn't exist
   touch .env
   
   # Add your Supabase credentials
   echo "SUPABASE_URL=https://your-project-id.supabase.co" >> .env
   echo "SUPABASE_SERVICE_ROLE_KEY=your-service-role-key" >> .env
   echo "JWT_SECRET=your-jwt-secret" >> .env
   ```

3. **Get Supabase Credentials**
   - Go to [Supabase Dashboard](https://supabase.com/dashboard)
   - Select your project
   - Go to Settings → API
   - Copy the URL and service role key

4. **Verify .env File Content**
   ```env
   # Supabase Configuration
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   
   # JWT Configuration
   JWT_SECRET=your-secret-key-here
   
   # Optional: Other configurations
   CLIENT_URL=http://localhost:3000
   PORT=3000
   ```

5. **Restart the Server**
   ```bash
   # Stop the current server (Ctrl+C)
   # Then restart
   node server.js
   ```

### 2. Missing Dependencies

#### Problem
```
Error: Cannot find module 'express'
```

#### Solution
```bash
# Install dependencies
npm install

# If package-lock.json is corrupted
rm package-lock.json
npm install
```

### 3. Database Connection Issues

#### Problem
```
❌ Supabase Connection Error: connection failed
```

#### Solution
1. **Check Supabase Project Status**
   - Verify project is active in Supabase dashboard
   - Check if project is paused (free tier limitation)

2. **Verify Network Access**
   ```bash
   # Test connection
   curl https://your-project-id.supabase.co/rest/v1/
   ```

3. **Check Service Role Key**
   - Ensure you're using the service role key, not the anon key
   - Service role key starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 4. Port Already in Use

#### Problem
```
Error: listen EADDRINUSE: address already in use :::3000
```

#### Solution
```bash
# Find process using the port
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=3001 node server.js
```

### 5. Permission Issues

#### Problem
```
Error: EACCES: permission denied
```

#### Solution
```bash
# Check file permissions
ls -la server.js

# Fix permissions if needed
chmod 644 server.js

# For npm install issues
sudo npm install
```

## 🔧 Environment Setup Checklist

### Required Environment Variables
```env
# Essential (Required)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-jwt-secret

# Optional but Recommended
CLIENT_URL=http://localhost:3000
PORT=3000
NODE_ENV=development

# File Storage (Optional)
R2_ACCOUNT_ID=your-r2_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=your_bucket_name

# Email (Optional)
GMAIL_USER=your_gmail_user
GMAIL_PASS=your_gmail_password
FROM_EMAIL=your_from_email
```

### Validation Script
Create a `validate-env.js` script to check your environment:

```javascript
// validate-env.js
require('dotenv').config();

const required = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET'
];

const missing = required.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error('❌ Missing required environment variables:');
  missing.forEach(key => console.error(`   - ${key}`));
  process.exit(1);
}

// Validate Supabase URL format
const supabaseUrl = process.env.SUPABASE_URL;
if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
  console.error('❌ Invalid SUPABASE_URL format. Should be: https://your-project-id.supabase.co');
  process.exit(1);
}

// Validate JWT Secret
if (process.env.JWT_SECRET.length < 10) {
  console.error('❌ JWT_SECRET should be at least 10 characters long');
  process.exit(1);
}

console.log('✅ Environment variables validated successfully!');
```

Run validation:
```bash
node validate-env.js
```

## 🚀 Quick Setup Guide

### 1. Clone and Setup
```bash
# Clone the repository
git clone <repository-url>
cd ibex-backend-render

# Install dependencies
npm install
```

### 2. Configure Environment
```bash
# Create .env file
cp .env.example .env  # if .env.example exists
# or create manually
touch .env

# Edit .env with your credentials
nano .env
```

### 3. Validate Setup
```bash
# Run validation script
node validate-env.js

# Test database connection
node -e "
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('users').select('count', { count: 'exact', head: true })
  .then(({ count, error }) => {
    if (error) {
      console.error('❌ Database connection failed:', error.message);
      process.exit(1);
    }
    console.log('✅ Database connected successfully!');
    console.log(`📊 Database contains ${count} users`);
  });
"
```

### 4. Start Server
```bash
# Development mode
npm run dev

# Production mode
node server.js
```

## 🔍 Debug Mode

Enable debug logging to get more detailed error information:

```bash
# Set debug environment variables
export DEBUG=true
export NODE_ENV=development

# Start server with debug logging
DEBUG=* node server.js
```

### Debug Output Examples
```
🔍 [HOMEWORK] GET /grade-section/:gradeSectionId - Fetching grade section homework
   🆔 Grade section ID: 123e4567-e89b-12d3-a456-426614174000
   👤 User: { id: 'user-id', role: 'student', email: 'student@school.com' }
   📅 Query params: { start_date: '2025-01-01', end_date: '2025-01-31' }
   🌐 Request origin: http://localhost:3000
   📱 User agent: Mozilla/5.0...
   🔑 Token present: true
```

## 📊 Health Check Endpoints

Add these endpoints to your server for monitoring:

```javascript
// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// Database health check
app.get('/health/db', async (req, res) => {
  try {
    const { count, error } = await supabase
      .from('users')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      return res.status(500).json({
        status: 'error',
        message: 'Database connection failed',
        error: error.message
      });
    }
    
    res.json({
      status: 'ok',
      message: 'Database connected',
      userCount: count
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Database health check failed',
      error: err.message
    });
  }
});
```

Test health endpoints:
```bash
# Basic health check
curl http://localhost:3000/health

# Database health check
curl http://localhost:3000/health/db
```

## 🆘 Getting Help

### 1. Check Logs
```bash
# View server logs
tail -f logs/app.log

# Search for specific errors
grep "ERROR" logs/app.log
grep "Invalid URL" logs/app.log
```

### 2. Common Error Patterns

#### Supabase URL Issues
- ✅ `https://abc123.supabase.co`
- ❌ `your_supabase_url/`
- ❌ `http://abc123.supabase.co`
- ❌ `https://abc123.supabase.com`

#### Service Role Key Issues
- ✅ Starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- ❌ Too short or doesn't start with `eyJ`
- ❌ Contains spaces or special characters

### 3. Support Resources
- [Supabase Documentation](https://supabase.com/docs)
- [Node.js Documentation](https://nodejs.org/docs)
- [Express.js Documentation](https://expressjs.com/)

### 4. Environment Validation Commands
```bash
# Check Node.js version
node --version

# Check npm version
npm --version

# Check if .env file exists
ls -la .env

# Validate environment variables
node validate-env.js

# Test Supabase connection
node -e "
require('dotenv').config();
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Not set');
"
```

This troubleshooting guide should help you resolve the "Invalid URL" error and other common backend setup issues. If you continue to have problems, check the logs for more specific error messages and ensure all environment variables are properly configured. 