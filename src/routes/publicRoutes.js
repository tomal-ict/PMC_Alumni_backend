import express from 'express';
import {
  getSettings,
  getHomeData,
  getAlumni,
  getAlumniDetail,
  getMetadata,
  getEvents,
  getEventDetail,
  getNews,
  getNewsDetail,
  getNotices,
  getNoticeDetail,
  getCommittees,
  submitContact
} from '../controllers/publicController.js';

const router = express.Router();

router.get('/settings', getSettings);
router.get('/home', getHomeData);
router.get('/alumni', getAlumni);
router.get('/alumni/:id', getAlumniDetail);
router.get('/metadata', getMetadata);
router.get('/events', getEvents);
router.get('/events/:slugOrId', getEventDetail);
router.get('/news', getNews);
router.get('/news/:slugOrId', getNewsDetail);
router.get('/notices', getNotices);
router.get('/notices/:slugOrId', getNoticeDetail);
router.get('/committees', getCommittees);
router.post('/contact', submitContact);

export default router;
