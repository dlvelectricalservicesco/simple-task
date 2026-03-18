import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getTasks, createTask, updateTask, deleteTask } from '../api';
import { Plus, Trash2, CheckCircle, Clock, Calendar, LogOut, Layout, BookOpen, Clock3, CheckSquare, X, Bell, BellOff, Settings, Search, ArrowUpDown, Sun, Moon, BarChart2, Sparkles, CheckCircle2, ChevronDown, ListTodo, MessageSquare, Send, AlertCircle } from 'lucide-react';

const Dashboard = ({ user, onLogout }) => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [settings, setSettings] = useState({ 
        discord_webhook: user.discord_webhook || '', 
        telegram_id: user.telegram_id || '',
        reminder_time: user.reminder_time || '08:00',
        ui_theme: user.ui_theme || 'light'
    });
    const [currentTask, setCurrentTask] = useState({ title: '', description: '', due_date: '', status: 'Pending', priority: 'Medium', subtasks: [] });
    const [editingId, setEditingId] = useState(null);
    const [filter, setFilter] = useState('Active');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('Newest');
    const [theme, setTheme] = useState(user.ui_theme || 'light');
    const [serverStats, setServerStats] = useState(null);
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [toast, setToast] = useState({ visible: false, message: '', type: 'error' });

    const showToast = (message, type = 'error') => {
        setToast({ visible: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 4000);
    };

    useEffect(() => {
        fetchTasks();
        fetchStats();
        requestNotificationPermission();
    }, []);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        document.body.style.backgroundColor = theme === 'dark' ? '#0f1115' : '#f9fafb';
    }, [theme]);

    const fetchStats = async () => {
        try {
            const { getStats } = await import('../api');
            const { data } = await getStats();
            setServerStats(data);
        } catch (err) {
            console.error(err);
        }
    };

    const toggleTheme = async () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        setSettings(prev => ({ ...prev, ui_theme: newTheme }));
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
        try {
            const { updateSettings } = await import('../api');
            await updateSettings({ ...settings, ui_theme: newTheme });
            const updatedUser = { ...user, ui_theme: newTheme };
            localStorage.setItem('user', JSON.stringify(updatedUser));
        } catch (err) {
            console.error(err);
        }
    };

    const requestNotificationPermission = async () => {
        if ('Notification' in window && Notification.permission === 'default') {
            await Notification.requestPermission();
        }
    };

    const sendNotification = (title, body) => {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body,
                icon: '/icon-512.png'
            });
        }
    };

    const checkDeadlines = (tasksList) => {
        const now = new Date();
        tasksList.forEach(task => {
            if (task.status === 'Pending' && task.due_date) {
                const dueDate = new Date(task.due_date);
                const diff = dueDate - now;
                const hours = diff / (1000 * 60 * 60);
                
                // If task is due within 24 hours and we haven't notified recently (could add more complex state)
                if (hours > 0 && hours < 24) {
                    console.log(`Reminder: ${task.title} is due soon!`);
                    // Note: In a real app, you'd track if you already sent this to avoid spam
                }
            }
        });
    };

    const fetchTasks = async () => {
        try {
            const { data } = await getTasks();
            setTasks(data);
            checkDeadlines(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveTask = async (e) => {
        e.preventDefault();
        try {
            if (currentTask.status === 'Completed') {
                const subtasks = currentTask.subtasks || [];
                if (subtasks.some(st => !st.completed)) {
                    showToast('Hindi mo pa pwedeng i-complete ang task na ito dahil may mga subtask ka pang hindi tapos. ⚠️');
                    return;
                }
            }
            if (editingId) {
                await updateTask(editingId, currentTask);
            } else {
                await createTask(currentTask);
            }
            fetchTasks();
            fetchStats();
            setShowModal(false);
            setCurrentTask({ title: '', description: '', due_date: '', status: 'Pending', priority: 'Medium', subtasks: [] });
            setEditingId(null);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        try {
            const { updateSettings } = await import('../api');
            await updateSettings(settings);
            // Update local storage user object
            const updatedUser = { ...user, ...settings };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            setShowSettings(false);
        } catch (err) {
            console.error(err);
        }
    };

    const handleTestNotification = async () => {
        try {
            const { testNotification } = await import('../api');
            await testNotification();
            showToast('Test notification sent!', 'success');
        } catch (err) {
            console.error(err);
            showToast('Failed to send test notification');
        }
    };

    const handleDelete = async (id) => {
        try {
            await deleteTask(id);
            setTasks(tasks.filter(t => t.id !== id));
            fetchStats();
        } catch (err) {
            console.error(err);
        }
    };

    const toggleStatus = async (task) => {
        const newStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
        
        if (newStatus === 'Completed') {
            const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
            if (subtasks.some(st => !st.completed)) {
                showToast('Tapusin mo muna ang lahat ng subtasks bago i-complete ang task! ⚠️');
                return;
            }
        }

        try {
            await updateTask(task.id, { ...task, status: newStatus });
            fetchTasks();
            fetchStats();
        } catch (err) {
            console.error(err);
        }
    };

    const localStats = {
        total: tasks.length,
        pending: tasks.filter(t => t.status === 'Pending').length,
        completed: tasks.filter(t => t.status === 'Completed').length,
        inProgress: tasks.filter(t => t.status === 'In Progress').length
    };

    const sortedTasks = [...tasks]
        .filter(t => {
            const matchesSearch = (t.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
                                  (t.description?.toLowerCase() || '').includes(searchQuery.toLowerCase());
            if (!matchesSearch) return false;
            if (filter === 'All') return true;
            if (filter === 'Active') return t.status !== 'Completed';
            return t.status === filter;
        })
        .sort((a, b) => {
            if (sortBy === 'Title') return a.title.localeCompare(b.title);
            if (sortBy === 'DueSoon') return new Date(a.due_date || '9999-12-31') - new Date(b.due_date || '9999-12-31');
            if (sortBy === 'Priority') {
                const map = { High: 0, Medium: 1, Low: 2 };
                return map[a.priority || 'Medium'] - map[b.priority || 'Medium'];
            }
            return new Date(b.created_at) - new Date(a.created_at); // Newest
        });

    return (
        <div className="min-h-screen transition-colors duration-500 pb-20">
            <div className="max-w-6xl mx-auto px-4 py-8">
                <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-600 rounded-3xl shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20">
                            <Sparkles className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black gradient-text">Hello, {user.name}! 👋</h1>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                        <div className="relative flex-grow lg:flex-grow-0 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted transition-colors group-focus-within:text-indigo-500" />
                            <input 
                                type="text"
                                placeholder="Search tasks..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full lg:w-64 pl-11 pr-4 py-3 bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all backdrop-blur-md text-main placeholder:text-muted"
                            />
                        </div>

                        <div className="relative">
                            <ArrowUpDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="pl-11 pr-8 py-3 bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none transition-all backdrop-blur-md font-bold text-main text-sm"
                            >
                                <option value="Newest">Newest</option>
                                <option value="DueSoon">Due Soon</option>
                                <option value="Priority">Priority</option>
                                <option value="Title">Title</option>
                            </select>
                        </div>

                        <div className="flex gap-2">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setShowSettings(true)}
                                className="px-4 py-3 bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 rounded-2xl flex items-center justify-center gap-2 hover:bg-white dark:hover:bg-white/10 transition-all backdrop-blur-md"
                                title="Settings"
                            >
                                <Settings className="w-5 h-5" />
                                <span className="text-sm font-bold hidden md:block">Settings</span>
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={toggleTheme}
                                className="p-3 bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 rounded-2xl flex items-center justify-center hover:bg-white dark:hover:bg-white/10 transition-all backdrop-blur-md"
                                title="Toggle Theme"
                            >
                                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setShowAnalytics(!showAnalytics)}
                                className={`p-3 border rounded-2xl flex items-center justify-center transition-all backdrop-blur-md ${showAnalytics ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white/50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300'}`}
                                title="Show Analytics"
                            >
                                <BarChart2 className="w-5 h-5" />
                            </motion.button>
                        </div>

                        <div className="h-8 w-[1px] bg-gray-200 dark:bg-white/10 hidden lg:block mx-1"></div>

                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                                setCurrentTask({ title: '', description: '', due_date: '', status: 'Pending', priority: 'Medium', subtasks: [] });
                                setEditingId(null);
                                setShowModal(true);
                            }}
                            className="btn-primary px-6 py-3 flex items-center gap-2 whitespace-nowrap"
                        >
                            <Plus className="w-5 h-5" /> New Task
                        </motion.button>
                        
                        <div className="hidden lg:flex gap-2">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={onLogout}
                                className="p-3 bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 rounded-2xl flex items-center justify-center hover:bg-white dark:hover:bg-white/10 transition-all backdrop-blur-md"
                                title="Logout"
                            >
                                <LogOut className="w-5 h-5 text-rose-500" />
                            </motion.button>
                        </div>
                    </div>
                </header>

                <AnimatePresence>
                    {showAnalytics && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden mb-10"
                        >
                            <div className="glass-card p-8 rounded-[2rem] border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-900/10">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        <BarChart2 className="w-6 h-6 text-indigo-500" />
                                        Productivity Analytics
                                    </h3>
                                    <span className="text-sm font-bold text-indigo-600 bg-indigo-100 px-3 py-1 rounded-full">Weekly Progress</span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <AnalyticItem label="Completion Rate" value={`${Math.round((localStats.completed / (localStats.total || 1)) * 100)}%`} color="text-emerald-500" />
                                    <AnalyticItem label="Avg Priority" value="Medium" color="text-indigo-500" />
                                    <AnalyticItem label="Tasks Done" value={localStats.completed} color="text-emerald-500" />
                                    <AnalyticItem label="Streak" value="3 Days" color="text-orange-500" />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    <StatCard icon={<BookOpen className="text-indigo-500" />} label="Total Tasks" value={localStats.total} color="bg-indigo-50 dark:bg-indigo-900/10" />
                    <StatCard icon={<Clock3 className="text-orange-500" />} label="Pending" value={localStats.pending} color="bg-orange-50 dark:bg-orange-900/10" />
                    <StatCard icon={<CheckSquare className="text-emerald-500" />} label="Completed" value={localStats.completed} color="bg-emerald-50 dark:bg-emerald-900/10" />
                </div>

                {/* Filter Tabs */}
                <div className="flex flex-wrap justify-center gap-2 mb-8 bg-white/30 dark:bg-white/5 p-1.5 rounded-2xl w-fit mx-auto backdrop-blur-md border border-white/50 dark:border-white/10 shadow-sm">
                    {['Active', 'Pending', 'In Progress', 'Completed', 'All'].map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setFilter(cat)}
                            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                                filter === cat 
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                                    : 'text-muted hover:text-indigo-600 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/10'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AnimatePresence mode="popLayout">
                        {sortedTasks.map((task) => (
                            <TaskCard 
                                key={task.id} 
                                task={task} 
                                onDelete={handleDelete} 
                                onToggle={toggleStatus}
                                onEdit={() => {
                                    setCurrentTask({
                                        ...task,
                                        subtasks: Array.isArray(task.subtasks) ? task.subtasks : []
                                    });
                                    setEditingId(task.id);
                                    setShowModal(true);
                                }}
                            />
                        ))}
                    </AnimatePresence>
                </div>

                {loading && tasks.length === 0 && (
                    <div className="text-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                    </div>
                )}

                {!loading && sortedTasks.length === 0 && (
                    <div className="text-center py-20 glass-card rounded-3xl dark:bg-white/5 border-dashed dark:border-white/10">
                        <Layout className="w-16 h-16 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-400 dark:text-gray-600">
                            {tasks.length === 0 ? "No tasks yet? Add one to get started!" : `No tasks matching "${filter}" found.`}
                        </h3>
                    </div>
                )}
            </div>

            {/* Task Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className={`${theme === 'dark' ? 'bg-[#0f1115] border border-white/10' : 'bg-white'} rounded-3xl p-8 w-full max-w-lg shadow-2xl relative`}
                        >
                            <button 
                                onClick={() => setShowModal(false)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-6 h-6" />
                            </button>
                            <h2 className="text-2xl font-black gradient-text mb-6">
                                {editingId ? 'Edit Task' : 'Create New Task'}
                            </h2>
                            <form onSubmit={handleSaveTask} className="space-y-4">
                                <input
                                    type="text"
                                    placeholder="Task Title"
                                    className="input-field w-full"
                                    value={currentTask.title}
                                    onChange={(e) => setCurrentTask({ ...currentTask, title: e.target.value })}
                                    required
                                />
                                <textarea
                                    placeholder="Description"
                                    className="input-field w-full h-32"
                                    value={currentTask.description}
                                    onChange={(e) => setCurrentTask({ ...currentTask, description: e.target.value })}
                                />
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Due Date</label>
                                    <input
                                        type="date"
                                        className="input-field w-full"
                                        value={currentTask.due_date || ''}
                                        onChange={(e) => setCurrentTask({ ...currentTask, due_date: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Priority</label>
                                        <select
                                            className="input-field w-full bg-gray-50 dark:bg-white/5 border-gray-100 dark:border-white/10"
                                            value={currentTask.priority || 'Medium'}
                                            onChange={(e) => setCurrentTask({ ...currentTask, priority: e.target.value })}
                                        >
                                            <option value="High">🔴 High</option>
                                            <option value="Medium">🟠 Medium</option>
                                            <option value="Low">🔵 Low</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Status</label>
                                        <select
                                            className="input-field w-full bg-gray-50 dark:bg-white/5 border-gray-100 dark:border-white/10"
                                            value={currentTask.status}
                                            onChange={(e) => setCurrentTask({ ...currentTask, status: e.target.value })}
                                        >
                                            <option value="Pending">Pending</option>
                                            <option value="In Progress">In Progress</option>
                                            <option value="Completed">Completed</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Subtasks</label>
                                    <div className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                                        {(currentTask.subtasks || []).map((st, idx) => (
                                            <div key={idx} className="flex items-center gap-2 group">
                                                <input 
                                                    type="checkbox" 
                                                    checked={st.completed}
                                                    onChange={(e) => {
                                                        const newSubtasks = [...currentTask.subtasks];
                                                        newSubtasks[idx].completed = e.target.checked;
                                                        setCurrentTask({ ...currentTask, subtasks: newSubtasks });
                                                    }}
                                                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <input 
                                                    type="text"
                                                    value={st.text}
                                                    onChange={(e) => {
                                                        const newSubtasks = [...currentTask.subtasks];
                                                        newSubtasks[idx].text = e.target.value;
                                                        setCurrentTask({ ...currentTask, subtasks: newSubtasks });
                                                    }}
                                                    className="flex-grow bg-transparent border-none text-sm focus:ring-0 p-0 text-main"
                                                />
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        const newSubtasks = currentTask.subtasks.filter((_, i) => i !== idx);
                                                        setCurrentTask({ ...currentTask, subtasks: newSubtasks });
                                                    }}
                                                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-rose-500 transition-all"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => setCurrentTask({ 
                                            ...currentTask, 
                                            subtasks: [...(currentTask.subtasks || []), { text: '', completed: false }] 
                                        })}
                                        className="text-xs font-bold text-indigo-500 hover:text-indigo-600 flex items-center gap-1 transition-colors"
                                    >
                                        <Plus className="w-3 h-3" /> Add Subtask
                                    </button>
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button 
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 py-3 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 font-bold rounded-2xl hover:bg-gray-200 dark:hover:bg-white/10 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="flex-[2] btn-primary py-3"
                                    >
                                        {editingId ? 'Update Task' : 'Create Task'}
                                    </motion.button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showSettings && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className={`${theme === 'dark' ? 'bg-[#0f1115] border border-white/10' : 'bg-white'} rounded-[2.5rem] p-8 w-full max-w-xl shadow-2xl relative overflow-hidden`}
                        >
                            {/* Decorative Background Element */}
                            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
                            
                            <button 
                                onClick={() => setShowSettings(false)}
                                className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors z-10"
                            >
                                <X className="w-6 h-6 text-muted" />
                            </button>

                            <div className="relative">
                                <h2 className="text-3xl font-black gradient-text mb-2">Settings</h2>
                                <p className="text-muted font-medium mb-8">Personalize your experience and notifications.</p>
                                
                                <form onSubmit={handleSaveSettings} className="space-y-6">
                                    {/* Discord Section */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="p-2 bg-indigo-500/10 rounded-lg">
                                                <MessageSquare className="w-5 h-5 text-indigo-500" />
                                            </div>
                                            <label className="text-sm font-bold text-main uppercase tracking-widest">Discord Integration</label>
                                        </div>
                                        <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-2xl border border-gray-100 dark:border-white/10">
                                            <p className="text-[11px] text-muted font-bold uppercase mb-3 leading-tight">
                                                Server Settings &gt; Integrations &gt; Webhooks &gt; New Webhook
                                            </p>
                                            <input
                                                type="text"
                                                placeholder="Paste Discord Webhook URL here..."
                                                className={`input-field w-full ${theme === 'dark' ? 'bg-[#1a1c20]' : 'bg-white'}`}
                                                value={settings.discord_webhook}
                                                onChange={(e) => setSettings({ ...settings, discord_webhook: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    {/* Telegram Section */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="p-2 bg-sky-500/10 rounded-lg">
                                                <Send className="w-5 h-5 text-sky-500" />
                                            </div>
                                            <label className="text-sm font-bold text-main uppercase tracking-widest">Telegram Integration</label>
                                        </div>
                                        <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-2xl border border-gray-100 dark:border-white/10">
                                            <p className="text-[11px] text-muted font-bold uppercase mb-3 leading-tight">
                                                Message <span className="text-sky-500">@userinfobot</span> on Telegram to get your Chat ID
                                            </p>
                                            <input
                                                type="text"
                                                placeholder="Enter your 9-10 digit Chat ID..."
                                                className={`input-field w-full ${theme === 'dark' ? 'bg-[#1a1c20]' : 'bg-white'}`}
                                                value={settings.telegram_id}
                                                onChange={(e) => setSettings({ ...settings, telegram_id: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    {/* Reminder Schedule */}
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="p-2 bg-orange-500/10 rounded-lg">
                                                    <Clock className="w-5 h-5 text-orange-500" />
                                                </div>
                                                <label className="text-sm font-bold text-main uppercase tracking-widest">Daily Digest</label>
                                            </div>
                                            <input
                                                type="time"
                                                className={`input-field w-full ${theme === 'dark' ? 'bg-[#1a1c20]' : 'bg-white'}`}
                                                value={settings.reminder_time}
                                                onChange={(e) => setSettings({ ...settings, reminder_time: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="p-2 bg-purple-500/10 rounded-lg">
                                                    {theme === 'light' ? <Moon className="w-5 h-5 text-purple-500" /> : <Sun className="w-5 h-5 text-purple-500" />}
                                                </div>
                                                <label className="text-sm font-bold text-main uppercase tracking-widest">Appearance</label>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={toggleTheme}
                                                className={`w-full py-2.5 px-4 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all ${theme === 'dark' ? 'bg-[#1a1c20] border-white/10 text-white hover:bg-white/5' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                                            >
                                                {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex gap-4 pt-4">
                                        <motion.button
                                            type="button"
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={handleTestNotification}
                                            className="flex-1 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 font-black uppercase text-[10px] tracking-widest py-4 rounded-2xl hover:bg-gray-200 dark:hover:bg-white/10 transition-all border border-transparent dark:border-white/5"
                                        >
                                            Send Test Notif
                                        </motion.button>
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            className="flex-1 btn-primary py-4 rounded-2xl text-[10px] uppercase tracking-widest font-black"
                                        >
                                            Save All Changes
                                        </motion.button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {toast.visible && (
                    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-4">
                        <motion.div
                            initial={{ opacity: 0, y: 50, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                            className={`flex items-center gap-3 p-4 rounded-2xl shadow-2xl backdrop-blur-xl border ${
                                toast.type === 'success' 
                                    ? 'bg-emerald-500/90 border-emerald-400 text-white' 
                                    : 'bg-rose-500/90 border-rose-400 text-white'
                            }`}
                        >
                            <div className="bg-white/20 p-2 rounded-xl">
                                {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                            </div>
                            <p className="text-sm font-bold flex-grow">{toast.message}</p>
                            <button onClick={() => setToast(prev => ({ ...prev, visible: false }))} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                                <X className="w-4 h-4 ml-2" />
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};
const AnalyticItem = ({ label, value, color }) => (
    <div className="bg-white/80 dark:bg-white/5 p-4 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
        <p className="text-xs font-bold text-muted uppercase tracking-wider mb-1">{label}</p>
        <p className={`text-2xl font-black ${(typeof color === 'string' && color.includes('text-')) ? color : 'text-main'}`}>{value}</p>
    </div>
);

const StatCard = ({ icon, label, value, color }) => (
    <div className={`glass-card p-6 rounded-3xl flex items-center gap-4 ${color}`}>
        <div className="p-3 bg-white dark:bg-white/10 rounded-2xl shadow-sm border border-gray-100 dark:border-transparent">{icon}</div>
        <div>
            <p className="text-sm font-bold text-muted uppercase tracking-wider">{label}</p>
            <p className="text-3xl font-black text-main">{value}</p>
        </div>
    </div>
);

const TaskCard = ({ task, onDelete, onToggle, onEdit }) => {
    const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
    const completedSubtasks = subtasks.filter(s => s.completed).length;
    
    const priorityColors = {
        High: 'bg-rose-50 text-rose-800 border border-rose-200',
        Medium: 'bg-orange-50 text-orange-800 border border-orange-200',
        Low: 'bg-blue-50 text-blue-800 border border-blue-200'
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            whileHover={{ y: -5 }}
            className={`glass-card p-6 rounded-3xl group relative h-full flex flex-col border border-white/50 dark:border-white/10 ${task.status === 'Completed' ? 'opacity-75' : ''}`}
        >
            <div className="flex justify-between items-start mb-4">
                <div className="flex gap-2">
                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        task.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                        task.status === 'In Progress' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 
                        'bg-slate-50 text-slate-700 border-slate-200'
                    }`}>
                        {task.status}
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${priorityColors[task.priority || 'Medium']}`}>
                        {task.priority || 'Medium'}
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={onEdit} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-white/10 rounded-xl transition-all">
                        <Sparkles className="w-4 h-4" />
                    </button>
                    <button onClick={() => onDelete(task.id)} className="p-2 text-gray-400 hover:text-pink-600 hover:bg-pink-50 dark:hover:bg-white/10 rounded-xl transition-all">
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <h3 className={`text-xl font-black mb-2 transition-all ${task.status === 'Completed' ? 'line-through text-gray-400' : 'text-main'}`}>
                {task.title}
            </h3>
            <p className="text-muted mb-6 flex-grow text-sm line-clamp-2 leading-relaxed font-bold">{task.description}</p>

            {subtasks.length > 0 && (
                <div className="mb-6 p-3 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                            <ListTodo className="w-3 h-3" /> Subtasks
                        </span>
                        <span className="text-[10px] font-black text-indigo-500">{completedSubtasks}/{subtasks.length}</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden">
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(completedSubtasks/subtasks.length)*100}%` }}
                            className="h-full bg-indigo-500" 
                        />
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center mt-auto">
                <div className="flex items-center gap-2 text-muted text-xs font-bold">
                    <Calendar className="w-4 h-4" />
                    {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No date'}
                </div>
                <motion.button
                    whileTap={{ scale: 0.8 }}
                    onClick={() => onToggle(task)}
                    className={`p-2.5 rounded-2xl transition-all ${
                        task.status === 'Completed' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200 dark:shadow-emerald-900/20' : 'bg-gray-100 dark:bg-white/10 text-gray-400 hover:bg-gray-200 dark:hover:bg-white/20'
                    }`}
                >
                    <CheckCircle2 className="w-5 h-5" />
                </motion.button>
            </div>
        </motion.div>
    );
};

export default Dashboard;
