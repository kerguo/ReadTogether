/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Book, Annotation, Message, User } from './types';

export const BOOKS: Book[] = [
  {
    id: '1',
    title: 'To the Lighthouse',
    author: 'Virginia Woolf',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBRsLN2d6oWxssWgGgAgUcpctbl0o3ZOigJsk1KPRIM_8EIaN0-aKsFKbhroEhF971CUo8Hxk1f1efz_YGQYO-uT80gbVXwVD9p3kFPV4co8zAeT_GzR5pfOjr268Y76KJGWLQBIwM_LBFqaA9NxVBg8eALtVXb7YtvRcyLLpuRK_-C_qzDjaFRgzOqBbZVP7_CdX5H2IkeXmeCSVt1XTp43Toslop-7PJ24Ppnt8XEkqsx1blr9xViadd9iwCKtLiNevG2lxN90g',
    progress: 14,
    totalPages: 512,
    readPages: 72,
    category: 'Modern Classic',
    rating: 4.8,
    reviewsCount: 2400,
    description: 'A landmark of high modernism, this novel centers on the Ramsay family and their visits to the Isle of Skye. Woolf explores the passage of time, the nature of human relationships, and the shifting interiority of consciousness with unmatched lyrical precision.'
  },
  {
    id: '2',
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBk3viAhN2GbSXQffQFXsP9tw-rd_DjrpmML1q7Q0zBN0h2iMUrhPeo68hu885dIbkARlr0IZcILRlmlVKbu_920T0dXmir_AR7Upow7bcdwr6fQqh_6qVIMmsMtFFjprphfrWUh_1L0IsL3q_G0ykOkqVXJFmhLBbb2tva_bMPsT1M22IGN27ID2LyIbs8L5aQSnq0xnF0XjuIFTtrkz99Qi-5hJ8QkLGe1_4A9nk21S9oLzWvfEYzZ_Bot_LNJVROmNqvMkjqPw',
    category: 'Classics'
  },
  {
    id: '3',
    title: 'Meditations',
    author: 'Marcus Aurelius',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBHkfUVejZz9Snj7YdYlERjhQGhwgOQUT-Z0_QyK2c_TYywnPxaQM-J8klZNJkzTzrV8hTT4IxbcMwgUOIurDINzsVB_k5dJIVR-OtvPsGItpx2uR5QGnlY3SOekMuwgvhS2ph7Pe_zLGnF04UwrOXsQ5I7zcauU6-zsusbVGqyTYgkdDB0as03cDaniV3IF9PGmSNPWYFzrrGoMcl497SxFbifQQYUB201aYFiJ6RqzvH8zNcQZMu2vV97uVnjB-adnRWjDfpUSw',
    category: 'Modern Philosophy'
  },
  {
    id: '4',
    title: 'Crime & Punishment',
    author: 'Fyodor Dostoevsky',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAHVJExb1wNAE5Yme8kQs6IyFE4tzqS-9CHG2VQptAvabkPe_TDdA6IHPW8FJqTSmbysbhHv8QwYUGGWpZT8blz6ThzlPRBPB_RNY99a6IROcVir8XVEqat8YtzAib736Jx2sXr9YEFWchrv2lnxyle0Js68tczOe6dBy3hhTHY6XhB9kEIW03YBBPY0yVgmzLMCCS9HglzTxVRyz6FjYqHmkQrHDVX5-HVqlm35AtBcgIM8RkEEi1xX_amhMWOGKzyHXgWq1wdjA',
    category: 'Classics'
  },
  {
    id: '5',
    title: 'The Overstory',
    author: 'Richard Powers',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCvU7APidYRSzTFyUkplPO9e5sWaY5dqQyO8QmoB9BJSsKllsCPREWHkb2NhmvMc8PiQRVWEaSWNWYC7adWRxtKMz9qK_zrfWOvIigBnd6nfTMoIOtd7CqjpXBqBhXe6_QHhS_pnYErLiJFty2mVQW9vhY-_J5gsLG9HsZRxDRl8o7IkvVNHn4RnhQTS4kuz5u1r7F8WlKTeexcb4nc2gSG4mEhN9YZ3Gh0lXrJefZkUhbpKo0yIJR1tVdIvSnBydtDkJ7CefJkGQ',
    progress: 64,
    totalPages: 512,
    readPages: 327
  },
  {
    id: '6',
    title: 'Braiding Sweetgrass',
    author: 'Robin Wall Kimmerer',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDIcdGOjhB4DurIjeyRz6F4WSDutrYoFN3nKIJSjKkmFbczX0l-wB45fCwN0YhySkN42jOvHDIXQC-JCtYdYCwlPL_YCzlpsc4bzoKQi_dpTChlshv0o1gVvn_CjLYd0yDemcWoZ0OUt4opEeITRoLvQ5F9ohQw_d-V07r7VZDqXvMZfWfZIN-__9sSd8HhkBIrDMGjlUtwcSxVI8wJ4xCCBXXpKx6QauqWgddAk7XCe47xHlrDNUShROSUaAIfRtfBwuSc71xBEw',
    progress: 22,
    totalPages: 400,
    readPages: 88
  }
];

