/**
 * TEMPORARY reproduction harness (not part of the app).
 *
 * Renders the REAL src/components/ChatWindow.tsx inside a copy of the REAL app
 * shell (App.tsx messages tab: min-h-screen shell + sticky navbar + <main> +
 * h-[calc(100vh-8.5rem)] grid + fixed mobile bottom nav from Sidebar.tsx), with
 * fetch stubbed so a conversation can be opened and messages sent without a
 * backend.
 *
 * Used only to measure the composer geometry after each sent message.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import './src/index.css';
import { ChatWindow } from './src/components/ChatWindow';
import { LanguageProvider } from './src/i18n/LanguageContext';
import type { Conversation, Profile, User } from './src/types';

const now = new Date().toISOString();

const ME = {
  id: 'usr_me_01',
  email: 'me@example.com',
  role: 'USER',
  is_email_verified: 1,
  is_age_verified: 1,
  is_banned: 0,
  created_at: now,
} as unknown as User;

const OTHER = {
  id: 'usr_other_profile',
  user_id: 'usr_other_01',
  name: 'New Match',
  age: 28,
  gender: 'FEMALE',
  country: 'Bangladesh',
  city: 'Dhaka',
  bio: 'Hello there',
  photos: [],
  interests: [],
  languages: [],
  relationship_goal: 'Marriage',
  compatibility_score: 80,
  is_online: false,
  source_type: 'native',
  created_at: now,
  updated_at: now,
} as unknown as Profile;

const CONVERSATION = {
  id: 'conv_new_01',
  match_id: '',
  user_a_id: ME.id,
  user_b_id: OTHER.user_id,
  other_user: OTHER,
  unread_count: 0,
  created_at: now,
  updated_at: now,
} as unknown as Conversation;

// ---- fetch stub (no backend) ----------------------------------------------
let seq = 0;
const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

window.fetch = (async (input: any, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input?.url || '';
  const method = String(init?.method || (typeof input === 'object' ? input?.method : 'GET') || 'GET').toUpperCase();

  if (url.includes('/messages') && method === 'GET') return json({ messages: [] });
  if (url.includes('/messages') && method === 'POST') {
    seq += 1;
    let payload: any = {};
    try {
      payload = JSON.parse(String(init?.body || '{}'));
    } catch {}
    return json({
      message: {
        id: `msg_${String(seq).padStart(3, '0')}`,
        conversation_id: payload.conversation_id,
        sender_id: ME.id,
        receiver_id: payload.receiver_id,
        content: payload.content,
        message_type: payload.message_type || 'text',
        created_at: new Date().toISOString(),

      },
    });
  }
  return json({ success: true });
}) as typeof window.fetch;

// ---- harness shell (mirrors App.tsx message tab layout) -------------------
const Shell: React.FC = () => (
  <div className="min-h-screen w-full bg-stone-950 text-stone-100 flex flex-col font-sans selection:bg-rose-500 selection:text-white overflow-x-hidden">
    {/* Navbar replica (Navbar.tsx header: h-14 inner row) */}
    <header className="sticky top-0 z-40 w-full bg-stone-900/95 backdrop-blur-md border-b border-stone-800 safe-area-pt">
      <div className="w-full max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-1 sm:gap-2 overflow-x-clip min-w-0">
        <span className="font-bold text-white text-sm">Lovemeetly (harness navbar)</span>
      </div>
    </header>

    <div className="flex-1 flex w-full max-w-7xl mx-auto px-0 md:px-3 lg:px-6">
      <main
        id="app-main"
        className="flex-1 w-full px-2.5 sm:px-4 md:px-6 lg:px-8 py-2.5 sm:py-6 overflow-y-auto pb-20 md:pb-8"
      >
        <div
          id="messages-grid"
          className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6 h-[calc(100vh-8.5rem)] md:h-[calc(100vh-10rem)] w-full min-h-0"
        >
          {/* desktop conversation list column (hidden on mobile) */}
          <div className="hidden md:flex bg-stone-900 rounded-2xl border border-stone-800 flex-col shadow-xl h-full min-h-0" />
          <div id="thread-column" className="md:col-span-2 h-full min-h-0 flex">
            <ChatWindow
              conversation={CONVERSATION}
              currentUser={ME}
              onInitiateCall={() => {}}
              onViewProfile={() => {}}
              onReportUser={() => {}}
              onUnmatch={() => {}}
            />
          </div>
        </div>
      </main>
    </div>

    {/* Mobile bottom navigation replica (Sidebar.tsx) */}
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 w-full z-40 bg-stone-950/95 backdrop-blur-xl border-t border-stone-800/80 px-0.5 pt-1 pb-[max(env(safe-area-inset-bottom,0px),8px)] flex items-center justify-around shadow-2xl"
    >
      {['Home', 'Matches', 'Chats', 'Profile'].map((label) => (
        <span key={label} className="flex flex-col items-center gap-0.5 px-3 py-1 text-[9px] text-stone-400">
          <span className="w-5 h-5 rounded bg-stone-800" />
          {label}
        </span>
      ))}
    </nav>
  </div>
);

