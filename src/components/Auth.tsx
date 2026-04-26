import React, { useState } from 'react';
import { 
  auth 
} from '../lib/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  updateProfile
} from 'firebase/auth';
import { 
  motion, 
  AnimatePresence 
} from 'motion/react';
import { 
  Mail, 
  Lock, 
  User, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  X
} from 'lucide-react';

interface AuthProps {
  onClose: () => void;
}

export function Auth({ onClose }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
      }
      onClose();
    } catch (err: any) {
      console.error("Auth error:", err);
      setError(err.message || "Authentication failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-md"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden p-8"
      >
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X size={20} className="text-gray-400" />
        </button>

        <div className="mb-8">
          <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center mb-4">
            <User className="text-white" size={24} />
          </div>
          <h2 className="text-2xl font-black text-gray-900 leading-tight">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">
            {isLogin ? 'Access your lead engine' : 'Start your agency profile'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-red-50 p-4 rounded-xl flex items-center gap-3 text-red-600 text-xs font-bold border border-red-100"
              >
                <AlertCircle size={16} />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {!isLogin && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 font-bold text-sm"
                  placeholder="John Doe"
                  required
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 font-bold text-sm"
                placeholder="john@example.com"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Secure Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 font-bold text-sm"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-black text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl hover:bg-gray-800 transition-all active:scale-95 disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {isLogin ? 'Sign In Now' : 'Initialize Profile'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-black transition-colors"
          >
            {isLogin ? "Don't have an account? Register" : "Already have an account? Sign In"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function UserProfile({ user }: { user: any }) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative">
      <button 
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-2xl transition-colors text-left"
      >
        <div className="w-10 h-10 rounded-2xl bg-black flex items-center justify-center text-white font-black text-xs">
          {user?.displayName ? user.displayName.substring(0, 2).toUpperCase() : user?.email?.substring(0, 2).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-black text-gray-900 leading-none truncate max-w-[120px]">
            {user?.displayName || 'User Profile'}
          </p>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight mt-1 truncate max-w-[120px]">
            {user?.email}
          </p>
        </div>
      </button>

      <AnimatePresence>
        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="absolute bottom-full left-0 mb-2 w-48 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-50"
            >
              <button 
                onClick={() => signOut(auth)}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors text-xs font-black uppercase tracking-widest"
              >
                <X size={16} /> Sign Out
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
