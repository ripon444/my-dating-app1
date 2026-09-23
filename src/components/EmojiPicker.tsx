import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';

export interface EmojiPickerProps {
  /** Element the picker is visually anchored to (the composer's emoji button). */
  anchorEl: HTMLElement | null;
  /** Called with the chosen emoji character. The picker stays open for multiple picks. */
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

interface EmojiEntry {
  char: string;
  keywords?: string;
}

interface EmojiCategory {
  id: string;
  label: string;
  emojis: EmojiEntry[];
}

const E = (chars: string, keywords: Record<string, string> = {}): EmojiEntry[] =>
  chars.split(' ').filter(Boolean).map((char) => ({ char, keywords: keywords[char] }));

const CATEGORIES: EmojiCategory[] = [
  {
    id: 'smileys',
    label: 'Smileys',
    emojis: E(
      '😀 😃 😄 😁 😆 😅 😂 🤣 🙂 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 😋 😛 😜 🤪 😝 🤗 🤭 🤫 🤔 🤐 😐 😑 😶 😏 😒 🙄 😬 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 💩 🤡 👻 👽 🤖 😺 😸 😹 😻 😼 😽 🙀 😿 😾',
      {
        '😀': 'happy grin smile', '😂': 'laugh joy tears', '🥰': 'love adore', '😍': 'love heart eyes',
        '🤔': 'think hmm', '😎': 'cool sunglasses', '🥳': 'party celebrate', '😭': 'cry sad tears',
        '😡': 'angry mad', '🥺': 'pleading sad', '🤗': 'hug', '😴': 'sleep', '🤢': 'sick nauseated',
      }
    ),
  },
  {
    id: 'people',
    label: 'People',
    emojis: E(
      '👋 🤚 🖐 ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪 🦾 🦵 🦶 👂 👃 🧠 🫀 🫁 🦷 🦴 👀 👁️ 👅 👄 💋 🩸 👶 🧒 👦 👧 🧑 👨 👩 🧔 👱 👴 👵 🙈 🙉 🙊',
      {
        '👋': 'wave hello hi', '👍': 'thumbs up like yes', '👎': 'thumbs down dislike',
        '👏': 'clap applause', '🙌': 'celebrate hands', '🙏': 'pray thanks please', '💪': 'strong muscle',
        '👀': 'eyes look', '🙈': 'monkey shy', '🤝': 'handshake deal',
      }
    ),
  },
  {
    id: 'love',
    label: 'Love',
    emojis: E(
      '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ♥️ 💌 💐 🌹 🥀 🌷 🌺 🌸 🌼 🌻 💍 👰 🤵 💒',
      {
        '❤️': 'red heart love', '💕': 'two hearts love', '💖': 'sparkling heart', '💘': 'cupid arrow heart',
        '🌹': 'rose flower', '💍': 'ring engagement', '💒': 'wedding marry', '💔': 'broken heart',
      }
    ),
  },
  {
    id: 'animals',
    label: 'Animals',
    emojis: E(
      '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐒 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🐛 🦋 🐌 🐞 🐢 🐍 🦖 🐙 🦑 🦀 🐬 🐳 🐟 🐠 🐡 🦈 🐊 🐅 🐆 🦓 🦍 🐘 🦏 🐪 🦒 🐄 🐎 🐑 🐐 🦌 🐕 🐩 🐈 🐓 🦃 🕊 🐇 🦝',
      { '🐶': 'dog puppy', '🐱': 'cat kitten', '🦄': 'unicorn', '🦋': 'butterfly', '🐼': 'panda' }
    ),
  },
  {
    id: 'food',
    label: 'Food',
    emojis: E(
      '🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🥦 🥕 🌽 🌶 🥒 🥬 🧄 🧅 🥔 🍠 🥐 🥯 🍞 🥖 🥨 🧀 🥚 🍳 🥞 🧇 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🥗 🍿 🍱 🍣 🍤 🍜 🍲 🍛 🍚 🍙 🍥 🍡 🍧 🍨 🍦 🥧 🧁 🍰 🎂 🍮 🍭 🍬 🍫 🍩 🍪 🌰 🥜 🍯 🥛 🍼 ☕ 🍵 🧃 🥤 🍺 🍻 🥂 🍷 🥃 🍸 🍹 🍾',
      { '🍕': 'pizza', '🍔': 'burger', '🍰': 'cake', '🎂': 'birthday cake', '☕': 'coffee', '🍺': 'beer', '🥂': 'cheers toast' }
    ),
  },
  {
    id: 'activity',
    label: 'Activity',
    emojis: E(
      '⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🎱 🏓 🏸 🥅 🏒 🏑 🥍 🏏 🥊 🥋 🎽 🛹 🛼 ⛸ 🎿 ⛷ 🏂 🏋️ 🤼 🤸 🤺 🤾 🏌️ 🏇 🧘 🏄 🏊 🚣 🧗 🚵 🚴 🏆 🥇 🥈 🥉 🏅 🎖 🏵 🎗 🎫 🎟 🎪 🤹 🎭 🩰 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🎷 🎺 🎸 🎻 🎲 🎯 🎳 🎮 🎰 🧩 🎉 🎊 🎈 🎁 🎀 🎇 🎆 ✨ 🎃 🎄 🧨 🎐',
      { '🎉': 'party celebrate tada', '🎊': 'confetti party', '🎁': 'gift present', '🎈': 'balloon', '🏆': 'trophy win', '🎮': 'game gaming' }
    ),
  },
  {
    id: 'objects',
    label: 'Objects',
    emojis: E(
      '💎 📱 💻 ⌚ ⌨️ 🖥 🖨 🖱 💾 💿 📀 📷 📸 📹 🎥 📞 ☎️ 📟 📠 📺 📻 🎙 ⏰ ⏳ ⌛ 📡 🔋 🔌 💡 🔦 🕯 🔥 💥 ⭐ 🌟 💫 ⚡ ☀️ 🌤 ⛅ 🌧 ⛈ 🌩 🌨 ❄️ ⛄ 🌬 💨 🌪 ☂️ ☔ 💧 💦 🌊 🚀 ✈️ 🚗 🚕 🚙 🚌 🏠 🏡 🗺 🧭 🕰 ⌚ 🔨 🛠 ⚙️ 🧰 🧲 🔒 🔓 🔐 🔑 🗝 📦 📫 📮 📝 📖 📚 🖊 🖍 📌 📍 📎 ✂️ 📏 🔭 🔬 💊 💉 🩺 🌡 🧪',
      {
        '🔥': 'fire hot lit', '⭐': 'star', '✨': 'sparkles shine', '🚀': 'rocket launch', '💎': 'diamond gem',
        '💡': 'idea light bulb', '🔒': 'lock secure', '📎': 'paperclip attach', '☀️': 'sun sunny', '❄️': 'snow cold',
      }
    ),
  },
  {
    id: 'symbols',
    label: 'Symbols',
    emojis: E(
      '✅ ❌ ❎ ✔️ ☑️ ➕ ➖ ➗ ✖️ 💯 💢 💬 💭 💤 ♻️ ✳️ ❇️ ✴️ 🆚 🆗 🆕 🆓 🆙 🆒 🔝 🔜 🔙 🔚 ➡️ ⬅️ ⬆️ ⬇️ ↗️ ↘️ ↙️ ↖️ ▶️ ⏸ ⏹ ⏺ ⏭ ⏮ ⏩ ⏪ 🔀 🔁 🔄 🔃 ⚠️ 🚫 ⛔ ❗ ❓ ⁉️ ‼️ 〰️ 💠 🔱 ⚜️',
      { '✅': 'check yes done', '❌': 'cross no wrong', '⚠️': 'warning', '❗': 'exclamation', '❓': 'question', '💬': 'chat message' }
    ),
  },
];

const PICKER_WIDTH = 320;
const PICKER_MAX_HEIGHT = 340;
const PICKER_MIN_HEIGHT = 200;
const GAP = 8;
const MARGIN = 8;

interface Position {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ anchorEl, onSelect, onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].id);
  const [position, setPosition] = useState<Position | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const seen = new Set<string>();
    const out: EmojiEntry[] = [];
    CATEGORIES.forEach((cat) => {
      cat.emojis.forEach((entry) => {
        const haystack = `${entry.char} ${entry.keywords || ''} ${cat.label} ${cat.id}`.toLowerCase();
        if (haystack.includes(q) && !seen.has(entry.char)) {
          seen.add(entry.char);
          out.push(entry);
        }
      });
    });
    return out;
  }, [query]);

  const updatePosition = useCallback(() => {
    const el = anchorEl;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const width = Math.min(PICKER_WIDTH, viewportW - MARGIN * 2);

    const spaceAbove = rect.top - MARGIN - GAP;
    const spaceBelow = viewportH - rect.bottom - MARGIN - GAP;
    const openUp = spaceAbove >= spaceBelow;

    const available = openUp ? spaceAbove : spaceBelow;
    const height = Math.max(
      Math.min(PICKER_MAX_HEIGHT, PICKER_MIN_HEIGHT),
      Math.min(PICKER_MAX_HEIGHT, available)
    );

    let top = openUp ? rect.top - GAP - height : rect.bottom + GAP;
    top = Math.max(MARGIN, Math.min(top, viewportH - height - MARGIN));

    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(MARGIN, Math.min(left, viewportW - width - MARGIN));

    setPosition({ top, left, width, height });
  }, [anchorEl]);

  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition]);

  useEffect(() => {
    const onResize = () => updatePosition();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [updatePosition]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (anchorEl?.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [anchorEl, onClose]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        anchorEl?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [anchorEl, onClose]);

  // Keep keyboard navigation available without forcing the mobile keyboard open.
  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
  }, []);

  const activeEmojis = filtered ?? CATEGORIES.find((cat) => cat.id === activeCategory)?.emojis ?? [];

  if (!position) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Emoji picker"
      tabIndex={-1}
      style={{ position: 'fixed', top: position.top, left: position.left, width: position.width, height: position.height }}
      className="z-[70] flex flex-col overflow-hidden rounded-2xl border border-stone-700 bg-stone-900/98 shadow-2xl shadow-black/60 backdrop-blur outline-none"
    >
      <div className="flex items-center gap-2 border-b border-stone-800 px-2.5 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-xl bg-stone-800 px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-stone-400" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search emoji"
            aria-label="Search emoji"
            className="min-w-0 flex-1 bg-transparent text-xs text-stone-100 placeholder-stone-500 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear emoji search"
              className="shrink-0 text-stone-400 transition hover:text-stone-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            onClose();
            anchorEl?.focus();
          }}
          aria-label="Close emoji picker"
          className="shrink-0 rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-800 hover:text-stone-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!filtered && (
        <div className="flex shrink-0 gap-0.5 border-b border-stone-800 px-2 py-1.5" role="tablist" aria-label="Emoji categories">
          {CATEGORIES.map((cat) => {
            const isActive = cat.id === activeCategory;
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={cat.label}
                title={cat.label}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex-1 rounded-lg px-1 py-1 text-base leading-none transition ${
                  isActive ? 'bg-stone-700/80 text-white' : 'text-stone-400 hover:bg-stone-800 hover:text-stone-200'
                }`}
              >
                <span aria-hidden="true">{cat.emojis[0]?.char}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-2">
        {activeEmojis.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-stone-500">No emoji found</p>
        ) : (
          <div className="grid grid-cols-8 gap-0.5 sm:grid-cols-9">
            {activeEmojis.map((entry, index) => (
              <button
                key={`${entry.char}-${index}`}
                type="button"
                onClick={() => onSelect(entry.char)}
                aria-label={`Insert ${entry.keywords || 'emoji'}`}
                title={entry.keywords}
                className="flex h-8 w-full touch-manipulation items-center justify-center rounded-lg text-lg leading-none transition hover:bg-stone-700 active:scale-90"
              >
                <span aria-hidden="true">{entry.char}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default EmojiPicker;
