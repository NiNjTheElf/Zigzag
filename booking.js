const API_BASE = (window.location.protocol === 'file:' ? 'http://localhost:3000' : window.location.origin) + '/api';
const SLOT_TIMES = ['10:00 AM', '11:30 AM', '1:00 PM', '2:30 PM', '4:00 PM', '5:30 PM'];

const elements = {
  barberGrid: document.getElementById('booking-barber-grid'),
  barberSelect: document.getElementById('booking-barber'),
  bookingDate: document.getElementById('booking-date'),
  bookingCalendar: document.getElementById('booking-calendar'),
  bookingCalendarMonth: document.getElementById('booking-calendar-month'),
  bookingSelectedDate: document.getElementById('booking-selected-date'),
  bookingPrevMonth: document.getElementById('booking-prev-month'),
  bookingNextMonth: document.getElementById('booking-next-month'),
  bookingService: document.getElementById('booking-service'),
  bookingServiceOptions: document.getElementById('booking-service-options'),
  bookingTime: document.getElementById('booking-time'),
  bookingSlots: document.getElementById('booking-slots'),
  bookingForm: document.getElementById('booking-form'),
  clientName: document.getElementById('client-name'),
  clientPhone: document.getElementById('client-phone'),
  gallery: document.getElementById('barber-gallery'),
  toast: document.getElementById('booking-toast'),
};

const state = {
  barbers: [],
  selectedBarberId: null,
  selectedDateKey: '',
  currentCalendarMonth: new Date(),
  todayDateKey: '',
  closedDateKeys: new Set(),
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

async function apiCall(endpoint, options = {}) {
  const headers = { ...options.headers };
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Request failed');
    }
    return response.json().catch(() => ({}));
  } catch (error) {
    const message = error.message.includes('Failed to fetch')
      ? 'Cannot reach the API. Run the server and open the page at http://localhost:3000/booking.html'
      : error.message;
    throw new Error(message);
  }
}

function normalizePhotoUrls(photoData) {
  if (!photoData) return [];
  if (Array.isArray(photoData)) return photoData.filter(Boolean);
  if (typeof photoData === 'string') return photoData.split(',').map(url => url.trim()).filter(Boolean);
  return [];
}

function getProfilePhotoUrl(barber) {
  return barber.profile_photo_url || barber.profilePhotoUrl || normalizePhotoUrls(barber.photo_urls || barber.photoUrls)[0] || '';
}

function normalizeDuration(value) {
  const duration = parseInt(value, 10);
  if (!Number.isFinite(duration)) return 60;
  return Math.min(Math.max(duration, 5), 480);
}

