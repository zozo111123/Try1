/* =============================================
   Prof. Zohar Elyoseph - Academic Website
   JavaScript Interactions & Edit Mode
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {
    // =============================================
    // Navigation
    // =============================================
    const navbar = document.getElementById('navbar');
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.getElementById('navMenu');
    const navLinks = document.querySelectorAll('.nav-link');

    // Scroll effect
    window.addEventListener('scroll', () => {
        if (window.scrollY > 80) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }

        // Active nav link
        const sections = document.querySelectorAll('section[id]');
        const scrollPos = window.scrollY + 200;
        sections.forEach(section => {
            const top = section.offsetTop;
            const height = section.offsetHeight;
            const id = section.getAttribute('id');
            const link = document.querySelector(`.nav-link[href="#${id}"]`);
            if (link) {
                if (scrollPos >= top && scrollPos < top + height) {
                    link.classList.add('active');
                } else {
                    link.classList.remove('active');
                }
            }
        });
    });

    // Mobile menu toggle
    navToggle.addEventListener('click', () => {
        navMenu.classList.toggle('open');
        navToggle.classList.toggle('active');
    });

    // Close mobile menu on link click
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('open');
            navToggle.classList.remove('active');
        });
    });

    // =============================================
    // Hero Particles
    // =============================================
    const particlesContainer = document.getElementById('particles');
    if (particlesContainer) {
        for (let i = 0; i < 30; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.width = particle.style.height = (Math.random() * 4 + 2) + 'px';
            particle.style.animationDuration = (Math.random() * 15 + 10) + 's';
            particle.style.animationDelay = (Math.random() * 10) + 's';
            particlesContainer.appendChild(particle);
        }
    }

    // =============================================
    // Counter Animation
    // =============================================
    const counters = document.querySelectorAll('.stat-number');
    let countersAnimated = false;

    function animateCounters() {
        if (countersAnimated) return;
        counters.forEach(counter => {
            const target = parseInt(counter.getAttribute('data-target'));
            const duration = 2000;
            const startTime = performance.now();

            function updateCounter(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic
                const current = Math.floor(eased * target);
                counter.textContent = current.toLocaleString();
                if (progress < 1) {
                    requestAnimationFrame(updateCounter);
                } else {
                    counter.textContent = target.toLocaleString();
                }
            }
            requestAnimationFrame(updateCounter);
        });
        countersAnimated = true;
    }

    // Trigger counters when hero is in view
    const heroObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                setTimeout(animateCounters, 500);
            }
        });
    }, { threshold: 0.3 });

    const heroStats = document.querySelector('.hero-stats');
    if (heroStats) heroObserver.observe(heroStats);

    // =============================================
    // Scroll Reveal
    // =============================================
    const revealElements = document.querySelectorAll(
        '.research-card, .media-card, .pub-card, .affiliation-card, .contact-card, .contact-links'
    );

    revealElements.forEach(el => el.classList.add('reveal'));

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    revealElements.forEach(el => revealObserver.observe(el));

    // =============================================
    // Publication Filters
    // =============================================
    const pubFilters = document.querySelectorAll('.pub-filter');
    const pubCards = document.querySelectorAll('.pub-card');

    pubFilters.forEach(filter => {
        filter.addEventListener('click', () => {
            const category = filter.getAttribute('data-filter');

            pubFilters.forEach(f => f.classList.remove('active'));
            filter.classList.add('active');

            pubCards.forEach(card => {
                if (category === 'all' || card.getAttribute('data-category') === category) {
                    card.classList.remove('hidden');
                    card.style.animation = 'none';
                    card.offsetHeight; // Trigger reflow
                    card.style.animation = 'fadeInUp 0.5s ease';
                } else {
                    card.classList.add('hidden');
                }
            });
        });
    });

    // =============================================
    // Quotes Carousel
    // =============================================
    const quoteCards = document.querySelectorAll('.quote-card');
    const quoteDots = document.getElementById('quoteDots');
    let currentQuote = 0;
    let quoteInterval;

    // Create dots
    if (quoteDots && quoteCards.length > 0) {
        quoteCards.forEach((_, i) => {
            const dot = document.createElement('div');
            dot.className = 'quote-dot' + (i === 0 ? ' active' : '');
            dot.addEventListener('click', () => showQuote(i));
            quoteDots.appendChild(dot);
        });

        function showQuote(index) {
            quoteCards.forEach(card => card.classList.remove('active'));
            document.querySelectorAll('.quote-dot').forEach(dot => dot.classList.remove('active'));
            quoteCards[index].classList.add('active');
            document.querySelectorAll('.quote-dot')[index].classList.add('active');
            currentQuote = index;
        }

        function nextQuote() {
            currentQuote = (currentQuote + 1) % quoteCards.length;
            showQuote(currentQuote);
        }

        quoteInterval = setInterval(nextQuote, 5000);

        // Pause on hover
        const quotesSection = document.querySelector('.quotes-section');
        if (quotesSection) {
            quotesSection.addEventListener('mouseenter', () => clearInterval(quoteInterval));
            quotesSection.addEventListener('mouseleave', () => {
                quoteInterval = setInterval(nextQuote, 5000);
            });
        }
    }

    // =============================================
    // Smooth Scroll for anchor links
    // =============================================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const offset = navbar.offsetHeight + 10;
                const targetPos = target.getBoundingClientRect().top + window.scrollY - offset;
                window.scrollTo({ top: targetPos, behavior: 'smooth' });
            }
        });
    });

    // =============================================
    // Edit Mode
    // =============================================
    const editModeBtn = document.getElementById('editModeBtn');
    const editPanel = document.getElementById('editPanel');
    const editPanelClose = document.getElementById('editPanelClose');
    const saveEditsBtn = document.getElementById('saveEdits');
    const resetEditsBtn = document.getElementById('resetEdits');
    const exportEditsBtn = document.getElementById('exportEdits');
    let editMode = false;

    const editableSelectors = [
        '.hero-title', '.hero-tagline', '.hero-subtitle', '.hero-name-en',
        '.about-text', '.section-title', '.section-subtitle',
        '.research-card h3', '.research-card p',
        '.media-card h3', '.media-card p',
        '.pub-summary-he p', '.pub-title',
        '.contact-card h3', '.contact-card p',
        '.quote-card blockquote p'
    ];

    function toggleEditMode() {
        editMode = !editMode;
        document.body.classList.toggle('edit-mode', editMode);
        editPanel.classList.toggle('show', editMode);

        document.querySelectorAll(editableSelectors.join(', ')).forEach(el => {
            el.contentEditable = editMode ? 'true' : 'false';
        });

        editModeBtn.innerHTML = editMode
            ? '<i class="fas fa-times"></i>'
            : '<i class="fas fa-pen"></i>';
    }

    if (editModeBtn) editModeBtn.addEventListener('click', toggleEditMode);
    if (editPanelClose) editPanelClose.addEventListener('click', toggleEditMode);

    // Save edits to localStorage
    if (saveEditsBtn) {
        saveEditsBtn.addEventListener('click', () => {
            const edits = {};
            document.querySelectorAll(editableSelectors.join(', ')).forEach((el, i) => {
                edits[`edit_${i}`] = el.innerHTML;
            });
            localStorage.setItem('zohar_site_edits', JSON.stringify(edits));
            showNotification('השינויים נשמרו בהצלחה!');
        });
    }

    // Reset edits
    if (resetEditsBtn) {
        resetEditsBtn.addEventListener('click', () => {
            if (confirm('האם אתה בטוח שברצונך לאפס את כל השינויים?')) {
                localStorage.removeItem('zohar_site_edits');
                location.reload();
            }
        });
    }

    // Export HTML
    if (exportEditsBtn) {
        exportEditsBtn.addEventListener('click', () => {
            // Temporarily disable edit mode for clean export
            const wasEditMode = editMode;
            if (wasEditMode) toggleEditMode();

            const html = document.documentElement.outerHTML;
            const blob = new Blob([html], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'zohar-elyoseph-website.html';
            a.click();
            URL.revokeObjectURL(url);

            if (wasEditMode) toggleEditMode();
            showNotification('האתר יוצא בהצלחה!');
        });
    }

    // Load saved edits
    const savedEdits = localStorage.getItem('zohar_site_edits');
    if (savedEdits) {
        try {
            const edits = JSON.parse(savedEdits);
            document.querySelectorAll(editableSelectors.join(', ')).forEach((el, i) => {
                if (edits[`edit_${i}`] !== undefined) {
                    el.innerHTML = edits[`edit_${i}`];
                }
            });
        } catch (e) {
            console.warn('Failed to load saved edits:', e);
        }
    }

    // Notification helper
    function showNotification(message) {
        const notif = document.createElement('div');
        notif.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: #10b981;
            color: white;
            padding: 12px 28px;
            border-radius: 30px;
            font-size: 0.95rem;
            font-weight: 500;
            z-index: 100000;
            box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4);
            animation: slideDown 0.3s ease;
        `;
        notif.textContent = message;
        document.body.appendChild(notif);
        setTimeout(() => {
            notif.style.opacity = '0';
            notif.style.transition = 'opacity 0.3s ease';
            setTimeout(() => notif.remove(), 300);
        }, 2500);
    }

    // Add slideDown animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideDown {
            from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
            to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
});
