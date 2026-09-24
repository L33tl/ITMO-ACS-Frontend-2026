/* ==========================================================================
   JobHub — личный кабинет соискателя: резюме + мои отклики
   ========================================================================== */

'use strict';

let resumeDraft = { skills: [] };

document.addEventListener('DOMContentLoaded', () => {
  initDB();
  guardCandidate();
  renderProfile();
  bindResumeForm();
});

function guardCandidate() {
  const user = Auth.currentUser();
  if (!user) {
    window.location.href = 'login.html?next=profile.html';
    return;
  }
  if (user.role !== 'candidate') {
    showToast('Этот раздел доступен только соискателям', 'error');
    setTimeout(() => (window.location.href = 'employer.html'), 800);
    return;
  }
}

/* ---------- Рендер кабинета ---------- */

function renderProfile() {
  const user = Auth.currentUser();
  if (!user) return;

  document.getElementById('userName').textContent = user.name;
  document.getElementById('userInitials').textContent = initials(user.name);
  document.getElementById('userEmail').textContent = user.email;

  const resume = ResumeStore.forUser(user.id);
  const apps = ApplicationStore.forUser(user.id);

  // Статистика
  document.getElementById('statApplications').textContent = apps.length;
  document.getElementById('statActiveResume').textContent = resume ? 'Заполнено' : 'Не заполнено';
  document.getElementById('statViews').textContent = apps.filter((a) => a.status !== 'new').length;

  renderResume(resume);
  renderApplications(apps, user.id);
}

function renderResume(resume) {
  const box = document.getElementById('resumeBox');
  if (!resume) {
    box.innerHTML = `
      <div class="empty-state">
        <i class="bi bi-file-earmark-person"></i>
        <h2 class="h5 mt-3">Резюме ещё не создано</h2>
        <p>Заполните резюме, чтобы работодатели могли с вами связаться.</p>
        <button class="btn btn-brand mt-2" data-bs-toggle="modal" data-bs-target="#resumeModal">Создать резюме</button>
      </div>`;
    return;
  }

  const expHtml = resume.experience.length
    ? resume.experience
        .map(
          (xp) => `
      <div class="d-flex gap-3 mb-3">
        <div class="step-num"><i class="bi bi-briefcase"></i></div>
        <div class="flex-grow-1">
          <div class="fw-bold">${esc(xp.position)}</div>
          <div class="small text-muted">${esc(xp.company)} · ${esc(xp.years)}</div>
          ${xp.description ? `<p class="small mt-1 mb-0">${esc(xp.description)}</p>` : ''}
        </div>
      </div>`
        )
        .join('')
    : '<p class="text-muted small">Опыт работы не указан.</p>';

  box.innerHTML = `
    <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
      <div>
        <h2 class="h4 fw-bold mb-1">${esc(resume.name)}</h2>
        <div class="text-muted small">
          <i class="bi bi-geo-alt me-1"></i>${esc(resume.city || 'Город не указан')}
          <span class="mx-2">·</span>
          <i class="bi bi-calendar3 me-1"></i>${esc(resume.birthDate || 'Дата рождения не указана')}
        </div>
      </div>
      <button class="btn btn-outline-brand" data-bs-toggle="modal" data-bs-target="#resumeModal">
        <i class="bi bi-pencil me-1"></i>Редактировать
      </button>
    </div>

    <div class="d-flex flex-wrap gap-3 small text-muted mb-4">
      <span><i class="bi bi-telephone me-1"></i>${esc(resume.phone || 'Телефон не указан')}</span>
      <span><i class="bi bi-envelope me-1"></i>${esc(resume.email)}</span>
    </div>

    <h3 class="h6 fw-bold text-uppercase small text-muted">О себе</h3>
    <p class="mb-4">${esc(resume.summary || 'Краткое описание не добавлено.')}</p>

    <h3 class="h6 fw-bold text-uppercase small text-muted mb-2">Навыки</h3>
    <div class="d-flex flex-wrap gap-2 mb-4">
      ${resume.skills.length
        ? resume.skills.map((s) => `<span class="skill-chip">${esc(s)}</span>`).join('')
        : '<span class="text-muted small">Навыки не указаны.</span>'}
    </div>

    <h3 class="h6 fw-bold text-uppercase small text-muted mb-3">Опыт работы</h3>
    ${expHtml}

    <h3 class="h6 fw-bold text-uppercase small text-muted mb-2">Образование</h3>
    <p class="mb-0">${esc(resume.education || 'Не указано.')}</p>`;
}

/* ---------- Мои отклики ---------- */

function renderApplications(apps, userId) {
  const box = document.getElementById('applicationsBox');
  const counter = document.getElementById('appsCount');
  if (counter) counter.textContent = apps.length;
  if (!apps.length) {
    box.innerHTML = `
      <div class="empty-state">
        <i class="bi bi-inbox"></i>
        <h2 class="h5 mt-3">Пока нет откликов</h2>
        <p>Найдите подходящую вакансию и отправьте первый отклик.</p>
        <a href="jobs.html" class="btn btn-brand mt-2"><i class="bi bi-search me-1"></i>К вакансиям</a>
      </div>`;
    return;
  }

  box.innerHTML = `
    <div class="list-group list-group-flush">
      ${apps
        .map((app) => {
          const vacancy = VacancyStore.byId(app.vacancyId);
          const meta = STATUS_META[app.status] || STATUS_META.new;
          if (!vacancy) return '';
          return `
          <div class="list-group-item px-0 border-0 border-bottom d-flex flex-wrap align-items-center gap-2 py-3">
            <span class="avatar-circle" style="background:${colorForName(vacancy.company.name)}">${initials(vacancy.company.name)}</span>
            <div class="flex-grow-1">
              <a href="job.html?id=${encodeURIComponent(vacancy.id)}" class="fw-bold link-plain">${esc(vacancy.title)}</a>
              <div class="small text-muted">${esc(vacancy.company.name)} · ${esc(vacancy.location)}</div>
            </div>
            <span class="badge badge-soft ${meta.cls}">${meta.label}</span>
            <span class="small text-muted">${timeAgo(app.createdAt)}</span>
            <button class="btn-icon danger" data-cancel-app="${app.id}" title="Отозвать отклик" aria-label="Отозвать отклик">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>`;
        })
        .join('')}
    </div>`;

  box.querySelectorAll('[data-cancel-app]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (confirm('Отозвать отклик?')) {
        ApplicationStore.remove(btn.dataset.cancelApp);
        showToast('Отклик отозван', 'info');
        renderProfile();
      }
    });
  });
}