function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey) {
  if (!dateKey) return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatSelectedDateLabel(dateKey) {
  const date = parseDateKey(dateKey);
  if (!date) return 'Selected date: --';
  const pretty = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  return `Selected date: ${pretty}`;
}

function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getDaysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function getFirstDayOffsetMonday(date) {
  return (getMonthStart(date).getDay() + 6) % 7;
}

async function fetchClosedDatesForCurrentMonth() {
  if (!state.selectedBarberId) {
    state.closedDateKeys = new Set();
    return;
  }
  const monthStart = getMonthStart(state.currentCalendarMonth);
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth() + 1;
  try {
    const params = new URLSearchParams({
      barberId: String(state.selectedBarberId),
      year: String(year),
      month: String(month),
    });
    const data = await apiCall(`/dayoffs/public?${params.toString()}`, { method: 'GET' });
    state.closedDateKeys = new Set((data.closedDates || []).filter(Boolean));
  } catch (error) {
    state.closedDateKeys = new Set();
    showToast('Could not load day-off markers: ' + error.message);
  }
}

async function refreshCalendarDayOffMarkers() {
  await fetchClosedDatesForCurrentMonth();
  renderBookingCalendar();
}

function renderBookingCalendar() {
  if (!elements.bookingCalendar) return;

  const monthStart = getMonthStart(state.currentCalendarMonth);
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const daysInMonth = getDaysInMonth(monthStart);
  const startOffset = getFirstDayOffsetMonday(monthStart);
  const todayStart = parseDateKey(state.todayDateKey);

  if (elements.bookingCalendarMonth) {
    elements.bookingCalendarMonth.textContent = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  elements.bookingCalendar.innerHTML = '';
  const headerDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  headerDays.forEach(day => {
    const header = document.createElement('div');
    header.className = 'calendar-header';
    header.textContent = day;
    elements.bookingCalendar.appendChild(header);
  });

  for (let i = 0; i < startOffset; i++) {
    const emptyDay = document.createElement('div');
    emptyDay.className = 'calendar-day other-month';
    elements.bookingCalendar.appendChild(emptyDay);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateKey = formatDateForInput(date);
    const isClosed = state.closedDateKeys.has(dateKey);
    const dayButton = document.createElement('button');
    dayButton.type = 'button';
    dayButton.className = 'calendar-day booking-window-day';
    dayButton.dataset.date = dateKey;

    if (dateKey === state.selectedDateKey) {
      dayButton.classList.add('window-selected');
    }
    if (isClosed) {
      dayButton.classList.add('window-closed');
      dayButton.disabled = true;
      dayButton.setAttribute('aria-disabled', 'true');
    } else if (dateKey === state.todayDateKey) {
      dayButton.classList.add('today', 'window-today');
    } else if (todayStart && date < todayStart) {
      dayButton.classList.add('past', 'window-broken');
      dayButton.disabled = true;
      dayButton.setAttribute('aria-disabled', 'true');
    } else {
      dayButton.classList.add('window-future');
    }

    const dayNumber = document.createElement('div');
    dayNumber.className = 'calendar-day-number';
    dayNumber.textContent = String(day);

    const dayState = document.createElement('div');
    dayState.className = 'calendar-day-indicator';
    dayState.textContent = isClosed
      ? 'CLOSED'
      : (dateKey === state.todayDateKey ? 'TODAY' : (dayButton.classList.contains('past') ? 'PASSED' : 'OPEN'));

    dayButton.append(dayNumber, dayState);
    dayButton.addEventListener('click', () => {
      setSelectedBookingDate(dateKey, { keepMonth: true, render: true, loadSlots: true });
    });

    elements.bookingCalendar.appendChild(dayButton);
  }

  const totalCells = startOffset + daysInMonth;
  const remainder = (7 - (totalCells % 7)) % 7;
  for (let i = 0; i < remainder; i++) {
    const emptyDay = document.createElement('div');
    emptyDay.className = 'calendar-day other-month';
    elements.bookingCalendar.appendChild(emptyDay);
  }
}

function setSelectedBookingDate(dateKey, options = {}) {
  const { keepMonth = false, render = true, loadSlots = false } = options;
  if (!dateKey) return;
  const selectedDate = parseDateKey(dateKey);
  const todayStart = parseDateKey(state.todayDateKey);
  if (!selectedDate) return;
  if (todayStart && selectedDate < todayStart) {
    showToast('Pick today or a future date.');
    return;
  }
  if (state.closedDateKeys.has(dateKey)) {
    showToast('This day is closed (day-off). Choose another date.');
    return;
  }

  state.selectedDateKey = dateKey;
  elements.bookingDate.value = dateKey;

  if (!keepMonth) {
    state.currentCalendarMonth = getMonthStart(selectedDate);
  }
  if (elements.bookingSelectedDate) {
    elements.bookingSelectedDate.textContent = formatSelectedDateLabel(dateKey);
  }
  if (render) {
    renderBookingCalendar();
  }
  if (loadSlots) {
    renderAvailableSlots();
  }
}

async function fetchBarbers() {
  state.barbers = await apiCall('/barbers', { method: 'GET' });
  return state.barbers;
}

function renderBarberCards() {
  elements.barberGrid.innerHTML = '';
  state.barbers.forEach(barber => {
    const card = document.createElement('div');
    card.className = 'barber-profile-card';
    card.innerHTML = `
      <div class="barber-profile-images"></div>
      <div class="barber-profile-info">
        <strong>${barber.name}</strong>
        <div class="barber-rating" id="rating-${barber.id}">
          <span class="stars">★★★★★</span>
          <span class="rating-text">Loading...</span>
        </div>
        <p>${barber.bio || 'Experienced barber with available slots.'}</p>
        <div class="barber-social-links"></div>
        <button class="btn btn-secondary" data-action="book" data-id="${barber.id}">Select stylist</button>
        <button class="btn btn-secondary" style="margin-top: 8px;" data-action="reviews" data-id="${barber.id}">See Reviews</button>
      </div>
    `;
    const imageContainer = card.querySelector('.barber-profile-images');
    const profilePhoto = getProfilePhotoUrl(barber);
    if (profilePhoto) {
      const img = document.createElement('img');
      img.src = profilePhoto;
      img.alt = barber.name;
      imageContainer.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'barber-profile-placeholder';
      placeholder.textContent = 'No profile photo yet';
      imageContainer.appendChild(placeholder);
    }
    const socials = card.querySelector('.barber-social-links');
    if (barber.instagram) {
      const link = document.createElement('a');
      link.href = barber.instagram.startsWith('@') ? `https://instagram.com/${barber.instagram.slice(1)}` : barber.instagram;
      link.textContent = barber.instagram;
      link.target = '_blank';
      socials.appendChild(link);
    }
    if (barber.tiktok) {
      const link = document.createElement('a');
      link.href = barber.tiktok.startsWith('@') ? `https://www.tiktok.com/${barber.tiktok.slice(1)}` : barber.tiktok;
      link.textContent = barber.tiktok;
      link.target = '_blank';
      socials.appendChild(link);
    }
    
    card.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (btn.dataset.action === 'book') {
          elements.barberSelect.value = barber.id;
          setSelectedBarber(barber.id);
          await refreshCalendarDayOffMarkers();
          renderBarberGallery();
          renderAvailableSlots();
          document.getElementById('booking-form').scrollIntoView({ behavior: 'smooth' });
        } else if (btn.dataset.action === 'reviews') {
          openReviewsModal(barber);
        }
      });
    });
    
    elements.barberGrid.appendChild(card);
    
    // Load and display rating
    loadAndDisplayRating(barber.id);
  });
}

