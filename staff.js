import { API_BASE } from './api-config.js';
const STORAGE_KEY_TOKEN = 'zigzagStaffToken';

const state = {
  token: null,
  user: null,
  barbers: [],
  appointments: [],
  dayOffs: [],
  serviceList: [],
  availabilityTimes: [],
  blockedPhones: [],
  currentApptMonth: new Date(),
  currentDayoffMonth: new Date(),
  selectedApptDate: null,
  selectedDayoffDate: null,
};

const elements = {
  loginSection: document.getElementById('login-section'),
  dashboardSection: document.getElementById('dashboard-section'),
  loginForm: document.getElementById('staff-login-form'),
  loginEmail: document.getElementById('staff-email'),
  loginPassword: document.getElementById('staff-password'),
  dashboardTitle: document.getElementById('staff-dashboard-title'),
  logoutButton: document.getElementById('staff-logout-button'),
  appointmentsCalendar: document.getElementById('appointments-calendar'),
  currentApptMonth: document.getElementById('current-appt-month'),
  prevApptMonthBtn: document.getElementById('prev-appt-month'),
  nextApptMonthBtn: document.getElementById('next-appt-month'),
  dayAppointmentsList: document.getElementById('day-appointments-list'),
  dayoffsCalendar: document.getElementById('dayoffs-calendar'),
  currentDayoffMonth: document.getElementById('current-dayoff-month'),
  prevDayoffMonthBtn: document.getElementById('prev-dayoff-month'),
  nextDayoffMonthBtn: document.getElementById('next-dayoff-month'),
  profileForm: document.getElementById('profile-form'),
  profileName: document.getElementById('profile-name'),
  profileBio: document.getElementById('profile-bio'),
  profileInstagram: document.getElementById('profile-instagram'),
  profileTiktok: document.getElementById('profile-tiktok'),
  profilePhotoFile: document.getElementById('profile-photo-file'),
  profilePhotoPreview: document.getElementById('profile-photo-preview'),
  workPhotoFiles: document.getElementById('work-photo-files'),
  workPhotoPreview: document.getElementById('work-photo-preview'),
  currentWorkPhotoPreview: document.getElementById('current-work-photo-preview'),
  serviceCards: document.getElementById('service-cards'),
  serviceForm: document.getElementById('service-form'),
  serviceName: document.getElementById('service-name'),
  serviceDuration: document.getElementById('service-duration'),
  servicePhotoFile: document.getElementById('service-photo-file'),
  servicePhotoPreview: document.getElementById('service-photo-preview'),
  availabilityForm: document.getElementById('availability-form'),
  availabilityTime: document.getElementById('availability-time'),
  availabilityList: document.getElementById('availability-list'),
  blockedPhoneForm: document.getElementById('blocked-phone-form'),
  blockedPhoneNumber: document.getElementById('blocked-phone-number'),
  blockedPhoneReason: document.getElementById('blocked-phone-reason'),
  blockedPhoneList: document.getElementById('blocked-phone-list'),
  createBarberForm: document.getElementById('create-barber-form'),
  newBarberName: document.getElementById('new-barber-name'),
  newBarberEmail: document.getElementById('new-barber-email'),
  newBarberPassword: document.getElementById('new-barber-password'),
  newBarberRole: document.getElementById('new-barber-role'),
  newBarberBio: document.getElementById('new-barber-bio'),
  newBarberInstagram: document.getElementById('new-barber-instagram'),
  newBarberTiktok: document.getElementById('new-barber-tiktok'),
  staffList: document.getElementById('staff-list'),
  dayoffForm: document.getElementById('dayoff-form'),
  dayoffDate: document.getElementById('dayoff-date'),
  dayoffRecurring: document.getElementById('dayoff-recurring'),
  dayoffNotes: document.getElementById('dayoff-notes'),
  dayoffsList: document.getElementById('dayoffs-list'),
  toast: document.getElementById('staff-toast'),
  tabButtons: document.querySelectorAll('.tab-button'),
};

function renderDashboardLoadingState() {
  if (elements.appointmentsCalendar) {
    elements.appointmentsCalendar.innerHTML = '<div class="barber-card-skeleton loading-skeleton"></div><div class="barber-card-skeleton loading-skeleton"></div><div class="barber-card-skeleton loading-skeleton"></div>';
  }
  if (elements.dayAppointmentsList) {
    elements.dayAppointmentsList.innerHTML = '<p class="form-note">Loading appointments...</p>';
  }
  if (elements.dayoffsList) {
    elements.dayoffsList.innerHTML = '<p class="form-note">Loading day offs...</p>';
  }
  if (elements.availabilityList) {
    elements.availabilityList.innerHTML = '<p class="form-note">Loading times...</p>';
  }
  if (elements.blockedPhoneList) {
    elements.blockedPhoneList.innerHTML = '<p class="form-note">Loading blocked numbers...</p>';
  }
}

function showToast(message) {
  if (!elements.toast) return;
  elements.toast.textContent = message;
  elements.toast.classList.remove('hidden');
  elements.toast.classList.add('show');
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => {
    elements.toast.classList.remove('show');
    elements.toast.classList.add('hidden');
  }, 3200);
}

function setAuthHeader(headers = {}) {
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }
  return headers;
}

async function apiCall(endpoint, options = {}) {
  const headers = { ...options.headers };
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  setAuthHeader(headers);
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(async () => {
        const text = await response.text().catch(() => 'Request failed');
        return { error: text };
      });
      throw new Error(errorData.error || response.statusText || 'Request failed');
    }
    return response.json().catch(() => ({}));
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Cannot reach backend API. Start the server through http://localhost:3000');
    }
    throw error;
  }
}

async function getAvailableSlots(barberId, date, serviceType = '', durationMinutes = '') {
  const params = new URLSearchParams({ barberId, date });
  if (serviceType) params.set('serviceType', serviceType);
  if (durationMinutes) params.set('durationMinutes', durationMinutes);
  return await apiCall(`/appointments/available?${params.toString()}`, {
    method: 'GET',
  });
}

