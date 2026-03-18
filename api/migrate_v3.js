const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

db.serialize(() => {
    // Users table additions
    db.run("ALTER TABLE users ADD COLUMN ui_theme TEXT DEFAULT 'light'", (err) => {
        if (err && !err.message.includes('duplicate column name')) console.error('Error adding ui_theme:', err.message);
        else console.log('Added ui_theme column to users.');
    });

    // Tasks table additions
    db.run("ALTER TABLE tasks ADD COLUMN priority TEXT DEFAULT 'Medium'", (err) => {
        if (err && !err.message.includes('duplicate column name')) console.error('Error adding priority:', err.message);
        else console.log('Added priority column to tasks.');
    });

    db.run("ALTER TABLE tasks ADD COLUMN subtasks TEXT DEFAULT '[]'", (err) => {
        if (err && !err.message.includes('duplicate column name')) console.error('Error adding subtasks:', err.message);
        else console.log('Added subtasks column to tasks.');
    });
});

db.close();
