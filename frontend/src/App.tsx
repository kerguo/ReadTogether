/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
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
  BookMarked,
  MoreHorizontal,
  FileText,
  Upload,
  X,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BOOKS, ANNOTATIONS, MESSAGES, CURRENT_USER } from './mockData';
import type { Book, Message, VocabularyEntry } from './types';
import {
  clearAccessToken,
  createDiscussionMessage,
  createVocabularyEntry,
  listBooks,
  listDiscussionMessages,
  listVocabularyEntries,
  getWechatQrStatus,
  getCurrentUser,
  getStoredAccessToken,
  login,
  mockConfirmWechatQr,
  register,
  resendVerification,
  saveAccessToken,
  startWechatQrLogin,
  uploadBookPdf,
  verifyEmail,
  type AuthResponse,
  type AuthUser,
  type BookResponse,
  type DiscussionMessageResponse,
  type RegisterResponse,
  type VocabularyEntryResponse,
} from './api/auth';
import { DraggableVoicePanel } from './VoicePanel';

// --- Sub-components (Views) will be defined here or imported ---

type View = 'login' | 'home' | 'library' | 'reading-room' | 'vocabulary' | 'profile';
type AuthMode = 'login' | 'register';
type AuthAction =
  | { action: 'login'; email: string; password: string }
  | { action: 'register'; email: string; password: string; displayName: string }
  | { action: 'verifyEmail'; email: string; verificationCode: string }
  | { action: 'resendVerification'; email: string };
type ReadingTextBlock = { type: 'heading' | 'paragraph'; text: string };

const DISCUSSION_REFRESH_INTERVAL_MS = 5000;
const MAX_DISCUSSION_MESSAGE_LENGTH = 2000;

/** 优先续读：第一本有进度的书，否则列表第一本 */
function getContinueReadingBook(books: Book[] = BOOKS): Book {
  return books.find((b) => b.progress != null) ?? books[0] ?? BOOKS[0];
}