function createModal(htmlContent) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-panel">
      <button class="close-btn" type="button">&times;</button>
      <div class="modal-content" style="padding: 24px; overflow-y: auto; width: 100%;">
        ${htmlContent}
      </div>
    </div>
  `;
  const closeButton = modal.querySelector('.close-btn');
  closeButton.addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (event) => {
    if (event.target === modal) modal.remove();
  });
  document.body.appendChild(modal);
  return modal;
}

async function openRescheduleModal(appointment) {
  const barber = state.barbers.find(b => b.id === appointment.barber_id);
  const barberName = barber ? barber.name : `Barber #${appointment.barber_id}`;
  let selectedDate = normalizeDateKey(appointment.appointment_date);
  let selectedTime = '';

  function renderSlots(availableTimes, isDayOff) {
    const slotsContainer = modal.querySelector('#reschedule-slots');
    slotsContainer.innerHTML = '';

    if (isDayOff) {
      const message = document.createElement('div');
      message.className = 'slot-message';
      message.textContent = 'This barber is off on the selected date. Choose another date.';
      slotsContainer.appendChild(message);
      return;
    }

    if (!availableTimes.length) {
      const message = document.createElement('div');
      message.className = 'slot-message';
      message.textContent = 'No available times for this date. Pick another date.';
      slotsContainer.appendChild(message);
      return;
    }

    availableTimes.forEach(time => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-small';
      button.style.margin = '4px 4px 0 0';
      button.textContent = time;
      button.addEventListener('click', () => {
        selectedTime = time;
        modal.querySelectorAll('#reschedule-slots button').forEach(btn => btn.classList.remove('selected'));
        button.classList.add('selected');
      });
      slotsContainer.appendChild(button);
    });
  }

  const html = `
    <h2>Reschedule Appointment</h2>
    <p><strong>Client:</strong> ${appointment.client_name}</p>
    <p><strong>Phone:</strong> ${appointment.client_phone}</p>
    <p><strong>Barber:</strong> ${barberName}</p>
    <p><strong>Current:</strong> ${normalizeDateKey(appointment.appointment_date)} at ${appointment.appointment_time}</p>
    <div style="margin-top: 20px; display: grid; gap: 16px;">
      <div>
        <label for="reschedule-date">New date</label>
        <input id="reschedule-date" type="date" value="${selectedDate}" style="width:100%; padding: 12px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.18); background: #0b090c; color: #fff;" />
      </div>
      <div>
        <label>Available times</label>
        <div id="reschedule-slots" style="display:flex; flex-wrap:wrap; gap:8px; margin-top:12px;"></div>
      </div>
      <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
        <button id="confirm-reschedule" class="btn btn-primary" type="button">Move appointment</button>
        <button id="cancel-reschedule" class="btn btn-secondary" type="button">Cancel</button>
      </div>
    </div>
  `;

  const modal = createModal(html);
  const dateInput = modal.querySelector('#reschedule-date');
  const confirmButton = modal.querySelector('#confirm-reschedule');
  const cancelButton = modal.querySelector('#cancel-reschedule');
  const minDate = formatDateForInput(new Date());
  dateInput.min = minDate;

  async function loadSlots(dateValue) {
    if (!dateValue) return;
    try {
      const { available, isDayOff } = await getAvailableSlots(
        appointment.barber_id,
        dateValue,
        appointment.service_type || '',
        appointment.duration_minutes || ''
      );
      renderSlots(available, isDayOff);
      selectedDate = dateValue;
      selectedTime = '';
    } catch (error) {
      const slotsContainer = modal.querySelector('#reschedule-slots');
      slotsContainer.innerHTML = `<div class="slot-message">Could not load slots: ${error.message}</div>`;
    }
  }

  dateInput.addEventListener('change', () => loadSlots(dateInput.value));
  cancelButton.addEventListener('click', () => modal.remove());

  confirmButton.addEventListener('click', async () => {
    if (!selectedDate || !selectedTime) {
      showToast('Select a new date and available time.');
      return;
    }

    try {
      await apiCall(`/appointments/${appointment.id}/reschedule`, {
        method: 'POST',
        body: JSON.stringify({ date: selectedDate, time: selectedTime }),
      });
      showToast('Appointment moved successfully.');
      modal.remove();
      await refreshAppointments();
    } catch (error) {
      showToast('Could not reschedule: ' + error.message);
    }
  });

  await loadSlots(selectedDate);
}

function saveSession(token, user) {
  state.token = token;
  state.user = { ...user, role: normalizeRole(user.role) };
  localStorage.setItem(STORAGE_KEY_TOKEN, token);
  localStorage.setItem('zigzagStaffUser', JSON.stringify(state.user));
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem(STORAGE_KEY_TOKEN);
  localStorage.removeItem('zigzagStaffUser');
  location.reload();
}

function normalizePhotoUrls(photoData) {
  if (!photoData) return [];
  if (Array.isArray(photoData)) return photoData.filter(Boolean);
  if (typeof photoData === 'string') {
    return photoData.split(',').map(url => url.trim()).filter(Boolean);
  }
  return [];
}

function normalizeDuration(value) {
  const duration = parseInt(value, 10);
  if (!Number.isFinite(duration)) return 60;
  return Math.min(Math.max(duration, 5), 480);
}

function parseServiceList(rawServices) {
  if (!rawServices) return [];
  if (Array.isArray(rawServices)) {
    return rawServices.map(item => {
      if (typeof item === 'string') return { name: item, photoUrl: '', durationMinutes: 60 };
      return { ...item, durationMinutes: normalizeDuration(item.durationMinutes || item.duration || 60) };
    });
  }
  if (typeof rawServices === 'string') {
    const trimmed = rawServices.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed)
          ? parsed.map(item => {
              if (typeof item === 'string') return { name: item, photoUrl: '', durationMinutes: 60 };
              return { ...item, durationMinutes: normalizeDuration(item.durationMinutes || item.duration || 60) };
            })
          : [];
      } catch {
        // fall through to legacy parsing
      }
    }
    const parts = trimmed.split(';').map(s => s.trim()).filter(Boolean);
    const services = [];
    parts.forEach(part => {
      const [category, items] = part.split(':').map(s => s.trim());
      if (!items) return;
      items.split(',').map(item => item.trim()).filter(Boolean).forEach(item => {
        services.push({ name: `${category} - ${item}`, photoUrl: '', durationMinutes: 60 });
      });
    });
    if (services.length) return services;
    return [{ name: trimmed, photoUrl: '', durationMinutes: 60 }];
  }
  return [];
}

function normalizeRole(role) {
  if (!role) return '';
  return String(role).trim().toUpperCase();
}

function normalizePhoneInput(phone) {
  return String(phone || '').replace(/[\s().-]/g, '').trim();
}

