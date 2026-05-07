const API_BASE = 'http://localhost:3000/api';
const STORAGE_KEY_TOKEN = 'zigzagAuthToken';
const SLOT_TIMES = ['10:00 AM', '11:30 AM', '1:00 PM', '2:30 PM', '4:00 PM', '5:30 PM'];
const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const elements = {
  // Auth
  loginModal: document.getElementById('login-modal'),
  loginForm: document.getElementById('login-form'),
  loginEmail: document.getElementById('login-email'),
  loginPassword: document.getElementById('login-password'),
  openLogin: document.getElementById('open-login'),
  closeLogin: document.getElementById('close-login'),
  heroLogin: document.getElementById('hero-login'),

  // Booking
  bookingBarber: document.getElementById('booking-barber'),
  bookingDate: document.getElementById('booking-date'),
  bookingCalendar: document.getElementById('booking-calendar'),
  bookingCalendarMonth: document.getElementById('booking-calendar-month'),
  bookingSelectedDate: document.getElementById('booking-selected-date'),
  prevBookingMonthBtn: document.getElementById('prev-booking-month'),
  nextBookingMonthBtn: document.getElementById('next-booking-month'),
  bookingSlots: document.getElementById('booking-slots'),
  bookingTimeInput: document.getElementById('booking-time'),
  bookingForm: document.getElementById('booking-form'),
  clientName: document.getElementById('client-name'),
  clientPhone: document.getElementById('client-phone'),
  openBooking: document.getElementById('open-booking'),
  heroBook: document.getElementById('hero-book'),

  // Dashboard
  dashboardModal: document.getElementById('dashboard-modal'),
  closeDashboard: document.getElementById('close-dashboard'),
  dashboardTitle: document.getElementById('dashboard-title'),
  logoutButton: document.getElementById('logout-button'),
  toast: document.getElementById('toast'),

  // Tabs
  tabButtons: document.querySelectorAll('.tab-button'),

  // Appointments
  appointmentsCalendar: document.getElementById('appointments-calendar'),
  currentMonthAppt: document.getElementById('current-month-appt'),
  prevMonthApptBtn: document.getElementById('prev-month-appt'),
  nextMonthApptBtn: document.getElementById('next-month-appt'),

  // Day offs
  dayoffForm: document.getElementById('dayoff-form'),
  dayoffBarber: document.getElementById('dayoff-barber'),
  dayoffDate: document.getElementById('dayoff-date'),
  dayoffRecurring: document.getElementById('dayoff-recurring'),
  dayoffNotes: document.getElementById('dayoff-notes'),
  dayoffsList: document.getElementById('dayoffs-list'),
  dayoffsCalendar: document.getElementById('dayoffs-calendar'),
  currentMonthDayoff: document.getElementById('current-month-dayoff'),
  prevMonthDayoffBtn: document.getElementById('prev-month-dayoff'),
  nextMonthDayoffBtn: document.getElementById('next-month-dayoff'),

  // Barbers (boss only)
  bossSection: document.querySelector('#barbers-tab'),
  createBarberForm: document.getElementById('create-barber-form'),
  newBarberName: document.getElementById('new-barber-name'),
  newBarberRole: document.getElementById('new-barber-role'),
  newBarberEmail: document.getElementById('new-barber-email'),
  newBarberPassword: document.getElementById('new-barber-password'),
  staffList: document.getElementById('staff-list'),
  barberProfiles: document.getElementById('barber-profiles'),
  profileForm: document.getElementById('profile-form'),
  profileBio: document.getElementById('profile-bio'),
  profileInstagram: document.getElementById('profile-instagram'),
  profileTiktok: document.getElementById('profile-tiktok'),
  profilePhotos: document.getElementById('profile-photos'),
  newBarberBio: document.getElementById('new-barber-bio'),
  newBarberInstagram: document.getElementById('new-barber-instagram'),
  newBarberTiktok: document.getElementById('new-barber-tiktok'),
  newBarberPhotos: document.getElementById('new-barber-photos'),
};

let state = {
  currentUser: null,
  token: null,
  barbers: [],
  appointments: [],
  dayOffs: [],
  currentMonthAppt: new Date(),
  currentMonthDayoff: new Date(),
  currentBookingMonth: new Date(),
  autoRefreshInterval: null,
};


// ==================== UTILITIES ====================

function getAuthHeader() {
  return { 'Authorization': `Bearer ${state.token}` };
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  elements.toast.classList.remove('hidden');
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => {
    elements.toast.classList.remove('show');
    elements.toast.classList.add('hidden');
  }, 2800);
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

