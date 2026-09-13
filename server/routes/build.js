import express from 'express';

const router = express.Router();

// Build project
router.post('/', (req, res) => {
  const { projectId } = req.body;

  if (!projectId) {
    return res.status(400).json({ error: 'projectId is required' });
  }

  // TODO: Implement build logic
  // - Run npm install if needed
  // - Execute build command
  // - Generate dist/ or build/
  // - Return build logs and status

  res.json({
    status: 'building',
    message: 'Build endpoint is ready',
    projectId
  });
});

export default router;