function formatRoleLabel(role) {
  switch (normalizeRole(role)) {
    case 'BOSS': return 'Boss';
    case 'SENIOR_BARBER': return 'Senior Barber';
    case 'JUNIOR_BARBER': return 'Junior Barber';
    case 'BARBER': return 'Barber';
    default: return role || 'Staff';
  }
}

function serializeServiceList(list) {
  return JSON.stringify(list.map(service => ({
    name: service.name || '',
    photoUrl: service.photoUrl || '',
    durationMinutes: normalizeDuration(service.durationMinutes || 60),
  })));
}

function normalizeDateKey(rawDate) {
  if (!rawDate) return '';

  if (typeof rawDate === 'string') {
    const match = rawDate.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }

  if (rawDate instanceof Date && !Number.isNaN(rawDate.getTime())) {
    const year = rawDate.getUTCFullYear();
    const month = String(rawDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(rawDate.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(rawDate);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getUTCFullYear();
    const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    const day = String(parsed.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return '';
}

function getProfilePhotoUrl(user) {
  if (!user) return '';
  return user.profile_photo_url || normalizePhotoUrls(user.photo_urls)[0] || '';
}

function renderImagePreview(container, urls, emptyText, removable = false, onRemove = null) {
  if (!container) return;
  container.innerHTML = '';
  const cleanUrls = normalizePhotoUrls(urls);
  if (!cleanUrls.length) {
    container.innerHTML = `<p>${emptyText}</p>`;
    return;
  }

  cleanUrls.forEach((url, index) => {
    const card = document.createElement('div');
    card.className = 'editable-photo-card';

    const img = document.createElement('img');
    img.src = url;
    img.alt = `Photo ${index + 1}`;

    card.appendChild(img);

    if (removable && onRemove) {
      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'photo-remove-btn';
      removeButton.textContent = '\u00d7';
      removeButton.addEventListener('click', () => onRemove(index));
      card.appendChild(removeButton);
    }

    container.appendChild(card);
  });
}

function renderFilePreview(input, container, emptyText) {
  if (!container || !input) return;
  const urls = [...input.files].map(file => URL.createObjectURL(file));
  renderImagePreview(container, urls, emptyText);
}

function renderServiceCards() {
  if (!elements.serviceCards) return;
  elements.serviceCards.innerHTML = '';
  if (!state.serviceList.length) {
    elements.serviceCards.innerHTML = '<p class="service-empty">No services yet. Add one below.</p>';
    return;
  }

  state.serviceList.forEach((service, index) => {
    const card = document.createElement('div');
    card.className = 'service-card';

    const image = document.createElement('div');
    image.className = 'service-card-image';
    if (service.photoUrl) {
      image.style.backgroundImage = `url('${service.photoUrl}')`;
    } else {
      image.textContent = 'No photo';
      image.classList.add('service-card-empty');
    }

    const title = document.createElement('div');
    title.className = 'service-card-name';
    title.textContent = service.name || 'Untitled service';

    const duration = document.createElement('div');
    duration.className = 'service-card-duration';
    duration.textContent = `${normalizeDuration(service.durationMinutes)} min`;

    const actions = document.createElement('div');
    actions.className = 'service-card-actions';

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'btn btn-small';
    editButton.textContent = 'Edit';
    editButton.addEventListener('click', () => populateServiceForm(index));

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'btn btn-secondary btn-small';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => deleteService(index));

    actions.appendChild(editButton);
    actions.appendChild(deleteButton);
    card.appendChild(image);
    card.appendChild(title);
    card.appendChild(duration);
    card.appendChild(actions);
    elements.serviceCards.appendChild(card);
  });
}

function populateServiceForm(index) {
  const service = state.serviceList[index];
  if (!service) return;
  elements.serviceName.value = service.name;
  elements.serviceDuration.value = normalizeDuration(service.durationMinutes);
  elements.servicePhotoFile.value = '';
  renderImagePreview(elements.servicePhotoPreview, service.photoUrl ? [service.photoUrl] : [], 'Choose a photo from your device.');
  elements.serviceForm.dataset.editIndex = String(index);
  elements.serviceForm.querySelector('button[type="submit"]').textContent = 'Update service';
}

function clearServiceForm() {
  elements.serviceName.value = '';
  elements.serviceDuration.value = '60';
  elements.servicePhotoFile.value = '';
  if (elements.servicePhotoPreview) {
    elements.servicePhotoPreview.innerHTML = 'Choose a photo from your device.';
  }
  delete elements.serviceForm.dataset.editIndex;
  elements.serviceForm.querySelector('button[type="submit"]').textContent = 'Save service';
}

async function deleteService(index) {
  state.serviceList.splice(index, 1);
  try {
    await saveCurrentServices();
    renderServiceCards();
    showToast('Service deleted.');
  } catch (error) {
    showToast('Could not delete service: ' + error.message);
  }
}

async function uploadFiles(files, type = 'photos') {
  const fileList = [...files];
  if (!fileList.length) return [];
  const formData = new FormData();
  formData.append('type', type);
  fileList.forEach(file => formData.append('photos', file));
  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${state.token}` },
    body: formData,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Upload failed');
  }
  const data = await response.json();
  return data.uploaded || [];
}

async function saveCurrentServices() {
  const updated = await apiCall(`/barbers/${state.user.id}`, {
    method: 'PUT',
    body: JSON.stringify({ services: serializeServiceList(state.serviceList) }),
  });
  state.user = { ...state.user, ...updated };
}

async function addOrUpdateService(event) {
  event.preventDefault();
  const name = elements.serviceName.value.trim();
  const durationMinutes = normalizeDuration(elements.serviceDuration.value);
  if (!name) {
    showToast('Service name is required.');
    return;
  }

  try {
    const existingIndex = Number(elements.serviceForm.dataset.editIndex);
    const existing = (!Number.isNaN(existingIndex) && existingIndex >= 0 && existingIndex < state.serviceList.length)
      ? state.serviceList[existingIndex]
      : null;
    const uploaded = await uploadFiles(elements.servicePhotoFile.files, 'services');
    const serviceData = { name, durationMinutes, photoUrl: uploaded[0] || existing?.photoUrl || '' };

    if (existing) {
      state.serviceList[existingIndex] = serviceData;
    } else {
      state.serviceList.push(serviceData);
    }

    await saveCurrentServices();
    renderServiceCards();
    clearServiceForm();
    showToast('Service saved.');
  } catch (error) {
    showToast('Service save failed: ' + error.message);
  }
}

function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDayOfWeekFromDateKey(dateKey) {
  const [year, month, day] = String(dateKey || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function formatIsoDateShort(rawDate) {
  if (!rawDate) return '';

  if (typeof rawDate === 'string') {
    const match = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[1]}.${match[2]}.${match[3]}`;
    }
  }

  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) {
    return rawDate;
  }
  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const day = String(parsed.getUTCDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

function formatDateDisplay(date) {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getDaysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function getFirstDayOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
}

function dateToDateKey(date) {
  return formatDateForInput(date);
}

async function login(email, password) {
  const data = await apiCall('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  saveSession(data.token, data.user);
  return data.user;
}

async function fetchCurrentUser() {
  const data = await apiCall('/auth/me', {
    method: 'GET',
  });
  state.user = { ...data.user, role: normalizeRole(data.user.role) };
  return state.user;
}

async function fetchBarbers() {
  const data = await apiCall('/barbers', { method: 'GET' });
  state.barbers = data.map(barber => ({ ...barber, role: normalizeRole(barber.role) }));
  return state.barbers;
}

async function fetchAppointments() {
  const data = await apiCall('/appointments', { method: 'GET' });
  // Regular barbers only see their own appointments. Boss/senior see the full shop.
  if (state.user && state.user.role !== 'BOSS' && state.user.role !== 'SENIOR_BARBER') {
    state.appointments = data.filter(appt => appt.barber_id === state.user.id);
  } else {
    state.appointments = data;
  }
  return state.appointments;
}

async function fetchAvailability() {
  const data = await apiCall('/availability/me', { method: 'GET' });
  state.availabilityTimes = data || [];
  return state.availabilityTimes;
}

async function fetchBlockedPhones() {
  const data = await apiCall('/blocked-phones', { method: 'GET' });
  state.blockedPhones = data || [];
  return state.blockedPhones;
}

async function fetchDayOffs() {
  const data = await apiCall('/dayoffs', { method: 'GET' });
  // Regular barbers only see their own day-offs. Boss/senior see the full shop.
  if (state.user && state.user.role !== 'BOSS' && state.user.role !== 'SENIOR_BARBER') {
    state.dayOffs = data.filter(dayOff => dayOff.barber_id === state.user.id);
  } else {
    state.dayOffs = data;
  }
  return state.dayOffs;
}

function renderTab(tabName) {
  elements.tabButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    const isActive = panel.id === `${tabName}-tab`;
    panel.classList.toggle('active', isActive);
    panel.classList.toggle('hidden', !isActive);
  });
}

function renderProfileForm() {
  if (!state.user) return;
  // Keep serviceList for now (will be migrated to dedicated services table later)
  	state.serviceList = parseServiceList(state.user.services);
  elements.profileName.value = state.user.name;
  elements.profileBio.value = state.user.bio || '';
  elements.profileInstagram.value = state.user.instagram || '';
  elements.profileTiktok.value = state.user.tiktok || '';
  clearServiceForm();
  renderServiceCards();
  renderProfilePhotoPreview();
  renderCurrentWorkPhotoPreview();
}

function renderProfilePhotoPreview() {
  const profileUrl = state.user?.profile_photo_url || '';
  renderImagePreview(elements.profilePhotoPreview, profileUrl ? [profileUrl] : [], 'No profile photo yet.', Boolean(profileUrl), async () => {
    try {
      const updated = await apiCall(`/barbers/${state.user.id}`, {
        method: 'PUT',
        body: JSON.stringify({ profilePhotoUrl: null }),
      });
      state.user = { ...state.user, ...updated };
      renderProfilePhotoPreview();
      showToast('Profile photo deleted.');
    } catch (error) {
      showToast('Could not delete profile photo: ' + error.message);
    }
  });
}

function renderCurrentWorkPhotoPreview() {
  const urls = normalizePhotoUrls(state.user.photo_urls);
  renderImagePreview(elements.currentWorkPhotoPreview, urls, 'No work photos yet.', true, async (index) => {
    const updatedUrls = urls.filter((_, idx) => idx !== index);
    try {
      const updated = await apiCall(`/barbers/${state.user.id}`, {
        method: 'PUT',
        body: JSON.stringify({ photoUrls: updatedUrls }),
      });
      state.user = { ...state.user, ...updated };
      renderCurrentWorkPhotoPreview();
      showToast('Work photo deleted.');
    } catch (error) {
      showToast('Could not delete photo: ' + error.message);
    }
  });
}

function renderAppointmentsCalendar() {
  const year = state.currentApptMonth.getFullYear();
  const month = state.currentApptMonth.getMonth();
  const daysInMonth = getDaysInMonth(state.currentApptMonth);
  const firstDay = getFirstDayOfMonth(state.currentApptMonth);

  // Update month display
  const monthName = state.currentApptMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  elements.currentApptMonth.textContent = monthName;

  // Create appointment map for quick lookup
  const appointmentMap = {};
  state.appointments.forEach(appt => {
    const dateKey = normalizeDateKey(appt.appointment_date);
    if (!appointmentMap[dateKey]) {
      appointmentMap[dateKey] = [];
    }
    appointmentMap[dateKey].push(appt);
  });

  // Clear calendar
  elements.appointmentsCalendar.innerHTML = '';

  const headerDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  headerDays.forEach(day => {
    const header = document.createElement('div');
    header.className = 'calendar-header';
    header.textContent = day;
    elements.appointmentsCalendar.appendChild(header);
  });

  const startOffset = (firstDay + 6) % 7;
  for (let i = 0; i < startOffset; i++) {
    const emptyDay = document.createElement('div');
    emptyDay.className = 'calendar-day other-month';
    elements.appointmentsCalendar.appendChild(emptyDay);
  }

  const today = new Date();
  const todayKey = formatDateForInput(today);

  // Add days of month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateKey = formatDateForInput(date);
    const dayElement = document.createElement('div');
    dayElement.className = 'calendar-day';

    if (dateKey === todayKey) {
      dayElement.classList.add('today');
    } else if (date < today) {
      dayElement.classList.add('past');
    }
    if (dateKey === state.selectedApptDate) {
      dayElement.classList.add('selected-day');
    }

    const appointments = appointmentMap[dateKey] || [];
    if (appointments.length > 0) {
      dayElement.classList.add('has-appointments');
    }

    const dayNumber = document.createElement('div');
    dayNumber.className = 'calendar-day-number';
    dayNumber.textContent = day;
    dayElement.appendChild(dayNumber);

    // Add appointment indicators
    if (appointments.length > 0) {
      const indicator = document.createElement('div');
      indicator.className = 'appointment-indicator';
      appointments.slice(0, 3).forEach(() => {
        const dot = document.createElement('div');
        dot.className = 'appointment-dot';
        indicator.appendChild(dot);
      });
      dayElement.appendChild(indicator);

      const appointmentCount = document.createElement('span');
      appointmentCount.className = 'calendar-day-count';
      appointmentCount.textContent = `${appointments.length} ${appointments.length === 1 ? 'booking' : 'bookings'}`;
      dayElement.appendChild(appointmentCount);
    }

    dayElement.addEventListener('click', () => {
      showDayAppointments(dateKey, appointments);
      renderAppointmentsCalendar();
    });

    elements.appointmentsCalendar.appendChild(dayElement);
  }

  const totalCells = startOffset + getDaysInMonth(state.currentApptMonth);
  const remainder = (7 - (totalCells % 7)) % 7;
  for (let i = 0; i < remainder; i++) {
    const emptyDay = document.createElement('div');
    emptyDay.className = 'calendar-day other-month';
    elements.appointmentsCalendar.appendChild(emptyDay);
  }
}