async function loadAndDisplayRating(barberId) {
  try {
    const ratingData = await apiCall(`/reviews/average/${barberId}`);
    const ratingElement = document.getElementById(`rating-${barberId}`);
    if (ratingElement) {
      if (ratingData.count === 0) {
        ratingElement.innerHTML = '<span class="rating-text">No reviews yet</span>';
      } else {
        const stars = '★'.repeat(Math.round(ratingData.average)) + '☆'.repeat(5 - Math.round(ratingData.average));
        ratingElement.innerHTML = `
          <span class="stars">${stars}</span>
          <span class="rating-text">${ratingData.average.toFixed(1)} (${ratingData.count} ${ratingData.count === 1 ? 'review' : 'reviews'})</span>
        `;
      }
    }
  } catch (error) {
    console.error('Failed to load rating:', error);
  }
}

function openReviewsModal(barber) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-panel" style="max-width: 500px;">
      <button class="close-btn" type="button">&times;</button>
      <div class="modal-content" style="padding: 24px; overflow-y: auto;">
        <h2>${barber.name} - Reviews</h2>
        <div id="reviews-list" style="margin-bottom: 20px; max-height: 300px; overflow-y: auto;"></div>
        <hr style="border: 1px solid rgba(236, 232, 221, 0.13); margin: 20px 0;">
        <h3>Leave a Review</h3>
        <form id="review-form" style="display: grid; gap: 12px;">
          <div>
            <label for="review-name">Your Name *</label>
            <input id="review-name" type="text" required placeholder="Your full name" style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid rgba(236, 232, 221, 0.18); background: #0b090c; color: #fff;">
          </div>
          <div>
            <label for="review-phone">Phone Number *</label>
            <input id="review-phone" type="tel" required placeholder="Your phone number" style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid rgba(236, 232, 221, 0.18); background: #0b090c; color: #fff;">
          </div>
          <div>
            <label for="review-rating">Rating *</label>
            <div id="review-rating" style="display: flex; gap: 10px; font-size: 24px;">
              <button type="button" class="star-btn" data-rating="1">☆</button>
              <button type="button" class="star-btn" data-rating="2">☆</button>
              <button type="button" class="star-btn" data-rating="3">☆</button>
              <button type="button" class="star-btn" data-rating="4">☆</button>
              <button type="button" class="star-btn" data-rating="5">☆</button>
            </div>
            <input id="review-rating-value" type="hidden" required>
          </div>
          <div>
            <label for="review-comment">Comment (Optional)</label>
            <textarea id="review-comment" placeholder="Share your experience..." style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid rgba(236, 232, 221, 0.18); background: #0b090c; color: #fff; min-height: 80px;"></textarea>
          </div>
          <button type="submit" class="btn btn-primary">Submit Review</button>
        </form>
      </div>
    </div>
  `;
  
  const closeButton = modal.querySelector('.close-btn');
  closeButton.addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (event) => {
    if (event.target === modal) modal.remove();
  });
  
  document.body.appendChild(modal);
  
  // Load reviews
  loadReviews(barber.id, modal);
  
  // Setup star rating
  let selectedRating = 0;
  modal.querySelectorAll('.star-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      selectedRating = parseInt(btn.dataset.rating);
      modal.querySelector('#review-rating-value').value = selectedRating;
      modal.querySelectorAll('.star-btn').forEach((b, idx) => {
        b.textContent = idx < selectedRating ? '★' : '☆';
      });
    });
  });
  
  // Handle form submission
  modal.querySelector('#review-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = modal.querySelector('#review-name').value.trim();
    const phone = modal.querySelector('#review-phone').value.trim();
    const rating = parseInt(modal.querySelector('#review-rating-value').value);
    const comment = modal.querySelector('#review-comment').value.trim();
    
    if (!name || !phone || !rating) {
      showToast('Please fill in all required fields and select a rating.');
      return;
    }
    
    try {
      await apiCall('/reviews', {
        method: 'POST',
        body: JSON.stringify({
          barberId: barber.id,
          clientName: name,
          clientPhone: phone,
          rating,
          comment: comment || null,
        }),
      });
      showToast('Thank you for your review!');
      await loadReviews(barber.id, modal);
      modal.querySelector('#review-form').reset();
      selectedRating = 0;
      modal.querySelectorAll('.star-btn').forEach(b => b.textContent = '☆');
    } catch (error) {
      showToast('Failed to submit review: ' + error.message);
    }
  });
}

async function loadReviews(barberId, modal) {
  try {
    const reviews = await apiCall(`/reviews?barberId=${barberId}`);
    const reviewsList = modal.querySelector('#reviews-list');
    
    if (!reviews || reviews.length === 0) {
      reviewsList.innerHTML = '<p style="color: #b7b0a2;">No reviews yet. Be the first to review!</p>';
      return;
    }
    
    reviewsList.innerHTML = '';
    reviews.forEach(review => {
      const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
      const reviewEl = document.createElement('div');
      reviewEl.style.cssText = 'margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid rgba(236, 232, 221, 0.13);';
      reviewEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <strong>${review.client_name}</strong>
          <span style="color: #d7a857;">${stars}</span>
        </div>
        ${review.comment ? `<p style="margin: 8px 0; color: #b7b0a2;">${review.comment}</p>` : ''}
        <small style="color: #898477;">${new Date(review.created_at).toLocaleDateString()}</small>
      `;
      reviewsList.appendChild(reviewEl);
    });
  } catch (error) {
    console.error('Failed to load reviews:', error);
  }
}