function renderBookingDateCalendar() {
  const monthDate = state.currentBookingMonth;
  const monthName = monthDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  elements.bookingCalendarMonth.textContent = monthName;
  elements.bookingCalendar.innerHTML = '';

  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  dayNames.forEach(day => {
    const header = document.createElement('div');
    header.className = 'calendar-header';
    header.textContent = day;
    elements.bookingCalendar.appendChild(header);
  });

  const firstDay = getFirstDayOfMonth(monthDate);
  const startOffset = (firstDay + 6) % 7;
  for (let i = 0; i < startOffset; i++) {
    const emptyDay = document.createElement('div');
    emptyDay.className = 'calendar-day other-month';
    elements.bookingCalendar.appendChild(emptyDay);
  }

  const today = new Date();
  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() + 1);
  const selectedDateKey = elements.bookingDate.value;

  for (let day = 1; day <= getDaysInMonth(monthDate); day++) {
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
    const dateKey = formatDateForInput(date);
    const dayElement = document.createElement('div');
    dayElement.className = 'calendar-day';

    if (date < minDate) {
      dayElement.classList.add('other-month');
      dayElement.style.cursor = 'not-allowed';
    } else {
      dayElement.addEventListener('click', () => {
        selectBookingDate(date);
      });
    }

    if (dateKey === selectedDateKey) {
      dayElement.classList.add('selected');
    }

    const dayNumber = document.createElement('div');
    dayNumber.className = 'calendar-day-number';
    dayNumber.textContent = day;
    dayElement.appendChild(dayNumber);

    elements.bookingCalendar.appendChild(dayElement);
  }

  const totalCells = startOffset + getDaysInMonth(monthDate);
  const remainder = (7 - (totalCells % 7)) % 7;
  for (let i = 0; i < remainder; i++) {
    const emptyDay = document.createElement('div');
    emptyDay.className = 'calendar-day other-month';
    elements.bookingCalendar.appendChild(emptyDay);
  }
}

function selectBookingDate(date) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date < tomorrow) return;

  const dateKey = formatDateForInput(date);
  elements.bookingDate.value = dateKey;
  elements.bookingSelectedDate.textContent = `Selected date: ${formatDateDisplay(new Date(dateKey + 'T00:00:00'))}`;
  renderBookingDateCalendar();
  renderBookingSlots();
}

function selectDayOffDate(date) {
  const dateKey = formatDateForInput(date);
  elements.dayoffDate.value = dateKey;
  renderDayOffCalendar();
  elements.dayoffNotes.focus();
  showToast(`Selected ${formatDateDisplay(new Date(dateKey + 'T00:00:00'))} for day off.`);
}

// ==================== API CALLS ====================

async function apiCall(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Request failed');
    }

    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

