const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const router = express.Router();
const { supabaseAdmin } = require('../lib/supabase');

// Email sending function using Gmail (nodemailer)
async function sendInvitationEmail(email, role, acceptUrl, invitedBy) {
  // Debug environment variables
  console.log('📧 Email Config Debug:');
  console.log('- GMAIL_USER:', process.env.GMAIL_USER ? '✅ Set' : '❌ Missing');
  console.log('- GMAIL_PASS:', process.env.GMAIL_PASS ? '✅ Set' : '❌ Missing');
  console.log('- FROM_EMAIL:', process.env.FROM_EMAIL ? '✅ Set' : '❌ Missing');

  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    throw new Error('Gmail credentials not configured. Please set GMAIL_USER and GMAIL_PASS in your .env file.');
  }

  // Create a transporter using Gmail
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS
    }
  });

  const emailTemplate = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0; font-size: 28px;">🎓 Welcome to Ibex Classroom!</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">You've been invited to join our educational platform</p>
      </div>
      <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <h2 style="color: #333; margin-top: 0;">You're Invited as a ${role.charAt(0).toUpperCase() + role.slice(1)}!</h2>
        <p style="color: #666; font-size: 16px; line-height: 1.6;">
          ${invitedBy} has invited you to join ibex as a <strong>${role}</strong>. 
          Click the button below to accept your invitation and create your account with your Google account.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${acceptUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px; display: inline-block;">
            🚀 Accept Invitation & Join with Google
          </a>
        </div>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">📧 Your Gmail: ${email}</h3>
          <p style="margin: 0; color: #666; font-size: 14px;">
            <strong>Can't click the button?</strong> Copy and paste this link into your browser:
          </p>
          <p style="margin: 5px 0 0 0; word-break: break-all; color: #667eea; font-size: 13px;">
            ${acceptUrl}
          </p>
        </div>
        <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; border-left: 4px solid #2196f3;">
          <p style="margin: 0; color: #1976d2; font-size: 14px;">
            <strong>🔐 Easy Signup:</strong> You'll sign in with your existing Google account - no new passwords to remember!
          </p>
        </div>
        <p style="color: #999; font-size: 14px; margin: 20px 0 0 0;">
          This invitation expires in 7 days. If you didn't expect this invitation, you can safely ignore this email.
        </p>
      </div>
      <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
        <p>© 2025 ibex - Educational Management System</p>
        <p>Powered by Gmail</p>
      </div>
    </div>
  `;

  const mailOptions = {
    from: process.env.FROM_EMAIL || 'Your Name <your@gmail.com>',
    to: email,
    subject: `🎓 You're invited to join EduCore as a ${role}!`,
    html: emailTemplate,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log('✅ Email sent via Gmail:', info.messageId);
  return info;
}

