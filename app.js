// Presentation-layer gate only — this is a static site, so the password
// check happens in the browser and the hash below is visible to anyone who
// opens dev tools. It keeps casual visitors and search engines out; it is
// NOT real access control. Don't put anything here you'd mind a determined
// person seeing.
const PASSWORD_HASH = '1da0672bd372f181d79fd5391aaeda10d256ebfd95ddb09ab9b51e52affbdbfc';
const SESSION_KEY = 'lac-gallery-unlocked';

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const gate = document.getElementById('gate');
const app = document.getElementById('app');

function unlock() {
  gate.style.display = 'none';
  app.classList.add('unlocked');
  loadGallery();
}

if (sessionStorage.getItem(SESSION_KEY) === '1') {
  unlock();
} else {
  document.getElementById('gate-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = document.getElementById('gate-password').value;
    const hash = await sha256Hex(val);
    if (hash === PASSWORD_HASH) {
      sessionStorage.setItem(SESSION_KEY, '1');
      unlock();
    } else {
      document.getElementById('gate-error').textContent = 'Wrong password, try again.';
    }
  });
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// Flattened for the lightbox (continuous prev/next across the whole
// gallery), each entry tagged with the caption/date of the group (WhatsApp
// "post") it came from.
let allImages = [];

async function loadGallery() {
  let curatedGroups;
  try {
    const res = await fetch('gallery-data.json');
    if (!res.ok) throw new Error('not found');
    curatedGroups = await res.json();
  } catch {
    document.getElementById('gallery').innerHTML =
      '<div class="leaderboard-empty">No curated gallery yet — run curate.html first and hit "Save to gallery".</div>';
    return;
  }

  allImages = [];
  for (const g of curatedGroups) {
    for (const file of g.images) {
      allImages.push({ file, date: g.date, caption: g.caption, groupId: g.id });
    }
  }

  const gallery = document.getElementById('gallery');
  const byMonth = new Map();
  for (const g of curatedGroups) {
    const key = g.date.slice(0, 7); // YYYY-MM
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key).push(g);
  }

  for (const [key, monthGroups] of byMonth) {
    const [y, m] = key.split('-').map(Number);
    const section = document.createElement('section');
    section.className = 'month-section';

    const heading = document.createElement('h2');
    heading.className = 'month-heading';
    heading.textContent = `${MONTH_NAMES[m - 1]} ${y}`;
    section.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'grid';

    for (const g of monthGroups) {
      grid.appendChild(buildGroupCard(g));
    }

    section.appendChild(grid);
    gallery.appendChild(section);
  }
}

function buildGroupCard(group) {
  const count = group.images.length;
  const card = document.createElement('div');
  card.className = `group-card count-${count >= 4 ? '4plus' : count}`;
  if (group.caption) card.title = group.caption;

  const mosaic = document.createElement('div');
  mosaic.className = 'mosaic';

  // Show up to 4 tiles; a "+N" overlay on the last one covers any remainder.
  const visible = group.images.slice(0, 4);
  const remainder = count - visible.length;

  visible.forEach((file, i) => {
    const tile = document.createElement('div');
    tile.className = 'tile';
    const isLastVisible = i === visible.length - 1;
    if (isLastVisible && remainder > 0) {
      tile.classList.add('more');
      tile.dataset.more = `+${remainder}`;
    }
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = `images/${file}`;
    img.alt = group.caption || '';
    tile.appendChild(img);

    const flatIdx = allImages.findIndex((im) => im.file === file && im.groupId === group.id);
    tile.addEventListener('click', () => openLightbox(flatIdx));
    mosaic.appendChild(tile);
  });

  card.appendChild(mosaic);

  if (count > 1) {
    const badge = document.createElement('div');
    badge.className = 'group-card-count';
    badge.textContent = `${count} photos`;
    card.appendChild(badge);
  }

  return card;
}

// --- Lightbox ---
let lbIndex = -1;
const lightbox = document.getElementById('lightbox');

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

function openLightbox(idx) {
  lbIndex = idx;
  renderLightbox();
  lightbox.classList.add('open');
}

function renderLightbox() {
  const img = allImages[lbIndex];
  document.getElementById('lb-img').src = `images/${img.file}`;
  document.getElementById('lb-date').textContent = formatDate(img.date);
  document.getElementById('lb-caption').textContent = img.caption || '';
}

function closeLightbox() {
  lightbox.classList.remove('open');
}

document.getElementById('lb-close').addEventListener('click', closeLightbox);
document.getElementById('lb-prev').addEventListener('click', () => {
  lbIndex = (lbIndex - 1 + allImages.length) % allImages.length;
  renderLightbox();
});
document.getElementById('lb-next').addEventListener('click', () => {
  lbIndex = (lbIndex + 1) % allImages.length;
  renderLightbox();
});
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox();
});
document.addEventListener('keydown', (e) => {
  if (!lightbox.classList.contains('open')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') document.getElementById('lb-prev').click();
  if (e.key === 'ArrowRight') document.getElementById('lb-next').click();
});