function renderBarberGallery() {
  const barber = state.barbers.find(b => String(b.id) === String(state.selectedBarberId));
  elements.gallery.innerHTML = '';
  if (!barber) {
    elements.gallery.innerHTML = '<p>No barber selected yet.</p>';
    return;
  }
  const urls = normalizePhotoUrls(barber.photo_urls || barber.photoUrls);
  if (!urls.length) {
    elements.gallery.innerHTML = '<p>This barber has not uploaded any photos yet.</p>';
    return;
  }
  urls.forEach(url => {
    const image = document.createElement('div');
    image.className = 'gallery-image';
    image.style.backgroundImage = `url('${url}')`;
    elements.gallery.appendChild(image);
  });
}

function parseBarberServices(rawServices) {
  if (!rawServices) return [];
  if (Array.isArray(rawServices)) {
    return rawServices.map(item => {
      if (typeof item === 'string') return { name: item, durationMinutes: 60 };
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
              if (typeof item === 'string') return { name: item, durationMinutes: 60 };
              return { ...item, durationMinutes: normalizeDuration(item.durationMinutes || item.duration || 60) };
            })
          : [];
      } catch {
        // legacy fallthrough
      }
    }
    const parts = trimmed.split(';').map(s => s.trim()).filter(Boolean);
    const services = [];
    parts.forEach(part => {
      const [category, items] = part.split(':').map(s => s.trim());
      if (!items) return;
      items.split(',').map(item => item.trim()).filter(Boolean).forEach(item => {
        services.push({ name: `${category} - ${item}`, durationMinutes: 60 });
      });
    });
    if (services.length) return services;
    return [{ name: trimmed, durationMinutes: 60 }];
  }
  return [];
}

