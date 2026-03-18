import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { login, register } from '../api';
import { User, Mail, Lock, LogIn, UserPlus } from 'lucide-react';

const Auth = ({ setUser }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({ name: '', email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const { data } = isLogin ? await login(formData) : await register(formData);
            if (isLogin) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                setUser(data.user);
            } else {
                setIsLogin(true);
                setError('Registration successful! Please login.');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-8 rounded-3xl w-full max-auto max-w-md"
            >
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-black gradient-text mb-2">SimpleTask</h1>
                    <p className="text-muted font-medium">
                        {isLogin ? 'Welcome back! Ready to get productive?' : 'Join us and start organizing your life!'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <AnimatePresence mode='wait'>
                        {!isLogin && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="relative input-icon-group mb-4"
                            >
                                <User className="icon-left" />
                                <input
                                    type="text"
                                    placeholder="Full Name"
                                    className="input-field input-with-icon w-full"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="relative input-icon-group">
                        <Mail className="icon-left" />
                        <input
                            type="email"
                            placeholder="Email Address"
                            className="input-field input-with-icon w-full"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            required
                        />
                    </div>

                    <div className="relative input-icon-group">
                        <Lock className="icon-left" />
                        <input
                            type="password"
                            placeholder="Password"
                            className="input-field input-with-icon w-full"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            required
                        />
                    </div>

                    {error && (
                        <p className={`text-sm text-center ${(error && typeof error === 'string' && error.includes('successful')) ? 'text-green-500' : 'text-pink-500'} font-semibold`}>
                            {error}
                        </p>
                    )}

                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={loading}
                        className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                        {loading ? 'Processing...' : (isLogin ? <><LogIn className="w-5 h-5" /> Sign In</> : <><UserPlus className="w-5 h-5" /> Sign Up</>)}
                    </motion.button>
                </form>

                <div className="mt-6 text-center">
                    <button 
                        onClick={() => { setIsLogin(!isLogin); setError(''); }}
                        className="text-indigo-600 font-bold hover:underline"
                    >
                        {isLogin ? "No account? Create one" : "Already have an account? Sign In"}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default Auth;
