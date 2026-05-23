import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import api from '../api';

const Chat = ({ username, onLogout }) => {
    const [users, setUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const socketRef = useRef();
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    useEffect(() => {
        socketRef.current = io('http://127.0.0.1:5000');
        socketRef.current.emit('register', username);

        socketRef.current.on('receive_message', (message) => {
            setMessages((prev) => {
                if (
                    (message.sender === username && message.receiver === selectedUser) ||
                    (message.sender === selectedUser && message.receiver === username)
                ) {
                    return [...prev, message];
                }
                return prev;
            });
        });

        return () => socketRef.current.disconnect();
    }, [username, selectedUser]);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const { data } = await api.get('/auth/users');
                setUsers(data);
            } catch (err) {
                console.error(err);
            }
        };
        fetchUsers();
    }, []);

    useEffect(() => {
        const fetchMessages = async () => {
            if (selectedUser) {
                try {
                    const { data } = await api.get(`/messages/${selectedUser}`);
                    setMessages(data);
                } catch (err) {
                    console.error(err);
                }
            }
        };
        fetchMessages();
    }, [selectedUser]);

    const sendMessage = (e) => {
        e.preventDefault();
        if (newMessage.trim() && selectedUser) {
            const messageData = {
                sender: username,
                receiver: selectedUser,
                text: newMessage
            };
            socketRef.current.emit('send_message', messageData);
            setNewMessage('');
        }
    };

    const filteredUsers = users.filter(u => 
        u.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', overflow: 'hidden' }}>
            {/* Sidebar */}
            <div style={{ 
                width: '350px', 
                borderRight: '1px solid #1e293b', 
                display: 'flex', 
                flexDirection: 'column',
                backgroundColor: '#1e293b50'
            }}>
                <div style={{ padding: '24px', borderBottom: '1px solid #1e293b' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2 style={{ fontSize: '24px', fontWeight: 'bold' }}>Chats</h2>
                        <button onClick={onLogout} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}>Logout</button>
                    </div>
                    <div style={{ position: 'relative' }}>
                        <input 
                            type="text" 
                            placeholder="Search users..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ 
                                width: '100%', 
                                padding: '10px 16px', 
                                borderRadius: '12px', 
                                border: 'none', 
                                backgroundColor: '#334155', 
                                color: 'white',
                                outline: 'none',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                    {filteredUsers.map(u => (
                        <div 
                            key={u.username} 
                            onClick={() => setSelectedUser(u.username)}
                            style={{ 
                                padding: '12px', 
                                borderRadius: '12px', 
                                cursor: 'pointer',
                                backgroundColor: selectedUser === u.username ? '#334155' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                transition: 'all 0.2s',
                                marginBottom: '4px'
                            }}
                        >
                            <div style={{ 
                                width: '48px', 
                                height: '48px', 
                                borderRadius: '50%', 
                                backgroundColor: '#6366f1',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '18px',
                                fontWeight: 'bold'
                            }}>
                                {u.username[0].toUpperCase()}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: '600' }}>{u.username}</div>
                                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Click to chat</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Chat Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#0f172a' }}>
                {selectedUser ? (
                    <>
                        {/* Chat Header */}
                        <div style={{ 
                            padding: '16px 24px', 
                            borderBottom: '1px solid #1e293b', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '12px',
                            backgroundColor: '#1e293b50'
                        }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                {selectedUser[0].toUpperCase()}
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '16px' }}>{selectedUser}</h3>
                                <div style={{ fontSize: '12px', color: '#10b981' }}>Online</div>
                            </div>
                        </div>

                        {/* Messages */}
                        <div style={{ 
                            flex: 1, 
                            padding: '24px', 
                            overflowY: 'auto', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '8px',
                            backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)',
                            backgroundSize: '20px 20px'
                        }}>
                            {messages.map((m, idx) => (
                                <div key={idx} style={{ 
                                    alignSelf: m.sender === username ? 'flex-end' : 'flex-start',
                                    maxWidth: '60%'
                                }}>
                                    <div style={{ 
                                        padding: '10px 16px', 
                                        borderRadius: m.sender === username ? '16px 16px 2px 16px' : '16px 16px 16px 2px', 
                                        backgroundColor: m.sender === username ? '#6366f1' : '#334155',
                                        color: 'white',
                                        fontSize: '14px',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}>
                                        {m.text}
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px', textAlign: m.sender === username ? 'right' : 'left' }}>
                                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <form onSubmit={sendMessage} style={{ padding: '20px', backgroundColor: '#1e293b50' }}>
                            <div style={{ display: 'flex', gap: '12px', backgroundColor: '#334155', padding: '8px', borderRadius: '16px' }}>
                                <input 
                                    type="text" 
                                    value={newMessage} 
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type a message..."
                                    style={{ 
                                        flex: 1, 
                                        padding: '8px 12px', 
                                        backgroundColor: 'transparent', 
                                        border: 'none', 
                                        color: 'white', 
                                        outline: 'none' 
                                    }}
                                />
                                <button type="submit" style={{ 
                                    backgroundColor: '#6366f1', 
                                    color: 'white', 
                                    border: 'none', 
                                    padding: '8px 20px', 
                                    borderRadius: '12px', 
                                    fontWeight: 'bold',
                                    cursor: 'pointer'
                                }}>Send</button>
                            </div>
                        </form>
                    </>
                ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                        <div style={{ fontSize: '64px' }}>💬</div>
                        <h2>Select a chat to start messaging</h2>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Chat;
