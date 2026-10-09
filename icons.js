/* Original brand icons. Keep the existing emoji keys in saved data. */
(() => {
  'use strict';
  const icons = {
  "🌙": "moon",
  "🌌": "night-sky",
  "🕌": "mosque",
  "🕰️": "clock",
  "🌇": "sunset",
  "🌆": "city-evening",
  "🌃": "city-night",
  "☀️": "sun",
  "📿": "prayer-beads",
  "🌘": "crescent",
  "🌅": "sunrise",
  "📖": "book",
  "🚶🏻‍♀️": "walk",
  "💧": "water",
  "🎧": "headphones",
  "🤝": "handshake",
  "🌳": "tree",
  "🫂": "connection",
  "🧭": "compass",
  "✨": "sparkles",
  "🧺": "basket",
  "🎨": "palette",
  "🕊️": "dove",
  "🪁": "kite",
  "🕯️": "candle",
  "🤱": "care",
  "🌕": "full-moon",
  "🕋": "kaaba",
  "🤙🏻": "playful",
  "🤙": "playful",
  "🤍": "heart",
  "🤎": "heart-warm",
  "❤️‍🩹": "heart-healing",
  "❤️": "heart",
  "💕": "heart",
  "💖": "heart",
  "⭐": "star",
  "★": "star",
  "🔁": "repeat",
  "🌼": "flower",
  "#️⃣": "hashtag",
  "🎉": "celebrate",
  "🙂": "smile",
  "🤣": "laugh",
  "😅": "smile-sweat",
  "🗓️": "calendar",
  "🌐": "globe",
  "🌍": "globe",
  "☁️": "cloud",
  "🎮": "gamepad",
  "📊": "chart",
  "💬": "chat",
  "📷": "camera",
  "💡": "idea",
  "🐢": "turtle",
  "📝": "notes",
  "📈": "growth",
  "📜": "scroll",
  "🧩": "puzzle",
  "✏️": "edit",
  "📌": "pin",
  "🎙️": "microphone",
  "📤": "upload",
  "⬇️": "download",
  "🔗": "link",
  "🔬": "science",
  "🗂️": "archive",
  "🗑️": "delete",
  "⚙": "gear",
  "⏳": "hourglass",
  "↩": "back",
  "🎯": "target",
  "🏷️": "tag",
  "📣": "announcement",
  "👍": "like",
  "👎": "dislike",
  "☆": "star-outline"
};
  const assetBase = new URL('./icons/ui/', document.currentScript.src);
  // Longer sequences first: a healing heart and skin-tone gesture are one icon.
  const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(Object.keys(icons).sort((a, b) => b.length - a.length).map(escapeRegex).join('|') + '(?:\\uFE0F)?', 'gu');
  const skip = 'script,style,textarea,input,select,option,svg,canvas,[contenteditable]:not([contenteditable="false"]),[data-preserve-emoji],.post-body,.post-reply,.post-author,.photo-caption,.lb-name,.modal-quote,.mission-text,.mission-step-text,.archive-text,.habit-check-ar,.announcement-text,#hello-nick,#reflect-question';

  function renderText(node) {
    if (!node.parentElement || node.parentElement.closest(skip)) return;
    pattern.lastIndex = 0;
    const matches = [...node.data.matchAll(pattern)];
    if (!matches.length) return;
    const fragment = document.createDocumentFragment();
    let position = 0;
    for (const match of matches) {
      fragment.append(document.createTextNode(node.data.slice(position, match.index)));
      const image = document.createElement('img');
      const key = icons[match[0]] ? match[0] : match[0].replace(/\uFE0F$/, '');
      image.src = new URL(icons[key] + '.svg', assetBase).href;
      image.className = 'pom-icon';
      image.alt = match[0]; // Preserve the original accessible meaning, in either language.
      image.width = 24;
      image.height = 24;
      image.draggable = false;
      fragment.append(image);
      position = match.index + match[0].length;
    }
    fragment.append(document.createTextNode(node.data.slice(position)));
    node.replaceWith(fragment);
  }
  function render(root) {
    if (root.nodeType === Node.TEXT_NODE) return renderText(root);
    if (root.nodeType !== Node.ELEMENT_NODE || root.closest(skip)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(renderText);
  }
  render(document.body);
  // Updates from language/theme switches and Firebase templates are handled locally.
  new MutationObserver(records => {
    const roots = new Set();
    for (const record of records) {
      if (record.type === 'characterData') roots.add(record.target);
      else record.addedNodes.forEach(node => roots.add(node));
    }
    roots.forEach(render);
  }).observe(document.body, { childList: true, characterData: true, subtree: true });
})();
