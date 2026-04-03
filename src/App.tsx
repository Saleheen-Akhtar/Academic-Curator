/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { GoogleGenAI } from "@google/genai";
import Markdown from 'react-markdown';
import { 
  signInWithPopup, 
  onAuthStateChanged, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  query, 
  orderBy,
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';
import { SCHOLARSHIPS_FROM_CSV } from './scholarshipsData';
import { getHybridScholarships } from './scholarshipAISearch';
import { 
  Sparkles, 
  Mic, 
  GraduationCap, 
  CheckCircle, 
  UserCircle, 
  Home, 
  Bookmark, 
  HelpCircle, 
  Settings2, 
  ChevronRight, 
  Calendar, 
  IndianRupee, 
  ArrowRight, 
  Bot, 
  FileCheck, 
  TrendingUp, 
  Lightbulb, 
  Globe,
  Menu,
  X,
  Search,
  ChevronDown,
  FileText,
  Info,
  Send,
  MessageSquare,
  Trash2,
  Heart,
  Bell,
  LogIn,
  LogOut,
  Copy,
  Check,
  ArrowDown,
  Sun,
  Moon,
  Share2,
  School,
  Building
} from 'lucide-react';

// --- Types ---
type Page = 'landing' | 'search' | 'dashboard' | 'saved' | 'profile' | 'details' | 'login' | 'about';
type Language = 'EN' | 'KN';

interface UserProfile {
  fullName: string;
  email: string;
  phone: string;
  course: string;
  category: string;
  income: string;
  cgpa: string;
  careerGoals: string;
}

interface SearchFilters {
  course: string;
  category: string;
  income: string;
  cgpa: string;
  type: 'All' | 'State' | 'Central' | 'Private';
  tags: string[];
}

interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'new' | 'deadline' | 'status';
  date: string;
  read: boolean;
}

interface Scholarship {
  id: string;
  title: string;
  description: string;
  reward: string;
  deadline: string;
  category: 'Government' | 'Corporate CSR' | 'Private' | 'International';
  matchScore?: number;
  aiInsight?: string;
  isFeatured?: boolean;
  tags: string[]; // For filtering
  source?: 'csv_database' | 'web_retrieval';
  website?: string;
  matchedBecause?: string[];
}

// --- Data ---
const SCHOLARSHIPS: Scholarship[] = SCHOLARSHIPS_FROM_CSV;

// --- Auth Context ---
interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

// --- Components ---

const SmoothScroll: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
      infinite: false,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
};

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-slate-200 rounded-xl ${className}`} />
);

const NotificationCenter = ({ 
  notifications, 
  onClose, 
  onMarkRead 
}: { 
  notifications: AppNotification[], 
  onClose: () => void,
  onMarkRead: (id: string) => void
}) => {
  // Only show unread notifications to avoid clutter from demo/old data
  const unreadNotifications = notifications.filter(n => !n.read);
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute right-0 mt-2 w-80 bg-surface dark:bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant z-[60] overflow-hidden"
    >
      <div className="p-4 border-b border-slate-100 flex justify-between items-center">
        <h3 className="font-bold text-primary">Notifications</h3>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {unreadNotifications.length > 0 ? (
          unreadNotifications.map(n => (
            <div 
              key={n.id} 
              className={`p-4 border-b border-outline-variant hover:bg-surface-container transition-colors cursor-pointer bg-primary-container/10`}
              onClick={() => onMarkRead(n.id)}
            >
              <div className="flex gap-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 bg-primary`} />
                <div>
                  <p className="text-sm font-bold text-primary">{n.title}</p>
                  <p className="text-xs text-slate-600 mb-1">{n.message}</p>
                  <p className="text-[10px] text-slate-400">{new Date(n.date).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-8 text-center text-slate-400 text-sm">
            No new notifications
          </div>
        )}
      </div>
    </motion.div>
  );
};

