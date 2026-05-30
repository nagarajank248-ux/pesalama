import React, { useState, useEffect } from 'react';
import Auth from './components/Auth';
import Chat from './components/Chat';
import Profile from './components/Profile';

function App() {
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [username, setUsername] = useState(localStorage.getItem('username'));
    const [view, setView] = useState('chat'); // 'chat' or 'profile'

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        setToken(null);
        setUsername(null);
    };

    return (
        <div className="App">
            {!token ? (
                <Auth setToken={setToken} setUsername={setUsername} />
            ) : view === 'chat' ? (
                <Chat username={username} onLogout={handleLogout} onProfileClick={() => setView('profile')} />
            ) : (
                <Profile onBack={() => setView('chat')} setUsername={setUsername} />
            )}
        </div>
    );
}

export default App;
