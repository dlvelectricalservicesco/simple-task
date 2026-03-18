const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

db.serialize(() => {
    db.run("ALTER TABLE users ADD COLUMN discord_webhook TEXT", (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('discord_webhook column already exists.');
            } else {
                console.error('Error adding discord_webhook:', err.message);
            }
        } else {
            console.log('Added discord_webhook column.');
        }
    });

    db.run("ALTER TABLE users ADD COLUMN telegram_id TEXT", (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('telegram_id column already exists.');
            } else {
                console.error('Error adding telegram_id:', err.message);
            }
        } else {
            console.log('Added telegram_id column.');
        }
    });
});

db.close();
