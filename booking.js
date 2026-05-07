const API_BASE = '/api';
const SLOT_TIMES = ['10:00 AM', '11:30 AM', '1:00 PM', '2:30 PM', '4:00 PM', '5:30 PM'];

const elements = {
  barberGrid: document.getElementById('booking-barber-grid'),
  barberSelect: document.getElementById('booking-barber'),
  bookingDate: document.getElementById('booking-date'),
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
      ? 'Cannot reach the API. Run the server and open the page at http://localhost:3001/booking.html'
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
        <p>${barber.bio || 'Experienced barber with available slots.'}</p>
        <div class="barber-social-links"></div>
        <button class="btn btn-secondary">Select stylist</button>
      </div>
    `;
    const imageContainer = card.querySelector('.barber-profile-images');
    const galleryUrls = normalizePhotoUrls(barber.photo_urls);
    if (galleryUrls.length) {
      galleryUrls.slice(0, 3).forEach(url => {
        const img = document.createElement('img');
        img.src = url;
        img.alt = barber.name;
        imageContainer.appendChild(img);
      });
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'barber-profile-placeholder';
      placeholder.textContent = 'No photos yet';
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
    card.querySelector('button').addEventListener('click', () => {
      elements.barberSelect.value = barber.id;
      setSelectedBarber(barber.id);
      renderBarberGallery();
      renderAvailableSlots();
      document.getElementById('booking-form').scrollIntoView({ behavior: 'smooth' });
    });
    elements.barberGrid.appendChild(card);
  });
}

function renderBarberGallery() {
  const barber = state.barbers.find(b => String(b.id) === String(state.selectedBarberId));
  elements.gallery.innerHTML = '';
  if (!barber) {
    elements.gallery.innerHTML = '<p>No barber selected yet.</p>';
    return;
  }
  const urls = normalizePhotoUrls(barber.photo_urls);
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
}

async function renderAvailableSlots() {
  elements.bookingSlots.innerHTML = '';
  elements.bookingTime.value = '';
  const barberId = elements.barberSelect.value;
  const date = elements.bookingDate.value;
  if (!barberId || !date) {
    elements.bookingSlots.innerHTML = '<div class="slot-message">Pick a barber and date to see open times.</div>';
    return;
  }
  try {
    const data = await apiCall(`/appointments/available?barberId=${barberId}&date=${date}`, { method: 'GET' });
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
  if (!barberId || !date || !time || !clientName || !clientPhone) {
    showToast('Complete all booking fields.');
    return;
  }
  try {
    await apiCall('/appointments', {
      method: 'POST',
      body: JSON.stringify({ barberId, date, time, clientName, clientPhone }),
    });
    showToast('Appointment booked successfully.');
    elements.bookingForm.reset();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    elements.bookingDate.value = tomorrow.toISOString().split('T')[0];
    renderAvailableSlots();
  } catch (error) {
    showToast('Booking failed: ' + error.message);
  }
}

function bindEvents() {
  elements.barberSelect.addEventListener('change', () => {
    setSelectedBarber(elements.barberSelect.value);
    renderBarberGallery();
    renderAvailableSlots();
  });
  elements.bookingDate.addEventListener('change', renderAvailableSlots);
  elements.bookingForm.addEventListener('submit', handleBookingSubmit);
}

async function init() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  elements.bookingDate.value = tomorrow.toISOString().split('T')[0];
  bindEvents();
  await fetchBarbers();
  renderBarberCards();
  fillBarberSelect();
  renderAvailableSlots();
}

init().catch(error => {
  console.error('Booking page failed:', error);
  showToast('Failed to initialize booking page.');
});
