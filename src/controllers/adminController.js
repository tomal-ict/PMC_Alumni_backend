import { query } from '../config/db.js';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicUploadsDir = path.join(__dirname, '../../public/uploads');

// Safe Base64 Image Saver to disk and file_managers
export const saveBase64Image = async (base64String, subFolder = 'Setting', originalName = 'upload.jpg') => {
  if (!base64String || typeof base64String !== 'string') return null;
  if (!base64String.startsWith('data:image')) {
    return { path: base64String, id: null, url: base64String.startsWith('/') ? base64String : '/' + base64String };
  }

  const matches = base64String.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) return null;

  let ext = matches[1].toLowerCase();
  if (ext === 'jpeg') ext = 'jpg';
  if (ext.includes('svg')) ext = 'svg';
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');

  const targetDir = path.join(publicUploadsDir, subFolder);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const fileName = `${Date.now()}_${Math.floor(Math.random() * 100000)}.${ext}`;
  const filePath = path.join(targetDir, fileName);
  fs.writeFileSync(filePath, buffer);

  const relativePath = `uploads/${subFolder}/${fileName}`;
  const fileType = `image/${ext}`;
  const fileSize = buffer.length;

  const result = await query(
    `INSERT INTO file_managers (tenant_id, file_type, storage_type, original_name, file_name, user_id, path, extension, size, created_at, updated_at)
     VALUES (1, ?, 'local', ?, ?, 1, ?, ?, ?, NOW(), NOW())`,
    [fileType, originalName, fileName, relativePath, ext, String(fileSize)]
  );

  return {
    id: result.insertId,
    path: relativePath,
    url: `/uploads/${subFolder}/${fileName}`
  };
};