/* ---------- Редактирование резюме (модальное окно) ---------- */

function bindResumeForm() {
  const modalEl = document.getElementById('resumeModal');
  if (!modalEl) return;

  modalEl.addEventListener('show.bs.modal', () => {
    const user = Auth.currentUser();
    const resume = ResumeStore.forUser(user.id) || {
      userId: user.id, name: user.name, phone: '', email: user.email,
      city: '', birthDate: '', summary: '', skills: [], experience: [], education: '',
    };
    resumeDraft = JSON.parse(JSON.stringify(resume));

    const form = document.getElementById('resumeForm');
    form.name.value = resumeDraft.name || '';
    form.phone.value = resumeDraft.phone || '';
    form.city.value = resumeDraft.city || '';
    form.birthDate.value = resumeDraft.birthDate || '';
    form.summary.value = resumeDraft.summary || '';
    form.education.value = resumeDraft.education || '';

    // Опыт работы
    const expBox = document.getElementById('expList');
    expBox.innerHTML = '';
    resumeDraft.experience.forEach((xp) => addExpRow(xp));

    // Навыки
    const skillsBox = document.getElementById('skillsList');
    skillsBox.innerHTML = '';
    resumeDraft.skills.forEach((s) => addSkillChip(s));
  });

  // Добавление навыка
  document.getElementById('addSkillBtn').addEventListener('click', () => {
    const input = document.getElementById('newSkill');
    const value = input.value.trim();
    if (!value) return;
    if (resumeDraft.skills.includes(value)) {
      showToast('Навык уже добавлен', 'info');
      return;
    }
    resumeDraft.skills.push(value);
    addSkillChip(value);
    input.value = '';
    input.focus();
  });

  // Добавление записи об опыте
  document.getElementById('addExpBtn').addEventListener('click', () => {
    addExpRow({ position: '', company: '', years: '', description: '' });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    resumeDraft.name = f.name.value.trim();
    resumeDraft.phone = f.phone.value.trim();
    resumeDraft.city = f.city.value.trim();
    resumeDraft.birthDate = f.birthDate.value;
    resumeDraft.summary = f.summary.value.trim();
    resumeDraft.education = f.education.value.trim();

    // Собираем опыт из строк формы
    resumeDraft.experience = Array.from(document.querySelectorAll('.exp-row')).map((row) => ({
      position: row.querySelector('.exp-position').value.trim(),
      company: row.querySelector('.exp-company').value.trim(),
      years: row.querySelector('.exp-years').value.trim(),
      description: row.querySelector('.exp-desc').value.trim(),
    })).filter((xp) => xp.position || xp.company);

    if (!resumeDraft.name) {
      showToast('Укажите имя', 'error');
      return;
    }
    resumeDraft.updatedAt = new Date().toISOString().slice(0, 10);
    ResumeStore.save(resumeDraft);
    bootstrap.Modal.getInstance(modalEl).hide();
    showToast('Резюме сохранено', 'success');
    renderProfile();
  });
}

function addSkillChip(skill) {
  const chip = document.createElement('span');
  chip.className = 'skill-chip';
  chip.innerHTML = `
    ${esc(skill)}
    <button type="button" class="skill-remove" aria-label="Удалить навык ${esc(skill)}">&times;</button>`;
  chip.querySelector('.skill-remove').addEventListener('click', () => {
    resumeDraft.skills = resumeDraft.skills.filter((s) => s !== skill);
    chip.remove();
  });
  document.getElementById('skillsList').appendChild(chip);
}

function addExpRow(xp) {
  const row = document.createElement('div');
  row.className = 'exp-row card border-0 bg-light p-3 mb-3';
  row.innerHTML = `
    <div class="row g-2">
      <div class="col-md-4">
        <label class="form-label">Должность</label>
        <input type="text" class="form-control form-control-sm exp-position" value="${esc(xp.position)}" placeholder="Frontend-разработчик">
      </div>
      <div class="col-md-4">
        <label class="form-label">Компания</label>
        <input type="text" class="form-control form-control-sm exp-company" value="${esc(xp.company)}" placeholder="ООО «Пример»">
      </div>
      <div class="col-md-4">
        <label class="form-label">Период</label>
        <input type="text" class="form-control form-control-sm exp-years" value="${esc(xp.years)}" placeholder="2022 — н.в.">
      </div>
      <div class="col-12">
        <label class="form-label">Описание</label>
        <textarea class="form-control form-control-sm exp-desc" rows="2" placeholder="Чем занимались">${esc(xp.description)}</textarea>
      </div>
    </div>
    <div class="text-end mt-2">
      <button type="button" class="btn btn-sm btn-outline-danger exp-remove"><i class="bi bi-trash me-1"></i>Удалить</button>
    </div>`;
  row.querySelector('.exp-remove').addEventListener('click', () => row.remove());
  document.getElementById('expList').appendChild(row);
}