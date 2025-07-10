const express = require('express');
const router = express.Router();

const { authenticateToken } = require('../middleware/auth');
const { supabaseAdmin } = require('../lib/supabase');

// Inject supabase admin
router.use((req, _res, next) => {
  req.supabase = supabaseAdmin;
  next();
});

/**
 * GET /api/comments/:type/:id
 * List comments for a parent (assignment or announcement)
 */
router.get('/:type/:id', authenticateToken, async (req, res) => {
  try {
    const { type, id } = req.params;
    const { data, error } = await req.supabase
      .from('comments')
      .select(
        `*, author:users(id, first_name, last_name, profile_image_url)`
      )
      .eq('parent_type', type)
      .eq('parent_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Fetch comments error:', error);
      return res.status(500).json({ error: 'Failed to fetch comments' });
    }

    res.json(data || []);
  } catch (err) {
    console.error('Comments list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/comments
 * body: { parentType, parentId, content }
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { parentType, parentId, content } = req.body;
    const { user } = req;
    if (!content || !parentType || !parentId) {
      return res.status(400).json({ error: 'parentType, parentId and content required' });
    }

    const { data, error } = await req.supabase
      .from('comments')
      .insert({
        parent_type: parentType,
        parent_id: parentId,
        author_id: user.id,
        content,
      })
      .select(
        `*, author:users(id, first_name, last_name, profile_image_url)`
      )
      .single();

    if (error) {
      console.error('Create comment error:', error);
      return res.status(500).json({ error: 'Failed to post comment' });
    }

    res.status(201).json(data);
  } catch (err) {
    console.error('Comments POST error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/comments/:id  (author or admin)
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;

    // Fetch comment to verify ownership
    const { data: comment, error: fetchErr } = await req.supabase
      .from('comments')
      .select('author_id')
      .eq('id', id)
      .single();

    if (fetchErr || !comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (comment.author_id !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { error: delErr } = await req.supabase
      .from('comments')
      .delete()
      .eq('id', id);

    if (delErr) {
      console.error('Delete comment error:', delErr);
      return res.status(500).json({ error: 'Failed to delete comment' });
    }

    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Comments DELETE error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 