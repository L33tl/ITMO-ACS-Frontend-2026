/* ==========================================================================
   JobHub — личный кабинет работодателя: управление вакансиями и откликами
   ========================================================================== */

'use strict';

let editingVacancyId = null;
let deletingVacancyId = null;

document.addEventListener('DOMContentLoaded', () => {
  initDB();
  guardEmployer();
  renderEmployerDashboard();
  bindVacancyForm();
  bindDeleteModal();
});

function guardEmployer() {
  const user = Auth.currentUser();
  if (!user) {
    window.location.href = 'login.html?next=employer.html';
    return;
  }
  if (user.role !== 'employer') {
    showToast('Этот раздел доступен только работодателям', 'error');
    setTimeout(() => (window.location.href = 'profile.html'), 800);
    return;
  }
}

function myVacancies() {
  const user = Auth.currentUser();
  if (!user) return [];
  return VacancyStore.all().filter((v) => v.employerEmail === user.email);
}

/* ---------- Дашборд ---------- */

function renderEmployerDashboard() {
  const user = Auth.currentUser();
  if (!user) return;

  const vacancies = myVacancies();
  const applications = ApplicationStore.all().filter((a) =>
    vacancies.some((v) => v.id === a.vacancyId)
  );
  const newApps = applications.filter((a) => a.status === 'new').length;

  document.getElementById('empName').textContent = user.name;
  document.getElementById('empCompany').textContent = user.company || 'Компания не указана';
  document.getElementById('statVacancies').textContent = vacancies.length;
  document.getElementById('statActive').textContent = vacancies.filter((v) => v.active).length;
  document.getElementById('statResponses').textContent = applications.length;
  document.getElementById('statNew').textContent = newApps;

  renderVacanciesTable(vacancies, applications);
}

/* ---------- Таблица вакансий ---------- */

function renderVacanciesTable(vacancies, applications) {
  const box = document.getElementById('vacanciesTableBox');
  if (!vacancies.length) {
    box.innerHTML = `
      <div class="empty-state">
        <i class="bi bi-briefcase"></i>
        <h2 class="h5 mt-3">У вас пока нет вакансий</h2>
        <p>Создайте первую вакансию, чтобы получать отклики соискателей.</p>
        <button class="btn btn-brand mt-2" data-bs-toggle="modal" data-bs-target="#vacancyModal" data-new-vacancy>
          <i class="bi bi-plus-lg me-1"></i>Создать вакансию
        </button>
      </div>`;
    return;
  }

  box.innerHTML = `
    <div class="table-responsive">
      <table class="table table-jobs align-middle mb-0">
        <thead>
          <tr>
            <th>Вакансия</th>
            <th>Отрасль</th>
            <th>Зарплата</th>
            <th>Отклики</th>
            <th>Статус</th>
            <th class="text-end">Действия</th>
          </tr>
        </thead>
        <tbody>
          ${vacancies
            .map((v) => {
              const count = applications.filter((a) => a.vacancyId === v.id).length;
              return `
            <tr>
              <td>
                <a href="job.html?id=${encodeURIComponent(v.id)}" class="fw-bold link-plain d-block">${esc(v.title)}</a>
                <span class="small text-muted"><i class="bi bi-geo-alt me-1"></i>${esc(v.location)} · ${timeAgo(v.postedAt)}</span>
              </td>
              <td><span class="badge badge-soft badge-industry">${esc(v.industry)}</span></td>
              <td class="small fw-semibold">${salaryText(v.salaryMin, v.salaryMax)}</td>
              <td>
                <a href="#responses" class="badge badge-soft badge-exp text-decoration-none"
                   data-responses-vacancy="${v.id}">
                  ${count} <i class="bi bi-chat-dots ms-1"></i>
                </a>
              </td>
              <td>
                <div class="form-check form-switch">
                  <input class="form-check-input" type="checkbox" role="switch" id="active-${v.id}"
                         ${v.active ? 'checked' : ''} data-toggle-active="${v.id}" aria-label="Публикация вакансии">
                  <label class="form-check-label small" for="active-${v.id}">${v.active ? 'Активна' : 'Пауза'}</label>
                </div>
              </td>
              <td class="text-end">
                <div class="d-inline-flex gap-1">
                  <button class="btn-icon" data-edit-vacancy="${v.id}" title="Редактировать" aria-label="Редактировать вакансию">
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button class="btn-icon danger" data-delete-vacancy="${v.id}" title="Удалить" aria-label="Удалить вакансию">
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </td>
            </tr>`;
            })
            .join('')}
        </tbody>
      </table>
    </div>`;

  // Обработчики
  box.querySelectorAll('[data-toggle-active]').forEach((input) => {
    input.addEventListener('change', () => {
      VacancyStore.update(input.dataset.toggleActive, { active: input.checked });
      showToast(input.checked ? 'Вакансия опубликована' : 'Вакансия снята с публикации', 'info');
      renderEmployerDashboard();
    });
  });

  box.querySelectorAll('[data-edit-vacancy]').forEach((btn) => {
    btn.addEventListener('click', () => openVacancyModal(btn.dataset.editVacancy));
  });

  box.querySelectorAll('[data-delete-vacancy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      deletingVacancyId = btn.dataset.deleteVacancy;
      new bootstrap.Modal(document.getElementById('deleteModal')).show();
    });
  });
}

