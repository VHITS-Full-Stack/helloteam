import { Router } from 'express';
import { getAgreement, getAgreementPdf, signAgreement, saveAgreementDetails, getAgreementPreview } from '../controllers/agreement.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

// All onboarding routes require CLIENT auth but NOT onboarding completion
router.use(authenticate);
router.use(authorizeRoles(['CLIENT']));

// Get agreement details and status
router.get('/agreement', getAgreement);

// Get agreement PDF (authenticated stream)
router.get('/agreement/pdf', getAgreementPdf);

// Save business + payment details (draft)
router.post('/agreement/details', saveAgreementDetails);

// Get pre-filled agreement PDF preview
router.get('/agreement/preview', getAgreementPreview);

// Sign the agreement
router.post('/agreement/sign', signAgreement);

export default router;
