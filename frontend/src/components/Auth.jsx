import React, { useState } from 'react';
import api from '../api';

const Auth = ({ setToken, setUsername }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({ username: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const endpoint = isLogin ? '/auth/login' : '/auth/register';
            //console.log("Sending request to:", endpoint, formData); // Debugging
            const { data } = await api.post(endpoint, formData);
            if (isLogin) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('username', data.username);
                setToken(data.token);
                setUsername(data.username);
            } else {
                setIsLogin(true);
                alert('Account created! Please login.');
            }
        } catch (err) {
            console.error("Auth error:", err.response?.data || err.message);
            setError(err.response?.data?.error || 'Something went wrong. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ 
            height: '100vh', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            padding: '20px'
        }}>
            <div className="glass-panel" style={{ 
                width: '100%',
                maxWidth: '400px', 
                padding: '40px', 
                borderRadius: '24px',
                textAlign: 'center'
            }}>
                <h1 style={{ marginBottom: '8px', fontSize: '32px', fontWeight: '800', background: 'linear-gradient(to right, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Pesuvoma
                </h1>
                <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
                    {isLogin ? 'Welcome back! Log in to continue.' : 'Create an account to start chatting.'}
                </p>

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

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '16px', textAlign: 'left' }}>
                        <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: 'var(--text-muted)' }}>Username</label>
                        <input 
                            type="text" 
                            name="username" 
                            value={formData.username} 
                            onChange={handleChange} 
                            required 
                            placeholder="Enter your username"
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
                    <div style={{ marginBottom: '24px', textAlign: 'left' }}>
                        <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: 'var(--text-muted)' }}>Password</label>
                        <input 
                            type="password" 
                            name="password" 
                            value={formData.password} 
                            onChange={handleChange} 
                            required 
                            placeholder="••••••••"
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
                        disabled={loading}
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
                            opacity: loading ? 0.7 : 1
                        }}>
                        {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
                    </button>
                </form>

                <p style={{ marginTop: '24px', fontSize: '14px', color: 'var(--text-muted)' }}>
                    {isLogin ? "Don't have an account?" : "Already have an account?"}
                    <span 
                        onClick={() => setIsLogin(!isLogin)} 
                        style={{ cursor: 'pointer', color: 'var(--primary)', marginLeft: '8px', fontWeight: '500' }}>
                        {isLogin ? 'Register now' : 'Login here'}
                    </span>
                </p>
            </div>
        </div>
    );
};

export default Auth;
