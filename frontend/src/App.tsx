/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, type ReactNode } from 'react';
import { 
  Library, 
  Home as HomeIcon, 
  Users, 
  MessageSquare, 
  User as UserIcon, 
  Settings, 
  Bell, 
  Search, 
  ArrowLeft,
  ChevronRight,
  Send,
  Plus,
  BookOpen,
  Mic,
  MoreHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BOOKS, ANNOTATIONS, MESSAGES, CURRENT_USER } from './mockData';
import type { Book } from './types';

// --- Sub-components (Views) will be defined here or imported ---

type View = 'login' | 'home' | 'library' | 'reading-room' | 'profile';

/** 优先续读：第一本有进度的书，否则列表第一本 */
function getContinueReadingBook(): Book {
  return BOOKS.find((b) => b.progress != null) ?? BOOKS[0];
}

export default function App() {
  const [currentView, setCurrentView] = useState<View>('login');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [readingBookId, setReadingBookId] = useState<string>(() => getContinueReadingBook().id);

  const handleNavigate = (view: View) => {
    setCurrentView(view);
    setShowMobileMenu(false);
  };

  /** 进入阅读室；未传 id 时使用「续读书籍」 */
  const startReading = (bookId?: string) => {
    setReadingBookId(bookId ?? getContinueReadingBook().id);
    handleNavigate('reading-room');
  };

  const readingBook = BOOKS.find((b) => b.id === readingBookId) ?? BOOKS[0];

  if (currentView === 'login') {
    return <LoginView onLogin={() => handleNavigate('home')} />;
  }

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-surface border-r border-surface-container sticky top-0 h-screen p-6">
        <div className="mb-10">
          <h1 className="text-2xl font-serif italic text-primary leading-none">ReadTogether</h1>
          <p className="text-xs text-on-surface-variant italic mt-1">Scholarly Modernism</p>
        </div>

        <nav className="flex-1 space-y-1">
          <NavItem 
            icon={<HomeIcon size={20} />} 
            label="Home Feed" 
            active={currentView === 'home'} 
            onClick={() => handleNavigate('home')} 
          />
          <NavItem 
            icon={<Library size={20} />} 
            label="Library" 
            active={currentView === 'library'} 
            onClick={() => handleNavigate('library')} 
          />
          <NavItem 
            icon={<BookOpen size={20} />} 
            label="Reading Rooms" 
            active={currentView === 'reading-room'} 
            onClick={() => handleNavigate('reading-room')} 
          />
          <NavItem 
            icon={<MessageSquare size={20} />} 
            label="Community" 
            active={false} 
            onClick={() => {}} 
          />
        </nav>

        <div className="mt-auto space-y-2 border-t border-surface-container pt-8">
          <NavItem 
            icon={<UserIcon size={20} />} 
            label="Profile" 
            active={currentView === 'profile'} 
            onClick={() => handleNavigate('profile')} 
          />
          <NavItem 
            icon={<Settings size={20} />} 
            label="Settings" 
            active={false} 
            onClick={() => {}} 
          />
          <button
            type="button"
            onClick={() => startReading()}
            className="w-full bg-secondary text-on-secondary py-3 px-4 rounded-lg font-serif font-medium mt-4 hover:opacity-90 transition-opacity active:scale-95 duration-150"
          >
            Start Reading
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top App Bar */}
        <header className="bg-surface/80 backdrop-blur-md border-b border-surface-container sticky top-0 z-40 px-6 py-3 flex justify-between items-center w-full">
          <div className="flex items-center gap-4 lg:hidden">
             <h1 className="text-xl font-serif italic text-primary">ReadTogether</h1>
          </div>
          
          <div className="hidden md:flex items-center bg-surface-container-low rounded-full px-4 py-2 gap-2 border border-outline-variant/30 w-80">
            <Search size={16} className="text-on-surface-variant" />
            <input 
              type="text" 
              placeholder="Search collection..." 
              className="bg-transparent border-none text-sm p-0 focus:ring-0 w-full placeholder:text-on-surface-variant/60"
            />
          </div>

          <div className="flex items-center gap-2">
            <button className="p-2 rounded-full hover:bg-surface-container text-on-surface transition-colors">
              <Bell size={20} />
            </button>
            <button className="p-2 rounded-full hover:bg-surface-container text-on-surface transition-colors">
              <Settings size={20} />
            </button>
            <div 
              className="w-8 h-8 rounded-full border border-surface-container cursor-pointer overflow-hidden ml-2"
              onClick={() => handleNavigate('profile')}
            >
              <img src={CURRENT_USER.avatar} alt="Profile" className="w-full h-full object-cover" />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              {currentView === 'home' && (
                <HomeView
                  primaryBook={getContinueReadingBook()}
                  onStartReading={startReading}
                  onBrowseLibrary={() => handleNavigate('library')}
                />
              )}
              {currentView === 'library' && <LibraryView onStartReading={startReading} />}
              {currentView === 'profile' && <ProfileView />}
              {currentView === 'reading-room' && <ReadingRoomView book={readingBook} />}
            </motion.div>
          </AnimatePresence>
        </div>
        
        {/* Floating Action Button (Contextual) */}
        {['home', 'library', 'profile'].includes(currentView) && (
          <motion.button
            type="button"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={() => startReading()}
            aria-label="开始阅读"
            className="fixed bottom-24 right-8 lg:bottom-12 lg:right-12 w-16 h-16 bg-secondary text-on-secondary rounded-full shadow-[0_8px_32px_rgba(71,101,80,0.3)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40"
          >
            <Plus size={32} />
          </motion.button>
        )}

        {/* Spacer for mobile bottom nav */}
        <div className="h-20 lg:hidden"></div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 lg:hidden bg-surface/95 backdrop-blur-lg border-t border-surface-container flex justify-around items-center px-4 py-3 z-50">
        <MobileNavItem icon={<HomeIcon size={24} />} label="Home" active={currentView === 'home'} onClick={() => handleNavigate('home')} />
        <MobileNavItem icon={<Library size={24} />} label="Library" active={currentView === 'library'} onClick={() => handleNavigate('library')} />
        <MobileNavItem icon={<BookOpen size={24} />} label="Rooms" active={currentView === 'reading-room'} onClick={() => handleNavigate('reading-room')} />
        <MobileNavItem icon={<UserIcon size={24} />} label="Profile" active={currentView === 'profile'} onClick={() => handleNavigate('profile')} />
      </nav>
    </div>
  );
}

