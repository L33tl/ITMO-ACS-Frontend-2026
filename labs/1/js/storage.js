/* ==========================================================================
   JobHub — работа с localStorage: пользователи, сессия, вакансии, резюме, отклики
   ========================================================================== */

'use strict';

const DB = {
  USERS: 'jh_users',
  SESSION: 'jh_session',
  VACANCIES: 'jh_vacancies',
  RESUMES: 'jh_resumes',
  APPLICATIONS: 'jh_applications',
};

const Store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.error('Store.get error', key, e);
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  remove(key) {
    localStorage.removeItem(key);
  },
};

/** Первичная инициализация базы: создаём демо-пользователей и вакансии */
function initDB() {
  if (!localStorage.getItem(DB.USERS)) {
    Store.set(DB.USERS, SEED_USERS);
  }
  if (!localStorage.getItem(DB.VACANCIES)) {
    Store.set(DB.VACANCIES, SEED_VACANCIES);
  }
  if (!localStorage.getItem(DB.RESUMES)) {
    Store.set(DB.RESUMES, [SEED_RESUME]);
  }
  if (!localStorage.getItem(DB.APPLICATIONS)) {
    Store.set(DB.APPLICATIONS, SEED_APPLICATIONS);
  }
}

function uid(prefix) {
  return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ---------------- Авторизация ---------------- */

const Auth = {
  currentUser() {
    const id = Store.get(DB.SESSION, null);
    if (!id) return null;
    const users = Store.get(DB.USERS, []);
    return users.find((u) => u.id === id) || null;
  },

  findUser(email) {
    const users = Store.get(DB.USERS, []);
    return users.find((u) => u.email.toLowerCase() === String(email).toLowerCase()) || null;
  },

  login(email, password) {
    const user = this.findUser(email);
    if (!user || user.password !== password) {
      return { ok: false, error: 'Неверный email или пароль' };
    }
    Store.set(DB.SESSION, user.id);
    return { ok: true, user };
  },

  register(data) {
    if (this.findUser(data.email)) {
      return { ok: false, error: 'Пользователь с таким email уже зарегистрирован' };
    }
    const users = Store.get(DB.USERS, []);
    const user = {
      id: uid('u'),
      email: data.email,
      password: data.password,
      name: data.name,
      role: data.role,
      company: data.company || null,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    users.push(user);
    Store.set(DB.USERS, users);
    Store.set(DB.SESSION, user.id);

    // Заготовка пустого резюме для соискателя
    if (user.role === 'candidate') {
      const resumes = Store.get(DB.RESUMES, []);
      resumes.push({
        userId: user.id,
        name: user.name,
        phone: '',
        email: user.email,
        city: '',
        birthDate: '',
        summary: '',
        skills: [],
        experience: [],
        education: '',
        updatedAt: new Date().toISOString().slice(0, 10),
      });
      Store.set(DB.RESUMES, resumes);
    }
    return { ok: true, user };
  },

  logout() {
    Store.remove(DB.SESSION);
  },
};

/* ---------------- Вакансии ---------------- */

const VacancyStore = {
  all() {
    return Store.get(DB.VACANCIES, []);
  },
  active() {
    return this.all().filter((v) => v.active);
  },
  byId(id) {
    return this.all().find((v) => v.id === id) || null;
  },
  save(vacancies) {
    Store.set(DB.VACANCIES, vacancies);
  },
  create(data) {
    const vacancies = this.all();
    const vacancy = Object.assign(
      {
        id: uid('v'),
        postedAt: new Date().toISOString().slice(0, 10),
        active: true,
        responses: [],
      },
      data
    );
    vacancies.unshift(vacancy);
    this.save(vacancies);
    return vacancy;
  },
  update(id, patch) {
    const vacancies = this.all();
    const idx = vacancies.findIndex((v) => v.id === id);
    if (idx === -1) return null;
    vacancies[idx] = Object.assign({}, vacancies[idx], patch);
    this.save(vacancies);
    return vacancies[idx];
  },
  remove(id) {
    this.save(this.all().filter((v) => v.id !== id));
  },
};

/* ---------------- Резюме ---------------- */

const ResumeStore = {
  forUser(userId) {
    const resumes = Store.get(DB.RESUMES, []);
    return resumes.find((r) => r.userId === userId) || null;
  },
  save(resume) {
    const resumes = Store.get(DB.RESUMES, []);
    const idx = resumes.findIndex((r) => r.userId === resume.userId);
    if (idx === -1) {
      resumes.push(resume);
    } else {
      resumes[idx] = resume;
    }
    Store.set(DB.RESUMES, resumes);
  },
};

/* ---------------- Отклики ---------------- */

const ApplicationStore = {
  all() {
    return Store.get(DB.APPLICATIONS, []);
  },
  forUser(userId) {
    return this.all().filter((a) => a.userId === userId);
  },
  forVacancy(vacancyId) {
    return this.all().filter((a) => a.vacancyId === vacancyId);
  },
  exists(userId, vacancyId) {
    return this.all().some((a) => a.userId === userId && a.vacancyId === vacancyId);
  },
  add(vacancyId, userId) {
    if (this.exists(userId, vacancyId)) return null;
    const applications = this.all();
    const app = {
      id: uid('a'),
      vacancyId,
      userId,
      createdAt: new Date().toISOString(),
      status: 'new',
    };
    applications.unshift(app);
    Store.set(DB.APPLICATIONS, applications);
    return app;
  },
  remove(id) {
    Store.set(DB.APPLICATIONS, this.all().filter((a) => a.id !== id));
  },
  updateStatus(id, status) {
    const applications = this.all();
    const idx = applications.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    applications[idx].status = status;
    Store.set(DB.APPLICATIONS, applications);
    return applications[idx];
  },
};

/* ---------------- Форматирование ---------------- */

function fmtMoney(n) {
  if (!n && n !== 0) return '';
  return new Intl.NumberFormat('ru-RU').format(n) + ' ₽';
}

function salaryText(min, max) {
  if (min && max) return `${fmtMoney(min)} – ${fmtMoney(max)}`;
  if (min) return `от ${fmtMoney(min)}`;
  if (max) return `до ${fmtMoney(max)}`;
  return 'з/п по договорённости';
}

function timeAgo(isoDate) {
  const days = Math.floor((Date.now() - new Date(isoDate).getTime()) / 86400000);
  if (days <= 0) return 'сегодня';
  if (days === 1) return 'вчера';
  if (days < 7) return `${days} дн. назад`;
  if (days < 30) return `${Math.floor(days / 7)} нед. назад`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 мес. назад' : `${months} мес. назад`;
}

function initials(name) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function colorForName(name) {
  const palette = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

/** Экранирование пользовательского ввода перед вставкой в HTML */
function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, "'");
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name) || '';
}