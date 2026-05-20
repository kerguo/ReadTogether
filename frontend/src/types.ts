/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Book {
  id: string;
  title: string;
  author: string;
  cover: string;
  progress?: number;
  totalPages?: number;
  readPages?: number;
  category?: string;
  rating?: number;
  reviewsCount?: number;
  description?: string;
  contentText?: string;
  sourceFilename?: string;
  createdAt?: string;
}

export interface Annotation {
  id: string;
  bookId: string;
  authorName: string;
  authorAvatar: string;
  text: string;
  likes: number;
  replies: number;
  chapter: string;
  page: number;
}

export interface Message {
  id: string;
  authorEmail?: string;
  authorName: string;
  authorAvatar: string;
  text: string;
  timestamp: string;
  isSystem?: boolean;
}

export interface VocabularyEntry {
  id: string;
  bookId: string;
  word: string;
  context: string;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  bio: string;
  badges: string[];
  stats: {
    booksRead: number;
    hoursSpent: number;
    streakCount: number;
  };
}
