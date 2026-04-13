'use strict';

(function initAdminPanel() {
  const fallbackTeamCards = [
    { id: 'team-patron', label: 'Dr. Nagendra Parashar (Patron)' },
    { id: 'team-cio', label: 'Dr. Rohini Nagapadma (Patron)' },
    { id: 'team-chief-advisor-me', label: 'Dr. H N Divakar (Chief Advisor)' },
    { id: 'team-chief-advisor-ec', label: 'Dr. Rajalekshmi Kishore (Chief Advisor)' },
    { id: 'team-advisor-ashok', label: 'Dr. Ashok K (Faculty Advisor)' },
    { id: 'team-advisor-anand', label: 'Dr. Anand A (Faculty Advisor)' },
    { id: 'team-student-president', label: 'Student President' },
    { id: 'team-president-elect', label: 'President-Elect' },
    { id: 'team-head-technical', label: 'Head - Technical Core' },
    { id: 'team-head-operations', label: 'Head - Operations & Safety' },
    { id: 'team-head-training', label: 'Head - Training, Events & Outreach' },
    { id: 'team-head-documentation', label: 'Head - Documentation & Media' },
    { id: 'team-exec-1', label: 'Executive Member 01' },
    { id: 'team-exec-2', label: 'Executive Member 02' },
    { id: 'team-exec-3', label: 'Executive Member 03' },
    { id: 'team-exec-4', label: 'Executive Member 04' }
  ];

  const state = {
    teamCards: fallbackTeamCards,
    content: {
      teamPhotos: {},
      events: []
    },
    editingEventId: null
  };

  const loginPanel = document.getElementById('login-panel');
  const dashboard = document.getElementById('dashboard');
  const loginForm = document.getElementById('login-form');
  const loginStatus = document.getElementById('login-status');
  const logoutBtn = document.getElementById('logout-btn');
  const adminUser = document.getElementById('admin-user');

  const teamForm = document.getElementById('team-photo-form');
  const teamSelect = document.getElementById('team-id');
  const teamStatus = document.getElementById('team-status');
  const teamPhotoGrid = document.getElementById('team-photo-grid');

  const eventForm = document.getElementById('event-form');
  const eventIdInput = document.getElementById('event-id');
  const eventTitleInput = document.getElementById('event-title');
  const eventTypeInput = document.getElementById('event-type');
  const eventDateInput = document.getElementById('event-date');
  const eventDescriptionInput = document.getElementById('event-description');
  const eventPhotoInput = document.getElementById('event-photo');
  const eventRemovePhotoInput = document.getElementById('event-remove-photo');
  const removePhotoWrap = document.getElementById('remove-photo-wrap');
  const eventSubmitBtn = document.getElementById('event-submit-btn');
  const eventCancelBtn = document.getElementById('event-cancel-btn');
  const eventStatus = document.getElementById('event-status');
  const eventAdminList = document.getElementById('event-admin-list');

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function setStatus(element, message, type) {
    if (!element) return;
    element.classList.remove('success', 'error', 'info');
    if (type) {
      element.classList.add(type);
    }
    element.textContent = message || '';
  }

  async function requestJson(url, options) {
    const response = await fetch(url, {
      credentials: 'include',
      ...(options || {})
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error((payload && payload.message) || 'Request failed.');
    }

    return payload;
  }

  function formatEventDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function showDashboard(username) {
    loginPanel.classList.add('hidden');
    dashboard.classList.remove('hidden');
    logoutBtn.classList.remove('hidden');
    adminUser.textContent = username ? `Signed in as ${username}` : 'Signed in';
  }

  function showLogin() {
    dashboard.classList.add('hidden');
    logoutBtn.classList.add('hidden');
    loginPanel.classList.remove('hidden');
    adminUser.textContent = '';
  }

  function resetEventForm() {
    state.editingEventId = null;
    eventIdInput.value = '';
    eventForm.reset();
    eventSubmitBtn.textContent = 'Create Event';
    eventCancelBtn.classList.add('hidden');
    removePhotoWrap.classList.add('hidden');
    setStatus(eventStatus, '', 'info');
  }

  function renderTeamSelect() {
    teamSelect.innerHTML = state.teamCards
      .map((card) => `<option value="${escapeHtml(card.id)}">${escapeHtml(card.label)}</option>`)
      .join('');
  }

  function renderTeamPhotoGrid() {
    const teamPhotos = state.content.teamPhotos || {};

    teamPhotoGrid.innerHTML = state.teamCards
      .map((card) => {
        const photoUrl = teamPhotos[card.id];
        const media = photoUrl
          ? `<img class="team-photo-thumb" src="${escapeHtml(photoUrl)}?v=${Date.now()}" alt="${escapeHtml(card.label)}" />`
          : '<div class="team-photo-thumb"></div>';

        return `
          <div class="team-photo-item">
            ${media}
            <div class="team-photo-label">${escapeHtml(card.label)}</div>
          </div>
        `;
      })
      .join('');
  }

  function renderEventAdminList() {
    const events = Array.isArray(state.content.events) ? state.content.events : [];

    if (!events.length) {
      eventAdminList.innerHTML = '<p class="panel-copy">No events saved yet.</p>';
      return;
    }

    eventAdminList.innerHTML = events
      .map((event) => {
        const eventType = event.type || 'Club Event';
        const eventDate = formatEventDate(event.date);
        const photoMarkup = event.photoUrl
          ? `<img class="event-admin-photo" src="${escapeHtml(event.photoUrl)}?v=${Date.now()}" alt="${escapeHtml(event.title)}" />`
          : '<div class="event-admin-photo"></div>';

        return `
          <article class="event-admin-card" data-event-id="${escapeHtml(event.id)}">
            ${photoMarkup}
            <div class="event-admin-body">
              <span class="event-admin-type">${escapeHtml(eventType)}</span>
              <h3 class="event-admin-title">${escapeHtml(event.title)}</h3>
              <p class="event-admin-date">${escapeHtml(eventDate)}</p>
              <p class="event-admin-desc">${escapeHtml(event.description)}</p>
              <div class="event-admin-actions">
                <button type="button" data-action="edit" data-id="${escapeHtml(event.id)}">Edit</button>
                <button type="button" data-action="delete" data-id="${escapeHtml(event.id)}">Delete</button>
              </div>
            </div>
          </article>
        `;
      })
      .join('');
  }

  async function refreshContent() {
    const content = await requestJson('/api/public/content');
    state.content = {
      teamPhotos: content.teamPhotos || {},
      events: Array.isArray(content.events) ? content.events : []
    };
    renderTeamPhotoGrid();
    renderEventAdminList();
  }

  async function refreshTeamCards() {
    try {
      const payload = await requestJson('/api/public/team-cards');
      if (Array.isArray(payload.teamCards) && payload.teamCards.length) {
        state.teamCards = payload.teamCards;
      }
    } catch {
      state.teamCards = fallbackTeamCards;
    }
    renderTeamSelect();
  }

  function beginEditEvent(eventId) {
    const events = Array.isArray(state.content.events) ? state.content.events : [];
    const found = events.find((event) => event.id === eventId);
    if (!found) return;

    state.editingEventId = found.id;
    eventIdInput.value = found.id;
    eventTitleInput.value = found.title || '';
    eventTypeInput.value = found.type || '';
    eventDateInput.value = found.date || '';
    eventDescriptionInput.value = found.description || '';
    eventPhotoInput.value = '';
    eventRemovePhotoInput.checked = false;

    removePhotoWrap.classList.toggle('hidden', !found.photoUrl);
    eventSubmitBtn.textContent = 'Save Changes';
    eventCancelBtn.classList.remove('hidden');
    setStatus(eventStatus, `Editing: ${found.title}`, 'info');
  }

  async function deleteEvent(eventId) {
    const shouldDelete = window.confirm('Delete this event? This action cannot be undone.');
    if (!shouldDelete) return;

    try {
      await requestJson(`/api/admin/events/${encodeURIComponent(eventId)}`, {
        method: 'DELETE'
      });
      setStatus(eventStatus, 'Event deleted.', 'success');
      await refreshContent();
      if (state.editingEventId === eventId) {
        resetEventForm();
      }
    } catch (error) {
      setStatus(eventStatus, error.message, 'error');
    }
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();

    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();

    if (!username || !password) {
      setStatus(loginStatus, 'Username and password are required.', 'error');
      return;
    }

    try {
      const payload = await requestJson('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      showDashboard(payload.username || username);
      setStatus(loginStatus, '', 'info');
      await refreshTeamCards();
      await refreshContent();
      resetEventForm();
    } catch (error) {
      setStatus(loginStatus, error.message, 'error');
    }
  }

  async function handleLogoutClick() {
    try {
      await requestJson('/api/admin/logout', {
        method: 'POST'
      });
    } finally {
      showLogin();
      setStatus(loginStatus, 'Signed out.', 'info');
    }
  }

  async function handleTeamFormSubmit(event) {
    event.preventDefault();

    const formData = new FormData(teamForm);
    const photoFile = formData.get('photo');

    if (!photoFile || !photoFile.name) {
      setStatus(teamStatus, 'Choose a photo to upload.', 'error');
      return;
    }

    try {
      await requestJson('/api/admin/team/photo', {
        method: 'POST',
        body: formData
      });

      setStatus(teamStatus, 'Team photo updated successfully.', 'success');
      teamForm.reset();
      await refreshContent();
    } catch (error) {
      setStatus(teamStatus, error.message, 'error');
    }
  }

  async function handleEventFormSubmit(event) {
    event.preventDefault();

    const title = eventTitleInput.value.trim();
    if (!title) {
      setStatus(eventStatus, 'Event title is required.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('type', eventTypeInput.value.trim());
    formData.append('date', eventDateInput.value);
    formData.append('description', eventDescriptionInput.value.trim());

    const photoFile = eventPhotoInput.files[0];
    if (photoFile) {
      formData.append('photo', photoFile);
    }

    if (state.editingEventId && eventRemovePhotoInput.checked) {
      formData.append('removePhoto', 'true');
    }

    try {
      if (state.editingEventId) {
        await requestJson(`/api/admin/events/${encodeURIComponent(state.editingEventId)}`, {
          method: 'PUT',
          body: formData
        });
        setStatus(eventStatus, 'Event updated successfully.', 'success');
      } else {
        await requestJson('/api/admin/events', {
          method: 'POST',
          body: formData
        });
        setStatus(eventStatus, 'Event created successfully.', 'success');
      }

      await refreshContent();
      resetEventForm();
    } catch (error) {
      setStatus(eventStatus, error.message, 'error');
    }
  }

  async function checkAuthOnLoad() {
    try {
      const payload = await requestJson('/api/admin/me');
      if (payload.authenticated) {
        showDashboard(payload.username || 'admin');
        await refreshTeamCards();
        await refreshContent();
        resetEventForm();
      } else {
        showLogin();
      }
    } catch {
      showLogin();
      setStatus(loginStatus, 'Start the backend server to use admin login.', 'error');
    }
  }

  loginForm.addEventListener('submit', handleLoginSubmit);
  logoutBtn.addEventListener('click', handleLogoutClick);
  teamForm.addEventListener('submit', handleTeamFormSubmit);
  eventForm.addEventListener('submit', handleEventFormSubmit);
  eventCancelBtn.addEventListener('click', resetEventForm);

  eventAdminList.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const action = target.getAttribute('data-action');
    const eventId = target.getAttribute('data-id');
    if (!action || !eventId) return;

    if (action === 'edit') {
      beginEditEvent(eventId);
      return;
    }

    if (action === 'delete') {
      deleteEvent(eventId);
    }
  });

  checkAuthOnLoad();
})();