async function login(email, password) {
  const response = await apiCall('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  state.token = response.token;
  state.currentUser = response.user;
  localStorage.setItem(STORAGE_KEY_TOKEN, state.token);
  localStorage.setItem('zigzagCurrentUser', JSON.stringify(state.currentUser));
  // Save credentials for auto-fill
  localStorage.setItem('zigzagLoginEmail', email);
  localStorage.setItem('zigzagLoginPassword', password);
  return response.user;
}

async function fetchCurrentUser() {
  const response = await apiCall('/auth/me', {
    headers: getAuthHeader(),
  });
  state.currentUser = response.user;
  localStorage.setItem('zigzagCurrentUser', JSON.stringify(state.currentUser));
  return state.currentUser;
}

async function fetchBarbers() {
  const barbers = await apiCall('/barbers');
  state.barbers = barbers;
  return barbers;
}

function normalizePhotoUrls(photoData) {
  if (!photoData) return [];
  if (Array.isArray(photoData)) return photoData.filter(Boolean);
  if (typeof photoData === 'string') {
    return photoData.split(',').map(url => url.trim()).filter(Boolean);
  }
  return [];
}

async function updateBarberProfile(barberId, data) {
  return await apiCall(`/barbers/${barberId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
    headers: getAuthHeader(),
  });
}

async function fetchAppointments(year, month) {
  const appointments = await apiCall(`/appointments/month/${year}/${month}`, {
    headers: getAuthHeader(),
  });
  state.appointments = appointments;
  return appointments;
}

async function fetchDayOffs(year, month) {
  const dayOffs = await apiCall(`/dayoffs?year=${year}&month=${month}`, {
    headers: getAuthHeader(),
  });
  state.dayOffs = dayOffs;
  return dayOffs;
}

async function bookAppointment(barberId, date, time, clientName, clientPhone) {
  return await apiCall('/appointments', {
    method: 'POST',
    body: JSON.stringify({ barberId, date, time, clientName, clientPhone }),
  });
}

async function getAvailableSlots(barberId, date) {
  return await apiCall(`/appointments/available?barberId=${barberId}&date=${date}`);
}

async function addDayOff(barberId, date, isRecurring, notes) {
  const recurringDayOfWeek = new Date(date + 'T00:00:00').getDay();
  return await apiCall('/dayoffs', {
    method: 'POST',
    body: JSON.stringify({
      barberId,
      date,
      isRecurring,
      recurringDayOfWeek: isRecurring ? recurringDayOfWeek : null,
      notes,
    }),
    headers: getAuthHeader(),
  });
}

async function deleteDayOff(dayOffId) {
  return await apiCall(`/dayoffs/${dayOffId}`, {
    method: 'DELETE',
    headers: getAuthHeader(),
  });
}

async function createBarber(name, email, password, role = 'barber', bio = '', instagram = '', tiktok = '', photoUrls = []) {
  return await apiCall('/barbers', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, role, bio, instagram, tiktok, photoUrls }),
    headers: getAuthHeader(),
  });
}

async function fireBarber(barberId, reason) {
  return await apiCall(`/barbers/${barberId}`, {
    method: 'DELETE',
    body: JSON.stringify({ reason }),
    headers: getAuthHeader(),
  });
}

async function renderStaffList() {
  if (state.currentUser.role !== 'boss') {
    return;
  }
  const barbers = await fetchBarbers();
  elements.staffList.innerHTML = '';

  if (barbers.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No barbers are hired yet.';
    empty.style.color = '#b9b1a8';
    elements.staffList.appendChild(empty);
    return;
  }

  barbers.forEach(barber => {
    const card = document.createElement('div');
    card.className = 'staff-card';

    const info = document.createElement('div');
    const nameEl = document.createElement('strong');
    nameEl.textContent = barber.name;
    const roleEl = document.createElement('span');
    roleEl.textContent = 'Barber';
    info.appendChild(nameEl);
    info.appendChild(roleEl);

    if (barber.bio) {
      const bioEl = document.createElement('p');
      bioEl.textContent = barber.bio;
      bioEl.style.color = '#d6cec6';
      bioEl.style.margin = '6px 0 0';
      info.appendChild(bioEl);
    }
    if (barber.instagram || barber.tiktok) {
      const socials = document.createElement('div');
      socials.style.display = 'flex';
      socials.style.gap = '10px';
      socials.style.flexWrap = 'wrap';
      socials.style.marginTop = '8px';
      if (barber.instagram) {
        const instaLink = document.createElement('a');
        instaLink.href = barber.instagram.startsWith('@') ? `https://instagram.com/${barber.instagram.slice(1)}` : barber.instagram;
        instaLink.target = '_blank';
        instaLink.textContent = 'Instagram';
        instaLink.style.color = '#7ecbff';
        socials.appendChild(instaLink);
      }
      if (barber.tiktok) {
        const tiktokLink = document.createElement('a');
        tiktokLink.href = barber.tiktok.startsWith('@') ? `https://tiktok.com/${barber.tiktok.slice(1)}` : barber.tiktok;
        tiktokLink.target = '_blank';
        tiktokLink.textContent = 'TikTok';
        tiktokLink.style.color = '#7ecbff';
        socials.appendChild(tiktokLink);
      }
      info.appendChild(socials);
    }

    const fireBtn = document.createElement('button');
    fireBtn.type = 'button';
    fireBtn.textContent = 'Fire';
    fireBtn.addEventListener('click', async () => {
      const reason = prompt('Enter firing reason/comment:');
      if (!reason) {
        showToast('Firing canceled: comment required.');
        return;
      }
      const confirmed = confirm('Are you sure you want to fire this barber?');
      if (!confirmed) {
        return;
      }
      try {
        await fireBarber(barber.id, reason);
        showToast('Barber fired successfully.');
        await populateBarberSelects();
        await renderStaffList();
      } catch (error) {
        showToast('Failed to fire barber: ' + error.message);
      }
    });

    card.appendChild(info);
    card.appendChild(fireBtn);
    elements.staffList.appendChild(card);
  });
}

