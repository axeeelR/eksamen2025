const express = require('express');
const { getDatabase } = require('../database/instance.js');

const router = express.Router();
router.use(express.json());

router.get('/', async (req, res) => {
  try {
    const database = await getDatabase();
    const users = await database.readAll();
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ error: err?.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const database = await getDatabase();
    const user = req.body;
    const rowsAffected = await database.create(user);
    res.status(201).json({ rowsAffected });
  } catch (err) {
    res.status(500).json({ error: err?.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const database = await getDatabase();
    const userId = req.params.id;
    if (userId) {
      const result = await database.read(userId);
      res.status(200).json(result);
    } else {
      res.status(404);
    }
  } catch (err) {
    res.status(500).json({ error: err?.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const database = await getDatabase();
    const userId = req.params.id;
    const user = req.body;
    if (userId && user) {
      delete user.id;
      const rowsAffected = await database.update(userId, user);
      res.status(200).json({ rowsAffected });
    } else {
      res.status(404);
    }
  } catch (err) {
    res.status(500).json({ error: err?.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const database = await getDatabase();
    const userId = req.params.id;
    if (!userId) {
      res.status(404);
    } else {
      const rowsAffected = await database.delete(userId);
      res.status(204).json({ rowsAffected });
    }
  } catch (err) {
    res.status(500).json({ error: err?.message });
  }
});

module.exports = router;