createRoot(document.getElementById('root')!).render(
  <LanguageProvider>
    <Shell />
  </LanguageProvider>
);

// ---- probe / driver helpers ----------------------------------------------
function rectOf(el: Element | null) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    top: Math.round(r.top),
    bottom: Math.round(r.bottom),
    height: Math.round(r.height),
    left: Math.round(r.left),
  };
}

const seenChatBodies = new WeakSet<Element>();
let remountCount = 0;
let lastChatBody: Element | null = null;

function probe() {
  const panel = document.querySelector('.chat-body')?.parentElement ?? null;
  const body = document.querySelector('.chat-body');
  const thread = document.querySelector('.chat-thread-scroll') as HTMLElement | null;
  const content = document.querySelector('.chat-message-content');
  const form = panel?.querySelector('form') ?? null;
  const main = document.getElementById('app-main') as HTMLElement | null;
  const doc = (document.scrollingElement || document.documentElement) as HTMLElement;

  if (body && body !== lastChatBody) {
    if (!seenChatBodies.has(body)) {
      seenChatBodies.add(body);
      remountCount += 1;
    }
    lastChatBody = body;
  }

  const formRect = rectOf(form);
  const bottomNav = document.querySelector('nav.fixed') as HTMLElement | null;
  const bottomNavRect = rectOf(bottomNav);
  const vvh = window.innerHeight;
  const vv = window.visualViewport;
  const visualViewportRect = vv
    ? { top: Math.round(vv.offsetTop), height: Math.round(vv.height) }
    : null;
  const visibleBottom = vv ? Math.round(vv.offsetTop + vv.height) : vvh;

  const bubbleCount = content
    ? Array.from(content.children).filter((child) =>
        String(child.className || '').includes('flex flex-col min-w-0')
      ).length
    : 0;

  return {
    viewport: { w: window.innerWidth, h: vvh },
    documentScrollTop: Math.round(doc.scrollTop),
    documentScrollHeight: doc.scrollHeight,
    documentClientHeight: doc.clientHeight,
    bodyScrollTop: Math.round(document.body.scrollTop),
    mainScrollTop: Math.round(main?.scrollTop || 0),
    mainScrollHeight: main?.scrollHeight,
    mainClientHeight: main?.clientHeight,
    mainRect: rectOf(main),
    panelRect: rectOf(panel),
    bodyRect: rectOf(body),
    threadRect: rectOf(thread),
    threadScrollTop: thread?.scrollTop,
    threadScrollHeight: thread?.scrollHeight,
    threadClientHeight: thread?.clientHeight,
    formRect,
    formFullyInViewport: formRect ? formRect.top >= 0 && formRect.bottom <= vvh : false,
    bottomNavRect,
    visualViewportRect,
    visibleBottom,
    composerTopAboveVisibleBottom: formRect ? formRect.top < visibleBottom : false,
    composerFullyAboveNav: formRect && bottomNavRect ? formRect.bottom <= bottomNavRect.top : null,
    composerTopAboveNav: formRect && bottomNavRect ? formRect.top < bottomNavRect.top : null,
    composerFound: Boolean(form),
    remountCount,
    bubbleCount,
  };
}

function setReactInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function sendOne(text: string) {
  const panel = document.querySelector('.chat-body')?.parentElement;
  const input = panel?.querySelector('input[type="text"]') as HTMLInputElement | null;
  const submit = panel?.querySelector('button[type="submit"]') as HTMLButtonElement | null;
  if (!input || !submit) return { ok: false, reason: 'composer not found' };
  setReactInputValue(input, text);
  submit.click();
  return { ok: true, text };
}

(window as any).__probe = probe;
(window as any).__send = sendOne;
(window as any).__setReactInputValue = setReactInputValue;
// Mimics the Android insets (status bar + gesture bar) that env(safe-area-inset-*)
// adds inside the Capacitor WebView on a real device.
(window as any).__applyAndroidInsets = () => {
  const header = document.querySelector('header') as HTMLElement | null;
  if (header) header.style.paddingTop = '24px';
  const nav = document.querySelector('nav.fixed') as HTMLElement | null;
  if (nav) nav.style.paddingBottom = '34px';
  return true;
};
(window as any).__ready = true;