function renderBarberProfiles() {
  if (!elements.barberProfiles) return;
  elements.barberProfiles.innerHTML = '';

  if (!state.barbers.length) {
    const empty = document.createElement('p');
    empty.textContent = 'No stylists are available yet.';
    empty.style.color = '#b9b1a8';
    elements.barberProfiles.appendChild(empty);
    return;
  }

  state.barbers.forEach(barber => {
    const card = document.createElement('div');
    card.className = 'barber-profile-card';

    const imageGrid = document.createElement('div');
    imageGrid.className = 'barber-profile-images';
    const urls = normalizePhotoUrls(barber.photo_urls);
    if (urls.length) {
      urls.slice(0, 3).forEach(url => {
        const img = document.createElement('img');
        img.src = url;
        img.alt = `${barber.name} portfolio`;
        imageGrid.appendChild(img);
      });
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'barber-profile-placeholder';
      placeholder.textContent = 'Add photos later';
      imageGrid.appendChild(placeholder);
    }

    const content = document.createElement('div');
    content.className = 'barber-profile-info';
    const name = document.createElement('strong');
    name.textContent = barber.name;
    const bio = document.createElement('p');
    bio.textContent = barber.bio || 'Expert stylist with upcoming booking availability.';
    const socials = document.createElement('div');
    socials.className = 'barber-social-links';
    if (barber.instagram) {
      const link = document.createElement('a');
      link.href = barber.instagram.startsWith('@') ? `https://instagram.com/${barber.instagram.slice(1)}` : barber.instagram;
      link.target = '_blank';
      link.textContent = barber.instagram;
      socials.appendChild(link);
    }
    if (barber.tiktok) {
      const link = document.createElement('a');
      link.href = barber.tiktok.startsWith('@') ? `https://tiktok.com/${barber.tiktok.slice(1)}` : barber.tiktok;
      link.target = '_blank';
      link.textContent = barber.tiktok;
      socials.appendChild(link);
    }

    const selectButton = document.createElement('button');
    selectButton.type = 'button';
    selectButton.className = 'btn btn-secondary';
    selectButton.textContent = 'Select stylist';
    selectButton.addEventListener('click', () => {
      elements.bookingBarber.value = barber.id;
      renderBookingSlots();
      document.getElementById('booking').scrollIntoView({ behavior: 'smooth' });
    });

    content.appendChild(name);
    content.appendChild(bio);
    if (socials.children.length) content.appendChild(socials);
    content.appendChild(selectButton);

    card.appendChild(imageGrid);
    card.appendChild(content);
    elements.barberProfiles.appendChild(card);
  });
}

// ==================== CALENDAR RENDERING ====================

function renderAppointmentCalendar() {
  const year = state.currentMonthAppt.getFullYear();
  const month = state.currentMonthAppt.getMonth();
  const daysInMonth = getDaysInMonth(state.currentMonthAppt);
  const firstDay = getFirstDayOfMonth(state.currentMonthAppt);

  // Update month display
  const monthName = state.currentMonthAppt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  elements.currentMonthAppt.textContent = monthName;

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

  // Add empty cells for days after month ends
  const totalCells = startOffset + daysInMonth;
  const remainingCells = 42 - totalCells;
  for (let i = 0; i < remainingCells; i++) {
    const emptyDay = document.createElement('div');
    emptyDay.className = 'calendar-day other-month';
    elements.appointmentsCalendar.appendChild(emptyDay);
  }
}

function showDayAppointments(dateKey, appointments) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  const panel = document.createElement('div');
  panel.className = 'modal-panel';
  panel.style.maxHeight = '600px';

  let html = `
    <button class="close-btn" onclick="this.parentElement.parentElement.remove()">×</button>
    <h3>${formatDateDisplay(new Date(dateKey + 'T00:00:00'))}</h3>
  `;

  if (appointments.length === 0) {
    html += '<p>No appointments on this date.</p>';
  } else {
    html += '<div style="display: grid; gap: 12px; margin-top: 16px;">';
    appointments.forEach(appt => {
      const barberName = state.barbers.find(b => b.id === appt.barber_id)?.name || 'Unknown';
      html += `
        <div style="padding: 12px; background: rgba(255,255,255,0.05); border-radius: 12px;">
          <strong>${appt.client_name}</strong>
          <p style="margin: 6px 0 0; color: #d6cec6; font-size: 0.9rem;">
            ${barberName} • ${appt.appointment_time}
          </p>
          <p style="margin: 4px 0 0; color: #b9b1a8; font-size: 0.85rem;">
            ${appt.client_phone}
          </p>
        </div>
      `;
    });
    html += '</div>';
  }

  panel.innerHTML = html;
  modal.appendChild(panel);
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