/* ---------- Отклики (аккордеон) ---------- */

function renderResponses() {
  const box = document.getElementById('responsesAccordion');
  const user = Auth.currentUser();
  const vacancies = myVacancies();
  const allApplications = ApplicationStore.all();

  const withResponses = vacancies.filter((v) => allApplications.some((a) => a.vacancyId === v.id));

  if (!withResponses.length) {
    box.innerHTML = `
      <div class="empty-state">
        <i class="bi bi-chat-square-text"></i>
        <h2 class="h5 mt-3">Откликов пока нет</h2>
        <p>Как только соискатели откликнутся на ваши вакансии, они появятся здесь.</p>
      </div>`;
    return;
  }

  box.innerHTML = withResponses
    .map((v, idx) => {
      const apps = allApplications.filter((a) => a.vacancyId === v.id);
      return `
      <div class="accordion-item border-0 mb-3 rounded-3 overflow-hidden">
        <h2 class="accordion-header" id="respHead-${v.id}">
          <button class="accordion-button ${idx > 0 ? 'collapsed' : ''}" type="button"
                  data-bs-toggle="collapse" data-bs-target="#resp-${v.id}"
                  aria-expanded="${idx === 0}" aria-controls="resp-${v.id}">
            <span class="fw-bold me-2">${esc(v.title)}</span>
            <span class="badge badge-soft badge-exp">${apps.length} откл.</span>
          </button>
        </h2>
        <div id="resp-${v.id}" class="accordion-collapse collapse ${idx === 0 ? 'show' : ''}"
             aria-labelledby="respHead-${v.id}">
          <div class="accordion-body bg-light">
            ${apps.map((a) => applicationRow(a)).join('')}
          </div>
        </div>
      </div>`;
    })
    .join('');
}

function applicationRow(app) {
  const candidate = (Store.get(DB.USERS, [])).find((u) => u.id === app.userId);
  const resume = candidate ? ResumeStore.forUser(candidate.id) : null;
  const meta = STATUS_META[app.status] || STATUS_META.new;

  return `
    <div class="card border-0 shadow-sm mb-2">
      <div class="card-body py-3">
        <div class="d-flex flex-wrap align-items-center gap-2">
          <span class="avatar-circle" style="background:${colorForName(candidate ? candidate.name : '?')}">
            ${initials(candidate ? candidate.name : '?')}
          </span>
          <div class="flex-grow-1">
            <div class="fw-bold">${candidate ? esc(candidate.name) : 'Анонимный соискатель'}</div>
            <div class="small text-muted">
              ${resume ? `${esc(resume.phone || 'телефон не указан')} · ${esc(resume.city || 'город не указан')}` : 'Резюме не заполнено'}
            </div>
            ${resume && resume.skills.length ? `<div class="small text-muted">Навыки: ${resume.skills.map(esc).join(', ')}</div>` : ''}
          </div>
          <span class="small text-muted me-2">${timeAgo(app.createdAt)}</span>
          <span class="badge badge-soft ${meta.cls}">${meta.label}</span>
          <select class="form-select form-select-sm w-auto" data-change-status="${app.id}" aria-label="Изменить статус отклика">
            ${Object.entries(STATUS_META)
              .map(([key, m]) => `<option value="${key}" ${key === app.status ? 'selected' : ''}>${m.label}</option>`)
              .join('')}
          </select>
        </div>
      </div>
    </div>`;
}

