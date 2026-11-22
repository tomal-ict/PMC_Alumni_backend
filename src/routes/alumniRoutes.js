import express from 'express';
import {
  getAlumniDashboard,
  getCommunityPosts,
  createPost,
  toggleLike,
  getPostComments,
  addPostComment,
  getMyTickets,
  bookTicket
} from '../controllers/alumniPanelController.js';
import { requireAuth, optionalAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/dashboard', requireAuth, getAlumniDashboard);
router.get('/posts', optionalAuth, getCommunityPosts);
router.post('/posts', requireAuth, createPost);
router.post('/posts/like', requireAuth, toggleLike);
router.get('/posts/:postId/comments', optionalAuth, getPostComments);
router.post('/posts/comment', requireAuth, addPostComment);
router.get('/tickets', requireAuth, getMyTickets);
router.post('/tickets/book', requireAuth, bookTicket);

export default router;
