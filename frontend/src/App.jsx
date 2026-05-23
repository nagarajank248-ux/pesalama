import React, { useState, useEffect } from 'react';
import Auth from './components/Auth';
import Chat from './components/Chat';

function App() {
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [username, setUsername] = useState(localStorage.getItem('username'));

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
            ) : (
                <Chat username={username} onLogout={handleLogout} />
            )}
        </div>
    );
}

export default App;