// --- Internal UI Components ---

function NavItem({ icon, label, active, onClick }: { icon: ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-all duration-200 font-serif tracking-tight ${
        active 
          ? 'text-secondary border-l-4 border-secondary bg-surface-container-low font-semibold' 
          : 'text-on-surface-variant hover:text-secondary hover:bg-surface-container-lowest pl-5'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function MobileNavItem({ icon, label, active, onClick }: { icon: ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 ${active ? 'text-secondary scale-110' : 'text-on-surface-variant/60'}`}>
      {icon}
      <span className="text-[10px] uppercase font-serif tracking-widest">{label}</span>
    </button>
  );
}

function LibrarySection({ title, color, books, onSelectBook }: { title: string, color: string, books: Book[], onSelectBook: (bookId: string) => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className={`h-6 w-1 ${color} rounded-full`}></div>
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-on-surface-variant">{title}</h3>
      </div>
      <div className="flex gap-6 overflow-x-auto pb-4 hide-scrollbar">
        {books.map(book => (
          <div key={book.id} className="shrink-0 w-40 group cursor-pointer" onClick={() => onSelectBook(book.id)}>
            <div className="aspect-[2/3] rounded-lg overflow-hidden shadow-sm group-hover:shadow-xl transition-all duration-300 transform group-hover:-translate-y-1">
              <img src={book.cover} alt={book.title} className="w-full h-full object-cover" />
            </div>
            <div className="mt-3 space-y-0.5">
              <p className="text-sm font-bold text-primary line-clamp-1 group-hover:text-secondary transition-colors">{book.title}</p>
              <p className="text-[10px] text-on-surface-variant italic">{book.author}</p>
            </div>
          </div>
        ))}
        {/* Placeholder to add more */}
        <div className="shrink-0 w-40 aspect-[2/3] border-2 border-dashed border-surface-container rounded-lg flex flex-col items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer group">
           <Plus size={24} className="group-hover:scale-110 transition-transform" />
           <span className="text-[10px] font-bold uppercase tracking-widest mt-2">Add New</span>
        </div>
      </div>
    </div>
  );
}

// --- Views Implementation ---

function LoginView({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden font-sans">
      <div className="absolute inset-0 z-0">
        <img 
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuD1vgt1a9ntxkA7fZjiYZ_AycwKMWQ8kDreImUkBGmowjtNwQ_TnfkfdBXSUjvs5sxi1QSV2D4mzUjRnOsqbDjcImLeU27empmsPzx-UuEl6wvAhNNa_t682pQZPALqzAuIszIqP1y2Ky5N0IdWuvg-9FWR_7OFvOlVRXFkS7Vhr1IFln2tC3vNX0Due7XOgrLJHhOV1Yde7VaG4SSRMzLkj6j9DUB6FH8ybhawBf2n7Ek_SEdCYglGQU-st886IY30EHZwYDOEhg" 
          alt="Library" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-primary/60 mix-blend-multiply"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-primary/40"></div>
      </div>

      <nav className="absolute top-0 left-0 w-full p-8 z-20 flex justify-between items-center text-on-primary">
        <div className="flex items-center gap-2 cursor-pointer opacity-90 hover:opacity-100 transition-opacity">
          <ArrowLeft size={20} />
          <span className="text-sm font-medium tracking-wide">Back to Home</span>
        </div>
        <div className="text-2xl font-serif italic tracking-tight opacity-90">ReadTogether</div>
      </nav>

      <main className="relative z-10 w-full max-w-md px-6 py-12">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel rounded-xl p-10 shadow-2xl"
        >
          <header className="text-center mb-10">
            <h1 className="text-4xl font-serif text-on-primary mb-2">Welcome Back</h1>
            <p className="text-on-surface-variant text-stone-300 italic">Enter the quiet room of collective thought.</p>
          </header>

          <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); onLogin(); }}>
            <div className="space-y-1.5">
              <label className="block text-[10px] uppercase font-bold tracking-widest text-stone-300 ml-1">Email Address</label>
              <input 
                type="email" 
                placeholder="scholar@readtogether.com" 
                className="w-full bg-white/10 border-none rounded-lg px-4 py-3 text-on-primary placeholder:text-stone-500 focus:ring-2 focus:ring-secondary focus:bg-white/20 transition-all outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center px-1">
                <label className="block text-[10px] uppercase font-bold tracking-widest text-stone-300">Password</label>
                <a href="#" className="text-[10px] uppercase font-bold tracking-widest text-secondary-container hover:text-white transition-colors">Forgot?</a>
              </div>
              <input 
                type="password" 
                placeholder="••••••••" 
                className="w-full bg-white/10 border-none rounded-lg px-4 py-3 text-on-primary placeholder:text-stone-500 focus:ring-2 focus:ring-secondary focus:bg-white/20 transition-all outline-none"
              />
            </div>
            <button className="w-full bg-secondary text-on-primary font-semibold py-4 rounded-lg hover:bg-secondary/90 active:scale-[0.98] transition-all shadow-lg shadow-secondary/20">
              Sign In
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold">
              <span className="bg-transparent px-3 text-stone-400">or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button className="flex items-center justify-center gap-2 py-2.5 bg-white/5 border border-white/10 rounded-lg text-stone-300 hover:bg-white/10 transition-colors">
              <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuC1-u26NHxR7rsZ4lMlwHVhmV1vl_GjZ6fSRXuVRLTCz3ktyJ8xhUrjcZIIMPwGj1VhLMIY48FAgUphcirfcwb6z1Wa1Uq0mHeLyPDB30coCObGobylxf5nfdA0gcbwkZCyCn-zKLTYm7rMcxARSYaiI1vGELHp6ldLEW6RuswnlNI1U1W4WHc5-KyXj4ImtCv42V6RA_myD560MoGaJICOjTFDNN6NvVtHkCBOH3wLzodfAxDZdivBgClNVWP7djSzA3aRkdNi0g" alt="Google" className="w-4 h-4" />
              <span className="text-sm">Google</span>
            </button>
            <button className="flex items-center justify-center gap-2 py-2.5 bg-white/5 border border-white/10 rounded-lg text-stone-300 hover:bg-white/10 transition-colors">
              <UserIcon size={16} />
              <span className="text-sm">Guest</span>
            </button>
          </div>

          <footer className="mt-10 text-center">
            <p className="text-xs text-stone-400">
              New to the library? <a href="#" className="text-secondary-container font-semibold hover:underline">Create an account</a>
            </p>
          </footer>
        </motion.div>

        <div className="mt-12 text-center max-w-sm mx-auto">
          <div className="flex items-center justify-center gap-2 text-tertiary-fixed-dim mb-3">
             <BookOpen size={24} />
          </div>
          <p className="font-serif italic text-xl text-stone-200">
            "Creators are the heart of our community. Join to start your first Reading Room."
          </p>
          <div className="mt-4 w-12 h-0.5 bg-secondary mx-auto opacity-50"></div>
        </div>
      </main>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 text-stone-500 text-[10px] uppercase font-bold tracking-[0.2em] opacity-60">
        Established 2024 • A Digital Sanctuary for Readers
      </div>
    </div>
  );
}

function HomeView({
  primaryBook,
  onStartReading,
  onBrowseLibrary,
}: {
  primaryBook: Book;
  onStartReading: (bookId?: string) => void;
  onBrowseLibrary: () => void;
}) {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-12">
      {/* Hero Banner */}
      <section className="relative rounded-2xl overflow-hidden bg-primary-container p-12 min-h-[400px] flex flex-col justify-end">
        <div className="absolute inset-0 z-0 opacity-40">
          <img 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCrt-n6WNN-lSFw5okKJ-FTrYzkm9ZtHA4gpJMc4VnixDsCgRXbZM3MMlwQqCCcAQw8XV0EQdXlbcvUFUPIs_izzgYUpBPOi8FAp4oJ-02tZjzZEJBdhXgJ_qUgtLPEVV_RhnzdzIITL7Olg9Yv00M1Wytxpmh3E-JWLVmqglF13MrPsLXnG1PH-OCX97BDXOY1WtpAaBNtiJQrp28OgDmeKRsywR_IsrcGnN6SmmO9ZbMAgGwA6S6WWR8fTgWIWh21m153YGQlZw" 
            className="w-full h-full object-cover" 
            alt="Study"
          />
        </div>
        <div className="relative z-10 space-y-6 max-w-2xl">
          <h2 className="text-5xl font-serif text-on-primary leading-tight">Your journey through the world's great minds continues.</h2>
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() => onStartReading(primaryBook.id)}
              className="bg-secondary text-on-secondary px-6 py-3 rounded-lg font-medium shadow-lg hover:opacity-90 transition-opacity active:scale-95"
            >
              Start Reading: “{primaryBook.title}”
            </button>
            <button
              type="button"
              onClick={onBrowseLibrary}
              className="border border-white/30 text-white backdrop-blur-sm px-6 py-3 rounded-lg font-medium hover:bg-white/10 transition-colors"
            >
              Browse Collection
            </button>
          </div>
        </div>
      </section>

      {/* Recommended Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-3xl font-serif text-primary">Recommended for You</h3>
          <button className="text-[10px] uppercase font-bold tracking-widest text-on-tertiary-container hover:underline">View All</button>
        </div>
        <div className="flex gap-6 overflow-x-auto pb-4 hide-scrollbar">
          {BOOKS.filter(b => !b.progress).map(book => (
            <div key={book.id} className="shrink-0 w-48 group cursor-pointer" onClick={() => onStartReading(book.id)}>
              <div className="aspect-[2/3] rounded-xl overflow-hidden shadow-sm group-hover:shadow-lg transition-all duration-300 transform group-hover:-translate-y-1">
                <img src={book.cover} alt={book.title} className="w-full h-full object-cover" />
              </div>
              <div className="mt-4 space-y-1">
                <p className="text-base font-medium text-primary line-clamp-1">{book.title}</p>
                <p className="text-sm text-on-surface-variant italic">{book.author}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Activity Bento */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-3xl font-serif text-primary">Activity from Friends</h3>
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-surface-container flex gap-6">
              <img src={MESSAGES[1].authorAvatar} alt="user" className="w-12 h-12 rounded-full shrink-0 object-cover" />
              <div className="flex-1 space-y-4">
                <div className="flex items-baseline gap-1">
                  <span className="font-semibold text-primary">{MESSAGES[1].authorName}</span>
                  <span className="text-sm text-on-surface-variant">is reading</span>
                  <span className="font-semibold text-primary italic">Beyond Good and Evil</span>
                </div>
                <div className="border-l-4 border-tertiary-container bg-surface-container-low p-4 rounded-r-xl italic text-xl font-serif">
                  "The individual has always had to struggle to keep from being overwhelmed by the tribe. If you try it, you will be lonely often, and sometimes frightened..."
                </div>
                <div className="flex items-center gap-4 text-on-surface-variant text-xs">
                  <span className="flex items-center gap-1"><HomeIcon size={12} /> 12</span>
                  <span className="flex items-center gap-1"><MessageSquare size={12} /> 4</span>
                   <span className="ml-auto">2 hours ago</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-3xl font-serif text-primary">Trending</h3>
          <div className="bg-surface-container-high rounded-2xl p-6 space-y-6">
            <TrendItem number="01" title="Modernism & The Waste Land" readers={42} />
            <TrendItem number="02" title="Stoicism in Modern Life" readers={128} />
            <TrendItem number="03" title="Dostoevsky's Existentialism" readers={86} />
            <TrendItem number="04" title="The Poetics of Space" readers={34} />
            <button className="w-full text-center py-3 text-xs font-bold uppercase tracking-widest border border-outline-variant/30 rounded-lg hover:bg-surface-container-highest transition-colors">
              Explore All Rooms
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrendItem({ number, title, readers }: { number: string, title: string, readers: number }) {
  return (
    <div className="flex gap-4 group cursor-pointer">
      <span className="text-2xl font-serif text-on-surface-variant/40 shrink-0 w-8">{number}</span>
      <div className="space-y-0.5">
        <p className="text-base font-semibold text-primary group-hover:text-secondary transition-colors leading-tight">{title}</p>
        <p className="text-xs text-on-surface-variant">{readers} Active Readers</p>
      </div>
    </div>
  );
}

function LibraryView({ onStartReading }: { onStartReading: (bookId?: string) => void }) {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-12">
      <header className="flex flex-col md:flex-row gap-8 items-center border-b border-surface-container pb-12">
        <div className="w-full md:w-1/3 flex-shrink-0">
          <motion.div whileHover={{ scale: 1.02 }} className="relative group profile-shadow">
             <div className="absolute -inset-2 bg-gradient-to-tr from-secondary-container to-tertiary-fixed-dim opacity-20 blur-2xl group-hover:opacity-40 transition-opacity"></div>
             <img src={BOOKS[0].cover} alt="Cover" className="relative w-full aspect-[2/3] object-cover rounded-xl shadow-2xl" />
          </motion.div>
        </div>
        <div className="w-full md:w-2/3 space-y-6">
          <div className="flex items-center gap-3">
             <span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase">Modern Classic</span>
             <span className="text-on-surface-variant text-sm flex items-center gap-1">★ 4.8 (2.4k reviews)</span>
          </div>
          <h1 className="text-6xl font-serif text-primary">{BOOKS[0].title}</h1>
          <p className="text-2xl font-serif text-on-primary-container italic">{BOOKS[0].author}</p>
          <p className="text-lg text-on-surface-variant leading-relaxed max-w-2xl">{BOOKS[0].description}</p>
          <div className="flex flex-wrap gap-4 pt-4">
            <button
              type="button"
              onClick={() => onStartReading(BOOKS[0].id)}
              className="bg-secondary text-on-primary px-8 py-4 rounded-xl flex items-center gap-3 font-serif text-lg hover:shadow-xl transition-all active:scale-95 shadow-lg shadow-secondary/20"
            >
              <Users size={20} /> Read Together
            </button>
            <button className="border-2 border-primary text-primary px-8 py-4 rounded-xl font-serif text-lg hover:bg-surface-container-low transition-all">
              Add to Library
            </button>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 pb-24">
        {/* Left Column: Stats & Chat Preview */}
        <div className="lg:col-span-4 space-y-10">
          <div className="bg-surface-container p-8 rounded-2xl border border-surface-container-highest">
            <h3 className="text-2xl font-serif mb-6">Active Readers</h3>
            <div className="flex -space-x-3 mb-6">
              {[1, 2, 3, 4].map(i => (
                <img key={i} src={`https://i.pravatar.cc/100?u=${i+20}`} className="w-12 h-12 rounded-full border-2 border-surface object-cover shadow-sm" alt="reader" />
              ))}
              <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary-fixed flex items-center justify-center text-xs font-bold border-2 border-surface shadow-sm">+42</div>
            </div>
            <p className="text-sm text-on-surface-variant italic mb-4">Currently 12 readers are on Chapter 4.</p>
            <div className="w-full bg-surface-container-highest h-1 rounded-full overflow-hidden">
              <div className="bg-secondary h-full transition-all duration-500" style={{ width: '35%' }}></div>
            </div>
            <div className="flex justify-between mt-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              <span>Start</span>
              <span>35% Progress</span>
              <span>End</span>
            </div>
          </div>

          {/* Mini Discussion Section from screenshot */}
          <div className="bg-white p-6 rounded-2xl border border-surface-container shadow-sm">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif">Live Forum</h3>
                <span className="flex items-center gap-1 text-[10px] font-bold text-secondary uppercase">
                   <span className="w-2 h-2 bg-secondary rounded-full animate-pulse"></span> Live
                </span>
             </div>
             <div className="space-y-4">
                {MESSAGES.slice(0, 2).map(msg => (
                  <div key={msg.id} className="flex gap-3">
                     <img src={msg.authorAvatar} className="w-8 h-8 rounded-full object-cover shrink-0" alt="avatar" />
                     <div className="space-y-1">
                        <p className="text-xs font-bold">{msg.authorName}</p>
                        <p className="text-xs text-on-surface-variant line-clamp-2">{msg.text}</p>
                     </div>
                  </div>
                ))}
             </div>
             <div className="mt-6 flex gap-2">
                <input type="text" placeholder="Share a thought..." className="flex-1 bg-surface-container-low border-none rounded-lg text-xs py-2 px-3 focus:ring-1 focus:ring-secondary" />
                <button className="text-secondary"><Send size={16} /></button>
             </div>
          </div>
        </div>

        {/* Right Column: Shared Annotations & Categorized Library */}
        <div className="lg:col-span-8 space-y-12">
           <div>
              <div className="flex items-center justify-between mb-8">
                 <h2 className="text-4xl font-serif">Shared Annotations</h2>
                 <div className="flex gap-4">
                   <button className="text-[10px] font-bold uppercase tracking-widest text-primary underline underline-offset-4">Most Popular</button>
                   <button className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant hover:text-primary">Recent</button>
                 </div>
              </div>
              
              <div className="space-y-6">
                {ANNOTATIONS.map(ann => (
                  <motion.div 
                    key={ann.id}
                    whileHover={{ x: 4 }}
                    className="group bg-white p-8 rounded-2xl border-l-4 border-tertiary-fixed-dim shadow-sm hover:shadow-md transition-all cursor-pointer"
                  >
                     <div className="flex justify-between items-start mb-6">
                       <div className="flex items-center gap-3">
                         <img src={ann.authorAvatar} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
                         <span className="text-sm font-semibold">{ann.authorName}</span>
                       </div>
                       <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{ann.chapter}, Page {ann.page}</span>
                     </div>
                     <blockquote className="text-2xl font-serif italic text-primary leading-relaxed mb-6">
                       {ann.text}
                     </blockquote>
                     <div className="flex items-center gap-6 text-on-surface-variant">
                        <button className="flex items-center gap-1 hover:text-tertiary transition-colors"><HomeIcon size={16} /> <span className="text-xs font-bold">{ann.likes}</span></button>
                        <button className="flex items-center gap-1 hover:text-secondary transition-colors"><MessageSquare size={16} /> <span className="text-xs font-bold">{ann.replies} Discussion Threads</span></button>
                     </div>
                  </motion.div>
                ))}
              </div>
              <button className="w-full mt-8 py-4 border-2 border-dashed border-surface-container rounded-2xl font-serif italic text-on-surface-variant hover:bg-surface-container transition-colors">
                 View 48 More Annotations
              </button>
           </div>

           {/* Categorized Collections Section */}
           <div className="space-y-10 pt-8">
              <LibrarySection title="CLASSICS (12)" color="bg-tertiary-fixed-dim" books={BOOKS.filter(b => b.category === 'Classics' || !b.category).slice(0, 4)} onSelectBook={(id) => onStartReading(id)} />
              <LibrarySection title="MODERN PHILOSOPHY (8)" color="bg-secondary-container" books={BOOKS.filter(b => b.category === 'Modern Philosophy').concat(BOOKS.slice(4, 5))} onSelectBook={(id) => onStartReading(id)} />
           </div>
        </div>
      </section>
    </div>
  );
}

