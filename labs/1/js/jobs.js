/* ==========================================================================
   JobHub — страница поиска вакансий: фильтры, сортировка, пагинация, отклики
   ========================================================================== */

'use strict';

const PAGE_SIZE = 6;

let jobsState = {
  q: '',
  industry: '',
  experience: '',
  format: '',
  salaryMin: '',
  salaryMax: '',
  sort: 'new',
  page: 1,
};

document.addEventListener('DOMContentLoaded', () => {
  initDB();
  readFiltersFromUrl();
  bindFilterControls();
  renderJobs();
});

/* ---------- Фильтры из URL (для ссылок с главной и страницы вакансии) ---------- */

function readFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  jobsState.q = params.get('q') || '';
  jobsState.industry = params.get('industry') || '';
  jobsState.experience = params.get('experience') || '';
  jobsState.format = params.get('format') || '';
  jobsState.salaryMin = params.get('salaryMin') || '';
  jobsState.salaryMax = params.get('salaryMax') || '';
  jobsState.sort = params.get('sort') || 'new';

  document.getElementById('searchQ').value = jobsState.q;
  document.getElementById('filterIndustry').value = jobsState.industry;
  document.getElementById('filterExperience').value = jobsState.experience;
  document.getElementById('filterFormat').value = jobsState.format;
  document.getElementById('filterSalaryMin').value = jobsState.salaryMin;
  document.getElementById('filterSalaryMax').value = jobsState.salaryMax;
  document.getElementById('sortSelect').value = jobsState.sort;
}

/* ---------- Обработчики ---------- */

function bindFilterControls() {
  const onInput = () => {
    jobsState.q = document.getElementById('searchQ').value.trim();
    jobsState.industry = document.getElementById('filterIndustry').value;
    jobsState.experience = document.getElementById('filterExperience').value;
    jobsState.format = document.getElementById('filterFormat').value;
    jobsState.salaryMin = document.getElementById('filterSalaryMin').value;
    jobsState.salaryMax = document.getElementById('filterSalaryMax').value;
    jobsState.sort = document.getElementById('sortSelect').value;
    jobsState.page = 1;
    syncUrl();
    renderJobs();
  };

  ['searchQ', 'filterIndustry', 'filterExperience', 'filterFormat', 'sortSelect'].forEach((id) => {
    document.getElementById(id).addEventListener('change', onInput);
  });

  // Задержка ввода для текстового поиска
  let timer;
  document.getElementById('searchQ').addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(onInput, 350);
  });

  document.getElementById('filterSalaryMin').addEventListener('input', onInput);
  document.getElementById('filterSalaryMax').addEventListener('input', onInput);

  document.getElementById('resetFilters').addEventListener('click', () => {
    jobsState = {
      q: '', industry: '', experience: '', format: '',
      salaryMin: '', salaryMax: '', sort: 'new', page: 1,
    };
    ['searchQ', 'filterIndustry', 'filterExperience', 'filterFormat', 'filterSalaryMin', 'filterSalaryMax']
      .forEach((id) => (document.getElementById(id).value = ''));
    document.getElementById('sortSelect').value = 'new';
    syncUrl();
    renderJobs();
  });
}

function syncUrl() {
  const params = new URLSearchParams();
  Object.entries(jobsState).forEach(([k, v]) => {
    if (v !== '' && k !== 'page') params.set(k, v);
  });
  history.replaceState(null, '', 'jobs.html?' + params.toString());
}

/* ---------- Фильтрация и сортировка ---------- */

function getFilteredVacancies() {
  let list = VacancyStore.active();
  const { q, industry, experience, format, salaryMin, salaryMax } = jobsState;

  if (q) {
    const needle = q.toLowerCase();
    list = list.filter(
      (v) =>
        v.title.toLowerCase().includes(needle) ||
        v.company.name.toLowerCase().includes(needle) ||
        v.location.toLowerCase().includes(needle)
    );
  }
  if (industry) list = list.filter((v) => v.industry === industry);
  if (experience) list = list.filter((v) => v.experience === experience);
  if (format) list = list.filter((v) => v.format === format);
  if (salaryMin) list = list.filter((v) => (v.salaryMax || v.salaryMin || 0) >= Number(salaryMin));
  if (salaryMax) list = list.filter((v) => (v.salaryMin || 0) <= Number(salaryMax));

  switch (jobsState.sort) {
    case 'salary_desc':
      list.sort((a, b) => (b.salaryMax || b.salaryMin || 0) - (a.salaryMax || a.salaryMin || 0));
      break;
    case 'salary_asc':
      list.sort((a, b) => (a.salaryMin || 0) - (b.salaryMin || 0));
      break;
    default:
      list.sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
  }
  return list;
}

