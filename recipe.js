/* Toggle mobile menu */
    function toggleMenu(){
      const nav = document.getElementById('navList');
      nav.classList.toggle('active');
    }

    /* Close menu when clicking a link */
    function closeMenu(){
      const nav = document.getElementById('navList');
      if (nav.classList.contains('active')) nav.classList.remove('active');
    }

    /* Example handler for Browse button (keeps behavior same) */
    function onBrowseClick(){
      // keep this empty or add your navigation behavior:
      // e.g. window.location.href = 'recipe.html';
      // For now we just close the menu (mobile)
      closeMenu();
      // If you want to navigate, uncomment the line below:
      // window.location.href = 'recipe.html';
    }

    /* Ensure .browse-mobile visibility toggles with CSS breakpoints:
       We don't rely on JS for responsiveness, but set the element visible on mobile.
    */
    function syncMobileBrowseVisibility(){
      constbrowseMobile = document.querySelector('.browse-mobile');
      if (!constbrowseMobile) return;
      // matchMedia to detect mobile breakpoint used in CSS
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      if (isMobile) {
        constbrowseMobile.style.display = 'inline-block';
      } else {
        constbrowseMobile.style.display = 'none';
      }
    }

    // run on load and on resize
    window.addEventListener('load', syncMobileBrowseVisibility);
    window.addEventListener('resize', syncMobileBrowseVisibility);

    /* recipe.js
   Drop-in search + time filters for your provided recipe page HTML.
   Works with:
     #search-input, #search-btn, #prep-time, #cook-time, .recipes .card
*/

/* ---------- Config ---------- */
const DEBOUNCE_MS = 300;

/* ---------- DOM refs ---------- */
const searchInput = document.getElementById('search-input');
const searchBtn   = document.getElementById('search-btn');
const prepSelect  = document.getElementById('prep-time');
const cookSelect  = document.getElementById('cook-time');
const cardsParent  = document.querySelector('.recipes');
const cards        = Array.from(document.querySelectorAll('.recipes .card'));

/* store original text so we can restore after highlighting */
cards.forEach(card => {
  const titleEl = card.querySelector('h4');
  const descEl  = card.querySelector('p');
  card.dataset.origTitle = titleEl ? titleEl.textContent : '';
  card.dataset.origDesc  = descEl  ? descEl.textContent  : '';
});

/* ---------- Utilities ---------- */
function debounce(fn, ms){
  let t = null;
  return function(...args){
    clearTimeout(t);
    t = setTimeout(()=> fn.apply(this,args), ms);
  };
}

function norm(str){
  return (str || '').toString().trim().toLowerCase();
}

/* extract first integer (minutes) from strings like "Prep: 10 mins" or "10 mins" */
function extractMinutes(text){
  if(!text) return null;
  const m = text.match(/(\d+)\s*min/i) || text.match(/(\d+)\b/);
  return m ? parseInt(m[1], 10) : null;
}

/* get prep minutes for a card (null if missing) */
function getPrepMinutes(card){
  const prepSpan = card.querySelector('.time .prep span');
  return extractMinutes(prepSpan ? prepSpan.textContent : '');
}

/* get cook minutes for a card (null if missing) */
function getCookMinutes(card){
  const cookSpan = card.querySelector('.time .cook span');
  return extractMinutes(cookSpan ? cookSpan.textContent : '');
}

/* highlight token occurrences in a text using <mark> (case-insensitive).
   safe: works on plain text (we replace innerHTML only with safe markup built from original text) */
function highlightText(original, tokens){
  if(!tokens || tokens.length === 0) return escapeHtml(original);

  // escape first
  const safe = escapeHtml(original);

  // build regex of tokens (escape regex chars)
  const esc = tokens
    .map(t => t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))
    .filter(Boolean);
  if(esc.length === 0) return safe;

  const re = new RegExp('(' + esc.join('|') + ')', 'ig');
  return safe.replace(re, '<mark>$1</mark>');
}

