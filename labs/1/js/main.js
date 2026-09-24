/* ==========================================================================
   JobHub — общий скрипт: шапка с пользователем, активный пункт меню,
   тосты, переключатели пароля, модальное окно входа
   ========================================================================== */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  initDB();
  renderNavUser();
  highlightActiveNav();
  bindPasswordToggles();
  bindLogout();
  bindLoginModal();
  bindHeroSearch();
});

/* ---------- Шапка: пользователь или кнопки входа ---------- */

function renderNavUser() {
  const target = document.getElementById('navUser');
  if (!target) return;
  const user = Auth.currentUser();

  if (user) {
    const isCandidate = user.role === 'candidate';
    const profileLink = isCandidate ? 'profile.html' : 'employer.html';
    const menuLabel = isCandidate ? 'Личный кабинет' : 'Кабинет работодателя';

    target.innerHTML = `
      <div class="dropdown user-menu">
        <a class="btn btn-light-soft dropdown-toggle d-flex align-items-center gap-2" href="#"
           data-bs-toggle="dropdown" aria-expanded="false" role="button">
          <span class="avatar-circle" style="background:${colorForName(user.name)}">${initials(user.name)}</span>
          <span class="d-none d-lg-inline fw-semibold">${esc(user.name)}</span>
        </a>
        <ul class="dropdown-menu dropdown-menu-end shadow-sm">
          <li><h6 class="dropdown-header">Вы вошли как ${user.role === 'employer' ? 'работодатель' : 'соискатель'}</h6></li>
          <li><hr class="dropdown-divider"></li>
          <li><a class="dropdown-item" href="${profileLink}"><i class="bi bi-person me-2"></i>${menuLabel}</a></li>
          <li><a class="dropdown-item" href="jobs.html"><i class="bi bi-search me-2"></i>Поиск вакансий</a></li>
          <li><hr class="dropdown-divider"></li>
          <li><button class="dropdown-item text-danger" id="logoutBtn" type="button">
            <i class="bi bi-box-arrow-right me-2"></i>Выйти</button></li>
        </ul>
      </div>`;
  } else {
    target.innerHTML = `
      <a href="login.html" class="btn btn-light-soft me-2">Войти</a>
      <a href="register.html" class="btn btn-brand">Регистрация</a>`;
  }
}

function bindLogout() {
  document.addEventListener('click', (e) => {
    if (e.target.closest('#logoutBtn')) {
      Auth.logout();
      showToast('Вы вышли из аккаунта', 'info');
      setTimeout(() => window.location.reload(), 600);
    }
  });
}

/* ---------- Активный пункт меню ---------- */

function highlightActiveNav() {
  const page = document.body.dataset.page;
  if (!page) return;
  document.querySelectorAll('[data-nav]').forEach((link) => {
    if (link.dataset.nav === page) link.classList.add('active');
  });
}

/* ---------- Показ/скрытие пароля ---------- */

function bindPasswordToggles() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-password-toggle]');
    if (!btn) return;
    const input = document.getElementById(btn.dataset.passwordToggle);
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.innerHTML = show
      ? '<i class="bi bi-eye-slash"></i>'
      : '<i class="bi bi-eye"></i>';
  });
}

/* ---------- Модальное окно быстрого входа (главная / вакансии) ---------- */

function bindLoginModal() {
  const form = document.getElementById('quickLoginForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const password = form.password.value;
    const result = Auth.login(email, password);

    const alertBox = document.getElementById('quickLoginAlert');
    if (!result.ok) {
      alertBox.hidden = false;
      alertBox.textContent = result.error;
      return;
    }
    alertBox.hidden = true;
    const modalEl = document.getElementById('loginModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();

    showToast(`Добро пожаловать, ${result.user.name}!`, 'success');
    renderNavUser();

    // Продолжаем отложенное действие, если оно было (например, отклик на вакансию)
    if (window.pendingAction) {
      const action = window.pendingAction;
      window.pendingAction = null;
      action();
    }
  });

  // Кнопки «заполнить демо-данными»
  document.querySelectorAll('[data-fill-demo]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const demo = btn.dataset.fillDemo === 'employer'
        ? { email: 'hr@demo.ru', password: '123456' }
        : { email: 'user@demo.ru', password: '123456' };
      form.email.value = demo.email;
      form.password.value = demo.password;
      document.getElementById('quickLoginAlert').hidden = true;
    });
  });
}

/** Отложенное действие после входа (используется кнопками «Откликнуться») */
function requireLogin(nextAction) {
  const user = Auth.currentUser();
  if (user) {
    nextAction(user);
    return;
  }
  const modalEl = document.getElementById('loginModal');
  if (modalEl && window.bootstrap) {
    window.pendingAction = nextAction;
    new bootstrap.Modal(modalEl).show();
  } else {
    const next = encodeURIComponent(window.location.pathname.split('/').pop() + window.location.search);
    window.location.href = `login.html?next=${next}`;
  }
}

/* ---------- Поиск в hero-блоке главной ---------- */

function bindHeroSearch() {
  const form = document.getElementById('heroSearchForm');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = form.q.value.trim();
    const industry = form.industry ? form.industry.value : '';
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (industry) params.set('industry', industry);
    window.location.href = 'jobs.html?' + params.toString();
  });
}

/* ---------- Тосты ---------- */

function showToast(message, type = 'info') {
  let box = document.getElementById('toastBox');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toastBox';
    box.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    document.body.appendChild(box);
  }
  const icons = { success: 'bi-check-circle-fill', error: 'bi-x-circle-fill', info: 'bi-info-circle-fill' };
  const toast = document.createElement('div');
  toast.className = `toast app-toast ${type}`;
  toast.setAttribute('role', 'status');
  toast.innerHTML = `
    <div class="toast-body d-flex align-items-center gap-2">
      <i class="bi ${icons[type] || icons.info} fs-5"></i>
      <span class="flex-grow-1">${esc(message)}</span>
      <button type="button" class="btn-close ms-3" data-bs-dismiss="toast" aria-label="Закрыть"></button>
    </div>`;
  box.appendChild(toast);
  const bsToast = new bootstrap.Toast(toast, { delay: 3500 });
  bsToast.show();
  toast.addEventListener('hidden.bs.toast', () => toast.remove());
}