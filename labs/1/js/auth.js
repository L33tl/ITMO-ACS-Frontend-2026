/* ==========================================================================
   JobHub — страницы входа и регистрации
   ========================================================================== */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  initDB();
  bindLoginForm();
  bindRegisterForm();
});

function redirectAfterAuth() {
  const next = getQueryParam('next');
  if (next && !next.startsWith('http')) {
    window.location.href = next;
  } else {
    const user = Auth.currentUser();
    window.location.href = user && user.role === 'employer' ? 'employer.html' : 'profile.html';
  }
}

/* ---------------- Вход ---------------- */

function bindLoginForm() {
  const form = document.getElementById('loginForm');
  if (!form) return;

  // Автозаполнение демо-аккаунтами
  document.querySelectorAll('[data-fill-demo]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const demo = btn.dataset.fillDemo === 'employer'
        ? { email: 'hr@demo.ru', password: '123456' }
        : { email: 'user@demo.ru', password: '123456' };
      form.email.value = demo.email;
      form.password.value = demo.password;
      document.getElementById('loginAlert').hidden = true;
    });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const alertBox = document.getElementById('loginAlert');
    alertBox.hidden = true;

    const email = form.email.value.trim();
    const password = form.password.value;
    if (!email || !password) {
      alertBox.textContent = 'Заполните все поля';
      alertBox.hidden = false;
      return;
    }

    const result = Auth.login(email, password);
    if (!result.ok) {
      alertBox.textContent = result.error;
      alertBox.hidden = false;
      return;
    }

    showToast(`С возвращением, ${result.user.name}!`, 'success');
    setTimeout(redirectAfterAuth, 600);
  });
}

/* ---------------- Регистрация ---------------- */

function bindRegisterForm() {
  const form = document.getElementById('registerForm');
  if (!form) return;
  const companyField = document.getElementById('companyField');
  const roleInputs = form.querySelectorAll('input[name="role"]');

  // Показываем поле «Название компании» только для работодателя
  function toggleCompanyField() {
    const role = form.querySelector('input[name="role"]:checked').value;
    companyField.classList.toggle('d-none', role !== 'employer');
    const companyInput = document.getElementById('company');
    companyInput.required = role === 'employer';
    companyInput.closest('.mb-3').querySelector('label').classList.toggle('text-danger', role === 'employer');
  }
  roleInputs.forEach((input) => input.addEventListener('change', toggleCompanyField));
  toggleCompanyField();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const alertBox = document.getElementById('registerAlert');
    alertBox.hidden = true;

    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;
    const password2 = form.password2.value;
    const role = form.querySelector('input[name="role"]:checked').value;

    if (name.length < 2) {
      alertBox.textContent = 'Укажите корректное имя';
      alertBox.hidden = false;
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alertBox.textContent = 'Введите корректный email';
      alertBox.hidden = false;
      return;
    }
    if (password.length < 6) {
      alertBox.textContent = 'Пароль должен содержать не менее 6 символов';
      alertBox.hidden = false;
      return;
    }
    if (password !== password2) {
      alertBox.textContent = 'Пароли не совпадают';
      alertBox.hidden = false;
      return;
    }

    const result = Auth.register({
      name,
      email,
      password,
      role,
      company: role === 'employer' ? form.company.value.trim() : null,
    });

    if (!result.ok) {
      alertBox.textContent = result.error;
      alertBox.hidden = false;
      return;
    }

    showToast('Аккаунт создан!', 'success');
    setTimeout(redirectAfterAuth, 700);
  });
}