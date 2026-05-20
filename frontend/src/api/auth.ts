const TOKEN_STORAGE_KEY = 'readtogether.accessToken';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || 'http://localhost:8080';

export interface AuthUser {
  id: number;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface AuthResponse {
  tokenType: string;
  accessToken: string;
  expiresIn: number;
  user: AuthUser;
}

export interface ApiError {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  details?: Record<string, string>;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  displayName: string;
  password: string;
}

export interface RegisterResponse {
  email: string;
  message: string;
}

export interface VerifyEmailPayload {
  email: string;
  verificationCode: string;
}

export interface WechatQrStartResponse {
  sessionId: string;
  qrCodeUrl: string;
  expiresInSeconds: number;
}

export interface WechatQrStatusResponse {
  status: 'PENDING' | 'CONFIRMED' | 'EXPIRED';
  auth: AuthResponse | null;
}

export interface DiscussionMessageResponse {
  id: number;
  bookId: string;
  authorEmail: string;
  authorName: string;
  authorAvatar: string;
  text: string;
  createdAt: string;
}

export interface VocabularyEntryResponse {
  id: number;
  bookId: string;
  userEmail: string;
  word: string;
  context: string;
  createdAt: string;
}

export interface BookResponse {
  id: string;
  title: string;
  author: string;
  category: string;
  coverUrl: string | null;
  description: string;
  contentText: string;
  totalPages: number;
  sourceFilename: string;
  createdAt: string;
}

export interface VoiceTokenResponse {
  serverUrl: string;
  token: string;
  roomName: string;
  participantName: string;
  participantId: string;
}

async function parseError(response: Response): Promise<string> {
  let message = `Request failed with status ${response.status}`;
  try {
    const error = (await response.json()) as ApiError;
    if (error?.message) {
      message = error.message;
    }
    if (error?.details && Object.keys(error.details).length > 0) {
      const detailText = Object.entries(error.details)
        .map(([field, detail]) => `${field}: ${detail}`)
        .join('; ');
      message = `${message} (${detailText})`;
    }
  } catch {
    // Keep fallback message when body is not JSON.
  }
  return message;
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as T;
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function register(payload: RegisterPayload): Promise<RegisterResponse> {
  return request<RegisterResponse>('/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function verifyEmail(payload: VerifyEmailPayload): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/verify-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function resendVerification(email: string): Promise<RegisterResponse> {
  return request<RegisterResponse>('/api/auth/resend-verification', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });
}

export async function startWechatQrLogin(): Promise<WechatQrStartResponse> {
  return request<WechatQrStartResponse>('/api/auth/wechat/qr/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function getWechatQrStatus(sessionId: string): Promise<WechatQrStatusResponse> {
  const encoded = encodeURIComponent(sessionId);
  return request<WechatQrStatusResponse>(`/api/auth/wechat/qr/status?sessionId=${encoded}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function mockConfirmWechatQr(payload: {
  sessionId: string;
  wechatOpenId: string;
  displayName: string;
}): Promise<WechatQrStatusResponse> {
  return request<WechatQrStatusResponse>('/api/auth/wechat/qr/mock-confirm', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function getCurrentUser(token: string): Promise<AuthUser> {
  return request<AuthUser>('/api/auth/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function listDiscussionMessages(
  bookId: string,
  token: string
): Promise<DiscussionMessageResponse[]> {
  return request<DiscussionMessageResponse[]>(
    `/api/books/${encodeURIComponent(bookId)}/discussion/messages`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
}

export async function createDiscussionMessage(
  bookId: string,
  token: string,
  text: string
): Promise<DiscussionMessageResponse> {
  return request<DiscussionMessageResponse>(
    `/api/books/${encodeURIComponent(bookId)}/discussion/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    }
  );
}

export async function listVocabularyEntries(token: string): Promise<VocabularyEntryResponse[]> {
  return request<VocabularyEntryResponse[]>('/api/vocabulary', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function listBookVocabularyEntries(
  bookId: string,
  token: string
): Promise<VocabularyEntryResponse[]> {
  return request<VocabularyEntryResponse[]>(
    `/api/books/${encodeURIComponent(bookId)}/vocabulary`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
}

export async function createVocabularyEntry(
  bookId: string,
  token: string,
  payload: { word: string; context: string }
): Promise<VocabularyEntryResponse> {
  return request<VocabularyEntryResponse>(
    `/api/books/${encodeURIComponent(bookId)}/vocabulary`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );
}

export async function listBooks(token: string): Promise<BookResponse[]> {
  return request<BookResponse[]>('/api/books', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function uploadBookPdf(
  token: string,
  payload: { title: string; author: string; file: File }
): Promise<BookResponse> {
  const formData = new FormData();
  formData.append('title', payload.title);
  formData.append('author', payload.author);
  formData.append('file', payload.file);

  return request<BookResponse>('/api/books', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
}

export async function createVoiceToken(bookId: string, token: string): Promise<VoiceTokenResponse> {
  return request<VoiceTokenResponse>(`/api/books/${encodeURIComponent(bookId)}/voice/token`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function saveAccessToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function getStoredAccessToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function clearAccessToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}