export const ANNOTATIONS: Annotation[] = [
  {
    id: 'a1',
    bookId: '1',
    authorName: 'Clara Miller',
    authorAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCTPTdcA90ZDOTfdBzGbpCWLA-m2boSXTy7O2luwhX6QxdWk1TOoDTkkFCsjxU_bzuHU_UgrIudP5HlT5NQmwFggwRnizLb3mfmNgRPorb2mx2Qrwf6q24I6qtLilCsFjuJSLMVjWdRWOAwYedk9d7RN1_m-TGF8agM-HKeMRDk9SEE2oDIT9jqNaL7EZR_T1mbYXQHOQ0uixkDXsqbTfZtZgpafW5W2LwGO6H_qqtxgDHNM_cnILYFaZdy6aMLbUxjjPgpZJSH-w',
    text: '"For it was not knowledge but unity that she desired, not inscriptions on tablets, nothing that could be written in any language known to men, but intimacy itself, which is knowledge."',
    likes: 842,
    replies: 12,
    chapter: 'Chapter 1',
    page: 24
  },
  {
    id: 'a2',
    bookId: '1',
    authorName: 'ReadTogether Popular Passages',
    authorAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBRsLN2d6oWxssWgGgAgUcpctbl0o3ZOigJsk1KPRIM_8EIaN0-aKsFKbhroEhF971CUo8Hxk1f1efz_YGQYO-uT80gbVXwVD9p3kFPV4co8zAeT_GzR5pfOjr268Y76KJGWLQBIwM_LBFqaA9NxVBg8eALtVXb7YtvRcyLLpuRK_-C_qzDjaFRgzOqBbZVP7_CdX5H2IkeXmeCSVt1XTp43Toslop-7PJ24Ppnt8XEkqsx1blr9xViadd9iwCKtLiNevG2lxN90g',
    text: '"So that was the story. Just as she had suspect, it was all a matter of focus, of looking a certain way."',
    likes: 512,
    replies: 8,
    chapter: 'Chapter 3',
    page: 156
  }
];

export const MESSAGES: Message[] = [
  {
    id: 'm1',
    authorName: 'Elena',
    authorAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAXImcnCrxB5bvDmmuoHUCZZG6XBMIp-b1EcxtQXskJwnzFHYafI41lYJyZJ4kqlGCXxzX-ZwNHhyF564GNCUKhHmuoNiJtsP6Pi1aGh_isrVZYv1ARAp7-q2S-_9s2Z3yZJukZfnSXsuk1aBLA-ur6CGCswfreI0eL00HuJXUDu1l2lSjNZ8iP1WfY98kvK2RB0bu-JD4Txkm02rsiy8MWsgcEHMFKC0E2N33sQTfEEcq_eioBCx9C6aZ47j0V3DRhz3-OVPN2lQ',
    text: "The tension between Mrs. Ramsay's optimism and Mr. Ramsay's stark realism is already so palpable.",
    timestamp: '12:42 PM'
  },
  {
    id: 'm2',
    authorName: 'Julian',
    authorAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBnyrJMRwTu1RwcaJZqdaevb8aeyRrP6DWEv_jKszkxX_odCutrayXUXb9KuXAzBAuF04-ECRIVP_XkTtsVpUXdpX4y2iEI37UqMyVLyrj9ODt0TJ5tU8pRkN0J6egLo5qPuAysHArjCsyNSyxTx0VgJ-RKjPofsfri1Ed058GUClzG7qdl7jSmzL5Bemg_tGjPF0Q3Tn-QegIyBKPnVjkGSJupaOKEJ0LcmOLqcRXD9OjUS3y6uQq9muTXQ3uEWqEPPK1MvH1t8Q',
    text: "James's reaction to his father seems so extreme, but Woolf captures that childhood intensity perfectly.",
    timestamp: '12:44 PM'
  },
  {
    id: 'sys1',
    authorName: 'System',
    authorAvatar: '',
    text: 'Marc joined the room',
    timestamp: '12:45 PM',
    isSystem: true
  },
  {
    id: 'm3',
    authorName: 'Sarah',
    authorAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB-WLNqgUZSBvbqWyuFkbdFoX2jJFk3ySU3xtmJa2I0WQ1uaa44jrbbguci99ifDvhajtTvC-6DiE9dPAMpctDp-F4Jx4btDF2WcROp8Z1auNZqtXHa2__WGrm5PqsmLOEbE7BepH6t_7bZ0DGB5uOOvgY4KW7SMyju-XYg25OVt9dLSRiVmeIla85ecFhjFG59OTzW26F4n_05dgGeO6dFFXRRUq6tGT43MOn-qAhF-lztD-TtbluE18292I62Tp4PTw_7C7WGjQ',
    text: 'Does anyone else find the list of sensory details (the lawnmower, the rooks cawing) incredibly grounding?',
    timestamp: '12:46 PM'
  }
];

export const CURRENT_USER: User = {
  id: 'u1',
  name: 'Julian Vance',
  bio: '"Seeking the quiet between the lines."',
  avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB9wrxGyeKfOS4NSm_dfwrGWT20VhIm5A_ekKrk6fwTcNlhkqCIeZVNyCrwpCzu5zbEY5SSFDY4YNIkpE7BXA7EIkKeW-8kbX9hLs2cRGCvDQPffPr0-P3MHB-fmG3Ohjk10emGdHeZgL6k62AU5k4ISXKYkPPSLGyvtnNc8paTXe6_SqjWfuC31ohbxW5jfDgQHR5Yh72Irqd0V67y49w6Jxe0PDTT2eVJ7hjUzgdjbKtzjOz17I2gO1FtQyuPlCp9DDPZd3cIww',
  badges: ['Deep Reader', 'Joycean Scholar', 'Archivist'],
  stats: {
    booksRead: 42,
    hoursSpent: 1248,
    streakCount: 14
  }
};