function fillBarberSelect() {
  elements.barberSelect.innerHTML = '';
  state.barbers.forEach(barber => {
    const option = document.createElement('option');
    option.value = barber.id;
    option.textContent = barber.name;
    elements.barberSelect.appendChild(option);
  });
  if (state.barbers.length) {
    state.selectedBarberId = state.barbers[0].id;
    elements.barberSelect.value = state.selectedBarberId;
    setSelectedBarber(state.selectedBarberId);
    renderBarberGallery();
  }
}

function setSelectedBarber(id) {
  state.selectedBarberId = id;
  populateServiceSelect(id);
}

function populateServiceSelect(barberId) {
  elements.bookingService.innerHTML = '';
  elements.bookingServiceOptions.innerHTML = '';
  const barber = state.barbers.find(b => String(b.id) === String(barberId));
  const services = barber ? parseBarberServices(barber.services) : [];
  const options = services.length ? services : [{ name: 'Haircut' }, { name: 'Beard' }, { name: 'Haircut + Beard' }];
  options.forEach((service, index) => {
    const durationMinutes = normalizeDuration(service.durationMinutes || service.duration || 60);
    const option = document.createElement('option');
    option.value = service.name;
    option.textContent = service.name;
    option.dataset.duration = String(durationMinutes);
    elements.bookingService.appendChild(option);

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'booking-service-option';
    if (index === 0) card.classList.add('selected');
    card.innerHTML = `
      <span class="booking-service-text">
        <span>${service.name}</span>
        <small>${durationMinutes} min</small>
      </span>
      ${service.photoUrl ? `<img src="${service.photoUrl}" alt="${service.name}" />` : '<span class="service-option-empty">No photo</span>'}
    `;
    card.addEventListener('click', () => {
      elements.bookingService.value = service.name;
      elements.bookingServiceOptions.querySelectorAll('.booking-service-option').forEach(btn => btn.classList.remove('selected'));
      card.classList.add('selected');
      renderAvailableSlots();
    });
    elements.bookingServiceOptions.appendChild(card);
  });
}

function getSelectedServiceDuration() {
  const option = elements.bookingService.selectedOptions[0];
  return normalizeDuration(option?.dataset.duration || 60);
}

