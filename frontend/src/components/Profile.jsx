import React, { useState, useEffect } from 'react';
import api from '../api';

const Profile = ({ onBack, setUsername: updateGlobalUsername }) => {
    const [formData, setFormData] = useState({
        username: '',
        bio: '',
        profilePic: '',
        customId: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const { data } = await api.get('/auth/profile');
                setFormData({
                    username: data.username,
                    bio: data.bio || '',
                    profilePic: data.profilePic || '',
                    customId: data.customId
                });
            } catch (err) {
                setError('Failed to fetch profile');
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            const { data } = await api.put('/auth/profile', formData);
            setSuccess('Profile updated successfully!');
            localStorage.setItem('username', data.username);
            updateGlobalUsername(data.username);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div style={{ color: 'white', textAlign: 'center', marginTop: '50px' }}>Loading...</div>;

    return (
        <div style={{ 
            height: '100vh', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            padding: '20px',
            backgroundColor: '#0f172a'
        }}>
            <div className="glass-panel" style={{ 
                width: '100%',
                maxWidth: '500px', 
                padding: '40px', 
                borderRadius: '24px',
                textAlign: 'left',
                position: 'relative'
            }}>
                <button 
                    onClick={onBack}
                    style={{ 
                        position: 'absolute', 
                        top: '20px', 
                        left: '20px', 
                        background: 'none', 
                        border: 'none', 
                        color: 'var(--text-muted)', 
                        cursor: 'pointer',
                        fontSize: '14px'
                    }}
                >
                    ← Back to Chat
                </button>

                <h2 style={{ marginBottom: '24px', fontSize: '28px', fontWeight: '800', textAlign: 'center', color: 'white' }}>
                    Edit Profile
                </h2>

                {error && (
                    <div style={{ 
                        backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                        color: 'var(--error)', 
                        padding: '12px', 
                        borderRadius: '12px', 
                        marginBottom: '20px',
                        fontSize: '14px',
                        border: '1px solid rgba(239, 68, 68, 0.2)'
                    }}>
                        {error}
                    </div>
                )}

                {success && (
                    <div style={{ 
                        backgroundColor: 'rgba(16, 185, 129, 0.1)', 
                        color: '#10b981', 
                        padding: '12px', 
                        borderRadius: '12px', 
                        marginBottom: '20px',
                        fontSize: '14px',
                        border: '1px solid rgba(16, 185, 129, 0.2)'
                    }}>
                        {success}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                        <div style={{ 
                            width: '80px', 
                            height: '80px', 
                            borderRadius: '50%', 
                            backgroundColor: '#6366f1', 
                            margin: '0 auto 12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '32px',
                            fontWeight: 'bold',
                            color: 'white'
                        }}>
                            {formData.username[0]?.toUpperCase()}
                        </div>
                        <div style={{ fontSize: '14px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            Pesu ID: <span style={{ color: '#6366f1', fontWeight: 'bold', fontSize: '16px' }}>{formData.customId || 'Generating...'}</span>
                            {formData.customId && (
                                <button 
                                    onClick={() => {
                                        navigator.clipboard.writeText(formData.customId);
                                        alert("ID copied to clipboard!");
                                    }}
                                    style={{ background: 'rgba(99, 102, 241, 0.1)', border: 'none', borderRadius: '4px', color: '#6366f1', padding: '2px 8px', fontSize: '10px', cursor: 'pointer' }}
                                >
                                    Copy
                                </button>
                            )}
                        </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: 'var(--text-muted)' }}>Username</label>
                        <input 
                            type="text" 
                            name="username" 
                            value={formData.username} 
                            onChange={handleChange} 
                            required 
                            style={{ 
                                width: '100%', 
                                padding: '12px 16px', 
                                borderRadius: '12px', 
                                border: '1px solid var(--border)', 
                                backgroundColor: 'rgba(255,255,255,0.05)',
                                color: 'white',
                                outline: 'none',
                                boxSizing: 'border-box'
                            }} 
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: 'var(--text-muted)' }}>Bio</label>
                        <textarea 
                            name="bio" 
                            value={formData.bio} 
                            onChange={handleChange} 
                            placeholder="Tell us about yourself..."
                            rows="3"
                            style={{ 
                                width: '100%', 
                                padding: '12px 16px', 
                                borderRadius: '12px', 
                                border: '1px solid var(--border)', 
                                backgroundColor: 'rgba(255,255,255,0.05)',
                                color: 'white',
                                outline: 'none',
                                boxSizing: 'border-box',
                                resize: 'none'
                            }} 
                        />
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: 'var(--text-muted)' }}>Profile Picture URL</label>
                        <input 
                            type="text" 
                            name="profilePic" 
                            value={formData.profilePic} 
                            onChange={handleChange} 
                            placeholder="https://example.com/image.jpg"
                            style={{ 
                                width: '100%', 
                                padding: '12px 16px', 
                                borderRadius: '12px', 
                                border: '1px solid var(--border)', 
                                backgroundColor: 'rgba(255,255,255,0.05)',
                                color: 'white',
                                outline: 'none',
                                boxSizing: 'border-box'
                            }} 
                        />
                    </div>

                    <button 
                        type="submit" 
                        disabled={saving}
                        style={{ 
                            width: '100%', 
                            padding: '14px', 
                            backgroundColor: 'var(--primary)', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '12px', 
                            fontWeight: '600',
                            fontSize: '16px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            opacity: saving ? 0.7 : 1
                        }}>
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Profile;
