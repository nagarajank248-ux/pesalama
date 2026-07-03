import React, { useState, useEffect } from 'react';
import api from '../api';

const Profile = ({ onBack, setUsername: updateGlobalUsername, onLogout }) => {
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
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => setSuccess(''), 3000);
            return () => clearTimeout(timer);
        }
    }, [success]);

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
            const { data } = await api.put('/auth/profile', {
                username: formData.username,
                bio: formData.bio,
                profilePic: formData.profilePic
            });
            setSuccess('Profile updated successfully!');
            localStorage.setItem('username', data.username);
            updateGlobalUsername(data.username);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const uploadFormData = new FormData();
        uploadFormData.append('image', file);

        setSaving(true);
        try {
            const { data } = await api.post('/auth/profile-pic', uploadFormData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setFormData(prev => ({ ...prev, profilePic: data.profilePic }));
            setSuccess('Profile picture updated!');
        } catch (err) {
            setError('Failed to upload profile picture');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div style={{ color: 'white', textAlign: 'center', marginTop: '50px' }}>Loading...</div>;

    const isDesktop = windowWidth >= 768;

    return (
        <div className="profile-container" style={{ 
            minHeight: '100vh', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            padding: isDesktop ? '40px' : '20px',
            backgroundColor: '#0f172a',
            boxSizing: 'border-box',
            position: 'relative'
        }}>
            {/* Sleek Floating Toast Notification */}
            {success && (
                <div style={{
                    position: 'fixed',
                    top: '24px',
                    right: '24px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    padding: '16px 24px',
                    borderRadius: '16px',
                    boxShadow: '0 10px 25px rgba(16, 185, 129, 0.3)',
                    zIndex: 10000,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    animation: 'toastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    border: '1px solid rgba(255,255,255,0.1)'
                }}>
                    <span style={{ fontSize: '18px' }}>✅</span>
                    <span>{success}</span>
                </div>
            )}
            <div className="glass-panel profile-card" style={{ 
                width: '100%',
                maxWidth: '900px', 
                borderRadius: '24px',
                position: 'relative',
                backgroundColor: '#1e293b',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.05)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxSizing: 'border-box'
            }}>
                {/* Header Action Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 30px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <button 
                        onClick={onBack}
                        style={{ 
                            background: 'none', 
                            border: 'none', 
                            color: '#94a3b8', 
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '700',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'color 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.color = 'white'}
                        onMouseLeave={(e) => e.target.style.color = '#94a3b8'}
                    >
                        ← Back to Chat
                    </button>

                    <button 
                        onClick={onLogout}
                        style={{ 
                            background: 'none', 
                            border: 'none', 
                            color: '#ef4444', 
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '700',
                            transition: 'opacity 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.opacity = '0.8'}
                        onMouseLeave={(e) => e.target.style.opacity = '1'}
                    >
                        Logout
                    </button>
                </div>

                {/* Main Content Area */}
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: isDesktop ? '1fr 1.3fr' : '1fr',
                    gap: '30px',
                    padding: '30px',
                    boxSizing: 'border-box'
                }}>
                    {/* Left Column: Visual Profile Preview */}
                    <div style={{ 
                        backgroundColor: '#0f172a',
                        borderRadius: '16px',
                        padding: '30px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid rgba(255,255,255,0.02)',
                        textAlign: 'center',
                        boxSizing: 'border-box'
                    }}>
                        <div 
                            onClick={() => document.getElementById('profilePicInput').click()}
                            style={{ 
                                width: '130px', 
                                height: '130px', 
                                borderRadius: '50%', 
                                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                                margin: '0 auto 16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '52px',
                                fontWeight: 'bold',
                                color: 'white',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                border: '4px solid #334155',
                                position: 'relative',
                                boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.3)'
                            }}
                        >
                            {formData.profilePic ? (
                                <img src={formData.profilePic} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                formData.username ? formData.username[0]?.toUpperCase() : '?'
                            )}
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '10px', padding: '6px 0', fontWeight: 'bold' }}>Change Photo</div>
                        </div>
                        <input type="file" id="profilePicInput" style={{ display: 'none' }} onChange={handleFileChange} accept="image/*" />
                        
                        <h3 style={{ margin: '0 0 4px 0', fontSize: '22px', fontWeight: '800', background: 'linear-gradient(to right, #ffffff, #c7d2fe)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            {formData.username || 'Your Name'}
                        </h3>
                        
                        <div style={{ fontSize: '13px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0 16px 0', backgroundColor: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            Pesu ID: <span style={{ color: '#818cf8', fontWeight: '700' }}>{formData.customId || 'Generating...'}</span>
                            {formData.customId && (
                                <button 
                                    type="button"
                                    onClick={() => {
                                        navigator.clipboard.writeText(formData.customId);
                                        alert("ID copied to clipboard!");
                                    }}
                                    style={{ background: 'rgba(99, 102, 241, 0.1)', border: 'none', borderRadius: '4px', color: '#818cf8', padding: '2px 8px', fontSize: '10px', cursor: 'pointer', fontWeight: 'bold' }}
                                >
                                    Copy
                                </button>
                            )}
                        </div>

                        <div style={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '15px' }}>
                            <div style={{ fontSize: '11px', color: '#6366f1', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '8px', letterSpacing: '0.05em' }}>Bio Preview</div>
                            <p style={{ color: '#cbd5e1', fontSize: '13px', margin: 0, fontStyle: 'italic', wordBreak: 'break-word', lineHeight: '1.5' }}>
                                "{formData.bio || "No bio set yet. Tell people about yourself!"}"
                            </p>
                        </div>
                    </div>

                    {/* Right Column: Profile Edit Forms */}
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: '800', color: 'white' }}>Profile Settings</h2>
                        <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#94a3b8' }}>Update your account profile details and avatar settings.</p>

                        {error && (
                            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '12px', borderRadius: '12px', marginBottom: '20px', fontSize: '14px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                {error}
                            </div>
                        )}


                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', marginBottom: '8px', color: '#94a3b8', fontWeight: '600' }}>Username</label>
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
                                        border: '1px solid #334155', 
                                        backgroundColor: 'rgba(0,0,0,0.2)',
                                        color: 'white',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                        fontSize: '14px',
                                        transition: 'border-color 0.2s'
                                    }} 
                                    onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                                    onBlur={(e) => e.target.style.borderColor = '#334155'}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', marginBottom: '8px', color: '#94a3b8', fontWeight: '600' }}>Bio</label>
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
                                        border: '1px solid #334155', 
                                        backgroundColor: 'rgba(0,0,0,0.2)',
                                        color: 'white',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                        fontSize: '14px',
                                        resize: 'none',
                                        transition: 'border-color 0.2s'
                                    }} 
                                    onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                                    onBlur={(e) => e.target.style.borderColor = '#334155'}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', marginBottom: '8px', color: '#94a3b8', fontWeight: '600' }}>Profile Picture URL (Optional)</label>
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
                                        border: '1px solid #334155', 
                                        backgroundColor: 'rgba(0,0,0,0.2)',
                                        color: 'white',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                        fontSize: '14px',
                                        transition: 'border-color 0.2s'
                                    }} 
                                    onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                                    onBlur={(e) => e.target.style.borderColor = '#334155'}
                                />
                            </div>

                            <button 
                                type="submit" 
                                disabled={saving}
                                style={{ 
                                    width: '100%', 
                                    padding: '14px', 
                                    backgroundColor: '#6366f1', 
                                    color: 'white', 
                                    border: 'none', 
                                    borderRadius: '12px', 
                                    fontWeight: '700',
                                    fontSize: '15px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    opacity: saving ? 0.7 : 1,
                                    marginTop: '8px',
                                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
                                }}
                                onMouseEnter={(e) => { if (!saving) e.target.style.backgroundColor = '#4f46e5'; }}
                                onMouseLeave={(e) => { if (!saving) e.target.style.backgroundColor = '#6366f1'; }}
                            >
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
            <style>{`
                @keyframes toastIn {
                    from { transform: translateY(-20px) scale(0.95); opacity: 0; }
                    to { transform: translateY(0) scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default Profile;
