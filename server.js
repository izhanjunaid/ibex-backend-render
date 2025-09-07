const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const http = require('http');
const { createClient } = require('@supabase/supabase-js');
const Sentry = require('@sentry/node');
const jwt = require('jsonwebtoken'); // Import jsonwebtoken
const cacheManager = require('./lib/cache'); // Import the cache manager
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Make the cache manager available to all routes and middleware
app.set('cacheManager', cacheManager);

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  console.log('✅ Supabase Client Initialized');
  
  // Make Supabase client available to routes
  app.set('supabase', supabase);
  
  console.log('🧪 Demo Mode: DISABLED');
} else {
  console.log('⚠️  Missing Supabase credentials - running in demo mode');
  console.log('   Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
}

// Check if demo mode is enabled (when Supabase is not configured)
const DEMO_MODE = !supabase || process.env.DEMO_MODE === 'true';
console.log(`🧪 Demo Mode: ${DEMO_MODE ? 'ENABLED' : 'DISABLED'}`);

// Trust proxy for proper IP forwarding (fixes rate limit warning)
// Use a more secure configuration - only trust localhost
app.set('trust proxy', 'loopback');

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500 // limit each IP to 500 requests per windowMs (increased from 100)
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: [
    process.env.CLIENT_URL || "http://localhost:3000",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3002",
    "https://v0-ibex-frontend-development.vercel.app",
    "https://v0-ibex-frontend-development-git-main-izhanjunaids-projects.vercel.app",
    "https://v0-ibex-frontend-development-nxgsilwwv7-izhanjunaids-projects.vercel.app"
  ],
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(morgan('combined'));

// Supabase connection test (skip in demo mode)
if (!DEMO_MODE && supabase) {
  // Test Supabase connection
  supabase.from('users').select('count', { count: 'exact', head: true })
    .then(({ count, error }) => {
      if (error) {
        console.error('❌ Supabase Connection Error:', error.message);
      } else {
        console.log('✅ Supabase Connected Successfully');
        console.log(`📊 Database contains ${count} users`);
      }
    });
} else if (DEMO_MODE) {
  console.log('⚠️  Demo Mode: Using mock data for testing');
}

// Make supabase accessible to routes
app.use((req, res, next) => {
  req.supabase = supabase;
  req.demoMode = DEMO_MODE;
  next();
});

// Demo Mode Routes (enhanced mock responses with Supabase-like structure)
if (DEMO_MODE) {
  // Demo auth routes
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    console.log('🔍 Login attempt:', { email });
    
    if (email === 'demo@educore.com' && password === 'demo123') {
      console.log('✅ Login successful for:', email);
      res.json({
        success: true,
        token: 'demo-jwt-token-12345',
        user: {
          id: 'demo-user-1',
          firstName: 'Demo',
          lastName: 'Admin',
          email: 'demo@educore.com',
          role: 'admin',
          status: 'active',
          created_at: new Date().toISOString()
        }
      });
    } else {
      console.log('❌ Login failed for:', email);
      res.status(400).json({ 
        success: false, 
        message: 'Invalid credentials. Use demo@educore.com / demo123' 
      });
    }
  });

  app.post('/api/auth/register', (req, res) => {
    const { firstName, lastName, email, role } = req.body;
    res.json({
      success: true,
      message: 'Demo registration successful',
      token: 'demo-jwt-token-12345',
      user: {
        id: `demo-user-${Date.now()}`,
        firstName,
        lastName,
        email,
        role: role || 'student',
        status: 'active',
        created_at: new Date().toISOString()
      }
    });
  });

  // Demo data endpoints
  app.get('/api/classes', (req, res) => {
    res.json([
      {
        id: 'demo-class-1',
        name: 'Mathematics 101',
        subject: 'Mathematics',
        grade_level: 10,
        teacher_id: 'demo-teacher-1',
        room_number: 'Room 101',
        max_students: 30,
        is_active: true,
        created_at: new Date().toISOString()
      },
      {
        id: 'demo-class-2',
        name: 'Physics Advanced',
        subject: 'Physics',
        grade_level: 11,
        teacher_id: 'demo-teacher-2',
        room_number: 'Room 201',
        max_students: 25,
        is_active: true,
        created_at: new Date().toISOString()
      }
    ]);
  });

  app.get('/api/assignments', (req, res) => {
    res.json([
      {
        id: 'demo-assignment-1',
        title: 'Algebra Problem Set',
        description: 'Complete problems 1-20 from chapter 5',
        due_date: '2025-01-10T23:59:59Z',
        total_points: 100,
        status: 'published',
        class_id: 'demo-class-1',
        teacher_id: 'demo-teacher-1',
        created_at: new Date().toISOString()
      }
    ]);
  });

  app.get('/api/users', (req, res) => {
    res.json([
      {
        id: 'demo-user-1',
        firstName: 'Demo',
        lastName: 'Admin',
        email: 'demo@educore.com',
        role: 'admin',
        status: 'active',
        created_at: new Date().toISOString()
      },
      {
        id: 'demo-teacher-1',
        firstName: 'John',
        lastName: 'Smith',
        email: 'teacher@educore.com',
        role: 'teacher',
        status: 'active',
        created_at: new Date().toISOString()
      }
    ]);
  });



  app.get('/api/grades', (req, res) => {
    res.json([
      {
        id: 'demo-grade-1',
        student_id: 'demo-student-1',
        assignment_id: 'demo-assignment-1',
        points_earned: 85,
        points_possible: 100,
        percentage: 85,
        letter_grade: 'B',
        graded_by: 'demo-teacher-1',
        created_at: new Date().toISOString()
      }
    ]);
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'OK', 
      message: 'EduCore Supabase Backend is running',
      mode: 'demo',
      timestamp: new Date().toISOString()
    });
  });

  // Catch all other API routes in demo mode
  app.use('/api/*', (req, res) => {
    res.json({ 
      success: true, 
      message: 'Demo mode active - this is mock data',
      demoMode: true,
      endpoint: req.originalUrl,
      method: req.method,
      data: []
    });
  });
} else {
  // Production API Routes with Supabase (only load working routes)
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/classes', require('./routes/classes'));
  app.use('/api/files', require('./routes/files')); // Hybrid storage file management
  app.use('/api/school-settings', require('./routes/school-settings')); // School settings management
  app.use('/api/timetable', require('./routes/timetable')); // Read-only timetable display
  
  // Mount full assignments router (create, list by class, etc.)
  app.use('/api/assignments', require('./routes/assignments'));
  
  // NEW: Grade Section Homework System (Additive Feature)
  app.use('/api/grade-sections', require('./routes/grade-sections'));
  app.use('/api/homework', require('./routes/homework'));
  
  // Add admin overview endpoint
  app.get('/api/admin/overview', async (req, res) => {
    try {
      // Get basic metrics from database
      const { data: users } = await supabase.from('users').select('role');
      const { data: classes } = await supabase.from('classes').select('id').eq('is_active', true);
      
      const totalStudents = users?.filter(u => u.role === 'student').length || 0;
      const totalTeachers = users?.filter(u => u.role === 'teacher').length || 0;
      const totalClasses = classes?.length || 0;
      
      res.json({
        metrics: {
          totalStudents,
          totalTeachers,
          totalClasses,
          totalStaff: totalTeachers + 1, // Include admin
          averageAttendance: 0,
          academicPerformance: 87.5,
          collectionRate: 93.2,
          activeAlerts: 1,
        },
        alerts: [
          { type: 'info', message: 'System is running smoothly', priority: 'low' }
        ],
        recentActivities: [
          { activity: 'System migrated to Supabase successfully', time: 'Today' },
          { activity: 'Admin invite system activated', time: '1 hour ago' }
        ]
      });
    } catch (error) {
      console.error('Error fetching admin overview:', error);
      res.status(500).json({ error: 'Failed to fetch admin overview' });
    }
  });
  
  // Add users CRUD router
  app.use('/api/users', require('./routes/users'));
  // (Removed standalone GET /api/users route; now handled by routes/users.js for full CRUD)
  
  // TODO: Add these routes when needed
  // app.use('/api/admin', require('./routes/admin'));
  // app.use('/api/assignments', require('./routes/assignments'));
  app.use('/api/submissions', require('./routes/submissions'));
  // app.use('/api/grades', require('./routes/grades'));

  // General announcements endpoint for dashboard
  app.get('/api/announcements', async (req, res) => {
    try {
      // Get all announcements for the school
      const { data: announcements, error } = await supabase
        .from('announcements')
        .select(`
          *,
          author:users!announcements_author_id_fkey (
            id,
            first_name,
            last_name,
            profile_image_url
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching announcements:', error);
        return res.status(500).json({ error: 'Failed to fetch announcements' });
      }

      res.json(announcements || []);
    } catch (error) {
      console.error('Error in general announcements route:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  app.use('/api/announcements', require('./routes/announcements'));
  app.use('/api/comments', require('./routes/comments'));
  app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/notifications', require('./routes/notifications'));
  
  // Dashboard stats endpoint
  app.get('/api/dashboard/stats', async (req, res) => {
    try {
      // Get basic metrics from database
      const { data: users } = await supabase.from('users').select('role');
      const { data: classes } = await supabase.from('classes').select('id, student_count').eq('is_active', true);
      const { data: assignments } = await supabase.from('assignments').select('id, due_date').eq('status', 'active');
      
      const totalStudents = users?.filter(u => u.role === 'student').length || 0;
      const totalClasses = classes?.length || 0;
      const totalStudentsInClasses = classes?.reduce((sum, c) => sum + (c.student_count || 0), 0) || 0;
      
      // Count upcoming deadlines (assignments due within 7 days)
      const upcomingDeadlines = assignments?.filter(a => {
        const dueDate = new Date(a.due_date);
        const now = new Date();
        const diffTime = dueDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 7;
      }).length || 0;
      
      res.json({
        totalClasses,
        totalStudents: totalStudentsInClasses || totalStudents,
        pendingGrades: 0, // TODO: Implement when grades system is ready
        upcomingDeadlines
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
  });
  
  // app.use('/api/messages', require('./routes/messages'));
  // app.use('/api/resources', require('./routes/resources'));
  // app.use('/api/analytics', require('./routes/analytics'));
  // app.use('/api/school', require('./routes/school'));
  // app.use('/api/fees', require('./routes/fees'));
  // app.use('/api/timetable', require('./routes/timetable'));
  // app.use('/api/library', require('./routes/library'));
  // app.use('/api/events', require('./routes/events'));
  // app.use('/api/parent', require('./routes/parent'));

  // Health check endpoint for production
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'OK', 
      message: 'EduCore Supabase Backend is running',
      mode: 'production',
      database: 'supabase',
      timestamp: new Date().toISOString()
    });
  });

  // Catch all other API routes in production mode (return empty data for now)
  app.use('/api/*', (req, res) => {
    res.json({ 
      success: true, 
      message: 'Endpoint not yet implemented in production mode',
      productionMode: true,
      endpoint: req.originalUrl,
      method: req.method,
      data: []
    });
  });
}

// File upload handling
app.use('/uploads', express.static('uploads'));

// Serve static files from React app in production (only if client/build exists)
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, 'client/build');
  const indexPath = path.join(clientBuildPath, 'index.html');
  
  // Check if the client build directory exists
  if (require('fs').existsSync(clientBuildPath) && require('fs').existsSync(indexPath)) {
    app.use(express.static(clientBuildPath));
    
    app.get('*', (req, res) => {
      res.sendFile(indexPath);
    });
  } else {
    // If no frontend exists, serve API info
    app.get('/', (req, res) => {
      res.json({
        message: 'EduCore Backend API',
        status: 'running',
        version: '1.0.0',
        endpoints: {
          health: '/api/health',
          auth: '/api/auth',
          users: '/api/users',
          classes: '/api/classes',
          attendance: '/api/attendance',
          homework: '/api/homework',
          announcements: '/api/announcements',
          files: '/api/files',
          notifications: '/api/notifications'
        },
        documentation: 'This is a backend-only deployment. Frontend not included.'
      });
    });
  }
}

// Initialize Sentry for backend error monitoring
Sentry.init({
  dsn: process.env.SENTRY_DSN || '',
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  environment: process.env.NODE_ENV,
});

// Sentry request handler must be the first middleware on the app
app.use(Sentry.Handlers.requestHandler());

// Error handling middleware
// Capture errors with Sentry before sending custom JSON response
app.use(Sentry.Handlers.errorHandler());

app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'production' ? {} : err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 EduCore Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📚 Educational Management System Ready!`);
  console.log(`🗄️  Database: ${DEMO_MODE ? 'Demo Mode' : 'Supabase PostgreSQL'}`);
  if (DEMO_MODE) {
    console.log(`🎮 Demo Mode: Login with demo@educore.com / demo123`);
  }
  console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
});

module.exports = { app, supabase }; 