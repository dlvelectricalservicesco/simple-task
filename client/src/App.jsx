import React, { useState, useEffect } from 'react';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';

function App() {
    const [user, setUser] = useState(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    };

    return (
        <div className="min-h-screen bg-transparent">
            {user ? (
                <Dashboard user={user} onLogout={handleLogout} />
            ) : (
                <Auth setUser={setUser} />
            )}
        </div>
    );
}

export default App;
