import express from 'express';
import {
  getSuperAdminDashboard,
  getPackages,
  savePackage,
  deletePackage,
  getTenants,
  getCustomDomains,
  updateCustomDomainStatus,
  getSubscribers,
  getEmailTemplates,
  getCurrencies,
  getLanguages,
  getGateways,
  getAdminDashboard,
  getAdminUsers,
  createAdminUser,
  updateUserStatus,
  getEventTransactions,
  getGalleries,
  saveGallery,
  deleteGallery,
  uploadGalleryPhoto,
  deleteGalleryPhoto,
  uploadSettingImage,
  getMembershipPlans,
  saveMembershipPlan,
  getEventsList,
  saveEvent,
  deleteEvent,
  getEventCategories,
  saveEventCategory,
  deleteEventCategory,
  getEventTickets,
  bookEventTicket,
  getNewsList,
  saveNews,
  deleteNews,
  getNoticesList,
  saveNotice,
  deleteNotice,
  getContactMessages,
  updateSettings,
  getBatches,
  saveBatch,
  deleteBatch,
  getDepartments,
  saveDepartment,
  deleteDepartment,
  getPassingYears,
  savePassingYear,
  getOrgCommittees,
  saveOrgCommittee,
  deleteOrgCommittee,
  reorderOrgCommittees,
  getJobs,
  saveJob,
  getModerators,
  getAdminSettings,
  getRegisterForm,
  saveRegisterForm,
  saveGateway,
  deletePassingYear,
  saveCurrency,
  getAppEmailTemplates,
  saveAppEmailTemplate
} from '../controllers/adminController.js';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(requireAuth, requireAdmin);

// Super Admin SaaS
router.get('/super/dashboard', getSuperAdminDashboard);
router.get('/super/packages', getPackages);
router.post('/super/packages', savePackage);
router.delete('/super/packages/:id', deletePackage);
router.get('/super/tenants', getTenants);
router.get('/super/domains', getCustomDomains);
router.put('/super/domains/:id/status', updateCustomDomainStatus);
router.get('/super/subscribers', getSubscribers);
router.get('/super/email-templates', getEmailTemplates);
router.get('/super/currencies', getCurrencies);
router.get('/super/languages', getLanguages);
router.get('/super/gateways', getGateways);

// Admin Portal Core
router.get('/dashboard', getAdminDashboard);
router.get('/users', getAdminUsers);
router.post('/users', createAdminUser);
router.put('/users/:id/status', updateUserStatus);
router.get('/messages', getContactMessages);
router.post('/settings', updateSettings);

// 1. Transactions & Event Revenue
router.get('/transactions/events', getEventTransactions);
router.get('/transactions/all', getEventTransactions);

// 2. Image Gallery & Photos
router.get('/galleries', getGalleries);
router.post('/galleries', saveGallery);
router.delete('/galleries/:id', deleteGallery);
router.post('/gallery-photos', uploadGalleryPhoto);
router.delete('/gallery-photos/:id', deleteGalleryPhoto);

// Image Upload Helper
router.post('/upload-image', uploadSettingImage);

// 3. Membership Management
router.get('/membership/plans', getMembershipPlans);
router.post('/membership/plans', saveMembershipPlan);

// 4. Events Management
router.get('/events', getEventsList);
router.post('/events', saveEvent);
router.delete('/events/:id', deleteEvent);
router.get('/event-categories', getEventCategories);
router.post('/event-categories', saveEventCategory);
router.delete('/event-categories/:id', deleteEventCategory);
router.get('/event-tickets', getEventTickets);
router.post('/event-tickets/book', bookEventTicket);

// 5. News Management
router.get('/news', getNewsList);
router.post('/news', saveNews);
router.delete('/news/:id', deleteNews);

// 6. Notices Management
router.get('/notices', getNoticesList);
router.post('/notices', saveNotice);
router.delete('/notices/:id', deleteNotice);

// 7. Academic & Settings
router.get('/settings', getAdminSettings);
router.post('/settings', updateSettings);

router.get('/register-form', getRegisterForm);
router.post('/register-form', saveRegisterForm);

router.get('/gateways', getGateways);
router.post('/gateways', saveGateway);

router.get('/currencies', getCurrencies);
router.post('/currencies', saveCurrency);

router.get('/email-templates', getAppEmailTemplates);
router.post('/email-templates', saveAppEmailTemplate);

router.get('/batches', getBatches);
router.post('/batches', saveBatch);
router.delete('/batches/:id', deleteBatch);

router.get('/departments', getDepartments);
router.post('/departments', saveDepartment);
router.delete('/departments/:id', deleteDepartment);

router.get('/passing-years', getPassingYears);
router.post('/passing-years', savePassingYear);
router.delete('/passing-years/:id', deletePassingYear);

router.get('/committees', getOrgCommittees);
router.post('/committees', saveOrgCommittee);
router.delete('/committees/:id', deleteOrgCommittee);
router.post('/committees/reorder', reorderOrgCommittees);

router.get('/jobs', getJobs);
router.post('/jobs', saveJob);

router.get('/moderators', getModerators);

export default router;