function showDayAppointments(dateKey, appointments) {
  state.selectedApptDate = dateKey;
  elements.dayAppointmentsList.innerHTML = `<h4>Appointments for ${formatIsoDateShort(dateKey)}</h4>`;
  
  if (!appointments.length) {
    elements.dayAppointmentsList.innerHTML += '<p>No appointments scheduled.</p>';
    return;
  }

  appointments.forEach(appt => {
    const barber = state.barbers.find(b => b.id === appt.barber_id);
    const barberLabel = barber ? barber.name : `Barber #${appt.barber_id}`;
    const item = document.createElement('div');
    item.className = 'dayoff-item';
    item.innerHTML = `
      <div class="dayoff-item-info">
        <strong>${appt.client_name} • ${appt.appointment_time}</strong>
        <p class="phone-number" data-phone="${appt.client_phone}">${appt.client_phone}</p>
        ${appt.service_type ? `<p><strong>Service:</strong> ${appt.service_type}</p>` : ''}
        ${state.user && state.user.role === 'BOSS' ? `<p><strong>Barber:</strong> ${barberLabel}</p>` : ''}
        <div class="dayoff-item-actions">
          <button class="btn btn-small open-reschedule" data-id="${appt.id}">Reschedule</button>
          <button class="btn btn-secondary btn-small block-appointment-phone" data-id="${appt.id}">Block phone</button>
          <button class="btn btn-small cancel-appointment" data-id="${appt.id}">Cancel</button>
        </div>
      </div>
    `;
    elements.dayAppointmentsList.appendChild(item);
  });

  // Add event listeners for phone number copying
  document.querySelectorAll('.phone-number').forEach(phoneEl => {
    phoneEl.addEventListener('click', () => {
      navigator.clipboard.writeText(phoneEl.dataset.phone).then(() => {
        showToast('Phone number copied to clipboard!');
      }).catch(err => {
        console.error('Failed to copy: ', err);
        showToast('Failed to copy phone number.');
      });
    });
  });

  // Add event listeners for reschedule and cancel buttons
  document.querySelectorAll('.open-reschedule').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const apptId = parseInt(e.target.dataset.id, 10);
      const appointment = state.appointments.find(appt => appt.id === apptId);
      if (!appointment) {
        showToast('Appointment not found.');
        return;
      }
      openRescheduleModal(appointment);
    });
  });

  document.querySelectorAll('.cancel-appointment').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const apptId = e.target.dataset.id;
      if (confirm('Are you sure you want to cancel this appointment?')) {
        try {
          await apiCall(`/appointments/${apptId}`, { method: 'DELETE' });
          showToast('Appointment cancelled.');
          await refreshAppointments();
          renderAppointmentsCalendar();
        } catch (error) {
          showToast('Failed to cancel: ' + error.message);
        }
      }
    });
  });
}