// Login endpoint
router.post('/login', [
  body('email').isEmail(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;
    const supabase = req.supabase;

    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Database connection error'
      });
    }

    console.log('🔍 Looking up user:', email);

    // Get user from public.users table
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email);

    console.log('📋 Database query result:', { user, error });

    if (error) {
      console.log('❌ Database error:', error);
      return res.status(500).json({
        success: false,
        message: 'Database error'
      });
    }

    if (!user || user.length === 0) {
      console.log('❌ User not found:', email);
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const foundUser = user[0];
    console.log('👤 Found user:', { 
      id: foundUser.id, 
      email: foundUser.email, 
      status: foundUser.status,
      role: foundUser.role 
    });

    if (foundUser.status !== 'active') {
      console.log('❌ User not active:', email, 'Status:', foundUser.status);
      return res.status(400).json({
        success: false,
        message: 'Account is not active'
      });
    }

    // Check password
    let isValidPassword = false;
    
    // Handle different password hash formats
    if (foundUser.password_hash) {
      if (typeof foundUser.password_hash === 'string') {
        isValidPassword = await bcrypt.compare(password, foundUser.password_hash);
        console.log('🔐 Password check (hash):', isValidPassword);
      } else {
        console.log('❌ Invalid password hash format for user:', email);
        return res.status(500).json({
          success: false,
          message: 'Authentication error'
        });
      }
    } else {
      console.log('🔍 Trying Supabase auth for:', email);
      // If no password hash, try Supabase auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError || !authData.user) {
        console.log('❌ Supabase auth failed for:', email, authError?.message);
        return res.status(400).json({
          success: false,
          message: 'Invalid credentials'
        });
      }
      
      isValidPassword = true;
      console.log('✅ Supabase auth successful for:', email);
    }

    if (!isValidPassword) {
      console.log('❌ Invalid password for:', email);
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: foundUser.id, 
        email: foundUser.email, 
        role: foundUser.role 
      },
      process.env.JWT_SECRET || 'your-jwt-secret-key',
      { expiresIn: '24h' }
    );

    console.log('✅ Login successful for:', email);

    // Return success response
    res.json({
      success: true,
      token,
      user: {
        id: foundUser.id,
        firstName: foundUser.first_name,
        lastName: foundUser.last_name,
        email: foundUser.email,
        role: foundUser.role,
        status: foundUser.status,
        createdAt: foundUser.created_at
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Register endpoint (for completeness)
router.post('/register', [
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('firstName').notEmpty(),
  body('lastName').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input',
        errors: errors.array()
      });
    }

    const { email, password, firstName, lastName, role = 'student' } = req.body;
    const supabase = req.supabase;

    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Database connection error'
      });
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) {
      return res.status(400).json({
        success: false,
        message: authError.message
      });
    }

    // Create user in public.users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert([{
        id: authData.user.id,
        email,
        first_name: firstName,
        last_name: lastName,
        role,
        status: 'active'
      }])
      .select()
      .single();

    if (userError) {
      return res.status(400).json({
        success: false,
        message: 'Failed to create user profile'
      });
    }

    res.json({
      success: true,
      message: 'User created successfully',
      user: {
        id: userData.id,
        firstName: userData.first_name,
        lastName: userData.last_name,
        email: userData.email,
        role: userData.role,
        status: userData.status
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret-key');
    const supabase = req.supabase;

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.created_at
      }
    });

  } catch (error) {
    console.error('Auth check error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
});