/* ---------- Модальное окно создания/редактирования вакансии ---------- */

function openVacancyModal(id) {
  editingVacancyId = id || null;
  const form = document.getElementById('vacancyForm');
  form.reset();
  document.getElementById('vacancyModalTitle').textContent = id ? 'Редактировать вакансию' : 'Новая вакансия';

  if (id) {
    const v = VacancyStore.byId(id);
    if (!v) return;
    form.fTitle.value = v.title;
    form.fIndustry.value = v.industry;
    form.fSalaryMin.value = v.salaryMin || '';
    form.fSalaryMax.value = v.salaryMax || '';
    form.fExperience.value = v.experience;
    form.fLocation.value = v.location;
    form.fFormat.value = v.format;
    form.fDescription.value = v.description;
    form.fRequirements.value = v.requirements.join('\n');
    form.fOffers.value = v.offers.join('\n');
    form.fActive.checked = v.active;
  }
}

function bindVacancyForm() {
  const form = document.getElementById('vacancyForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = Auth.currentUser();
    if (!user) return;

    const f = e.target;
    const data = {
      title: f.fTitle.value.trim(),
      industry: f.fIndustry.value,
      salaryMin: Number(f.fSalaryMin.value) || null,
      salaryMax: Number(f.fSalaryMax.value) || null,
      experience: f.fExperience.value,
      location: f.fLocation.value.trim(),
      format: f.fFormat.value,
      description: f.fDescription.value.trim(),
      requirements: f.fRequirements.value.split('\n').map((s) => s.trim()).filter(Boolean),
      offers: f.fOffers.value.split('\n').map((s) => s.trim()).filter(Boolean),
      active: f.fActive.checked,
    };

    // Валидация
    if (!data.title || !data.industry || !data.experience || !data.location || !data.description) {
      showToast('Заполните обязательные поля', 'error');
      return;
    }
    if (data.salaryMin && data.salaryMax && data.salaryMax < data.salaryMin) {
      showToast('Максимальная зарплата не может быть меньше минимальной', 'error');
      return;
    }

    const company = user.company || 'Моя компания';
    if (editingVacancyId) {
      const existing = VacancyStore.byId(editingVacancyId);
      VacancyStore.update(editingVacancyId, Object.assign({}, data, {
        company: existing.company,
        employerEmail: user.email,
      }));
      showToast('Вакансия обновлена', 'success');
    } else {
      VacancyStore.create(Object.assign({}, data, {
        employerEmail: user.email,
        company: {
          name: company,
          city: data.location,
          employees: '—',
          about: `Компания «${company}» ищет сотрудников через JobHub.`,
          website: '',
        },
      }));
      showToast('Вакансия опубликована', 'success');
    }

    bootstrap.Modal.getInstance(document.getElementById('vacancyModal')).hide();
    renderEmployerDashboard();
  });
}

/* ---------- Модальное окно удаления ---------- */

function bindDeleteModal() {
  const modalEl = document.getElementById('deleteModal');
  if (!modalEl) return;

  modalEl.addEventListener('show.bs.modal', () => {
    const v = VacancyStore.byId(deletingVacancyId);
    document.getElementById('deleteVacancyTitle').textContent = v ? `«${v.title}»` : '';
  });

  document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
    if (deletingVacancyId) {
      VacancyStore.remove(deletingVacancyId);
      showToast('Вакансия удалена', 'info');
    }
    bootstrap.Modal.getInstance(modalEl).hide();
    renderEmployerDashboard();
  });
}

/* ---------- Глобальные обработчики ---------- */

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-responses-vacancy]');
  if (btn) {
    renderResponses();
    // Плавно скроллим к блоку откликов
    setTimeout(() => {
      document.getElementById('responses').scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  // Кнопки «Новая вакансия»: подготавливаем форму перед открытием модального окна
  if (e.target.closest('[data-new-vacancy]')) {
    openVacancyModal();
  }
});

document.addEventListener('change', (e) => {
  const sel = e.target.closest('[data-change-status]');
  if (sel) {
    ApplicationStore.updateStatus(sel.dataset.changeStatus, sel.value);
    showToast('Статус отклика обновлён', 'success');
    renderEmployerDashboard();
  }
});

// Показываем блок откликов сразу при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  if (Auth.currentUser() && Auth.currentUser().role === 'employer') {
    renderResponses();
  }
});