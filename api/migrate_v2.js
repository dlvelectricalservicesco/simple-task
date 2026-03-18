const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

db.serialize(() => {
    // Add reminder_time column
    db.run("ALTER TABLE users ADD COLUMN reminder_time TEXT DEFAULT '08:00'", (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('reminder_time column already exists.');
            } else {
                console.error('Error adding reminder_time:', err.message);
            }
        } else {
            console.log('Added reminder_time column.');
        }
    });

    // Add last_reminder_sent column
    db.run("ALTER TABLE users ADD COLUMN last_reminder_sent TEXT", (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('last_reminder_sent column already exists.');
            } else {
                console.error('Error adding last_reminder_sent:', err.message);
            }
        } else {
            console.log('Added last_reminder_sent column.');
        }
    });
});

db.close();