function ReadingRoomView({ book }: { book: Book }) {
  const [message, setMessage] = useState('');
  const progressPct = Math.min(100, Math.max(0, book.progress ?? 0));
  const highlight = ANNOTATIONS.find((a) => a.bookId === book.id) ?? ANNOTATIONS[0];
  const estMinsRemaining =
    book.totalPages != null && book.readPages != null
      ? Math.max(1, Math.round(((book.totalPages - book.readPages) / Math.max(book.totalPages, 1)) * 60))
      : 12;

  return (
    <div className="relative flex h-[calc(100vh-64px)] overflow-hidden font-sans">
      {/* Discussion Sidebar - Hidden on mobile, shown on md+ */}
      <aside className="hidden lg:flex flex-col w-80 bg-surface-container-low border-r border-surface-container shrink-0">
        <div className="p-6 border-b border-surface-container bg-surface-container/50">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-serif">Live Discussion</h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-secondary-container text-on-secondary-container">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary mr-1.5 animate-pulse"></span> Live
            </span>
          </div>
          <p className="mt-2 text-xs text-on-surface-variant line-clamp-2 font-medium">{book.title}</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6 hide-scrollbar">
          {MESSAGES.map(msg => (
            <div key={msg.id} className={`flex flex-col gap-2 ${msg.isSystem ? 'items-center py-2' : ''}`}>
              {!msg.isSystem ? (
                <>
                  <div className="flex items-center gap-2">
                    <img src={msg.authorAvatar} alt="avatar" className="w-6 h-6 rounded-full object-cover" />
                    <span className="text-xs font-bold text-primary">{msg.authorName}</span>
                    <span className="text-[10px] text-on-surface-variant/60">{msg.timestamp}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-surface-container shadow-sm text-sm leading-relaxed">
                    {msg.text}
                  </div>
                </>
              ) : (
                <span className="text-[10px] font-bold uppercase tracking-widest bg-tertiary-fixed-dim/30 text-tertiary-container px-3 py-1 rounded-full">
                  {msg.text}
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="p-6 bg-surface-container-low border-t border-surface-container">
          <div className="relative">
            <input 
              type="text" 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Share a thought..."
              className="w-full bg-white border-none rounded-xl py-3 pl-4 pr-12 text-sm shadow-sm focus:ring-1 focus:ring-secondary"
            />
            <button type="button" className="absolute right-2 top-1.5 p-1.5 text-secondary hover:bg-secondary-container rounded-lg transition-colors" aria-label="Send message">
              <Send size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Reading Area */}
      <section className="flex-1 flex flex-col overflow-hidden bg-surface relative">
        <div className="flex-1 overflow-y-auto p-8 md:p-16 lg:p-24 hide-scrollbar">
          <div className="max-w-2xl mx-auto space-y-16">
            <header className="text-center space-y-4">
              <h1 className="text-5xl md:text-7xl font-serif text-primary leading-tight">{book.title}</h1>
              <p className="text-2xl md:text-3xl font-serif text-on-surface-variant italic">{book.author}</p>
              <div className="flex justify-center pt-8">
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-on-tertiary-fixed-variant border-b border-primary/20 pb-1">Chapter I: The Window</span>
              </div>
            </header>

            <article className="text-xl md:text-2xl font-serif text-on-surface leading-[1.8] space-y-10">
              <p>
                "Yes, of course, if it's fine tomorrow," said Mrs. Ramsay. "But you'll have to be up with the lark," she added.
              </p>
              <p>
                To her son these words conveyed an extraordinary joy, as if it were settled, the expedition were bound to take place, and the wonder to which he had looked forward, for years and years it seemed, was, after a night's darkness and a day's sail, within touch. Since he belonged, even at the age of six, to that great clan which cannot keep this feeling separate from that, but must let future prospects, with their joys and sorrows, cloud what is actually at hand.
              </p>
              
              <motion.blockquote 
                whileHover={{ scale: 1.01 }}
                className="my-16 p-8 border-l-4 border-tertiary-fixed-dim bg-surface-container-low/50 italic text-2xl md:text-3xl font-serif text-primary/90 shadow-sm relative group cursor-pointer"
              >
                {highlight.text}
                <div className="mt-6 flex items-center gap-3 not-italic">
                  <img src={highlight.authorAvatar} className="w-8 h-8 rounded-full border-2 border-white shadow-sm" alt="" />
                  <span className="text-xs font-bold text-on-primary-fixed-variant uppercase tracking-widest">Highlighted by {highlight.authorName.split(' ')[0]} and 4 others</span>
                </div>
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MessageSquare size={16} className="text-tertiary" />
                </div>
              </motion.blockquote>

              <p>
                James Ramsay, sitting on the floor cutting out pictures from the illustrated catalogue of the Army and Navy Stores, endowed the picture of a refrigerator as his mother spoke with heavenly bliss. It was fringed with joy. The wheelbarrow, the lawnmower, the sound of poplar trees, leaves whitening before rain, rooks cawing, broom clattering, dresses rustling—all these were so coloured and distinguished in his mind that he already had his private code, his secret language.
              </p>
              <p>
                "But," said his father, stopping in front of the drawing-room window, "it won't be fine."
              </p>
            </article>
            
            <div className="h-64"></div>
          </div>
        </div>

        {/* Floating Progress Tracker */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-xl">
           <div className="bg-surface/80 backdrop-blur-xl border border-surface-container-highest p-6 rounded-2xl shadow-2xl">
              <div className="flex justify-between items-center mb-3">
                 <div className="flex items-center gap-6">
                    <div className="text-center">
                       <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Progress</p>
                       <p className="text-lg font-serif">{progressPct}%</p>
                    </div>
                    <div className="w-px h-8 bg-surface-container-highest"></div>
                    <div className="text-center">
                       <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Remaining</p>
                       <p className="text-lg font-serif">{estMinsRemaining} mins</p>
                    </div>
                 </div>
                 <button type="button" className="bg-primary text-on-primary p-3 rounded-full shadow-lg active:scale-95 transition-transform" aria-label="Add bookmark">
                    <Plus size={20} />
                 </button>
              </div>
              <div className="w-full bg-surface-container-highest h-1 rounded-full overflow-hidden">
                 <motion.div 
                    key={book.id}
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPct}%` }}
                    className="h-full bg-secondary"
                 />
              </div>
           </div>
        </div>
      </section>

      {/* Voice Chat Component (Left Overlay) */}
      <div className="absolute bottom-24 left-6 hidden xl:block w-48">
         <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-surface-container space-y-4">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-2 text-primary font-bold">
                  <Mic size={14} className="text-secondary" />
                  <span className="text-xs uppercase tracking-widest">Voice</span>
               </div>
               <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            </div>
            <div className="grid grid-cols-2 gap-4">
               {[1, 2, 3].map(i => (
                 <div key={i} className="flex flex-col items-center gap-1">
                    <div className={`relative ${i === 1 ? 'ring-2 ring-secondary ring-offset-2' : ''} rounded-full`}>
                       <img src={`https://i.pravatar.cc/100?u=${i+10}`} alt="user" className="w-10 h-10 rounded-full object-cover" />
                       {i === 1 && <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-secondary rounded-full border-2 border-white shadow-sm"></div>}
                    </div>
                 </div>
               ))}
               <button className="w-10 h-10 rounded-full border-2 border-dashed border-outline-variant/30 flex items-center justify-center text-on-surface-variant hover:border-secondary hover:text-secondary transition-all">
                  <Plus size={16} />
               </button>
            </div>
         </div>
      </div>
    </div>
  );
}

function ProfileView() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-12 pb-24">
       <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
         <div className="lg:col-span-4 flex flex-col items-center lg:items-start space-y-6">
            <div className="relative group">
               <img src={CURRENT_USER.avatar} alt="Profile" className="w-48 h-48 lg:w-64 lg:h-64 rounded-3xl object-cover shadow-2xl border-4 border-white" />
               <div className="absolute -bottom-4 -right-4 bg-tertiary-fixed text-on-tertiary-container p-4 rounded-2xl shadow-xl border-4 border-surface group-hover:rotate-6 transition-transform">
                  <Library size={32} />
               </div>
            </div>
            <div className="text-center lg:text-left space-y-2">
               <h2 className="text-5xl font-serif text-primary">{CURRENT_USER.name}</h2>
               <p className="text-xl font-serif text-on-surface-variant italic">{CURRENT_USER.bio}</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
               {CURRENT_USER.badges.map(badge => (
                 <span key={badge} className="bg-surface-container-highest text-on-surface-variant px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase">
                   {badge}
                 </span>
               ))}
            </div>
         </div>

         <div className="lg:col-span-8 flex flex-col gap-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <StatCard icon={<Library size={24} />} value={CURRENT_USER.stats.booksRead} label="Books Read" color="secondary" />
               <StatCard icon={<HomeIcon size={24} />} value={CURRENT_USER.stats.hoursSpent.toLocaleString()} label="Hours Spent" color="primary" />
               <StatCard icon={<Users size={24} />} value={CURRENT_USER.stats.streakCount} label="Day Streak" color="tertiary" />
            </div>

            <div className="bg-white p-8 rounded-3xl border border-surface-container shadow-sm flex flex-col md:flex-row items-center gap-10">
               <div className="shrink-0 text-center md:text-left space-y-1">
                  <h3 className="text-2xl font-serif text-primary">Reading Identity</h3>
                  <p className="text-sm text-on-surface-variant">Your intellectual footprint is profound.</p>
               </div>
               <div className="flex flex-wrap gap-5 justify-center md:justify-end flex-grow">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-secondary-container hover:text-secondary transition-all cursor-pointer">
                       <MoreHorizontal />
                    </div>
                  ))}
               </div>
            </div>

            <div className="space-y-6">
               <div className="flex justify-between items-end">
                  <h3 className="text-3xl font-serif text-primary">Currently Reading</h3>
                  <button className="text-[10px] font-bold uppercase tracking-widest text-secondary hover:underline">View All</button>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {BOOKS.filter(b => b.progress).map(book => (
                    <div key={book.id} className="bg-white p-5 rounded-2xl border border-surface-container flex gap-5 shadow-sm hover:shadow-md transition-shadow">
                       <img src={book.cover} alt="cover" className="w-24 h-36 rounded-lg object-cover shadow-sm" />
                       <div className="flex flex-col justify-between py-1 flex-grow">
                          <div className="space-y-1">
                             <h4 className="text-lg font-serif font-bold text-primary">{book.title}</h4>
                             <p className="text-xs text-on-surface-variant italic">{book.author}</p>
                          </div>
                          <div className="space-y-2">
                             <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                                <span className="text-secondary">{book.progress}%</span>
                                <span className="text-on-surface-variant/40">{book.readPages} / {book.totalPages} pages</span>
                             </div>
                             <div className="w-full bg-surface-container-highest h-1 rounded-full overflow-hidden">
                                <div className="bg-secondary h-full" style={{ width: `${book.progress}%` }}></div>
                             </div>
                          </div>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
         </div>
       </section>
    </div>
  );
}

function StatCard({ icon, value, label, color }: { icon: ReactNode, value: number | string, label: string, color: string }) {
  const colorClass = {
    secondary: 'text-secondary bg-secondary-container/20',
    primary: 'text-primary bg-primary-container/20',
    tertiary: 'text-tertiary-container bg-tertiary-fixed-dim/20'
  }[color as 'secondary' | 'primary' | 'tertiary'];

  return (
    <div className="bg-surface-container-low p-8 rounded-3xl border border-surface-container flex flex-col items-center text-center space-y-2 transition-transform hover:-translate-y-1 duration-300">
      <div className={`p-3 rounded-2xl ${colorClass} mb-2`}>
        {icon}
      </div>
      <span className="text-4xl font-serif text-primary font-bold">{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">{label}</span>
    </div>
  );
}
