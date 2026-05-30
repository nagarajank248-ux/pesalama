import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';
import api from '../api';

const Chat = ({ username, onLogout, onProfileClick }) => {
    const [friends, setFriends] = useState([]);
    const [groups, setGroups] = useState([]);
    const [friendRequests, setFriendRequests] = useState([]);
    const [showRequests, setShowRequests] = useState(false);
    const [searchCustomId, setSearchCustomId] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [showUserInfo, setShowUserInfo] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [groupMembers, setGroupMembers] = useState([]);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [typingUser, setTypingUser] = useState(null);
    const [typingTimeout, setTypingTimeout] = useState(null);
    const [profileData, setProfileData] = useState(null);
    const [blockedUsers, setBlockedUsers] = useState([]);
    const socketRef = useRef();
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleTyping = () => {
        const targetUsername = selectedUser?.username;
        if (!targetUsername || selectedGroup || !socketRef.current) return;

        socketRef.current.emit('typing', { sender: username, receiver: targetUsername });

        if (typingTimeout) clearTimeout(typingTimeout);

        setTypingTimeout(setTimeout(() => {
            if (socketRef.current) {
                socketRef.current.emit('stop_typing', { sender: username, receiver: targetUsername });
            }
        }, 3000));
    };

    useEffect(() => {
        return () => {
            if (typingTimeout) clearTimeout(typingTimeout);
        };
    }, [typingTimeout]);

    useEffect(() => {
        socketRef.current = io('http://127.0.0.1:5000');
        socketRef.current.emit('register', username);

        socketRef.current.on('receive_message', (message) => {
            setMessages((prev) => {
                const targetUsername = selectedUser?.username;
                const isForCurrentChat = selectedGroup 
                    ? message.groupId === selectedGroup._id
                    : ((message.sender === username && message.receiver === targetUsername) ||
                       (message.sender === targetUsername && message.receiver === username));
                
                if (isForCurrentChat) {
                    return [...prev, message];
                }
                return prev;
            });

            const targetUsername = selectedUser?.username;
            if (!selectedGroup && message.receiver === username && message.sender === targetUsername) {
                socketRef.current.emit('mark_read', { messageId: message._id, sender: message.sender });
            }
        });

        socketRef.current.on('user_typing', (data) => {
            if (data.sender === selectedUser?.username) {
                setTypingUser(data.sender);
            }
        });

        socketRef.current.on('user_stop_typing', (data) => {
            if (data.sender === selectedUser?.username) {
                setTypingUser(null);
            }
        });

        socketRef.current.on('user_status_change', (data) => {
            setFriends(prev => prev.map(u => u.username === data.username ? { ...u, isOnline: data.isOnline, lastSeen: data.lastSeen } : u));
        });

        socketRef.current.on('message_read', (data) => {
            setMessages(prev => prev.map(m => m._id === data.messageId ? { ...m, status: 'read' } : m));
        });

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, [username, selectedUser, selectedGroup]);

    const fetchData = async () => {
        try {
            const [friendsRes, groupsRes, profileRes] = await Promise.all([
                api.get('/auth/friends'),
                api.get('/groups'),
                api.get('/auth/profile')
            ]);
            setFriends(friendsRes.data);
            setGroups(groupsRes.data);
            setProfileData(profileRes.data);
            setBlockedUsers(profileRes.data.blockedUsers || []);
            setFriendRequests(profileRes.data.friendRequests.filter(r => r.status === 'pending'));
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const sendRequest = async () => {
        if (!searchCustomId) return;
        try {
            await api.post('/auth/friend-request', { targetCustomId: searchCustomId });
            alert("Friend request sent!");
            setSearchCustomId('');
        } catch (err) {
            alert(err.response?.data?.error || "Error sending request");
        }
    };

    const respondRequest = async (fromUsername, action) => {
        try {
            await api.post('/auth/friend-request/respond', { fromUsername, action });
            fetchData(); // Refresh list
        } catch (err) {
            console.error(err);
        }
    };

    const handleBlock = async () => {
        if (!selectedUser) return;
        try {
            const isBlocked = blockedUsers.includes(selectedUser.username);
            if (isBlocked) {
                await api.post('/auth/unblock', { targetUsername: selectedUser.username });
                setBlockedUsers(prev => prev.filter(u => u !== selectedUser.username));
            } else {
                await api.post('/auth/block', { targetUsername: selectedUser.username });
                setBlockedUsers(prev => [...prev, selectedUser.username]);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteGroup = async () => {
        if (!selectedGroup) return;
        if (!window.confirm("Are you sure you want to delete this group?")) return;
        try {
            await api.delete(`/groups/${selectedGroup._id}`);
            setGroups(prev => prev.filter(g => g._id !== selectedGroup._id));
            setSelectedGroup(null);
            alert("Group deleted");
        } catch (err) {
            alert(err.response?.data?.error || "Failed to delete group");
        }
    };

    useEffect(() => {
        const fetchMessages = async () => {
            if (selectedGroup) {
                if (socketRef.current) socketRef.current.emit('join_group', selectedGroup._id);
                try {
                    const { data } = await api.get(`/messages/group/${selectedGroup._id}`);
                    setMessages(data);
                } catch (err) {
                    console.error(err);
                }
            } else if (selectedUser) {
                try {
                    const { data } = await api.get(`/messages/${selectedUser.username}`);
                    setMessages(data);

                    if (socketRef.current) {
                        data.forEach(m => {
                            if (m.receiver === username && m.status !== 'read') {
                                socketRef.current.emit('mark_read', { messageId: m._id, sender: m.sender });
                            }
                        });
                    }
                } catch (err) {
                    console.error(err);
                }
            }
        };
        fetchMessages();
    }, [selectedUser, selectedGroup, username]);

    const sendMessage = (e, imageData = null) => {
        if (e) e.preventDefault();
        const targetUsername = selectedUser?.username;
        if ((newMessage.trim() || imageData) && (targetUsername || selectedGroup)) {
            const messageData = {
                sender: username,
                text: imageData ? imageData : newMessage,
                messageType: imageData ? 'image' : 'text'
            };

            if (selectedGroup) {
                messageData.groupId = selectedGroup._id;
                socketRef.current.emit('send_group_message', messageData);
            } else {
                messageData.receiver = targetUsername;
                socketRef.current.emit('send_message', messageData);
            }

            setNewMessage('');
            setShowEmojiPicker(false);
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('image', file);

        try {
            const { data } = await api.post('/messages/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            sendMessage(null, data.url);
        } catch (err) {
            console.error("Upload error", err);
            alert("Failed to upload image");
        }
    };

    const createGroup = async () => {
        if (!groupName || groupMembers.length === 0) return;
        try {
            const { data } = await api.post('/groups', { name: groupName, members: groupMembers });
            setGroups(prev => [...prev, data]);
            setShowCreateGroup(false);
            setGroupName('');
            setGroupMembers([]);
        } catch (err) {
            console.error(err);
        }
    };

    const filteredFriends = friends.filter(u => 
        u.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const selectedUserData = friends.find(u => u.username === selectedUser?.username);

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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div 
                                onClick={onProfileClick}
                                style={{ 
                                    width: '32px', 
                                    height: '32px', 
                                    borderRadius: '50%', 
                                    backgroundColor: '#6366f1', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    fontSize: '14px', 
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    overflow: 'hidden'
                                }}
                            >
                                {username ? username[0].toUpperCase() : '?'}
                            </div>
                            <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>Pesuvoma</h2>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                             <button onClick={() => setShowRequests(!showRequests)} style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>
                                🔔 {friendRequests.length > 0 && <span style={{ position: 'absolute', top: -5, right: -5, backgroundColor: 'red', borderRadius: '50%', fontSize: '10px', padding: '2px 5px' }}>{friendRequests.length}</span>}
                             </button>
                             <button onClick={() => setShowCreateGroup(true)} style={{ color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>+</button>
                             <button onClick={onLogout} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}>Logout</button>
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                        <input 
                            type="text" 
                            placeholder="Add by ID..." 
                            value={searchCustomId}
                            onChange={(e) => setSearchCustomId(e.target.value)}
                            style={{ 
                                flex: 1, 
                                padding: '8px 12px', 
                                borderRadius: '10px', 
                                border: 'none', 
                                backgroundColor: '#334155', 
                                color: 'white',
                                outline: 'none'
                            }}
                        />
                        <button onClick={sendRequest} style={{ backgroundColor: '#6366f1', border: 'none', borderRadius: '10px', padding: '0 15px', color: 'white', cursor: 'pointer' }}>Add</button>
                    </div>

                    <div style={{ position: 'relative' }}>
                        <input 
                            type="text" 
                            placeholder="Search chats..." 
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
                    {showRequests && (
                        <div style={{ marginBottom: '20px', backgroundColor: '#33415550', borderRadius: '12px', padding: '10px' }}>
                            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '10px' }}>Requests</div>
                            {friendRequests.length === 0 ? <div style={{ fontSize: '12px', color: '#94a3b8' }}>No pending requests</div> : 
                                friendRequests.map(r => (
                                    <div key={r.from} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                        <span style={{ fontWeight: 'bold' }}>{r.from}</span>
                                        <div style={{ display: 'flex', gap: '5px' }}>
                                            <button onClick={() => respondRequest(r.from, 'accept')} style={{ backgroundColor: '#10b981', border: 'none', borderRadius: '5px', padding: '4px 8px', color: 'white', fontSize: '10px', cursor: 'pointer' }}>Accept</button>
                                            <button onClick={() => respondRequest(r.from, 'reject')} style={{ backgroundColor: '#ef4444', border: 'none', borderRadius: '5px', padding: '4px 8px', color: 'white', fontSize: '10px', cursor: 'pointer' }}>Reject</button>
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                    )}

                    <div style={{ padding: '10px', fontSize: '12px', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase' }}>Groups</div>
                    {groups.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase())).map(g => (
                        <div 
                            key={g._id} 
                            onClick={() => {
                                setSelectedGroup(g);
                                setSelectedUser(null);
                                setShowUserInfo(false);
                                setTypingUser(null);
                            }}
                            style={{ 
                                padding: '12px', 
                                borderRadius: '12px', 
                                cursor: 'pointer',
                                backgroundColor: selectedGroup?._id === g._id ? '#334155' : 'transparent',
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
                                backgroundColor: '#10b981',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '18px',
                                fontWeight: 'bold',
                                overflow: 'hidden'
                            }}>
                                {g.profilePic ? <img src={g.profilePic} style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : 'G'}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: '600' }}>{g.name}</div>
                                <div style={{ fontSize: '12px', color: '#94a3b8' }}>{g.members.length} members</div>
                            </div>
                        </div>
                    ))}

                    <div style={{ padding: '10px', fontSize: '12px', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '10px' }}>Friends</div>
                    {filteredFriends.map(u => (
                        <div 
                            key={u.username} 
                            onClick={() => {
                                setSelectedUser(u);
                                setSelectedGroup(null);
                                setShowUserInfo(false);
                                setTypingUser(null);
                            }}
                            style={{ 
                                padding: '12px', 
                                borderRadius: '12px', 
                                cursor: 'pointer',
                                backgroundColor: selectedUser?.username === u.username ? '#334155' : 'transparent',
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
                                backgroundColor: u.isOnline ? '#10b981' : '#6366f1',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '18px',
                                fontWeight: 'bold',
                                overflow: 'hidden'
                            }}>
                                {u.profilePic ? <img src={u.profilePic} style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : u.username[0].toUpperCase()}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: '600' }}>{u.username}</div>
                                <div style={{ fontSize: '12px', color: '#94a3b8' }}>{u.isOnline ? 'Online' : 'Offline'}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Chat Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#0f172a', position: 'relative' }}>
                {selectedUser || selectedGroup ? (
                    <>
                        <div 
                            onClick={() => setShowUserInfo(!showUserInfo)}
                            style={{ 
                                padding: '16px 24px', 
                                borderBottom: '1px solid #1e293b', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '12px',
                                backgroundColor: '#1e293b50',
                                cursor: 'pointer'
                            }}
                        >
                            <div style={{ 
                                width: '40px', 
                                height: '40px', 
                                borderRadius: '50%', 
                                backgroundColor: selectedGroup ? '#10b981' : (selectedUserData?.isOnline ? '#10b981' : '#6366f1'), 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                fontWeight: 'bold',
                                overflow: 'hidden'
                            }}>
                                {selectedGroup ? 'G' : (selectedUserData?.profilePic ? <img src={selectedUserData.profilePic} style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : selectedUser?.username?.[0].toUpperCase())}
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '16px' }}>{selectedGroup ? selectedGroup.name : selectedUser?.username}</h3>
                                <div style={{ fontSize: '12px', color: typingUser ? '#6366f1' : (selectedGroup ? '#94a3b8' : (selectedUserData?.isOnline ? '#10b981' : '#94a3b8')) }}>
                                    {selectedGroup ? `${selectedGroup.members.length} members` : (typingUser ? 'typing...' : (selectedUserData?.isOnline ? 'Online' : selectedUserData?.lastSeen ? `Last seen ${new Date(selectedUserData.lastSeen).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : 'Offline'))}
                                </div>
                            </div>
                        </div>

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
                                    {selectedGroup && m.sender !== username && <div style={{ fontSize: '10px', color: '#6366f1', marginBottom: '2px' }}>{m.sender}</div>}
                                    <div style={{ 
                                        padding: '10px 16px', 
                                        borderRadius: m.sender === username ? '16px 16px 2px 16px' : '16px 16px 16px 2px', 
                                        backgroundColor: m.sender === username ? '#6366f1' : '#334155',
                                        color: 'white',
                                        fontSize: '14px',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}>
                                        {m.messageType === 'image' ? (
                                            <img src={m.text} alt="chat" style={{ maxWidth: '100%', borderRadius: '8px', cursor: 'pointer' }} onClick={() => window.open(m.text, '_blank')} />
                                        ) : m.text}
                                    </div>
                                    <div style={{ 
                                        fontSize: '10px', 
                                        color: '#94a3b8', 
                                        marginTop: '4px', 
                                        display: 'flex', 
                                        justifyContent: m.sender === username ? 'flex-end' : 'flex-start',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        {m.sender === username && !selectedGroup && (
                                            <span style={{ color: m.status === 'read' ? '#60a5fa' : '#94a3b8' }}>
                                                {m.status === 'read' ? '✓✓' : '✓'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        <div style={{ position: 'relative' }}>
                            {showEmojiPicker && (
                                <div style={{ position: 'absolute', bottom: '100%', left: '20px', zIndex: 100 }}>
                                    <EmojiPicker 
                                        onEmojiClick={(emojiObject) => setNewMessage(prev => prev + emojiObject.emoji)}
                                        theme="dark"
                                    />
                                </div>
                            )}
                            <form onSubmit={sendMessage} style={{ padding: '20px', backgroundColor: '#1e293b50' }}>
                                <div style={{ display: 'flex', gap: '12px', backgroundColor: '#334155', padding: '8px', borderRadius: '16px', alignItems: 'center' }}>
                                    <button 
                                        type="button"
                                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                        style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '0 5px' }}
                                    >
                                        😊
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => fileInputRef.current.click()}
                                        style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '0 5px' }}
                                    >
                                        📎
                                    </button>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        onChange={handleImageUpload} 
                                        style={{ display: 'none' }} 
                                        accept="image/*"
                                    />
                                    <input 
                                        type="text" 
                                        value={newMessage} 
                                        onChange={(e) => {
                                            setNewMessage(e.target.value);
                                            handleTyping();
                                        }}
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
                        </div>
                    </>
                ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                        <div style={{ fontSize: '64px' }}>💬</div>
                        <h2>Select a chat to start messaging</h2>
                    </div>
                )}
            </div>

            {showCreateGroup && (
                <div style={{ 
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
                    backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 
                }}>
                    <div style={{ backgroundColor: '#1e293b', padding: '30px', borderRadius: '20px', width: '400px' }}>
                        <h2 style={{ marginTop: 0 }}>Create New Group</h2>
                        <input 
                            type="text" 
                            placeholder="Group Name" 
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: '#334155', color: 'white', marginBottom: '20px', boxSizing: 'border-box' }}
                        />
                        <div style={{ marginBottom: '10px', fontSize: '14px', color: '#94a3b8' }}>Select Members:</div>
                        <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '20px' }}>
                            {friends.map(u => (
                                <div key={u.username} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={groupMembers.includes(u.username)}
                                        onChange={(e) => {
                                            if (e.target.checked) setGroupMembers([...groupMembers, u.username]);
                                            else setGroupMembers(groupMembers.filter(m => m !== u.username));
                                        }}
                                    />
                                    <span>{u.username}</span>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowCreateGroup(false)} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', backgroundColor: '#334155', color: 'white', cursor: 'pointer' }}>Cancel</button>
                            <button onClick={createGroup} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', backgroundColor: '#6366f1', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>Create</button>
                        </div>
                    </div>
                </div>
            )}

            {showUserInfo && (
                <div style={{ 
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: '300px',
                    backgroundColor: '#1e293b',
                    borderLeft: '1px solid #334155',
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'slideIn 0.3s ease-out',
                    zIndex: 10
                }}>
                    <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '15px', borderBottom: '1px solid #334155' }}>
                        <button onClick={() => setShowUserInfo(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '18px' }}>✕</button>
                        <h3 style={{ margin: 0 }}>{selectedGroup ? 'Group Info' : 'Contact Info'}</h3>
                    </div>
                    <div style={{ padding: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <div style={{ 
                            width: '150px', 
                            height: '150px', 
                            borderRadius: '50%', 
                            backgroundColor: '#10b981', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            fontSize: '48px', 
                            fontWeight: 'bold',
                            marginBottom: '20px',
                            overflow: 'hidden'
                        }}>
                            {selectedGroup ? 'G' : (selectedUserData?.profilePic ? <img src={selectedUserData.profilePic} style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : selectedUser?.username?.[0].toUpperCase())}
                        </div>
                        <h2 style={{ margin: '0 0 5px 0' }}>{selectedGroup ? selectedGroup.name : selectedUser?.username}</h2>
                        <div style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '30px' }}>{selectedGroup ? `${selectedGroup.members.length} members` : (selectedUserData?.isOnline ? 'Online' : 'Offline')}</div>
                        
                        {selectedGroup ? (
                            <div style={{ width: '100%', textAlign: 'left', backgroundColor: '#0f172a', padding: '15px', borderRadius: '12px' }}>
                                <div style={{ color: '#6366f1', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', textTransform: 'uppercase' }}>Members</div>
                                <div style={{ maxHeight: '150px', overflowY: 'auto', marginBottom: '15px' }}>
                                    {selectedGroup.members.map(m => (
                                        <div key={m} style={{ fontSize: '14px', padding: '4px 0' }}>{m} {m === selectedGroup.admin && <span style={{fontSize: '10px', backgroundColor: '#6366f1', padding: '2px 6px', borderRadius: '4px', marginLeft: '5px'}}>Admin</span>}</div>
                                    ))}
                                </div>
                                {selectedGroup.admin === username && (
                                    <button onClick={handleDeleteGroup} style={{ width: '100%', padding: '10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Delete Group</button>
                                )}
                            </div>
                        ) : (
                            <>
                                <div style={{ width: '100%', textAlign: 'left', backgroundColor: '#0f172a', padding: '15px', borderRadius: '12px', marginBottom: '15px' }}>
                                    <div style={{ color: '#6366f1', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', textTransform: 'uppercase' }}>About</div>
                                    <div style={{ color: 'white', fontSize: '14px' }}>{selectedUserData?.bio || "Hey there! I'm using Pesuvoma."}</div>
                                </div>
                                <button 
                                    onClick={handleBlock} 
                                    style={{ 
                                        width: '100%', 
                                        padding: '12px', 
                                        backgroundColor: blockedUsers.includes(selectedUser?.username) ? '#10b981' : '#ef4444', 
                                        color: 'white', 
                                        border: 'none', 
                                        borderRadius: '12px', 
                                        cursor: 'pointer', 
                                        fontWeight: 'bold' 
                                    }}
                                >
                                    {blockedUsers.includes(selectedUser?.username) ? 'Unblock User' : 'Block User'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
            <style>{`
                @keyframes slideIn {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
            `}</style>
        </div>
    );
};

export default Chat;