export const uploadSettingImage = async (req, res) => {
  try {
    const { image, folder = 'Setting', originalName = 'image.jpg' } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, message: 'No image provided.' });
    }
    const uploaded = await saveBase64Image(image, folder, originalName);
    if (!uploaded) {
      return res.status(400).json({ success: false, message: 'Invalid image format.' });
    }
    return res.secureJson({
      success: true,
      file_id: uploaded.id,
      file_path: uploaded.path,
      url: uploaded.url
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

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
      [totalAlumniRow],
      [activeAlumniRow],
      [pendingAlumniRow],
      [suspendedAlumniRow],
      [thisMonthAlumniRow],
      [lastMonthAlumniRow],
      [revenueStats],
      [thisMonthRevenueRow],
      [lastMonthRevenueRow],
      [pendingRevenueRow],
      [totalEvents],
      [totalNews],
      [totalNotices],
      [totalMessages]
    ] = await Promise.all([
      query('SELECT count(*) as count FROM users WHERE role = 2 AND deleted_at IS NULL'),
      query('SELECT count(*) as count FROM users WHERE role = 2 AND status = 1 AND deleted_at IS NULL'),
      query('SELECT count(*) as count FROM users WHERE role = 2 AND status = 0 AND deleted_at IS NULL'),
      query('SELECT count(*) as count FROM users WHERE role = 2 AND status NOT IN (0, 1) AND deleted_at IS NULL'),
      query("SELECT count(*) as count FROM users WHERE role = 2 AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01') AND deleted_at IS NULL"),
      query("SELECT count(*) as count FROM users WHERE role = 2 AND created_at >= DATE_FORMAT(NOW() - INTERVAL 1 MONTH, '%Y-%m-01') AND created_at < DATE_FORMAT(NOW(), '%Y-%m-01') AND deleted_at IS NULL"),
      query('SELECT count(*) as totalTickets, COALESCE(sum(grand_total), 0) as totalRevenue FROM payments WHERE payment_status = 1'),
      query("SELECT COALESCE(sum(grand_total), 0) as monthRevenue FROM payments WHERE payment_status = 1 AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')"),
      query("SELECT COALESCE(sum(grand_total), 0) as lastMonthRevenue FROM payments WHERE payment_status = 1 AND created_at >= DATE_FORMAT(NOW() - INTERVAL 1 MONTH, '%Y-%m-01') AND created_at < DATE_FORMAT(NOW(), '%Y-%m-01')"),
      query('SELECT count(*) as count, COALESCE(sum(grand_total), 0) as sum FROM payments WHERE payment_status = 0'),
      query('SELECT count(*) as count FROM events WHERE deleted_at IS NULL'),
      query('SELECT count(*) as count FROM news WHERE deleted_at IS NULL'),
      query('SELECT count(*) as count FROM notices WHERE deleted_at IS NULL'),
      query('SELECT count(*) as count FROM contact_us')
    ]);

    const totalAlumni = totalAlumniRow?.count || 0;
    const activeAlumni = activeAlumniRow?.count || 0;
    const pendingAlumni = pendingAlumniRow?.count || 0;
    const suspendedAlumni = suspendedAlumniRow?.count || 0;
    const thisMonthAlumni = thisMonthAlumniRow?.count || 0;
    const lastMonthAlumni = lastMonthAlumniRow?.count || 0;
    const totalRevenue = parseFloat(revenueStats?.totalRevenue || 0);
    const thisMonthRevenue = parseFloat(thisMonthRevenueRow?.monthRevenue || 0);
    const lastMonthRevenue = parseFloat(lastMonthRevenueRow?.lastMonthRevenue || 0);
    const pendingRevenue = parseFloat(pendingRevenueRow?.sum || 0);
    const approvalRate = totalAlumni > 0 ? Math.round((activeAlumni / totalAlumni) * 100) : 100;

    const [deptDist, batchDist, monthlyUsers, monthlyPayments, recentAlumni, recentTransactions] = await Promise.all([
      query(`
        SELECT d.id, d.name, COUNT(a.id) as count
        FROM departments d
        LEFT JOIN alumnus a ON d.id = a.department_id
        GROUP BY d.id, d.name
        HAVING count > 0
        ORDER BY count DESC
        LIMIT 6
      `),
      query(`
        SELECT b.id, b.name, COUNT(a.id) as count
        FROM batches b
        LEFT JOIN alumnus a ON b.id = a.batch_id
        GROUP BY b.id, b.name
        HAVING count > 0
        ORDER BY count DESC
        LIMIT 6
      `),
      query(`
        SELECT 
          DATE_FORMAT(created_at, '%Y-%m') as ym,
          DATE_FORMAT(created_at, '%b %Y') as label,
          COUNT(*) as count
        FROM users
        WHERE role = 2 AND deleted_at IS NULL
        GROUP BY ym, label
        ORDER BY ym DESC
        LIMIT 6
      `),
      query(`
        SELECT 
          DATE_FORMAT(created_at, '%Y-%m') as ym,
          DATE_FORMAT(created_at, '%b %Y') as label,
          COALESCE(SUM(grand_total), 0) as total,
          COUNT(*) as count
        FROM payments
        WHERE payment_status = 1
        GROUP BY ym, label
        ORDER BY ym DESC
        LIMIT 6
      `),
      query(`
        SELECT u.id, u.name, u.email, u.mobile, u.status, u.created_at,
               b.name as batch_name, d.name as department_name, a.id_number as id_no
        FROM users u
        LEFT JOIN alumnus a ON u.id = a.user_id
        LEFT JOIN batches b ON a.batch_id = b.id
        LEFT JOIN departments d ON a.department_id = d.id
        WHERE u.role = 2 AND u.deleted_at IS NULL
        ORDER BY u.created_at DESC
        LIMIT 10
      `),
      query(`
        SELECT p.id, COALESCE(p.tnxId, p.paymentId) as tnxId, p.grand_total as amount, p.payment_status,
          p.payment_time, p.created_at, u.name as user_name, u.email as user_email,
          g.title as gateway_title
        FROM payments p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN gateways g ON p.gateway_id = g.id
        ORDER BY p.id DESC
        LIMIT 8
      `)
    ]);

    return res.secureJson({
      success: true,
      stats: {
        totalAlumni,
        activeAlumni,
        pendingAlumni,
        suspendedAlumni,
        approvalRate,
        thisMonthAlumni,
        lastMonthAlumni,
        totalRevenue,
        thisMonthRevenue,
        lastMonthRevenue,
        pendingRevenue,
        totalTickets: revenueStats.totalTickets || 0,
        totalEvents: totalEvents.count,
        totalNews: totalNews.count,
        totalNotices: totalNotices.count,
        totalMessages: totalMessages.count
      },
      charts: {
        deptDist,
        batchDist,
        monthlyUsers: monthlyUsers.reverse(),
        monthlyPayments: monthlyPayments.reverse()
      },
      recentAlumni,
      recentTransactions
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
             a.blood_group, a.city, a.custom_fields, a.date_of_birth, a.gender, a.file as attachment_file,
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

export const createAdminUser = async (req, res) => {
  try {
    const {
      name,
      email,
      mobile,
      password,
      id_no,
      batch_id,
      department_id,
      passing_year_id,
      company,
      designation,
      blood_group,
      status = 1
    } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email are required.' });
    }

    const existing = await query('SELECT id FROM users WHERE email = ? LIMIT 1', [email.trim()]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
    }

    const defaultPass = password || 'pmc123456';
    const hashedPassword = await bcrypt.hash(defaultPass, 10);
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const userRes = await query(
      `INSERT INTO users (name, email, mobile, password, role, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 2, ?, ?, ?)`,
      [name.trim(), email.trim(), mobile || null, hashedPassword, status !== undefined ? parseInt(status) : 1, now, now]
    );

    const newUserId = userRes.insertId;

    await query(
      `INSERT INTO alumnus (user_id, batch_id, department_id, passing_year_id, id_number, company_designation, company, blood_group, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newUserId,
        batch_id || null,
        department_id || null,
        passing_year_id || null,
        id_no || null,
        designation || '',
        company || '',
        blood_group || null,
        now,
        now
      ]
    );

    return res.secureJson({
      success: true,
      message: 'Alumni member created successfully.',
      userId: newUserId
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
      SELECT pg.*, fm.path as banner_file_path,
             (SELECT count(*) FROM photos WHERE photo_gallery_id = pg.id) as total_photos
      FROM photo_galleries pg
      LEFT JOIN file_managers fm ON pg.photo = fm.id
      ORDER BY pg.id DESC
    `);

    const photos = await query(`
      SELECT p.*, fm.path as file_mgr_path, pg.caption as gallery_caption
      FROM photos p
      LEFT JOIN file_managers fm ON p.image_path = fm.id
      LEFT JOIN photo_galleries pg ON p.photo_gallery_id = pg.id
      ORDER BY p.id DESC
      LIMIT 300
    `);

    // Clean resolved URLs
    const enrichedGalleries = galleries.map(g => {
      let banner = null;
      if (g.banner_file_path) {
        banner = '/' + g.banner_file_path.replace(/^\/+/, '');
      }
      return { ...g, banner_path: banner };
    });

    const enrichedPhotos = photos.map(p => {
      let url = null;
      if (p.file_mgr_path) {
        url = '/' + p.file_mgr_path.replace(/^\/+/, '');
      } else if (p.image_path && typeof p.image_path === 'string' && p.image_path.includes('/')) {
        url = '/' + p.image_path.replace(/^\/+/, '');
      }
      return { ...p, photo_url: url };
    });

    return res.secureJson({
      success: true,
      galleries: enrichedGalleries,
      photos: enrichedPhotos
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const saveGallery = async (req, res) => {
  try {
    const { id, caption, status = 1, image } = req.body;
    let photoId = null;
    if (image && image.startsWith('data:image')) {
      const uploaded = await saveBase64Image(image, 'image-galleries', caption || 'album-cover.jpg');
      if (uploaded) photoId = uploaded.id;
    }

    if (id) {
      if (photoId) {
        await query('UPDATE photo_galleries SET caption = ?, photo = ?, status = ?, updated_at = NOW() WHERE id = ?', [caption, photoId, status, id]);
      } else {
        await query('UPDATE photo_galleries SET caption = ?, status = ?, updated_at = NOW() WHERE id = ?', [caption, status, id]);
      }
      return res.secureJson({ success: true, message: 'Gallery album updated.' });
    } else {
      await query('INSERT INTO photo_galleries (tenant_id, caption, photo, status, created_at, updated_at) VALUES (1, ?, ?, ?, NOW(), NOW())', [caption, photoId || 0, status]);
      return res.secureJson({ success: true, message: 'Gallery album created.' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteGallery = async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM photos WHERE photo_gallery_id = ?', [id]);
    await query('DELETE FROM photo_galleries WHERE id = ?', [id]);
    return res.secureJson({ success: true, message: 'Gallery album and photos deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const uploadGalleryPhoto = async (req, res) => {
  try {
    const { gallery_id, image, title = '' } = req.body;
    if (!gallery_id || !image) {
      return res.status(400).json({ success: false, message: 'Gallery ID and image are required.' });
    }

    const uploaded = await saveBase64Image(image, 'image-galleries', title || 'gallery-photo.jpg');
    if (!uploaded) {
      return res.status(400).json({ success: false, message: 'Invalid image format.' });
    }

    const result = await query(
      `INSERT INTO photos (photo_gallery_id, title, image_path, created_at, updated_at)
       VALUES (?, ?, ?, NOW(), NOW())`,
      [gallery_id, title || `Photo_${Date.now()}`, String(uploaded.id)]
    );

    return res.secureJson({
      success: true,
      message: 'Photo uploaded successfully.',
      photo: {
        id: result.insertId,
        photo_gallery_id: gallery_id,
        title: title || `Photo_${Date.now()}`,
        image_path: String(uploaded.id),
        photo_url: uploaded.url
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteGalleryPhoto = async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM photos WHERE id = ?', [id]);
    return res.secureJson({ success: true, message: 'Photo deleted successfully.' });
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
    const allVariants = await query('SELECT * FROM event_ticket_variants ORDER BY id ASC');

    const eventsWithVariants = events.map(ev => ({
      ...ev,
      variants: allVariants.filter(v => v.event_id === ev.id)
    }));

    return res.secureJson({ success: true, events: eventsWithVariants, categories });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const saveEvent = async (req, res) => {
  try {
    const { id, title, event_category_id, date, location, price, number_of_ticket, description, status, ticket_variants } = req.body;
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const slug = (title || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();

    let formattedDate = date;
    if (date && typeof date === 'string') {
      formattedDate = date.replace('T', ' ');
      if (formattedDate.length === 16) formattedDate += ':00';
    }

    let calcPrice = parseFloat(price) || 0;
    let calcTotalTickets = parseInt(number_of_ticket) || 100;

    if (Array.isArray(ticket_variants) && ticket_variants.length > 0) {
      calcTotalTickets = ticket_variants.reduce((sum, v) => sum + (parseInt(v.ticket_limit) || 0), 0);
      const prices = ticket_variants.map(v => parseFloat(v.price) || 0);
      calcPrice = Math.min(...prices);
    }

    let eventId = id ? parseInt(id) : null;

    if (eventId) {
      await query(`
        UPDATE events SET
          title = ?, event_category_id = ?, date = ?, location = ?,
          price = ?, number_of_ticket = ?, description = ?, status = ?, updated_at = ?
        WHERE id = ?
      `, [title, event_category_id || 6, formattedDate, location, calcPrice, calcTotalTickets, description, status !== undefined ? status : 1, now, eventId]);
    } else {
      const insertRes = await query(`
        INSERT INTO events (title, slug, event_category_id, date, location, price, number_of_ticket, number_of_ticket_left, description, user_id, status, thumbnail, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `, [title, slug, event_category_id || 6, formattedDate, location, calcPrice, calcTotalTickets, calcTotalTickets, description, req.user.id, status !== undefined ? status : 1, now, now]);
      eventId = insertRes.insertId;
    }

    // Save ticket variants
    if (Array.isArray(ticket_variants) && eventId) {
      const existingVariants = await query('SELECT id FROM event_ticket_variants WHERE event_id = ?', [eventId]);
      const incomingIds = ticket_variants.filter(v => v.id).map(v => parseInt(v.id));

      // Delete removed variants
      const toDelete = existingVariants.filter(ev => !incomingIds.includes(ev.id));
      for (const td of toDelete) {
        await query('DELETE FROM event_ticket_variants WHERE id = ?', [td.id]);
      }

      // Upsert incoming variants
      for (const v of ticket_variants) {
        if (!v.name || !v.name.trim()) continue;
        const vPrice = parseFloat(v.price) || 0;
        const vLimit = parseInt(v.ticket_limit) || 50;
        const vStatus = v.status || 'active';

        if (v.id) {
          await query(`
            UPDATE event_ticket_variants SET
              name = ?, price = ?, ticket_limit = ?, status = ?, updated_at = NOW()
            WHERE id = ? AND event_id = ?
          `, [v.name.trim(), vPrice, vLimit, vStatus, v.id, eventId]);
        } else {
          await query(`
            INSERT INTO event_ticket_variants (event_id, name, price, ticket_limit, sold, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, 0, ?, NOW(), NOW())
          `, [eventId, v.name.trim(), vPrice, vLimit, vStatus]);
        }
      }
    }

    return res.secureJson({ success: true, message: id ? 'Event updated successfully.' : 'Event created successfully.', eventId });
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

export const getEventCategories = async (req, res) => {
  try {
    const categories = await query(`
      SELECT ec.*,
             (SELECT count(*) FROM events WHERE event_category_id = ec.id AND deleted_at IS NULL) as total_events
      FROM event_categories ec
      ORDER BY ec.id ASC
    `);
    return res.secureJson({ success: true, categories });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const saveEventCategory = async (req, res) => {
  try {
    const { id, name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Category name is required.' });
    }
    if (id) {
      await query('UPDATE event_categories SET name = ?, updated_at = NOW() WHERE id = ?', [name.trim(), id]);
      return res.secureJson({ success: true, message: 'Event category updated successfully.' });
    } else {
      await query('INSERT INTO event_categories (tenant_id, name, created_at, updated_at) VALUES (1, ?, NOW(), NOW())', [name.trim()]);
      return res.secureJson({ success: true, message: 'Event category created successfully.' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteEventCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const [inUse] = await query('SELECT count(*) as count FROM events WHERE event_category_id = ? AND deleted_at IS NULL', [id]);
    if (inUse && inUse.count > 0) {
      return res.status(400).json({ success: false, message: `Cannot delete: ${inUse.count} events are linked to this category.` });
    }
    await query('DELETE FROM event_categories WHERE id = ?', [id]);
    return res.secureJson({ success: true, message: 'Event category deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getEventTickets = async (req, res) => {
  try {
    const { my_only } = req.query;
    let whereClauses = [];
    const params = [];

    if (my_only === '1' || my_only === 'true') {
      const currentUserId = req.user?.id || 1;
      whereClauses.push('et.user_id = ?');
      params.push(currentUserId);
      whereClauses.push('e.id IS NOT NULL');
      whereClauses.push('(e.deleted_at IS NULL)');
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const tickets = await query(`
      SELECT et.*, 
             COALESCE(e.title, CONCAT('PMC Alumni Event #', et.event_id)) as event_title, 
             COALESCE(e.date, et.created_at) as event_date, 
             COALESCE(e.location, 'PMC Campus / Auditorium') as event_location,
             COALESCE(e.price, ev.price, 0) as event_base_price,
             u.name as user_name, 
             u.email as user_email, 
             u.mobile as user_mobile,
             COALESCE(ev.name, 'Standard Admission Pass') as variant_name, 
             COALESCE(ev.price, e.price, 0) as variant_price
      FROM event_tickets et
      LEFT JOIN events e ON et.event_id = e.id
      LEFT JOIN users u ON et.user_id = u.id
      LEFT JOIN event_ticket_variants ev ON et.variant_id = ev.id
      ${whereSQL}
      ORDER BY et.id DESC
      LIMIT 100
    `, params);
    return res.secureJson({ success: true, tickets });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const bookEventTicket = async (req, res) => {
  try {
    const currentUserId = req.user?.id || 1;
    const { event_id, variant_id } = req.body;

    if (!event_id) {
      return res.status(400).json({ success: false, message: 'Event ID is required.' });
    }

    const events = await query('SELECT * FROM events WHERE id = ?', [event_id]);
    if (!events.length) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }
    const event = events[0];

    // Find variant
    let variant = null;
    if (variant_id) {
      const variants = await query('SELECT * FROM event_ticket_variants WHERE id = ? AND event_id = ?', [variant_id, event_id]);
      if (variants.length) variant = variants[0];
    }
    if (!variant) {
      const variants = await query('SELECT * FROM event_ticket_variants WHERE event_id = ? ORDER BY price ASC LIMIT 1', [event_id]);
      if (variants.length) variant = variants[0];
    }

    const ticketNumber = `${event.id}${Math.floor(10000 + Math.random() * 90000)}`;
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const result = await query(
      `INSERT INTO event_tickets (tenant_id, event_id, user_id, ticket_number, variant_id, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [event.tenant_id || 1, event.id, currentUserId, ticketNumber, variant?.id || null, now, now]
    );

    if (variant) {
      await query('UPDATE event_ticket_variants SET sold = sold + 1 WHERE id = ?', [variant.id]);
    }

    return res.secureJson({
      success: true,
      message: 'Ticket booked successfully!',
      ticket: {
        id: result.insertId,
        ticket_number: ticketNumber,
        event_title: event.title,
        variant_name: variant?.name || 'Standard Admission Pass',
        price: variant?.price || event.price || 0
      }
    });
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
    const payload = (req.body && typeof req.body.settings === 'object' && !Array.isArray(req.body.settings))
      ? req.body.settings
      : req.body;
    const entries = Object.entries(payload || {});
    for (const [key, rawVal] of entries) {
      if (rawVal === undefined || rawVal === null) continue;
      let val = rawVal;
      // If a Base64 image is passed for an image setting, save it to disk automatically!
      if (typeof val === 'string' && val.startsWith('data:image')) {
        const uploaded = await saveBase64Image(val, 'Setting', `${key}.jpg`);
        if (uploaded) {
          val = uploaded.path;
        }
      }

      const existing = await query('SELECT id FROM settings WHERE option_key = ?', [key]);
      if (existing.length > 0) {
        await query(
          'UPDATE settings SET option_value = ?, updated_at = NOW() WHERE option_key = ?',
          [String(val), key]
        );
      } else {
        await query(
          'INSERT INTO settings (tenant_id, option_key, option_value, created_at, updated_at) VALUES (1, ?, ?, NOW(), NOW())',
          [key, String(val)]
        );
      }
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

export const deletePassingYear = async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM passing_years WHERE id = ?', [id]);
    return res.secureJson({ success: true, message: 'Passing Year deleted.' });
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
    let photoPath = photos || '';

    // If photos is base64 data, save it to disk in public/org-committee
    if (photos && typeof photos === 'string' && photos.startsWith('data:image/')) {
      const matches = photos.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
      if (matches) {
        const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        const dataBuffer = Buffer.from(matches[2], 'base64');
        const filename = `org_${Date.now()}_${Math.floor(Math.random() * 10000)}.${ext}`;
        const targetDir = path.join(__dirname, '../../public/org-committee');
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        fs.writeFileSync(path.join(targetDir, filename), dataBuffer);
        photoPath = `org-committee/${filename}`;
      }
    }

    if (id) {
      await query(
        'UPDATE org_committee SET member_name = ?, designation = ?, photos = ?, serial = ?, updated_at = NOW() WHERE id = ?',
        [member_name, designation, photoPath, parseInt(serial) || 1, id]
      );
      return res.secureJson({ success: true, message: 'Committee member updated successfully.' });
    } else {
      let assignSerial = parseInt(serial);
      if (!assignSerial) {
        const [maxRow] = await query('SELECT COALESCE(MAX(serial), 0) + 1 AS nextSerial FROM org_committee');
        assignSerial = maxRow.nextSerial;
      }
      await query(
        'INSERT INTO org_committee (member_name, designation, photos, serial, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
        [member_name, designation, photoPath, assignSerial]
      );
      return res.secureJson({ success: true, message: 'Committee member added successfully.' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteOrgCommittee = async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM org_committee WHERE id = ?', [id]);
    return res.secureJson({ success: true, message: 'Committee member deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const reorderOrgCommittees = async (req, res) => {
  try {
    const { items } = req.body;
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item.id && item.serial !== undefined) {
          await query('UPDATE org_committee SET serial = ?, updated_at = NOW() WHERE id = ?', [parseInt(item.serial), item.id]);
        }
      }
    }
    const updated = await query('SELECT * FROM org_committee ORDER BY serial ASC');
    return res.secureJson({ success: true, message: 'Committee order updated.', committee: updated });
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

// ==================== CMS & SETTINGS CONTROLLERS ====================

export const getAdminSettings = async (req, res) => {
  try {
    const rows = await query('SELECT option_key, option_value FROM settings');
    const settings = {};
    rows.forEach(r => {
      settings[r.option_key] = r.option_value;
    });
    return res.secureJson({ success: true, settings });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getRegisterForm = async (req, res) => {
  try {
    const rows = await query('SELECT * FROM register_forms ORDER BY id DESC LIMIT 1');
    const form = rows.length > 0 ? rows[0] : null;
    if (form && form.custom_fields) {
      if (typeof form.custom_fields === 'string') {
        try {
          form.custom_fields = JSON.parse(form.custom_fields);
          if (typeof form.custom_fields === 'string') {
            form.custom_fields = JSON.parse(form.custom_fields);
          }
        } catch (e) {
          form.custom_fields = [];
        }
      }
    }
    return res.secureJson({ success: true, form });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const saveRegisterForm = async (req, res) => {
  try {
    const {
      id,
      enable_batch,
      enable_department,
      enable_passing_year,
      enable_role_number,
      enable_attachment,
      enable_date_of_birth,
      enable_gender,
      custom_fields
    } = req.body;
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const customFieldsJson = typeof custom_fields === 'string'
      ? custom_fields
      : JSON.stringify(custom_fields || []);

    const existing = await query('SELECT id FROM register_forms ORDER BY id DESC LIMIT 1');
    const targetId = id || (existing.length > 0 ? existing[0].id : null);

    if (targetId) {
      await query(`
        UPDATE register_forms SET
          enable_batch = ?,
          enable_department = ?,
          enable_passing_year = ?,
          enable_role_number = ?,
          enable_attachment = ?,
          enable_date_of_birth = ?,
          enable_gender = ?,
          custom_fields = ?,
          updated_at = ?
        WHERE id = ?
      `, [
        enable_batch ? 1 : 0,
        enable_department ? 1 : 0,
        enable_passing_year ? 1 : 0,
        enable_role_number ? 1 : 0,
        enable_attachment ? 1 : 0,
        enable_date_of_birth ? 1 : 0,
        enable_gender ? 1 : 0,
        customFieldsJson,
        now,
        targetId
      ]);
    } else {
      await query(`
        INSERT INTO register_forms (
          enable_batch, enable_department, enable_passing_year,
          enable_role_number, enable_attachment, enable_date_of_birth,
          enable_gender, custom_fields, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        enable_batch ? 1 : 0,
        enable_department ? 1 : 0,
        enable_passing_year ? 1 : 0,
        enable_role_number ? 1 : 0,
        enable_attachment ? 1 : 0,
        enable_date_of_birth ? 1 : 0,
        enable_gender ? 1 : 0,
        customFieldsJson,
        now,
        now
      ]);
    }
    return res.secureJson({ success: true, message: 'Registration form settings saved successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const saveGateway = async (req, res) => {
  try {
    const { id, slug, title, status, mode, url, key, secret } = req.body;
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    if (id) {
      await query(`
        UPDATE gateways SET
          title = ?,
          status = ?,
          mode = ?,
          url = ?,
          \`key\` = ?,
          secret = ?,
          updated_at = ?
        WHERE id = ?
      `, [title, status ? 1 : 0, mode || 1, url || '', key || '', secret || '', now, id]);
    } else if (slug) {
      await query(`
        UPDATE gateways SET
          title = ?,
          status = ?,
          mode = ?,
          url = ?,
          \`key\` = ?,
          secret = ?,
          updated_at = ?
        WHERE slug = ?
      `, [title, status ? 1 : 0, mode || 1, url || '', key || '', secret || '', now, slug]);
    }
    return res.secureJson({ success: true, message: 'Gateway updated successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const saveCurrency = async (req, res) => {
  try {
    const { id, currency_code, symbol, currency_placement, current_currency } = req.body;
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    if (current_currency == 1) {
      await query('UPDATE currencies SET current_currency = 0');
    }

    if (id) {
      await query(`
        UPDATE currencies SET
          currency_code = ?,
          symbol = ?,
          currency_placement = ?,
          current_currency = ?,
          updated_at = ?
        WHERE id = ?
      `, [currency_code, symbol, currency_placement || 'before', current_currency ? 1 : 0, now, id]);
      return res.secureJson({ success: true, message: 'Currency updated successfully.' });
    } else {
      await query(`
        INSERT INTO currencies (currency_code, symbol, currency_placement, current_currency, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [currency_code, symbol, currency_placement || 'before', current_currency ? 1 : 0, now, now]);
      return res.secureJson({ success: true, message: 'Currency created successfully.' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAppEmailTemplates = async (req, res) => {
  try {
    const templates = await query('SELECT * FROM email_templates WHERE deleted_at IS NULL ORDER BY id ASC');
    return res.secureJson({ success: true, templates });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const saveAppEmailTemplate = async (req, res) => {
  try {
    const { id, subject, body, status } = req.body;
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await query(`
      UPDATE email_templates SET
        subject = ?,
        body = ?,
        status = ?,
        updated_at = ?
      WHERE id = ?
    `, [subject, body, status !== undefined ? status : 1, now, id]);
    return res.secureJson({ success: true, message: 'Email template saved successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
