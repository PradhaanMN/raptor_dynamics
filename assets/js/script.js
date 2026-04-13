/* =====================================================
   RAPTOR DYNAMICS — JavaScript
   Animations, interactions, particle canvas
   ===================================================== */

'use strict';

/* ======================
   PARTICLE CANVAS
   ====================== */
(function initParticles() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let animId;
  let particles = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  resize();
  window.addEventListener('resize', resize);

  class Particle {
    constructor() {
      this.reset();
    }

    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * 1.5 + 0.3;
      this.speedX = (Math.random() - 0.5) * 0.4;
      this.speedY = (Math.random() - 0.5) * 0.4;
      this.opacity = Math.random() * 0.6 + 0.1;
      this.color = Math.random() > 0.5 ? '245,183,0' : '18,52,59';
      this.life = 0;
      this.maxLife = Math.random() * 300 + 150;
    }

    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      this.life++;

      // Fade in/out
      if (this.life < 30) {
        this.opacity = (this.life / 30) * 0.7;
      } else if (this.life > this.maxLife - 30) {
        this.opacity = ((this.maxLife - this.life) / 30) * 0.7;
      }

      if (this.life >= this.maxLife ||
          this.x < -10 || this.x > canvas.width + 10 ||
          this.y < -10 || this.y > canvas.height + 10) {
        this.reset();
      }
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this.color},${this.opacity})`;
      ctx.fill();
    }
  }

  // Init particles
  const PARTICLE_COUNT = 120;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = new Particle();
    p.life = Math.floor(Math.random() * p.maxLife); // stagger
    particles.push(p);
  }

  // Connection lines
  function drawConnections() {
    const maxDist = 100;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < maxDist) {
          const alpha = (1 - dist / maxDist) * 0.15;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(245,183,0,${alpha})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawConnections();
    particles.forEach(p => { p.update(); p.draw(); });
    animId = requestAnimationFrame(animate);
  }

  animate();

  // Pause when hero is not visible
  const heroSection = document.getElementById('home');
  if (heroSection) {
    const heroObs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          if (!animId) animate();
        } else {
          cancelAnimationFrame(animId);
          animId = null;
        }
      });
    }, { threshold: 0 });
    heroObs.observe(heroSection);
  }
})();

/* ======================
   DRONE CANVAS ANIMATION
   S-curve path · 3D perspective · real drone image
   ====================== */
(function initDroneCanvas() {
  const canvas = document.getElementById('drone-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  /* --- resize -------------------------------------------- */
  let W, H;
  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  /* --- load real drone PNG ------------------------------- */
  const droneImg = new Image();
  droneImg.src = 'assets/images/drone.png';

  /* --- S-curve waypoints (fractions of W, H) ------------- */
  // Mirrors the glowing S-curve in hero_bg.png:
  //   starts bottom-right, sweeps left up, curves back right,
  //   ends upper-right where the bg drone sits.
  const WPT = [
    [0.74, 0.88],
    [0.64, 0.74],
    [0.50, 0.62],
    [0.34, 0.52],
    [0.22, 0.41],
    [0.24, 0.30],
    [0.38, 0.22],
    [0.54, 0.18],
    [0.68, 0.16],
  ];

  /* --- Catmull-Rom interpolation ------------------------- */
  function cr(p0, p1, p2, p3, t) {
    const t2 = t*t, t3 = t2*t;
    return 0.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t2+(-p0+3*p1-3*p2+p3)*t3);
  }
  function pathAt(u) {
    const n = WPT.length - 1;
    const seg = Math.min(Math.floor(u * n), n - 1);
    const lt  = u * n - seg;
    const i0 = Math.max(seg-1, 0), i1=seg,
          i2 = Math.min(seg+1,n),  i3=Math.min(seg+2,n);
    return {
      x: cr(WPT[i0][0]*W, WPT[i1][0]*W, WPT[i2][0]*W, WPT[i3][0]*W, lt),
      y: cr(WPT[i0][1]*H, WPT[i1][1]*H, WPT[i2][1]*H, WPT[i3][1]*H, lt),
    };
  }

  /* --- state --------------------------------------------- */
  let u = 0;           // path parameter 0..1
  let dir = 1;         // ping-pong direction
  let propA = 0;       // propeller rotation
  let prevYaw = 0;
  let bankAngle = 0;   // smoothed banking
  let droneAnimId = null;
  const SPEED = 0.0022;

  /* --- spinning propeller disc overlay ------------------- */
  function drawProps(x, y, size, yaw) {
    const armR   = size * 0.38;
    const propR  = size * 0.20;
    [[1,-1],[-1,-1],[1,1],[-1,1]].forEach(function(d, i) {
      const lx =  d[0] * armR * 0.707;
      const ly =  d[1] * armR * 0.707;
      const wx = x + lx*Math.cos(yaw) - ly*Math.sin(yaw);
      const wy = y + lx*Math.sin(yaw) + ly*Math.cos(yaw);
      const spin = propA * (i%2===0 ? 1 : -1);
      ctx.save();
      ctx.translate(wx, wy);
      ctx.rotate(spin);
      // blur disc
      const g = ctx.createRadialGradient(0,0,1,0,0,propR);
      g.addColorStop(0,   'rgba(160,220,255,0.55)');
      g.addColorStop(0.5, 'rgba(80,170,255,0.20)');
      g.addColorStop(1,   'rgba(0,140,255,0)');
      ctx.beginPath(); ctx.arc(0,0,propR,0,Math.PI*2);
      ctx.fillStyle = g; ctx.fill();
      // 2 blades
      for (let b=0;b<2;b++) {
        ctx.save(); ctx.rotate(b*Math.PI/2);
        ctx.beginPath();
        ctx.ellipse(0,0, propR*0.85, propR*0.18, 0, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(180,230,255,0.45)';
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    });
  }

  /* --- altitude shadow ----------------------------------- */
  function drawShadow(x, y, size) {
    // faint ellipse below, shrinks and fades with altitude
    const groundY = H * 0.93;
    const dist    = Math.max(0, groundY - y);
    const sW      = size * 0.55 * Math.max(0, 1 - dist/(H*0.8));
    if (sW < 3) return;
    ctx.save();
    ctx.translate(x + dist*0.05, groundY);
    ctx.beginPath();
    ctx.ellipse(0, 0, sW, sW*0.18, 0, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fill();
    ctx.restore();
  }

  /* --- subtle env glow beneath drone --------------------- */
  function drawGlow(x, y, size) {
    const g = ctx.createRadialGradient(x, y, size*0.1, x, y, size*0.9);
    g.addColorStop(0, 'rgba(0,200,255,0.12)');
    g.addColorStop(1, 'rgba(0,200,255,0)');
    ctx.beginPath(); ctx.arc(x, y, size*0.9, 0, Math.PI*2);
    ctx.fillStyle = g; ctx.fill();
  }

  /* --- main loop ----------------------------------------- */
  function animate() {
    ctx.clearRect(0, 0, W, H);
    propA += 0.38;

    // advance path
    u += SPEED * dir;
    if (u >= 1) { u = 1; dir = -1; }
    if (u <= 0) { u = 0; dir =  1; }

    const pos  = pathAt(u);
    const posN = pathAt(Math.min(Math.max(u + 0.004*dir, 0), 1));

    // yaw = direction of travel
    const yaw = Math.atan2(posN.y - pos.y, posN.x - pos.x) + Math.PI*0.5;

    // banking: smooth the turn-rate into a roll angle
    let rawBank = yaw - prevYaw;
    // Wrap to [-PI, PI]
    if (rawBank >  Math.PI) rawBank -= Math.PI*2;
    if (rawBank < -Math.PI) rawBank += Math.PI*2;
    bankAngle += (rawBank * 18 - bankAngle) * 0.12; // smoothed
    bankAngle  = Math.max(-0.55, Math.min(0.55, bankAngle));
    prevYaw    = yaw;

    // perspective scale: larger near bottom (closer), smaller near top
    const yFrac  = Math.max(0, Math.min(1, (pos.y/H - 0.10) / 0.80));
    const size   = 72 + yFrac * 88;          // 72px at top → 160px at bottom
    const alpha  = 0.62 + yFrac * 0.38;      // slightly more opaque when closer

    drawGlow(pos.x, pos.y, size);
    drawShadow(pos.x, pos.y, size);

    if (droneImg.complete && droneImg.naturalWidth > 0) {
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(yaw);
      // banking roll: compress along arm axis
      ctx.transform(1, 0, Math.sin(bankAngle)*0.55, Math.cos(bankAngle*0.4), 0, 0);
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = alpha;
      ctx.drawImage(droneImg, -size/2, -size/2, size, size);
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    // prop overlay in world space (after restore, no blend mode)
    drawProps(pos.x, pos.y, size, yaw);

    droneAnimId = requestAnimationFrame(animate);
  }

  /* --- visibility observer ------------------------------- */
  const hero = document.getElementById('home');
  if (hero) {
    new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        if (e.isIntersecting) { if (!droneAnimId) animate(); }
        else { cancelAnimationFrame(droneAnimId); droneAnimId = null; }
      });
    }, { threshold: 0 }).observe(hero);
  }

  droneImg.onload = function() { if (!droneAnimId) animate(); };
  if (droneImg.complete && droneImg.naturalWidth > 0) animate();
})();


/* ======================
   NAVBAR SCROLL
   ====================== */
(function initNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  function onScroll() {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

/* ======================
   ACTIVE NAV LINK
   ====================== */
(function initActiveNav() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');
  if (!sections.length || !navLinks.length) return;

  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === '#' + entry.target.id) {
            link.classList.add('active');
          }
        });
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });

  sections.forEach(s => obs.observe(s));
})();

/* ======================
   MOBILE HAMBURGER
   ====================== */
(function initHamburger() {
  const btn = document.getElementById('hamburger-btn');
  const links = document.getElementById('nav-links');
  if (!btn || !links) return;

  btn.addEventListener('click', () => {
    const isOpen = links.classList.toggle('open');
    btn.classList.toggle('active');
    btn.setAttribute('aria-expanded', isOpen);
  });

  // Close on link click
  links.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      links.classList.remove('open');
      btn.classList.remove('active');
      btn.setAttribute('aria-expanded', false);
    });
  });
})();

/* ======================
   COUNTER ANIMATION
   ====================== */
(function initCounters() {
  const counters = document.querySelectorAll('.stat-num[data-target]');
  if (!counters.length) return;

  let started = false;

  function animateCounter(el) {
    const target = parseInt(el.dataset.target, 10);
    const duration = 1800;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current = Math.min(Math.round(increment * step), target);
      el.textContent = current;
      if (current >= target) clearInterval(timer);
    }, duration / steps);
  }

  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !started) {
        started = true;
        counters.forEach(c => animateCounter(c));
      }
    });
  }, { threshold: 0.5 });

  const statsEl = document.querySelector('.hero-stats');
  if (statsEl) obs.observe(statsEl);
})();

/* ======================
   SCROLL REVEAL
   ====================== */
(function initReveal() {
  const addRevealClasses = () => {
    // About section
    const aboutText = document.querySelector('.about-text');
    const aboutVisual = document.querySelector('.about-visual');
    if (aboutText) aboutText.classList.add('reveal-left');
    if (aboutVisual) aboutVisual.classList.add('reveal-right');

    // VM cards
    document.querySelectorAll('.vm-card').forEach((el, i) => {
      el.classList.add('reveal');
      el.style.transitionDelay = `${i * 0.15}s`;
    });

    // Project cards
    document.querySelectorAll('.project-card').forEach((el, i) => {
      el.classList.add('reveal');
      el.style.transitionDelay = `${(i % 3) * 0.1}s`;
    });

    // Systems / impact / execution cards
    document.querySelectorAll('.approach-card').forEach((el, i) => {
      el.classList.add('reveal');
      el.style.transitionDelay = `${(i % 3) * 0.1}s`;
    });

    // Event items
    document.querySelectorAll('.event-item').forEach((el, i) => {
      el.classList.add('reveal');
      el.style.transitionDelay = `${i * 0.1}s`;
    });

    // Team cards
    document.querySelectorAll('.team-card').forEach((el, i) => {
      el.classList.add('reveal');
      el.style.transitionDelay = `${(i % 3) * 0.12}s`;
    });

    // Section headers
    document.querySelectorAll('.section-header').forEach(el => {
      el.classList.add('reveal');
    });

    // Events featured
    const eventsFeatured = document.querySelector('.events-featured');
    if (eventsFeatured) eventsFeatured.classList.add('reveal-left');

    // Events list
    const eventsList = document.querySelector('.events-list');
    if (eventsList) eventsList.classList.add('reveal-right');

    // Join info
    const joinInfo = document.querySelector('.join-info');
    const joinForm = document.querySelector('.join-form-wrap');
    if (joinInfo) joinInfo.classList.add('reveal-left');
    if (joinForm) joinForm.classList.add('reveal-right');
  };

  addRevealClasses();

  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

  document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(el => {
    obs.observe(el);
  });
})();

/* ======================
   JOIN FORM
   ====================== */
(function initForm() {
  const form = document.getElementById('join-form');
  const successEl = document.getElementById('form-success');
  const submitBtn = document.getElementById('join-submit-btn');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    // Basic validation
    const name = document.getElementById('join-name');
    const email = document.getElementById('join-email');

    if (!name.value.trim()) {
      name.style.borderColor = '#ff2d55';
      name.focus();
      setTimeout(() => name.style.borderColor = '', 2000);
      return;
    }

    if (!email.value.trim() || !email.value.includes('@')) {
      email.style.borderColor = '#ff2d55';
      email.focus();
      setTimeout(() => email.style.borderColor = '', 2000);
      return;
    }

    // Simulate submission
    const btnSpan = submitBtn.querySelector('span');
    const originalText = btnSpan.textContent;
    btnSpan.textContent = 'Submitting...';
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.7';

    setTimeout(() => {
      btnSpan.textContent = originalText;
      submitBtn.disabled = false;
      submitBtn.style.opacity = '';

      if (successEl) {
        successEl.classList.add('visible');
        setTimeout(() => successEl.classList.remove('visible'), 5000);
      }

      form.reset();
    }, 1800);
  });
})();

/* ======================
   BACK TO TOP
   ====================== */
(function initBackToTop() {
  const btn = document.getElementById('back-to-top-btn');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 500) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();

/* ======================
   SMOOTH ANCHOR SCROLL
   ====================== */
(function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const navHeight = document.getElementById('navbar')?.offsetHeight || 72;
        const top = target.getBoundingClientRect().top + window.scrollY - navHeight;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });
})();

/* ======================
   CURSOR GLOW EFFECT
   ====================== */
(function initCursorGlow() {
  // Only on non-touch devices
  if (window.matchMedia('(hover: none)').matches) return;

  const glow = document.createElement('div');
  glow.style.cssText = `
    position: fixed;
    width: 300px;
    height: 300px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(245,183,0,0.04) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
    transform: translate(-50%, -50%);
    transition: opacity 0.3s ease;
    opacity: 0;
  `;
  document.body.appendChild(glow);

  document.addEventListener('mousemove', e => {
    glow.style.left = e.clientX + 'px';
    glow.style.top = e.clientY + 'px';
    glow.style.opacity = '1';
  });

  document.addEventListener('mouseleave', () => {
    glow.style.opacity = '0';
  });
})();

/* ======================
   TYPING EFFECT FOR HERO TAGLINE
   ====================== */
(function initTypingEffect() {
  const tagline = document.querySelector('.hero-tagline');
  if (!tagline) return;

  const text = tagline.textContent.trim();
  tagline.textContent = '';
  tagline.style.borderRight = '2px solid rgba(245,183,0,0.7)';

  let i = 0;
  const delay = 800; // start after hero fade-in

  setTimeout(() => {
    const interval = setInterval(() => {
      if (i < text.length) {
        tagline.textContent += text.charAt(i);
        i++;
      } else {
        clearInterval(interval);
        // Remove cursor after typing
        setTimeout(() => {
          tagline.style.borderRight = 'none';
        }, 1200);
      }
    }, 55);
  }, delay);
})();

/* ======================
   TILT EFFECT ON CARDS
   ====================== */
(function initTiltEffect() {
  if (window.matchMedia('(hover: none)').matches) return;

  const cards = document.querySelectorAll('.project-card, .vm-card, .team-card');

  cards.forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);

      const maxTilt = 6;
      const tiltX = dy * maxTilt * -1;
      const tiltY = dx * maxTilt;

      card.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(-6px)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
})();

/* ======================
   DYNAMIC GRID LINES (hero)
   ====================== */
(function initHeroGrid() {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  const grid = document.createElement('div');
  grid.style.cssText = `
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    background-image:
      linear-gradient(rgba(245,183,0,0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(245,183,0,0.025) 1px, transparent 1px);
    background-size: 60px 60px;
    mask-image: radial-gradient(ellipse 80% 60% at 50% 50%, black 0%, transparent 75%);
    -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 50%, black 0%, transparent 75%);
  `;

  hero.appendChild(grid);
})();

/* ======================
   CMS CONTENT (TEAM PHOTOS + EVENTS)
   ====================== */
(function initCmsContent() {
  const eventsContainer = document.getElementById('events-public-list');
  const eventsPlaceholder = document.getElementById('events-placeholder');

  function getRepoBasePath() {
    // GitHub project pages are served under /<repo-name>/, not from domain root.
    if (!window.location.hostname.endsWith('github.io')) {
      return '';
    }

    const segments = window.location.pathname.split('/').filter(Boolean);
    return segments.length ? `/${segments[0]}` : '';
  }

  function resolvePublicPath(value) {
    if (!value) return '';

    if (/^(https?:)?\/\//i.test(value)) {
      return value;
    }

    const repoBase = getRepoBasePath();
    const normalized = String(value).replace(/^\/+/, '');

    if (repoBase) {
      const repoBaseNoSlash = repoBase.replace(/^\/+/, '');
      if (normalized.startsWith(repoBaseNoSlash + '/')) {
        return `/${normalized}`;
      }
    }

    return `${repoBase}/${normalized}`;
  }

  function buildPhotoCandidates(photoUrl) {
    if (!photoUrl) return [];

    if (/^(https?:)?\/\//i.test(photoUrl)) {
      return [photoUrl];
    }

    const repoBase = getRepoBasePath();
    const normalized = String(photoUrl).replace(/^\/+/, '');
    const candidates = new Set();

    candidates.add(resolvePublicPath(photoUrl));
    candidates.add('/' + normalized);
    candidates.add(normalized);

    if (repoBase) {
      candidates.add(`${repoBase}/${normalized}`);
    }

    return Array.from(candidates).filter(Boolean);
  }

  function setImageWithFallback(image, photoUrl) {
    const candidates = buildPhotoCandidates(photoUrl);
    if (!candidates.length) return;

    let index = 0;
    const stamp = Date.now();

    const setNext = () => {
      if (index >= candidates.length) {
        image.onerror = null;
        return;
      }

      const candidate = candidates[index++];
      const separator = candidate.includes('?') ? '&' : '?';
      image.src = `${candidate}${separator}v=${stamp}`;
    };

    image.onerror = setNext;
    setNext();
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function applyTeamPhotos(teamPhotos) {
    if (!teamPhotos || typeof teamPhotos !== 'object') return;

    Object.entries(teamPhotos).forEach(([teamId, photoUrl]) => {
      if (!photoUrl) return;

      const card = document.getElementById(teamId);
      const avatar = card?.querySelector('.team-avatar');
      if (!avatar) return;

      const personName = card.querySelector('.team-info h3')?.textContent?.trim() || 'Team member';

      let image = avatar.querySelector('img.team-photo');
      if (!image) {
        avatar.innerHTML = '';
        image = document.createElement('img');
        image.className = 'team-photo';
        avatar.appendChild(image);
      }

      avatar.dataset.hasPhoto = 'true';
      image.alt = `${personName} photo`;
      setImageWithFallback(image, photoUrl);
    });
  }

  function renderEvents(events) {
    if (!eventsContainer) return;

    if (!Array.isArray(events) || !events.length) {
      eventsContainer.innerHTML = '';
      if (eventsPlaceholder) eventsPlaceholder.hidden = false;
      return;
    }

    if (eventsPlaceholder) eventsPlaceholder.hidden = true;

    eventsContainer.innerHTML = events.map((event) => {
      const title = escapeHtml(event.title || 'Untitled Event');
      const type = escapeHtml(event.type || 'Club Event');
      const description = escapeHtml(event.description || 'Details will be shared soon.');
      const dateLabel = event.date ? `<p class="event-live-date">${escapeHtml(formatDate(event.date))}</p>` : '';
      const resolvedEventPhotoUrl = resolvePublicPath(event.photoUrl);
      const media = event.photoUrl
        ? `<img src="${escapeHtml(resolvedEventPhotoUrl)}?v=${Date.now()}" alt="${title}" loading="lazy" />`
        : '<div class="event-live-media-placeholder">Photo Updating Soon</div>';

      return `
        <article class="event-live-card">
          <div class="event-live-media">${media}</div>
          <div class="event-live-body">
            <span class="event-type">${type}</span>
            <h3>${title}</h3>
            ${dateLabel}
            <p>${description}</p>
          </div>
        </article>
      `;
    }).join('');
  }

  const applyContent = (content) => {
    applyTeamPhotos(content && content.teamPhotos);
    renderEvents(content && content.events);
  };

  fetch(`${resolvePublicPath('/api/public/content')}`, { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) {
        throw new Error('CMS backend not reachable');
      }
      return response.json();
    })
    .then(applyContent)
    .catch(() => {
      // Static hosting fallback: read committed CMS snapshot.
      fetch(resolvePublicPath('data/cms.json'), { cache: 'no-store' })
        .then((response) => {
          if (!response.ok) {
            throw new Error('No static CMS snapshot');
          }
          return response.json();
        })
        .then(applyContent)
        .catch(() => {
          // Keep static fallback content when no CMS source is available.
          if (eventsPlaceholder) eventsPlaceholder.hidden = false;
        });
    });
})();

console.log('%c✈ RAPTOR DYNAMICS — Built for the Sky', 'color:#F5B700;font-family:monospace;font-size:14px;font-weight:bold;');

