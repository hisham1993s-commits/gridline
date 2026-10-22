// ---------------------------------------------------------------------------
// F1 news headlines via the official Formula 1 RSS feed.
// We show HEADLINES and link out to the original article — we never copy the
// article text (that belongs to the publisher).
// ---------------------------------------------------------------------------

const FEED = 'https://www.formula1.com/content/fom-website/en/latest/all.xml';

function stripCdata(s) {
  if (!s) return '';
  return s
    .replace(/<!\[CDATA\[/g, '')
    .replace(/\]\]>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? stripCdata(m[1]) : '';
}

export async function fetchNews() {
  const res = await fetch(FEED);
  if (!res.ok) throw new Error(`News feed -> ${res.status}`);
  const xml = await res.text();

  const items = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  return items.slice(0, 25).map((block) => {
    const pub = tag(block, 'pubDate');
    return {
      title: tag(block, 'title'),
      link: tag(block, 'link'),
      date: pub ? new Date(pub) : null,
    };
  }).filter((n) => n.title && n.link);
}
