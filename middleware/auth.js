const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Basic authentication middleware
const auth = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided, authorization denied'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    
    // Support both token formats: { user: { id, email, role } } or { userId, email, role }
    let decodedUser = decoded.user;
    if (!decodedUser && decoded.userId) {
      decodedUser = {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      };
    }

    if (!decodedUser || !decodedUser.id) {
      return res.status(401).json({ success: false, message: 'Invalid token payload' });
    }

    // Check if user still exists in Supabase
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decodedUser.id)
      .single();

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: 'Token is not valid - user not found'
      });
    }

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is not active'
      });
    }

    // Add user to request
    req.user = decodedUser;
    req.userData = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired'
      });
    }
    
    return res.status(401).json({
      success: false,
      message: 'Token is not valid'
    });
  }
};

// Simple token authentication (for file uploads - no database lookup)
const authenticateToken = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    // Debug logging for student homework requests
    if (req.path.includes('/homework') && req.method === 'GET') {
      console.log('🔐 [AUTH] Student homework request detected');
      console.log('   📍 Path:', req.path);
      console.log('   🔑 Token present:', !!token);
      console.log('   🌐 Origin:', req.headers.origin);
      console.log('   📱 User agent:', req.headers['user-agent']);
    }
    
    if (!token) {
      console.log('❌ [AUTH] No token provided for homework request');
      return res.status(401).json({
        success: false,
        message: 'No token provided, authorization denied'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    
    // Debug logging for student homework requests
    if (req.path.includes('/homework') && req.method === 'GET') {
      console.log('✅ [AUTH] Token verified successfully');
      console.log('   👤 Decoded user:', {
        id: decoded.user?.id || decoded.userId,
        email: decoded.user?.email || decoded.email,
        role: decoded.user?.role || decoded.role
      });
    }
    
    // Add user to request (minimal verification for performance)
    // Handle both token formats: { user: {...} } and { userId, email, role }
    if (decoded.user) {
      req.user = decoded.user;
    } else if (decoded.userId) {
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role
      };
    } else {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format'
      });
    }
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired'
      });
    }
    
    return res.status(401).json({
      success: false,
      message: 'Token is not valid'
    });
  }
};

// Role-based authentication middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No user found.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${roles.join(', ')}`
      });
    }

    next();
  };
};

// Admin only middleware
const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin access required.'
    });
  }
  next();
};

// Teacher or admin middleware
const teacherOrAdmin = (req, res, next) => {
  if (!req.user || !['teacher', 'admin'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Teacher or admin access required.'
    });
  }
  next();
};

// Student access middleware
const studentOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'student') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Student access required.'
    });
  }
  next();
};

// Parent access middleware
const parentOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'parent') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Parent access required.'
    });
  }
  next();
};

// School verification middleware
const verifySchool = async (req, res, next) => {
  try {
    let user = req.userData;
    
    // If we don't have user data, fetch it from Supabase
    if (!user) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', req.user.id)
        .single();
      
      if (error || !data) {
        return res.status(500).json({
          success: false,
          message: 'Error fetching user data'
        });
      }
      
      user = data;
    }
    
    if (!user.school_id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. User must be associated with a school.'
      });
    }

    req.userSchool = user.school_id;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error verifying school association'
    });
  }
};

// Optional authentication (for public/private content)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
      
      // Fetch user from Supabase
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', decoded.user.id)
        .single();
      
      if (!error && user && user.status === 'active') {
        req.user = decoded.user;
        req.userData = user;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};

// Class access verification middleware
const verifyClassAccess = async (req, res, next) => {
  try {
    const classId = req.params.classId || req.body.classId;
    
    if (!classId) {
      return res.status(400).json({
        success: false,
        message: 'Class ID is required'
      });
    }

    // Check if user has access to this class
    const { data: enrollment, error } = await supabase
      .from('class_enrollments')
      .select('*')
      .eq('class_id', classId)
      .eq('user_id', req.user.id)
      .single();

    // If not enrolled, check if user is the teacher or admin
    if (error || !enrollment) {
      if (req.user.role === 'admin') {
        return next(); // Admins have access to all classes
      }

      if (req.user.role === 'teacher') {
        // Check if user is the teacher of this class
        const { data: classData, error: classError } = await supabase
          .from('classes')
          .select('*')
          .eq('id', classId)
          .eq('teacher_id', req.user.id)
          .single();

        if (!classError && classData) {
          return next(); // Teacher has access to their own class
        }
      }

      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have access to this class.'
      });
    }

    req.classAccess = enrollment;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error verifying class access'
    });
  }
};

// Assignment access verification middleware
const verifyAssignmentAccess = async (req, res, next) => {
  try {
    const assignmentId = req.params.assignmentId || req.body.assignmentId;
    
    if (!assignmentId) {
      return res.status(400).json({
        success: false,
        message: 'Assignment ID is required'
      });
    }

    // Get assignment details
    const { data: assignment, error } = await supabase
      .from('assignments')
      .select('*, classes(*)')
      .eq('id', assignmentId)
      .single();

    if (error || !assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    // Check access based on role
    if (req.user.role === 'admin') {
      return next(); // Admins have access to all assignments
    }

    if (req.user.role === 'teacher' && assignment.classes.teacher_id === req.user.id) {
      return next(); // Teachers have access to their own assignments
    }

    if (req.user.role === 'student') {
      // Check if student is enrolled in the class
      const { data: enrollment, error: enrollmentError } = await supabase
        .from('class_enrollments')
        .select('*')
        .eq('class_id', assignment.class_id)
        .eq('user_id', req.user.id)
        .single();

      if (!enrollmentError && enrollment) {
        return next(); // Student has access if enrolled in class
      }
    }

    return res.status(403).json({
      success: false,
      message: 'Access denied. You do not have access to this assignment.'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error verifying assignment access'
    });
  }
};

// Admin role check middleware
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Admin role required.' });
  }
};

// Teacher role check middleware
const isTeacher = (req, res, next) => {
  if (req.user && (req.user.role === 'teacher' || req.user.role === 'admin')) {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Teacher role required.' });
  }
};

// Student role check middleware
const isStudent = (req, res, next) => {
  if (req.user && req.user.role === 'student') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Student role required.' });
  }
};

// Parent role check middleware
const isParent = (req, res, next) => {
  if (req.user && req.user.role === 'parent') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Parent role required.' });
  }
};

module.exports = {
  auth,
  authenticateToken, // New lightweight auth for file uploads
  authorize,
  adminOnly,
  teacherOrAdmin,
  studentOnly,
  parentOnly,
  verifySchool,
  optionalAuth,
  verifyClassAccess,
  verifyAssignmentAccess,
  isAdmin,
  isTeacher,
  isStudent,
  isParent
}; 