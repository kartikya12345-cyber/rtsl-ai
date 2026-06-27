document.addEventListener('DOMContentLoaded', () => {
    const authForm = document.getElementById('auth-form');
    const btnText = document.getElementById('btn-text');
    const btnIcon = document.getElementById('btn-icon');
    const toggleLink = document.getElementById('toggle-link');
    const toggleText = document.getElementById('toggle-text');
    const authBtn = document.getElementById('auth-btn');
    const toastContainer = document.getElementById('toast-container');
    const passwordInput = document.getElementById('password');
    const togglePw = document.getElementById('toggle-pw');
    const toggleCpw = document.getElementById('toggle-cpw');
    const confirmInput = document.getElementById('confirm-password');
    const confirmGroup = document.getElementById('confirm-group');
    const usernameGroup = document.getElementById('username-group');
    const emailGroup = document.getElementById('email-group');
    const emailInput = document.getElementById('email');
    const usernameInput = document.getElementById('username');
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');
    const forgotRow = document.getElementById('forgot-row');
    const strengthEl = document.getElementById('password-strength');
    const strengthFill = document.getElementById('strength-fill');
    const strengthText = document.getElementById('strength-text');
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    const tabUsername = document.getElementById('tab-username');
    const tabEmail = document.getElementById('tab-email');

    let isLogin = true;
    let activeTab = 'username';
    let isSubmitting = false;

    const API = '';

    initTheme();

    togglePw.addEventListener('click', () => togglePassword(passwordInput, togglePw));
    toggleCpw.addEventListener('click', () => togglePassword(confirmInput, toggleCpw));

    tabUsername.addEventListener('click', () => setTab('username'));
    tabEmail.addEventListener('click', () => setTab('email'));

    if (passwordInput) {
        passwordInput.addEventListener('input', () => {
            if (!isLogin) updatePasswordStrength(passwordInput.value);
        });
    }

    toggleLink.addEventListener('click', (e) => {
        e.preventDefault();
        isLogin = !isLogin;
        updateMode();
    });

    themeToggle.addEventListener('click', toggleTheme);

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        const username = usernameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        const confirmVal = confirmInput.value.trim();

        if (isLogin) {
            const identifier = activeTab === 'username' ? username : email;
            if (!identifier || !password) {
                showToast('Please fill all fields', 'error');
                return;
            }
            await handleLogin(identifier, password);
        } else {
            if (!username || !email || !password || !confirmVal) {
                showToast('Please fill all fields', 'error');
                return;
            }
            if (password.length < 6) {
                showToast('Password must be at least 6 characters', 'error');
                return;
            }
            if (!/[A-Z]/.test(password)) {
                showToast('Password must contain at least one uppercase letter', 'error');
                return;
            }
            if (!/[a-z]/.test(password)) {
                showToast('Password must contain at least one lowercase letter', 'error');
                return;
            }
            if (!/[0-9]/.test(password)) {
                showToast('Password must contain at least one digit', 'error');
                return;
            }
            if (password !== confirmVal) {
                showToast('Passwords do not match', 'error');
                return;
            }
            await handleSignup(username, email, password);
        }
    });

    async function handleLogin(identifier, password) {
        setLoading(true);
        try {
            const res = await fetch(`${API}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: identifier, password })
            });
            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('asl_user', JSON.stringify(data));
                showToast('Login Successful!');
                setTimeout(() => { window.location.href = 'dashboard.html'; }, 1200);
            } else {
                showToast(data.detail || 'Invalid username or password', 'error');
            }
        } catch (err) {
            showToast('Connection error. Is the server running?', 'error');
        } finally {
            setLoading(false);
        }
    }

    async function handleSignup(username, email, password) {
        setLoading(true);
        try {
            const res = await fetch(`${API}/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });
            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('asl_user', JSON.stringify(data));
                showToast('Account Created Successfully!');
                setTimeout(() => { window.location.href = 'dashboard.html'; }, 1200);
            } else {
                showToast(data.detail || 'Signup failed', 'error');
            }
        } catch (err) {
            showToast('Connection error. Is the server running?', 'error');
        } finally {
            setLoading(false);
        }
    }

    function setLoading(loading) {
        isSubmitting = loading;
        if (loading) {
            authBtn.classList.add('btn-loading');
            authBtn.innerHTML = '<span class="spinner" style="width:22px;height:22px;border-width:2.5px;display:inline-block"></span>';
        } else {
            authBtn.classList.remove('btn-loading');
            updateBtnContent();
        }
    }

    function togglePassword(input, btn) {
        if (!input) return;
        const type = input.type === 'password' ? 'text' : 'password';
        input.type = type;
        btn.innerHTML = type === 'password' ? '<i class="far fa-eye"></i>' : '<i class="far fa-eye-slash"></i>';
    }

    function setTab(tab) {
        activeTab = tab;
        tabUsername.classList.toggle('active', tab === 'username');
        tabEmail.classList.toggle('active', tab === 'email');
        if (isLogin) {
            usernameGroup.classList.toggle('field-hidden', tab !== 'username');
            emailGroup.classList.toggle('field-hidden', tab !== 'email');
        } else {
            usernameGroup.classList.remove('field-hidden');
            emailGroup.classList.remove('field-hidden');
        }
    }

    function updateMode() {
        if (isLogin) {
            authTitle.textContent = 'Welcome Back';
            authSubtitle.textContent = 'Sign in to continue your sign language detection journey';
            btnText.textContent = 'Sign In';
            btnIcon.className = 'fas fa-arrow-right';
            toggleText.textContent = "Don't have an account?";
            toggleLink.textContent = 'Create Account';
            confirmGroup.classList.add('field-hidden');
            forgotRow.style.display = 'flex';
            strengthEl.classList.remove('show');
            strengthFill.style.width = '0%';
            document.title = 'RTSL AI | Sign In';
            setTab(activeTab);
        } else {
            authTitle.textContent = 'Create Account';
            authSubtitle.textContent = 'Join RTSL AI for intelligent sign language recognition';
            btnText.textContent = 'Create Account';
            btnIcon.className = 'fas fa-user-plus';
            toggleText.textContent = 'Already have an account?';
            toggleLink.textContent = 'Sign In';
            confirmGroup.classList.remove('field-hidden');
            forgotRow.style.display = 'none';
            document.title = 'RTSL AI | Sign Up';
            usernameGroup.classList.remove('field-hidden');
            emailGroup.classList.remove('field-hidden');
            tabUsername.classList.add('active');
            tabEmail.classList.remove('active');
            activeTab = 'username';
        }
    }

    function updatePasswordStrength(pw) {
        if (!pw) {
            strengthEl.classList.remove('show');
            return;
        }
        strengthEl.classList.add('show');
        const checks = [
            pw.length >= 8, /[A-Z]/.test(pw), /[a-z]/.test(pw),
            /[0-9]/.test(pw), /[^A-Za-z0-9]/.test(pw)
        ];
        const score = checks.filter(Boolean).length;
        const pct = (score / 5) * 100;

        let color, label;
        if (score <= 1) { color = '#ef4444'; label = 'Weak'; }
        else if (score <= 2) { color = '#f97316'; label = 'Fair'; }
        else if (score <= 3) { color = '#eab308'; label = 'Good'; }
        else if (score <= 4) { color = '#22c55e'; label = 'Strong'; }
        else { color = '#10b981'; label = 'Very Strong'; }

        strengthFill.style.width = pct + '%';
        strengthFill.style.background = color;
        strengthText.textContent = label;
        strengthText.style.color = color;
    }

    function updateBtnContent() {
        authBtn.innerHTML = `<span id="btn-text">${isLogin ? 'Sign In' : 'Create Account'}</span><i class="${isLogin ? 'fas fa-arrow-right' : 'fas fa-user-plus'}" id="btn-icon"></i>`;
    }

    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast glass ${type}`;
        const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
        toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${message}`;
        toastContainer.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }

    function initTheme() {
        const saved = localStorage.getItem('asl_theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const isDark = saved ? saved === 'dark' : prefersDark;

        if (!isDark) {
            document.body.classList.add('light-mode');
            themeIcon.className = 'fas fa-sun';
        } else {
            document.body.classList.remove('light-mode');
            themeIcon.className = 'fas fa-moon';
        }
    }

    function toggleTheme() {
        const isLight = document.body.classList.toggle('light-mode');
        themeIcon.className = isLight ? 'fas fa-sun' : 'fas fa-moon';
        localStorage.setItem('asl_theme', isLight ? 'light' : 'dark');
    }
});