function renderDayOffCalendar() {
  const year = state.currentMonthDayoff.getFullYear();
  const month = state.currentMonthDayoff.getMonth();
  const daysInMonth = getDaysInMonth(state.currentMonthDayoff);
  const firstDay = getFirstDayOfMonth(state.currentMonthDayoff);

  // Update month display
  const monthName = state.currentMonthDayoff.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  elements.currentMonthDayoff.textContent = monthName;

  // Create day-off map
  const dayOffMap = {};
  state.dayOffs.forEach(dayOff => {
    if (!dayOffMap[dayOff.day_off_date]) {
      dayOffMap[dayOff.day_off_date] = [];
    }
    dayOffMap[dayOff.day_off_date].push(dayOff);
  });

  elements.dayoffsCalendar.innerHTML = '';

  const headerDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  headerDays.forEach(day => {
    const header = document.createElement('div');
    header.className = 'calendar-header';
    header.textContent = day;
    elements.dayoffsCalendar.appendChild(header);
  });

  const startOffset = (firstDay + 6) % 7;
  // Add empty cells
  for (let i = 0; i < startOffset; i++) {
    const emptyDay = document.createElement('div');
    emptyDay.className = 'calendar-day other-month';
    elements.dayoffsCalendar.appendChild(emptyDay);
  }

  const today = new Date();
  const todayKey = formatDateForInput(today);

  // Add days
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

    const dayOffs = dayOffMap[dateKey] || [];
    if (dayOffs.length > 0) {
      dayElement.classList.add('has-dayoff');
    }

    const dayNumber = document.createElement('div');
    dayNumber.className = 'calendar-day-number';
    dayNumber.textContent = day;
    dayElement.appendChild(dayNumber);

    if (!dayElement.classList.contains('other-month')) {
      dayElement.addEventListener('click', () => {
        selectDayOffDate(date);
      });
    }

    if (elements.dayoffDate.value === dateKey) {
      dayElement.classList.add('selected-off');
    }

    elements.dayoffsCalendar.appendChild(dayElement);
  }

  // Add empty cells
  const totalCells = startOffset + daysInMonth;
  const remainingCells = 42 - totalCells;
  for (let i = 0; i < remainingCells; i++) {
    const emptyDay = document.createElement('div');
    emptyDay.className = 'calendar-day other-month';
    elements.dayoffsCalendar.appendChild(emptyDay);
  }

  renderDayOffList();
}

function renderDayOffList() {
  elements.dayoffsList.innerHTML = '';
  if (state.dayOffs.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No day offs scheduled yet.';
    empty.style.color = '#b9b1a8';
    elements.dayoffsList.appendChild(empty);
    return;
  }

  state.dayOffs
    .sort((a, b) => a.day_off_date.localeCompare(b.day_off_date))
    .forEach(dayOff => {
      const item = document.createElement('div');
      item.className = 'dayoff-item';

      const info = document.createElement('div');
      info.className = 'dayoff-item-info';

      const name = document.createElement('strong');
      const rawDate = dayOff.day_off_date;
      let formattedDate = 'Unknown date';
      if (rawDate) {
        const dateObj = new Date(rawDate + 'T00:00:00');
        formattedDate = isNaN(dateObj.getTime()) ? rawDate : formatDateDisplay(dateObj);
      }
      name.textContent = dayOff.is_recurring
        ? `Every ${DAYS_OF_WEEK[dayOff.recurring_day_of_week]}`
        : formattedDate;
      info.appendChild(name);

      item.appendChild(info);

      // Allow deletion only for boss or the user who owns this day off
      if (state.currentUser.role === 'boss' || dayOff.barber_id === state.currentUser.id) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'dayoff-item-delete';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', async () => {
          try {
            await deleteDayOff(dayOff.id);
            showToast('Day off deleted.');
            await refreshDayOffs();
          } catch (error) {
            showToast('Failed to delete day off: ' + error.message);
          }
        });
        item.appendChild(deleteBtn);
      }

      elements.dayoffsList.appendChild(item);
    });
}


// ==================== POPULATE SELECTS ====================

