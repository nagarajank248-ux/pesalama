import React, { useState, useEffect } from 'react';
import Auth from './components/Auth';
import Chat from './components/Chat';
import Profile from './components/Profile';

function App() {
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [username, setUsername] = useState(localStorage.getItem('username'));
    const [view, setView] = useState('chat');

    console.log("App state:", { hasToken: !!token, username, view });

    const handleLogout = () => {
        console.log("Logging out...");
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        setToken(null);
        setUsername(null);
    };

    if (token && !username) {
        console.warn("Token exists but username is missing. Force logout.");
        handleLogout();
    }

    return (
        <div className="App" style={{ backgroundColor: '#0f172a', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!token ? (
                <Auth setToken={setToken} setUsername={setUsername} />
            ) : view === 'chat' ? (
                <Chat username={username} onLogout={handleLogout} onProfileClick={() => setView('profile')} />
            ) : (
                <Profile onBack={() => setView('chat')} setUsername={setUsername} onLogout={handleLogout} />
            )}
        </div>
    );
}

export default App;
