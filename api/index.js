const express = require('express');
const cors = require('cors');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

app.use(cors());
app.use(express.json());

// Database logic: Unify interface for Vercel Postgres and SQLite
let db;

if (process.env.POSTGRES_URL) {
    const { sql } = require('@vercel/postgres');
    db = {
        query: async (queryText, params) => {
            if (!params) return sql.query(queryText);
            // Replace ? with $1, $2, etc. for pg consistency if needed, 
            // but here we use the tag for safety when possible.
            // For endpoints using manual queries:
            return sql.query(queryText, params);
        },
        // Helper to handle the tagged template literals and regular queries
        sql: sql,
        type: 'postgres'
    };
} else {
    const sqlite3 = require('sqlite3').verbose();
    const sqliteDb = new sqlite3.Database('./database.sqlite');
    const runner = (method) => (sqlText, params = []) => new Promise((resolve, reject) => {
        // Simple conversion from $1, $2 to ? for SQLite compatibility if we were using pg-style params
        // But we'll stick to standard SQL where possible.
        sqliteDb[method](sqlText, params, function(err, result) {
            if (err) reject(err);
            else resolve(method === 'run' ? { lastID: this.lastID, changes: this.changes } : result);
        });
    });
    db = {
        run: runner('run'),
        all: runner('all'),
        get: runner('get'),
        query: async (sqlText, params) => {
            const method = sqlText.trim().toLowerCase().startsWith('select') ? 'all' : 'run';
            const rows = await runner(method)(sqlText, params);
            return { rows: Array.isArray(rows) ? rows : [rows] };
        },
        type: 'sqlite'
    };
}

// Initialize tables
const initDb = async () => {
    try {
        if (db.type === 'postgres') {
            await db.sql`CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                discord_webhook TEXT,
                telegram_id TEXT,
                reminder_time TEXT DEFAULT '08:00',
                last_reminder_sent TEXT,
                ui_theme TEXT DEFAULT 'light',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`;
            await db.sql`CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                title TEXT NOT NULL,
                description TEXT,
                due_date DATE,
                priority TEXT DEFAULT 'Medium',
                status TEXT DEFAULT 'Pending',
                subtasks TEXT DEFAULT '[]',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`;
            // Migration: Add status column if it doesn't exist
            try {
                await db.sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pending'`;
            } catch (e) {
                console.log('Status column might already exist or error adding it:', e.message);
            }
        } else {
            await db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                discord_webhook TEXT,
                telegram_id TEXT,
                reminder_time TEXT DEFAULT '08:00',
                last_reminder_sent TEXT,
                ui_theme TEXT DEFAULT 'light',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            await db.run(`CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                title TEXT NOT NULL,
                description TEXT,
                due_date DATE,
                priority TEXT DEFAULT 'Medium',
                status TEXT DEFAULT 'Pending',
                subtasks TEXT DEFAULT '[]',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`);
            // Migration for SQLite: Add status column if it doesn't exist
            try {
                await db.run("ALTER TABLE tasks ADD COLUMN status TEXT DEFAULT 'Pending'");
            } catch (e) {
                if (!e.message.includes('duplicate column name')) {
                    console.error('Error adding status column to SQLite:', e.message);
                }
            }
        }
        console.log(`[initDb] ${db.type === 'postgres' ? 'Postgres' : 'SQLite'} Database initialized`);
    } catch (err) {
        console.error('[initDb] Error initializing database:', err.message);
        if (db.type === 'sqlite') {
            console.error('[initDb] SQLite error might be due to read-only filesystem on Vercel.');
        }
    }
};

initDb();

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Auth Endpoints
app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
        if (db.type === 'postgres') {
            await db.sql`INSERT INTO users (name, email, password) VALUES (${name}, ${email}, ${hashedPassword})`;
        } else {
            await db.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, hashedPassword]);
        }
        res.status(201).json({ message: 'User registered' });
    } catch (err) {
        res.status(400).json({ error: 'Email already exists' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        let user;
        if (db.type === 'postgres') {
            const { rows } = await db.sql`SELECT * FROM users WHERE email = ${email}`;
            user = rows[0];
        } else {
            user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        }

        if (!user) return res.status(400).json({ error: 'User not found' });
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

        const token = jwt.sign({ id: user.id, name: user.name }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ 
            token, 
            user: { 
                id: user.id, 
                name: user.name, 
                email: user.email, 
                discord_webhook: user.discord_webhook, 
                telegram_id: user.telegram_id,
                reminder_time: user.reminder_time,
                ui_theme: user.ui_theme
            } 
        });
    } catch (err) {
        res.status(500).json({ error: 'Login failed' });
    }
});