async function populateBarberSelects() {
  const barbers = await fetchBarbers();

  // Booking form
  elements.bookingBarber.innerHTML = '';
  barbers.forEach(barber => {
    const option = document.createElement('option');
    option.value = barber.id;
    option.textContent = barber.name;
    elements.bookingBarber.appendChild(option);
  });

  // Day-off barber select (for boss)
  elements.dayoffBarber.innerHTML = '';
  if (state.currentUser && state.currentUser.role === 'boss') {
    elements.dayoffBarber.style.display = '';
    barbers.forEach(barber => {
      const option = document.createElement('option');
      option.value = barber.id;
      option.textContent = barber.name;
      elements.dayoffBarber.appendChild(option);
    });
  } else {
    elements.dayoffBarber.style.display = 'none';
    if (state.currentUser) {
      elements.dayoffBarber.value = state.currentUser.id;
    }
  }

  renderBarberProfiles();
}

// ==================== BOOKING LOGIC ====================

async function renderBookingSlots() {
  const barberId = elements.bookingBarber.value;
  const dateKey = elements.bookingDate.value;
  elements.bookingSlots.innerHTML = '';
  elements.bookingTimeInput.value = '';

  if (!barberId || !dateKey) {
    elements.bookingSlots.textContent = 'Pick a barber and a date to see open times.';
    return;
  }

  try {
    const { available, isDayOff } = await getAvailableSlots(barberId, dateKey);

    if (isDayOff) {
      const message = document.createElement('div');
      message.className = 'slot-message';
      message.textContent = 'This barber is off on the selected day. Please choose another date or barber.';
      elements.bookingSlots.appendChild(message);
      return;
    }

    if (!available.length) {
      const message = document.createElement('div');
      message.className = 'slot-message';
      message.textContent = 'No available times on this date. Pick another day or barber.';
      elements.bookingSlots.appendChild(message);
      return;
    }

    available.forEach(time => {
      const slotButton = document.createElement('button');
      slotButton.type = 'button';
      slotButton.textContent = time;
      slotButton.dataset.time = time;
      slotButton.addEventListener('click', () => {
        document.querySelectorAll('#booking-slots button').forEach(btn => btn.classList.remove('selected'));
        slotButton.classList.add('selected');
        elements.bookingTimeInput.value = time;
      });
      elements.bookingSlots.appendChild(slotButton);
    });
  } catch (error) {
    showToast('Failed to load available slots: ' + error.message);
  }
}

async function handleBookingSubmit(event) {
  event.preventDefault();
  const barberId = elements.bookingBarber.value;
  const date = elements.bookingDate.value;
  const time = elements.bookingTimeInput.value;
  const name = elements.clientName.value.trim();
  const phone = elements.clientPhone.value.trim();

  if (!barberId || !date || !time || !name || !phone) {
    showToast('Complete every booking field before submitting.');
    return;
  }

  try {
    await bookAppointment(barberId, date, time, name, phone);
    showToast('Your booking is confirmed. Thank you!');
    elements.bookingForm.reset();
    renderBookingSlots();
  } catch (error) {
    showToast('Booking failed: ' + error.message);
  }
}


// ==================== AUTH HANDLERS ====================

async function handleLoginSubmit(event) {
  event.preventDefault();
  const email = elements.loginEmail.value.trim().toLowerCase();
  const password = elements.loginPassword.value.trim();

  try {
    const user = await login(email, password);
    setupDashboard();
    closeModal(elements.loginModal);
    openModal(elements.dashboardModal);
    elements.loginForm.reset();
  } catch (error) {
    showToast('Login failed: ' + error.message);
  }
}

async function setupDashboard() {
  elements.dashboardTitle.textContent = `Hello, ${state.currentUser.name}`;

  // Load initial data
  await populateBarberSelects();
  await refreshAppointments();
  await refreshDayOffs();

  // Show boss section if boss
  if (state.currentUser.role === 'boss') {
    const bossTabBtn = document.querySelector('[data-tab="barbers"]');
    bossTabBtn.classList.remove('hidden');
  } else {
    const bossTabBtn = document.querySelector('[data-tab="barbers"]');
    bossTabBtn.classList.add('hidden');
    elements.dayoffBarber.value = state.currentUser.id;
  }

  renderAppointmentCalendar();
  renderDayOffCalendar();
  renderProfileForm();
  await renderStaffList();

  // Start auto-refresh every 5 minutes
  state.autoRefreshInterval = setInterval(async () => {
    await refreshAppointments();
    await refreshDayOffs();
  }, 5 * 60 * 1000);
}

async function refreshAppointments() {
  const year = state.currentMonthAppt.getFullYear();
  const month = state.currentMonthAppt.getMonth() + 1;
  await fetchAppointments(year, month);
  renderAppointmentCalendar();
}

