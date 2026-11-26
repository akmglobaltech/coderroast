/**
 * Platform share intents.
 *
 * None of these accept an image payload — they only take text and a URL. The
 * picture reaches those platforms either through the native share sheet
 * (`navigator.share` with files) or through the Open Graph tags on the shared
 * link, which is why `index.html` carries an `og:image`.
 */
export interface ShareTarget {
  id: string;
  label: string;
  href: (text: string, url: string) => string;
}

const enc = encodeURIComponent;

export const SHARE_TARGETS: ShareTarget[] = [
  {
    id: "x",
    label: "X",
    href: (text, url) => `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    href: (_text, url) => `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    href: (text, url) => `https://wa.me/?text=${enc(`${text} ${url}`)}`,
  },
  {
    id: "telegram",
    label: "Telegram",
    href: (text, url) => `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`,
  },
  {
    id: "reddit",
    label: "Reddit",
    href: (text, url) => `https://www.reddit.com/submit?url=${enc(url)}&title=${enc(text)}`,
  },
  {
    id: "facebook",
    label: "Facebook",
    href: (_text, url) => `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
  },
  {
    id: "hackernews",
    label: "Hacker News",
    href: (text, url) => `https://news.ycombinator.com/submitlink?u=${enc(url)}&t=${enc(text)}`,
  },
];