/* ---------- Рендер ---------- */

function renderJobs() {
  const list = getFilteredVacancies();
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  jobsState.page = Math.min(jobsState.page, pages);

  const slice = list.slice((jobsState.page - 1) * PAGE_SIZE, jobsState.page * PAGE_SIZE);
  const container = document.getElementById('jobsList');
  const emptyBox = document.getElementById('emptyState');

  document.getElementById('resultsCount').textContent = total;

  if (!slice.length) {
    container.innerHTML = '';
    emptyBox.hidden = false;
    renderPagination(1);
    return;
  }
  emptyBox.hidden = true;
  container.innerHTML = slice.map(vacancyCard).join('');
  renderPagination(pages);
}

function vacancyCard(v) {
  const fmt = FORMAT_OPTIONS.find((o) => o.value === v.format);
  const isNew = Date.now() - new Date(v.postedAt).getTime() < 3 * 86400000;
  return `
    <article class="job-card d-flex flex-column">
      <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
        <h2 class="job-title mb-0">
          <a href="job.html?id=${encodeURIComponent(v.id)}">${esc(v.title)}</a>
        </h2>
        ${isNew ? '<span class="badge badge-soft badge-new">Новая</span>' : ''}
      </div>

      <div class="company-chip mb-2">
        <span class="avatar-circle" style="width:30px;height:30px;font-size:0.7rem;background:${colorForName(v.company.name)}">
          ${initials(v.company.name)}
        </span>
        ${esc(v.company.name)}
      </div>

      <p class="salary-line mb-2">${salaryText(v.salaryMin, v.salaryMax)}</p>

      <div class="d-flex flex-wrap gap-1 mb-3">
        <span class="badge badge-soft badge-industry">${esc(v.industry)}</span>
        <span class="badge badge-soft badge-exp">${expLabel(v.experience)}</span>
        ${fmt ? `<span class="badge badge-soft badge-format"><i class="bi ${fmt.icon} me-1"></i>${fmt.label}</span>` : ''}
        <span class="badge badge-soft badge-location"><i class="bi bi-geo-alt me-1"></i>${esc(v.location)}</span>
      </div>

      <div class="mt-auto d-flex justify-content-between align-items-center pt-2 border-top">
        <span class="posted-at"><i class="bi bi-clock me-1"></i>${timeAgo(v.postedAt)}</span>
        <button class="btn btn-sm ${isApplied(v.id) ? 'btn-light-soft' : 'btn-brand'}"
                data-apply="${v.id}" ${isApplied(v.id) ? 'disabled' : ''}>
          ${isApplied(v.id) ? '<i class="bi bi-check2 me-1"></i>Отклик отправлен' : '<i class="bi bi-send me-1"></i>Откликнуться'}
        </button>
      </div>
    </article>`;
}

function isApplied(vacancyId) {
  const user = Auth.currentUser();
  return user ? ApplicationStore.exists(user.id, vacancyId) : false;
}

function renderPagination(pages) {
  const pag = document.getElementById('pagination');
  if (pages <= 1) {
    pag.innerHTML = '';
    return;
  }
  const cur = jobsState.page;
  const items = [];
  items.push(`
    <li class="page-item ${cur === 1 ? 'disabled' : ''}">
      <button class="page-link" data-page="${cur - 1}" aria-label="Назад">&laquo;</button>
    </li>`);
  for (let p = 1; p <= pages; p++) {
    items.push(`
      <li class="page-item ${p === cur ? 'active' : ''}">
        <button class="page-link" data-page="${p}">${p}</button>
      </li>`);
  }
  items.push(`
    <li class="page-item ${cur === pages ? 'disabled' : ''}">
      <button class="page-link" data-page="${cur + 1}" aria-label="Вперёд">&raquo;</button>
    </li>`);
  pag.innerHTML = items.join('');

  pag.querySelectorAll('[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      jobsState.page = Math.min(Math.max(1, Number(btn.dataset.page)), pages);
      renderJobs();
      document.querySelector('.jobs-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

/* ---------- Отклик на вакансию ---------- */

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-apply]');
  if (!btn) return;
  const vacancyId = btn.dataset.apply;

  requireLogin((user) => {
    const app = ApplicationStore.add(vacancyId, user.id);
    if (app) {
      showToast('Отклик отправлен! Работодатель скоро его увидит.', 'success');
    } else {
      showToast('Вы уже откликались на эту вакансию', 'info');
    }
    renderJobs();
  });
});