async function refreshDayOffs() {
  const year = state.currentMonthDayoff.getFullYear();
  const month = state.currentMonthDayoff.getMonth() + 1;
  await fetchDayOffs(year, month);
  renderDayOffCalendar();
}

function handleLogout() {
  // Stop auto-refresh
  if (state.autoRefreshInterval) {
    clearInterval(state.autoRefreshInterval);
    state.autoRefreshInterval = null;
  }

  state.currentUser = null;
  state.token = null;
  state.appointments = [];
  state.dayOffs = [];
  localStorage.removeItem(STORAGE_KEY_TOKEN);
  closeModal(elements.dashboardModal);
  showToast('Logged out successfully.');
}


// ==================== DAY-OFF HANDLERS ====================

async function handleDayoffSubmit(event) {
  event.preventDefault();
  const date = elements.dayoffDate.value;
  const isRecurring = elements.dayoffRecurring.checked;
  const notes = elements.dayoffNotes.value.trim();
  const barberId = state.currentUser.role === 'boss' ? parseInt(elements.dayoffBarber.value) : state.currentUser.id;

  if (!date) {
    showToast('Select a date to mark as day off.');
    return;
  }

  try {
    await addDayOff(barberId, date, isRecurring, notes);
    showToast('Day off saved successfully.');
    elements.dayoffForm.reset();
    await refreshDayOffs();
  } catch (error) {
    showToast('Failed to save day off: ' + error.message);
  }
}

// ==================== BARBER CREATION ====================

async function handleCreateBarber(event) {
  event.preventDefault();
  const name = elements.newBarberName.value.trim();
  const role = elements.newBarberRole.value;
  const email = elements.newBarberEmail.value.trim().toLowerCase();
  const password = elements.newBarberPassword.value.trim();
  const bio = elements.newBarberBio.value.trim();
  const instagram = elements.newBarberInstagram.value.trim();
  const tiktok = elements.newBarberTiktok.value.trim();
  const photoUrls = normalizePhotoUrls(elements.newBarberPhotos.value);

  if (!name || !email || !password || !role) {
    showToast('Fill in all fields to add a new staff account.');
    return;
  }

  try {
    await createBarber(name, email, password, role, bio, instagram, tiktok, photoUrls);
    showToast('New staff account created.');
    elements.createBarberForm.reset();
    await populateBarberSelects();
    await renderStaffList();
  } catch (error) {
    showToast('Failed to create staff: ' + error.message);
  }
}

function renderProfileForm() {
  if (!elements.profileForm || !state.currentUser) return;
  elements.profileBio.value = state.currentUser.bio || '';
  elements.profileInstagram.value = state.currentUser.instagram || '';
  elements.profileTiktok.value = state.currentUser.tiktok || '';
  elements.profilePhotos.value = normalizePhotoUrls(state.currentUser.photo_urls).join(', ');
}

async function handleProfileSubmit(event) {
  event.preventDefault();
  if (!state.currentUser) return;

  const bio = elements.profileBio.value.trim();
  const instagram = elements.profileInstagram.value.trim();
  const tiktok = elements.profileTiktok.value.trim();
  const photoUrls = normalizePhotoUrls(elements.profilePhotos.value);

  try {
    const updated = await updateBarberProfile(state.currentUser.id, { bio, instagram, tiktok, photoUrls });
    state.currentUser = { ...state.currentUser, ...updated };
    localStorage.setItem('zigzagCurrentUser', JSON.stringify(state.currentUser));
    showToast('Profile saved successfully.');
    await populateBarberSelects();
    renderBarberProfiles();
    renderProfileForm();
  } catch (error) {
    showToast('Failed to save profile: ' + error.message);
  }
}

// ==================== MODAL HELPERS ====================

function openModal(modal) {
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal(modal) {
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

// ==================== TAB SYSTEM ====================

function initTabs() {
  elements.tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;

      // Deactivate all tabs
      elements.tabButtons.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));

      // Activate clicked tab
      btn.classList.add('active');
      document.getElementById(`${tabName}-tab`).classList.add('active');

      // Load fresh data when switching to tabs
      if (tabName === 'appointments') {
        refreshAppointments();
      } else if (tabName === 'dayoffs') {
        refreshDayOffs();
      }
    });
  });
}

// ==================== CALENDAR NAVIGATION ====================

