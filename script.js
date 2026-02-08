document.addEventListener('DOMContentLoaded', () => {
    const navbar = document.getElementById('navbar');
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.getElementById('navMenu');

    // Scroll — navbar
    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 60);
        document.querySelectorAll('section[id], header[id]').forEach(s => {
            const link = document.querySelector(`.nav-link[href="#${s.id}"]`);
            if (link) {
                const top = s.offsetTop - 200;
                const bot = top + s.offsetHeight;
                link.classList.toggle('active', window.scrollY >= top && window.scrollY < bot);
            }
        });
    });

    // Mobile menu
    navToggle.addEventListener('click', () => navMenu.classList.toggle('open'));
    document.querySelectorAll('.nav-link').forEach(l => l.addEventListener('click', () => navMenu.classList.remove('open')));

    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', e => {
            e.preventDefault();
            const t = document.querySelector(a.getAttribute('href'));
            if (t) window.scrollTo({ top: t.offsetTop - 70, behavior: 'smooth' });
        });
    });

    // Counter animation
    let counted = false;
    const counters = document.querySelectorAll('.number');
    function animateCounters() {
        if (counted) return;
        counted = true;
        counters.forEach(c => {
            const target = +c.dataset.target;
            const start = performance.now();
            (function update(now) {
                const p = Math.min((now - start) / 1800, 1);
                c.textContent = Math.floor((1 - Math.pow(1 - p, 3)) * target).toLocaleString();
                if (p < 1) requestAnimationFrame(update);
                else c.textContent = target.toLocaleString();
            })(start);
        });
    }
    const statsObs = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) { setTimeout(animateCounters, 300); statsObs.disconnect(); }
    }, { threshold: 0.3 });
    const nums = document.querySelector('.hero-numbers');
    if (nums) statsObs.observe(nums);

    // Scroll reveal
    const reveals = document.querySelectorAll('.research-card, .media-item, .pub, .timeline-item, .capability, .contact-block');
    reveals.forEach(el => el.classList.add('reveal'));
    const revObs = new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); revObs.unobserve(e.target); } });
    }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
    reveals.forEach(el => revObs.observe(el));

    // Publication filters
    document.querySelectorAll('.pub-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            const cat = btn.dataset.filter;
            document.querySelectorAll('.pub-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.pub').forEach(p => {
                p.classList.toggle('hidden', cat !== 'all' && p.dataset.category !== cat);
            });
        });
    });

    // Quotes carousel
    const quotes = document.querySelectorAll('.quote');
    const quoteNav = document.getElementById('quoteNav');
    let qi = 0, qTimer;
    if (quotes.length && quoteNav) {
        quotes.forEach((_, i) => {
            const dot = document.createElement('div');
            dot.className = 'quote-dot' + (i === 0 ? ' active' : '');
            dot.addEventListener('click', () => showQ(i));
            quoteNav.appendChild(dot);
        });
        function showQ(i) {
            quotes.forEach(q => q.classList.remove('active'));
            quoteNav.querySelectorAll('.quote-dot').forEach(d => d.classList.remove('active'));
            quotes[i].classList.add('active');
            quoteNav.children[i].classList.add('active');
            qi = i;
        }
        qTimer = setInterval(() => showQ((qi + 1) % quotes.length), 5000);
        document.querySelector('.quotes-block')?.addEventListener('mouseenter', () => clearInterval(qTimer));
        document.querySelector('.quotes-block')?.addEventListener('mouseleave', () => { qTimer = setInterval(() => showQ((qi + 1) % quotes.length), 5000); });
    }

    // Edit mode
    const editBtn = document.getElementById('editModeBtn');
    const editPanel = document.getElementById('editPanel');
    const editClose = document.getElementById('editPanelClose');
    const editables = '.bio-content, .bots-text, .hero-text h1, .hero-desc, .section-title, .section-desc, .research-card h3, .research-card p, .media-item h3, .media-item p, .pub-he, .capability h4, .capability p, .quote p';
    let editing = false;

    function toggleEdit() {
        editing = !editing;
        document.body.classList.toggle('edit-mode', editing);
        editPanel.classList.toggle('show', editing);
        document.querySelectorAll(editables).forEach(el => el.contentEditable = editing);
        editBtn.textContent = editing ? 'סגור' : 'עריכה';
    }

    editBtn?.addEventListener('click', toggleEdit);
    editClose?.addEventListener('click', toggleEdit);

    document.getElementById('saveEdits')?.addEventListener('click', () => {
        const data = {};
        document.querySelectorAll(editables).forEach((el, i) => data[i] = el.innerHTML);
        localStorage.setItem('ze_edits', JSON.stringify(data));
        notify('השינויים נשמרו');
    });

    document.getElementById('resetEdits')?.addEventListener('click', () => {
        if (confirm('לאפס את כל השינויים?')) { localStorage.removeItem('ze_edits'); location.reload(); }
    });

    document.getElementById('exportEdits')?.addEventListener('click', () => {
        if (editing) toggleEdit();
        const blob = new Blob([document.documentElement.outerHTML], { type: 'text/html' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'zohar-elyoseph.html';
        a.click();
        notify('האתר יוצא');
    });

    // Load saved edits
    try {
        const saved = JSON.parse(localStorage.getItem('ze_edits'));
        if (saved) document.querySelectorAll(editables).forEach((el, i) => { if (saved[i]) el.innerHTML = saved[i]; });
    } catch (e) {}

    function notify(msg) {
        const n = document.createElement('div');
        n.textContent = msg;
        Object.assign(n.style, { position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)', background: '#1b4332', color: '#fff', padding: '10px 24px', borderRadius: '6px', fontSize: '.9rem', fontWeight: '500', zIndex: '100000' });
        document.body.appendChild(n);
        setTimeout(() => { n.style.opacity = '0'; n.style.transition = '.3s'; setTimeout(() => n.remove(), 300); }, 2000);
    }
});
