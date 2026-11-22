import { query } from '../config/db.js';

export const getSettings = async (req, res) => {
  try {
    const rows = await query('SELECT option_key, option_value FROM settings');
    const settings = {};
    rows.forEach(r => {
      settings[r.option_key] = r.option_value;
    });

    // Resolve logo and favicon paths if numeric IDs
    if (settings.app_logo) {
      const logos = await query('SELECT path FROM file_managers WHERE id = ?', [settings.app_logo]);
      if (logos.length > 0) settings.app_logo_url = '/uploads/' + logos[0].path.replace(/^uploads\//, '');
    }
    if (settings.app_fav_icon) {
      const favs = await query('SELECT path FROM file_managers WHERE id = ?', [settings.app_fav_icon]);
      if (favs.length > 0) settings.app_fav_icon_url = '/uploads/' + favs[0].path.replace(/^uploads\//, '');
    }

    return res.secureJson({ success: true, settings });
  } catch (error) {
    console.error('getSettings error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getHomeData = async (req, res) => {
  try {
    // Stats
    const [[alumniCount], [eventsCount], [newsCount], [noticesCount]] = await Promise.all([
      query('SELECT count(*) as total FROM alumnus'),
      query('SELECT count(*) as total FROM events WHERE status = 1'),
      query('SELECT count(*) as total FROM news WHERE status = 1'),
      query('SELECT count(*) as total FROM notices WHERE status = 1')
    ]);

    // Events
    const events = await query(`
      SELECT e.id, e.title, e.slug, e.date, e.location, e.price, e.number_of_ticket,
             e.number_of_ticket_left, ec.name as category_name, fm.path as thumbnail_path
      FROM events e
      LEFT JOIN event_categories ec ON e.event_category_id = ec.id
      LEFT JOIN file_managers fm ON e.thumbnail = fm.id
      WHERE e.status = 1 AND e.deleted_at IS NULL
      ORDER BY e.date DESC LIMIT 6
    `);

    // News
    const news = await query(`
      SELECT n.id, n.title, n.slug, n.details, n.created_at, nc.name as category_name, fm.path as image_path
      FROM news n
      LEFT JOIN news_categories nc ON n.news_category_id = nc.id
      LEFT JOIN file_managers fm ON n.image = fm.id
      WHERE n.status = 1 AND n.deleted_at IS NULL
      ORDER BY n.created_at DESC LIMIT 6
    `);

    // Notices
    const notices = await query(`
      SELECT no.id, no.title, no.slug, no.details, no.created_at, noc.name as category_name, fm.path as image_path
      FROM notices no
      LEFT JOIN notice_categories noc ON no.notice_category_id = noc.id
      LEFT JOIN file_managers fm ON no.image = fm.id
      WHERE no.status = 1 AND no.deleted_at IS NULL
      ORDER BY no.created_at DESC LIMIT 6
    `);

    // Committee
    const committee = await query(`
      SELECT id, member_name, designation, photos, serial
      FROM org_committee
      ORDER BY serial ASC
    `);

    return res.secureJson({
      success: true,
      data: {
        stats: {
          alumniCount: alumniCount.total,
          eventsCount: eventsCount.total,
          newsCount: newsCount.total,
          noticesCount: noticesCount.total
        },
        events,
        news,
        notices,
        committee
      }
    });
  } catch (error) {
    console.error('getHomeData error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAlumni = async (req, res) => {
  try {
    const { search, batch_id, department_id, passing_year_id, page = 1, limit = 12 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereSql = 'WHERE u.status = 1 AND u.deleted_at IS NULL AND u.role = 2';
    const params = [];

    if (search) {
      whereSql += ' AND (u.name LIKE ? OR u.email LIKE ? OR a.company LIKE ? OR a.company_designation LIKE ? OR a.city LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
    }
    if (batch_id) {
      whereSql += ' AND a.batch_id = ?';
      params.push(batch_id);
    }
    if (department_id) {
      whereSql += ' AND a.department_id = ?';
      params.push(department_id);
    }
    if (passing_year_id) {
      whereSql += ' AND a.passing_year_id = ?';
      params.push(passing_year_id);
    }

    const countRows = await query(
      `SELECT count(*) as total
       FROM alumnus a
       JOIN users u ON a.user_id = u.id
       ${whereSql}`,
      params
    );
    const total = countRows[0].total;

    const listParams = [...params, parseInt(limit), offset];
    const alumni = await query(
      `SELECT a.id, a.user_id, u.name, u.email, u.mobile,
              a.company_designation as designation, a.company as company_name, a.city, a.blood_group,
              b.name as batch_name, d.name as department_name, py.name as passing_year_name,
              fm.path as avatar_path
       FROM alumnus a
       JOIN users u ON a.user_id = u.id
       LEFT JOIN batches b ON a.batch_id = b.id
       LEFT JOIN departments d ON a.department_id = d.id
       LEFT JOIN passing_years py ON a.passing_year_id = py.id
       LEFT JOIN file_managers fm ON u.image = fm.id
       ${whereSql}
       ORDER BY u.name ASC
       LIMIT ? OFFSET ?`,
      listParams
    );

    return res.secureJson({
      success: true,
      data: alumni,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('getAlumni error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAlumniDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await query(
      `SELECT a.*, u.name, u.email, u.mobile, u.created_at as joined_at,
              b.name as batch_name, d.name as department_name, py.name as passing_year_name,
              fm.path as avatar_path
       FROM alumnus a
       JOIN users u ON a.user_id = u.id
       LEFT JOIN batches b ON a.batch_id = b.id
       LEFT JOIN departments d ON a.department_id = d.id
       LEFT JOIN passing_years py ON a.passing_year_id = py.id
       LEFT JOIN file_managers fm ON u.image = fm.id
       WHERE a.id = ? OR a.user_id = ?
       LIMIT 1`,
      [id, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Alumnus not found' });
    }

    return res.secureJson({ success: true, data: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getMetadata = async (req, res) => {
  try {
    const [batches, departments, passingYears] = await Promise.all([
      query('SELECT id, name FROM batches ORDER BY name ASC'),
      query('SELECT id, name FROM departments ORDER BY name ASC'),
      query('SELECT id, name FROM passing_years ORDER BY name DESC')
    ]);

    return res.secureJson({
      success: true,
      batches,
      departments,
      passingYears
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getEvents = async (req, res) => {
  try {
    const events = await query(`
      SELECT e.*, ec.name as category_name, fm.path as thumbnail_path
      FROM events e
      LEFT JOIN event_categories ec ON e.event_category_id = ec.id
      LEFT JOIN file_managers fm ON e.thumbnail = fm.id
      WHERE e.status = 1 AND e.deleted_at IS NULL
      ORDER BY e.date DESC
    `);
    return res.secureJson({ success: true, events });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getEventDetail = async (req, res) => {
  try {
    const { slugOrId } = req.params;
    const rows = await query(`
      SELECT e.*, ec.name as category_name, fm.path as thumbnail_path
      FROM events e
      LEFT JOIN event_categories ec ON e.event_category_id = ec.id
      LEFT JOIN file_managers fm ON e.thumbnail = fm.id
      WHERE (e.slug = ? OR e.id = ?) AND e.deleted_at IS NULL
      LIMIT 1
    `, [slugOrId, slugOrId]);

    if (!rows.length) return res.status(404).json({ success: false, message: 'Event not found' });
    return res.secureJson({ success: true, event: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getNews = async (req, res) => {
  try {
    const news = await query(`
      SELECT n.*, nc.name as category_name, fm.path as image_path
      FROM news n
      LEFT JOIN news_categories nc ON n.news_category_id = nc.id
      LEFT JOIN file_managers fm ON n.image = fm.id
      WHERE n.status = 1 AND n.deleted_at IS NULL
      ORDER BY n.created_at DESC
    `);
    return res.secureJson({ success: true, news });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getNewsDetail = async (req, res) => {
  try {
    const { slugOrId } = req.params;
    const rows = await query(`
      SELECT n.*, nc.name as category_name, fm.path as image_path
      FROM news n
      LEFT JOIN news_categories nc ON n.news_category_id = nc.id
      LEFT JOIN file_managers fm ON n.image = fm.id
      WHERE (n.slug = ? OR n.id = ?) AND n.deleted_at IS NULL
      LIMIT 1
    `, [slugOrId, slugOrId]);

    if (!rows.length) return res.status(404).json({ success: false, message: 'News item not found' });
    return res.secureJson({ success: true, news: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getNotices = async (req, res) => {
  try {
    const notices = await query(`
      SELECT no.*, noc.name as category_name, fm.path as image_path
      FROM notices no
      LEFT JOIN notice_categories noc ON no.notice_category_id = noc.id
      LEFT JOIN file_managers fm ON no.image = fm.id
      WHERE no.status = 1 AND no.deleted_at IS NULL
      ORDER BY no.created_at DESC
    `);
    return res.secureJson({ success: true, notices });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getNoticeDetail = async (req, res) => {
  try {
    const { slugOrId } = req.params;
    const rows = await query(`
      SELECT no.*, noc.name as category_name, fm.path as image_path
      FROM notices no
      LEFT JOIN notice_categories noc ON no.notice_category_id = noc.id
      LEFT JOIN file_managers fm ON no.image = fm.id
      WHERE (no.slug = ? OR no.id = ?) AND no.deleted_at IS NULL
      LIMIT 1
    `, [slugOrId, slugOrId]);

    if (!rows.length) return res.status(404).json({ success: false, message: 'Notice not found' });
    return res.secureJson({ success: true, notice: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getCommittees = async (req, res) => {
  try {
    const members = await query('SELECT * FROM org_committee ORDER BY serial ASC');
    return res.secureJson({ success: true, members });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const submitContact = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'Name, email and message are required.' });
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await query(
      'INSERT INTO contact_us (name, email, phone, subject, message, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, email, phone || null, subject || 'General Inquiry', message, now, now]
    );

    return res.secureJson({ success: true, message: 'Your message has been sent successfully. We will contact you soon.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