function createBookCover(title: string): string {
  const safeTitle = title.replace(/[<>&"]/g, '');
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="480" viewBox="0 0 320 480">
      <rect width="320" height="480" fill="#f1ede4"/>
      <rect x="26" y="28" width="268" height="424" rx="10" fill="#d7cdb9"/>
      <rect x="50" y="56" width="220" height="368" rx="4" fill="#f8f5ee" stroke="#8f7d62" stroke-width="2"/>
      <text x="160" y="214" text-anchor="middle" fill="#304337" font-family="Georgia, serif" font-size="26" font-weight="700">
        ${safeTitle.slice(0, 18)}
      </text>
      <text x="160" y="250" text-anchor="middle" fill="#5f6f65" font-family="Arial, sans-serif" font-size="13" letter-spacing="3">
        READTOGETHER
      </text>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function parseUploadedReadingText(contentText?: string): ReadingTextBlock[] {
  if (!contentText) {
    return [];
  }

  const lines = contentText
    .replace(/\f/g, '\n')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim());

  const blocks: ReadingTextBlock[] = [];
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    const text = paragraphLines.join(' ').replace(/\s+/g, ' ').trim();
    if (text) {
      blocks.push({ type: 'paragraph', text });
    }
    paragraphLines = [];
  };

  const addHeading = (text: string) => {
    flushParagraph();
    blocks.push({ type: 'heading', text: titleCaseHeading(text) });
  };

  lines.forEach((line) => {
    if (!line) {
      flushParagraph();
      return;
    }

    if (looksLikeHeading(line)) {
      addHeading(line);
      return;
    }

    if (paragraphLines.length > 0 && shouldStartNewParagraph(paragraphLines.at(-1) ?? '', line, paragraphLines)) {
      flushParagraph();
    }
    paragraphLines.push(line);
  });
  flushParagraph();

  return blocks.slice(0, 120);
}

function looksLikeHeading(line: string): boolean {
  const normalized = line.replace(/\s+/g, ' ').trim();
  if (normalized.length < 3 || normalized.length > 96) {
    return false;
  }
  if (/^(chapter|book|part)\s+([ivxlcdm]+|\d+)\b[:.\-\s]*/i.test(normalized)) {
    return true;
  }
  if (/^(contents|table of contents|preface|prologue|epilogue|introduction)$/i.test(normalized)) {
    return true;
  }
  const letters = normalized.replace(/[^A-Za-z]/g, '');
  return letters.length >= 6 && letters === letters.toUpperCase() && /\s/.test(normalized);
}

function shouldStartNewParagraph(previousLine: string, line: string, paragraphLines: string[]): boolean {
  const paragraphLength = paragraphLines.join(' ').length;
  if (paragraphLength > 650) {
    return true;
  }
  if (/["'”’)\]]?[.!?;:]$/.test(previousLine) && /^[A-Z"“‘']/.test(line)) {
    return true;
  }
  return previousLine.length < 72 && /^[A-Z"“‘']/.test(line);
}

function titleCaseHeading(text: string): string {
  if (text !== text.toUpperCase()) {
    return text;
  }
  return text
    .toLowerCase()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase())
    .replace(/\b(I|Ii|Iii|Iv|V|Vi|Vii|Viii|Ix|X)\b/g, (match) => match.toUpperCase());
}

function formatMessageTimestamp(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function getInitialDiscussionMessages(bookId: string): Message[] {
  return bookId === '1' ? MESSAGES : [];
}

function mapDiscussionMessage(message: DiscussionMessageResponse): Message {
  return {
    id: `db-${message.id}`,
    authorEmail: message.authorEmail,
    authorName: message.authorName,
    authorAvatar: message.authorAvatar,
    text: message.text,
    timestamp: formatMessageTimestamp(new Date(message.createdAt)),
  };
}

function mergeDiscussionMessages(bookId: string, messages: Message[]): Message[] {
  const byId = new Map<string, Message>();
  [...getInitialDiscussionMessages(bookId), ...messages].forEach((message) => {
    byId.set(message.id, message);
  });
  return Array.from(byId.values());
}

function mapVocabularyEntry(entry: VocabularyEntryResponse): VocabularyEntry {
  return {
    id: `vocab-${entry.id}`,
    bookId: entry.bookId,
    word: entry.word,
    context: entry.context,
    createdAt: entry.createdAt,
  };
}

function mapBook(book: BookResponse): Book {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    cover: book.coverUrl || createBookCover(book.title),
    category: book.category,
    totalPages: book.totalPages,
    readPages: 0,
    progress: 0,
    description: book.description,
    contentText: book.contentText,
    sourceFilename: book.sourceFilename,
    createdAt: book.createdAt,
  };
}

export default function App() {
  const [currentView, setCurrentView] = useState<View>('login');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [readingBookId, setReadingBookId] = useState<string>(() => getContinueReadingBook().id);
  const [books, setBooks] = useState<Book[]>(BOOKS);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authInitializing, setAuthInitializing] = useState(true);
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [discussionMessagesByBook, setDiscussionMessagesByBook] = useState<Record<string, Message[]>>({
    '1': MESSAGES,
  });
  const [discussionError, setDiscussionError] = useState('');
  const [isDiscussionSyncing, setIsDiscussionSyncing] = useState(false);
  const [lastDiscussionSyncAt, setLastDiscussionSyncAt] = useState<Date | null>(null);
  const [vocabularyEntries, setVocabularyEntries] = useState<VocabularyEntry[]>([]);
  const [vocabularyError, setVocabularyError] = useState('');
  const [bookError, setBookError] = useState('');

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) {
      setAuthInitializing(false);
      return;
    }

    getCurrentUser(token)
      .then((user) => {
        setAuthUser(user);
        setCurrentView('home');
      })
      .catch(() => {
        clearAccessToken();
      })
      .finally(() => {
        setAuthInitializing(false);
      });
  }, []);

  const handleNavigate = (view: View) => {
    setCurrentView(view);
    setShowMobileMenu(false);
  };

  /** 进入阅读室；未传 id 时使用「续读书籍」 */
  const startReading = (bookId?: string) => {
    setReadingBookId(bookId ?? getContinueReadingBook(books).id);
    handleNavigate('reading-room');
  };

  const handleAuthenticate = async (
    payload: AuthAction
  ): Promise<RegisterResponse | void> => {
    setIsAuthenticating(true);
    setAuthError('');
    try {
      if (payload.action === 'register') {
        return await register({
          email: payload.email,
          password: payload.password,
          displayName: payload.displayName.trim(),
        });
      }
      if (payload.action === 'resendVerification') {
        return await resendVerification(payload.email);
      }

      const response = payload.action === 'verifyEmail'
        ? await verifyEmail({
            email: payload.email,
            verificationCode: payload.verificationCode,
          })
        : await login({ email: payload.email, password: payload.password });
      saveAccessToken(response.accessToken);
      setAuthUser(response.user);
      handleNavigate('home');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed';
      setAuthError(message);
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    clearAccessToken();
    setAuthUser(null);
    setAuthError('');
    setCurrentView('login');
  };

  const handleWechatAuthSuccess = (response: AuthResponse) => {
    saveAccessToken(response.accessToken);
    setAuthUser(response.user);
    setAuthError('');
    handleNavigate('home');
  };

  const syncDiscussionMessages = useCallback(async (bookId: string, showSyncing = false) => {
    if (!authUser) {
      return;
    }
    const token = getStoredAccessToken();
    if (!token) {
      return;
    }
    if (showSyncing) {
      setIsDiscussionSyncing(true);
    }
    try {
      const messages = await listDiscussionMessages(bookId, token);
      const mappedMessages = messages.map(mapDiscussionMessage);
      setDiscussionMessagesByBook((prev) => ({
        ...prev,
        [bookId]: mergeDiscussionMessages(bookId, mappedMessages),
      }));
      setDiscussionError('');
      setLastDiscussionSyncAt(new Date());
    } catch (error) {
      setDiscussionError(error instanceof Error ? error.message : 'Failed to sync live discussion');
    } finally {
      if (showSyncing) {
        setIsDiscussionSyncing(false);
      }
    }
  }, [authUser]);

  useEffect(() => {
    if (!authUser) {
      return;
    }

    let cancelled = false;
    const syncCurrentRoom = async (showSyncing = false) => {
      if (cancelled) {
        return;
      }
      await syncDiscussionMessages(readingBookId, showSyncing);
    };

    void syncCurrentRoom(true);
    if (currentView !== 'reading-room') {
      return () => {
        cancelled = true;
      };
    }

    const intervalId = window.setInterval(() => {
      void syncCurrentRoom();
    }, DISCUSSION_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [authUser, currentView, readingBookId, syncDiscussionMessages]);

  useEffect(() => {
    if (!authUser) {
      return;
    }
    const token = getStoredAccessToken();
    if (!token) {
      return;
    }

    let cancelled = false;
    setVocabularyError('');
    listVocabularyEntries(token)
      .then((entries) => {
        if (!cancelled) {
          setVocabularyEntries(entries.map(mapVocabularyEntry));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setVocabularyError(error instanceof Error ? error.message : 'Failed to load vocabulary');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authUser]);

  useEffect(() => {
    if (!authUser) {
      return;
    }
    const token = getStoredAccessToken();
    if (!token) {
      return;
    }

    let cancelled = false;
    setBookError('');
    listBooks(token)
      .then((uploadedBooks) => {
        if (cancelled) {
          return;
        }
        const mappedBooks = uploadedBooks.map(mapBook);
        setBooks([...mappedBooks, ...BOOKS]);
      })
      .catch((error) => {
        if (!cancelled) {
          setBookError(error instanceof Error ? error.message : 'Failed to load uploaded books');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authUser]);

  const handlePostDiscussionMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    const token = getStoredAccessToken();
    if (!token) {
      throw new Error('Please sign in before joining the discussion');
    }
    setDiscussionError('');
    try {
      const savedMessage = await createDiscussionMessage(readingBookId, token, trimmed);
      const mappedMessage = mapDiscussionMessage(savedMessage);
      setDiscussionMessagesByBook((prev) => {
        return {
          ...prev,
          [readingBookId]: mergeDiscussionMessages(readingBookId, [
            ...(prev[readingBookId] ?? []),
            mappedMessage,
          ]),
        };
      });
      setLastDiscussionSyncAt(new Date(savedMessage.createdAt));
      void syncDiscussionMessages(readingBookId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save discussion message';
      setDiscussionError(message);
      throw error;
    }
  };

  const handleAddVocabularyEntry = async (word: string, context: string) => {
    const trimmedWord = word.trim().replace(/\s+/g, ' ');
    if (!trimmedWord) {
      return;
    }
    const token = getStoredAccessToken();
    if (!token) {
      throw new Error('Please sign in before adding vocabulary');
    }
    setVocabularyError('');
    try {
      const savedEntry = await createVocabularyEntry(readingBookId, token, {
        word: trimmedWord,
        context: context.trim(),
      });
      const mappedEntry = mapVocabularyEntry(savedEntry);
      setVocabularyEntries((prev) => [mappedEntry, ...prev]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save vocabulary';
      setVocabularyError(message);
      throw error;
    }
  };

  const handleUploadBook = async (payload: { title: string; author: string; file: File }) => {
    const token = getStoredAccessToken();
    if (!token) {
      throw new Error('Please sign in before uploading books');
    }
    setBookError('');
    try {
      const uploadedBook = mapBook(await uploadBookPdf(token, payload));
      setBooks((prev) => [uploadedBook, ...prev.filter((book) => book.id !== uploadedBook.id)]);
      setReadingBookId(uploadedBook.id);
      return uploadedBook;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload book';
      setBookError(message);
      throw error;
    }
  };

  const readingBook = books.find((b) => b.id === readingBookId) ?? books[0] ?? BOOKS[0];
  const discussionMessages = discussionMessagesByBook[readingBook.id] ?? getInitialDiscussionMessages(readingBook.id);

  if (authInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary text-on-primary font-serif">
        Restoring session...
      </div>
    );
  }

  if (currentView === 'login') {
    return (
      <LoginView
        onAuthenticate={handleAuthenticate}
        onWechatAuthSuccess={handleWechatAuthSuccess}
        errorMessage={authError}
        loading={isAuthenticating}
      />
    );
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
            icon={<BookMarked size={20} />}
            label="Vocabulary"
            active={currentView === 'vocabulary'}
            onClick={() => handleNavigate('vocabulary')}
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
          <button
            type="button"
            onClick={handleLogout}
            className="w-full border border-surface-container-highest text-on-surface py-2.5 px-4 rounded-lg font-serif text-sm hover:bg-surface-container-low transition-colors"
          >
            Log Out
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
            <button
              type="button"
              onClick={handleLogout}
              className="hidden sm:inline-flex items-center rounded-full border border-surface-container px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
            >
              Log out
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
                  primaryBook={getContinueReadingBook(books)}
                  books={books}
                  onStartReading={startReading}
                  onBrowseLibrary={() => handleNavigate('library')}
                />
              )}
              {currentView === 'library' && (
                <LibraryView
                  books={books}
                  onStartReading={startReading}
                  discussionMessages={discussionMessages}
                  onPostDiscussionMessage={handlePostDiscussionMessage}
                  discussionError={discussionError}
                  onUploadBook={handleUploadBook}
                  bookError={bookError}
                />
              )}
              {currentView === 'profile' && (
                <ProfileView
                  authUser={authUser}
                  onStartReading={startReading}
                  onViewLibrary={() => handleNavigate('library')}
                  onLogout={handleLogout}
                />
              )}
              {currentView === 'reading-room' && (
                <ReadingRoomView
                  book={readingBook}
                  currentUser={authUser}
                  discussionMessages={discussionMessages}
                  onPostDiscussionMessage={handlePostDiscussionMessage}
                  onSyncDiscussionMessages={() => syncDiscussionMessages(readingBook.id, true)}
                  discussionError={discussionError}
                  isDiscussionSyncing={isDiscussionSyncing}
                  lastDiscussionSyncAt={lastDiscussionSyncAt}
                  onAddVocabularyEntry={handleAddVocabularyEntry}
                  vocabularyError={vocabularyError}
                />
              )}
              {currentView === 'vocabulary' && (
                <VocabularyView
                  entries={vocabularyEntries}
                  books={books}
                  onStartReading={startReading}
                  errorMessage={vocabularyError}
                />
              )}
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
        <MobileNavItem icon={<BookMarked size={24} />} label="Words" active={currentView === 'vocabulary'} onClick={() => handleNavigate('vocabulary')} />
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

function LibrarySection({
  title,
  color,
  books,
  onSelectBook,
  onAddBook,
}: {
  title: string;
  color: string;
  books: Book[];
  onSelectBook: (bookId: string) => void;
  onAddBook: () => void;
}) {
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
        <button
          type="button"
          onClick={onAddBook}
          className="shrink-0 w-40 aspect-[2/3] border-2 border-dashed border-surface-container rounded-lg flex flex-col items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer group"
        >
           <Plus size={24} className="group-hover:scale-110 transition-transform" />
           <span className="text-[10px] font-bold uppercase tracking-widest mt-2">Add New</span>
        </button>
      </div>
    </div>
  );
}

// --- Views Implementation ---

function LoginView({
  onAuthenticate,
  onWechatAuthSuccess,
  errorMessage,
  loading,
}: {
  onAuthenticate: (payload: AuthAction) => Promise<RegisterResponse | void>;
  onWechatAuthSuccess: (response: AuthResponse) => void;
  errorMessage: string;
  loading: boolean;
}) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');
  const [verificationHint, setVerificationHint] = useState('');
  const [localError, setLocalError] = useState('');
  const [wechatDialogOpen, setWechatDialogOpen] = useState(false);
  const [wechatSessionId, setWechatSessionId] = useState('');
  const [wechatQrUrl, setWechatQrUrl] = useState('');
  const [wechatStatusText, setWechatStatusText] = useState('');
  const [wechatBusy, setWechatBusy] = useState(false);
  const [wechatError, setWechatError] = useState('');
  const needsVerification = mode === 'register' && pendingVerificationEmail.length > 0;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError('');

    if (needsVerification) {
      if (!/^\d{6}$/.test(verificationCode.trim())) {
        setLocalError('Verification code must be 6 digits.');
        return;
      }
      await onAuthenticate({
        action: 'verifyEmail',
        email: pendingVerificationEmail,
        verificationCode: verificationCode.trim(),
      });
      return;
    }

    if (mode === 'register') {
      if (displayName.trim().length < 2) {
        setLocalError('Display name must be at least 2 characters.');
        return;
      }
      if (password.length < 8) {
        setLocalError('Password must be at least 8 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match.');
        return;
      }
      const result = await onAuthenticate({
        action: 'register',
        email,
        password,
        displayName,
      });
      if (result) {
        setPendingVerificationEmail(result.email);
        setVerificationHint(result.message);
        setVerificationCode('');
      }
      return;
    }

    await onAuthenticate({
      action: 'login',
      email,
      password,
    });
  };

  const handleResendVerification = async () => {
    setLocalError('');
    const result = await onAuthenticate({
      action: 'resendVerification',
      email: pendingVerificationEmail,
    });
    if (result) {
      setVerificationHint(result.message);
    }
  };

  const handleOpenWechatDialog = async () => {
    setWechatBusy(true);
    setWechatError('');
    try {
      const response = await startWechatQrLogin();
      setWechatSessionId(response.sessionId);
      setWechatQrUrl(response.qrCodeUrl);
      setWechatStatusText('Waiting for scan...');
      setWechatDialogOpen(true);
    } catch (error) {
      setWechatError(error instanceof Error ? error.message : 'Failed to start WeChat QR login');
    } finally {
      setWechatBusy(false);
    }
  };

  const handleMockWechatConfirm = async () => {
    if (!wechatSessionId) {
      return;
    }
    setWechatBusy(true);
    setWechatError('');
    try {
      const result = await mockConfirmWechatQr({
        sessionId: wechatSessionId,
        wechatOpenId: `wx_${Date.now()}`,
        displayName: 'WeChat Reader',
      });
      if (result.status === 'CONFIRMED' && result.auth) {
        onWechatAuthSuccess(result.auth);
        setWechatDialogOpen(false);
      }
    } catch (error) {
      setWechatError(error instanceof Error ? error.message : 'Failed to confirm WeChat scan');
    } finally {
      setWechatBusy(false);
    }
  };

  useEffect(() => {
    if (!wechatDialogOpen || !wechatSessionId) {
      return;
    }
    const timer = setInterval(async () => {
      try {
        const status = await getWechatQrStatus(wechatSessionId);
        if (status.status === 'CONFIRMED' && status.auth) {
          onWechatAuthSuccess(status.auth);
          setWechatDialogOpen(false);
          return;
        }
        if (status.status === 'EXPIRED') {
          setWechatStatusText('QR code expired. Please refresh.');
          return;
        }
        setWechatStatusText('Waiting for scan...');
      } catch (error) {
        setWechatError(error instanceof Error ? error.message : 'Failed to poll QR status');
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [wechatDialogOpen, wechatSessionId, onWechatAuthSuccess]);

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
            <h1 className="text-4xl font-serif text-on-primary mb-2">
              {needsVerification ? 'Verify Your Email' : mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p className="text-on-surface-variant text-stone-300 italic">
              {needsVerification
                ? `Enter the 6-digit code sent to ${pendingVerificationEmail}.`
                : mode === 'login'
                ? 'Enter the quiet room of collective thought.'
                : 'Join the library and begin your first reading room.'}
            </p>
          </header>

          <form className="space-y-6" onSubmit={onSubmit}>
            {mode === 'register' && !needsVerification && (
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase font-bold tracking-widest text-stone-300 ml-1">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Reader"
                  autoComplete="name"
                  className="w-full bg-white/10 border-none rounded-lg px-4 py-3 text-on-primary placeholder:text-stone-500 focus:ring-2 focus:ring-secondary focus:bg-white/20 transition-all outline-none"
                />
              </div>
            )}
            <div className={`space-y-1.5 ${needsVerification ? 'opacity-70' : ''}`}>
              <label className="block text-[10px] uppercase font-bold tracking-widest text-stone-300 ml-1">Email Address</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="scholar@readtogether.com" 
                autoComplete="email"
                disabled={needsVerification}
                className="w-full bg-white/10 border-none rounded-lg px-4 py-3 text-on-primary placeholder:text-stone-500 focus:ring-2 focus:ring-secondary focus:bg-white/20 transition-all outline-none"
              />
            </div>
            {!needsVerification && (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center px-1">
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-stone-300">Password</label>
                  {mode === 'login' && (
                    <a href="#" className="text-[10px] uppercase font-bold tracking-widest text-secondary-container hover:text-white transition-colors">Forgot?</a>
                  )}
                </div>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="w-full bg-white/10 border-none rounded-lg px-4 py-3 text-on-primary placeholder:text-stone-500 focus:ring-2 focus:ring-secondary focus:bg-white/20 transition-all outline-none"
                />
              </div>
            )}
            {mode === 'register' && !needsVerification && (
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase font-bold tracking-widest text-stone-300 ml-1">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full bg-white/10 border-none rounded-lg px-4 py-3 text-on-primary placeholder:text-stone-500 focus:ring-2 focus:ring-secondary focus:bg-white/20 transition-all outline-none"
                />
              </div>
            )}
            {needsVerification && (
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase font-bold tracking-widest text-stone-300 ml-1">Verification Code</label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="w-full bg-white/10 border-none rounded-lg px-4 py-3 tracking-[0.35em] text-center text-on-primary placeholder:text-stone-500 focus:ring-2 focus:ring-secondary focus:bg-white/20 transition-all outline-none"
                />
                {verificationHint && (
                  <p className="text-[11px] text-stone-300">
                    {verificationHint}
                  </p>
                )}
              </div>
            )}
            {localError && (
              <p className="text-xs text-red-200 bg-red-900/30 border border-red-200/30 rounded-lg px-3 py-2">
                {localError}
              </p>
            )}
            {errorMessage && (
              <p className="text-xs text-red-200 bg-red-900/30 border border-red-200/30 rounded-lg px-3 py-2">
                {errorMessage}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-secondary text-on-primary font-semibold py-4 rounded-lg hover:bg-secondary/90 active:scale-[0.98] transition-all shadow-lg shadow-secondary/20 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading
                ? needsVerification
                  ? 'Verifying...'
                  : mode === 'login'
                  ? 'Signing In...'
                  : 'Creating Account...'
                : needsVerification
                  ? 'Verify Email'
                  : mode === 'login'
                  ? 'Sign In'
                  : 'Create Account'}
            </button>
            {needsVerification && (
              <button
                type="button"
                disabled={loading}
                onClick={handleResendVerification}
                className="w-full border border-white/30 text-white py-3 rounded-lg font-medium hover:bg-white/10 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                Resend Code
              </button>
            )}
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
            <button type="button" className="flex items-center justify-center gap-2 py-2.5 bg-white/5 border border-white/10 rounded-lg text-stone-300 hover:bg-white/10 transition-colors">
              <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuC1-u26NHxR7rsZ4lMlwHVhmV1vl_GjZ6fSRXuVRLTCz3ktyJ8xhUrjcZIIMPwGj1VhLMIY48FAgUphcirfcwb6z1Wa1Uq0mHeLyPDB30coCObGobylxf5nfdA0gcbwkZCyCn-zKLTYm7rMcxARSYaiI1vGELHp6ldLEW6RuswnlNI1U1W4WHc5-KyXj4ImtCv42V6RA_myD560MoGaJICOjTFDNN6NvVtHkCBOH3wLzodfAxDZdivBgClNVWP7djSzA3aRkdNi0g" alt="Google" className="w-4 h-4" />
              <span className="text-sm">Google</span>
            </button>
            <button
              type="button"
              disabled={wechatBusy}
              onClick={handleOpenWechatDialog}
              className="flex items-center justify-center gap-2 py-2.5 bg-white/5 border border-white/10 rounded-lg text-stone-300 hover:bg-white/10 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <UserIcon size={16} />
              <span className="text-sm">WeChat</span>
            </button>
          </div>
          {wechatError && (
            <p className="mt-4 text-xs text-red-200 bg-red-900/30 border border-red-200/30 rounded-lg px-3 py-2">
              {wechatError}
            </p>
          )}

          <footer className="mt-10 text-center">
            <p className="text-xs text-stone-400">
              {mode === 'login' ? 'New to the library?' : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setMode((prev) => (prev === 'login' ? 'register' : 'login'));
                  setLocalError('');
                  setPendingVerificationEmail('');
                  setVerificationHint('');
                  setVerificationCode('');
                }}
                className="text-secondary-container font-semibold hover:underline"
              >
                {mode === 'login' ? 'Create an account' : 'Sign in'}
              </button>
            </p>
          </footer>
        </motion.div>

        {wechatDialogOpen && (
          <div className="mt-6 bg-white/10 border border-white/20 rounded-xl p-6 text-center space-y-4">
            <h3 className="text-lg font-serif text-on-primary">WeChat QR Login</h3>
            {wechatQrUrl && (
              <img src={wechatQrUrl} alt="WeChat QR" className="w-52 h-52 mx-auto rounded-md bg-white p-2" />
            )}
            <p className="text-xs text-stone-300">{wechatStatusText}</p>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={wechatBusy}
                onClick={handleMockWechatConfirm}
                className="flex-1 bg-secondary text-on-primary py-2 rounded-lg text-sm font-semibold disabled:opacity-70"
              >
                Mock Confirm Scan
              </button>
              <button
                type="button"
                onClick={() => setWechatDialogOpen(false)}
                className="flex-1 border border-white/30 text-white py-2 rounded-lg text-sm"
              >
                Close
              </button>
            </div>
          </div>
        )}

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
  books,
  onStartReading,
  onBrowseLibrary,
}: {
  primaryBook: Book;
  books: Book[];
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
          {books.filter(b => !b.progress).slice(0, 8).map(book => (
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

function LibraryView({
  books,
  onStartReading,
  discussionMessages,
  onPostDiscussionMessage,
  discussionError,
  onUploadBook,
  bookError,
}: {
  books: Book[];
  onStartReading: (bookId?: string) => void;
  discussionMessages: Message[];
  onPostDiscussionMessage: (text: string) => Promise<void>;
  discussionError: string;
  onUploadBook: (payload: { title: string; author: string; file: File }) => Promise<Book>;
  bookError: string;
}) {
  const [messageInput, setMessageInput] = useState('');
  const [isPostingMessage, setIsPostingMessage] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadAuthor, setUploadAuthor] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const forumPreviewMessages = discussionMessages.filter((msg) => !msg.isSystem).slice(-3);
  const featuredBook = books[0] ?? BOOKS[0];
  const classicsBooks = books.filter(b => b.category === 'Classics' || (!b.category && !b.contentText)).slice(0, 4);
  const modernBooks = books.filter(b => b.category === 'Modern Philosophy').concat(books.slice(4, 5));
  const uploadedBooks = books.filter(b => b.category === 'Uploaded Books');

  const handleSendMessage = async () => {
    const trimmed = messageInput.trim();
    if (!trimmed) {
      return;
    }
    setIsPostingMessage(true);
    try {
      await onPostDiscussionMessage(trimmed);
      setMessageInput('');
    } finally {
      setIsPostingMessage(false);
    }
  };

  const handleMessageKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void handleSendMessage();
    }
  };

  const handleUploadSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUploadError('');
    if (!uploadTitle.trim()) {
      setUploadError('Please enter a book title');
      return;
    }
    if (!uploadFile) {
      setUploadError('Please choose a PDF file');
      return;
    }
    setIsUploading(true);
    try {
      const uploadedBook = await onUploadBook({
        title: uploadTitle,
        author: uploadAuthor,
        file: uploadFile,
      });
      setUploadTitle('');
      setUploadAuthor('');
      setUploadFile(null);
      setUploadOpen(false);
      onStartReading(uploadedBook.id);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to upload book');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-12">
      <header className="flex flex-col md:flex-row gap-8 items-center border-b border-surface-container pb-12">
        <div className="w-full md:w-1/3 flex-shrink-0">
          <motion.div whileHover={{ scale: 1.02 }} className="relative group profile-shadow">
             <div className="absolute -inset-2 bg-gradient-to-tr from-secondary-container to-tertiary-fixed-dim opacity-20 blur-2xl group-hover:opacity-40 transition-opacity"></div>
             <img src={featuredBook.cover} alt="Cover" className="relative w-full aspect-[2/3] object-cover rounded-xl shadow-2xl" />
          </motion.div>
        </div>
        <div className="w-full md:w-2/3 space-y-6">
          <div className="flex items-center gap-3">
             <span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase">Modern Classic</span>
             <span className="text-on-surface-variant text-sm flex items-center gap-1">★ 4.8 (2.4k reviews)</span>
          </div>
          <h1 className="text-6xl font-serif text-primary">{featuredBook.title}</h1>
          <p className="text-2xl font-serif text-on-primary-container italic">{featuredBook.author}</p>
          <p className="text-lg text-on-surface-variant leading-relaxed max-w-2xl">{featuredBook.description}</p>
          <div className="flex flex-wrap gap-4 pt-4">
            <button
              type="button"
              onClick={() => onStartReading(featuredBook.id)}
              className="bg-secondary text-on-primary px-8 py-4 rounded-xl flex items-center gap-3 font-serif text-lg hover:shadow-xl transition-all active:scale-95 shadow-lg shadow-secondary/20"
            >
              <Users size={20} /> Read Together
            </button>
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="border-2 border-primary text-primary px-8 py-4 rounded-xl font-serif text-lg hover:bg-surface-container-low transition-all"
            >
              Upload PDF
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
                {forumPreviewMessages.map(msg => (
                  <div key={msg.id} className="flex gap-3">
                     <img src={msg.authorAvatar} className="w-8 h-8 rounded-full object-cover shrink-0" alt="avatar" />
                     <div className="space-y-1">
                        <p className="text-xs font-bold">{msg.authorName}</p>
                        <p className="text-xs text-on-surface-variant line-clamp-2">{msg.text}</p>
                     </div>
                  </div>
                ))}
              </div>
              {discussionError && (
                <p className="mt-4 text-xs text-tertiary-container bg-tertiary-fixed-dim/20 border border-tertiary-fixed-dim/40 rounded-lg px-3 py-2">
                  {discussionError}
                </p>
              )}
             <div className="mt-6 flex gap-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleMessageKeyDown}
                  placeholder="Share a thought..."
                  className="flex-1 bg-surface-container-low border-none rounded-lg text-xs py-2 px-3 focus:ring-1 focus:ring-secondary"
                />
                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || isPostingMessage}
                  className="text-secondary disabled:text-on-surface-variant/40 disabled:cursor-not-allowed"
                  aria-label="Post to live forum"
                >
                  <Send size={16} />
                </button>
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
              {uploadedBooks.length > 0 && (
                <LibrarySection title={`UPLOADED BOOKS (${uploadedBooks.length})`} color="bg-primary" books={uploadedBooks} onSelectBook={(id) => onStartReading(id)} onAddBook={() => setUploadOpen(true)} />
              )}
              <LibrarySection title="CLASSICS (12)" color="bg-tertiary-fixed-dim" books={classicsBooks} onSelectBook={(id) => onStartReading(id)} onAddBook={() => setUploadOpen(true)} />
              <LibrarySection title="MODERN PHILOSOPHY (8)" color="bg-secondary-container" books={modernBooks} onSelectBook={(id) => onStartReading(id)} onAddBook={() => setUploadOpen(true)} />
           </div>
        </div>
      </section>
      <AnimatePresence>
        {uploadOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-primary/30 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.form
              onSubmit={handleUploadSubmit}
              className="w-full max-w-lg rounded-2xl border border-surface-container bg-white p-6 shadow-2xl"
              initial={{ scale: 0.98, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.98, y: 12 }}
            >
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">New Book</p>
                  <h3 className="mt-2 text-3xl font-serif text-primary">Upload PDF</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setUploadOpen(false)}
                  className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container"
                  aria-label="Close upload dialog"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-on-surface-variant">Title</span>
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={(event) => setUploadTitle(event.target.value)}
                    className="w-full rounded-lg border border-surface-container bg-surface-container-low px-4 py-3 text-sm focus:border-secondary focus:ring-secondary"
                    placeholder="Book title"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-on-surface-variant">Author</span>
                  <input
                    type="text"
                    value={uploadAuthor}
                    onChange={(event) => setUploadAuthor(event.target.value)}
                    className="w-full rounded-lg border border-surface-container bg-surface-container-low px-4 py-3 text-sm focus:border-secondary focus:ring-secondary"
                    placeholder="Optional"
                  />
                </label>
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-surface-container p-8 text-center hover:bg-surface-container-low">
                  <FileText size={32} className="mb-3 text-secondary" />
                  <span className="text-sm font-semibold text-primary">{uploadFile ? uploadFile.name : 'Choose a PDF file'}</span>
                  <span className="mt-1 text-xs text-on-surface-variant">The backend parses the PDF text into the book table.</span>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
              {(uploadError || bookError) && (
                <p className="mt-4 rounded-lg border border-tertiary-fixed-dim/40 bg-tertiary-fixed-dim/20 px-3 py-2 text-xs text-tertiary-container">
                  {uploadError || bookError}
                </p>
              )}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setUploadOpen(false)}
                  className="rounded-lg border border-surface-container-highest px-4 py-2 text-sm font-semibold text-on-surface-variant hover:text-on-surface"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="inline-flex items-center gap-2 rounded-lg bg-secondary px-5 py-2 text-sm font-semibold text-on-secondary shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Upload size={16} />
                  {isUploading ? 'Uploading...' : 'Upload Book'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ReadingRoomView({
  book,
  currentUser,
  discussionMessages,
  onPostDiscussionMessage,
  onSyncDiscussionMessages,
  discussionError,
  isDiscussionSyncing,
  lastDiscussionSyncAt,
  onAddVocabularyEntry,
  vocabularyError,
}: {
  book: Book;
  currentUser: AuthUser | null;
  discussionMessages: Message[];
  onPostDiscussionMessage: (text: string) => Promise<void>;
  onSyncDiscussionMessages: () => Promise<void>;
  discussionError: string;
  isDiscussionSyncing: boolean;
  lastDiscussionSyncAt: Date | null;
  onAddVocabularyEntry: (word: string, context: string) => Promise<void>;
  vocabularyError: string;
}) {
  const [message, setMessage] = useState('');
  const [messageError, setMessageError] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isPostingMessage, setIsPostingMessage] = useState(false);
  const [selectedVocabulary, setSelectedVocabulary] = useState<{ word: string; context: string } | null>(null);
  const [isSavingVocabulary, setIsSavingVocabulary] = useState(false);
  const discussionEndRef = useRef<HTMLDivElement | null>(null);
  const readingRoomRef = useRef<HTMLDivElement | null>(null);
  const readingArticleRef = useRef<HTMLElement | null>(null);
  const progressPct = Math.min(100, Math.max(0, book.progress ?? 0));
  const highlight = ANNOTATIONS.find((a) => a.bookId === book.id) ?? ANNOTATIONS[0];
  const parsedReadingBlocks = parseUploadedReadingText(book.contentText);
  const estMinsRemaining =
    book.totalPages != null && book.readPages != null
      ? Math.max(1, Math.round(((book.totalPages - book.readPages) / Math.max(book.totalPages, 1)) * 60))
      : 12;
  const discussionStatusLabel = isDiscussionSyncing
    ? 'Syncing'
    : lastDiscussionSyncAt
      ? `Updated ${formatMessageTimestamp(lastDiscussionSyncAt)}`
      : 'Connecting';
  const activeReaders = discussionMessages.filter((msg) => !msg.isSystem).length;
  const canSendMessage = message.trim().length > 0 && message.length <= MAX_DISCUSSION_MESSAGE_LENGTH && !isPostingMessage;

  const handleSendMessage = async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }
    if (trimmed.length > MAX_DISCUSSION_MESSAGE_LENGTH) {
      setMessageError(`Message must be ${MAX_DISCUSSION_MESSAGE_LENGTH} characters or fewer`);
      return;
    }
    setMessageError('');
    setIsPostingMessage(true);
    try {
      await onPostDiscussionMessage(trimmed);
      setMessage('');
      setIsChatOpen(false);
    } finally {
      setIsPostingMessage(false);
    }
  };

  const handleMessageKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSendMessage();
    }
  };

  const handleMessageChange = (value: string) => {
    setMessage(value);
    if (messageError && value.trim().length <= MAX_DISCUSSION_MESSAGE_LENGTH) {
      setMessageError('');
    }
  };

  useEffect(() => {
    discussionEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [discussionMessages.length]);

  const handleTextSelection = () => {
    const selection = window.getSelection();
    const article = readingArticleRef.current;
    if (!selection || selection.isCollapsed || !article || !selection.anchorNode || !article.contains(selection.anchorNode)) {
      return;
    }
    const word = selection
      .toString()
      .replace(/\s+/g, ' ')
      .replace(/^[\s"“”'.,;:!?()]+|[\s"“”'.,;:!?()]+$/g, '')
      .trim();
    if (!word || word.length > 80) {
      setSelectedVocabulary(null);
      return;
    }
    const contextNode = selection.anchorNode.parentElement?.closest('p, blockquote');
    const context = contextNode?.textContent?.replace(/\s+/g, ' ').trim() || word;
    setSelectedVocabulary({ word, context });
  };

  const handleSaveVocabulary = async () => {
    if (!selectedVocabulary) {
      return;
    }
    setIsSavingVocabulary(true);
    try {
      await onAddVocabularyEntry(selectedVocabulary.word, selectedVocabulary.context);
      setSelectedVocabulary(null);
      window.getSelection()?.removeAllRanges();
    } finally {
      setIsSavingVocabulary(false);
    }
  };

  const renderDiscussionMessages = () => (
    <>
      {discussionMessages.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-surface-container-highest bg-white/50 p-6 text-center">
          <MessageSquare size={24} className="mb-3 text-secondary" />
          <p className="text-sm font-semibold text-primary">No messages yet</p>
          <p className="mt-1 text-xs leading-5 text-on-surface-variant">Start the room discussion with the first thought.</p>
        </div>
      ) : (
        discussionMessages.map(msg => {
          const isOwnMessage = Boolean(
            currentUser && !msg.isSystem && (
              msg.authorEmail === currentUser.email ||
              (!msg.authorEmail && msg.authorName === currentUser.displayName)
            )
          );
          return (
            <div
              key={msg.id}
              className={`flex flex-col gap-2 ${msg.isSystem ? 'items-center py-2' : isOwnMessage ? 'items-end' : 'items-start'}`}
            >
              {!msg.isSystem ? (
                <>
                  <div className={`flex items-center gap-2 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
                    <img src={msg.authorAvatar} alt="avatar" className="w-6 h-6 rounded-full object-cover" />
                    <span className="text-xs font-bold text-primary">{isOwnMessage ? 'You' : msg.authorName}</span>
                    <span className="text-[10px] text-on-surface-variant/60">{msg.timestamp}</span>
                  </div>
                  <div className={`max-w-[88%] whitespace-pre-wrap p-3 text-sm leading-relaxed shadow-sm ${
                    isOwnMessage
                      ? 'rounded-2xl rounded-tr-sm bg-secondary text-on-secondary'
                      : 'rounded-2xl rounded-tl-sm border border-surface-container bg-white text-on-surface'
                  }`}>
                    {msg.text}
                  </div>
                </>
              ) : (
                <span className="text-[10px] font-bold uppercase tracking-widest bg-tertiary-fixed-dim/30 text-tertiary-container px-3 py-1 rounded-full">
                  {msg.text}
                </span>
              )}
            </div>
          );
        })
      )}
      <div ref={discussionEndRef} />
    </>
  );

  const renderDiscussionComposer = () => (
    <>
      {(discussionError || messageError) && (
        <p className="mb-3 text-xs text-tertiary-container bg-tertiary-fixed-dim/20 border border-tertiary-fixed-dim/40 rounded-lg px-3 py-2">
          {messageError || discussionError}
        </p>
      )}
      <div className="relative">
        <textarea
          value={message}
          onChange={(e) => handleMessageChange(e.target.value)}
          onKeyDown={handleMessageKeyDown}
          placeholder="Share a thought..."
          disabled={isPostingMessage}
          maxLength={MAX_DISCUSSION_MESSAGE_LENGTH}
          rows={3}
          className="max-h-32 min-h-20 w-full resize-none rounded-xl border-none bg-white py-3 pl-4 pr-12 text-sm shadow-sm focus:ring-1 focus:ring-secondary disabled:cursor-not-allowed disabled:opacity-70"
        />
        <button
          type="button"
          onClick={handleSendMessage}
          disabled={!canSendMessage}
          className="absolute right-2 top-2 p-1.5 text-secondary hover:bg-secondary-container rounded-lg transition-colors disabled:text-on-surface-variant/40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
          aria-label="Send message"
        >
          <Send size={18} />
        </button>
        <span className="absolute bottom-2 right-3 text-[10px] text-on-surface-variant/50">
          {message.length}/{MAX_DISCUSSION_MESSAGE_LENGTH}
        </span>
      </div>
      <p className="mt-2 text-[10px] text-on-surface-variant/70">Press Enter to send, Shift+Enter for a new line.</p>
    </>
  );

  return (
    <div ref={readingRoomRef} className="relative flex h-[calc(100vh-64px)] overflow-hidden font-sans">
      {/* Discussion Sidebar - Hidden on mobile, shown on md+ */}
      <aside className="hidden lg:flex flex-col w-80 bg-surface-container-low border-r border-surface-container shrink-0">
        <div className="p-6 border-b border-surface-container bg-surface-container/50">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-serif">Live Discussion</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void onSyncDiscussionMessages()}
                disabled={isDiscussionSyncing}
                className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Refresh discussion"
                title="Refresh discussion"
              >
                <RefreshCw size={14} className={isDiscussionSyncing ? 'animate-spin' : ''} />
              </button>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-secondary-container text-on-secondary-container">
                <span className={`mr-1.5 h-1.5 w-1.5 rounded-full bg-secondary ${isDiscussionSyncing ? 'animate-ping' : 'animate-pulse'}`} />
                Live
              </span>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-on-surface-variant">
            <p className="line-clamp-2 font-medium">{book.title}</p>
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
              {discussionStatusLabel}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white/70 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Messages</p>
              <p className="font-serif text-lg text-primary">{discussionMessages.length}</p>
            </div>
            <div className="rounded-lg bg-white/70 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Readers</p>
              <p className="font-serif text-lg text-primary">{Math.max(1, activeReaders)}</p>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6 hide-scrollbar">
          {renderDiscussionMessages()}
        </div>

        <div className="p-6 bg-surface-container-low border-t border-surface-container">
          {renderDiscussionComposer()}
        </div>
      </aside>

      <button
        type="button"
        onClick={() => setIsChatOpen(true)}
        className="absolute right-4 top-4 z-30 inline-flex items-center gap-2 rounded-full border border-surface-container bg-white/90 px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary shadow-lg backdrop-blur-md lg:hidden"
      >
        <MessageSquare size={15} />
        Chat
        <span className="rounded-full bg-secondary-container px-2 py-0.5 text-[10px] text-on-secondary-container">
          {discussionMessages.length}
        </span>
      </button>

      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            className="absolute inset-0 z-40 bg-primary/25 backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.aside
              className="ml-auto flex h-full w-full max-w-sm flex-col border-l border-surface-container bg-surface-container-low shadow-2xl"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            >
              <div className="border-b border-surface-container bg-surface-container/70 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-serif text-primary">Live Discussion</h3>
                    <p className="mt-1 text-xs text-on-surface-variant">{discussionStatusLabel}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void onSyncDiscussionMessages()}
                      disabled={isDiscussionSyncing}
                      className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Refresh discussion"
                    >
                      <RefreshCw size={16} className={isDiscussionSyncing ? 'animate-spin' : ''} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsChatOpen(false)}
                      className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
                      aria-label="Close discussion"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-white/70 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Messages</p>
                    <p className="font-serif text-lg text-primary">{discussionMessages.length}</p>
                  </div>
                  <div className="rounded-lg bg-white/70 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Readers</p>
                    <p className="font-serif text-lg text-primary">{Math.max(1, activeReaders)}</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-6 hide-scrollbar">
                {renderDiscussionMessages()}
              </div>

              <div className="border-t border-surface-container bg-surface-container-low p-5">
                {renderDiscussionComposer()}
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

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

            {selectedVocabulary && (
              <div className="sticky top-4 z-20 flex flex-col gap-3 rounded-lg border border-secondary-container bg-surface/95 p-4 shadow-xl backdrop-blur-md md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Selected Word</p>
                  <p className="truncate text-lg font-serif text-primary">{selectedVocabulary.word}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveVocabulary}
                    disabled={isSavingVocabulary}
                    className="rounded-lg bg-secondary px-4 py-2 text-xs font-bold uppercase tracking-widest text-on-secondary transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Add to Vocabulary
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedVocabulary(null)}
                    className="rounded-lg border border-surface-container-highest px-3 py-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
            {vocabularyError && (
              <p className="rounded-lg border border-tertiary-fixed-dim/40 bg-tertiary-fixed-dim/20 px-3 py-2 text-xs text-tertiary-container">
                {vocabularyError}
              </p>
            )}

            <article
              ref={readingArticleRef}
              onMouseUp={handleTextSelection}
              onTouchEnd={handleTextSelection}
              className="text-xl md:text-2xl font-serif text-on-surface leading-[1.8] space-y-10"
            >
              {parsedReadingBlocks.length > 0 ? (
                parsedReadingBlocks.map((block, index) => (
                  block.type === 'heading' ? (
                    <h2
                      key={`${book.id}-heading-${index}`}
                      className="pt-8 text-center text-sm font-sans font-bold uppercase tracking-[0.24em] text-primary"
                    >
                      {block.text}
                    </h2>
                  ) : (
                    <p key={`${book.id}-paragraph-${index}`}>{block.text}</p>
                  )
                ))
              ) : (
                <>
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
                </>
              )}
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

      <DraggableVoicePanel dragConstraintsRef={readingRoomRef} book={book} currentUser={currentUser} />
    </div>
  );
}

function VocabularyView({
  entries,
  books,
  onStartReading,
  errorMessage,
}: {
  entries: VocabularyEntry[];
  books: Book[];
  onStartReading: (bookId?: string) => void;
  errorMessage: string;
}) {
  const bookById = new Map(books.map((book) => [book.id, book]));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 p-8 pb-24">
      <header className="flex flex-col gap-4 border-b border-surface-container pb-8 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">Reading Rooms</p>
          <h2 className="text-5xl font-serif text-primary">Vocabulary</h2>
        </div>
        <div className="rounded-lg border border-surface-container-highest bg-surface-container-low px-5 py-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Saved</p>
          <p className="text-2xl font-serif text-primary">{entries.length}</p>
        </div>
      </header>

      {errorMessage && (
        <p className="rounded-lg border border-tertiary-fixed-dim/40 bg-tertiary-fixed-dim/20 px-3 py-2 text-sm text-tertiary-container">
          {errorMessage}
        </p>
      )}

      {entries.length === 0 ? (
        <section className="flex min-h-80 flex-col items-center justify-center gap-5 rounded-lg border border-dashed border-surface-container-highest bg-surface-container-low p-10 text-center">
          <BookMarked size={36} className="text-secondary" />
          <div className="space-y-2">
            <h3 className="text-2xl font-serif text-primary">No saved words yet</h3>
          </div>
          <button
            type="button"
            onClick={() => onStartReading()}
            className="rounded-lg bg-secondary px-5 py-3 text-sm font-semibold text-on-secondary hover:opacity-90"
          >
            Open Reading Room
          </button>
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {entries.map((entry) => {
            const book = bookById.get(entry.bookId);
            return (
              <article
                key={entry.id}
                className="rounded-lg border border-surface-container bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <h3 className="truncate text-3xl font-serif text-primary">{entry.word}</h3>
                    <p className="text-xs font-semibold text-secondary">{book?.title ?? `Book ${entry.bookId}`}</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {entry.context && (
                  <blockquote className="mt-5 border-l-4 border-secondary-container bg-surface-container-low px-4 py-3 text-sm leading-6 text-on-surface-variant">
                    {entry.context}
                  </blockquote>
                )}
                <button
                  type="button"
                  onClick={() => onStartReading(entry.bookId)}
                  className="mt-5 text-xs font-bold uppercase tracking-widest text-secondary hover:underline"
                >
                  Return to passage
                </button>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

function ProfileView({
  authUser,
  onStartReading,
  onViewLibrary,
  onLogout,
}: {
  authUser: AuthUser | null;
  onStartReading: (bookId?: string) => void;
  onViewLibrary: () => void;
  onLogout: () => void;
}) {
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
               <h2 className="text-5xl font-serif text-primary">{authUser?.displayName ?? CURRENT_USER.name}</h2>
               <p className="text-xl font-serif text-on-surface-variant italic">{authUser?.email ?? CURRENT_USER.bio}</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
               {CURRENT_USER.badges.map(badge => (
                 <span key={badge} className="bg-surface-container-highest text-on-surface-variant px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase">
                   {badge}
                 </span>
               ))}
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="px-4 py-2 rounded-lg border border-surface-container-highest text-sm font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors"
            >
              Log out
            </button>
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
                  <button
                    type="button"
                    onClick={onViewLibrary}
                    className="text-[10px] font-bold uppercase tracking-widest text-secondary hover:underline"
                  >
                    View All
                  </button>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {BOOKS.filter(b => b.progress).map(book => (
                    <button
                      key={book.id}
                      type="button"
                      onClick={() => onStartReading(book.id)}
                      className="text-left bg-white p-5 rounded-2xl border border-surface-container flex gap-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer w-full"
                    >
                       <img src={book.cover} alt="" className="w-24 h-36 rounded-lg object-cover shadow-sm shrink-0" />
                       <div className="flex flex-col justify-between py-1 flex-grow min-w-0">
                          <div className="space-y-1">
                             <h4 className="text-lg font-serif font-bold text-primary line-clamp-2">{book.title}</h4>
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
                    </button>
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