function renderStaffList() {
  if (!elements.staffList) return;
  elements.staffList.innerHTML = '';
  state.barbers.forEach(barber => {
    const normalizedBarberRole = normalizeRole(barber.role);
    const card = document.createElement('div');
    card.className = 'staff-card';
    const info = document.createElement('div');
    const roleLabel = formatRoleLabel(normalizedBarberRole);
    info.innerHTML = `
      <strong>${barber.name}</strong>
      <span>${barber.email}</span>
    `;
    const details = document.createElement('div');
    details.style.textAlign = 'right';
    details.innerHTML = `<span style="font-size:0.85rem;color:#c9c1b5;">${roleLabel}</span>`;
    card.appendChild(info);
    card.appendChild(details);
    const actionBar = document.createElement('div');
    actionBar.className = 'staff-card-actions';
    actionBar.style.display = 'flex';
    actionBar.style.gap = '10px';
    actionBar.style.alignItems = 'center';

    const currentRole = document.createElement('span');
    currentRole.style.fontSize = '0.85rem';
    currentRole.style.color = '#c9c1b5';
    currentRole.textContent = roleLabel;
    actionBar.appendChild(currentRole);

    const canManage = state.user && (state.user.role === 'BOSS' || state.user.role === 'SENIOR_BARBER');
    if (canManage && barber.id !== state.user.id) {
      if (normalizedBarberRole === 'JUNIOR_BARBER' && (state.user.role === 'BOSS' || state.user.role === 'SENIOR_BARBER')) {
        const promoteButton = document.createElement('button');
        promoteButton.className = 'btn btn-small';
        promoteButton.textContent = 'Make barber';
        promoteButton.addEventListener('click', async () => {
          try {
            await apiCall(`/barbers/${barber.id}`, {
              method: 'PUT',
              body: JSON.stringify({ role: 'BARBER' }),
            });
            showToast(`${barber.name} is now a regular barber.`);
            await refreshBarbers();
          } catch (error) {
            showToast('Unable to change role: ' + error.message);
          }
        });
        actionBar.appendChild(promoteButton);
      }
      if (normalizedBarberRole === 'BARBER' || normalizedBarberRole === 'JUNIOR_BARBER') {
        const deleteButton = document.createElement('button');
        deleteButton.className = 'btn btn-secondary btn-small';
        deleteButton.textContent = 'Fire';
        deleteButton.addEventListener('click', async () => {
          if (!confirm(`Fire ${barber.name}? This cannot be undone.`)) return;
          try {
            await apiCall(`/barbers/${barber.id}`, { method: 'DELETE' });
            showToast(`${barber.name} has been removed.`);
            await refreshBarbers();
          } catch (error) {
            showToast('Unable to fire staff: ' + error.message);
          }
        });
        actionBar.appendChild(deleteButton);
      }
    }

    card.appendChild(actionBar);
    elements.staffList.appendChild(card);
  });
  if (!state.barbers.length) {
    elements.staffList.innerHTML = '<p>No staff accounts registered.</p>';
  }
}

