// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Habit = require('./models/Habit');

const app = express();
app.use(cors());
app.use(express.json());

// connect
mongoose.connect(process.env.MONGO_URI)
  .then(()=> console.log('Mongo connected'))
  .catch(err => {
    console.error('Mongo connection error:', err.message);
    process.exit(1);
  });

// utility: iso date string YYYY-MM-DD
const toISODate = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// compute streaks from completions array (strings 'YYYY-MM-DD')
function computeStreaks(completions) {
  // convert to Set for fast checks
  const set = new Set(completions);
  // compute current streak ending today (or latest completion)
  const today = new Date();
  let curDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let currentStreak = 0;
  while (set.has(toISODate(curDate))) {
    currentStreak++;
    curDate.setDate(curDate.getDate() - 1);
  }
  // compute longest streak by scanning sorted dates
  const sorted = Array.from(set).sort(); // ascending
  let longest = 0;
  let running = 0;
  let prev = null;
  for (const d of sorted) {
    if (!prev) {
      running = 1;
    } else {
      const pd = new Date(prev);
      const nd = new Date(d);
      const diff = (nd - pd) / (1000*60*60*24);
      if (diff === 1) running++;
      else running = 1;
    }
    if (running > longest) longest = running;
    prev = d;
  }
  return { currentStreak, longestStreak: longest };
}

// Routes

// GET /api/habits  -> returns habits with computed streaks
app.get('/api/habits', async (req, res) => {
  try {
    const habits = await Habit.find().sort({ createdAt: -1 });
    const enriched = habits.map(h => {
      const s = computeStreaks(h.completions || []);
      return {
        _id: h._id,
        name: h.name,
        description: h.description,
        completions: h.completions,
        createdAt: h.createdAt,
        currentStreak: s.currentStreak,
        longestStreak: s.longestStreak
      };
    });
    res.json(enriched);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/habits  -> create
app.post('/api/habits', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const h = new Habit({ name, description, completions: [] });
    await h.save();
    res.status(201).json(h);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/habits/:id
app.delete('/api/habits/:id', async (req, res) => {
  try {
    await Habit.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/habits/:id/mark  -> body: { date: 'YYYY-MM-DD' } or no body => marks today
app.post('/api/habits/:id/mark', async (req, res) => {
  try {
    const date = toISODate(req.body?.date || new Date());
    const h = await Habit.findById(req.params.id);
    if (!h) return res.status(404).json({ error: 'Not found' });
    if (!h.completions.includes(date)) {
      h.completions.push(date);
      // keep unique & sorted
      h.completions = Array.from(new Set(h.completions)).sort();
      await h.save();
    }
    res.json(h);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/habits/:id/unmark  -> body: { date: 'YYYY-MM-DD' } or no body => unmark today
app.post('/api/habits/:id/unmark', async (req, res) => {
  try {
    const date = toISODate(req.body?.date || new Date());
    const h = await Habit.findById(req.params.id);
    if (!h) return res.status(404).json({ error: 'Not found' });
    h.completions = (h.completions || []).filter(d => d !== date);
    await h.save();
    res.json(h);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log('Server running on', PORT));