function initCalendarNav() {
  elements.prevMonthApptBtn.addEventListener('click', () => {
    state.currentMonthAppt.setMonth(state.currentMonthAppt.getMonth() - 1);
    refreshAppointments();
  });

  elements.nextMonthApptBtn.addEventListener('click', () => {
    state.currentMonthAppt.setMonth(state.currentMonthAppt.getMonth() + 1);
    refreshAppointments();
  });

  elements.prevMonthDayoffBtn.addEventListener('click', () => {
    state.currentMonthDayoff.setMonth(state.currentMonthDayoff.getMonth() - 1);
    refreshDayOffs();
  });

  elements.nextMonthDayoffBtn.addEventListener('click', () => {
    state.currentMonthDayoff.setMonth(state.currentMonthDayoff.getMonth() + 1);
    refreshDayOffs();
  });
}

// ==================== INITIALIZATION ====================

async function init() {
  // Restore token if exists
  const storedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
  const storedUser = localStorage.getItem('zigzagCurrentUser');
  if (storedToken) {
    state.token = storedToken;
  }
  if (storedUser) {
    try {
      state.currentUser = JSON.parse(storedUser);
    } catch (error) {
      console.warn('Invalid stored user, clearing it');
      localStorage.removeItem('zigzagCurrentUser');
    }
  }

  if (state.token && !state.currentUser) {
    try {
      await fetchCurrentUser();
    } catch (error) {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      localStorage.removeItem('zigzagCurrentUser');
      state.token = null;
      state.currentUser = null;
    }
  }

  // Set min date for booking
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  elements.bookingDate.value = formatDateForInput(tomorrow);
  state.currentBookingMonth = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), 1);
  elements.dayoffDate.min = formatDateForInput(new Date());

  renderBookingDateCalendar();
  selectBookingDate(new Date(tomorrow));

  // Event listeners
  elements.bookingForm.addEventListener('submit', handleBookingSubmit);
  elements.loginForm.addEventListener('submit', handleLoginSubmit);
  elements.dayoffForm.addEventListener('submit', handleDayoffSubmit);
  elements.createBarberForm.addEventListener('submit', handleCreateBarber);
  if (elements.profileForm) {
    elements.profileForm.addEventListener('submit', handleProfileSubmit);
  }

  elements.bookingBarber.addEventListener('change', renderBookingSlots);
  elements.bookingDate.addEventListener('change', renderBookingSlots);
  elements.prevBookingMonthBtn.addEventListener('click', () => {
    state.currentBookingMonth.setMonth(state.currentBookingMonth.getMonth() - 1);
    renderBookingDateCalendar();
  });
  elements.nextBookingMonthBtn.addEventListener('click', () => {
    state.currentBookingMonth.setMonth(state.currentBookingMonth.getMonth() + 1);
    renderBookingDateCalendar();
  });

  elements.openLogin.addEventListener('click', () => {
    // Auto-fill login form if credentials saved
    const savedEmail = localStorage.getItem('zigzagLoginEmail');
    const savedPassword = localStorage.getItem('zigzagLoginPassword');
    if (savedEmail) elements.loginEmail.value = savedEmail;
    if (savedPassword) elements.loginPassword.value = savedPassword;
    openModal(elements.loginModal);
  });
  elements.heroLogin.addEventListener('click', () => {
    // Auto-fill login form if credentials saved
    const savedEmail = localStorage.getItem('zigzagLoginEmail');
    const savedPassword = localStorage.getItem('zigzagLoginPassword');
    if (savedEmail) elements.loginEmail.value = savedEmail;
    if (savedPassword) elements.loginPassword.value = savedPassword;
    openModal(elements.loginModal);
  });
  elements.closeLogin.addEventListener('click', () => closeModal(elements.loginModal));
  elements.closeDashboard.addEventListener('click', () => closeModal(elements.dashboardModal));
  elements.logoutButton.addEventListener('click', handleLogout);

  elements.heroBook.addEventListener('click', () => {
    document.getElementById('booking').scrollIntoView({ behavior: 'smooth' });
  });
  elements.openBooking.addEventListener('click', () => {
    document.getElementById('booking').scrollIntoView({ behavior: 'smooth' });
  });

  initTabs();
  initCalendarNav();

  // Load barbers on initial page load
  await populateBarberSelects();

  const token = localStorage.getItem('token');
  if (token) {
    try {
      const response = await apiCall('/api/auth/me');
      state.currentUser = response.user;
      await setupDashboard();
      openModal(elements.dashboardModal);
    } catch (error) {
      if (error.message === 'Invalid token') {
        // Token is invalid/expired, clear it
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        console.log('Token expired, cleared local storage');
      } else {
        console.error('Failed to validate token:', error);
      }
    }
  }
}

init().catch(error => {
  console.error('Initialization failed:', error);
});