// JWT middleware for authenticated routes
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Get all invites (admin only)
router.get('/admin/invites', authenticateToken, async (req, res) => {
  try {
    const supabase = req.supabase;
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { data: invites, error } = await supabase
      .from('invites')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invites:', error);
      return res.status(500).json({ error: 'Failed to fetch invites' });
    }

    res.json({ invites: invites || [] });
  } catch (error) {
    console.error('Invite fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send invite (admin and teachers)
router.post('/admin/send-invite', authenticateToken, async (req, res) => {
  try {
    const { email, role } = req.body;
    const supabase = req.supabase;

    if (!email || !role) {
      return res.status(400).json({ error: 'Email and role are required' });
    }

    // Check permissions
    const canInvite = (
      (req.user.role === 'admin' && ['teacher', 'student'].includes(role)) ||
      (req.user.role === 'teacher' && role === 'student')
    );

    if (!canInvite) {
      return res.status(403).json({ 
        error: 'You do not have permission to invite users with this role' 
      });
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Check if there's already a pending invite
    const { data: existingInvite } = await supabase
      .from('invites')
      .select('id, expires_at')
      .eq('email', email)
      .is('accepted_at', null)
      .single();

    if (existingInvite) {
      const now = new Date();
      const expiresAt = new Date(existingInvite.expires_at);
      
      if (expiresAt > now) {
        return res.status(400).json({ error: 'A pending invitation already exists for this email' });
      }
    }

    // Create new invite
    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .insert({
        email,
        role,
        invited_by: req.user.userId,
        invited_by_role: req.user.role,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      })
      .select('*')
      .single();

    if (inviteError) {
      console.error('Error creating invite:', inviteError);
      return res.status(500).json({ error: 'Failed to create invitation' });
    }

    // Email sending functionality
    const frontendUrl = process.env.CLIENT_URL || "http://localhost:3000";
    const acceptUrl = `${frontendUrl}/accept-invite?token=${invite.token}`;
    
    // Try to send email (if configured)
    let emailSent = false;
    try {
      await sendInvitationEmail(email, role, acceptUrl, req.user.email);
      emailSent = true;
      console.log(`📧 Invitation email sent to ${email}`);
    } catch (emailError) {
      console.log(`⚠️  Email not sent (service not configured): ${emailError.message}`);
    }

    // Log invitation details for manual sharing if email fails
    console.log(`📧 Invite created for ${email} as ${role} by ${req.user.email}`);
    console.log(`🔗 Invite token: ${invite.token}`);
    console.log(`🌐 Accept URL: ${acceptUrl}`);

    res.json({
      success: true,
      message: emailSent 
        ? 'Invitation sent successfully!' 
        : 'Invitation created! Please share the link manually as email service is not configured.',
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        token: invite.token,
        expires_at: invite.expires_at,
        acceptUrl: acceptUrl
      },
      emailSent,
      manualLink: emailSent ? undefined : acceptUrl
    });

  } catch (error) {
    console.error('Send invite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete invite (admin only)
router.delete('/admin/invites/:inviteId', authenticateToken, async (req, res) => {
  try {
    const supabase = req.supabase;
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { inviteId } = req.params;

    const { error } = await supabase
      .from('invites')
      .delete()
      .eq('id', inviteId);

    if (error) {
      console.error('Error deleting invite:', error);
      return res.status(500).json({ error: 'Failed to delete invite' });
    }

    res.json({ message: 'Invitation deleted successfully' });
  } catch (error) {
    console.error('Delete invite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Redeem invite (public endpoint)
router.post('/redeem-invite', async (req, res) => {
  try {
    const { token, password, firstName, lastName } = req.body;
    const supabase = req.supabase;

    if (!token || !password || !firstName || !lastName) {
      return res.status(400).json({ 
        error: 'Token, password, first name, and last name are required' 
      });
    }

    // Look up the invite (check both pending and accepted invites)
    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .select('*')
      .eq('token', token)
      .single();

    if (inviteError || !invite) {
      return res.status(400).json({ error: 'Invalid invitation token' });
    }

    // Check if invite has expired
    const now = new Date();
    const expiresAt = new Date(invite.expires_at);
    
    if (expiresAt < now) {
      return res.status(400).json({ error: 'This invitation has expired' });
    }

    // Check if invite was already accepted
    if (invite.accepted_at) {
      console.log('⚠️ Invite already accepted, checking if user exists for login:', invite.email);
      
      // Invite already accepted, check if user exists and log them in
      const { data: existingUser, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (existingUser && existingUser.email === invite.email) {
        // Generate JWT token for existing user
        const jwtToken = jwt.sign(
          { 
            userId: user.id, 
            email: invite.email, 
            role: invite.role 
          },
          process.env.JWT_SECRET,
          { expiresIn: '24h' }
        );

        console.log('✅ Invite already accepted, logging existing user in:', invite.email);

        return res.json({
          success: true,
          token: jwtToken,
          user: {
            id: user.id,
            firstName: existingUser.first_name || '',
            lastName: existingUser.last_name || '',
            email: invite.email,
            role: invite.role,
            status: 'active',
            profileImage: existingUser.profile_image_url
          }
        });
      } else {
        return res.status(400).json({ error: 'Invite already accepted by different user' });
      }
    }

    // Create the user account using Supabase Auth
    const { data: authUser, error: createUserError } = await supabase.auth.admin.createUser({
      email: invite.email,
      password: password,
      email_confirm: true,
      user_metadata: {
        role: invite.role,
        first_name: firstName,
        last_name: lastName,
        invited_by: invite.invited_by
      }
    });

    if (createUserError || !authUser.user) {
      console.error('User creation error:', createUserError);
      return res.status(500).json({ error: 'Failed to create user account' });
    }

    // Insert user data into our users table
    const { error: insertUserError } = await supabase
      .from('users')
      .insert({
        id: authUser.user.id,
        email: invite.email,
        role: invite.role,
        first_name: firstName,
        last_name: lastName,
        status: 'active',
        created_at: new Date().toISOString()
      });

    if (insertUserError) {
      console.error('User insert error:', insertUserError);
      // Clean up auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authUser.user.id);
      return res.status(500).json({ error: 'Failed to create user profile' });
    }

    // Mark the invite as accepted
    await supabase
      .from('invites')
      .update({
        accepted_at: new Date().toISOString(),
        accepted_by: authUser.user.id
      })
      .eq('id', invite.id);

    console.log(`✅ User account created: ${invite.email} as ${invite.role}`);

    res.json({
      success: true,
      message: 'Account created successfully! You can now log in.',
      user: {
        id: authUser.user.id,
        email: authUser.user.email,
        role: invite.role,
        first_name: firstName,
        last_name: lastName
      }
    });

  } catch (error) {
    console.error('Redeem invite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Google OAuth callback for login
router.post('/google-callback', async (req, res) => {
  try {
    const { user, access_token } = req.body;
    const supabase = req.supabase;

    if (!user || !user.email) {
      return res.status(400).json({ error: 'Invalid Google user data' });
    }

    // Check if user exists in our system
    const { data: existingUser, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', user.email)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      console.error('Database error:', userError);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!existingUser) {
      return res.status(400).json({ 
        error: 'No account found. Please check if you have been invited to join EduCore.' 
      });
    }

    // Update user's login info  
    const { error: updateError } = await supabase
      .from('users')
      .update({
        profile_image_url: user.user_metadata?.avatar_url || user.user_metadata?.picture,
        last_login: new Date().toISOString(),
        email_verified: true
      })
      .eq('id', existingUser.id);

    if (updateError) {
      console.error('Error updating user:', updateError);
      // Don't fail the login for this
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: existingUser.id, 
        email: existingUser.email, 
        role: existingUser.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('✅ Google login successful for:', user.email);

    res.json({
      success: true,
      token,
      user: {
        id: existingUser.id,
        firstName: existingUser.first_name,
        lastName: existingUser.last_name,
        email: existingUser.email,
        role: existingUser.role,
        status: existingUser.status,
        profileImage: existingUser.profile_image_url
      }
    });

  } catch (error) {
    console.error('Google callback error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Accept invite with Google OAuth
router.post('/accept-invite-google', async (req, res) => {
  try {
    const { token, user, access_token } = req.body;
    const supabase = supabaseAdmin; // use service role to bypass RLS

    if (!token || !user || !user.email) {
      return res.status(400).json({ error: 'Token and user data are required' });
    }

    // Look up the invite
    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .select('*')
      .eq('token', token)
      .is('accepted_at', null)
      .single();

    if (inviteError || !invite) {
      return res.status(400).json({ error: 'Invalid or expired invitation token' });
    }

    // Check if invite has expired
    const now = new Date();
    const expiresAt = new Date(invite.expires_at);
    
    if (expiresAt < now) {
      return res.status(400).json({ error: 'This invitation has expired' });
    }

    // Verify email matches invitation
    if (invite.email !== user.email) {
      return res.status(400).json({ 
        error: 'The Google account email does not match the invited email address' 
      });
    }

    // Check if user already exists with this email OR ID
    const { data: existingUsers, error: existingError } = await supabase
      .from('users')
      .select('id, email')
      .or(`email.eq.${invite.email},id.eq.${user.id}`);

    if (existingError) {
      console.error('Error checking existing users:', existingError);
      return res.status(500).json({ error: 'Database error while checking existing users' });
    }

    if (existingUsers && existingUsers.length > 0) {
      const existingUser = existingUsers[0];
      
      // If user exists with same ID, they might have already completed registration
      if (existingUser.id === user.id) {
        // Generate JWT token for existing user and return success
        const jwtToken = jwt.sign(
          { 
            userId: user.id, 
            email: invite.email, 
            role: invite.role 
          },
          process.env.JWT_SECRET,
          { expiresIn: '24h' }
        );

        console.log('✅ User already exists, logging them in:', invite.email);

        return res.json({
          success: true,
          token: jwtToken,
          user: {
            id: user.id,
            firstName: existingUser.first_name || user.user_metadata?.given_name || '',
            lastName: existingUser.last_name || user.user_metadata?.family_name || '',
            email: invite.email,
            role: invite.role,
            status: 'active',
            profileImage: user.user_metadata?.avatar_url || user.user_metadata?.picture
          }
        });
      } else {
        return res.status(400).json({ error: 'A user with this email already exists' });
      }
    }

    // Insert user data into our users table
    const { error: insertUserError } = await supabase
      .from('users')
      .insert({
        id: user.id,
        email: invite.email,
        role: invite.role,
        status: 'active',
        first_name: user.user_metadata?.given_name || user.user_metadata?.first_name || '',
        last_name: user.user_metadata?.family_name || user.user_metadata?.last_name || '',
        profile_image_url: user.user_metadata?.avatar_url || user.user_metadata?.picture,
        email_verified: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (insertUserError) {
      console.error('Error creating user profile:', insertUserError);
      return res.status(500).json({ error: 'Failed to create user profile' });
    }

    // Mark invite as accepted
    const { error: updateInviteError } = await supabase
      .from('invites')
      .update({ 
        accepted_at: new Date().toISOString(),
        accepted_by: user.id
      })
      .eq('id', invite.id);

    if (updateInviteError) {
      console.error('Error updating invite:', updateInviteError);
      // Don't fail the process for this
    }

    // Generate JWT token
    const jwtToken = jwt.sign(
      { 
        userId: user.id, 
        email: invite.email, 
        role: invite.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('✅ Google invite acceptance successful for:', invite.email);

    res.json({
      success: true,
      token: jwtToken,
      user: {
        id: user.id,
        firstName: user.user_metadata?.given_name || user.user_metadata?.first_name || '',
        lastName: user.user_metadata?.family_name || user.user_metadata?.last_name || '',
        email: invite.email,
        role: invite.role,
        status: 'active',
        profileImage: user.user_metadata?.avatar_url || user.user_metadata?.picture
      }
    });

  } catch (error) {
    console.error('Google invite acceptance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify invite token (public endpoint)
router.get('/verify-invite/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const supabase = req.supabase;

    const { data: invite, error } = await supabase
      .from('invites')
      .select('email, role, invited_by_role, expires_at')
      .eq('token', token)
      .is('accepted_at', null)
      .single();

    if (error || !invite) {
      return res.status(400).json({ error: 'Invalid or expired invitation token' });
    }

    // Check if invite has expired
    const now = new Date();
    const expiresAt = new Date(invite.expires_at);
    
    if (expiresAt < now) {
      return res.status(400).json({ error: 'This invitation has expired' });
    }

    res.json({ 
      success: true, 
      invite: {
        email: invite.email,
        role: invite.role,
        invited_by_role: invite.invited_by_role,
        expires_at: invite.expires_at
      }
    });

  } catch (error) {
    console.error('Invite verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test email endpoint (temporary for debugging)
router.post('/test-email', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const testEmail = req.body.email || 'test@example.com';
    const testUrl = 'http://localhost:3000/test-invite';
    
    console.log('🧪 Testing email sending...');
    console.log('📧 Environment Variables Check:');
    console.log('- GMAIL_USER:', process.env.GMAIL_USER ? 'Set ✅' : 'Missing ❌');
    console.log('- GMAIL_PASS:', process.env.GMAIL_PASS ? 'Set ✅' : 'Missing ❌');
    console.log('- FROM_EMAIL:', process.env.FROM_EMAIL || 'Using default');

    await sendInvitationEmail(testEmail, 'student', testUrl, req.user.email);
    
    res.json({ 
      success: true, 
      message: 'Test email sent successfully!',
      recipient: testEmail
    });
  } catch (error) {
    console.error('❌ Test email failed:', error);
    res.status(500).json({ 
      error: 'Test email failed', 
      details: error.message 
    });
  }
});

// Create admin account (temporary endpoint for setup)
router.post('/create-admin', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    const supabase = req.supabase;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Email, password, first name, and last name are required' });
    }

    // Check if admin already exists
    const { data: existingAdmin } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin')
      .single();

    if (existingAdmin) {
      return res.status(400).json({ error: 'Admin account already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Create admin user
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .insert({
        email,
        password_hash,
        first_name: firstName,
        last_name: lastName,
        role: 'admin',
        status: 'active',
        email_verified: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (adminError) {
      console.error('Error creating admin:', adminError);
      return res.status(500).json({ error: 'Failed to create admin account' });
    }

    console.log('✅ Admin account created successfully:', email);

    res.json({
      success: true,
      message: 'Admin account created successfully',
      admin: {
        id: adminUser.id,
        email: adminUser.email,
        firstName: adminUser.first_name,
        lastName: adminUser.last_name,
        role: adminUser.role
      }
    });

  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Google login for existing users (not invitations)
router.post('/google-login', async (req, res) => {
  try {
    const { user, access_token } = req.body;
    const supabase = req.supabase;

    if (!user || !user.email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Google user data is required' 
      });
    }

    console.log('🔍 Google login attempt for:', user.email);

    // Look up existing user by email
    const { data: existingUser, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', user.email)
      .single();

    if (userError || !existingUser) {
      console.log('❌ No existing user found for:', user.email);
      return res.status(400).json({ 
        success: false, 
        error: 'No account found with this Google email. Please contact an administrator for an invitation.' 
      });
    }

    // Check if user is active
    if (existingUser.status !== 'active') {
      console.log('❌ User account not active:', user.email);
      return res.status(400).json({ 
        success: false, 
        error: 'Account is not active. Please contact an administrator.' 
      });
    }

    // Don't allow Google login for admin users
    if (existingUser.role === 'admin') {
      console.log('❌ Admin attempted Google login:', user.email);
      return res.status(400).json({ 
        success: false, 
        error: 'Admin accounts must use email/password login.' 
      });
    }

    // Update user's profile image if it's from Google
    if (user.user_metadata?.avatar_url || user.user_metadata?.picture) {
      const profileImageUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
      
      await supabase
        .from('users')
        .update({ 
          profile_image_url: profileImageUrl,
          last_login: new Date().toISOString()
        })
        .eq('id', existingUser.id);
    }

    // Generate JWT token
    const jwtToken = jwt.sign(
      { 
        userId: existingUser.id, 
        email: existingUser.email, 
        role: existingUser.role 
      },
      process.env.JWT_SECRET || 'your-jwt-secret-key',
      { expiresIn: '24h' }
    );

    console.log('✅ Google login successful for:', user.email);

    res.json({
      success: true,
      token: jwtToken,
      user: {
        id: existingUser.id,
        firstName: existingUser.first_name,
        lastName: existingUser.last_name,
        email: existingUser.email,
        role: existingUser.role,
        status: existingUser.status,
        profileImage: user.user_metadata?.avatar_url || user.user_metadata?.picture || existingUser.profile_image_url,
        createdAt: existingUser.created_at
      }
    });

  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});


module.exports = router; 