app.put('/api/auth/settings', authenticateToken, async (req, res) => {
    const { discord_webhook, telegram_id, reminder_time, ui_theme } = req.body;
    try {
        if (db.type === 'postgres') {
            // Reset last_reminder_sent if the time is changed so it can trigger again for testing today
            await db.sql`UPDATE users SET 
                discord_webhook = ${discord_webhook}, 
                telegram_id = ${telegram_id}, 
                reminder_time = ${reminder_time}, 
                ui_theme = ${ui_theme},
                last_reminder_sent = CASE WHEN reminder_time = ${reminder_time} THEN last_reminder_sent ELSE NULL END
                WHERE id = ${req.user.id}`;
        } else {
            await db.run('UPDATE users SET discord_webhook = ?, telegram_id = ?, reminder_time = ?, ui_theme = ?, last_reminder_sent = CASE WHEN reminder_time = ? THEN last_reminder_sent ELSE NULL END WHERE id = ?', 
                [discord_webhook, telegram_id, reminder_time, ui_theme, reminder_time, req.user.id]);
        }
        res.json({ message: 'Settings updated' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

const sendExternalNotification = async (user, title, message) => {
    if (user.discord_webhook) {
        try {
            await axios.post(user.discord_webhook, {
                content: `**${title}**\n${message}`
            });
        } catch (err) {
            console.error('Discord notification failed:', err.message);
        }
    }
    
    if (user.telegram_id && process.env.TELEGRAM_BOT_TOKEN) {
        try {
            const botToken = process.env.TELEGRAM_BOT_TOKEN;
            await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                chat_id: user.telegram_id,
                text: `*${title}*\n${message}`,
                parse_mode: 'Markdown'
            });
        } catch (err) {
            console.error('Telegram notification failed:', err.message);
        }
    }
};

app.post('/api/auth/test-notification', authenticateToken, async (req, res) => {
    try {
        let user;
        if (db.type === 'postgres') {
            const result = await db.sql`SELECT * FROM users WHERE id = ${req.user.id}`;
            user = result.rows[0];
        } else {
            user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
        }
        
        await sendExternalNotification(user, 'SimpleTask Test', 'Ito ay isang test notification mula sa SimpleTask! 🚀');
        res.json({ message: 'Test notification sent' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to send test notification' });
    }
});

// Task Endpoints
app.get('/api/tasks', authenticateToken, async (req, res) => {
    try {
        let rows;
        if (db.type === 'postgres') {
            const result = await db.sql`SELECT * FROM tasks WHERE user_id = ${req.user.id} ORDER BY due_date ASC`;
            rows = result.rows;
        } else {
            rows = await db.all('SELECT * FROM tasks WHERE user_id = ? ORDER BY due_date ASC', [req.user.id]);
        }
        const parsedRows = (rows || []).map(r => ({
            ...r,
            subtasks: typeof r.subtasks === 'string' ? JSON.parse(r.subtasks) : (r.subtasks || [])
        }));
        res.json(parsedRows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/tasks', authenticateToken, async (req, res) => {
    const { title, description, due_date, status, priority, subtasks } = req.body;
    const subtasksArray = subtasks || [];
    const subtasksJson = JSON.stringify(subtasksArray);
    const finalDueDate = due_date === '' ? null : due_date;

    // Preventive check: Cannot mark as Completed if there are unfinished subtasks
    if (status === 'Completed' && subtasksArray.some(st => !st.completed)) {
        return res.status(400).json({ error: 'Cannot complete task with unfinished subtasks.' });
    }
    
    try {
        if (db.type === 'postgres') {
            await db.sql`INSERT INTO tasks (user_id, title, description, due_date, status, priority, subtasks) VALUES (${req.user.id}, ${title}, ${description}, ${finalDueDate}, ${status || 'Pending'}, ${priority || 'Medium'}, ${subtasksJson})`;
        } else {
            await db.run('INSERT INTO tasks (user_id, title, description, due_date, status, priority, subtasks) VALUES (?, ?, ?, ?, ?, ?, ?)', 
                [req.user.id, title, description, finalDueDate, status || 'Pending', priority || 'Medium', subtasksJson]);
        }
        res.status(201).json({ message: 'Task created' });
    } catch (err) {
        console.error('Error creating task:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
    const { title, description, due_date, status, priority, subtasks } = req.body;
    const subtasksArray = subtasks || [];
    const subtasksJson = JSON.stringify(subtasksArray);
    const finalDueDate = due_date === '' ? null : due_date;

    // Preventive check: Cannot mark as Completed if there are unfinished subtasks
    if (status === 'Completed' && subtasksArray.some(st => !st.completed)) {
        return res.status(400).json({ error: 'Cannot complete task with unfinished subtasks.' });
    }

    try {
        if (db.type === 'postgres') {
            await db.sql`UPDATE tasks SET title = ${title}, description = ${description}, due_date = ${finalDueDate}, status = ${status}, priority = ${priority}, subtasks = ${subtasksJson} WHERE id = ${req.params.id} AND user_id = ${req.user.id}`;
        } else {
            await db.run('UPDATE tasks SET title = ?, description = ?, due_date = ?, status = ?, priority = ?, subtasks = ? WHERE id = ? AND user_id = ?', 
                [title, description, finalDueDate, status, priority, subtasksJson, req.params.id, req.user.id]);
        }
        res.json({ message: 'Task updated' });
    } catch (err) {
        console.error('Error updating task:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
    try {
        if (db.type === 'postgres') {
            await db.sql`DELETE FROM tasks WHERE id = ${req.params.id} AND user_id = ${req.user.id}`;
        } else {
            await db.run('DELETE FROM tasks WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        }
        res.json({ message: 'Task deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/stats', authenticateToken, async (req, res) => {
    try {
        let stats;
        if (db.type === 'postgres') {
            const result = await db.sql`
                SELECT 
                    COUNT(*) as total,
                    COALESCE(SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END), 0) as completed,
                    COALESCE(SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END), 0) as pending,
                    COALESCE(SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END), 0) as in_progress
                FROM tasks 
                WHERE user_id = ${req.user.id}
            `;
            stats = result.rows[0];
        } else {
            stats = await db.get(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as in_progress
                FROM tasks 
                WHERE user_id = ?
            `, [req.user.id]);
        }
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/cron/reminders', async (req, res) => {
    const now = new Date();
    const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    const currentTime = phTime.toISOString().slice(11, 16);
    const todayStr = phTime.toISOString().slice(0, 10);

    const result = await checkReminders();
    res.json({ 
        message: 'Cron job executed', 
        server_time_utc: now.toISOString(),
        calculated_ph_time: currentTime,
        calculated_date: todayStr,
        users_processed: result?.users_processed || 0
    });
});

// Background Heartbeat for Daily Reminders
const checkReminders = async () => {
    // Get current time in Philippine Time (UTC+8)
    const now = new Date();
    const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    const currentTime = phTime.toISOString().slice(11, 16); // "HH:MM"
    const todayStr = phTime.toISOString().slice(0, 10); // "YYYY-MM-DD"

    console.log(`[Cron] Checking reminders for PH Time: ${currentTime}, Date: ${todayStr}`);

    try {
        let users;
        if (db.type === 'postgres') {
            const result = await db.sql`SELECT * FROM users WHERE reminder_time = ${currentTime} AND (last_reminder_sent IS NULL OR last_reminder_sent != ${todayStr})`;
            users = result.rows;
        } else {
            users = await db.all('SELECT * FROM users WHERE reminder_time = ? AND (last_reminder_sent IS NULL OR last_reminder_sent != ?)', [currentTime, todayStr]);
        }

        for (const user of users) {
            // Get pending/in-progress tasks
            let tasks;
            if (db.type === 'postgres') {
                const result = await db.sql`SELECT * FROM tasks WHERE user_id = ${user.id} AND (status = 'Pending' OR status = 'In Progress')`;
                tasks = result.rows;
            } else {
                tasks = await db.all('SELECT * FROM tasks WHERE user_id = ? AND (status = "Pending" OR status = "In Progress")', [user.id]);
            }

            if (tasks.length > 0) {
                const taskList = tasks.map(t => {
                    const statusEmoji = t.status === 'In Progress' ? '🚧' : '⏳';
                    return `- ${t.title} [${t.status}] ${statusEmoji}`;
                }).join('\n');
                
                const dateOptions = { month: 'long', day: 'numeric' };
                const formattedDate = phTime.toLocaleDateString('en-US', dateOptions);

                await sendExternalNotification(
                    user, 
                    `Daily Task Digest (${formattedDate}) 📅`, 
                    `Magandang araw, ${user.name}! Heto ang iyong mga gagawin para sa araw na ito:\n\n${taskList}\n\nKaya mo 'yan! 🚀`
                );
            }

            // Mark as sent
            if (db.type === 'postgres') {
                await db.sql`UPDATE users SET last_reminder_sent = ${todayStr} WHERE id = ${user.id}`;
            } else {
                await db.run('UPDATE users SET last_reminder_sent = ? WHERE id = ?', [todayStr, user.id]);
            }
        }
        return { users_processed: users.length };
    } catch (err) {
        console.error('Error in reminder heartbeat:', err.message);
        return { error: err.message };
    }
};

// Start Heartbeat (every minute)
// Start Heartbeat only in local environment
if (process.env.NODE_ENV !== 'production') {
    console.log('Local environment detected: Starting notification heartbeat');
    setInterval(checkReminders, 60000);
}

// For local running without Vercel Dev if needed
if (require.main === module) {
    app.listen(PORT, () => console.log(`Local server running on port ${PORT}`));
}

module.exports = app;