function renderDayOffsCalendar() {
  const year = state.currentDayoffMonth.getFullYear();
  const month = state.currentDayoffMonth.getMonth();
  const daysInMonth = getDaysInMonth(state.currentDayoffMonth);
  const firstDay = getFirstDayOfMonth(state.currentDayoffMonth);

  // Update month display
  const monthName = state.currentDayoffMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  elements.currentDayoffMonth.textContent = monthName;

  // Create dayoff map for quick lookup
  const dayoffMap = {};
  const recurringDayOfWeeks = new Set();
  state.dayOffs.forEach(dayOff => {
    const dateKey = normalizeDateKey(dayOff.day_off_date);
    dayoffMap[dateKey] = dayOff;
    if (dayOff.is_recurring && dayOff.recurring_day_of_week !== null && dayOff.recurring_day_of_week !== undefined) {
      recurringDayOfWeeks.add(dayOff.recurring_day_of_week);
    }
  });

  // Clear calendar
  elements.dayoffsCalendar.innerHTML = '';

  const headerDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  headerDays.forEach(day => {
    const header = document.createElement('div');
    header.className = 'calendar-header';
    header.textContent = day;
    elements.dayoffsCalendar.appendChild(header);
  });

  const startOffset = (firstDay + 6) % 7;
  for (let i = 0; i < startOffset; i++) {
    const emptyDay = document.createElement('div');
    emptyDay.className = 'calendar-day other-month';
    elements.dayoffsCalendar.appendChild(emptyDay);
  }

  const today = new Date();
  const todayKey = formatDateForInput(today);

  // Add days of month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateKey = formatDateForInput(date);
    const dayElement = document.createElement('div');
    dayElement.className = 'calendar-day';

    if (dateKey === todayKey) {
      dayElement.classList.add('today');
    } else if (date < today) {
      dayElement.classList.add('past');
    }
    if (dateKey === state.selectedDayoffDate) {
      dayElement.classList.add('selected-day');
    }

    const dayOff = dayoffMap[dateKey];
    const dayOfWeek = date.getDay();
    const isRecurringDayOff = recurringDayOfWeeks.has(dayOfWeek);
    
    if (dayOff) {
      dayElement.classList.add('has-dayoff');
    } else if (isRecurringDayOff) {
      dayElement.classList.add('has-recurring-dayoff');
    }

    const dayNumber = document.createElement('div');
    dayNumber.className = 'calendar-day-number';
    dayNumber.textContent = day;
    dayElement.appendChild(dayNumber);

    if (dayOff || isRecurringDayOff) {
      const status = document.createElement('span');
      status.className = 'calendar-day-count';
      status.textContent = dayOff ? 'Closed' : 'Weekly';
      dayElement.appendChild(status);
    }

    dayElement.addEventListener('click', () => {
      selectDayOffDate(date);
    });

    elements.dayoffsCalendar.appendChild(dayElement);
  }

  const totalCells = startOffset + getDaysInMonth(state.currentDayoffMonth);
  const remainder = (7 - (totalCells % 7)) % 7;
  for (let i = 0; i < remainder; i++) {
    const emptyDay = document.createElement('div');
    emptyDay.className = 'calendar-day other-month';
    elements.dayoffsCalendar.appendChild(emptyDay);
  }
}

function selectDayOffDate(date) {
  const dateKey = formatDateForInput(date);
  state.selectedDayoffDate = dateKey;
  if (elements.dayoffDate) {
    elements.dayoffDate.value = dateKey;
  }
  renderDayOffsCalendar();
  
  const appointmentsOnDate = state.appointments.filter(appt => normalizeDateKey(appt.appointment_date) === dateKey);
  if (appointmentsOnDate.length > 0) {
    showToast(`Warning: ${appointmentsOnDate.length} appointment(s) on this date. You may need to cancel them manually.`);
  }
}

function renderDayOffs() {
  elements.dayoffsList.innerHTML = '';
  if (!state.dayOffs.length) {
    elements.dayoffsList.innerHTML = '<p>No day offs yet.</p>';
    return;
  }
  state.dayOffs.forEach(dayOff => {
    const item = document.createElement('div');
    item.className = 'dayoff-item';
    let when = formatIsoDateShort(dayOff.day_off_date);
    if (dayOff.is_recurring && dayOff.recurring_day_of_week !== null && dayOff.recurring_day_of_week !== undefined) {
      when = `Every ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dayOff.recurring_day_of_week]}`;
    }
    item.innerHTML = `
      <div class="dayoff-item-info">
        <strong>${when}</strong>
        <p>${dayOff.notes || 'No notes'}</p>
      </div>
      <button class="dayoff-item-delete" type="button" data-id="${dayOff.id}">Delete</button>
    `;
    elements.dayoffsList.appendChild(item);
  });

  elements.dayoffsList.querySelectorAll('.dayoff-item-delete').forEach(button => {
    button.addEventListener('click', async () => {
      if (!confirm('Delete this day off?')) return;
      try {
        await apiCall(`/dayoffs/${button.dataset.id}`, { method: 'DELETE' });
        showToast('Day off deleted.');
        await refreshDayOffs();
      } catch (error) {
        showToast('Could not delete day off: ' + error.message);
      }
    });
  });
}

function renderAvailabilityTimes() {
  if (!elements.availabilityList) return;
  elements.availabilityList.innerHTML = '';
  if (!state.availabilityTimes.length) {
    elements.availabilityList.innerHTML = '<p>Default shop times are being used. Add your own times to customize them.</p>';
    return;
  }

  state.availabilityTimes.forEach(slot => {
    const item = document.createElement('div');
    item.className = 'dayoff-item';
    item.innerHTML = `
      <div class="dayoff-item-info">
        <strong>${slot.time_label}</strong>
      </div>
      <button class="dayoff-item-delete" type="button" data-id="${slot.id}">Delete</button>
    `;
    elements.availabilityList.appendChild(item);
  });

  elements.availabilityList.querySelectorAll('.dayoff-item-delete').forEach(button => {
    button.addEventListener('click', async () => {
      try {
        await apiCall(`/availability/${button.dataset.id}`, { method: 'DELETE' });
        showToast('Time deleted.');
        await refreshAvailability();
      } catch (error) {
        showToast('Could not delete time: ' + error.message);
      }
    });
  });
}

