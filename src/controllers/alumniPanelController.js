import { query } from '../config/db.js';

export const getAlumniDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    const [tickets, posts, upcomingEvents] = await Promise.all([
      query('SELECT count(*) as total FROM event_tickets WHERE user_id = ?', [userId]),
      query('SELECT count(*) as total FROM posts WHERE created_by = ? AND deleted_at IS NULL', [userId]),
      query(`
        SELECT e.id, e.title, e.date, e.location, e.price, fm.path as thumbnail_path
        FROM events e
        LEFT JOIN file_managers fm ON e.thumbnail = fm.id
        WHERE e.status = 1 AND e.date >= NOW() AND e.deleted_at IS NULL
        ORDER BY e.date ASC LIMIT 5
      `)
    ]);

    return res.secureJson({
      success: true,
      stats: {
        totalTickets: tickets[0].total,
        myPosts: posts[0].total
      },
      upcomingEvents
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getCommunityPosts = async (req, res) => {
  try {
    const currentUserId = req.user ? req.user.id : null;

    const posts = await query(`
      SELECT p.id, p.slug, p.body, p.created_at,
             u.id as user_id, u.name as author_name, fm.path as author_avatar,
             (SELECT count(*) FROM post_like pl WHERE pl.post_id = p.id) as likes_count,
             (SELECT count(*) FROM post_comments pc WHERE pc.post_id = p.id AND pc.deleted_at IS NULL) as comments_count,
             (SELECT count(*) FROM post_like pl WHERE pl.post_id = p.id AND pl.user_id = ?) as has_liked
      FROM posts p
      JOIN users u ON p.created_by = u.id
      LEFT JOIN file_managers fm ON u.image = fm.id
      WHERE p.status = 1 AND p.deleted_at IS NULL
      ORDER BY p.created_at DESC
      LIMIT 50
    `, [currentUserId || 0]);

    return res.secureJson({ success: true, posts });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createPost = async (req, res) => {
  try {
    const userId = req.user.id;
    const { body } = req.body;

    if (!body || !body.trim()) {
      return res.status(400).json({ success: false, message: 'Post content cannot be empty.' });
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const slug = 'post-' + Date.now();

    const result = await query(
      'INSERT INTO posts (slug, body, status, created_by, created_at, updated_at) VALUES (?, ?, 1, ?, ?, ?)',
      [slug, body.trim(), userId, now, now]
    );

    return res.secureJson({
      success: true,
      message: 'Post published to alumni community feed!',
      postId: result.insertId
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const toggleLike = async (req, res) => {
  try {
    const userId = req.user.id;
    const { postId } = req.body;

    const existing = await query('SELECT * FROM post_like WHERE user_id = ? AND post_id = ?', [userId, postId]);
    if (existing.length > 0) {
      await query('DELETE FROM post_like WHERE user_id = ? AND post_id = ?', [userId, postId]);
      return res.secureJson({ success: true, liked: false });
    } else {
      await query('INSERT INTO post_like (user_id, post_id) VALUES (?, ?)', [userId, postId]);
      return res.secureJson({ success: true, liked: true });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getPostComments = async (req, res) => {
  try {
    const { postId } = req.params;
    const comments = await query(`
      SELECT pc.id, pc.body, pc.created_at,
             u.id as user_id, u.name as author_name, fm.path as author_avatar
      FROM post_comments pc
      JOIN users u ON pc.user_id = u.id
      LEFT JOIN file_managers fm ON u.image = fm.id
      WHERE pc.post_id = ? AND pc.deleted_at IS NULL
      ORDER BY pc.created_at ASC
    `, [postId]);

    return res.secureJson({ success: true, comments });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const addPostComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { postId, body } = req.body;

    if (!body || !body.trim()) {
      return res.status(400).json({ success: false, message: 'Comment cannot be empty.' });
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await query(
      'INSERT INTO post_comments (user_id, post_id, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [userId, postId, body.trim(), now, now]
    );

    return res.secureJson({ success: true, message: 'Comment added.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyTickets = async (req, res) => {
  try {
    const userId = req.user.id;
    const tickets = await query(`
      SELECT t.id, t.ticket_number, t.created_at as booked_at,
             e.id as event_id, e.title as event_title, e.date as event_date,
             e.location, e.price, fm.path as thumbnail_path
      FROM event_tickets t
      JOIN events e ON t.event_id = e.id
      LEFT JOIN file_managers fm ON e.thumbnail = fm.id
      WHERE t.user_id = ?
      ORDER BY t.created_at DESC
    `, [userId]);

    return res.secureJson({ success: true, tickets });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const bookTicket = async (req, res) => {
  try {
    const userId = req.user.id;
    const { event_id } = req.body;

    if (!event_id) {
      return res.status(400).json({ success: false, message: 'Event ID required' });
    }

    const events = await query('SELECT * FROM events WHERE id = ? AND status = 1', [event_id]);
    if (!events.length) {
      return res.status(404).json({ success: false, message: 'Event not available.' });
    }

    const event = events[0];
    if (event.number_of_ticket_left <= 0 && event.number_of_ticket > 0) {
      return res.status(400).json({ success: false, message: 'Event tickets are sold out.' });
    }

    const ticketNumber = 'PMC-TKT-' + Math.floor(100000 + Math.random() * 900000);
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const result = await query(
      'INSERT INTO event_tickets (event_id, user_id, ticket_number, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [event_id, userId, ticketNumber, now, now]
    );

    // Decrement tickets left
    if (event.number_of_ticket_left > 0) {
      await query('UPDATE events SET number_of_ticket_left = number_of_ticket_left - 1 WHERE id = ?', [event_id]);
    }

    return res.secureJson({
      success: true,
      message: 'Ticket booked successfully!',
      ticket: {
        id: result.insertId,
        ticket_number: ticketNumber,
        event_title: event.title
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
