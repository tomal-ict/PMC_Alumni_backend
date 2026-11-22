import { query } from '../config/db.js';

// ==================== SUPER ADMIN CONTROLLERS ====================

export const getSuperAdminDashboard = async (req, res) => {
  try {
    const [
      [usersCount],
      [alumniCount],
      [packagesCount],
      [tenantsCount],
      [domainRequestsCount],
      [subscribersCount]
    ] = await Promise.all([
      query('SELECT count(*) as count FROM users WHERE deleted_at IS NULL'),
      query('SELECT count(*) as count FROM users WHERE role = 2 AND deleted_at IS NULL'),
      query('SELECT count(*) as count FROM packages WHERE deleted_at IS NULL'),
      query('SELECT count(*) as count FROM tenants'),
      query('SELECT count(*) as count FROM custom_domain_requests'),
      query('SELECT count(*) as count FROM news_subscription_letters WHERE deleted_at IS NULL')
    ]);

    const packages = await query('SELECT * FROM packages WHERE deleted_at IS NULL ORDER BY id ASC');
    const tenants = await query('SELECT * FROM tenants ORDER BY created_at DESC LIMIT 20');
    const domainRequests = await query(`
      SELECT cdr.*, u.name as user_name, u.email as user_email
      FROM custom_domain_requests cdr
      LEFT JOIN users u ON cdr.user_id = u.id
      ORDER BY cdr.created_at DESC
      LIMIT 20
    `);
    const orders = await query(`
      SELECT up.*, p.name as package_name, u.name as user_name, u.email as user_email
      FROM user_packages up
      LEFT JOIN packages p ON up.package_id = p.id
      LEFT JOIN users u ON up.user_id = u.id
      WHERE up.deleted_at IS NULL
      ORDER BY up.created_at DESC
      LIMIT 20
    `);

    return res.secureJson({
      success: true,
      stats: {
        totalUsers: usersCount.count,
        totalAlumni: alumniCount.count,
        activePackages: packagesCount.count,
        totalTenants: tenantsCount.count,
        totalDomainRequests: domainRequestsCount.count,
        totalSubscribers: subscribersCount.count
      },
      packages,
      tenants,
      orders,
      domainRequests
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getPackages = async (req, res) => {
  try {
    const packages = await query('SELECT * FROM packages WHERE deleted_at IS NULL ORDER BY id ASC');
    return res.secureJson({ success: true, packages });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const savePackage = async (req, res) => {
  try {
    const { id, name, alumni_limit, custom_domain, event_limit, monthly_price, yearly_price, status } = req.body;
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const slug = (name || 'plan').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();

    if (id) {
      await query(`
        UPDATE packages SET
          name = ?, alumni_limit = ?, custom_domain = ?, event_limit = ?,
          monthly_price = ?, yearly_price = ?, status = ?, updated_at = ?
        WHERE id = ?
      `, [name, alumni_limit || 500, custom_domain ? 1 : 0, event_limit || 10, monthly_price || 0, yearly_price || 0, status || 1, now, id]);
      return res.secureJson({ success: true, message: 'Package updated successfully.' });
    } else {
      await query(`
        INSERT INTO packages (name, slug, alumni_limit, custom_domain, event_limit, monthly_price, yearly_price, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [name, slug, alumni_limit || 500, custom_domain ? 1 : 0, event_limit || 10, monthly_price || 0, yearly_price || 0, status || 1, now, now]);
      return res.secureJson({ success: true, message: 'Package created successfully.' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deletePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await query('UPDATE packages SET deleted_at = ? WHERE id = ?', [now, id]);
    return res.secureJson({ success: true, message: 'Package deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getTenants = async (req, res) => {
  try {
    const tenants = await query('SELECT * FROM tenants ORDER BY created_at DESC');
    return res.secureJson({ success: true, tenants });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getCustomDomains = async (req, res) => {
  try {
    const domains = await query(`
      SELECT cdr.*, u.name as user_name, u.email as user_email
      FROM custom_domain_requests cdr
      LEFT JOIN users u ON cdr.user_id = u.id
      ORDER BY cdr.created_at DESC
    `);
    return res.secureJson({ success: true, domains });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCustomDomainStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await query('UPDATE custom_domain_requests SET status = ?, updated_at = NOW() WHERE id = ?', [status, id]);
    return res.secureJson({ success: true, message: 'Domain status updated.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getSubscribers = async (req, res) => {
  try {
    const subscribers = await query('SELECT * FROM news_subscription_letters WHERE deleted_at IS NULL ORDER BY created_at DESC');
    return res.secureJson({ success: true, subscribers });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getEmailTemplates = async (req, res) => {
  try {
    const templates = await query('SELECT * FROM subscription_email_templates WHERE deleted_at IS NULL ORDER BY id ASC');
    return res.secureJson({ success: true, templates });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getCurrencies = async (req, res) => {
  try {
    const currencies = await query('SELECT * FROM currencies ORDER BY id ASC');
    return res.secureJson({ success: true, currencies });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getLanguages = async (req, res) => {
  try {
    const languages = await query('SELECT * FROM languages WHERE deleted_at IS NULL ORDER BY id ASC');
    return res.secureJson({ success: true, languages });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getGateways = async (req, res) => {
  try {
    const gateways = await query('SELECT * FROM gateways WHERE deleted_at IS NULL ORDER BY id ASC');
    return res.secureJson({ success: true, gateways });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== ADMIN CONTROLLERS ====================

export const getAdminDashboard = async (req, res) => {
  try {
    const [
      [totalAlumni],
      [pendingAlumni],
      [totalEvents],
      [totalNews],
      [totalNotices],
      [totalMessages],
      [revenueStats]
    ] = await Promise.all([
      query('SELECT count(*) as count FROM users WHERE role = 2 AND status = 1 AND deleted_at IS NULL'),
      query('SELECT count(*) as count FROM users WHERE role = 2 AND status = 0 AND deleted_at IS NULL'),
      query('SELECT count(*) as count FROM events WHERE deleted_at IS NULL'),
      query('SELECT count(*) as count FROM news WHERE deleted_at IS NULL'),
      query('SELECT count(*) as count FROM notices WHERE deleted_at IS NULL'),
      query('SELECT count(*) as count FROM contact_us'),
      query('SELECT count(*) as totalTickets, COALESCE(sum(grand_total), 0) as totalRevenue FROM payments WHERE payment_status = 1')
    ]);

    const recentAlumni = await query(`
      SELECT u.id, u.name, u.email, u.mobile, u.status, u.created_at,
             b.name as batch_name, d.name as department_name, a.id_number as id_no
      FROM users u
      LEFT JOIN alumnus a ON u.id = a.user_id
      LEFT JOIN batches b ON a.batch_id = b.id
      LEFT JOIN departments d ON a.department_id = d.id
      WHERE u.role = 2 AND u.deleted_at IS NULL
      ORDER BY u.created_at DESC
      LIMIT 10
    `);

    return res.secureJson({
      success: true,
      stats: {
        totalAlumni: totalAlumni.count,
        pendingAlumni: pendingAlumni.count,
        totalEvents: totalEvents.count,
        totalNews: totalNews.count,
        totalNotices: totalNotices.count,
        totalMessages: totalMessages.count,
        totalRevenue: parseFloat(revenueStats.totalRevenue || 0),
        totalTickets: revenueStats.totalTickets || 0
      },
      recentAlumni
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 1. MANAGE ALUMNI & VERIFICATION / APPROVAL
export const getAdminUsers = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 100 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereSql = 'WHERE u.role = 2 AND u.deleted_at IS NULL';
    const params = [];

    if (status !== undefined && status !== '') {
      whereSql += ' AND u.status = ?';
      params.push(parseInt(status));
    }
    if (search) {
      whereSql += ' AND (u.name LIKE ? OR u.email LIKE ? OR u.mobile LIKE ? OR a.id_number LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    const [count] = await query(`SELECT count(*) as total FROM users u LEFT JOIN alumnus a ON u.id = a.user_id ${whereSql}`, params);
    const users = await query(`
      SELECT u.id, u.name, u.email, u.mobile, u.status, u.created_at,
             a.id as alumni_id, a.id_number as id_no, a.company_designation as designation, a.company as company_name,
             a.blood_group, a.city,
             b.name as batch_name, d.name as department_name, py.name as passing_year_name,
             fm.path as avatar_path
      FROM users u
      LEFT JOIN alumnus a ON u.id = a.user_id
      LEFT JOIN batches b ON a.batch_id = b.id
      LEFT JOIN departments d ON a.department_id = d.id
      LEFT JOIN passing_years py ON a.passing_year_id = py.id
      LEFT JOIN file_managers fm ON u.image = fm.id
      ${whereSql}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    return res.secureJson({
      success: true,
      users,
      pagination: {
        total: count.total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count.total / parseInt(limit))
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 1 = Approved, 0 = Pending, 2 = Suspended

    await query('UPDATE users SET status = ? WHERE id = ?', [status, id]);
    return res.secureJson({ success: true, message: `Alumni account ${status === 1 ? 'Approved & Activated' : 'Status Updated'} successfully.` });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 2. MANAGE TRANSACTIONS & EVENT REVENUE
export const getEventTransactions = async (req, res) => {
  try {
    const [revStats] = await query(`
      SELECT COALESCE(sum(grand_total), 0) as totalRevenue, count(*) as totalCount
      FROM payments
      WHERE payment_status = 1
    `);

    const transactions = await query(`
      SELECT p.id, p.tnxId, p.grand_total as amount, p.payment_currency, p.system_currency,
             p.payment_time, p.payment_status, p.created_at, p.deposit_slip,
             u.name as user_name, u.email as user_email, u.mobile as user_mobile,
             gw.title as gateway_title
      FROM payments p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN gateways gw ON p.gateway_id = gw.id
      ORDER BY p.created_at DESC
      LIMIT 100
    `);

    return res.secureJson({
      success: true,
      totalRevenue: parseFloat(revStats.totalRevenue || 0),
      totalCount: revStats.totalCount || 0,
      transactions
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 3. IMAGE GALLERY & ALBUMS
export const getGalleries = async (req, res) => {
  try {
    const galleries = await query(`
      SELECT pg.*, fm.path as banner_path,
             (SELECT count(*) FROM photos WHERE photo_gallery_id = pg.id) as total_photos
      FROM photo_galleries pg
      LEFT JOIN file_managers fm ON pg.photo = fm.id
      ORDER BY pg.id DESC
    `);

    const photos = await query(`
      SELECT p.*, fm.path as photo_url, pg.caption as gallery_caption
      FROM photos p
      LEFT JOIN file_managers fm ON p.image_path = fm.id
      LEFT JOIN photo_galleries pg ON p.photo_gallery_id = pg.id
      ORDER BY p.id DESC
      LIMIT 100
    `);

    return res.secureJson({
      success: true,
      galleries,
      photos
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const saveGallery = async (req, res) => {
  try {
    const { id, caption, status } = req.body;
    if (id) {
      await query('UPDATE photo_galleries SET caption = ?, status = ?, updated_at = NOW() WHERE id = ?', [caption, status || 1, id]);
      return res.secureJson({ success: true, message: 'Gallery updated.' });
    } else {
      await query('INSERT INTO photo_galleries (tenant_id, caption, status, created_at, updated_at) VALUES (1, ?, ?, NOW(), NOW())', [caption, status || 1]);
      return res.secureJson({ success: true, message: 'Gallery created.' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 4. MEMBERSHIP MANAGEMENT
export const getMembershipPlans = async (req, res) => {
  try {
    const plans = await query('SELECT * FROM membership_plans WHERE deleted_at IS NULL ORDER BY id ASC');
    const members = await query(`
      SELECT u.id, u.name, u.email, u.mobile, u.status, u.created_at,
             b.name as batch_name, d.name as department_name, a.id_number as id_no
      FROM users u
      LEFT JOIN alumnus a ON u.id = a.user_id
      LEFT JOIN batches b ON a.batch_id = b.id
      LEFT JOIN departments d ON a.department_id = d.id
      WHERE u.role = 2 AND u.status = 1
      ORDER BY u.name ASC
    `);

    return res.secureJson({
      success: true,
      plans,
      members
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const saveMembershipPlan = async (req, res) => {
  try {
    const { id, title, price, duration, duration_type, status } = req.body;
    const slug = (title || 'plan').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
    if (id) {
      await query(`
        UPDATE membership_plans SET title = ?, price = ?, duration = ?, duration_type = ?, status = ?, updated_at = NOW()
        WHERE id = ?
      `, [title, price || 0, duration || 1, duration_type || 2, status || 1, id]);
      return res.secureJson({ success: true, message: 'Membership plan updated.' });
    } else {
      await query(`
        INSERT INTO membership_plans (tenant_id, title, slug, badge, price, duration, duration_type, status, created_at, updated_at)
        VALUES (1, ?, ?, 1, ?, ?, ?, ?, NOW(), NOW())
      `, [title, slug, price || 0, duration || 1, duration_type || 2, status || 1]);
      return res.secureJson({ success: true, message: 'Membership plan created.' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 5. EVENT MANAGEMENT
export const getEventsList = async (req, res) => {
  try {
    const events = await query(`
      SELECT e.*, ec.name as category_name,
             (SELECT count(*) FROM event_tickets WHERE event_id = e.id) as tickets_sold_count
      FROM events e
      LEFT JOIN event_categories ec ON e.event_category_id = ec.id
      WHERE e.deleted_at IS NULL
      ORDER BY e.created_at DESC
    `);
    const categories = await query('SELECT * FROM event_categories ORDER BY id ASC');
    return res.secureJson({ success: true, events, categories });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const saveEvent = async (req, res) => {
  try {
    const { id, title, event_category_id, date, location, price, number_of_ticket, description, status } = req.body;
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const slug = (title || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();

    if (id) {
      await query(`
        UPDATE events SET
          title = ?, event_category_id = ?, date = ?, location = ?,
          price = ?, number_of_ticket = ?, description = ?, status = ?, updated_at = ?
        WHERE id = ?
      `, [title, event_category_id || 6, date, location, price || 0, number_of_ticket || 100, description, status || 1, now, id]);

      return res.secureJson({ success: true, message: 'Event updated successfully.' });
    } else {
      await query(`
        INSERT INTO events (title, slug, event_category_id, date, location, price, number_of_ticket, number_of_ticket_left, description, user_id, status, thumbnail, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `, [title, slug, event_category_id || 6, date, location, price || 0, number_of_ticket || 100, number_of_ticket || 100, description, req.user.id, status || 1, now, now]);

      return res.secureJson({ success: true, message: 'Event created successfully.' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await query('UPDATE events SET deleted_at = ? WHERE id = ?', [now, id]);
    return res.secureJson({ success: true, message: 'Event deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 6. NEWS MANAGEMENT
export const getNewsList = async (req, res) => {
  try {
    const news = await query(`
      SELECT n.*, nc.name as category_name
      FROM news n
      LEFT JOIN news_categories nc ON n.news_category_id = nc.id
      WHERE n.deleted_at IS NULL
      ORDER BY n.created_at DESC
    `);
    const categories = await query('SELECT * FROM news_categories ORDER BY id ASC');
    return res.secureJson({ success: true, news, categories });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const saveNews = async (req, res) => {
  try {
    const { id, title, news_category_id, details, status } = req.body;
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const slug = (title || 'news').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();

    if (id) {
      await query('UPDATE news SET title = ?, news_category_id = ?, details = ?, status = ?, updated_at = ? WHERE id = ?',
        [title, news_category_id || 1, details, status || 1, now, id]);
      return res.secureJson({ success: true, message: 'News updated successfully.' });
    } else {
      await query('INSERT INTO news (title, slug, news_category_id, details, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [title, slug, news_category_id || 1, details, status || 1, req.user.id, now, now]);
      return res.secureJson({ success: true, message: 'News created successfully.' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteNews = async (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await query('UPDATE news SET deleted_at = ? WHERE id = ?', [now, id]);
    return res.secureJson({ success: true, message: 'News deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 7. NOTICES MANAGEMENT
export const getNoticesList = async (req, res) => {
  try {
    const notices = await query(`
      SELECT n.*, nc.name as category_name
      FROM notices n
      LEFT JOIN notice_categories nc ON n.notice_category_id = nc.id
      WHERE n.deleted_at IS NULL
      ORDER BY n.created_at DESC
    `);
    const categories = await query('SELECT * FROM notice_categories ORDER BY id ASC');
    return res.secureJson({ success: true, notices, categories });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const saveNotice = async (req, res) => {
  try {
    const { id, title, notice_category_id, details, status } = req.body;
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const slug = (title || 'notice').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();

    if (id) {
      await query('UPDATE notices SET title = ?, notice_category_id = ?, details = ?, status = ?, updated_at = ? WHERE id = ?',
        [title, notice_category_id || 1, details, status || 1, now, id]);
      return res.secureJson({ success: true, message: 'Notice updated successfully.' });
    } else {
      await query('INSERT INTO notices (title, slug, notice_category_id, details, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [title, slug, notice_category_id || 1, details, status || 1, req.user.id, now, now]);
      return res.secureJson({ success: true, message: 'Notice created successfully.' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteNotice = async (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await query('UPDATE notices SET deleted_at = ? WHERE id = ?', [now, id]);
    return res.secureJson({ success: true, message: 'Notice deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 8. OTHER CORE ENTITIES
export const getContactMessages = async (req, res) => {
  try {
    const messages = await query('SELECT * FROM contact_us ORDER BY created_at DESC LIMIT 100');
    return res.secureJson({ success: true, messages });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSettings = async (req, res) => {
  try {
    const entries = Object.entries(req.body);
    for (const [key, val] of entries) {
      await query(
        'INSERT INTO settings (option_key, option_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE option_value = ?',
        [key, String(val), String(val)]
      );
    }
    return res.secureJson({ success: true, message: 'Settings saved successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getBatches = async (req, res) => {
  try {
    const batches = await query('SELECT * FROM batches ORDER BY id ASC');
    return res.secureJson({ success: true, batches });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const saveBatch = async (req, res) => {
  try {
    const { id, name, status } = req.body;
    if (id) {
      await query('UPDATE batches SET name = ?, status = ?, updated_at = NOW() WHERE id = ?', [name, status || 1, id]);
      return res.secureJson({ success: true, message: 'Batch updated.' });
    } else {
      await query('INSERT INTO batches (name, status, created_at, updated_at) VALUES (?, ?, NOW(), NOW())', [name, status || 1]);
      return res.secureJson({ success: true, message: 'Batch created.' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteBatch = async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM batches WHERE id = ?', [id]);
    return res.secureJson({ success: true, message: 'Batch deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getDepartments = async (req, res) => {
  try {
    const departments = await query('SELECT * FROM departments ORDER BY name ASC');
    return res.secureJson({ success: true, departments });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const saveDepartment = async (req, res) => {
  try {
    const { id, name, short_name, status } = req.body;
    if (id) {
      await query('UPDATE departments SET name = ?, short_name = ?, status = ?, updated_at = NOW() WHERE id = ?', [name, short_name || '', status || 1, id]);
      return res.secureJson({ success: true, message: 'Department updated.' });
    } else {
      await query('INSERT INTO departments (name, short_name, status, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())', [name, short_name || '', status || 1]);
      return res.secureJson({ success: true, message: 'Department created.' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM departments WHERE id = ?', [id]);
    return res.secureJson({ success: true, message: 'Department deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getPassingYears = async (req, res) => {
  try {
    const passingYears = await query('SELECT * FROM passing_years ORDER BY name DESC');
    return res.secureJson({ success: true, passingYears });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const savePassingYear = async (req, res) => {
  try {
    const { id, name, status } = req.body;
    if (id) {
      await query('UPDATE passing_years SET name = ?, status = ?, updated_at = NOW() WHERE id = ?', [name, status || 1, id]);
      return res.secureJson({ success: true, message: 'Passing Year updated.' });
    } else {
      await query('INSERT INTO passing_years (name, status, created_at, updated_at) VALUES (?, ?, NOW(), NOW())', [name, status || 1]);
      return res.secureJson({ success: true, message: 'Passing Year created.' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getOrgCommittees = async (req, res) => {
  try {
    const committee = await query('SELECT * FROM org_committee ORDER BY serial ASC');
    return res.secureJson({ success: true, committee });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const saveOrgCommittee = async (req, res) => {
  try {
    const { id, member_name, designation, photos, serial } = req.body;
    if (id) {
      await query('UPDATE org_committee SET member_name = ?, designation = ?, photos = ?, serial = ?, updated_at = NOW() WHERE id = ?',
        [member_name, designation, photos || '', serial || 1, id]);
      return res.secureJson({ success: true, message: 'Committee member updated.' });
    } else {
      await query('INSERT INTO org_committee (member_name, designation, photos, serial, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
        [member_name, designation, photos || '', serial || 1]);
      return res.secureJson({ success: true, message: 'Committee member added.' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getJobs = async (req, res) => {
  try {
    const jobs = await query('SELECT * FROM job_posts WHERE deleted_at IS NULL ORDER BY created_at DESC');
    return res.secureJson({ success: true, jobs });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const saveJob = async (req, res) => {
  try {
    const { id, title, location, salary, job_responsibility, application_deadline, employee_status, status } = req.body;
    const slug = (title || 'job').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
    if (id) {
      await query(`
        UPDATE job_posts SET
          title = ?, location = ?, salary = ?, job_responsibility = ?,
          application_deadline = ?, employee_status = ?, status = ?, updated_at = NOW()
        WHERE id = ?
      `, [title, location, salary, job_responsibility, application_deadline, employee_status || 'Full Time', status || 1, id]);
      return res.secureJson({ success: true, message: 'Job updated.' });
    } else {
      await query(`
        INSERT INTO job_posts (title, slug, location, salary, job_responsibility, application_deadline, employee_status, user_id, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [title, slug, location, salary, job_responsibility, application_deadline, employee_status || 'Full Time', req.user.id, status || 1]);
      return res.secureJson({ success: true, message: 'Job created.' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getModerators = async (req, res) => {
  try {
    const moderators = await query('SELECT id, name, email, role, status, created_at FROM users WHERE role = 1 AND deleted_at IS NULL');
    return res.secureJson({ success: true, moderators });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