function renderBlockedPhones() {
  if (!elements.blockedPhoneList) return;
  elements.blockedPhoneList.innerHTML = '';

  if (!state.blockedPhones.length) {
    elements.blockedPhoneList.innerHTML = '<p>No blocked phone numbers.</p>';
    return;
  }

  state.blockedPhones.forEach(block => {
    const item = document.createElement('div');
    item.className = 'dayoff-item blocked-phone-item';
    const barberLabel = block.barber_name ? `<p><strong>Barber:</strong> ${block.barber_name}</p>` : '';
    item.innerHTML = `
      <div class="dayoff-item-info">
        <strong>${block.phone_number}</strong>
        ${barberLabel}
        <p>${block.reason || 'No reason provided'}</p>
      </div>
      <button class="dayoff-item-delete unblock-phone" type="button" data-id="${block.id}">Unblock</button>
    `;
    elements.blockedPhoneList.appendChild(item);
  });

  elements.blockedPhoneList.querySelectorAll('.unblock-phone').forEach(button => {
    button.addEventListener('click', async () => {
      if (!confirm('Unblock this phone number?')) return;
      try {
        await apiCall(`/blocked-phones/${button.dataset.id}`, { method: 'DELETE' });
        showToast('Phone number unblocked.');
        await refreshBlockedPhones();
      } catch (error) {
        showToast('Could not unblock number: ' + error.message);
      }
    });
  });

  document.querySelectorAll('.block-appointment-phone').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const apptId = parseInt(e.target.dataset.id, 10);
      const appointment = state.appointments.find(appt => appt.id === apptId);
      if (!appointment) {
        showToast('Appointment not found.');
        return;
      }
      if (!confirm(`Block ${appointment.client_phone} from booking with this barber?`)) return;
      try {
        await apiCall('/blocked-phones', {
          method: 'POST',
          body: JSON.stringify({
            barberId: appointment.barber_id,
            phoneNumber: appointment.client_phone,
            reason: `Blocked from appointment on ${normalizeDateKey(appointment.appointment_date)}`,
          }),
        });
        showToast('Phone number blocked.');
        await refreshBlockedPhones();
      } catch (error) {
        showToast('Could not block phone: ' + error.message);
      }
    });
  });
}

function renderWorkPhotoFilePreview() {
  renderFilePreview(elements.workPhotoFiles, elements.workPhotoPreview, 'Choose work photos to preview.');
}

function renderProfilePhotoFilePreview() {
  if (elements.profilePhotoFile.files.length) {
    renderFilePreview(elements.profilePhotoFile, elements.profilePhotoPreview, 'No profile photo yet.');
  } else {
    renderProfilePhotoPreview();
  }
}

function renderServicePhotoFilePreview() {
  if (elements.servicePhotoFile.files.length) {
    renderFilePreview(elements.servicePhotoFile, elements.servicePhotoPreview, 'Choose a photo from your device.');
  }
}

async function handleLogin(event) {
  event.preventDefault();
  try {
    const email = elements.loginEmail.value.trim().toLowerCase();
    const password = elements.loginPassword.value.trim();
    if (!email || !password) {
      showToast('Enter email and password.');
      return;
    }
    const user = await login(email, password);
    elements.loginSection.classList.add('hidden');
    elements.dashboardSection.classList.remove('hidden');
    elements.dashboardTitle.textContent = `Hello, ${user.name}`;
    await refreshAll();
    showToast('Welcome back, ' + user.name + '!');
  } catch (error) {
    showToast('Login failed: ' + error.message);
  }
}

