import { useEffect, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function NewHabit({ onCreated }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return alert('Give your habit a name');
    try {
      const res = await axios.post(`${API}/api/habits`, { name: name.trim(), description: desc.trim() });
      onCreated(res.data);
      setName(''); setDesc('');
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };
  return (
    <form onSubmit={submit} style={{ marginBottom: 16 }}>
      <input placeholder="Habit name" value={name} onChange={e=>setName(e.target.value)} required />
      <input placeholder="Short description (optional)" value={desc} onChange={e=>setDesc(e.target.value)} />
      <button type="submit">Add Habit</button>
    </form>
  );
}

function HabitItem({ habit, onDeleted, onMarked, onUnmarked }) {
  const [isMarking, setIsMarking] = useState(false);
  const todayISO = dayjs().format('YYYY-MM-DD');
  const doneToday = (habit.completions || []).includes(todayISO);

  const toggleToday = async () => {
    try {
      if (doneToday) {
        await axios.post(`${API}/api/habits/${habit._id}/unmark`);
        onUnmarked(habit._id, todayISO);
      } else {
        await axios.post(`${API}/api/habits/${habit._id}/mark`);
        onMarked(habit._id, todayISO);
      }
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const remove = async () => {
    if (!confirm('Delete this habit?')) return;
    await axios.delete(`${API}/api/habits/${habit._id}`);
    onDeleted(habit._id);
  };

  return (
    <div style={{ border: '1px solid #ddd', padding: 12, marginBottom: 8, borderRadius: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <strong>{habit.name}</strong>
          <div style={{ fontSize: 13, color: '#555' }}>{habit.description}</div>
          <div style={{ marginTop: 6, fontSize: 13 }}>
            Current streak: <b>{habit.currentStreak ?? 0}</b> • Longest: <b>{habit.longestStreak ?? 0}</b>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <button onClick={toggleToday} disabled={isMarking}>
            {doneToday ? 'Unmark Today' : 'Mark Today'}
          </button>
          <div style={{ marginTop: 8 }}>
            <button onClick={remove} style={{ color: 'red' }}>Delete</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [habits, setHabits] = useState([]);

  const fetch = async () => {
    try {
      const res = await axios.get(`${API}/api/habits`);
      setHabits(res.data);
    } catch (err) {
      alert('Failed to fetch: ' + (err.response?.data?.error || err.message));
    }
  };

  useEffect(()=>{ fetch(); }, []);

  const addLocal = (h) => setHabits(prev => [h, ...prev]);
  const delLocal = (id) => setHabits(prev => prev.filter(p => p._id !== id));
  const markLocal = (id, date) => setHabits(prev => prev.map(h => {
    if (h._id !== id) return h;
    const completions = Array.from(new Set([...(h.completions||[]), date])).sort();
    // Recompute basic streaks client-side (optional), but server will return updated values on refetch
    return { ...h, completions };
  }));
  const unmarkLocal = (id, date) => setHabits(prev => prev.map(h => {
    if (h._id !== id) return h;
    const completions = (h.completions || []).filter(d => d !== date);
    return { ...h, completions };
  }));

  return (
    <div style={{ maxWidth: 760, margin: '20px auto', padding: 16 }}>
      <h1>Habit Tracker — Streaks</h1>
      <NewHabit onCreated={addLocal} />
      <div style={{ marginBottom: 12 }}>
        <button onClick={fetch}>Refresh</button>
      </div>

      <div>
        {habits.length === 0 ? <div>No habits yet — add one above.</div> : null}
        {habits.map(h => (
          <HabitItem key={h._id} habit={h} onDeleted={delLocal} onMarked={markLocal} onUnmarked={unmarkLocal} />
        ))}
      </div>
      <div style={{ marginTop: 24, fontSize: 13, color: '#666' }}>
        Tip: Click "Mark Today" after you complete the habit. The app stores completions by day and shows your current streak.
      </div>
    </div>
  );
}
