const API_BASE = '/api';
const STORAGE_KEY_TOKEN = 'zigzagStaffToken';

const state = {
  token: null,
  user: null,
  barbers: [],
  appointments: [],
  dayOffs: [],
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
  appointmentsList: document.getElementById('appointments-list'),
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
  profilePhotos: document.getElementById('profile-photos'),
  photoFiles: document.getElementById('photo-files'),
  photoPreview: document.getElementById('photo-preview'),
  uploadPhotosButton: document.getElementById('upload-photos-button'),
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
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Request failed');
  }
  return response.json().catch(() => ({}));
}

function saveSession(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem(STORAGE_KEY_TOKEN, token);
  localStorage.setItem('zigzagStaffUser', JSON.stringify(user));
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

function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  state.user = data.user;
  return data.user;
}

async function fetchBarbers() {
  const data = await apiCall('/barbers', { method: 'GET' });
  state.barbers = data;
  return data;
}

async function fetchAppointments() {
  const data = await apiCall('/appointments', { method: 'GET' });
  // Filter to only this barber's appointments if not boss
  if (state.user && state.user.role !== 'boss') {
    state.appointments = data.filter(appt => appt.barber_id === state.user.id);
  } else {
    state.appointments = data;
  }
  return state.appointments;
}

async function fetchDayOffs() {
  const data = await apiCall('/dayoffs', { method: 'GET' });
  // Filter to only this barber's dayoffs if not boss
  if (state.user && state.user.role !== 'boss') {
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
    panel.classList.toggle('active', panel.id === `${tabName}-tab`);
  });
}

function renderProfileForm() {
  if (!state.user) return;
  elements.profileName.value = state.user.name;
  elements.profileBio.value = state.user.bio || '';
  elements.profileInstagram.value = state.user.instagram || '';
  elements.profileTiktok.value = state.user.tiktok || '';
  elements.profilePhotos.value = normalizePhotoUrls(state.user.photo_urls).join(', ');
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
    if (!appointmentMap[appt.appointment_date]) {
      appointmentMap[appt.appointment_date] = [];
    }
    appointmentMap[appt.appointment_date].push(appt);
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
    }

    dayElement.addEventListener('click', () => {
      showDayAppointments(dateKey, appointments);
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
  elements.dayAppointmentsList.innerHTML = `<h4>Appointments for ${formatDateDisplay(new Date(dateKey + 'T00:00:00'))}</h4>`;
  
  if (!appointments.length) {
    elements.dayAppointmentsList.innerHTML += '<p>No appointments scheduled.</p>';
    return;
  }

  appointments.forEach(appt => {
    const item = document.createElement('div');
    item.className = 'dayoff-item';
    item.innerHTML = `
      <div class="dayoff-item-info">
        <strong>${appt.client_name} • ${appt.appointment_time}</strong>
        <p>${appt.client_phone}</p>
        <button class="btn btn-small cancel-appointment" data-id="${appt.id}">Cancel</button>
      </div>
    `;
    elements.dayAppointmentsList.appendChild(item);
  });

  // Add event listeners for cancel buttons
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
    const card = document.createElement('div');
    card.className = 'staff-card';
    const info = document.createElement('div');
    // Format role name
    const roleLabel = barber.role === 'junior_barber' ? 'Junior Barber' : 
                      barber.role === 'senior_barber' ? 'Senior Barber' : 
                      barber.role === 'barber' ? 'Barber' : barber.role;
    info.innerHTML = `
      <strong>${barber.name}</strong>
      <span>${barber.email}</span>
    `;
    const details = document.createElement('div');
    details.style.textAlign = 'right';
    details.innerHTML = `<span style="font-size:0.85rem;color:#c9c1b5;">${roleLabel}</span>`;
    card.appendChild(info);
    card.appendChild(details);
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
  state.dayOffs.forEach(dayOff => {
    const dateKey = dayOff.day_off_date;
    dayoffMap[dateKey] = dayOff;
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

    const dayOff = dayoffMap[dateKey];
    if (dayOff) {
      dayElement.classList.add('has-dayoff');
    }

    const dayNumber = document.createElement('div');
    dayNumber.className = 'calendar-day-number';
    dayNumber.textContent = day;
    dayElement.appendChild(dayNumber);

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
  elements.dayoffDate.value = formatDateDisplay(new Date(dateKey + 'T00:00:00'));
  
  // Check if there are appointments on this date
  const appointmentsOnDate = state.appointments.filter(appt => appt.appointment_date === dateKey);
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
    const when = dayOff.is_recurring ? `Every ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dayOff.recurring_day_of_week]}` : dayOff.day_off_date;
    item.innerHTML = `
      <div class="dayoff-item-info">
        <strong>${when}</strong>
        <p>${dayOff.notes || 'No notes'}</p>
      </div>
    `;
    elements.dayoffsList.appendChild(item);
  });
}

function renderPhotoPreview() {
  elements.photoPreview.innerHTML = '';
  const files = [...elements.photoFiles.files];
  if (!files.length) {
    elements.photoPreview.textContent = 'Choose images to preview before upload.';
    return;
  }
  const grid = document.createElement('div');
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(110px, 1fr))';
  grid.style.gap = '12px';
  files.forEach(file => {
    const card = document.createElement('div');
    card.style.borderRadius = '18px';
    card.style.overflow = 'hidden';
    card.style.background = '#111';
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.style.width = '100%';
    img.style.height = '100px';
    img.style.objectFit = 'cover';
    const label = document.createElement('div');
    label.style.color = '#eee';
    label.style.fontSize = '0.85rem';
    label.style.padding = '8px';
    label.textContent = file.name;
    card.appendChild(img);
    card.appendChild(label);
    grid.appendChild(card);
  });
  elements.photoPreview.appendChild(grid);
}