async function renderAvailableSlots() {
  elements.bookingSlots.innerHTML = '';
  elements.bookingTime.value = '';
  const barberId = elements.barberSelect.value;
  const date = elements.bookingDate.value;
  const serviceType = elements.bookingService.value;
  const durationMinutes = getSelectedServiceDuration();
  if (!barberId || !date) {
    elements.bookingSlots.innerHTML = '<div class="slot-message">Pick a barber and date to see open times.</div>';
    return;
  }
  if (state.closedDateKeys.has(date)) {
    elements.bookingSlots.innerHTML = '<div class="slot-message">Closed day-off. Pick another date.</div>';
    return;
  }
  try {
    const params = new URLSearchParams({
      barberId,
      date,
      serviceType: serviceType || '',
      durationMinutes: String(durationMinutes),
    });
    const data = await apiCall(`/appointments/available?${params.toString()}`, { method: 'GET' });
    if (data.isDayOff) {
      elements.bookingSlots.innerHTML = '<div class="slot-message">This barber is off on the selected day.</div>';
      return;
    }
    if (!data.available.length) {
      elements.bookingSlots.innerHTML = '<div class="slot-message">No open slots. Choose another day.</div>';
      return;
    }
    data.available.forEach(time => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = time;
      button.addEventListener('click', () => {
        elements.bookingTime.value = time;
        document.querySelectorAll('#booking-slots button').forEach(btn => btn.classList.remove('selected'));
        button.classList.add('selected');
      });
      elements.bookingSlots.appendChild(button);
    });
  } catch (error) {
    showToast('Failed to load slots: ' + error.message);
  }
}

async function handleBookingSubmit(event) {
  event.preventDefault();
  const barberId = elements.barberSelect.value;
  const date = elements.bookingDate.value;
  const time = elements.bookingTime.value;
  const clientName = elements.clientName.value.trim();
  const clientPhone = elements.clientPhone.value.trim();
  const durationMinutes = getSelectedServiceDuration();
  if (!barberId || !date || !time || !clientName || !clientPhone || !elements.bookingService.value) {
    showToast('Complete all booking fields.');
    return;
  }
  try {
    await apiCall('/appointments', {
      method: 'POST',
      body: JSON.stringify({ barberId, date, time, clientName, clientPhone, serviceType: elements.bookingService.value, durationMinutes }),
    });
    showToast('Appointment booked successfully.');
    elements.bookingForm.reset();
    populateServiceSelect(elements.barberSelect.value);
    setSelectedBookingDate(state.todayDateKey, { keepMonth: false, render: true, loadSlots: false });
    renderAvailableSlots();
  } catch (error) {
    showToast('Booking failed: ' + error.message);
  }
}

function bindEvents() {
  elements.barberSelect.addEventListener('change', async () => {
    setSelectedBarber(elements.barberSelect.value);
    await refreshCalendarDayOffMarkers();
    renderBarberGallery();
    renderAvailableSlots();
  });
  elements.bookingDate.addEventListener('change', () => {
    setSelectedBookingDate(elements.bookingDate.value, { keepMonth: false, render: true, loadSlots: true });
  });
  elements.bookingPrevMonth?.addEventListener('click', async () => {
    state.currentCalendarMonth = new Date(
      state.currentCalendarMonth.getFullYear(),
      state.currentCalendarMonth.getMonth() - 1,
      1
    );
    await refreshCalendarDayOffMarkers();
  });
  elements.bookingNextMonth?.addEventListener('click', async () => {
    state.currentCalendarMonth = new Date(
      state.currentCalendarMonth.getFullYear(),
      state.currentCalendarMonth.getMonth() + 1,
      1
    );
    await refreshCalendarDayOffMarkers();
  });
  elements.bookingService.addEventListener('change', () => {
    elements.bookingServiceOptions.querySelectorAll('.booking-service-option').forEach(button => {
      button.classList.toggle('selected', button.querySelector('.booking-service-text span')?.textContent === elements.bookingService.value);
    });
    renderAvailableSlots();
  });
  elements.bookingForm.addEventListener('submit', handleBookingSubmit);
}

async function init() {
  const today = new Date();
  state.todayDateKey = formatDateForInput(today);
  state.currentCalendarMonth = getMonthStart(today);
  if (elements.bookingDate) {
    elements.bookingDate.min = state.todayDateKey;
  }
  setSelectedBookingDate(state.todayDateKey, { keepMonth: false, render: true, loadSlots: false });
  bindEvents();
  await fetchBarbers();
  renderBarberCards();
  fillBarberSelect();
  await refreshCalendarDayOffMarkers();
  renderAvailableSlots();
}

init().catch(error => {
  console.error('Booking page failed:', error);
  showToast('Failed to initialize booking page.');
});
