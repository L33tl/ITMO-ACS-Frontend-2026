/* ==========================================================================
   JobHub — страница деталей вакансии (job.html?id=...)
   ========================================================================== */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  initDB();
  renderVacancyDetails();
});

function renderVacancyDetails() {
  const id = getQueryParam('id');
  const vacancy = id ? VacancyStore.byId(id) : null;

  if (!vacancy || !vacancy.active) {
    document.getElementById('vacancyContent').innerHTML = `
      <div class="empty-state">
        <i class="bi bi-file-earmark-x"></i>
        <h2 class="h5 mt-3">Вакансия не найдена</h2>
        <p>Возможно, она была снята с публикации или ссылка устарела.</p>
        <a href="jobs.html" class="btn btn-brand mt-2">Вернуться к поиску</a>
      </div>`;
    return;
  }

  document.title = `${vacancy.title} — ${vacancy.company.name} | JobHub`;

  const fmt = FORMAT_OPTIONS.find((o) => o.value === vacancy.format);
  const applied = Auth.currentUser() ? ApplicationStore.exists(Auth.currentUser().id, vacancy.id) : false;

  document.getElementById('vacancyContent').innerHTML = `
    <div class="vacancy-hero-card p-4 mb-4">
      <div class="row g-4 align-items-start">
        <div class="col-auto">
          <div class="company-logo-lg" style="background:${colorForName(vacancy.company.name)}">${initials(vacancy.company.name)}</div>
        </div>
        <div class="col">
          <h1 class="h3 fw-bold mb-2">${esc(vacancy.title)}</h1>
          <p class="mb-2">
            <a href="#company" class="fw-semibold link-plain">${esc(vacancy.company.name)}</a>
            <span class="text-muted">· ${esc(vacancy.location)}</span>
          </p>
          <div class="d-flex flex-wrap gap-1">
            <span class="badge badge-soft badge-industry">${esc(vacancy.industry)}</span>
            <span class="badge badge-soft badge-exp">${expLabel(vacancy.experience)}</span>
            ${fmt ? `<span class="badge badge-soft badge-format"><i class="bi ${fmt.icon} me-1"></i>${fmt.label}</span>` : ''}
            <span class="badge badge-soft badge-location"><i class="bi bi-geo-alt me-1"></i>${esc(vacancy.location)}</span>
          </div>
        </div>
        <div class="col-lg-auto text-lg-end">
          <div class="salary-line fs-4 mb-2">${salaryText(vacancy.salaryMin, vacancy.salaryMax)}</div>
          <span class="posted-at">Опубликовано: ${timeAgo(vacancy.postedAt)}</span>
        </div>
      </div>
    </div>

    <div class="row g-4">
      <div class="col-lg-8">
        <section class="content-card mb-4">
          <h2><i class="bi bi-file-text me-2 text-primary"></i>Описание вакансии</h2>
          ${vacancy.description.split('\n\n').map((p) => `<p class="mb-3">${esc(p)}</p>`).join('')}
        </section>

        <section class="content-card mb-4">
          <h2><i class="bi bi-list-check me-2 text-primary"></i>Требования</h2>
          <ul class="list-checks">
            ${vacancy.requirements.map((r) => `<li>${esc(r)}</li>`).join('')}
          </ul>
        </section>

        <section class="content-card mb-4">
          <h2><i class="bi bi-gift me-2 text-primary"></i>Что мы предлагаем</h2>
          <ul class="list-dots">
            ${vacancy.offers.map((o) => `<li>${esc(o)}</li>`).join('')}
          </ul>
        </section>
      </div>

      <div class="col-lg-4">
        <div class="content-card mb-4 sticky-lg-top" style="top:88px">
          <button class="btn btn-brand w-100 btn-lg mb-3" data-apply="${vacancy.id}" ${applied ? 'disabled' : ''}>
            ${applied
              ? '<i class="bi bi-check2 me-2"></i>Отклик отправлен'
              : '<i class="bi bi-send me-2"></i>Откликнуться'}
          </button>
          <p class="small text-muted mb-0 text-center">
            Работодатель получит ваше резюме и свяжется с вами в течение нескольких дней.
          </p>
        </div>

        <section class="content-card mb-4" id="company">
          <h2><i class="bi bi-building me-2 text-primary"></i>О компании</h2>
          <div class="d-flex align-items-center gap-2 mb-2">
            <span class="avatar-circle" style="background:${colorForName(vacancy.company.name)}">${initials(vacancy.company.name)}</span>
            <div>
              <div class="fw-bold">${esc(vacancy.company.name)}</div>
              <div class="small text-muted">${esc(vacancy.company.city)} · ${esc(vacancy.company.employees)} сотрудников</div>
            </div>
          </div>
          <p class="small mb-2">${esc(vacancy.company.about)}</p>
          ${vacancy.company.website ? `<p class="small mb-0"><i class="bi bi-globe2 me-1"></i><a href="https://${esc(vacancy.company.website)}" target="_blank" rel="noopener">${esc(vacancy.company.website)}</a></p>` : ''}
        </section>

        <div class="content-card">
          <h2><i class="bi bi-shield-check me-2 text-primary"></i>Параметры</h2>
          <div class="info-tile mb-2">
            <div class="label">Формат работы</div>
            <div class="value">${fmt ? fmt.label : '—'}</div>
          </div>
          <div class="info-tile mb-2">
            <div class="label">Опыт работы</div>
            <div class="value">${expLabel(vacancy.experience)}</div>
          </div>
          <div class="info-tile">
            <div class="label">Город</div>
            <div class="value">${esc(vacancy.location)}</div>
          </div>
        </div>
      </div>
    </div>

    <section class="mt-5">
      <div class="d-flex align-items-end justify-content-between mb-3">
        <div>
          <span class="eyebrow mb-2">Рекомендации</span>
          <h2 class="section-title h4 mb-0">Похожие вакансии</h2>
        </div>
        <a href="jobs.html?industry=${encodeURIComponent(vacancy.industry)}" class="btn btn-outline-brand btn-sm">
          Все в отрасли «${esc(vacancy.industry)}» <i class="bi bi-arrow-right ms-1"></i>
        </a>
      </div>
      <div class="row g-3" id="similarJobs"></div>
    </section>`;

  // Похожие вакансии: та же отрасль (или любой опыт), максимум 3
  const similar = VacancyStore.active()
    .filter((v) => v.id !== vacancy.id && v.industry === vacancy.industry)
    .slice(0, 3);

  document.getElementById('similarJobs').innerHTML = similar.length
    ? similar.map(similarCard).join('')
    : '<div class="col-12"><p class="text-muted">Пока нет похожих вакансий.</p></div>';
}

function similarCard(v) {
  return `
    <div class="col-md-4">
      <article class="job-card d-flex flex-column">
        <h3 class="job-title h6 mb-1">
          <a href="job.html?id=${encodeURIComponent(v.id)}">${esc(v.title)}</a>
        </h3>
        <div class="company-chip small mb-1">${esc(v.company.name)}</div>
        <div class="salary-line small mb-2">${salaryText(v.salaryMin, v.salaryMax)}</div>
        <div class="d-flex flex-wrap gap-1 mb-2">
          <span class="badge badge-soft badge-exp">${expLabel(v.experience)}</span>
          <span class="badge badge-soft badge-location"><i class="bi bi-geo-alt me-1"></i>${esc(v.location)}</span>
        </div>
        <a href="job.html?id=${encodeURIComponent(v.id)}" class="mt-auto small fw-semibold">
          Подробнее <i class="bi bi-arrow-right"></i>
        </a>
      </article>
    </div>`;
}

// Отклик на вакансию
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
    renderVacancyDetails();
  });
});