async function uploadPhotos() {
  const files = [...elements.photoFiles.files];
  if (!files.length) {
    showToast('Select files before uploading.');
    return;
  }
  const formData = new FormData();
  files.forEach(file => formData.append('photos', file));
  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${state.token}` },
    body: formData,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Upload failed');
  }
  return response.json();
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
    const bio = elements.profileBio.value.trim();
    const instagram = elements.profileInstagram.value.trim();
    const tiktok = elements.profileTiktok.value.trim();
    const photoUrls = normalizePhotoUrls(elements.profilePhotos.value);
    const updated = await apiCall(`/barbers/${state.user.id}`, {
      method: 'PUT',
      body: JSON.stringify({ bio, instagram, tiktok, photoUrls }),
    });
    state.user = { ...state.user, ...updated };
    showToast('Profile updated.');
    renderProfileForm();
  } catch (error) {
    showToast('Profile save failed: ' + error.message);
  }
}

async function handleUploadPhotos() {
  if (!state.user) return;
  try {
    const uploadResult = await uploadPhotos();
    const existing = normalizePhotoUrls(state.user.photo_urls);
    const merged = [...existing, ...(uploadResult.uploaded || [])];
    const updated = await apiCall(`/barbers/${state.user.id}`, {
      method: 'PUT',
      body: JSON.stringify({ photoUrls: merged }),
    });
    state.user = { ...state.user, ...updated };
    elements.profilePhotos.value = normalizePhotoUrls(updated.photo_urls).join(', ');
    elements.photoFiles.value = '';
    elements.photoPreview.innerHTML = '';
    showToast('Photos uploaded and profile updated.');
  } catch (error) {
    showToast('Upload failed: ' + error.message);
  }
}

async function handleCreateBarber(event) {
  event.preventDefault();
  try {
    const name = elements.newBarberName.value.trim();
    const email = elements.newBarberEmail.value.trim().toLowerCase();
    const password = elements.newBarberPassword.value.trim();
    const role = elements.newBarberRole.value;
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
    
    await apiCall('/dayoffs', {
      method: 'POST',
      body: JSON.stringify({ 
        barberId: state.user.id,
        date, 
        isRecurring, 
        recurringDayOfWeek: new Date(date + 'T00:00:00').getDay(), 
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

async function refreshBarbers() {
  await fetchBarbers();
  renderStaffList();
}

async function refreshAppointments() {
  await fetchAppointments();
  renderAppointmentsCalendar();
  if (state.selectedApptDate) {
    const appointments = state.appointments.filter(appt => appt.appointment_date === state.selectedApptDate);
    showDayAppointments(state.selectedApptDate, appointments);
  }
}

async function refreshDayOffs() {
  await fetchDayOffs();
  renderDayOffsCalendar();
  renderDayOffs();
}

async function refreshAll() {
  await Promise.all([refreshAppointments(), refreshBarbers(), refreshDayOffs()]);
  renderProfileForm();
  // Show team tab only for boss and senior_barber
  if (state.user.role === 'boss' || state.user.role === 'senior_barber') {
    document.querySelectorAll('.boss-only').forEach(el => el.classList.remove('hidden'));
  } else {
    document.querySelectorAll('.boss-only').forEach(el => el.classList.add('hidden'));
  }
}

async function init() {
  const storedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
  const storedUser = localStorage.getItem('zigzagStaffUser');
  if (storedToken) state.token = storedToken;
  if (storedUser) {
    try { state.user = JSON.parse(storedUser); } catch { localStorage.removeItem('zigzagStaffUser'); }
  }
  if (state.token && state.user) {
    elements.loginSection.classList.add('hidden');
    elements.dashboardSection.classList.remove('hidden');
    elements.dashboardTitle.textContent = `Hello, ${state.user.name}`;
    try {
      await refreshAll();
    } catch {
      logout();
    }
  }
  elements.loginForm.addEventListener('submit', handleLogin);
  elements.logoutButton.addEventListener('click', logout);
  elements.profileForm.addEventListener('submit', handleSaveProfile);
  elements.photoFiles.addEventListener('change', renderPhotoPreview);
  elements.uploadPhotosButton.addEventListener('click', handleUploadPhotos);
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
