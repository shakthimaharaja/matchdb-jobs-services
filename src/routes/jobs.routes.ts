import { Router } from 'express';
import {
  listJobs, listPublicProfiles, createJob, getJob, applyToJob, myApplications,
  vendorJobs, getProfile, createProfile, updateProfile, deleteProfile,
  candidateMatches, vendorCandidates, poke, closeJob, reopenJob,
} from '../controllers/jobs.controller';
import { requireAuth, requireVendor, requireCandidate } from '../middleware/auth.middleware';

const router = Router();

// Public
router.get('/', listJobs);
router.get('/profiles-public', listPublicProfiles);

// Candidate routes — ALL named paths BEFORE /:id
router.get('/my-applications', requireCandidate, myApplications);
router.get('/jobmatches', requireCandidate, candidateMatches);       // ranked jobs for candidate
router.get('/profile', requireAuth, getProfile);
router.post('/profile', requireCandidate, createProfile);
router.put('/profile', requireCandidate, updateProfile);
router.delete('/profile', requireCandidate, deleteProfile);

// Vendor routes — ALL named paths BEFORE /:id
router.get('/vendor', requireVendor, vendorJobs);
router.get('/profilematches', requireVendor, vendorCandidates);      // ranked candidates for vendor
router.post('/create', requireVendor, createJob);

// Shared
router.post('/poke', requireAuth, poke);

// Parameterized routes LAST
router.get('/:id', getJob);
router.post('/:id/apply', requireCandidate, applyToJob);
router.patch('/:id/close', requireVendor, closeJob);
router.patch('/:id/reopen', requireVendor, reopenJob);

export default router;