/* minimal HTML escape */
function escapeHtml(s){
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

/* ---------- Core filter logic ---------- */
function doFilterAndHighlight(){
  const qRaw = norm(searchInput.value || '');
  const qTokens = qRaw === '' ? [] : qRaw.split(/\s+/).filter(Boolean);

  // parse selected max minutes (if any)
  const prepVal = (prepSelect && prepSelect.value) ? prepSelect.value : '';
  const cookVal = (cookSelect && cookSelect.value) ? cookSelect.value : '';

  const maxPrep = (prepVal && /\d/.test(prepVal)) ? extractMinutes(prepVal) : null;
  const maxCook = (cookVal && /\d/.test(cookVal)) ? extractMinutes(cookVal) : null;

  let visibleCount = 0;

  cards.forEach(card => {
    // restore originals
    const titleEl = card.querySelector('h4');
    const descEl  = card.querySelector('p');

    const origTitle = card.dataset.origTitle || (titleEl ? titleEl.textContent : '');
    const origDesc  = card.dataset.origDesc  || (descEl  ? descEl.textContent  : '');

    // text to match against
    const titleText = norm(origTitle);
    const descText  = norm(origDesc);

    // time filters
    const cardPrep = getPrepMinutes(card); // may be null
    const cardCook = getCookMinutes(card); // may be null

    let passesTime = true;
    if(maxPrep !== null && cardPrep !== null) {
      if(cardPrep > maxPrep) passesTime = false;
    } else if(maxPrep !== null && cardPrep === null) {
      // if card has no prep time info, be permissive (show it). comment/uncomment to change.
      passesTime = true;
    }

    if(passesTime && maxCook !== null && cardCook !== null) {
      if(cardCook > maxCook) passesTime = false;
    } else if(passesTime && maxCook !== null && cardCook === null) {
      passesTime = true;
    }

    // text query checks: if no query, it's a match (subject to time)
    let passesQuery = true;
    if(qTokens.length > 0){
      // match if any token present in title OR description
      passesQuery = qTokens.some(tok => titleText.includes(tok) || descText.includes(tok));
    }

    const shouldShow = passesTime && passesQuery;

    if(shouldShow){
      visibleCount++;
      card.style.display = ''; // show

      // highlight title and description using tokens
      const combinedTokens = qTokens; // currently highlight using search tokens
      if(titleEl) titleEl.innerHTML = highlightText(origTitle, combinedTokens);
      if(descEl)  descEl.innerHTML  = highlightText(origDesc, combinedTokens);
    } else {
      // hide card and restore text to original (no highlight)
      card.style.display = 'none';
      if(titleEl) titleEl.textContent = origTitle;
      if(descEl)  descEl.textContent  = origDesc;
    }
  });

  // optional: update document title with count for quick feedback (non-invasive)
  if(typeof document !== 'undefined'){
    document.title = `Recipes (${visibleCount})`;
    // if you prefer not to change title, comment out the line above
  }
}

/* debounce wrapper */
const debouncedFilter = debounce(doFilterAndHighlight, DEBOUNCE_MS);

/* ---------- Event wiring ---------- */
if(searchInput){
  searchInput.addEventListener('input', debouncedFilter);
  searchInput.addEventListener('keydown', (e) => {
    if(e.key === 'Enter'){
      e.preventDefault();
      doFilterAndHighlight();
    }
  });
}
if(searchBtn){
  searchBtn.addEventListener('click', (e) => {
    e.preventDefault();
    doFilterAndHighlight();
  });
}
if(prepSelect) prepSelect.addEventListener('change', debouncedFilter);
if(cookSelect) cookSelect.addEventListener('change', debouncedFilter);

/* run once on load to ensure initial state (show all) */
document.addEventListener('DOMContentLoaded', () => {
  // restore originals (in case)
  cards.forEach(card => {
    const t = card.querySelector('h4');
    const d = card.querySelector('p');
    if(t) t.textContent = card.dataset.origTitle;
    if(d) d.textContent = card.dataset.origDesc;
    card.style.display = '';
  });
  doFilterAndHighlight();
});

/* ---------- Optional: minimal nav helper stubs (safe no-op if you already have them) ---------- */
window.toggleMenu = window.toggleMenu || function(){ const n = document.getElementById('navList'); if(n) n.classList.toggle('active'); };
window.closeMenu = window.closeMenu || function(){ const n = document.getElementById('navList'); if(n) n.classList.remove('active'); };
window.onBrowseClick = window.onBrowseClick || function(){ /* placeholder: keep as-is or navigate to recipe page */ };

