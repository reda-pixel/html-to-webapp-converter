import express from 'express';
import uploadRoutes from './upload.js';
import analyzeRoutes from './analyze.js';
import buildRoutes from './build.js';
import deployRoutes from './deploy.js';

const router = express.Router();

router.use('/upload', uploadRoutes);
router.use('/analyze', analyzeRoutes);
router.use('/build', buildRoutes);
router.use('/deploy', deployRoutes);

router.get('/', (req, res) => {
  res.json({
    message: 'HTML to WebApp Converter API',
    version: '1.0.0',
    endpoints: {
      upload: '/api/upload',
      analyze: '/api/analyze',
      build: '/api/build',
      deploy: '/api/deploy'
    }
  });
});

export default router;