async function handleSaveProfile(event) {
  event.preventDefault();
  if (!state.user) return;
  try {
    const name = elements.profileName.value.trim();
    const bio = elements.profileBio.value.trim();
    const instagram = elements.profileInstagram.value.trim();
    const tiktok = elements.profileTiktok.value.trim();
    if (!name) {
      showToast('Name is required.');
      return;
    }
    const profileUploads = await uploadFiles(elements.profilePhotoFile.files, 'profile');
    const workUploads = await uploadFiles(elements.workPhotoFiles.files, 'work');
    const profilePhotoUrl = profileUploads[0] || state.user.profile_photo_url || null;
    const photoUrls = [...normalizePhotoUrls(state.user.photo_urls), ...workUploads];
    const updated = await apiCall(`/barbers/${state.user.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, bio, instagram, tiktok, profilePhotoUrl, photoUrls }),
    });
    state.user = { ...state.user, ...updated };
    elements.dashboardTitle.textContent = `Hello, ${state.user.name}`;
    localStorage.setItem('zigzagStaffUser', JSON.stringify(state.user));
    elements.profilePhotoFile.value = '';
    elements.workPhotoFiles.value = '';
    elements.workPhotoPreview.innerHTML = '';
    showToast('Profile updated.');
    renderProfileForm();
  } catch (error) {
    showToast('Profile save failed: ' + error.message);
  }
}

async function handleCreateBarber(event) {
  event.preventDefault();
  try {
    const name = elements.newBarberName.value.trim();
    const email = elements.newBarberEmail.value.trim().toLowerCase();
    const password = elements.newBarberPassword.value.trim();
    const role = normalizeRole(elements.newBarberRole.value) || 'BARBER';
    const bio = elements.newBarberBio.value.trim();
    const instagram = elements.newBarberInstagram.value.trim();
    const tiktok = elements.newBarberTiktok.value.trim();
    if (!name || !email || !password) {
      showToast('Please fill name, email, and password.');
      return;
    }
    await apiCall('/barbers', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role, bio, instagram, tiktok, photoUrls: [] }),
    });
    elements.createBarberForm.reset();
    showToast('New staff account created.');
    await refreshBarbers();
  } catch (error) {
    showToast('Failed to create staff: ' + error.message);
  }
}

async function handleDayoffSubmit(event) {
  event.preventDefault();
  if (!state.selectedDayoffDate) {
    showToast('Please select a date from the calendar first.');
    return;
  }
  try {
    const date = state.selectedDayoffDate;
    const isRecurring = elements.dayoffRecurring.checked;
    const notes = elements.dayoffNotes.value.trim();
    
    let recurringDayOfWeek = null;
    if (isRecurring) {
      recurringDayOfWeek = getDayOfWeekFromDateKey(date);
    }
    
    await apiCall('/dayoffs', {
      method: 'POST',
      body: JSON.stringify({ 
        barberId: state.user.id,
        date, 
        isRecurring, 
        recurringDayOfWeek,
        notes 
      }),
    });
    elements.dayoffForm.reset();
    state.selectedDayoffDate = null;
    showToast('Day off saved.');
    await refreshDayOffs();
  } catch (error) {
    showToast('Could not save day off: ' + error.message);
  }
}

async function handleAvailabilitySubmit(event) {
  event.preventDefault();
  const time = elements.availabilityTime.value;
  if (!time) {
    showToast('Choose a time first.');
    return;
  }
  try {
    await apiCall('/availability', {
      method: 'POST',
      body: JSON.stringify({ time }),
    });
    elements.availabilityForm.reset();
    showToast('Available time added.');
    await refreshAvailability();
  } catch (error) {
    showToast('Could not add time: ' + error.message);
  }
}

async function handleBlockedPhoneSubmit(event) {
  event.preventDefault();
  const phoneNumber = normalizePhoneInput(elements.blockedPhoneNumber.value);
  const reason = elements.blockedPhoneReason.value.trim();
  if (!phoneNumber || phoneNumber.replace(/\D/g, '').length < 7) {
    showToast('Enter a valid phone number.');
    return;
  }

  try {
    await apiCall('/blocked-phones', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber, reason }),
    });
    elements.blockedPhoneForm.reset();
    showToast('Phone number blocked.');
    await refreshBlockedPhones();
  } catch (error) {
    showToast('Could not block number: ' + error.message);
  }
}

async function refreshBarbers() {
  await fetchBarbers();
  renderStaffList();
}

async function refreshAppointments() {
  await fetchAppointments();
  renderAppointmentsCalendar();
  if (state.selectedApptDate) {
    const appointments = state.appointments.filter(appt => normalizeDateKey(appt.appointment_date) === state.selectedApptDate);
    showDayAppointments(state.selectedApptDate, appointments);
  }
}

async function refreshDayOffs() {
  await fetchDayOffs();
  renderDayOffsCalendar();
  renderDayOffs();
}

async function refreshAvailability() {
  await fetchAvailability();
  renderAvailabilityTimes();
}

async function refreshBlockedPhones() {
  await fetchBlockedPhones();
  renderBlockedPhones();
}

async function refreshAll() {
  if (state.token) {
    await fetchCurrentUser();
  }
  const isSenior = state.user.role === 'SENIOR_BARBER';
  const isBoss = state.user.role === 'BOSS';
  const teamTab = document.querySelector('[data-tab="team"]');
  const appointmentTab = document.querySelector('[data-tab="appointments"]');
  const dayoffTab = document.querySelector('[data-tab="dayoffs"]');

  if (isBoss || isSenior) {
    teamTab?.classList.remove('hidden');
  } else {
    teamTab?.classList.add('hidden');
  }

  appointmentTab?.classList.remove('hidden');
  dayoffTab?.classList.remove('hidden');
  renderTab('appointments');
  renderDashboardLoadingState();

  const results = await Promise.allSettled([
    refreshBarbers(),
    refreshDayOffs(),
    refreshAvailability(),
    refreshBlockedPhones(),
    refreshAppointments(),
  ]);
  const failed = results.find(result => result.status === 'rejected');
  if (failed) {
    console.warn('Some dashboard data failed to load:', failed.reason);
    showToast('Some dashboard data is still loading or unavailable.');
  }
  renderProfileForm();
}

async function init() {
  const storedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
  const storedUser = localStorage.getItem('zigzagStaffUser');
  if (storedToken) state.token = storedToken;
  if (storedUser) {
    try {
      state.user = JSON.parse(storedUser);
      if (state.user) {
        state.user.role = normalizeRole(state.user.role);
      }
    } catch {
      localStorage.removeItem('zigzagStaffUser');
    }
  }
  if (state.token && state.user) {
    elements.loginSection.classList.add('hidden');
    elements.dashboardSection.classList.remove('hidden');
    elements.dashboardTitle.textContent = `Hello, ${state.user.name}`;
    try {
      await refreshAll();
    } catch (error) {
      console.error('Stored staff session failed:', error);
      logout();
    }
  }
  elements.loginForm.addEventListener('submit', handleLogin);
  elements.logoutButton.addEventListener('click', logout);
  elements.profileForm.addEventListener('submit', handleSaveProfile);
  elements.serviceForm.addEventListener('submit', addOrUpdateService);
  elements.availabilityForm.addEventListener('submit', handleAvailabilitySubmit);
  elements.blockedPhoneForm?.addEventListener('submit', handleBlockedPhoneSubmit);
  elements.profilePhotoFile.addEventListener('change', renderProfilePhotoFilePreview);
  elements.workPhotoFiles.addEventListener('change', renderWorkPhotoFilePreview);
  elements.servicePhotoFile.addEventListener('change', renderServicePhotoFilePreview);
  elements.createBarberForm.addEventListener('submit', handleCreateBarber);
  elements.dayoffForm.addEventListener('submit', handleDayoffSubmit);
  elements.tabButtons.forEach(btn => btn.addEventListener('click', () => renderTab(btn.dataset.tab)));
  
  // Calendar navigation
  elements.prevApptMonthBtn.addEventListener('click', () => {
    state.currentApptMonth.setMonth(state.currentApptMonth.getMonth() - 1);
    renderAppointmentsCalendar();
  });
  elements.nextApptMonthBtn.addEventListener('click', () => {
    state.currentApptMonth.setMonth(state.currentApptMonth.getMonth() + 1);
    renderAppointmentsCalendar();
  });
  elements.prevDayoffMonthBtn.addEventListener('click', () => {
    state.currentDayoffMonth.setMonth(state.currentDayoffMonth.getMonth() - 1);
    renderDayOffsCalendar();
  });
  elements.nextDayoffMonthBtn.addEventListener('click', () => {
    state.currentDayoffMonth.setMonth(state.currentDayoffMonth.getMonth() + 1);
    renderDayOffsCalendar();
  });
}

init().catch(error => console.error('Staff portal failed:', error));
