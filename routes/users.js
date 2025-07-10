const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { createClient } = require('@supabase/supabase-js');
const { auth } = require('../middleware/auth');
const hybridStorage = require('../lib/hybrid-storage');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// @route   GET /api/users
// @desc    Get all users (admin only)
// @access  Private/Admin
router.get('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const role = req.query.role || '';

    let query = supabase
      .from('users')
      .select('*', { count: 'exact' })
      .range((page - 1) * limit, page * limit - 1)
      .order('created_at', { ascending: false });
    
    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,student_id.ilike.%${search}%`);
    }
    
    if (role) {
      query = query.eq('role', role);
    }

    const { data: users, error, count } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ message: 'Database error' });
    }

    res.json({
      users,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.params.id)
      .single();
    
    if (error || !user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user can access this profile
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Remove password hash from response
    delete user.password_hash;

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user profile
// @access  Private
router.put('/:id', [
  auth,
  [
    body('first_name').optional().trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
    body('last_name').optional().trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
    body('email').optional().isEmail().withMessage('Please include a valid email'),
    body('phone').optional().isMobilePhone().withMessage('Please include a valid phone number')
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // Check if user can update this profile
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get current user data
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (userError || !user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const {
      first_name,
      last_name,
      email,
      phone,
      date_of_birth,
      gender,
      address,
      emergency_contact,
      medical_info
    } = req.body;

    // Check if email is already taken by another user
    if (email && email !== user.email) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }

    // Prepare update data
    const updateData = {};
    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (date_of_birth !== undefined) updateData.date_of_birth = date_of_birth;
    if (gender !== undefined) updateData.gender = gender;
    if (address !== undefined) updateData.address = address;
    if (emergency_contact !== undefined) updateData.emergency_contact = emergency_contact;
    if (medical_info !== undefined) updateData.medical_info = medical_info;

    // Update user
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', req.params.id)
      .select('id, first_name, last_name, email, role')
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return res.status(500).json({ message: 'Error updating profile' });
    }

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/:id/password
// @desc    Update user password
// @access  Private
router.put('/:id/password', [
  auth,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // Check if user can update this password
    if (req.user.id !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', req.params.id)
      .single();

    if (error || !user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { currentPassword, newPassword } = req.body;

    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update password
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('id', req.params.id);

    if (updateError) {
      console.error('Password update error:', updateError);
      return res.status(500).json({ message: 'Error updating password' });
    }

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete user (admin only)
// @access  Private/Admin
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    // Prevent admin from deleting themselves
    if (req.user.id === req.params.id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', req.params.id)
      .single();

    if (userError || !user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Remove foreign key references in invites table to avoid constraint violation
    await supabase.from('invites').update({ accepted_by: null }).eq('accepted_by', req.params.id);
    await supabase.from('invites').update({ invited_by: null }).eq('invited_by', req.params.id);

    // Delete user's uploaded files from storage and DB
    const { data: userFiles } = await supabase
      .from('file_uploads')
      .select('*')
      .eq('user_id', req.params.id);

    if (userFiles && userFiles.length > 0) {
      for (const file of userFiles) {
        try {
          await hybridStorage.deleteFile(file.file_path, file.storage_provider, file.bucket);
        } catch (err) {
          console.warn('File deletion warn:', err.message);
        }
      }

      await supabase.from('file_uploads').delete().eq('user_id', req.params.id);
    }

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', req.params.id);

    if (error) {
      console.error('Delete error:', error);
      return res.status(500).json({ message: 'Error deleting user' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/role/:role
// @desc    Get users by role
// @access  Private
router.get('/role/:role', auth, async (req, res) => {
  try {
    const { role } = req.params;
    const validRoles = ['admin', 'teacher', 'student', 'parent'];
    
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const { data: users, error } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, student_id')
      .eq('role', role)
      .order('first_name');

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ message: 'Database error' });
    }

    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users/:id/activate
// @desc    Activate/Deactivate user (admin only)
// @access  Private/Admin
router.post('/:id/activate', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('status')
      .eq('id', req.params.id)
      .single();

    if (userError || !user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const newStatus = user.status === 'active' ? 'inactive' : 'active';

    const { error } = await supabase
      .from('users')
      .update({ status: newStatus })
      .eq('id', req.params.id);

    if (error) {
      console.error('Status update error:', error);
      return res.status(500).json({ message: 'Error updating user status' });
    }

    res.json({
      message: `User ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`,
      status: newStatus
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 