(function () {
  'use strict';

  const navbar = document.getElementById('landing-nav');
  const mobileToggle = document.getElementById('mobile-toggle');
  const navLinks = document.getElementById('nav-links');
  const themeToggle = document.getElementById('landing-theme-toggle');

  // ─── Navbar scroll effect ───
  window.addEventListener('scroll', function () {
    navbar.classList.toggle('scrolled', window.scrollY > 60);
  });

  // ─── Mobile nav toggle ───
  mobileToggle.addEventListener('click', function () {
    navLinks.classList.toggle('open');
    mobileToggle.innerHTML = navLinks.classList.contains('open')
      ? '<i class="fas fa-times"></i>'
      : '<i class="fas fa-bars"></i>';
  });

  // Close mobile nav on link click
  navLinks.querySelectorAll('.landing-nav-link').forEach(function (link) {
    link.addEventListener('click', function () {
      navLinks.classList.remove('open');
      mobileToggle.innerHTML = '<i class="fas fa-bars"></i>';
    });
  });

  // ─── Theme toggle ───
  themeToggle.addEventListener('click', function () {
    document.body.classList.toggle('light-mode');
    var isLight = document.body.classList.contains('light-mode');
    themeToggle.innerHTML = isLight ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    localStorage.setItem('asl_theme', isLight ? 'light' : 'dark');
  });

  if (localStorage.getItem('asl_theme') === 'light') {
    document.body.classList.add('light-mode');
    themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
  }

  // ─── Smooth scroll for anchor links ───
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ─── Particles Background ───
  (function initParticles() {
    var container = document.getElementById('particles');
    if (!container) return;
    for (var i = 0; i < 40; i++) {
      var dot = document.createElement('div');
      dot.className = 'particle-dot';
      dot.style.left = Math.random() * 100 + '%';
      dot.style.top = Math.random() * 100 + '%';
      dot.style.width = dot.style.height = (Math.random() * 3 + 1) + 'px';
      dot.style.animationDelay = (Math.random() * 8) + 's';
      dot.style.animationDuration = (Math.random() * 6 + 4) + 's';
      container.appendChild(dot);
    }
  })();

  // ─── Render ASL Alphabet Grid with Hand Poses ───
  (function renderAlphabetGrid() {
    var grid = document.getElementById('landing-alphabet-grid');
    if (!grid || typeof HAND_POSES === 'undefined') return;
    var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    grid.innerHTML = letters.map(function (l) {
      return '<div class="landing-alphabet-card glass" data-letter="' + l + '">' +
        '<img src="reference/asl_' + l.toLowerCase() + '.png" alt="' + l + '" class="landing-alphabet-img" loading="lazy">' +
        '<div class="alphabet-letter">' + l + '</div>' +
        '</div>';
    }).join('');
    // re-query and observe after render
    setTimeout(function () {
      grid.querySelectorAll('.landing-alphabet-card').forEach(function (el) { cardObserver.observe(el); });
    }, 0);
  })();

  // ─── Counter Animation (Intersection Observer) ───
  function animateCounter(el) {
    var target = parseInt(el.getAttribute('data-target'), 10);
    if (isNaN(target)) return;
    var suffix = '';
    if (el.closest('.landing-hero-stats')) suffix = target >= 96 ? '%' : '+';
    var duration = 2000;
    var start = performance.now();
    function step(now) {
      var p = Math.min((now - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var val = Math.round(eased * target);
      el.textContent = val.toLocaleString() + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  var counterObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        var el = entry.target;
        animateCounter(el);
        counterObserver.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('.hero-stat-num, .counter-num').forEach(function (el) {
    counterObserver.observe(el);
  });

  // ─── Feature card staggered reveal ───
  var cardObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        cardObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  document.querySelectorAll('.landing-feature-card, .landing-step, .landing-model-card').forEach(function (el) {
    cardObserver.observe(el);
  });

  // ─── Section reveal on scroll ───
  var sectionObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('section-visible');
        sectionObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.landing-section').forEach(function (el) {
    sectionObserver.observe(el);
  });

  // ─── Contact Neural Network Canvas ───
  (function initNeuralCanvas() {
    var canvas = document.getElementById('neural-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var W, H, nodes = [], edges = [];
    var nodeCount = 28;
    var animId;

    function resize() {
      var container = document.getElementById('contact-neural-bg');
      if (!container) return;
      W = container.offsetWidth;
      H = container.offsetHeight;
      canvas.width = W; canvas.height = H;
    }

    function createNodes() {
      nodes = [];
      for (var i = 0; i < nodeCount; i++) {
        nodes.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          r: Math.random() * 2 + 1.5
        });
      }
    }

    function createEdges() {
      edges = [];
      for (var i = 0; i < nodes.length; i++) {
        for (var j = i + 1; j < nodes.length; j++) {
          var dx = nodes[i].x - nodes[j].x;
          var dy = nodes[i].y - nodes[j].y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 200) edges.push({ a: i, b: j });
        }
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      var isLight = document.body.classList.contains('light-mode');

      // Draw edges
      for (var e = 0; e < edges.length; e++) {
        var a = nodes[edges[e].a];
        var b = nodes[edges[e].b];
        var dx = a.x - b.x;
        var dy = a.y - b.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 200) continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = isLight
          ? 'rgba(8,145,178,' + (0.08 * (1 - dist / 200)) + ')'
          : 'rgba(0,242,255,' + (0.12 * (1 - dist / 200)) + ')';
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }

      // Draw nodes
      for (var n = 0; n < nodes.length; n++) {
        var node = nodes[n];
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        ctx.fillStyle = isLight ? 'rgba(8,145,178,0.3)' : 'rgba(0,242,255,0.35)';
        ctx.fill();
        // glow
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r * 3, 0, Math.PI * 2);
        ctx.fillStyle = isLight ? 'rgba(8,145,178,0.04)' : 'rgba(0,242,255,0.06)';
        ctx.fill();
      }

      // Move nodes
      for (var m = 0; m < nodes.length; m++) {
        var nd = nodes[m];
        nd.x += nd.vx;
        nd.y += nd.vy;
        if (nd.x < 0 || nd.x > W) nd.vx *= -1;
        if (nd.y < 0 || nd.y > H) nd.vy *= -1;
      }

      animId = requestAnimationFrame(draw);
    }

    function initNet() {
      if (typeof W === 'undefined' || W === 0) {
        resize();
        if (W === 0) { setTimeout(initNet, 200); return; }
      }
      createNodes();
      createEdges();
      draw();
    }

    window.addEventListener('resize', function () {
      resize();
      createNodes();
      createEdges();
    });

    // Theme change watcher
    var contactThemeObserver = new MutationObserver(function () {
      // canvas redraws each frame, picks up current theme
    });
    var contactSection = document.getElementById('contact');
    if (contactSection) {
      contactThemeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    initNet();
  })();

  // ─── Contact Form Handler ───
  (function initContactForm() {
    var form = document.getElementById('contact-form');
    if (!form) return;
    var btn = document.getElementById('contact-submit');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (btn.classList.contains('loading') || btn.classList.contains('success')) return;

      var name = document.getElementById('cf-name').value.trim();
      var email = document.getElementById('cf-email').value.trim();
      var subject = document.getElementById('cf-subject').value.trim();
      var message = document.getElementById('cf-message').value.trim();

      if (!name || !email || !subject || !message) {
        var firstEmpty = form.querySelector('.contact-input:invalid');
        if (firstEmpty) firstEmpty.focus();
        return;
      }

      btn.classList.add('loading');

      setTimeout(function () {
        btn.classList.remove('loading');
        btn.classList.add('success');
        setTimeout(function () {
          btn.classList.remove('success');
          form.reset();
        }, 2500);
      }, 1800);
    });
  })();

  // ─── Contact cards scroll reveal ───
  (function initContactReveal() {
    var contactObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          contactObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.contact-card').forEach(function (el, i) {
      el.style.transitionDelay = (i * 0.08) + 's';
      contactObserver.observe(el);
    });
    document.querySelectorAll('.contact-social, .contact-form-col, .contact-actions').forEach(function (el) {
      contactObserver.observe(el);
    });
  })();

})();