const Navbar = ({ 
  onNavigate, 
  currentPage, 
  lang, 
  setLang, 
  notifications,
  isNotificationsOpen,
  setIsNotificationsOpen,
  onMarkRead,
  isDarkMode,
  setIsDarkMode
}: { 
  onNavigate: (p: Page) => void, 
  currentPage: Page,
  lang: Language,
  setLang: (l: Language) => void,
  notifications: AppNotification[],
  isNotificationsOpen: boolean,
  setIsNotificationsOpen: (o: boolean) => void,
  onMarkRead: (id: string) => void,
  isDarkMode: boolean,
  setIsDarkMode: (d: boolean) => void
}) => {
  const { user } = useAuth();
  
  return (
    <nav className="sticky top-0 z-50 bg-surface/80 dark:bg-surface-container-lowest/80 backdrop-blur-md border-b border-outline-variant/30">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <div 
          className="text-xl font-bold tracking-tight text-primary font-headline cursor-pointer"
          onClick={() => onNavigate('landing')}
        >
          The Academic Curator
        </div>
        
        <div className="hidden md:flex items-center gap-8">
          <button 
            onClick={() => onNavigate('landing')}
            className={`text-sm font-medium font-label transition-colors duration-200 pb-1 border-b-2 ${
              currentPage === 'landing' ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:text-primary'
            }`}
          >
            {lang === 'EN' ? 'AI Guidance' : 'AI ಮಾರ್ಗದರ್ಶನ'}
          </button>
          <button 
            onClick={() => onNavigate('search')}
            className={`text-sm font-medium font-label transition-colors duration-200 pb-1 border-b-2 ${
              currentPage === 'search' ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:text-primary'
            }`}
          >
            {lang === 'EN' ? 'Search' : 'ಹುಡುಕಿ'}
          </button>
          <button 
            onClick={() => onNavigate('about')}
            className={`text-sm font-medium font-label transition-colors duration-200 pb-1 border-b-2 ${
              currentPage === 'about' ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:text-primary'
            }`}
          >
            {lang === 'EN' ? 'About' : 'ಬಗ್ಗೆ'}
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-xl bg-surface-container text-primary hover:bg-primary hover:text-white transition-all duration-300"
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <div className="relative">
            <button 
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className="p-2 rounded-xl bg-surface-container text-primary relative hover:bg-primary hover:text-white transition-all duration-300"
            >
              <Bell className="w-5 h-5" />
              {notifications.some(n => !n.read) && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full border border-white" />
              )}
            </button>
            <AnimatePresence>
              {isNotificationsOpen && (
                <NotificationCenter 
                  notifications={notifications} 
                  onClose={() => setIsNotificationsOpen(false)}
                  onMarkRead={onMarkRead}
                />
              )}
            </AnimatePresence>
          </div>
          <button 
            onClick={() => setLang(lang === 'EN' ? 'KN' : 'EN')}
            className="px-4 py-2 rounded-xl bg-surface-container text-primary font-medium text-sm transition-all hover:opacity-80 active:scale-95 flex items-center gap-2"
          >
            <Globe className="w-4 h-4" />
            {lang === 'EN' ? 'English' : 'ಕನ್ನಡ'}
          </button>
          
          {user ? (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => onNavigate('profile')}
                className={`p-1 rounded-full transition-all ${currentPage === 'profile' ? 'bg-primary text-white' : 'text-primary hover:bg-slate-100'}`}
              >
                {user.photoURL ? (
                  <img src={user.photoURL} className="w-8 h-8 rounded-full" alt="Profile" />
                ) : (
                  <UserCircle className="w-8 h-8 cursor-pointer" />
                )}
              </button>
            </div>
          ) : (
            <button 
              onClick={() => onNavigate('login')}
              className="px-6 py-2 bg-primary text-white rounded-xl font-bold text-sm hover:opacity-90 transition-all flex items-center gap-2"
            >
              <LogIn className="w-4 h-4" /> {lang === 'EN' ? 'Sign In' : 'ಸೈನ್ ಇನ್'}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

const Footer = ({ isInternal, lang }: { isInternal?: boolean, lang: Language }) => (
  <footer className={`w-full py-12 px-6 bg-surface-container-low border-t border-outline-variant ${isInternal ? 'md:ml-64' : ''}`}>
    <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
      <div className="flex flex-col items-center md:items-start gap-4">
        <div className="text-sm font-bold text-primary font-headline">The Academic Curator</div>
        <p className="text-xs text-slate-500 font-body">
          {lang === 'EN' 
            ? '© 2024 The Academic Curator. Made for Indian Students.' 
            : '© 2024 ದಿ ಅಕಾಡೆಮಿಕ್ ಕ್ಯುರೇಟರ್. ಭಾರತೀಯ ವಿದ್ಯಾರ್ಥಿಗಳಿಗಾಗಿ ತಯಾರಿಸಲಾಗಿದೆ.'}
        </p>
      </div>
      
      <div className="flex gap-8">
        <a href="#" className="text-xs text-slate-500 hover:underline hover:text-primary transition-colors">
          {lang === 'EN' ? 'Contact' : 'ಸಂಪರ್ಕ'}
        </a>
        <a href="#" className="text-xs text-slate-500 hover:underline hover:text-primary transition-colors">
          {lang === 'EN' ? 'Privacy Policy' : 'ಗೌಪ್ಯತಾ ನೀತಿ'}
        </a>
        <a href="#" className="text-xs text-slate-500 hover:underline hover:text-primary transition-colors">
          {lang === 'EN' ? 'Terms of Service' : 'ಸೇವಾ ನಿಯಮಗಳು'}
        </a>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-primary-container">
          <Globe className="w-4 h-4" />
        </div>
        <span className="text-xs font-bold text-primary">
          {lang === 'EN' ? 'Bilingual (English & Kannada)' : 'ದ್ವಿಭಾಷಾ (ಇಂಗ್ಲಿಷ್ ಮತ್ತು ಕನ್ನಡ)'}
        </span>
      </div>
    </div>
  </footer>
);

// --- Pages ---

const LoginPage = ({ onLoginSuccess, lang }: { onLoginSuccess: () => void, lang: Language }) => {
  const { login, user, loading } = useAuth();

  useEffect(() => {
    if (user) onLoginSuccess();
  }, [user, onLoginSuccess]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-container-low p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-surface dark:bg-surface-container-lowest rounded-3xl p-10 shadow-2xl border border-outline-variant text-center"
      >
        <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-8">
          <GraduationCap className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-3xl font-extrabold headline text-primary mb-4">
          {lang === 'EN' ? 'Welcome Back' : 'ಮತ್ತೆ ಸ್ವಾಗತ'}
        </h1>
        <p className="text-on-surface-variant mb-10">
          {lang === 'EN' 
            ? 'Sign in to access your personalized scholarship recommendations and track your applications.' 
            : 'ನಿಮ್ಮ ವೈಯಕ್ತಿಕಗೊಳಿಸಿದ ವಿದ್ಯಾರ್ಥಿವೇತನ ಶಿಫಾರಸುಗಳನ್ನು ಪ್ರವೇಶಿಸಲು ಮತ್ತು ನಿಮ್ಮ ಅರ್ಜಿಗಳನ್ನು ಟ್ರ್ಯಾಕ್ ಮಾಡಲು ಸೈನ್ ಇನ್ ಮಾಡಿ.'}
        </p>
        
        <button 
          onClick={login}
          disabled={loading}
          className="w-full py-4 bg-surface dark:bg-surface-container-lowest border-2 border-outline-variant rounded-2xl font-bold flex items-center justify-center gap-4 hover:bg-surface-container transition-all active:scale-95 disabled:opacity-50"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
          {lang === 'EN' ? 'Continue with Google' : 'Google ನೊಂದಿಗೆ ಮುಂದುವರಿಯಿರಿ'}
        </button>
        
        <p className="mt-8 text-xs text-slate-400">
          {lang === 'EN' 
            ? 'By continuing, you agree to our Terms of Service and Privacy Policy.' 
            : 'ಮುಂದುವರಿಯುವ ಮೂಲಕ, ನೀವು ನಮ್ಮ ಸೇವಾ ನಿಯಮಗಳು ಮತ್ತು ಗೌಪ್ಯತಾ ನೀತಿಯನ್ನು ಒಪ್ಪುತ್ತೀರಿ.'}
        </p>
      </motion.div>
    </div>
  );
};

const LandingPage = ({ onStart, onOpenChat, lang }: { onStart: () => void, onOpenChat: () => void, lang: Language }) => {
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.2], [0, -50]);
  const heroScale = useTransform(scrollYProgress, [0, 0.2], [1, 1.05]);
  const featuresY = useTransform(scrollYProgress, [0.1, 0.4], [50, 0]);
  const pulseY = useTransform(scrollYProgress, [0.4, 0.7], [30, -30]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="overflow-x-hidden"
    >
      {/* Hero Section */}
      <section className="relative px-6 py-20 lg:py-32 max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-12">
        <motion.div style={{ y: heroY }} className="w-full lg:w-3/5 text-left z-10">
          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="font-headline font-extrabold text-5xl lg:text-7xl text-primary leading-tight tracking-tight mb-6"
          >
            {lang === 'EN' ? 'Your Personal AI Guidance for' : 'ನಿಮ್ಮ ವೈಯಕ್ತಿಕ AI ಮಾರ್ಗದರ್ಶನ'} <span className="text-secondary">{lang === 'EN' ? 'Scholarships' : 'ವಿದ್ಯಾರ್ಥಿವೇತನಗಳು'}</span>
          </motion.h1>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-lg lg:text-xl text-on-surface-variant max-w-2xl mb-10 leading-relaxed"
          >
            {lang === 'EN' 
              ? 'Intelligent recommendations, bilingual support (EN/KN), and career guidance for your academic journey.' 
              : 'ನಿಮ್ಮ ಶೈಕ್ಷಣಿಕ ಪ್ರಯಾಣಕ್ಕೆ ಬುದ್ಧಿವಂತ ಶಿಫಾರಸುಗಳು, ದ್ವಿಭಾಷಾ ಬೆಂಬಲ (EN/KN) ಮತ್ತು ವೃತ್ತಿ ಮಾರ್ಗದರ್ಶನ.'}
            <span className="block mt-2 text-primary font-medium">ನಿಮ್ಮ ಶೈಕ್ಷಣಿಕ ಪ್ರಯಾಣಕ್ಕೆ ಬುದ್ಧಿವಂತ ಶಿಫಾರಸುಗಳು.</span>
          </motion.p>
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex flex-wrap gap-4"
          >
            <button 
              onClick={onStart}
              className="px-8 py-4 rounded-xl bg-primary text-on-primary font-bold text-lg flex items-center gap-2 hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-primary/20"
            >
              🚀 {lang === 'EN' ? 'Start Your Search' : 'ನಿಮ್ಮ ಹುಡುಕಾಟವನ್ನು ಪ್ರಾರಂಭಿಸಿ'}
            </button>
            <button 
              onClick={onOpenChat}
              className="px-8 py-4 rounded-xl bg-secondary-container text-on-secondary-container font-semibold text-lg hover:bg-opacity-80 transition-all"
            >
              {lang === 'EN' ? 'View AI Guide' : 'AI ಮಾರ್ಗದರ್ಶಿಯನ್ನು ವೀಕ್ಷಿಸಿ'}
            </button>
          </motion.div>
          
          <div className="mt-12 flex items-center gap-6 opacity-60 grayscale hover:grayscale-0 transition-all">
            <span className="text-sm font-semibold font-label uppercase tracking-widest">Trusted By</span>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-outline-variant"></div>
              <div className="w-8 h-8 rounded-full bg-outline-variant"></div>
              <div className="w-8 h-8 rounded-full bg-outline-variant"></div>
            </div>
          </div>
        </motion.div>

        <motion.div style={{ scale: heroScale }} className="w-full lg:w-2/5 relative">
          <div className="relative w-full aspect-square flex items-center justify-center">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="absolute top-0 right-0 glass-card p-6 rounded-2xl shadow-xl ai-pulse-border w-64 z-30"
            >
              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="w-5 h-5 text-tertiary" />
                <span className="text-xs font-bold font-headline uppercase tracking-tighter text-tertiary">98% Match Found</span>
              </div>
              <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden mb-4">
                <div className="h-full bg-tertiary w-full"></div>
              </div>
              <p className="text-sm font-medium text-primary mb-1">STEM Excellence Grant</p>
              <p className="text-xs text-on-surface-variant">₹2,50,000 Per Annum</p>
            </motion.div>

            <div className="w-80 h-80 rounded-full bg-gradient-to-br from-primary via-secondary to-tertiary-container opacity-20 blur-3xl absolute animate-pulse"></div>
            <img 
              alt="Academic Achievement" 
              className="w-72 h-72 lg:w-96 lg:h-96 object-cover rounded-3xl shadow-2xl z-20" 
              src="https://picsum.photos/seed/scholarship_hero/1200/800"
              referrerPolicy="no-referrer"
            />

            <motion.div 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="absolute bottom-4 -left-8 glass-card p-6 rounded-2xl shadow-lg w-56 z-30"
            >
              <div className="flex items-center gap-2 mb-2">
                <Mic className="w-4 h-4 text-secondary" />
                <span className="text-[10px] font-bold text-on-surface-variant">LISTENING...</span>
              </div>
              <p className="text-xs italic text-primary">"Find scholarships for Masters in Data Science in Karnataka"</p>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Features Bento Grid */}
      <section className="px-6 py-24 bg-surface-container-low">
        <motion.div style={{ y: featuresY }} className="max-w-7xl mx-auto">
          <div className="mb-16">
            <h2 className="text-3xl lg:text-5xl font-headline font-bold text-primary mb-4">
              {lang === 'EN' ? 'Multi-Agent Intelligence System' : 'ಮಲ್ಟಿ-ಏಜೆಂಟ್ ಇಂಟೆಲಿಜೆನ್ಸ್ ಸಿಸ್ಟಮ್'}
            </h2>
            <p className="text-lg text-on-surface-variant max-w-2xl">
              {lang === 'EN' 
                ? 'Our advanced AI system finds the best opportunities for you.' 
                : 'ನಮ್ಮ ಸುಧಾರಿತ AI ವ್ಯವಸ್ಥೆಯು ನಿಮಗಾಗಿ ಉತ್ತಮ ಅವಕಾಶಗಳನ್ನು ಹುಡುಕುತ್ತದೆ.'}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-12 gap-6">
            <div className="md:col-span-2 lg:col-span-4 bg-surface-container-lowest p-8 rounded-3xl flex flex-col justify-between hover:bg-surface-container-high transition-colors group">
              <div className="mb-8">
                <div className="w-12 h-12 rounded-xl bg-primary-fixed flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Bot className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold font-headline mb-3 text-primary">
                  {lang === 'EN' ? 'Data Collection Agent' : 'ಡೇಟಾ ಸಂಗ್ರಹಣೆ ಏಜೆಂಟ್'}
                </h3>
                <p className="text-on-surface-variant text-sm leading-relaxed">
                  {lang === 'EN' 
                    ? 'Continuous web crawling to identify new funding opportunities across state, national, and international portals.' 
                    : 'ರಾಜ್ಯ, ರಾಷ್ಟ್ರೀಯ ಮತ್ತು ಅಂತರಾಷ್ಟ್ರೀಯ ಪೋರ್ಟಲ್‌ಗಳಲ್ಲಿ ಹೊಸ ಧನಸಹಾಯ ಅವಕಾಶಗಳನ್ನು ಗುರುತಿಸಲು ನಿರಂತರ ವೆಬ್ ಕ್ರಾಲಿಂಗ್.'}
                </p>
              </div>
              <span className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                {lang === 'EN' ? 'Explore Data' : 'ಡೇಟಾವನ್ನು ಅನ್ವೇಷಿಸಿ'} <ArrowRight className="w-4 h-4" />
              </span>
            </div>

            <div className="md:col-span-2 lg:col-span-5 bg-primary p-8 rounded-3xl text-on-primary flex flex-col justify-between">
              <div className="mb-8">
                <div className="w-12 h-12 rounded-xl bg-primary-container flex items-center justify-center mb-6">
                  <Mic className="w-6 h-6 text-on-primary-container" />
                </div>
                <h3 className="text-2xl font-bold font-headline mb-3">
                  {lang === 'EN' ? 'Multilingual Voice Search' : 'ಬಹುವಚನ ಧ್ವನಿ ಹುಡುಕಾಟ'}
                </h3>
                <p className="opacity-80 leading-relaxed">
                  {lang === 'EN' 
                    ? 'Search naturally in English or Kannada. Our AI understands regional nuances to provide localized results.' 
                    : 'ಇಂಗ್ಲಿಷ್ ಅಥವಾ ಕನ್ನಡದಲ್ಲಿ ಸಹಜವಾಗಿ ಹುಡುಕಿ. ಸ್ಥಳೀಯ ಫಲಿತಾಂಶಗಳನ್ನು ನೀಡಲು ನಮ್ಮ AI ಪ್ರಾದೇಶಿಕ ಸೂಕ್ಷ್ಮತೆಗಳನ್ನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳುತ್ತದೆ.'}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="px-4 py-2 rounded-lg bg-on-primary text-primary text-xs font-bold">
                  {lang === 'EN' ? 'Guidance' : 'ಮಾರ್ಗದರ್ಶನ'}
                </div>
                <div className="px-4 py-2 rounded-lg bg-on-primary/10 text-on-primary text-xs font-bold">
                  {lang === 'EN' ? 'Kannada Support' : 'ಕನ್ನಡ ಬೆಂಬಲ'}
                </div>
              </div>
            </div>

            <div className="md:col-span-2 lg:col-span-3 bg-tertiary-container/10 p-8 rounded-3xl flex flex-col justify-between border-2 border-tertiary-container/20">
              <div>
                <div className="w-12 h-12 rounded-xl bg-tertiary-container/20 flex items-center justify-center mb-6">
                  <FileCheck className="w-6 h-6 text-tertiary" />
                </div>
                <h3 className="text-xl font-bold font-headline mb-3 text-tertiary">
                  {lang === 'EN' ? 'Eligibility Engine' : 'ಅರ್ಹತಾ ಎಂಜಿನ್'}
                </h3>
                <p className="text-on-surface-variant text-sm">
                  {lang === 'EN' 
                    ? 'Automated document parsing and criteria matching for 100% accurate applications.' 
                    : '100% ನಿಖರವಾದ ಅರ್ಜಿಗಳಿಗಾಗಿ ಸ್ವಯಂಚಾಲಿತ ದಾಖಲೆ ಪಾರ್ಸಿಂಗ್ ಮತ್ತು ಮಾನದಂಡಗಳ ಹೊಂದಾಣಿಕೆ.'}
                </p>
              </div>
            </div>

            <div className="md:col-span-2 lg:col-span-6 bg-secondary-container p-8 rounded-3xl flex flex-col md:flex-row gap-8 items-center">
              <div className="w-full md:w-1/2">
                <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center mb-6">
                  <GraduationCap className="w-6 h-6 text-secondary" />
                </div>
                <h3 className="text-2xl font-bold font-headline mb-3 text-on-secondary-container">
                  {lang === 'EN' ? 'Career Guidance' : 'ವೃತ್ತಿ ಮಾರ್ಗದರ್ಶನ'}
                </h3>
                <p className="text-on-secondary-container opacity-80 mb-6">
                  {lang === 'EN' 
                    ? 'Beyond money, we help you map your scholarship to long-term career success and university admissions.' 
                    : 'ಹಣದ ಆಚೆಗೆ, ನಿಮ್ಮ ವಿದ್ಯಾರ್ಥಿವೇತನವನ್ನು ದೀರ್ಘಕಾಲೀನ ವೃತ್ತಿಜೀವನದ ಯಶಸ್ಸು ಮತ್ತು ವಿಶ್ವವಿದ್ಯಾಲಯದ ಪ್ರವೇಶಗಳಿಗೆ ನಕ್ಷೆ ಮಾಡಲು ನಾವು ನಿಮಗೆ ಸಹಾಯ ಮಾಡುತ್ತೇವೆ.'}
                </p>
                <button className="px-6 py-3 rounded-xl bg-secondary text-on-secondary font-bold text-sm">
                  {lang === 'EN' ? 'Pathfinder Tool' : 'ಪಾತ್‌ಫೈಂಡರ್ ಟೂಲ್'}
                </button>
              </div>
              <div className="w-full md:w-1/2">
                <img 
                  alt="Career Path Planning" 
                  className="w-full h-48 object-cover rounded-2xl shadow-inner" 
                  src="https://picsum.photos/seed/career_path/800/600"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            <div className="md:col-span-4 lg:col-span-6 bg-surface-container-highest p-8 rounded-3xl flex items-center justify-between gap-10">
              <div className="flex-1">
                <h3 className="text-2xl font-bold font-headline mb-3 text-primary">
                  {lang === 'EN' ? 'Smart Recommendations' : 'ಸ್ಮಾರ್ಟ್ ಶಿಫಾರಸುಗಳು'}
                </h3>
                <p className="text-on-surface-variant">
                  {lang === 'EN' 
                    ? 'Our recommendation agent learns from your profile to find unique grants you didn\'t know existed.' 
                    : 'ನಮ್ಮ ಶಿಫಾರಸು ಏಜೆಂಟ್ ನಿಮ್ಮ ಪ್ರೊಫೈಲ್‌ನಿಂದ ಕಲಿಯುತ್ತಾರೆ ಮತ್ತು ನಿಮಗೆ ತಿಳಿದಿಲ್ಲದ ವಿಶಿಷ್ಟ ಅನುದಾನಗಳನ್ನು ಕಂಡುಕೊಳ್ಳುತ್ತಾರೆ.'}
                </p>
              </div>
              <div className="hidden lg:flex flex-col gap-2">
                <div className="w-24 h-2 bg-primary rounded-full opacity-10"></div>
                <div className="w-16 h-2 bg-primary rounded-full opacity-30"></div>
                <div className="w-32 h-2 bg-primary rounded-full opacity-50"></div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Match Pulse Showcase */}
      <section className="py-24 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">
          <motion.div style={{ y: pulseY }} className="w-full lg:w-1/2 relative">
            <div className="absolute -inset-4 bg-tertiary-container/10 blur-3xl rounded-full"></div>
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative bg-surface dark:bg-surface-container-lowest p-1 rounded-3xl shadow-2xl overflow-hidden ai-pulse-border"
            >
              {/* Scanning Effect */}
              <motion.div 
                animate={{ 
                  top: ['0%', '100%', '0%'],
                  opacity: [0, 1, 0]
                }}
                transition={{ 
                  duration: 4, 
                  repeat: Infinity, 
                  ease: "linear" 
                }}
                className="absolute left-0 w-full h-20 bg-gradient-to-b from-transparent via-primary/10 to-transparent z-20 pointer-events-none"
              />
              
              <div className="bg-surface-container-lowest p-8 rounded-[1.4rem] relative z-10">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <p className="text-xs font-bold text-tertiary mb-1 uppercase">
                      {lang === 'EN' ? 'AI Match Analysis' : 'AI ಹೊಂದಾಣಿಕೆ ವಿಶ್ಲೇಷಣೆ'}
                    </p>
                    <h4 className="text-xl font-bold font-headline text-primary">
                      {lang === 'EN' ? 'National Merit Portal' : 'ರಾಷ್ಟ್ರೀಯ ಮೆರಿಟ್ ಪೋರ್ಟಲ್'}
                    </h4>
                  </div>
                  <motion.span 
                    initial={{ scale: 0, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 1.5, type: "spring" }}
                    className="px-3 py-1 bg-tertiary-container text-on-tertiary-container rounded-full text-[10px] font-black tracking-widest uppercase"
                  >
                    {lang === 'EN' ? 'High Match' : 'ಹೆಚ್ಚಿನ ಹೊಂದಾಣಿಕೆ'}
                  </motion.span>
                </div>
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <motion.div 
                      initial={{ scale: 0.8, opacity: 0 }}
                      whileInView={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center font-bold text-primary"
                    >
                      92%
                    </motion.div>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-medium text-on-surface-variant">
                          {lang === 'EN' ? 'Academic Fit' : 'ಶೈಕ್ಷಣಿಕ ಫಿಟ್'}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          whileInView={{ width: '92%' }}
                          transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
                          className="h-full bg-primary"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <motion.div 
                      initial={{ scale: 0.8, opacity: 0 }}
                      whileInView={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.8 }}
                      className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center font-bold text-primary"
                    >
                      85%
                    </motion.div>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-medium text-on-surface-variant">
                          {lang === 'EN' ? 'Financial Need Match' : 'ಹಣಕಾಸಿನ ಅಗತ್ಯ ಹೊಂದಾಣಿಕೆ'}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          whileInView={{ width: '85%' }}
                          transition={{ duration: 1.5, delay: 0.8, ease: "easeOut" }}
                          className="h-full bg-secondary"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <motion.button 
                  initial={{ y: 20, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  transition={{ delay: 1.8 }}
                  onClick={onStart}
                  className="w-full mt-10 py-4 rounded-xl bg-surface-container-highest text-primary font-bold flex items-center justify-center gap-2 hover:bg-primary hover:text-white transition-all group"
                >
                  <Sparkles className="w-5 h-5 fill-primary group-hover:fill-white transition-colors" />
                  {lang === 'EN' ? 'Unlock Application Guide' : 'ಅರ್ಜಿ ಮಾರ್ಗದರ್ಶಿಯನ್ನು ಅನ್ಲಾಕ್ ಮಾಡಿ'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="w-full lg:w-1/2"
          >
            <h2 className="text-4xl lg:text-5xl font-headline font-extrabold text-primary mb-6 leading-tight">
              {lang === 'EN' ? 'Precision Curation for Your Profile.' : 'ನಿಮ್ಮ ಪ್ರೊಫೈಲ್‌ಗಾಗಿ ನಿಖರವಾದ ಕ್ಯುರೇಶನ್.'}
            </h2>
            <p className="text-lg text-on-surface-variant mb-8 leading-relaxed">
              {lang === 'EN' 
                ? 'Our AI doesn\'t just list scholarships; it analyzes 42 different data points—from your family background and academic scores to your future career ambitions—to find the 0.1% of funding opportunities that are perfect for you.' 
                : 'ನಮ್ಮ AI ಕೇವಲ ವಿದ್ಯಾರ್ಥಿವೇತನಗಳನ್ನು ಪಟ್ಟಿ ಮಾಡುವುದಿಲ್ಲ; ಇದು ನಿಮ್ಮ ಕುಟುಂಬದ ಹಿನ್ನೆಲೆ ಮತ್ತು ಶೈಕ್ಷಣಿಕ ಅಂಕಗಳಿಂದ ನಿಮ್ಮ ಭವಿಷ್ಯದ ವೃತ್ತಿಜೀವನದ ಮಹತ್ವಾಕಾಂಕ್ಷೆಗಳವರೆಗೆ 42 ವಿಭಿನ್ನ ಡೇಟಾ ಪಾಯಿಂಟ್‌ಗಳನ್ನು ವಿಲೇಷಿಸುತ್ತದೆ - ನಿಮಗಾಗಿ ಪರಿಪೂರ್ಣವಾಗಿರುವ 0.1% ಧನಸಹಾಯ ಅವಕಾಶಗಳನ್ನು ಕಂಡುಹಿಡಿಯಲು.'}
            </p>
            <ul className="space-y-4">
              {[
                { en: 'Zero false eligibility results', kn: 'ಶೂನ್ಯ ತಪ್ಪು ಅರ್ಹತೆಯ ಫಲಿತಾಂಶಗಳು' },
                { en: 'Direct application links with automated forms', kn: 'ಸ್ವಯಂಚಾಲಿತ ಫಾರ್ಮ್‌ಗಳೊಂದಿಗೆ ನೇರ ಅಪ್ಲಿಕೇಶನ್ ಲಿಂಕ್‌ಗಳು' },
                { en: 'Priority alerts for Karnataka State Scholarships', kn: 'ಕರ್ನಾಟಕ ರಾಜ್ಯ ವಿದ್ಯಾರ್ಥಿವೇತನಗಳಿಗೆ ಆದ್ಯತೆಯ ಎಚ್ಚರಿಕೆಗಳು' }
              ].map((item, idx) => (
                <motion.li 
                  key={idx}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + (idx * 0.2) }}
                  className="flex items-center gap-3 text-primary font-medium"
                >
                  <CheckCircle className="w-5 h-5 text-secondary" />
                  {lang === 'EN' ? item.en : item.kn}
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>
      </section>
    </motion.div>
  );
};

const Sidebar = ({ currentPage, onNavigate, savedCount, lang }: { 
  currentPage: Page, 
  onNavigate: (p: Page) => void,
  savedCount: number,
  lang: Language
}) => (
  <aside className="fixed left-0 top-0 h-screen hidden md:flex flex-col p-4 bg-surface dark:bg-surface-container-lowest border-r border-outline-variant/30 w-64 z-40">
    <div className="mb-10 mt-4 px-4">
      <div className="text-lg font-black text-primary headline">Curator AI</div>
    </div>
    
    <div className="px-4 mb-6">
      <p className="text-sm font-bold headline text-primary">{lang === 'EN' ? 'Welcome Back' : 'ಮತ್ತೆ ಸ್ವಾಗತ'}</p>
      <p className="text-[10px] text-on-surface-variant">{lang === 'EN' ? 'Ready for your next scholarship?' : 'ನಿಮ್ಮ ಮುಂದಿನ ವಿದ್ಯಾರ್ಥಿವೇತನಕ್ಕೆ ಸಿದ್ಧರಿದ್ದೀರಾ?'}</p>
    </div>

    <div className="space-y-2 flex-1">
      <button 
        onClick={() => onNavigate('landing')}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${currentPage === 'landing' ? 'bg-primary-container/20 text-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}
      >
        <Home className="w-5 h-5" />
        <span className="font-medium">{lang === 'EN' ? 'AI Guidance' : 'AI ಮಾರ್ಗದರ್ಶನ'}</span>
      </button>
      <button 
        onClick={() => onNavigate('search')}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${currentPage === 'search' ? 'bg-primary-container/20 text-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}
      >
        <Search className="w-5 h-5" />
        <span className="font-medium">{lang === 'EN' ? 'Search' : 'ಹುಡುಕಿ'}</span>
      </button>
      <button 
        onClick={() => onNavigate('dashboard')}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${currentPage === 'dashboard' ? 'bg-primary-container/20 text-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}
      >
        <Sparkles className={`w-5 h-5 ${currentPage === 'dashboard' ? 'fill-primary' : ''}`} />
        <span className="font-medium">{lang === 'EN' ? 'My Matches' : 'ನನ್ನ ಪಂದ್ಯಗಳು'}</span>
      </button>
      <button 
        onClick={() => onNavigate('saved')}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors ${currentPage === 'saved' ? 'bg-primary-container/20 text-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}
      >
        <div className="flex items-center gap-3">
          <Bookmark className={`w-5 h-5 ${currentPage === 'saved' ? 'fill-primary' : ''}`} />
          <span className="font-medium">{lang === 'EN' ? 'Saved' : 'ಉಳಿಸಲಾಗಿದೆ'}</span>
        </div>
        {savedCount > 0 && (
          <span className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            {savedCount}
          </span>
        )}
      </button>
      <button 
        onClick={() => onNavigate('about')}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${currentPage === 'about' ? 'bg-primary-container/20 text-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}
      >
        <Info className="w-5 h-5" />
        <span className="font-medium">{lang === 'EN' ? 'About' : 'ಬಗ್ಗೆ'}</span>
      </button>
      <button 
        onClick={() => window.dispatchEvent(new CustomEvent('openChat'))}
        className="w-full flex items-center gap-3 text-on-surface-variant px-4 py-3 hover:bg-surface-container rounded-xl transition-colors"
      >
        <HelpCircle className="w-5 h-5" />
        <span className="font-medium">{lang === 'EN' ? 'Help' : 'ಸಹಾಯ'}</span>
      </button>
    </div>

    <div className="mt-auto">
      <button 
        onClick={() => onNavigate('search')}
        className="w-full py-3 bg-primary text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
      >
        <Sparkles className="w-4 h-4 fill-white" />
        {lang === 'EN' ? 'Find with AI' : 'AI ನೊಂದಿಗೆ ಹುಡುಕಿ'}
      </button>
    </div>
  </aside>
);

const SearchPage = ({ onSearch, lang, onNavigate, onOpenChat }: { 
  onSearch: (filters: SearchFilters) => void, 
  lang: Language,
  onNavigate: (page: Page) => void,
  onOpenChat: () => void
}) => {
  const [filters, setFilters] = useState<SearchFilters>({
    course: '',
    category: '',
    income: '',
    cgpa: '',
    type: 'All',
    tags: []
  });
  const [errors, setErrors] = useState<Partial<Record<keyof SearchFilters, string>>>({});
  const [isSearching, setIsSearching] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showDocsModal, setShowDocsModal] = useState(false);

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = lang === 'EN' ? 'en-IN' : 'kn-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      await processVoiceQuery(transcript);
    };

    recognition.start();
  };

  const processVoiceQuery = async (query: string) => {
    setIsSearching(true);
    try {
      const apiKey = process.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        console.warn("Gemini API key not configured. Voice query processing unavailable.");
        return;
      }
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Extract scholarship search filters from this query: "${query}". 
        Available options:
        - course: "10", "12", "B.Com", "BCA", "B.Sc", "BBA", "BA", "B.Tech", "M.Tech", "MBA", "MCA", "M.Sc", "M.Com", "PhD", "MBBS"
        - category: "2A", "3A", "3B", "SC", "ST", "OBC", "EWS", "PWD"
        - income: "< 1L", "1 - 2.5L", "2.5 - 5L"
        - cgpa: "9+", "8+", "7+", "6+"
        - type: "State", "Central", "Private", "All"
        - tags: array of strings from ['B.Tech', 'M.Tech', 'MBBS', '2A', '3A', '3B', 'SC', 'ST', 'OBC', 'EWS', 'PWD', '< 1L', 'State', 'Central', 'Private']
        
        Return ONLY a JSON object matching the SearchFilters interface.`,
        config: { responseMimeType: "application/json" }
      });

      const result = JSON.parse(response.text);
      setFilters(prev => ({ ...prev, ...result }));
    } catch (error) {
      console.error("Error processing voice query", error);
    } finally {
      setIsSearching(false);
    }
  };

  const validate = () => {
    const newErrors: Partial<Record<keyof SearchFilters, string>> = {};
    if (!filters.course) newErrors.course = lang === 'EN' ? 'Please select a course level' : 'ದಯವಿಟ್ಟು ಕೋರ್ಸ್ ಮಟ್ಟವನ್ನು ಆಯ್ಕೆಮಾಡಿ';
    if (!filters.category) newErrors.category = lang === 'EN' ? 'Please select a category' : 'ದಯವಿಟ್ಟು ವರ್ಗವನ್ನು ಆಯ್ಕೆಮಾಡಿ';
    if (!filters.income) newErrors.income = lang === 'EN' ? 'Please select an income range' : 'ದಯವಿಟ್ಟು ಆದಾಯದ ಶ್ರೇಣಿಯನ್ನು ಆಯ್ಕೆಮಾಡಿ';
    if (!filters.cgpa) newErrors.cgpa = lang === 'EN' ? 'Please select your academic grade' : 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಶೈಕ್ಷಣಿಕ ದರ್ಜೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const toggleTag = (tag: string) => {
    setFilters(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) 
        ? prev.tags.filter(t => t !== tag) 
        : [...prev.tags, tag]
    }));
  };

  const handleFind = () => {
    if (validate()) {
      setIsSearching(true);
      setTimeout(() => {
        onSearch(filters);
        setIsSearching(false);
      }, 1500);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="md:ml-64 p-6 md:p-10 max-w-7xl"
    >
      <header className="mb-10">
        <h1 className="text-4xl md:text-5xl font-extrabold headline tracking-tight mb-4 text-primary">
          {lang === 'EN' ? 'Find Your Scholarship' : 'ನಿಮ್ಮ ವಿದ್ಯಾರ್ಥಿವೇತನವನ್ನು ಹುಡುಕಿ'}
        </h1>
        <p className="text-on-surface-variant max-w-2xl leading-relaxed">
          {lang === 'EN' 
            ? 'Let our editorial intelligence curate the best opportunities tailored to your academic profile and socioeconomic background.' 
            : 'ನಿಮ್ಮ ಶೈಕ್ಷಣಿಕ ಪ್ರೊಫೈಲ್ ಮತ್ತು ಸಾಮಾಜಿಕ ಆರ್ಥಿಕ ಹಿನ್ನೆಲೆಗೆ ಅನುಗುಣವಾಗಿ ಉತ್ತಮ ಅವಕಾಶಗಳನ್ನು ಕ್ಯುರೇಟ್ ಮಾಡಲು ನಮ್ಮ ಸಂಪಾದಕೀಯ ಬುದ್ಧಿವಂತಿಕೆಗೆ ಅವಕಾಶ ನೀಡಿ.'}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Form Area */}
        <div className="lg:col-span-8 bg-surface dark:bg-surface-container-lowest rounded-3xl p-8 shadow-sm border border-outline-variant">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-bold text-primary headline">
                <GraduationCap className="w-4 h-4" /> {lang === 'EN' ? 'Course' : 'ಕೋರ್ಸ್'}
              </label>
              <div className="relative">
                <select 
                  value={filters.course}
                  onChange={(e) => setFilters({...filters, course: e.target.value})}
                  className={`w-full appearance-none bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 ${errors.course ? 'ring-2 ring-error/20' : ''}`}
                >
                  <option value="">{lang === 'EN' ? 'Select Level' : 'ಮಟ್ಟವನ್ನು ಆಯ್ಕೆಮಾಡಿ'}</option>
                  <option value="10">{lang === 'EN' ? '10th Grade' : '10ನೇ ತರಗತಿ'}</option>
                  <option value="12">{lang === 'EN' ? '12th Grade' : '12ನೇ ತರಗತಿ'}</option>
                  <option value="B.Tech">{lang === 'EN' ? 'B.Tech / Engineering' : 'ಬಿ.ಟೆಕ್ / ಎಂಜಿನಿಯರಿಂಗ್'}</option>
                  <option value="B.Com">{lang === 'EN' ? 'B.Com / Commerce' : 'ಬಿ.ಕಾಂ / ವಾಣಿಜ್ಯ'}</option>
                  <option value="B.Sc">{lang === 'EN' ? 'B.Sc / Science' : 'ಬಿ.ಎಸ್ಸಿ / ವಿಜ್ಞಾನ'}</option>
                  <option value="BCA">{lang === 'EN' ? 'BCA / Computer Apps' : 'BCA / ಕಂಪ್ಯೂಟರ ಅಪ್ಲಿಕೇಶನ್ಸ್'}</option>
                  <option value="BBA">{lang === 'EN' ? 'BBA / Business Admin' : 'BBA / ಬ್ಯುಸಿನೆಸ್ ಅಡ್ಮಿನಿಸ್ಟ್ರೇಶನ್'}</option>
                  <option value="BA">{lang === 'EN' ? 'BA / Arts' : 'BA / ಕಲೆ'}</option>
                  <option value="M.Tech">{lang === 'EN' ? 'M.Tech / Engineering Masters' : 'ಎಂ.ಟೆಕ್ / ಎಂजीನಿಯರಿಂಗ್ ಮಾಸ್ಟರ್ಸ್'}</option>
                  <option value="MBA">{lang === 'EN' ? 'MBA / Business Masters' : 'MBA / ಬ್ಯುಸಿನೆಸ್ ಮಾಸ್ಟರ್ಸ್'}</option>
                  <option value="MCA">{lang === 'EN' ? 'MCA / Computer Masters' : 'MCA / ಕಂಪ್ಯೂಟರ ಮಾಸ್ಟರ್ಸ್'}</option>
                  <option value="M.Sc">{lang === 'EN' ? 'M.Sc / Science Masters' : 'M.Sc / ವಿಜ್ಞಾನ ಮಾಸ್ಟರ್ಸ್'}</option>
                  <option value="M.Com">{lang === 'EN' ? 'M.Com / Commerce Masters' : 'M.Com / ವಾಣಿಜ್ಯ ಮಾಸ್ಟರ್ಸ್'}</option>
                  <option value="MBBS">{lang === 'EN' ? 'MBBS / Medical' : 'MBBS / ವೈದ್ಯಕೀಯ'}</option>
                  <option value="PhD">{lang === 'EN' ? 'PhD / Research' : 'ಪಿಎಚ್‌ಡಿ / ಸಂಶೋಧನೆ'}</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
              </div>
              {errors.course && <p className="text-[10px] text-error font-medium">{errors.course}</p>}
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-bold text-primary headline">
                <UserCircle className="w-4 h-4" /> {lang === 'EN' ? 'Category' : 'ವರ್ಗ'}
              </label>
              <div className="relative">
                <select 
                  value={filters.category}
                  onChange={(e) => setFilters({...filters, category: e.target.value})}
                  className={`w-full appearance-none bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 ${errors.category ? 'ring-2 ring-error/20' : ''}`}
                >
                  <option value="">{lang === 'EN' ? 'Select Category' : 'ವರ್ಗವನ್ನು ಆಯ್ಕೆಮಾಡಿ'}</option>
                  <option value="2A">{lang === 'EN' ? '2A' : '2ಎ'}</option>
                  <option value="3A">{lang === 'EN' ? '3A' : '3ಎ'}</option>
                  <option value="3B">{lang === 'EN' ? '3B' : '3ಬಿ'}</option>
                  <option value="SC">{lang === 'EN' ? 'SC' : 'ಎಸ್‌ಸಿ'}</option>
                  <option value="ST">{lang === 'EN' ? 'ST' : 'ಎಸ್‌ಟಿ'}</option>
                  <option value="OBC">{lang === 'EN' ? 'OBC' : 'ಒಬಿಸಿ'}</option>
                  <option value="EWS">{lang === 'EN' ? 'EWS' : 'ಆರ್ಥಿಕ ದುರ್ಬಲ ವರ್ಗ (EWS)'}</option>
                  <option value="PWD">{lang === 'EN' ? 'PWD' : 'ವಿಕಲಚೇತನರು (PWD)'}</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
              </div>
              {errors.category && <p className="text-[10px] text-error font-medium">{errors.category}</p>}
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-bold text-primary headline">
                <IndianRupee className="w-4 h-4" /> {lang === 'EN' ? 'Annual Income' : 'ವಾರ್ಷಿಕ ಆದಾಯ'}
              </label>
              <div className="relative">
                <select 
                  value={filters.income}
                  onChange={(e) => setFilters({...filters, income: e.target.value})}
                  className={`w-full appearance-none bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 ${errors.income ? 'ring-2 ring-error/20' : ''}`}
                >
                  <option value="">{lang === 'EN' ? 'Income Range' : 'ಆದಾಯದ ಶ್ರೇಣಿ'}</option>
                  <option value="< 1L">{lang === 'EN' ? '< 1 Lakh' : '< 1 ಲಕ್ಷ'}</option>
                  <option value="1 - 2.5L">{lang === 'EN' ? '1 - 2.5 Lakhs' : '1 - 2.5 ಲಕ್ಷಗಳು'}</option>
                  <option value="2.5 - 5L">{lang === 'EN' ? '2.5 - 5 Lakhs' : '2.5 - 5 ಲಕ್ಷಗಳು'}</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
              </div>
              {errors.income && <p className="text-[10px] text-error font-medium">{errors.income}</p>}
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-bold text-primary headline">
                <TrendingUp className="w-4 h-4" /> {lang === 'EN' ? 'Current CGPA / %' : 'ಪ್ರಸ್ತುತ CGPA / %'}
              </label>
              <div className="relative">
                <select 
                  value={filters.cgpa}
                  onChange={(e) => setFilters({...filters, cgpa: e.target.value})}
                  className={`w-full appearance-none bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 ${errors.cgpa ? 'ring-2 ring-error/20' : ''}`}
                >
                  <option value="">{lang === 'EN' ? 'Academic Grade' : 'ಶೈಕ್ಷಣಿಕ ದರ್ಜೆ'}</option>
                  <option value="9+">9.0+ CGPA / 90%+</option>
                  <option value="8+">8.0+ CGPA / 80%+</option>
                  <option value="7+">7.0+ CGPA / 70%+</option>
                  <option value="6+">6.0+ CGPA / 60%+</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
              </div>
              {errors.cgpa && <p className="text-[10px] text-error font-medium">{errors.cgpa}</p>}
            </div>
          </div>

          <div className="space-y-4 mb-10">
            <label className="flex items-center gap-2 text-sm font-bold text-primary headline">
              <Globe className="w-4 h-4" /> {lang === 'EN' ? 'Scholarship Type' : 'ವಿದ್ಯಾರ್ಥಿವೇತನ ಪ್ರಕಾರ'}
            </label>
            <div className="flex flex-wrap gap-3">
              {(['All', 'State', 'Central', 'Private'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilters({...filters, type: t})}
                  className={`px-6 py-2 rounded-xl text-sm font-medium transition-all ${filters.type === t ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'}`}
                >
                  {lang === 'EN' ? (t === 'State' ? 'State Government' : t === 'Central' ? 'Central Government' : t === 'Private' ? 'Private Trusts' : 'All Types') : (t === 'State' ? 'ರಾಜ್ಯ ಸರ್ಕಾರ' : t === 'Central' ? 'ಕೇಂದ್ರ ಸರ್ಕಾರ' : t === 'Private' ? 'ಖಾಸಗಿ ಟ್ರಸ್ಟ್ಗಳು' : 'ಎಲ್ಲಾ ಪ್ರಕಾರಗಳು')}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <label className="flex items-center gap-2 text-sm font-bold text-primary headline">
              <Settings2 className="w-4 h-4" /> {lang === 'EN' ? 'Filter by Tags' : 'ಟ್ಯಾಗ್‌ಗಳ ಮೂಲಕ ಫಿಲ್ಟರ್ ಮಾಡಿ'}
            </label>
            <div className="flex flex-wrap gap-2">
              {['B.Tech', 'M.Tech', 'OBC', '< 1L', 'State', 'Central', 'Private'].map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-4 py-2 rounded-full text-xs font-medium transition-all border ${
                    filters.tags.includes(tag) 
                      ? 'bg-primary text-white border-primary shadow-md' 
                      : 'bg-surface dark:bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:border-primary'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <button 
            onClick={handleFind}
            disabled={isSearching}
            className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-3 hover:opacity-90 transition-all active:scale-[0.98] shadow-xl shadow-primary/10 disabled:opacity-70"
          >
            {isSearching ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {lang === 'EN' ? 'Analyzing Profile...' : 'ಪ್ರೊಫೈಲ್ ವಿಶ್ಲೇಷಿಸಲಾಗುತ್ತಿದೆ...'}
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 fill-white" />
                {lang === 'EN' ? 'Find Scholarships' : 'ವಿದ್ಯಾರ್ಥಿವೇತನಗಳನ್ನು ಹುಡುಕಿ'}
              </>
            )}
          </button>
        </div>

        {/* Sidebar Cards */}
        <div className="lg:col-span-4 space-y-6">
          <div 
            onClick={startListening}
            className={`rounded-3xl p-8 relative overflow-hidden group cursor-pointer transition-all ${isListening ? 'bg-primary text-white ring-4 ring-primary/20' : 'bg-tertiary-container/20'}`}
          >
            <div className="relative z-10">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform ${isListening ? 'bg-surface dark:bg-surface-container-lowest text-primary' : 'bg-surface dark:bg-surface-container-lowest text-tertiary'}`}>
                <Mic className={`w-6 h-6 ${isListening ? 'animate-pulse' : ''}`} />
              </div>
              <h3 className={`text-xl font-bold headline mb-2 ${isListening ? 'text-white' : 'text-primary'}`}>
                {isListening ? (lang === 'EN' ? 'Listening...' : 'ಆಲಿಸಲಾಗುತ್ತಿದೆ...') : (lang === 'EN' ? 'Speak Now' : 'ಈಗ ಮಾತನಾಡಿ')}
              </h3>
              <p className={`text-sm mb-6 ${isListening ? 'text-white/80' : 'text-on-surface-variant'}`}>
                {lang === 'EN' ? 'Describe your needs in English or Kannada' : 'ನಿಮ್ಮ ಅಗತ್ಯಗಳನ್ನು ಇಂಗ್ಲಿಷ್ ಅಥವಾ ಕನ್ನಡದಲ್ಲಿ ವಿವರಿಸಿ'}
              </p>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <div 
                    key={i} 
                    className={`w-1 rounded-full ${isListening ? 'bg-white animate-bounce' : 'bg-tertiary animate-pulse'}`} 
                    style={{ 
                      height: isListening ? `${Math.random() * 32 + 12}px` : `${Math.random() * 24 + 8}px`, 
                      animationDelay: `${i * 0.1}s`,
                      animationDuration: isListening ? '0.5s' : '1.5s'
                    }}
                  ></div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-blue-50/50 rounded-3xl p-8 space-y-6">
            <h3 className="text-sm font-bold headline text-primary flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> {lang === 'EN' ? 'Quick Actions' : 'ತ್ವರಿತ ಕ್ರಮಗಳು'}
            </h3>
            <div className="space-y-3">
              {[
                { 
                  label: lang === 'EN' ? 'Saved Scholarships' : 'ಉಳಿಸಿದ ವಿದ್ಯಾರ್ಥಿವೇತನಗಳು', 
                  icon: Bookmark,
                  onClick: () => onNavigate('saved')
                },
                { 
                  label: lang === 'EN' ? 'Help & Guidance' : 'ಸಹಾಯ ಮತ್ತು ಮಾರ್ಗದರ್ಶನ', 
                  icon: HelpCircle,
                  onClick: onOpenChat
                },
                { 
                  label: lang === 'EN' ? 'Eligibility Docs' : 'ಅರ್ಹತಾ ದಾಖಲೆಗಳು', 
                  icon: FileText,
                  onClick: () => setShowDocsModal(true)
                },
                { 
                  label: lang === 'EN' ? 'Profile Settings' : 'ಪ್ರೊಫೈಲ್ ಸೆಟ್ಟಿಂಗ್‌ಗಳು', 
                  icon: Settings2,
                  onClick: () => onNavigate('profile')
                },
              ].map((action, idx) => (
                <button 
                  key={idx} 
                  onClick={action.onClick}
                  className="w-full flex items-center justify-between p-4 bg-surface dark:bg-surface-container-lowest rounded-2xl text-sm font-medium text-primary hover:bg-surface-container transition-colors shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <action.icon className="w-4 h-4 text-on-surface-variant" />
                    {action.label}
                  </div>
                  <ChevronRight className="w-4 h-4 text-outline-variant" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showDocsModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowDocsModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface dark:bg-surface-container-lowest rounded-3xl p-8 max-w-md w-full shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-bold text-primary headline">
                  {lang === 'EN' ? 'Required Documents' : 'ಅಗತ್ಯವಿರುವ ದಾಖಲೆಗಳು'}
                </h2>
                <button onClick={() => setShowDocsModal(false)} className="p-1 hover:bg-slate-100 rounded-full">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              <div className="space-y-4 mb-8">
                {[
                  { en: 'Income Certificate', kn: 'ಆದಾಯ ಪ್ರಮಾಣಪತ್ರ' },
                  { en: 'Caste Certificate', kn: 'ಜಾತಿ ಪ್ರಮಾಣಪತ್ರ' },
                  { en: 'Previous Year Marks Cards', kn: 'ಹಿಂದಿನ ವರ್ಷದ ಅಂಕಪಟ್ಟಿಗಳು' },
                  { en: 'Aadhar Card', kn: 'ಆಧಾರ್ ಕಾರ್ಡ್' },
                  { en: 'Bank Passbook (Front Page)', kn: 'ಬ್ಯಾಂಕ್ ಪಾಸ್‌ಬುಕ್ (ಮುಂಭಾಗದ ಪುಟ)' },
                  { en: 'Fee Receipt (Current Year)', kn: 'ಶುಲ್ಕ ರಶೀದಿ (ಪ್ರಸ್ತುತ ವರ್ಷ)' },
                  { en: 'Study Certificate', kn: 'ವ್ಯಾಸಂಗ ಪ್ರಮಾಣಪತ್ರ' }
                ].map((doc, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-surface-container-low rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                      {i + 1}
                    </div>
                    <p className="text-sm text-on-surface-variant">
                      {lang === 'EN' ? doc.en : doc.kn}
                    </p>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => setShowDocsModal(false)}
                className="w-full py-4 bg-primary text-white rounded-2xl font-bold hover:opacity-90 transition-all"
              >
                {lang === 'EN' ? 'Got it!' : 'ಸರಿ'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Banner */}
      <div className="mt-12 bg-blue-50 rounded-3xl p-10 flex flex-col md:flex-row items-center gap-10 overflow-hidden relative">
        <div className="flex-1 relative z-10">
          <p className="text-xs font-bold text-primary uppercase tracking-widest mb-2">{lang === 'EN' ? 'Curated for You' : 'ನಿಮಗಾಗಿ ಕ್ಯುರೇಟ್ ಮಾಡಲಾಗಿದೆ'}</p>
          <h2 className="text-3xl font-extrabold headline text-primary mb-6">{lang === 'EN' ? 'Indian Students Academic Excellence Programs' : 'ಭಾರತೀಯ ವಿದ್ಯಾರ್ಥಿಗಳ ಶೈಕ್ಷಣಿಕ ಉತ್ಕೃಷ್ಟ ಕಾರ್ಯಕ್ರಮಗಳು'}</h2>
          <p className="text-on-surface-variant mb-8 leading-relaxed">
            {lang === 'EN' 
              ? 'Explore the highest-rated scholarships based on the 2024 academic cycle. Our system updates every 6 hours with new central and state notifications.' 
              : '2024 ರ ಶೈಕ್ಷಣಿಕ ಚಕ್ರದ ಆಧಾರದ ಮೇಲೆ ಅತಿ ಹೆಚ್ಚು ರೇಟ್ ಮಾಡಲಾದ ವಿದ್ಯಾರ್ಥಿವೇತನಗಳನ್ನು ಅನ್ವೇಷಿಸಿ. ನಮ್ಮ ಸಿಸ್ಟಮ್ ಪ್ರತಿ 6 ಗಂಟೆಗಳಿಗೊಮ್ಮೆ ಹೊಸ ಕೇಂದ್ರ ಮತ್ತು ರಾಜ್ಯ ಅಧಿಸೂಚನೆಗಳೊಂದಿಗೆ ನವೀಕರಿಸಲ್ಪಡುತ್ತದೆ.'}
          </p>
          <div className="flex flex-wrap gap-6">
            <div className="bg-surface dark:bg-surface-container-lowest px-6 py-4 rounded-2xl shadow-sm">
              <p className="text-2xl font-black text-primary">12k+</p>
              <p className="text-[10px] font-bold text-on-surface-variant uppercase">{lang === 'EN' ? 'Active Portals' : 'ಸಕ್ರಿಯ ಪೋರ್ಟಲ್‌ಗಳು'}</p>
            </div>
            <div className="bg-surface dark:bg-surface-container-lowest px-6 py-4 rounded-2xl shadow-sm">
              <p className="text-2xl font-black text-primary">₹40Cr</p>
              <p className="text-[10px] font-bold text-on-surface-variant uppercase">{lang === 'EN' ? 'Disbursed Weekly' : 'ವಾರಕ್ಕೊಮ್ಮೆ ವಿತರಿಸಲಾಗುತ್ತದೆ'}</p>
            </div>
          </div>
        </div>
        <div className="w-full md:w-1/2 relative">
           <img 
            alt="Students Collaborating" 
            className="w-full h-64 object-cover rounded-2xl shadow-xl" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDbm705SFv4I-M8f1sC1FMRLJcN-M5Zd-_OpeV9RGMqqCNeCyATcxOSWYrxIIh3k1CPzH5qBuJ_xH0Fyod_IVw7X2vXz3-Q9D6kPh2F8O_riI--LICDGscY7iBBoD3DfyNlSdNIyTCYigXhaA1WrPwayCqm3YG8-bvrtLXJYk1c1hYH8aZj8XkgwN9L4JNBW-3UyMERe9FBS1NAD8EIm2Xdtl4aB3_hhv_DslFiHZZIibecKrmNiG_HCt7N0rRCTPfHhFYd7o5zK7g"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
    </motion.div>
  );
};

const UniversityFinder = ({ profile, lang }: { profile: UserProfile, lang: Language }) => {
  const [suggestions, setSuggestions] = useState<{ name: string, location: string, course: string, reason: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const findUniversities = async () => {
    setLoading(true);
    try {
      const apiKey = process.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        console.warn("Gemini API key not configured. University finder unavailable.");
        setLoading(false);
        return;
      }
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: `Suggest 3 top universities or colleges in India for a student with the following profile:
        Course: ${profile.course}
        CGPA: ${profile.cgpa}
        Career Goals: ${profile.careerGoals}
        
        Provide the response in JSON format as an array of objects with keys: name, location, course, reason.
        The reason should explain why it's a good fit for this student.`,
        config: { responseMimeType: "application/json" }
      });
      
      const data = JSON.parse(response.text || '[]');
      setSuggestions(data);
    } catch (error) {
      console.error('Error finding universities:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface dark:bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-outline-variant">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-secondary/10 rounded-xl">
            <School className="w-6 h-6 text-secondary" />
          </div>
          <div>
            <h3 className="font-bold headline text-primary">
              {lang === 'EN' ? 'University Finder' : 'ವಿಶ್ವವಿದ್ಯಾಲಯ ಶೋಧಕ'}
            </h3>
            <p className="text-xs text-on-surface-variant">
              {lang === 'EN' ? 'Find the best colleges for your profile' : 'ನಿಮ್ಮ ಪ್ರೊಫೈಲ್‌ಗಾಗಿ ಅತ್ಯುತ್ತಮ ಕಾಲೇಜುಗಳನ್ನು ಹುಡುಕಿ'}
            </p>
          </div>
        </div>
        <button 
          onClick={findUniversities}
          disabled={loading}
          className="px-4 py-2 bg-secondary text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? <Sparkles className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {lang === 'EN' ? 'Find Now' : 'ಈಗ ಹುಡುಕಿ'}
        </button>
      </div>

      {suggestions.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {suggestions.map((uni, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant hover:border-secondary transition-all group"
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-primary group-hover:text-secondary transition-colors">{uni.name}</h4>
                <span className="text-[10px] font-bold uppercase tracking-widest bg-secondary/10 text-secondary px-2 py-1 rounded-md">
                  {uni.location}
                </span>
              </div>
              <p className="text-xs text-on-surface-variant mb-2 font-medium">{uni.course}</p>
              <p className="text-xs text-on-surface-variant leading-relaxed opacity-80">{uni.reason}</p>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="py-10 text-center border-2 border-dashed border-outline-variant rounded-2xl">
          <Building className="w-10 h-10 text-outline-variant mx-auto mb-3" />
          <p className="text-sm text-on-surface-variant">
            {lang === 'EN' 
              ? 'Click "Find Now" to get personalized university recommendations.' 
              : 'ವೈಯಕ್ತಿಕಗೊಳಿಸಿದ ವಿಶ್ವವಿದ್ಯಾಲಯ ಶಿಫಾರಸುಗಳನ್ನು ಪಡೆಯಲು "ಈಗ ಹುಡುಕಿ" ಕ್ಲಿಕ್ ಮಾಡಿ.'}
          </p>
        </div>
      )}
    </div>
  );
};

const DashboardPage = ({ filters, savedIds, onToggleSave, onSelectScholarship, userProfile, lang, onNavigate, onOpenChat }: { 
  filters: SearchFilters | null, 
  savedIds: string[],
  onToggleSave: (id: string) => void,
  onSelectScholarship: (id: string) => void,
  userProfile: UserProfile,
  lang: Language,
  onNavigate: (page: Page) => void,
  onOpenChat: () => void
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'match' | 'deadline' | 'reward'>('match');
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [aiScholarships, setAiScholarships] = useState<any[]>([]);

  // Fetch AI-powered scholarship recommendations
  useEffect(() => {
    const fetchScholarships = async () => {
      setIsLoading(true);
      try {
        const results = await getHybridScholarships(userProfile, filters || undefined);
        setAiScholarships(results);
      } catch (error) {
        console.error('Failed to fetch scholarships:', error);
        setAiScholarships([]);
      } finally {
        setTimeout(() => setIsLoading(false), 1200);
      }
    };

    fetchScholarships();
  }, [filters, userProfile.course, userProfile.category, userProfile.income, userProfile.cgpa]);

  const filteredScholarships = useMemo(() => {
    // Use AI-powered results
    let results = [...aiScholarships];

    // Apply sorting
    if (sortBy === 'match') {
      results.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
    } else if (sortBy === 'deadline') {
      results.sort((a, b) => {
        const dateA = new Date(a.deadline + ' 2026');
        const dateB = new Date(b.deadline + ' 2026');
        return dateA.getTime() - dateB.getTime();
      });
    }

    return results;
  }, [aiScholarships, sortBy]);

  const careerSuggestion = useMemo(() => {
    const topScholarship = filteredScholarships[0];
    const goals = userProfile.careerGoals?.toLowerCase() || '';
    const course = userProfile.course?.toLowerCase() || '';
    const cgpa = parseFloat(userProfile.cgpa) || 0;
    
    let en = '';
    let kn = '';
    
    if (goals.includes('research') || goals.includes('phd') || goals.includes('scientist')) {
      en = `Based on your interest in research and your ${userProfile.cgpa} CGPA, you are an excellent candidate for the ${topScholarship?.title || 'Research'} grants. Consider exploring PhD paths at top Indian institutes.`;
      kn = `ಸಂಶೋಧನೆಯಲ್ಲಿನ ನಿಮ್ಮ ಆಸಕ್ತಿ ಮತ್ತು ನಿಮ್ಮ ${userProfile.cgpa} CGPA ಆಧರಿಸಿ, ನೀವು ${topScholarship?.title || 'ಸಂಶೋಧನಾ'} ಅನುದಾನಗಳಿಗೆ ಅತ್ಯುತ್ತಮ ಅಭ್ಯರ್ಥಿಯಾಗಿದ್ದೀರಿ. ಉನ್ನತ ಭಾರತೀಯ ಸಂಸ್ಥೆಗಳಲ್ಲಿ PhD ಮಾರ್ಗಗಳನ್ನು ಅನ್ವೇಷಿಸುವುದನ್ನು ಪರಿಗಣಿಸಿ.`;
    } else if (goals.includes('engineer') || course.includes('tech') || course.includes('engineering')) {
      en = `With your background in ${userProfile.course}, you should target technical excellence scholarships. Your profile matches well with industry-sponsored grants for future engineers.`;
      kn = `${userProfile.course} ನಲ್ಲಿನ ನಿಮ್ಮ ಹಿನ್ನೆಲೆಯೊಂದಿಗೆ, ನೀವು ತಾಂತ್ರಿಕ ಶ್ರೇಷ್ಠತೆಯ ವಿದ್ಯಾರ್ಥಿವೇತನಗಳನ್ನು ಗುರಿಯಾಗಿಸಿಕೊಳ್ಳಬೇಕು. ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಭವಿಷ್ಯದ ಎಂಜಿನಿಯರ್‌ಗಳಿಗಾಗಿ ಉದ್ಯಮ-ಪ್ರಾಯೋಜಿತ ಅನುದಾನಗಳೊಂದಿಗೆ ಉತ್ತಮವಾಗಿ ಹೊಂದಾಣಿಕೆಯಾಗುತ್ತದೆ.`;
    } else if (goals.includes('medical') || goals.includes('doctor') || course.includes('mbbs')) {
      en = `Your goal to enter the medical field is well-supported by your academic record. Focus on healthcare-specific grants that can fund your clinical rotations and specialized studies.`;
      kn = `ವೈದ್ಯಕೀಯ ಕ್ಷೇತ್ರವನ್ನು ಪ್ರವೇಶಿಸುವ ನಿಮ್ಮ ಗುರಿಯು ನಿಮ್ಮ ಶೈಕ್ಷಣಿಕ ದಾಖಲೆಯಿಂದ ಉತ್ತಮವಾಗಿ ಬೆಂಬಲಿತವಾಗಿದೆ. ನಿಮ್ಮ ಕ್ಲಿನಿಕಲ್ ಸರದಿಗಳು ಮತ್ತು ವಿಶೇಷ ಅಧ್ಯಯನಗಳಿಗೆ ಧನಸಹಾಯ ನೀಡುವ ಆರೋಗ್ಯ-ನಿರ್ದಿಷ್ಟ ಅನುದಾನಗಳ ಮೇಲೆ ಕೇಂದ್ರೀಕರಿಸಿ.`;
    } else if (cgpa > 8.5) {
      en = `Your outstanding ${userProfile.cgpa} CGPA makes you eligible for elite merit scholarships. We recommend looking into international exchange programs and high-value private grants.`;
      kn = `ನಿಮ್ಮ ಅತ್ಯುತ್ತಮ ${userProfile.cgpa} CGPA ನಿಮ್ಮನ್ನು ಗಣ್ಯ ಮೆರಿಟ್ ವಿದ್ಯಾರ್ಥಿವೇತನಗಳಿಗೆ ಅರ್ಹರನ್ನಾಗಿ ಮಾಡುತ್ತದೆ. ಅಂತರಾಷ್ಟ್ರೀಯ ವಿನಿಮಯ ಕಾರ್ಯಕ್ರಮಗಳು ಮತ್ತು ಹೆಚ್ಚಿನ ಮೌಲ್ಯದ ಖಾಸಗಿ ಅನುದಾನಗಳನ್ನು ಪರಿಶೀಲಿಸಲು ನಾವು ಶಿಫಾರಸು ಮಾಡುತ್ತೇವೆ.`;
    } else {
      en = `Based on your ${userProfile.cgpa} CGPA and ${userProfile.course} course, you have a strong profile for ${topScholarship?.title || 'merit-based'} scholarships. Keep your career goals in mind as you apply for these opportunities.`;
      kn = `ನಿಮ್ಮ ${userProfile.cgpa} CGPA ಮತ್ತು ${userProfile.course} ಕೋರ್ಸ್ ಆಧರಿಸಿ, ನೀವು ${topScholarship?.title || 'ಮೆರಿಟ್-ಆಧಾರಿತ'} ವಿದ್ಯಾರ್ಥಿವೇತನಗಳಿಗಾಗಿ ಬಲವಾದ ಪ್ರೊಫೈಲ್ ಹೊಂದಿದ್ದೀರಿ. ಈ ಅವಕಾಶಗಳಿಗಾಗಿ ನೀವು ಅರ್ಜಿ ಸಲ್ಲಿಸುವಾಗ ನಿಮ್ಮ ವೃತ್ತಿ ಗುರಿಗಳನ್ನು ನೆನಪಿನಲ್ಲಿಡಿ.`;
    }
    
    return { en, kn };
  }, [userProfile, filteredScholarships]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="md:ml-64 p-6 md:p-10 max-w-7xl"
    >
      <header className="mb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold headline tracking-tight mb-4 text-primary">
              {lang === 'EN' ? 'Your Scholarship Curation' : 'ನಿಮ್ಮ ವಿದ್ಯಾರ್ಥಿವೇತನ ಕ್ಯುರೇಶನ್'}
            </h1>
            <div className="flex flex-wrap gap-3 items-center">
              {filters ? (
                <>
                  <span className="px-4 py-2 bg-surface-container-highest text-primary font-semibold rounded-full text-sm">{filters.course}</span>
                  <span className="px-4 py-2 bg-surface-container-highest text-primary font-semibold rounded-full text-sm">{filters.category}</span>
                  <span className="px-4 py-2 bg-surface-container-highest text-primary font-semibold rounded-full text-sm">
                    {lang === 'EN' ? 'Income' : 'ಆದಾಯ'} {filters.income}
                  </span>
                  {filters.tags.map(tag => (
                    <span key={tag} className="px-4 py-2 bg-primary/10 text-primary font-semibold rounded-full text-sm border border-primary/20">{tag}</span>
                  ))}
                </>
              ) : (
                <>
                  <span className="px-4 py-2 bg-surface-container-highest text-primary font-semibold rounded-full text-sm">B.Tech</span>
                  <span className="px-4 py-2 bg-surface-container-highest text-primary font-semibold rounded-full text-sm">OBC Category</span>
                  <span className="px-4 py-2 bg-surface-container-highest text-primary font-semibold rounded-full text-sm">Income &lt; 1L</span>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative">
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none bg-white border border-outline-variant rounded-xl px-4 py-2 pr-10 text-sm font-bold text-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="match">{lang === 'EN' ? 'Match Score (High to Low)' : 'ಹೊಂದಾಣಿಕೆ ಸ್ಕೋರ್ (ಹೆಚ್ಚಿನಿಂದ ಕಡಿಮೆಗೆ)'}</option>
                <option value="deadline">{lang === 'EN' ? 'Deadline (Soonest First)' : 'ಕೊನೆಯ ದಿನಾಂಕ (ಶೀಘ್ರದಲ್ಲೇ ಮೊದಲು)'}</option>
                <option value="reward">{lang === 'EN' ? 'Reward (Highest First)' : 'ಬಹುಮಾನ (ಅತಿ ಹೆಚ್ಚು ಮೊದಲು)'}</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary pointer-events-none" />
            </div>
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'search' }))}
              className="text-primary font-bold flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <Settings2 className="w-5 h-5" />
              {lang === 'EN' ? 'Refine' : 'ಪರಿಷ್ಕರಿಸಿ'}
            </button>
          </div>
        </div>
      </header>

      {/* Filter Tags */}
      <section className="mb-12 overflow-x-auto hide-scrollbar flex gap-4 pb-2">
        <button className="bg-primary text-on-primary px-6 py-2 rounded-xl font-medium whitespace-nowrap">
          {lang === 'EN' ? 'All Eligible' : 'ಎಲ್ಲಾ ಅರ್ಹರು'}
        </button>
        {[
          { EN: 'Merit Based', KN: 'ಮೆರಿಟ್ ಆಧಾರಿತ' },
          { EN: 'Government of Karnataka', KN: 'ಕರ್ನಾಟಕ ಸರ್ಕಾರ' },
          { EN: 'Private Grants', KN: 'ಖಾಸಗಿ ಅನುದಾನಗಳು' },
          { EN: 'International', KN: 'ಅಂತರಾಷ್ಟ್ರೀಯ' }
        ].map(tag => (
          <button key={tag.EN} className="bg-surface-container-low text-on-surface-variant px-6 py-2 rounded-xl font-medium whitespace-nowrap hover:bg-surface-container-high transition-colors">
            {lang === 'EN' ? tag.EN : tag.KN}
          </button>
        ))}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left Column: AI Best Matches */}
        <div className="lg:col-span-7 space-y-8">
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="w-6 h-6 text-tertiary fill-tertiary" />
            <h2 className="text-2xl font-bold headline text-on-background">
              {lang === 'EN' ? 'AI Best Matches' : 'AI ಅತ್ಯುತ್ತಮ ಹೊಂದಾಣಿಕೆಗಳು'}
            </h2>
          </div>

          {isLoading ? (
            <div className="space-y-6">
              {[1, 2].map(i => (
                <div key={i} className="bg-surface-container rounded-3xl p-8 space-y-4">
                  <Skeleton className="w-16 h-16" />
                  <Skeleton className="w-3/4 h-8" />
                  <Skeleton className="w-full h-20" />
                  <div className="flex justify-between items-end pt-4">
                    <Skeleton className="w-24 h-10" />
                    <Skeleton className="w-32 h-12" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredScholarships.filter(s => s.isFeatured).length > 0 ? (
            filteredScholarships.filter(s => s.isFeatured).map(s => (
              <div 
                key={s.id} 
                onClick={() => onSelectScholarship(s.id)}
                className={`${s.matchScore === 98 ? 'glass-ai ai-pulse-glow' : 'bg-surface-container'} rounded-3xl p-8 relative overflow-hidden group transition-all hover:shadow-xl cursor-pointer`}
              >
                <div className="absolute top-0 right-0 p-4 flex gap-2">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSave(s.id);
                    }}
                    className={`p-2 rounded-full transition-all ${savedIds.includes(s.id) ? 'bg-primary text-white' : 'bg-surface dark:bg-surface-container-lowest text-primary hover:bg-surface-container'}`}
                  >
                    <Heart className={`w-4 h-4 ${savedIds.includes(s.id) ? 'fill-white' : ''}`} />
                  </button>
                  <span className={`${s.matchScore === 98 ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-secondary-container text-on-secondary-container'} text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider`}>
                    {s.matchScore ? `${s.matchScore}% ${lang === 'EN' ? 'Match' : 'ಹೊಂದಾಣಿಕೆ'}` : (lang === 'EN' ? 'Recommended for You' : 'ನಿಮಗಾಗಿ ಶಿಫಾರಸು ಮಾಡಲಾಗಿದೆ')}
                  </span>
                </div>
                
                <div className="flex flex-col gap-4">
                  <div className="w-16 h-16 bg-surface-container rounded-2xl flex items-center justify-center shadow-sm">
                    {s.id === '1' ? <GraduationCap className="w-8 h-8 text-primary" /> : <Bot className="w-8 h-8 text-secondary" />}
                  </div>
                  <div>
                    <h3 className="text-2xl font-extrabold headline text-primary mb-2">{s.title}</h3>
                    <p className="text-on-surface-variant leading-relaxed text-sm mb-6">{s.description}</p>
                    
                    <div className={`${s.matchScore === 98 ? 'glass-ai' : 'bg-surface-container-low'} rounded-2xl p-4 mb-6`}>
                      <p className={`text-xs font-bold ${s.matchScore === 98 ? 'text-tertiary' : 'text-secondary'} flex items-center gap-2 mb-1`}>
                        <TrendingUp className="w-4 h-4" />
                        AI INSIGHT
                      </p>
                      <p className="text-sm text-on-surface font-medium italic">"{s.aiInsight}"</p>
                      {!!s.matchedBecause?.length && (
                        <p className="text-xs text-on-surface-variant mt-2">
                          Matched because: {s.matchedBecause.join(', ')}
                        </p>
                      )}
                    </div>

                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[10px] text-on-surface-variant font-bold uppercase">{lang === 'EN' ? 'Reward' : 'ಬಹುಮಾನ'}</p>
                        <p className="text-xl font-black text-primary">{s.reward}</p>
                      </div>
                      <button className="bg-primary text-on-primary px-8 py-3 rounded-xl font-bold headline hover:scale-95 transition-all shadow-lg shadow-primary/20">
                        {lang === 'EN' ? 'View Details' : 'ವಿವರಗಳನ್ನು ನೋಡಿ'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-20 text-center bg-surface dark:bg-surface-container-lowest rounded-3xl border border-dashed border-outline">
              <Info className="w-12 h-12 text-on-surface-variant mx-auto mb-4" />
              <p className="text-on-surface-variant font-medium">
                {lang === 'EN' ? 'No exact matches found for your criteria. Try refining your search.' : 'ನಿಮ್ಮ ಮಾನದಂಡಗಳಿಗೆ ಯಾವುದೇ ನಿಖರವಾದ ಹೊಂದಾಣಿಕೆಗಳು ಕಂಡುಬಂದಿಲ್ಲ. ನಿಮ್ಮ ಹುಡುಕಾಟವನ್ನು ಪರಿಷ್ಕರಿಸಲು ಪ್ರಯತ್ನಿಸಿ.'}
              </p>
            </div>
          )}
        </div>

        {/* Right Column: List & Insights */}
        <div className="lg:col-span-5 space-y-10">
          <div className="bg-primary text-white rounded-3xl p-6 shadow-xl shadow-primary/10">
            <div className="flex items-center gap-3 mb-4">
              <Lightbulb className="w-6 h-6 text-tertiary-fixed" />
              <h3 className="font-bold headline">{lang === 'EN' ? 'Career Path Suggestion' : 'ವೃತ್ತಿ ಮಾರ್ಗ ಸಲಹೆ'}</h3>
            </div>
            <p className="text-sm text-primary-fixed mb-4">
              {lang === 'EN' ? `"${careerSuggestion.en}"` : `"${careerSuggestion.kn}"`}
            </p>
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'search' }))}
              className="text-sm font-bold flex items-center gap-2 text-white hover:underline"
            >
              {lang === 'EN' ? 'Explore Research Grants' : 'ಸಂಶೋಧನಾ ಅನುದಾನಗಳನ್ನು ಅನ್ವೇಷಿಸಿ'} <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <UniversityFinder profile={userProfile} lang={lang} />

          <div className="bg-blue-50/50 rounded-3xl p-8 space-y-6">
            <h3 className="text-sm font-bold headline text-primary flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> {lang === 'EN' ? 'Quick Actions' : 'ತ್ವರಿತ ಕ್ರಮಗಳು'}
            </h3>
            <div className="space-y-3">
              {[
                { 
                  label: lang === 'EN' ? 'Saved Scholarships' : 'ಉಳಿಸಿದ ವಿದ್ಯಾರ್ಥಿವೇತನಗಳು', 
                  icon: Bookmark,
                  onClick: () => onNavigate('saved')
                },
                { 
                  label: lang === 'EN' ? 'Help & Guidance' : 'ಸಹಾಯ ಮತ್ತು ಮಾರ್ಗದರ್ಶನ', 
                  icon: HelpCircle,
                  onClick: onOpenChat
                },
                { 
                  label: lang === 'EN' ? 'Eligibility Docs' : 'ಅರ್ಹತಾ ದಾಖಲೆಗಳು', 
                  icon: FileText,
                  onClick: () => setShowDocsModal(true)
                },
                { 
                  label: lang === 'EN' ? 'Profile Settings' : 'ಪ್ರೊಫೈಲ್ ಸೆಟ್ಟಿಂಗ್‌ಗಳು', 
                  icon: Settings2,
                  onClick: () => onNavigate('profile')
                },
              ].map((action, idx) => (
                <button 
                  key={idx} 
                  onClick={action.onClick}
                  className="w-full flex items-center justify-between p-4 bg-surface dark:bg-surface-container-lowest rounded-2xl text-sm font-medium text-primary hover:bg-surface-container transition-colors shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <action.icon className="w-4 h-4 text-on-surface-variant" />
                    {action.label}
                  </div>
                  <ChevronRight className="w-4 h-4 text-outline-variant" />
                </button>
              ))}
            </div>
          </div>

          <AnimatePresence>
            {showDocsModal && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm"
                onClick={() => setShowDocsModal(false)}
              >
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-surface dark:bg-surface-container-lowest rounded-3xl p-8 max-w-md w-full shadow-2xl"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex justify-between items-start mb-6">
                    <h2 className="text-2xl font-bold text-primary headline">
                      {lang === 'EN' ? 'Required Documents' : 'ಅಗತ್ಯವಿರುವ ದಾಖಲೆಗಳು'}
                    </h2>
                    <button onClick={() => setShowDocsModal(false)} className="p-1 hover:bg-slate-100 rounded-full">
                      <X className="w-6 h-6 text-slate-400" />
                    </button>
                  </div>
                  <div className="space-y-4 mb-8">
                    {[
                      { en: 'Income Certificate', kn: 'ಆದಾಯ ಪ್ರಮಾಣಪತ್ರ' },
                      { en: 'Caste Certificate', kn: 'ಜಾತಿ ಪ್ರಮಾಣಪತ್ರ' },
                      { en: 'Previous Year Marks Cards', kn: 'ಹಿಂದಿನ ವರ್ಷದ ಅಂಕಪಟ್ಟಿಗಳು' },
                      { en: 'Aadhar Card', kn: 'ಆಧಾರ್ ಕಾರ್ಡ್' },
                      { en: 'Bank Passbook (Front Page)', kn: 'ಬ್ಯಾಂಕ್ ಪಾಸ್‌ಬುಕ್ (ಮುಂಭಾಗದ ಪುಟ)' },
                      { en: 'Fee Receipt (Current Year)', kn: 'ಶುಲ್ಕ ರಶೀದಿ (ಪ್ರಸ್ತುತ ವರ್ಷ)' },
                      { en: 'Study Certificate', kn: 'ವ್ಯಾಸಂಗ ಪ್ರಮಾಣಪತ್ರ' }
                    ].map((doc, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-surface-container-low rounded-xl">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                          {i + 1}
                        </div>
                        <p className="text-sm text-on-surface-variant">
                          {lang === 'EN' ? doc.en : doc.kn}
                        </p>
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={() => setShowDocsModal(false)}
                    className="w-full py-4 bg-primary text-white rounded-2xl font-bold hover:opacity-90 transition-all"
                  >
                    {lang === 'EN' ? 'Got it!' : 'ಸರಿ'}
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold headline text-on-background">
                {lang === 'EN' ? 'All Eligible' : 'ಎಲ್ಲಾ ಅರ್ಹರು'} ({filteredScholarships.length})
              </h2>
              <Search className="w-5 h-5 text-on-surface-variant cursor-pointer" />
            </div>
            
            <div className="space-y-4">
              {isLoading ? (
                [1, 2, 3, 4].map(i => (
                  <div key={i} className="bg-surface-container-low p-5 rounded-2xl flex gap-4">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="w-20 h-3" />
                      <Skeleton className="w-full h-5" />
                      <div className="flex gap-4">
                        <Skeleton className="w-24 h-3" />
                        <Skeleton className="w-24 h-3" />
                      </div>
                    </div>
                    <Skeleton className="w-8 h-8 rounded-full" />
                  </div>
                ))
              ) : filteredScholarships.filter(s => !s.isFeatured).map(s => (
                <div 
                  key={s.id} 
                  onClick={() => onSelectScholarship(s.id)}
                  className="bg-surface-container-low p-5 rounded-2xl flex gap-4 hover:bg-surface-container-high transition-colors cursor-pointer group relative"
                >
                  <div className="flex-1">
                    <p className={`text-[10px] font-bold uppercase mb-1 ${s.category === 'Government' ? 'text-secondary' : 'text-tertiary'}`}>
                      {s.category}
                    </p>
                    <h4 className="font-bold text-on-background group-hover:text-primary transition-colors pr-8">{s.title}</h4>
                    <div className="flex gap-4 mt-2">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-on-surface-variant" />
                        <span className="text-[11px] text-on-surface-variant">{lang === 'EN' ? 'Deadline' : 'ಕೊನೆಯ ದಿನಾಂಕ'}: {s.deadline}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <IndianRupee className="w-3 h-3 text-on-surface-variant" />
                        <span className="text-[11px] text-on-surface-variant font-bold">{s.reward}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center justify-between">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSave(s.id);
                      }}
                      className={`p-1.5 rounded-full transition-all ${savedIds.includes(s.id) ? 'text-primary' : 'text-outline-variant hover:text-primary'}`}
                    >
                      <Heart className={`w-4 h-4 ${savedIds.includes(s.id) ? 'fill-primary' : ''}`} />
                    </button>
                    <ChevronRight className="w-5 h-5 text-outline-variant group-hover:text-primary transition-colors" />
                  </div>
                </div>
              ))}
            </div>
            
            <button className="w-full mt-6 py-4 border border-dashed border-outline text-on-surface-variant font-bold text-sm rounded-2xl hover:bg-surface-container transition-colors">
              {lang === 'EN' ? 'View All Scholarships' : 'ಎಲ್ಲಾ ವಿದ್ಯಾರ್ಥಿವೇತನಗಳನ್ನು ನೋಡಿ'}
            </button>
          </div>

          <div className="relative h-48 rounded-3xl overflow-hidden group">
            <img 
              className="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500" 
              src="https://picsum.photos/seed/ngo_grants/800/600"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent p-6 flex items-end">
              <div>
                <p className="text-white text-xs font-bold uppercase">{lang === 'EN' ? 'Localized Support' : 'ಸ್ಥಳೀಯ ಬೆಂಬಲ'}</p>
                <p className="text-white font-bold headline">{lang === 'EN' ? '12 Local NGO Grants in Bengaluru' : 'ಬೆಂಗಳೂರಿನಲ್ಲಿ 12 ಸ್ಥಳೀಯ NGO ಅನುದಾನಗಳು'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const SavedPage = ({ savedIds, onToggleSave, onSelectScholarship, lang }: { 
  savedIds: string[], 
  onToggleSave: (id: string) => void,
  onSelectScholarship: (id: string) => void,
  lang: Language
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'match' | 'deadline' | 'reward'>('match');

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const savedScholarships = useMemo(() => {
    let results = SCHOLARSHIPS.filter(s => savedIds.includes(s.id));
    
    if (sortBy === 'match') {
      results.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
    } else if (sortBy === 'deadline') {
      results.sort((a, b) => {
        const dateA = new Date(a.deadline + ' 2024');
        const dateB = new Date(b.deadline + ' 2024');
        return dateA.getTime() - dateB.getTime();
      });
    } else if (sortBy === 'reward') {
      results.sort((a, b) => {
        const valA = parseInt(a.reward.replace(/[^0-9]/g, '')) || 0;
        const valB = parseInt(b.reward.replace(/[^0-9]/g, '')) || 0;
        return valB - valA;
      });
    }
    
    return results;
  }, [savedIds, sortBy]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="md:ml-64 p-6 md:p-10 max-w-7xl"
    >
      <header className="mb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold headline tracking-tight mb-4 text-primary">
              {lang === 'EN' ? 'Saved Scholarships' : 'ಉಳಿಸಿದ ವಿದ್ಯಾರ್ಥಿವೇತನಗಳು'}
            </h1>
            <p className="text-on-surface-variant max-w-2xl leading-relaxed">
              {lang === 'EN' 
                ? "Manage the opportunities you've bookmarked for your academic journey." 
                : "ನಿಮ್ಮ ಶೈಕ್ಷಣಿಕ ಪ್ರಯಾಣಕ್ಕಾಗಿ ನೀವು ಬುಕ್‌ಮಾರ್ಕ್ ಮಾಡಿದ ಅವಕಾಶಗಳನ್ನು ನಿರ್ವಹಿಸಿ."}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative">
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none bg-white border border-outline-variant rounded-xl px-4 py-2 pr-10 text-sm font-bold text-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="match">{lang === 'EN' ? 'Match Score (High to Low)' : 'ಹೊಂದಾಣಿಕೆ ಸ್ಕೋರ್ (ಹೆಚ್ಚಿನಿಂದ ಕಡಿಮೆಗೆ)'}</option>
                <option value="deadline">{lang === 'EN' ? 'Deadline (Soonest First)' : 'ಕೊನೆಯ ದಿನಾಂಕ (ಶೀಘ್ರದಲ್ಲೇ ಮೊದಲು)'}</option>
                <option value="reward">{lang === 'EN' ? 'Reward (Highest First)' : 'ಬಹುಮಾನ (ಅತಿ ಹೆಚ್ಚು ಮೊದಲು)'}</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary pointer-events-none" />
            </div>
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-surface dark:bg-surface-container-lowest border border-outline-variant rounded-3xl p-6 space-y-4">
              <Skeleton className="w-12 h-12" />
              <Skeleton className="w-3/4 h-6" />
              <Skeleton className="w-full h-12" />
              <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                <Skeleton className="w-16 h-8" />
                <Skeleton className="w-24 h-8" />
              </div>
            </div>
          ))}
        </div>
      ) : savedScholarships.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {savedScholarships.map(s => (
            <div 
              key={s.id} 
              onClick={() => onSelectScholarship(s.id)}
              className="bg-surface dark:bg-surface-container-lowest border border-outline-variant rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative group cursor-pointer"
            >
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSave(s.id);
                }}
                className="absolute top-4 right-4 p-2 rounded-full bg-primary text-white shadow-lg z-10"
              >
                <Bookmark className="w-4 h-4 fill-white" />
              </button>
              
              <div className="w-12 h-12 bg-surface-container rounded-xl flex items-center justify-center mb-4">
                <GraduationCap className="w-6 h-6 text-primary" />
              </div>
              
              <h3 className="font-bold text-primary mb-2 pr-8">{s.title}</h3>
              <p className="text-xs text-on-surface-variant line-clamp-2 mb-4">{s.description}</p>
              
              <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                <div>
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase">{lang === 'EN' ? 'Reward' : 'ಬಹುಮಾನ'}</p>
                  <p className="text-sm font-black text-primary">{s.reward}</p>
                </div>
                <button className="text-xs font-bold text-primary flex items-center gap-1 hover:underline">
                  {lang === 'EN' ? 'View Details' : 'ವಿವರಗಳನ್ನು ನೋಡಿ'} <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-32 text-center">
          <Bookmark className="w-16 h-16 text-slate-200 mx-auto mb-6" />
          <h3 className="text-xl font-bold text-primary mb-2">
            {lang === 'EN' ? 'No saved scholarships yet' : 'ಇನ್ನೂ ಯಾವುದೇ ಉಳಿಸಿದ ವಿದ್ಯಾರ್ಥಿವೇತನಗಳಿಲ್ಲ'}
          </h3>
          <p className="text-on-surface-variant mb-8">
            {lang === 'EN' ? 'Start exploring and bookmark the ones you like!' : 'ಅನ್ವೇಷಿಸಲು ಪ್ರಾರಂಭಿಸಿ ಮತ್ತು ನೀವು ಇಷ್ಟಪಡುವದನ್ನು ಬುಕ್‌ಮಾರ್ಕ್ ಮಾಡಿ!'}
          </p>
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'search' }))}
            className="px-8 py-3 bg-primary text-white rounded-xl font-bold"
          >
            {lang === 'EN' ? 'Explore Now' : 'ಈಗ ಅನ್ವೇಷಿಸಿ'}
          </button>
        </div>
      )}
    </motion.div>
  );
};

const AboutPage = ({ lang }: { lang: Language }) => {
  const [showPopup, setShowPopup] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="md:ml-64 p-6 md:p-10 max-w-4xl mx-auto min-h-screen flex flex-col items-center justify-center text-center"
    >
      <div className="bg-surface dark:bg-surface-container-lowest rounded-3xl p-12 shadow-2xl border border-outline-variant max-w-2xl">
        <div className="w-24 h-24 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-8">
          <Info className="w-12 h-12 text-primary" />
        </div>
        
        <h1 className="text-4xl font-extrabold headline text-primary mb-6">
          {lang === 'EN' ? 'About The Academic Curator' : 'ಅಕಾಡೆಮಿಕ್ ಕ್ಯುರೇಟರ್ ಬಗ್ಗೆ'}
        </h1>
        
        <p className="text-lg text-on-surface-variant mb-10 leading-relaxed">
          {lang === 'EN' 
            ? 'The Academic Curator is an AI-powered platform dedicated to helping Indian students find and apply for scholarships that match their unique profiles. Our mission is to bridge the gap between financial need and academic excellence.'
            : 'ಅಕಾಡೆಮಿಕ್ ಕ್ಯುರೇಟರ್ ಎನ್ನುವುದು AI-ಚಾಲಿತ ವೇದಿಕೆಯಾಗಿದ್ದು, ಭಾರತೀಯ ವಿದ್ಯಾರ್ಥಿಗಳಿಗೆ ಅವರ ವಿಶಿಷ್ಟ ಪ್ರೊಫೈಲ್‌ಗಳಿಗೆ ಹೊಂದಿಕೆಯಾಗುವ ವಿದ್ಯಾರ್ಥಿವೇತನಗಳನ್ನು ಹುಡುಕಲು ಮತ್ತು ಅರ್ಜಿ ಸಲ್ಲಿಸಲು ಸಹಾಯ ಮಾಡಲು ಮೀಸಲಾಗಿರುತ್ತದೆ.'}
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <div className="p-6 bg-surface-container-low rounded-2xl text-left">
            <h3 className="font-bold text-primary mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> AI Matching
            </h3>
            <p className="text-sm text-on-surface-variant">Personalized recommendations based on your academic and financial profile using multi-agent intelligence.</p>
          </div>
          <div className="p-6 bg-surface-container-low rounded-2xl text-left">
            <h3 className="font-bold text-primary mb-2 flex items-center gap-2">
              <Globe className="w-4 h-4" /> Bilingual
            </h3>
            <p className="text-sm text-on-surface-variant">Full support in both English and Kannada to ensure accessibility for all students across Karnataka.</p>
          </div>
          <div className="p-6 bg-surface-container-low rounded-2xl text-left">
            <h3 className="font-bold text-primary mb-2 flex items-center gap-2">
              <Bot className="w-4 h-4" /> Predictive Analytics
            </h3>
            <p className="text-sm text-on-surface-variant">Advanced NLP models to analyze eligibility and predict your success probability for each grant.</p>
          </div>
          <div className="p-6 bg-surface-container-low rounded-2xl text-left">
            <h3 className="font-bold text-primary mb-2 flex items-center gap-2">
              <FileCheck className="w-4 h-4" /> Document Verification
            </h3>
            <p className="text-sm text-on-surface-variant">Automated guidance on required documents like Income, Caste, and Marks cards.</p>
          </div>
        </div>

        <div className="text-left mb-10 space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-primary mb-4 flex items-center gap-2">
              <Building className="w-6 h-6" /> {lang === 'EN' ? 'Data Sources' : 'ಮಾಹಿತಿ ಮೂಲಗಳು'}
            </h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-on-surface-variant">
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-primary" /> Official State Portals (SSP, NSP)</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-primary" /> Corporate CSR Portals</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-primary" /> Educational NGO Databases</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-primary" /> Verified News & Notifications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-primary mb-4 flex items-center gap-2">
              <HelpCircle className="w-6 h-6" /> {lang === 'EN' ? 'Frequently Asked Questions' : 'ಪದೇ ಪದೇ ಕೇಳಲಾಗುವ ಪ್ರಶ್ನೆಗಳು'}
            </h2>
            <div className="space-y-4">
              {[
                {
                  q: lang === 'EN' ? "How accurate is the AI matching?" : "AI ಹೊಂದಾಣಿಕೆಯು ಎಷ್ಟು ನಿಖರವಾಗಿದೆ?",
                  a: lang === 'EN' ? "Our AI analyzes multiple data points to provide highly accurate matches, but we always recommend verifying details on official portals." : "ನಮ್ಮ AI ನಿಖರವಾದ ಹೊಂದಾಣಿಕೆಗಳನ್ನು ಒದಗಿಸಲು ಬಹು ಡೇಟಾ ಪಾಯಿಂಟ್‌ಗಳನ್ನು ವಿಶ್ಲೇಷಿಸುತ್ತದೆ."
                },
                {
                  q: lang === 'EN' ? "Which scholarships are covered?" : "ಯಾವ ವಿದ್ಯಾರ್ಥಿವೇತನಗಳನ್ನು ಒಳಗೊಂಡಿದೆ?",
                  a: lang === 'EN' ? "We cover SSP, NSP, FFE, and various private/corporate grants across India." : "ನಾವು SSP, NSP, FFE ಮತ್ತು ಭಾರತದಾದ್ಯಂತ ವಿವಿಧ ಖಾಸಗಿ/ಕಾರ್ಪೊರೇಟ್ ಅನುದಾನಗಳನ್ನು ಒಳಗೊಳ್ಳುತ್ತೇವೆ."
                },
                {
                  q: lang === 'EN' ? "Is my data secure?" : "ನನ್ನ ಡೇಟಾ ಸುರಕ್ಷಿತವಾಗಿದೆಯೇ?",
                  a: lang === 'EN' ? "Yes, we use industry-standard security measures to protect your profile information." : "ಹೌದು, ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಮಾಹಿತಿಯನ್ನು ರಕ್ಷಿಸಲು ನಾವು ಉದ್ಯಮ-ದರ್ಜೆಯ ಸುರಕ್ಷತಾ ಕ್ರಮಗಳನ್ನು ಬಳಸುತ್ತೇವೆ."
                }
              ].map((faq, i) => (
                <div key={i} className="p-4 bg-surface-container-low rounded-xl border border-outline-variant">
                  <p className="font-bold text-primary mb-1">{faq.q}</p>
                  <p className="text-sm text-on-surface-variant">{faq.a}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <button 
          onClick={() => setShowPopup(true)}
          className="px-10 py-4 bg-primary text-white rounded-2xl font-bold text-lg hover:opacity-90 transition-all shadow-xl shadow-primary/20"
        >
          {lang === 'EN' ? 'Learn More' : 'ಇನ್ನಷ್ಟು ತಿಳಿಯಿರಿ'}
        </button>
      </div>

      <AnimatePresence>
        {showPopup && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowPopup(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface dark:bg-surface-container-lowest rounded-3xl p-8 max-w-md w-full shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-bold text-primary headline">Welcome Message</h2>
                <button onClick={() => setShowPopup(false)} className="p-1 hover:bg-slate-100 rounded-full">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              <p className="text-on-surface-variant leading-relaxed mb-8">
                Thank you for choosing The Academic Curator! We are constantly working to improve our AI models to provide you with the most accurate scholarship matches. Stay tuned for more updates!
              </p>
              <button 
                onClick={() => setShowPopup(false)}
                className="w-full py-4 bg-primary text-white rounded-2xl font-bold hover:opacity-90 transition-all"
              >
                Got it!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const UserProfilePage = ({ profile, onSave, lang }: { profile: UserProfile, onSave: (p: UserProfile) => void, lang: Language }) => {
  const { logout } = useAuth();
  const [formData, setFormData] = useState<UserProfile>(profile);
  const [hasDraft, setHasDraft] = useState(false);

  const calculateCompletion = () => {
    const fields = Object.values(formData);
    const filledFields = fields.filter(f => f && f.trim() !== '');
    return Math.round((filledFields.length / fields.length) * 100);
  };

  const completion = calculateCompletion();

  useEffect(() => {
    const draft = localStorage.getItem('profileDraft');
    if (draft) {
      setHasDraft(true);
    }
  }, []);

  const handleSaveDraft = () => {
    localStorage.setItem('profileDraft', JSON.stringify(formData));
    setHasDraft(true);
    // alert('Draft saved locally! You can retrieve it next time you visit.');
    console.log('Draft saved locally!');
  };

  const handleLoadDraft = () => {
    const draft = localStorage.getItem('profileDraft');
    if (draft) {
      setFormData(JSON.parse(draft));
      // alert('Draft loaded successfully!');
      console.log('Draft loaded successfully!');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    localStorage.removeItem('profileDraft');
    setHasDraft(false);
    // alert('Profile updated successfully!');
    console.log('Profile updated successfully!');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="md:ml-64 p-6 md:p-10 max-w-4xl mx-auto"
    >
      <header className="mb-10 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-extrabold headline text-primary mb-2">
            {lang === 'EN' ? 'User Profile' : 'ಬಳಕೆದಾರರ ಪ್ರೊಫೈಲ್'}
          </h1>
          <p className="text-on-surface-variant">
            {lang === 'EN' 
              ? 'Manage your personal and academic details to get better scholarship matches.' 
              : 'ಉತ್ತಮ ವಿದ್ಯಾರ್ಥಿವೇತನ ಹೊಂದಾಣಿಕೆಗಳನ್ನು ಪಡೆಯಲು ನಿಮ್ಮ ವೈಯಕ್ತಿಕ ಮತ್ತು ಶೈಕ್ಷಣಿಕ ವಿವರಗಳನ್ನು ನಿರ್ವಹಿಸಿ.'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {hasDraft && (
            <button 
              onClick={handleLoadDraft}
              className="px-4 py-2 bg-tertiary-container text-on-tertiary-container rounded-xl text-sm font-bold hover:opacity-80 transition-all flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              {lang === 'EN' ? 'Restore Draft' : 'ಡ್ರಾಫ್ಟ್ ಮರುಸ್ಥಾಪಿಸಿ'}
            </button>
          )}
          <button 
            onClick={logout}
            className="px-4 py-2 bg-error/10 text-error rounded-xl text-sm font-bold hover:bg-error/20 transition-all flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            {lang === 'EN' ? 'Sign Out' : 'ಸೈನ್ ಔಟ್'}
          </button>
        </div>
      </header>

      <div className="mb-8 bg-surface dark:bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${completion === 100 ? 'bg-emerald-100 text-emerald-600' : 'bg-primary/10 text-primary'}`}>
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-primary headline">
                {lang === 'EN' ? 'Profile Completion' : 'ಪ್ರೊಫೈಲ್ ಪೂರ್ಣಗೊಳಿಸುವಿಕೆ'}
              </h3>
              <p className="text-xs text-on-surface-variant">
                {completion === 100 
                  ? (lang === 'EN' ? 'Perfect! Your profile is complete.' : 'ಅದ್ಭುತ! ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಪೂರ್ಣಗೊಂಡಿದೆ.')
                  : (lang === 'EN' ? 'Fill more details for better AI matches.' : 'ಉತ್ತಮ AI ಹೊಂದಾಣಿಕೆಗಳಿಗಾಗಿ ಹೆಚ್ಚಿನ ವಿವರಗಳನ್ನು ಭರ್ತಿ ಮಾಡಿ.')}
              </p>
            </div>
          </div>
          <span className="text-2xl font-black text-primary headline">{completion}%</span>
        </div>
        <div className="h-3 w-full bg-surface-container rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${completion}%` }}
            className={`h-full transition-all duration-500 ${completion === 100 ? 'bg-emerald-500' : 'bg-primary'}`}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-surface dark:bg-surface-container-lowest rounded-3xl p-8 shadow-sm border border-outline-variant space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-primary headline">
              {lang === 'EN' ? 'Full Name' : 'ಪೂರ್ಣ ಹೆಸರು'}
            </label>
            <input 
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({...formData, fullName: e.target.value})}
              className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20"
              placeholder={lang === 'EN' ? 'Enter your full name' : 'ನಿಮ್ಮ ಪೂರ್ಣ ಹೆಸರನ್ನು ನಮೂದಿಸಿ'}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-primary headline">
              {lang === 'EN' ? 'Email Address' : 'ಇಮೇಲ್ ವಿಳಾಸ'}
            </label>
            <input 
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20"
              placeholder="your.email@example.com"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-primary headline">
              {lang === 'EN' ? 'Phone Number' : 'ಫೋನ್ ಸಂಖ್ಯೆ'}
            </label>
            <input 
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20"
              placeholder="+91 XXXXX XXXXX"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-primary headline">
              {lang === 'EN' ? 'Current Course' : 'ಪ್ರಸ್ತುತ ಕೋರ್ಸ್'}
            </label>
            <select 
              value={formData.course}
              onChange={(e) => setFormData({...formData, course: e.target.value})}
              className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20"
            >
              <option value="">{lang === 'EN' ? 'Select Level' : 'ಮಟ್ಟವನ್ನು ಆರಿಸಿ'}</option>
              <option value="B.Tech">{lang === 'EN' ? 'B.Tech / Engineering' : 'ಬಿ.ಟೆಕ್ / ಎಂಜಿನಿಯರಿಂಗ್'}</option>
              <option value="M.Tech">{lang === 'EN' ? 'M.Tech / Masters' : 'ಎಂ.ಟೆಕ್ / ಮಾಸ್ಟರ್ಸ್'}</option>
              <option value="MBBS">{lang === 'EN' ? 'MBBS / Medical' : 'MBBS / ವೈದ್ಯಕೀಯ'}</option>
              <option value="B.Com">{lang === 'EN' ? 'B.Com / Commerce' : 'ಬಿ.ಕಾಂ / ವಾಣಿಜ್ಯ'}</option>
              <option value="B.Sc">{lang === 'EN' ? 'B.Sc / Science' : 'ಬಿ.ಎಸ್ಸಿ / ವಿಜ್ಞಾನ'}</option>
              <option value="Diploma">{lang === 'EN' ? 'Diploma' : 'ಡಿಪ್ಲೊಮಾ'}</option>
              <option value="PhD">{lang === 'EN' ? 'PhD / Research' : 'ಪಿಎಚ್‌ಡಿ / ಸಂಶೋಧನೆ'}</option>
              <option value="School">{lang === 'EN' ? 'School (1-12)' : 'ಶಾಲೆ (1-12)'}</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-primary headline">
              {lang === 'EN' ? 'Category' : 'ವರ್ಗ'}
            </label>
            <select 
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
              className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20"
            >
              <option value="">{lang === 'EN' ? 'Select Category' : 'ವರ್ಗವನ್ನು ಆರಿಸಿ'}</option>
              <option value="2A">{lang === 'EN' ? '2A' : '2ಎ'}</option>
              <option value="3A">{lang === 'EN' ? '3A' : '3ಎ'}</option>
              <option value="3B">{lang === 'EN' ? '3B' : '3ಬಿ'}</option>
              <option value="SC">{lang === 'EN' ? 'SC' : 'ಎಸ್‌ಸಿ'}</option>
              <option value="ST">{lang === 'EN' ? 'ST' : 'ಎಸ್‌ಟಿ'}</option>
              <option value="OBC">{lang === 'EN' ? 'OBC' : 'ಒಬಿಸಿ'}</option>
              <option value="EWS">{lang === 'EN' ? 'EWS' : 'ಆರ್ಥಿಕ ದುರ್ಬಲ ವರ್ಗ (EWS)'}</option>
              <option value="PWD">{lang === 'EN' ? 'PWD' : 'ವಿಕಲಚೇತನರು (PWD)'}</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-primary headline">
              {lang === 'EN' ? 'Annual Income' : 'ವಾರ್ಷಿಕ ಆದಾಯ'}
            </label>
            <select 
              value={formData.income}
              onChange={(e) => setFormData({...formData, income: e.target.value})}
              className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20"
            >
              <option value="">{lang === 'EN' ? 'Income Range' : 'ಆದಾಯದ ಶ್ರೇಣಿ'}</option>
              <option value="< 1L">{lang === 'EN' ? '< 1 Lakh' : '< 1 ಲಕ್ಷ'}</option>
              <option value="1 - 2.5L">{lang === 'EN' ? '1 - 2.5 Lakhs' : '1 - 2.5 ಲಕ್ಷಗಳು'}</option>
              <option value="2.5 - 5L">{lang === 'EN' ? '2.5 - 5 Lakhs' : '2.5 - 5 ಲಕ್ಷಗಳು'}</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-primary headline">
              {lang === 'EN' ? 'Current CGPA / %' : 'ಪ್ರಸ್ತುತ CGPA / %'}
            </label>
            <select 
              value={formData.cgpa}
              onChange={(e) => setFormData({...formData, cgpa: e.target.value})}
              className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20"
            >
              <option value="">{lang === 'EN' ? 'Academic Grade' : 'ಶೈಕ್ಷಣಿಕ ಗ್ರೇಡ್'}</option>
              <option value="9+">9.0+ CGPA / 90%+</option>
              <option value="8+">8.0+ CGPA / 80%+</option>
              <option value="7+">7.0+ CGPA / 70%+</option>
              <option value="6+">6.0+ CGPA / 60%+</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-primary headline">
            {lang === 'EN' ? 'Career Goals' : 'ವೃತ್ತಿ ಗುರಿಗಳು'}
          </label>
          <textarea 
            value={formData.careerGoals}
            onChange={(e) => setFormData({...formData, careerGoals: e.target.value})}
            className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 h-32 resize-none"
            placeholder={lang === 'EN' ? 'Tell us about your future ambitions...' : 'ನಿಮ್ಮ ಭವಿಷ್ಯದ ಮಹತ್ವಾಕಾಂಕ್ಷೆಗಳ ಬಗ್ಗೆ ನಮಗೆ ತಿಳಿಸಿ...'}
          />
        </div>

        <div className="flex gap-4">
          <button 
            type="button"
            onClick={handleSaveDraft}
            className="flex-1 py-4 border-2 border-primary text-primary rounded-2xl font-bold text-lg hover:bg-primary/5 transition-all"
          >
            {lang === 'EN' ? 'Save Draft' : 'ಡ್ರಾಫ್ಟ್ ಉಳಿಸಿ'}
          </button>
          <button 
            type="submit"
            className="flex-[2] py-4 bg-primary text-white rounded-2xl font-bold text-lg hover:opacity-90 transition-all shadow-xl shadow-primary/10"
          >
            {lang === 'EN' ? 'Save Profile Changes' : 'ಪ್ರೊಫೈಲ್ ಬದಲಾವಣೆಗಳನ್ನು ಉಳಿಸಿ'}
          </button>
        </div>
      </form>
    </motion.div>
  );
};

const ScholarshipDetailPage = ({ 
  scholarship, 
  onBack, 
  onToggleSave, 
  isSaved,
  profile,
  allScholarships,
  onSelectScholarship,
  onOpenChat,
  lang
}: { 
  scholarship: Scholarship, 
  onBack: () => void,
  onToggleSave: (id: string) => void,
  isSaved: boolean,
  profile: UserProfile,
  allScholarships: Scholarship[],
  onSelectScholarship: (id: string) => void,
  onOpenChat: () => void,
  lang: Language
}) => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    window.scrollTo(0, 0);
    return () => clearTimeout(timer);
  }, [scholarship.id]);

  const handleApply = () => {
    // In a real app, this would open the official portal
    // const confirmApply = window.confirm(`You are being redirected to the official portal for ${scholarship.title}. Would you like to proceed?`);
    // if (confirmApply) {
    window.open('https://ssp.postmatric.karnataka.gov.in/', '_blank');
    // }
  };

  const handleDownload = () => {
    // alert(`Downloading Application Guide for ${scholarship.title}...`);
    console.log(`Downloading Application Guide for ${scholarship.title}...`);
    // Simulate download
    setTimeout(() => {
      // alert("Guide downloaded successfully!");
      console.log("Guide downloaded successfully!");
    }, 1500);
  };

  const handleShare = async () => {
    const shareData = {
      title: scholarship.title,
      text: `Check out this scholarship: ${scholarship.title}`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${scholarship.title} - ${window.location.href}`);
        // alert(lang === 'EN' ? 'Link copied to clipboard!' : 'ಲಿಂಕ್ ಅನ್ನು ಕ್ಲಿಪ್‌ಬೋರ್ಡ್‌ಗೆ ನಕಲಿಸಲಾಗಿದೆ!');
        console.log('Link copied to clipboard!');
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const similarScholarships = useMemo(() => {
    return allScholarships
      .filter(s => s.id !== scholarship.id)
      .filter(s => s.tags.some(tag => scholarship.tags.includes(tag)) || s.category === scholarship.category)
      .slice(0, 3);
  }, [scholarship, allScholarships]);

  const eligibilityAnalysis = useMemo(() => {
    const criteria = [
      { 
        label: lang === 'EN' ? 'Academic Qualification' : 'ಶೈಕ್ಷಣಿಕ ಅರ್ಹತೆ', 
        status: profile.course === scholarship.tags.find(t => ['B.Tech', 'M.Tech', 'PhD', 'School'].includes(t)) || scholarship.tags.includes(profile.course) ? 'eligible' : 'warning', 
        detail: `${lang === 'EN' ? 'Required' : 'ಅಗತ್ಯವಿದೆ'}: ${scholarship.tags.find(t => ['B.Tech', 'M.Tech', 'PhD', 'School'].includes(t)) || (lang === 'EN' ? 'Any' : 'ಯಾವುದಾದರೂ')}` 
      },
      { 
        label: lang === 'EN' ? 'Academic Performance' : 'ಶೈಕ್ಷಣಿಕ ಪ್ರದರ್ಶನ', 
        status: parseInt(profile.cgpa) >= 7 ? 'eligible' : 'warning', 
        detail: `${lang === 'EN' ? 'Your Grade' : 'ನಿಮ್ಮ ಗ್ರೇಡ್'}: ${profile.cgpa || (lang === 'EN' ? 'Not set' : 'ಹೊಂದಿಸಲಾಗಿಲ್ಲ')}` 
      },
      { 
        label: lang === 'EN' ? 'Category / Reservation' : 'ವರ್ಗ / ಮೀಸಲಾತಿ', 
        status: scholarship.tags.includes(profile.category) || scholarship.category === 'Government' ? 'eligible' : 'neutral', 
        detail: `${lang === 'EN' ? 'Your Category' : 'ನಿಮ್ಮ ವರ್ಗ'}: ${profile.category || (lang === 'EN' ? 'General' : 'ಸಾಮಾನ್ಯ')}` 
      },
      { 
        label: lang === 'EN' ? 'Income Limit' : 'ಆದಾಯದ ಮಿತಿ', 
        status: profile.income === '< 1L' || profile.income === '< 5L' ? 'eligible' : 'neutral', 
        detail: `${lang === 'EN' ? 'Your Income' : 'ನಿಮ್ಮ ಆದಾಯ'}: ${profile.income || (lang === 'EN' ? 'Not set' : 'ಹೊಂದಿಸಲಾಗಿಲ್ಲ')}` 
      },
    ];
    return criteria;
  }, [profile, scholarship, lang]);

  if (isLoading) {
    return (
      <div className="md:ml-64 p-6 md:p-10 max-w-5xl mx-auto space-y-8">
        <Skeleton className="w-32 h-8" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 space-y-8">
            <div className="bg-surface dark:bg-surface-container-lowest rounded-3xl p-8 shadow-sm border border-outline-variant space-y-6">
              <div className="flex justify-between items-start">
                <Skeleton className="w-20 h-20" />
                <Skeleton className="w-12 h-12 rounded-full" />
              </div>
              <Skeleton className="w-3/4 h-10" />
              <div className="flex gap-2">
                <Skeleton className="w-24 h-6 rounded-full" />
                <Skeleton className="w-24 h-6 rounded-full" />
              </div>
              <div className="space-y-4 pt-6">
                <Skeleton className="w-full h-4" />
                <Skeleton className="w-full h-4" />
                <Skeleton className="w-2/3 h-4" />
              </div>
            </div>
          </div>
          <div className="lg:col-span-4 space-y-6">
            <Skeleton className="w-full h-64 rounded-3xl" />
            <Skeleton className="w-full h-48 rounded-3xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="md:ml-64 p-6 md:p-10 max-w-5xl mx-auto"
    >
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-primary font-bold mb-8 hover:opacity-70 transition-opacity"
      >
        <ArrowRight className="w-5 h-5 rotate-180" />
        {lang === 'EN' ? 'Back to Results' : 'ಫಲಿತಾಂಶಗಳಿಗೆ ಹಿಂತಿರುಗಿ'}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Main Content */}
        <div className="lg:col-span-8 space-y-8">
          <div className="bg-surface dark:bg-surface-container-lowest rounded-3xl p-8 shadow-sm border border-outline-variant">
            <div className="flex justify-between items-start mb-6">
              <div className="w-20 h-20 bg-surface-container rounded-2xl flex items-center justify-center">
                <GraduationCap className="w-10 h-10 text-primary" />
              </div>
              <button 
                onClick={() => onToggleSave(scholarship.id)}
                className={`p-3 rounded-full transition-all ${isSaved ? 'bg-primary text-white' : 'bg-surface-container-high text-primary hover:bg-surface-container-highest'}`}
              >
                <Bookmark className={`w-6 h-6 ${isSaved ? 'fill-white' : ''}`} />
              </button>
              <button 
                onClick={handleShare}
                className="p-3 rounded-full bg-surface-container-high text-primary hover:bg-surface-container-highest transition-all"
                title={lang === 'EN' ? 'Share Scholarship' : 'ವಿದ್ಯಾರ್ಥಿವೇತನವನ್ನು ಹಂಚಿಕೊಳ್ಳಿ'}
              >
                <Share2 className="w-6 h-6" />
              </button>
            </div>

            <h1 className="text-3xl font-extrabold headline text-primary mb-4">{scholarship.title}</h1>
            <div className="flex flex-wrap gap-3 mb-8">
              <span className="px-4 py-1.5 bg-secondary-container text-on-secondary-container rounded-full text-xs font-bold uppercase tracking-wider">
                {scholarship.category}
              </span>
              {scholarship.tags.map(tag => (
                <span key={tag} className="px-4 py-1.5 bg-surface-container-highest text-primary rounded-full text-xs font-medium">
                  {tag}
                </span>
              ))}
            </div>

            <div className="prose prose-slate max-w-none">
              <h3 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" /> {lang === 'EN' ? 'Description' : 'ವಿವರಣೆ'}
              </h3>
              <p className="text-on-surface-variant leading-relaxed mb-8">
                {scholarship.description} {lang === 'EN' 
                  ? "This program aims to provide financial stability to meritorious students who demonstrate academic excellence and a commitment to their field of study. Eligible candidates will receive comprehensive support including tuition coverage and living allowances."
                  : "ಈ ಕಾರ್ಯಕ್ರಮವು ಶೈಕ್ಷಣಿಕ ಶ್ರೇಷ್ಠತೆ ಮತ್ತು ಅವರ ಅಧ್ಯಯನದ ಕ್ಷೇತ್ರದಲ್ಲಿ ಬದ್ಧತೆಯನ್ನು ಪ್ರದರ್ಶಿಸುವ ಪ್ರತಿಭಾವಂತ ವಿದ್ಯಾರ್ಥಿಗಳಿಗೆ ಆರ್ಥಿಕ ಸ್ಥಿರತೆಯನ್ನು ಒದಗಿಸುವ ಗುರಿಯನ್ನು ಹೊಂದಿದೆ. ಅರ್ಹ ಅಭ್ಯರ್ಥಿಗಳು ಬೋಧನಾ ಶುಲ್ಕ ಮತ್ತು ಜೀವನ ಭತ್ಯೆ ಸೇರಿದಂತೆ ಸಮಗ್ರ ಬೆಂಬಲವನ್ನು ಪಡೆಯುತ್ತಾರೆ."}
              </p>

              <h3 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" /> {lang === 'EN' ? 'Detailed Eligibility' : 'ವಿವರವಾದ ಅರ್ಹತೆ'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {eligibilityAnalysis.map((item, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant">
                    <div className="flex items-center gap-3 mb-2">
                      {item.status === 'eligible' ? (
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                      ) : item.status === 'warning' ? (
                        <Info className="w-5 h-5 text-amber-500" />
                      ) : (
                        <HelpCircle className="w-5 h-5 text-slate-400" />
                      )}
                      <span className="text-sm font-bold text-primary">{item.label}</span>
                    </div>
                    <p className="text-xs text-on-surface-variant pl-8">{item.detail}</p>
                  </div>
                ))}
              </div>

              <h3 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
                <FileCheck className="w-5 h-5" /> {lang === 'EN' ? 'Required Documents' : 'ಅಗತ್ಯವಿರುವ ದಾಖಲೆಗಳು'}
              </h3>
              <div className="bg-surface-container-low rounded-2xl p-6 mb-8">
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 text-sm text-on-surface-variant">
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> {lang === 'EN' ? 'Previous year mark sheets' : 'ಹಿಂದಿನ ವರ್ಷದ ಅಂಕಪಟ್ಟಿಗಳು'}</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> {lang === 'EN' ? 'Income certificate' : 'ಆದಾಯ ಪ್ರಮಾಣಪತ್ರ'}</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> {lang === 'EN' ? 'Caste certificate' : 'ಜಾತಿ ಪ್ರಮಾಣಪತ್ರ'}</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> {lang === 'EN' ? 'Admission proof' : 'ಪ್ರವೇಶ ಪುರಾವೆ'}</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> {lang === 'EN' ? 'Aadhar card' : 'ಆಧಾರ್ ಕಾರ್ಡ್'}</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> {lang === 'EN' ? 'Bank passbook copy' : 'ಬ್ಯಾಂಕ್ ಪಾಸ್‌ಬುಕ್ ಪ್ರತಿ'}</li>
                </ul>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mt-10">
              <button 
                onClick={handleApply}
                className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold text-lg shadow-xl shadow-primary/10 hover:opacity-90 transition-all"
              >
                {lang === 'EN' ? 'Apply on Official Portal' : 'ಅಧಿಕೃತ ಪೋರ್ಟಲ್‌ನಲ್ಲಿ ಅರ್ಜಿ ಸಲ್ಲಿಸಿ'}
              </button>
              <button 
                onClick={handleDownload}
                className="px-8 py-4 border-2 border-primary text-primary rounded-2xl font-bold hover:bg-primary/5 transition-all"
              >
                {lang === 'EN' ? 'Download Guide' : 'ಮಾರ್ಗದರ್ಶಿಯನ್ನು ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ'}
              </button>
            </div>
          </div>

          {/* Similar Scholarships */}
          <section className="space-y-6">
            <h2 className="text-2xl font-extrabold headline text-primary flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-tertiary" /> {lang === 'EN' ? 'Similar Opportunities' : 'ಇದೇ ರೀತಿಯ ಅವಕಾಶಗಳು'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {similarScholarships.map(s => (
                <div 
                  key={s.id}
                  onClick={() => onSelectScholarship(s.id)}
                  className="bg-surface dark:bg-surface-container-lowest border border-outline-variant rounded-3xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="w-10 h-10 bg-surface-container rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
                    <GraduationCap className="w-5 h-5 text-primary" />
                  </div>
                  <h4 className="font-bold text-primary text-sm mb-2 line-clamp-2">{s.title}</h4>
                  <p className="text-xs font-black text-tertiary mb-3">{s.reward}</p>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-primary uppercase tracking-wider">
                    {lang === 'EN' ? 'View Details' : 'ವಿವರಗಳನ್ನು ನೋಡಿ'} <ChevronRight className="w-3 h-3" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Sidebar Insights */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-primary text-white rounded-3xl p-6 shadow-xl shadow-primary/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Sparkles className="w-24 h-24" />
            </div>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Bot className="w-6 h-6" /> {lang === 'EN' ? 'AI Analysis' : 'AI ವಿಶ್ಲೇಷಣೆ'}
            </h3>
            <div className="space-y-6 relative z-10">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest opacity-70 mb-2">
                  {lang === 'EN' ? 'Match Probability' : 'ಹೊಂದಾಣಿಕೆಯ ಸಂಭವನೀಯತೆ'}
                </p>
                <div className="w-full h-2 bg-white/20 rounded-full mt-3 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${scholarship.matchScore || 85}%` }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className="h-full bg-white"
                  />
                </div>
              </div>
              
              <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
                <p className="text-xs font-bold uppercase tracking-widest opacity-70 mb-2">
                  {lang === 'EN' ? 'AI Insight' : 'AI ಒಳನೋಟ'}
                </p>
                <p className="text-sm leading-relaxed italic">
                  "{scholarship.aiInsight || (lang === 'EN' 
                    ? `Based on your profile as a ${profile.course} student, this scholarship offers a strong alignment with your academic background and financial needs.`
                    : `${profile.course} ವಿದ್ಯಾರ್ಥಿಯಾಗಿ ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಆಧಾರದ ಮೇಲೆ, ಈ ವಿದ್ಯಾರ್ಥಿವೇತನವು ನಿಮ್ಮ ಶೈಕ್ಷಣಿಕ ಹಿನ್ನೆಲೆ ಮತ್ತು ಆರ್ಥಿಕ ಅಗತ್ಯಗಳೊಂದಿಗೆ ಬಲವಾದ ಹೊಂದಾಣಿಕೆಯನ್ನು ನೀಡುತ್ತದೆ.`)}"
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest opacity-70">
                  {lang === 'EN' ? 'Key Success Factors' : 'ಪ್ರಮುಖ ಯಶಸ್ಸಿನ ಅಂಶಗಳು'}
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle className="w-4 h-4 text-emerald-300" />
                    <span>{lang === 'EN' ? 'Strong CGPA Alignment' : 'ಬಲವಾದ CGPA ಹೊಂದಾಣಿಕೆ'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle className="w-4 h-4 text-emerald-300" />
                    <span>{lang === 'EN' ? 'Valid Category Documents' : 'ಮಾನ್ಯ ವರ್ಗದ ದಾಖಲೆಗಳು'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle className="w-4 h-4 text-emerald-300" />
                    <span>{lang === 'EN' ? 'Early Application Advantage' : 'ಆರಂಭಿಕ ಅರ್ಜಿಯ ಪ್ರಯೋಜನ'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface dark:bg-surface-container-lowest border border-outline-variant rounded-3xl p-6 shadow-sm">
            <h3 className="font-bold text-primary mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-secondary" /> Important Dates
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                <span className="text-sm text-on-surface-variant">Application Starts</span>
                <span className="text-sm font-bold text-primary">01 Sep 2025</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                <span className="text-sm text-on-surface-variant">Deadline</span>
                <span className="text-sm font-bold text-error">{scholarship.deadline} 2025</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-on-surface-variant">Result Declaration</span>
                <span className="text-sm font-bold text-primary">15 Jan 2026</span>
              </div>
            </div>
          </div>

          <div className="bg-surface-container rounded-3xl p-6">
            <h3 className="font-bold text-primary mb-2 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-primary" /> Need Help?
            </h3>
            <p className="text-xs text-on-surface-variant mb-4">Our AI assistant can help you with the application process and document verification.</p>
            <button 
              onClick={onOpenChat}
              className="w-full py-3 bg-white text-primary rounded-xl text-sm font-bold shadow-sm hover:shadow-md transition-all"
            >
              Chat with Assistant
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

interface AIChatbotProps {
  isOpen: boolean;
  onToggle: () => void;
}

const AIChatbot = ({ isOpen, onToggle, lang }: AIChatbotProps & { lang: Language }) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([
    { role: 'model', text: lang === 'EN' 
      ? 'Hello! I am your AI Scholarship Assistant. How can I help you today? You can ask me in English or Kannada.'
      : 'ನಮಸ್ಕಾರ! ನಾನು ನಿಮ್ಮ AI ವಿದ್ಯಾರ್ಥಿವೇತನ ಸಹಾಯಕ. ನಾನು ಇಂದು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು? ನೀವು ನನ್ನನ್ನು ಇಂಗ್ಲಿಷ್ ಅಥವಾ ಕನ್ನಡದಲ್ಲಿ ಕೇಳಬಹುದು.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSend = async (text?: string) => {
    const userMessage = (text || input).trim();
    if (!userMessage || isLoading) return;

    const apiKey = process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      setMessages(prev => [...prev, { role: 'model', text: 'Chat is not available. Please configure the Gemini API key in your .env file.' }]);
      return;
    }

    setInput('');
    const currentMessages = [...messages, { role: 'user' as const, text: userMessage }];
    setMessages(currentMessages);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey });
      const chat = ai.chats.create({
        model: "gemini-3.1-flash-lite-preview",
        config: {
          systemInstruction: `You are "The Academic Curator" AI Assistant. 
          Your goal is to help Indian students (specifically from Karnataka and across India) find scholarships, understand application processes, and provide career guidance.
          
          Key Responsibilities:
          1. Scholarship Search: Provide details on SSP Karnataka, NSP, FFE, Vidyasaarathi, and private corporate grants.
          2. Application Guidance: Explain document requirements (Income, Caste, Marks cards), deadlines, and portal navigation.
          3. Career Guidance: Offer advice on courses, colleges, and future career paths based on student interests.
          
          Language Support:
          - You MUST support both English and Kannada.
          - If the user asks in Kannada, respond in Kannada.
          - If the user asks in English, respond in English.
          - If the user mixes languages, respond in the language that seems most natural for the context.
          
          Tone:
          - Be encouraging, empathetic, accurate, and professional.
          - Use clear, simple language.
          
          Context:
          - You are integrated into "The Academic Curator" app.
          - Mention that the app can help track deadlines and match profiles.`,
        },
        history: messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }))
      });

      const response = await chat.sendMessage({ message: userMessage });
      setMessages(prev => [...prev, { role: 'model', text: response.text || 'Sorry, I could not generate a response.' }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'model', text: 'I encountered an error. Please try again later.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([{ role: 'model', text: lang === 'EN' 
      ? 'Hello! I am your AI Scholarship Assistant. How can I help you today? You can ask me in English or Kannada.'
      : 'ನಮಸ್ಕಾರ! ನಾನು ನಿಮ್ಮ AI ವಿದ್ಯಾರ್ಥಿವೇತನ ಸಹಾಯಕ. ನಾನು ಇಂದು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು? ನೀವು ನನ್ನನ್ನು ಇಂಗ್ಲಿಷ್ ಅಥವಾ ಕನ್ನಡದಲ್ಲಿ ಕೇಳಬಹುದು.' }]);
  };

  const quickQuestions = [
    { en: "What is SSP Karnataka?", kn: "SSP ಕರ್ನಾಟಕ ಎಂದರೇನು?" },
    { en: "Documents for NSP?", kn: "NSP ಗಾಗಿ ಬೇಕಾದ ದಾಖಲೆಗಳು?" },
    { en: "Career after B.Tech?", kn: "B.Tech ನಂತರದ ವೃತ್ತಿಜೀವನ?" }
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-[350px] md:w-[420px] h-[600px] bg-surface dark:bg-surface-container-lowest rounded-3xl shadow-2xl border border-outline-variant/30 flex flex-col overflow-hidden mb-4 relative"
          >
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-primary to-primary-container text-white flex justify-between items-center shadow-lg relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <span className="font-bold headline text-base block">Curator AI</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                    <span className="text-[10px] opacity-80 uppercase tracking-widest font-bold">
                      {lang === 'EN' ? 'Always Online' : 'ಯಾವಾಗಲೂ ಆನ್‌ಲೈನ್'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={clearChat}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  title={lang === 'EN' ? 'Clear Chat' : 'ಚಾಟ್ ಅಳಿಸಿ'}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button onClick={onToggle} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div 
              ref={scrollRef} 
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-4 space-y-4 bg-surface-container-low scroll-smooth relative"
            >
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] relative group ${
                    m.role === 'user' 
                      ? 'bg-primary text-white rounded-2xl rounded-tr-none shadow-md' 
                      : 'bg-surface dark:bg-surface-container text-on-surface shadow-sm border border-outline-variant/30 rounded-2xl rounded-tl-none'
                  }`}>
                    <div className="p-4 text-sm leading-relaxed">
                      <div className="markdown-body">
                        <Markdown>{m.text}</Markdown>
                      </div>
                    </div>
                    
                    {m.role === 'model' && (
                      <button 
                        onClick={() => copyToClipboard(m.text, i)}
                        className="absolute -right-10 top-0 p-2 text-on-surface-variant hover:text-primary opacity-0 group-hover:opacity-100 transition-all"
                        title="Copy message"
                      >
                        {copiedIndex === i ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-surface dark:bg-surface-container p-4 rounded-2xl rounded-tl-none shadow-sm border border-outline-variant/30">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <motion.div 
                          animate={{ y: [0, -5, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                          className="w-1.5 h-1.5 bg-primary rounded-full"
                        />
                        <motion.div 
                          animate={{ y: [0, -5, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                          className="w-1.5 h-1.5 bg-primary rounded-full"
                        />
                        <motion.div 
                          animate={{ y: [0, -5, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                          className="w-1.5 h-1.5 bg-primary rounded-full"
                        />
                      </div>
                      <span className="text-[10px] font-bold text-primary/50 uppercase tracking-widest">AI is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              
              {messages.length === 1 && (
                <div className="pt-4 space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <div className="h-px flex-1 bg-outline-variant/30"></div>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                      {lang === 'EN' ? 'Quick Questions' : 'ತ್ವರಿತ ಪ್ರಶ್ನೆಗಳು'}
                    </p>
                    <div className="h-px flex-1 bg-outline-variant/30"></div>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {quickQuestions.map((q, i) => (
                      <button 
                        key={i}
                        onClick={() => handleSend(q.en)}
                        className="text-left p-4 bg-surface dark:bg-surface-container border border-outline-variant/30 rounded-2xl text-xs font-medium text-primary hover:bg-primary hover:text-white transition-all shadow-sm hover:shadow-md group"
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold">{q.en}</span>
                            <span className="text-[10px] opacity-60 group-hover:opacity-80">{q.kn}</span>
                          </div>
                          <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Scroll to bottom button */}
            <AnimatePresence>
              {showScrollButton && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={scrollToBottom}
                  className="absolute bottom-24 right-6 p-2 bg-surface dark:bg-surface-container text-primary rounded-full shadow-lg border border-outline-variant/30 z-20 hover:scale-110 transition-all"
                >
                  <ArrowDown className="w-5 h-5" />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Input Area */}
            <div className="p-4 bg-surface dark:bg-surface-container border-t border-outline-variant/30 relative z-10">
              <div className="relative flex items-center gap-2">
                <div className="relative flex-1">
                  <input 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder={lang === 'EN' ? "Ask in English or ಕನ್ನಡ..." : "ಇಂಗ್ಲಿಷ್ ಅಥವಾ ಕನ್ನಡದಲ್ಲಿ ಕೇಳಿ..."}
                    className="w-full bg-surface-container-low border-none rounded-2xl pl-4 pr-10 py-3.5 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors">
                    <Mic className="w-4 h-4" />
                  </button>
                </div>
                <button 
                  onClick={() => handleSend()}
                  disabled={isLoading || !input.trim()}
                  className="p-3.5 bg-primary text-white rounded-2xl hover:opacity-90 disabled:opacity-30 transition-all shadow-lg shadow-primary/20"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              <p className="text-[9px] text-center text-on-surface-variant mt-3 font-medium">
                {lang === 'EN' 
                  ? 'AI can make mistakes. Verify important scholarship dates.' 
                  : 'AI ತಪ್ಪುಗಳನ್ನು ಮಾಡಬಹುದು. ಪ್ರಮುಖ ವಿದ್ಯಾರ್ಥಿವೇತನ ದಿನಾಂಕಗಳನ್ನು ಪರಿಶೀಲಿಸಿ.'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button 
        onClick={onToggle}
        className={`w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 ${
          isOpen ? 'bg-surface dark:bg-surface-container-lowest text-primary border border-outline-variant' : 'bg-primary text-white'
        }`}
      >
        {isOpen ? <X className="w-7 h-7" /> : <MessageSquare className="w-7 h-7" />}
        {!isOpen && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-tertiary text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white animate-pulse">
            1
          </span>
        )}
      </button>
    </div>
  );
};

function AppContent() {
  const { user, loading: authLoading } = useAuth();
  const [page, setPage] = useState<Page>('landing');
  const [previousPage, setPreviousPage] = useState<Page>('landing');
  const [lang, setLang] = useState<Language>('EN');

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleNavigate = (newPage: Page) => {
    if (newPage === page && newPage === 'profile') {
      setPage(previousPage === 'profile' ? 'landing' : previousPage);
    } else {
      setPreviousPage(page);
      setPage(newPage);
    }
  };
  const [filters, setFilters] = useState<SearchFilters | null>(null);
  const [selectedScholarshipId, setSelectedScholarshipId] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    fullName: '',
    email: '',
    phone: '',
    course: '',
    category: '',
    income: '',
    cgpa: '',
    careerGoals: ''
  });
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);

  // Sync Profile with Firestore
  useEffect(() => {
    if (!user) {
      setIsDataLoading(false);
      return;
    }

    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserProfile(docSnap.data() as UserProfile);
      } else {
        // Initialize profile if it doesn't exist
        setDoc(userRef, {
          fullName: user.displayName || '',
          email: user.email || '',
          phone: '',
          course: '',
          category: '',
          income: '',
          cgpa: '',
          careerGoals: '',
          role: 'user'
        });
      }
      setIsDataLoading(false);
    });

    return unsubscribe;
  }, [user]);

  // Sync Saved Scholarships with Firestore
  useEffect(() => {
    if (!user) return;

    const savedRef = collection(db, 'users', user.uid, 'savedScholarships');
    const unsubscribe = onSnapshot(savedRef, (snapshot) => {
      const ids = snapshot.docs.map(doc => doc.data().scholarshipId);
      setSavedIds(ids);
    });

    return unsubscribe;
  }, [user]);

  // Sync Notifications with Firestore
  useEffect(() => {
    if (!user) return;

    const notifRef = collection(db, 'users', user.uid, 'notifications');
    const q = query(notifRef, orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Filter to only show unread notifications and limit to last 90 days to avoid old demo data
      const now = new Date();
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      
      const notifs = snapshot.docs
        .map(doc => doc.data() as AppNotification)
        .filter(n => {
          const notifDate = new Date(n.date);
          return !n.read && notifDate > ninetyDaysAgo;
        });
      
      setNotifications(notifs);
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    const handleNavigate = (e: any) => setPage(e.detail);
    const handleOpenChat = () => setIsChatOpen(true);
    window.addEventListener('navigate', handleNavigate);
    window.addEventListener('openChat', handleOpenChat);

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      window.removeEventListener('navigate', handleNavigate);
      window.removeEventListener('openChat', handleOpenChat);
    };
  }, []);

  const addNotification = async (title: string, message: string, type: 'new' | 'deadline' | 'status') => {
    if (!user) return;

    const notifId = Math.random().toString(36).substr(2, 9);
    const newNotif: AppNotification = {
      id: notifId,
      title,
      message,
      type,
      date: new Date().toISOString(),
      read: false
    };

    await setDoc(doc(db, 'users', user.uid, 'notifications', notifId), newNotif);
    
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body: message });
    }
  };

  const markNotificationRead = async (id: string) => {
    if (!user) return;
    await setDoc(doc(db, 'users', user.uid, 'notifications', id), { read: true }, { merge: true });
  };

  const toggleSave = async (id: string) => {
    if (!user) {
      setPage('login');
      return;
    }

    const savedRef = doc(db, 'users', user.uid, 'savedScholarships', id);
    if (savedIds.includes(id)) {
      await deleteDoc(savedRef);
    } else {
      await setDoc(savedRef, {
        scholarshipId: id,
        savedAt: new Date().toISOString()
      });
    }
  };

  const handleProfileSave = async (p: UserProfile) => {
    if (!user) return;
    await setDoc(doc(db, 'users', user.uid), p, { merge: true });
  };

  const handleSearch = (newFilters: SearchFilters) => {
    setFilters(newFilters);
    setPage('dashboard');
  };

  const handleSelectScholarship = (id: string) => {
    setSelectedScholarshipId(id);
    setPage('details');
  };

  // Deadline Reminder System
  useEffect(() => {
    if (!user || isDataLoading) return;

    const checkDeadlines = async () => {
      const now = new Date();
      const currentYear = now.getFullYear();
      
      const parseDeadline = (deadlineStr: string) => {
        const parts = deadlineStr.split(' ');
        if (parts.length !== 2) return null;
        const [day, monthStr] = parts;
        const months: { [key: string]: number } = {
          'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
          'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
        };
        const month = months[monthStr];
        if (month === undefined) return null;
        return new Date(currentYear, month, parseInt(day));
      };

      // Check saved scholarships and high-match scholarships
      const savedScholarships = SCHOLARSHIPS.filter(s => savedIds.includes(s.id));
      const recommendedScholarships = SCHOLARSHIPS.filter(s => {
        if (savedIds.includes(s.id)) return false;
        // Simple match logic: if course matches or it's general
        const isEligible = s.tags.includes(userProfile.course) || s.tags.includes('General');
        return isEligible;
      });

      const allToNotify = [...savedScholarships, ...recommendedScholarships];

      for (const s of allToNotify) {
        const deadlineDate = parseDeadline(s.deadline);
        if (!deadlineDate) continue;

        const diffTime = deadlineDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Notify if deadline is within 14 days and hasn't passed
        if (diffDays > 0 && diffDays <= 14) {
          const isSaved = savedIds.includes(s.id);
          const title = isSaved ? 'Saved Scholarship Deadline!' : 'Recommended Scholarship Closing!';
          const message = `${s.title} deadline is in ${diffDays} days (${s.deadline}). Apply now!`;
          
          const notifId = `deadline_${s.id}_${currentYear}`;
          
          // Check if already notified (avoid spamming)
          const alreadyNotified = notifications.some(n => n.id === notifId);
          
          if (!alreadyNotified) {
            const newNotif: AppNotification = {
              id: notifId,
              title,
              message,
              type: 'deadline',
              date: new Date().toISOString(),
              read: false
            };
            
            try {
              await setDoc(doc(db, 'users', user.uid, 'notifications', notifId), newNotif);
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(title, { body: message });
              }
            } catch (err) {
              console.error('Error sending deadline reminder:', err);
            }
          }
        }
      }
    };

    // Run once on load/profile change
    checkDeadlines();
  }, [user, savedIds, userProfile.course, isDataLoading]);

  const selectedScholarship = useMemo(() => {
    return SCHOLARSHIPS.find(s => s.id === selectedScholarshipId) || SCHOLARSHIPS[0];
  }, [selectedScholarshipId]);

  if (authLoading || (user && isDataLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-low">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-primary font-bold animate-pulse">Initializing Your Curator...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar 
        onNavigate={handleNavigate} 
        currentPage={page} 
        lang={lang} 
        setLang={setLang}
        notifications={notifications}
        isNotificationsOpen={isNotificationsOpen}
        setIsNotificationsOpen={setIsNotificationsOpen}
        onMarkRead={markNotificationRead}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
      />
      
      <div className="flex-1 flex flex-col">
        {page !== 'landing' && page !== 'login' && (
          <Sidebar 
            currentPage={page} 
            onNavigate={handleNavigate} 
            savedCount={savedIds.length}
            lang={lang}
          />
        )}
        
        <main className="flex-1">
          <AnimatePresence mode="wait">
            {page === 'login' && (
              <LoginPage key="login" onLoginSuccess={() => handleNavigate('landing')} lang={lang} />
            )}
            {page === 'landing' && (
              <LandingPage key="landing" onStart={() => handleNavigate(user ? 'search' : 'login')} onOpenChat={() => setIsChatOpen(true)} lang={lang} />
            )}
            {page === 'search' && (
              <SearchPage 
                key="search" 
                onSearch={handleSearch} 
                lang={lang} 
                onNavigate={handleNavigate}
                onOpenChat={() => setIsChatOpen(true)}
              />
            )}
            {page === 'dashboard' && (
              <DashboardPage 
                key="dashboard" 
                filters={filters} 
                savedIds={savedIds}
                onToggleSave={toggleSave}
                onSelectScholarship={handleSelectScholarship}
                userProfile={userProfile}
                lang={lang}
                onNavigate={handleNavigate}
                onOpenChat={() => setIsChatOpen(true)}
              />
            )}
            {page === 'saved' && (
              <SavedPage 
                key="saved" 
                savedIds={savedIds} 
                onToggleSave={toggleSave} 
                onSelectScholarship={handleSelectScholarship}
                lang={lang}
              />
            )}
            {page === 'profile' && (
              <UserProfilePage 
                key="profile" 
                profile={userProfile} 
                onSave={handleProfileSave} 
                lang={lang}
              />
            )}
            {page === 'about' && (
              <AboutPage key="about" lang={lang} />
            )}
            {page === 'details' && (
              <ScholarshipDetailPage 
                key="details" 
                scholarship={selectedScholarship}
                onBack={() => handleNavigate('dashboard')}
                onToggleSave={toggleSave}
                isSaved={savedIds.includes(selectedScholarship.id)}
                profile={userProfile}
                allScholarships={SCHOLARSHIPS}
                onSelectScholarship={handleSelectScholarship}
                onOpenChat={() => setIsChatOpen(true)}
                lang={lang}
              />
            )}
          </AnimatePresence>
        </main>
      </div>

      <AIChatbot isOpen={isChatOpen} onToggle={() => setIsChatOpen(!isChatOpen)} lang={lang} />
      <Footer isInternal={page !== 'landing'} lang={lang} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SmoothScroll>
        <AppContent />
      </SmoothScroll>
    </AuthProvider>
  );
}
