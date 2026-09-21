/* eslint-disable no-undef */
/*
 * Lovemeetly Web Push service worker (Firebase Cloud Messaging).
 *
 * Handles background / closed-tab chat message pushes for the
 * `app-lovemeetly` Firebase project. Foreground chat notifications are owned
 * by the page's existing Socket.IO + Notification API path, so this worker
 * suppresses its own notification whenever a visible Lovemeetly tab exists.
 *
 * The config below is Firebase's public Web client configuration (not a secret).
 */
importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDPft1Uib0BoL_I-JNFJ9M9IbhosqgLeww',
  authDomain: 'app-lovemeetly.firebaseapp.com',
  projectId: 'app-lovemeetly',
  storageBucket: 'app-lovemeetly.firebasestorage.app',
  messagingSenderId: '67149011787',
  appId: '1:67149011787:web:a71724e279a2477a81a6ce',
  measurementId: 'G-XTJ0PDCF9H',
});

const messaging = firebase.messaging();

const MAX_TRACKED_IDS = 200;
let trackedIds = [];

try {
  self.addEventListener('install', function () {
    self.skipWaiting();
  });
  self.addEventListener('activate', function (event) {
    event.waitUntil(self.clients.claim());
  });
} catch (e) {}

function readTrackedIds() {
  return trackedIds;
}

function rememberId(id) {
  const ids = readTrackedIds();
  if (ids.indexOf(id) !== -1) return;
  ids.push(id);
  while (ids.length > MAX_TRACKED_IDS) ids.shift();
  trackedIds = ids;
}

function alreadyNotified(id) {
  return readTrackedIds().indexOf(id) !== -1;
}

function buildConversationUrl(conversationId) {
  const base = self.location.origin || 'https://lovemeetly.com';
  const params = new URLSearchParams();
  if (conversationId) params.set('conversation', conversationId);
  params.set('tab', 'messages');
  return base + '/?' + params.toString();
}

function extractData(payload) {
  const d = (payload && payload.data) || {};
  const n = (payload && payload.notification) || {};
  return {
    messageId: d.messageId || d.message_id || '',
    conversationId: d.conversationId || d.conversation_id || '',
    senderId: d.senderId || d.sender_id || '',
    senderName: d.senderName || d.sender_name || '',
    preview: d.preview || d.body || n.body || '',
    messageType: d.messageType || d.message_type || 'text',
    title: d.title || n.title || '',
  };
}

async function hasVisibleClient() {
  try {
    const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (let i = 0; i < windowClients.length; i++) {
      if (windowClients[i].visibilityState === 'visible') return true;
    }
  } catch (e) {}
  return false;
}

async function showChatNotification(data) {
  if (data.messageId && alreadyNotified(data.messageId)) return;
  if (data.messageId) rememberId(data.messageId);

  const title = data.senderName
    ? 'New message from ' + data.senderName
    : data.title || 'New message';

  let body = (data.preview || '').trim();
  if (!body) body = 'You have a new message on Lovemeetly.';
  if (body.length > 120) body = body.slice(0, 117) + '...';

  const tag = data.messageId ? 'lovemeetly-msg-' + data.messageId : 'lovemeetly-conv-' + (data.conversationId || 'new');

  await self.registration.showNotification(title, {
    body: body,
    icon: '/logo.png',
    badge: '/favicon.png',
    tag: tag,
    renotify: false,
    data: {
      conversationId: data.conversationId,
      messageId: data.messageId,
    },
  });
}

messaging.onBackgroundMessage(function (payload) {
  const data = extractData(payload);
  if (!data.messageId && !data.conversationId) return Promise.resolve();

  return hasVisibleClient().then(function (visible) {
    if (visible) return;
    return showChatNotification(data);
  });
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const data = (event.notification && event.notification.data) || {};
  const conversationId = data.conversationId || '';
  const targetUrl = buildConversationUrl(conversationId);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        try {
          client.postMessage({ type: 'lm-open-conversation', conversationId: conversationId });
        } catch (e) {}
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
