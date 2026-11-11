const express = require('express');
const calculateRewards = require('../../calculateRewards');

const router = express.Router();

router.post('/', (req, res, next) => {
  try {
    return res.json(calculateRewards(req.body));
  } catch (error) {
    if (error instanceof RangeError) {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
});

module.exports = router;
