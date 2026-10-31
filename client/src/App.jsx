import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, json } from './api.js';

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const nextStaffSlot = () => {
  const times = ['17:00', '18:30', '20:00'];
  const date = new Date();
  const currentDate = today();
  const nextTime = times.find((time) => new Date(`${currentDate}T${time}:00`).getTime() > date.getTime());
  if (nextTime) return { date: currentDate, time: nextTime };
  date.setDate(date.getDate() + 1);
  return {
    date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    time: times[0],
  };
};

const locationForPage = (page, restaurantId) => {
  if (page === 'staff-login') return '/staff/login';
  if (page === 'staff') return '/staff';
  if (page === 'directory') return '/restaurants';
  if (page === 'restaurant' && restaurantId) return `/restaurants/${encodeURIComponent(restaurantId)}`;
  if (page === 'reservations') return '/reservations';
  if (page === 'queue') return '/walk-ins';
  if (page === 'login' || page === 'register') return `/${page}`;
  return '/';
};

const pageFromLocation = () => {
  const path = window.location.pathname;
  if (path === '/staff/login') return { page: 'staff-login', restaurantId: '' };
  if (path === '/staff') return { page: 'staff', restaurantId: '' };
  if (path === '/restaurants') return { page: 'directory', restaurantId: '' };
  if (path.startsWith('/restaurants/')) {
    return { page: 'restaurant', restaurantId: decodeURIComponent(path.slice('/restaurants/'.length)) };
  }
  if (path === '/reservations') return { page: 'reservations', restaurantId: '' };
  if (path === '/walk-ins') return { page: 'queue', restaurantId: '' };
  if (path === '/login' || path === '/register') return { page: path.slice(1), restaurantId: '' };
  return { page: 'home', restaurantId: '' };
};

function RestaurantCard({ restaurant, onOpen }) {
  return (
    <article className="restaurant-card">
      <button className="restaurant-card-image-button" onClick={() => onOpen(restaurant)} aria-label={`View ${restaurant.name}`}>
        <img src={restaurant.coverImage} alt="" className="restaurant-card-image" loading="lazy" />
        {restaurant.isDemo && <span className="demo-badge">DEMO</span>}
      </button>
      <div className="restaurant-card-body">
        <p className="eyebrow">{restaurant.cuisine}</p>
        <h3>{restaurant.name}</h3>
        <p className="restaurant-location">{restaurant.area} · Mumbai</p>
        <p className="restaurant-description">{restaurant.description}</p>
        <button className="restaurant-card-action" onClick={() => onOpen(restaurant)}>View restaurant <span>↗</span></button>
      </div>
    </article>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [initialLocation] = useState(pageFromLocation);
  const [page, setPage] = useState(initialLocation.page);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reservations, setReservations] = useState([]);
  const [queueEntries, setQueueEntries] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(initialLocation.restaurantId);
  const [restaurantsLoading, setRestaurantsLoading] = useState(true);
  const [reservation, setReservation] = useState({ restaurantId: initialLocation.restaurantId, date: today(), time: '', guests: '2', note: '' });
  const [availability, setAvailability] = useState([]);
  const [queueGuests, setQueueGuests] = useState('2');
  const [queueRestaurantId, setQueueRestaurantId] = useState(initialLocation.restaurantId);
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [staffForm, setStaffForm] = useState({ email: '', password: '' });
  const [staffWorkspace, setStaffWorkspace] = useState({ restaurant: null, reservations: [], entries: [], tables: [] });
  const [staffSlot, setStaffSlot] = useState(nextStaffSlot);
  const [staffLoading, setStaffLoading] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const clearMessages = () => { setNotice(''); setError(''); };
  const loadUserData = useCallback(async () => {
    const [bookings, queue] = await Promise.all([
      api('/reservations/mine'),
      api('/queue/mine'),
    ]);
    setReservations(bookings.reservations);
    setQueueEntries(queue.entries);
  }, []);

  const loadStaffData = useCallback(async (tableSlot = nextStaffSlot()) => {
    setStaffLoading(true);
    try {
      const [profile, bookings, queue, tables] = await Promise.all([
        api('/staff/me'),
        api('/staff/reservations'),
        api('/staff/queue'),
        api(`/staff/tables?date=${encodeURIComponent(tableSlot.date)}&time=${encodeURIComponent(tableSlot.time)}`),
      ]);
      setStaffWorkspace({
        restaurant: profile.restaurant,
        reservations: bookings.reservations,
        entries: queue.entries,
        tables: tables.tables,
      });
    } finally {
      setStaffLoading(false);
    }
  }, []);

  useEffect(() => {
    api('/auth/me')
      .then(({ user: currentUser }) => {
        setUser(currentUser);
        if (currentUser.role === 'restaurant_admin') {
          setPage('staff');
          window.history.replaceState({}, '', '/staff');
          return loadStaffData();
        }
        if (initialLocation.page === 'staff') {
          setPage('staff-login');
          window.history.replaceState({}, '', '/staff/login');
        }
        return loadUserData();
      })
      .catch((requestError) => {
        if (!(requestError instanceof ApiError && requestError.status === 401)) {
          setError(requestError.message || 'Could not restore your account details.');
        }
        if (initialLocation.page === 'staff') {
          setPage('staff-login');
          window.history.replaceState({}, '', '/staff/login');
        }
      })
      .finally(() => setAuthLoading(false));
  }, [loadUserData, loadStaffData, initialLocation.page]);

  useEffect(() => {
    api('/restaurants')
      .then(({ restaurants: availableRestaurants }) => {
        setRestaurants(availableRestaurants);
        const initialId = initialLocation.restaurantId || availableRestaurants[0]?.id || '';
        setSelectedRestaurantId((current) => current || initialId);
        setReservation((current) => ({ ...current, restaurantId: current.restaurantId || initialId }));
        setQueueRestaurantId((current) => current || initialId);
      })
      .catch((requestError) => setError(requestError.message || 'Could not load restaurants.'))
      .finally(() => setRestaurantsLoading(false));
  }, [initialLocation.restaurantId]);

  useEffect(() => {
    const handleLocationChange = () => {
      const location = pageFromLocation();
      setPage(location.page);
      if (location.restaurantId) {
        setSelectedRestaurantId(location.restaurantId);
        setReservation((current) => ({ ...current, restaurantId: location.restaurantId }));
        setQueueRestaurantId(location.restaurantId);
      }
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  useEffect(() => {
    if (page !== 'staff' || user?.role !== 'restaurant_admin') return undefined;
    let active = true;
    api(`/staff/tables?date=${encodeURIComponent(staffSlot.date)}&time=${encodeURIComponent(staffSlot.time)}`)
      .then(({ tables }) => {
        if (active) setStaffWorkspace((current) => ({ ...current, tables }));
      })
      .catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, [page, user, staffSlot.date, staffSlot.time]);

  useEffect(() => {
    if (page !== 'reservations' || !user || !reservation.restaurantId || !reservation.date || !reservation.time) {
      setAvailability([]);
      return;
    }
    let active = true;
    api(`/reservations/availability?restaurantId=${encodeURIComponent(reservation.restaurantId)}&date=${encodeURIComponent(reservation.date)}&time=${encodeURIComponent(reservation.time)}&guests=${encodeURIComponent(reservation.guests)}`)
      .then(({ tables }) => { if (active) setAvailability(tables); })
      .catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, [page, user, reservation.restaurantId, reservation.date, reservation.time, reservation.guests]);

  const navigate = (next, restaurantId = selectedRestaurantId) => {
    clearMessages();
    setMobileOpen(false);
    if ((next === 'reservations' || next === 'queue') && !user) {
      setNotice('Please sign in to continue.');
      setPage('login');
      window.history.pushState({}, '', locationForPage('login'));
      return;
    }
    if ((next === 'reservations' || next === 'queue') && user?.role === 'restaurant_admin') {
      setNotice('Use your restaurant workspace to manage service.');
      setPage('staff');
      window.history.pushState({}, '', locationForPage('staff'));
      return;
    }
    if (next === 'staff' && (!user || user.role !== 'restaurant_admin')) {
      setPage('staff-login');
      window.history.pushState({}, '', locationForPage('staff-login'));
      return;
    }
    if (next === 'restaurant' && restaurantId) {
      setSelectedRestaurantId(restaurantId);
      setReservation((current) => ({ ...current, restaurantId }));
      setQueueRestaurantId(restaurantId);
    }
    setPage(next);
    window.history.pushState({}, '', locationForPage(next, restaurantId));
  };

  const openRestaurant = (restaurant) => navigate('restaurant', restaurant.id);
  const changeRestaurant = (restaurantId) => {
    setSelectedRestaurantId(restaurantId);
    setReservation((current) => ({ ...current, restaurantId }));
    setQueueRestaurantId(restaurantId);
  };

  const submitAuth = async (event) => {
    event.preventDefault();
    clearMessages();
    if (page === 'register' && authForm.password !== authForm.confirm) {
      setError('Your passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const path = page === 'register' ? '/auth/register' : '/auth/login';
      const body = page === 'register'
        ? { name: authForm.name, email: authForm.email, password: authForm.password }
        : { email: authForm.email, password: authForm.password };
      const { user: signedInUser } = await api(path, json('POST', body));
      setUser(signedInUser);
      await loadUserData();
      setPage('home');
      window.history.pushState({}, '', '/');
      setAuthForm({ name: '', email: '', password: '', confirm: '' });
      setNotice(page === 'register' ? 'Welcome to Maison. Your account is ready.' : 'Welcome back.');
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };

  const submitStaffLogin = async (event) => {
    event.preventDefault();
    clearMessages();
    setBusy(true);
    try {
      const { user: signedInUser } = await api('/auth/staff/login', json('POST', staffForm));
      setUser(signedInUser);
      setStaffForm({ email: '', password: '' });
      await loadStaffData(staffSlot);
      setPage('staff');
      window.history.pushState({}, '', '/staff');
      setNotice('You are signed in to your restaurant workspace.');
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };

  const signOut = async () => {
    clearMessages();
    setBusy(true);
    try {
      await api('/auth/logout', json('POST', {}));
      setUser(null);
      setReservations([]);
      setQueueEntries([]);
      setStaffWorkspace({ restaurant: null, reservations: [], entries: [], tables: [] });
      setPage('home');
      window.history.pushState({}, '', '/');
      setNotice('You have signed out.');
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };

  const submitReservation = async (event) => {
    event.preventDefault();
    clearMessages();
    if (!reservation.restaurantId || !reservation.time || availability.length === 0) {
      setError('Choose a restaurant and available table time before confirming.');
      return;
    }
    setBusy(true);
    try {
      const result = await api('/reservations', json('POST', {
        restaurantId: reservation.restaurantId,
        date: reservation.date,
        time: reservation.time,
        guests: Number(reservation.guests),
        note: reservation.note,
      }));
      await loadUserData();
      setNotice(`Reservation confirmed for ${result.reservation.date} at ${result.reservation.time}.`);
      setReservation((current) => ({ ...current, note: '' }));
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };

  const cancelReservation = async (id) => {
    if (!window.confirm('Cancel this reservation?')) return;
    clearMessages();
    try {
      await api(`/reservations/${id}/cancel`, json('PATCH', {}));
      await loadUserData();
      setNotice('Your reservation has been cancelled.');
    } catch (requestError) { setError(requestError.message); }
  };

  const joinQueue = async (event) => {
    event.preventDefault();
    clearMessages();
    setBusy(true);
    try {
      const result = await api('/queue', json('POST', {
        restaurantId: queueRestaurantId,
        guests: Number(queueGuests),
      }));
      await loadUserData();
      setNotice(`You’re in the queue. Your code is ${result.entry.code}.`);
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };

  const leaveQueue = async (id) => {
    if (!window.confirm('Leave the walk-in queue?')) return;
    clearMessages();
    try {
      await api(`/queue/${id}/leave`, json('PATCH', {}));
      await loadUserData();
      setNotice('You have left the queue.');
    } catch (requestError) { setError(requestError.message); }
  };

  const setQueueStatus = async (id, status) => {
    clearMessages();
    try {
      await api(`/staff/queue/${id}/status`, json('PATCH', { status }));
      await loadStaffData(staffSlot);
      setNotice(`Queue entry updated to ${status}.`);
    } catch (requestError) { setError(requestError.message); }
  };

  const cancelStaffReservation = async (id) => {
    if (!window.confirm('Cancel this reservation?')) return;
    clearMessages();
    try {
      await api(`/staff/reservations/${id}/status`, json('PATCH', { status: 'Cancelled' }));
      await loadStaffData(staffSlot);
      setNotice('Reservation cancelled.');
    } catch (requestError) { setError(requestError.message); }
  };

  const selectedRestaurant = restaurants.find(({ id }) => id === selectedRestaurantId);
  const reservationRestaurant = restaurants.find(({ id }) => id === reservation.restaurantId);
  const queueRestaurant = restaurants.find(({ id }) => id === queueRestaurantId);

  if (authLoading) return <main className="loading-screen"><span className="eyebrow">MAISON</span><p>Setting your place...</p></main>;

  return (
    <div className="site-shell">
      <header className="site-header">
        <button className="wordmark" onClick={() => navigate('home')} aria-label="Maison home">maison<span>.</span></button>
        <button className="mobile-toggle" onClick={() => setMobileOpen((open) => !open)} aria-label="Toggle navigation">{mobileOpen ? '×' : '☰'}</button>
        <nav className={mobileOpen ? 'navigation open' : 'navigation'} aria-label="Main navigation">
          <button onClick={() => navigate('home')}>The experience</button>
          <button onClick={() => navigate('directory')}>Restaurants</button>
          {user?.role !== 'restaurant_admin' && <><button onClick={() => navigate('reservations')}>Reservations</button><button onClick={() => navigate('queue')}>Walk-ins</button></>}
          {user?.role === 'restaurant_admin' ? <><span className="nav-greeting">Hello, {user.name.split(' ')[0]}</span><button onClick={() => navigate('staff')}>Staff workspace</button><button className="nav-account" onClick={signOut} disabled={busy}>Sign out</button></> :
            user ? <><span className="nav-greeting">Hello, {user.name.split(' ')[0]}</span><button className="nav-account" onClick={signOut} disabled={busy}>Sign out</button></> :
              <><button className="nav-account" onClick={() => navigate('login')}>Sign in</button><button className="nav-cta" onClick={() => navigate('register')}>Join us <span>↗</span></button><button className="nav-account" onClick={() => navigate('staff-login')}>Restaurant staff</button></>}
        </nav>
      </header>

      {notice && <div className="message success" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}
      {error && <div className="message error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss">×</button></div>}

      {page === 'home' && <main>
        <section className="hero">
          <div className="hero-image" />
          <div className="hero-content">
            <p className="eyebrow"><span className="eyebrow-line" /> AN EVENING, WELL SPENT</p>
            <h1>A table,<br />thoughtfully <em>yours.</em></h1>
            <p className="hero-copy">A little room to slow down. Seasonal cooking, warm light, and a place waiting just for you.</p>
            <div className="hero-actions"><button className="button button-gold" onClick={() => navigate('reservations')}>Reserve a table <span>↗</span></button><button className="text-link" onClick={() => navigate('queue')}>Joining us on the evening? <span>→</span></button></div>
            <div className="hero-meta"><span>19.0760° N&nbsp; 72.8777° E</span><span>MUMBAI · INDIA</span></div>
          </div>
          <div className="hero-caption">THE DINING ROOM <span>01 / 03</span></div>
        </section>
        <section className="intro-section">
          <div className="intro-number">01 <span>—</span> OUR TABLE</div>
          <div className="intro-content"><p className="eyebrow">A SENSE OF PLACE</p><h2>Good food.<br />Even better <em>company.</em></h2></div>
          <div className="intro-detail"><p>At Maison, dinner is never just dinner. It’s the first pour, the familiar welcome, the extra moment you didn’t know you needed.</p><button className="text-link" onClick={() => navigate('reservations')}>Find your seat <span>→</span></button></div>
        </section>
        <section className="directory-section">
          <div className="directory-heading"><div><p className="eyebrow">A TABLE FOR EVERY MOOD</p><h2>Explore <em>restaurants.</em></h2></div><button className="text-link" onClick={() => navigate('directory')}>See all restaurants <span>→</span></button></div>
          {restaurantsLoading ? <p className="directory-state">Gathering the neighbourhood…</p> : restaurants.length === 0 ? <p className="directory-state">No restaurants are available just now. Please try again shortly.</p> :
            <div className="restaurant-grid home-restaurant-grid">{restaurants.slice(0, 3).map((restaurant) => <RestaurantCard key={restaurant.id} restaurant={restaurant} onOpen={openRestaurant} />)}</div>}
        </section>
        <section className="booking-band">
          <div><p className="eyebrow">WE’VE SAVED YOU A PLACE</p><h2>Make an evening<br /><em>of it.</em></h2></div>
          <p>Join us for an occasion, or simply because it’s Tuesday. We’ll take care of the rest.</p>
          <button className="button button-outline" onClick={() => navigate('reservations')}>Find a table <span>↗</span></button>
        </section>
      </main>}

      {page === 'directory' && <main className="workspace-page directory-page">
        <div className="page-heading"><p className="eyebrow">FIND YOUR NEXT FAVOURITE</p><h1>Explore <em>restaurants.</em></h1><p>Independent tables and neighbourhood favourites, all in one place.</p></div>
        {restaurantsLoading ? <p className="directory-state">Gathering the neighbourhood…</p> : restaurants.length === 0 ?
          <section className="panel empty-state directory-empty"><span className="empty-mark">✳</span><p>No restaurants are available just now.<br />Please try again shortly.</p></section> :
          <div className="restaurant-grid">{restaurants.map((restaurant) => <RestaurantCard key={restaurant.id} restaurant={restaurant} onOpen={openRestaurant} />)}</div>}
      </main>}

      {page === 'restaurant' && <main className="workspace-page restaurant-detail-page">
        {!selectedRestaurant ? <section className="panel empty-state directory-empty"><span className="empty-mark">✳</span><p>{restaurantsLoading ? 'Loading restaurant details…' : 'This restaurant could not be found.'}</p><button className="button button-outline" onClick={() => navigate('directory')}>Browse restaurants</button></section> :
          <><button className="text-link back-link" onClick={() => navigate('directory')}>← All restaurants</button><section className="restaurant-detail panel">
            <img src={selectedRestaurant.coverImage} alt="" className="restaurant-detail-image" />
            <div className="restaurant-detail-copy"><p className="eyebrow">{selectedRestaurant.cuisine} · {selectedRestaurant.area}</p>{selectedRestaurant.isDemo && <span className="demo-badge detail-demo-badge">FICTIONAL DEMO RESTAURANT</span>}<h1>{selectedRestaurant.name}</h1><p>{selectedRestaurant.description}</p><address>{selectedRestaurant.address}</address><div className="restaurant-detail-actions"><button className="button button-gold" onClick={() => navigate('reservations', selectedRestaurant.id)}>Reserve a table <span>↗</span></button><button className="button button-outline" onClick={() => navigate('queue', selectedRestaurant.id)}>Join walk-in queue <span>↗</span></button></div></div>
          </section></>}
      </main>}

      {(page === 'login' || page === 'register') && <main className="form-page"><div className="form-aside"><p className="eyebrow">A PLACE AT OUR TABLE</p><h1>{page === 'register' ? <>Make yourself<br /><em>at home.</em></> : <>A familiar<br /><em>welcome.</em></>}</h1><p>Good evenings begin with a simple hello.</p></div><form className="panel form-panel" onSubmit={submitAuth} noValidate><p className="eyebrow">{page === 'register' ? 'BECOME A REGULAR' : 'WELCOME BACK'}</p><h2>{page === 'register' ? 'Create an account' : 'Sign in'}</h2>
        {page === 'register' && <label>Your name<input autoComplete="name" required minLength="2" value={authForm.name} onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })} placeholder="First and last name" /></label>}
        <label>Email address<input type="email" autoComplete="email" required value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} placeholder="you@example.com" /></label>
        <label>Password<input type="password" autoComplete={page === 'register' ? 'new-password' : 'current-password'} required minLength="8" value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} placeholder="At least 8 characters" /></label>
        {page === 'register' && <label>Confirm password<input type="password" autoComplete="new-password" required value={authForm.confirm} onChange={(event) => setAuthForm({ ...authForm, confirm: event.target.value })} placeholder="Enter your password again" /></label>}
        <button className="button button-gold form-submit" disabled={busy}>{busy ? 'One moment…' : page === 'register' ? 'Create account' : 'Sign in'} <span>↗</span></button>
        <p className="form-switch">{page === 'register' ? 'Already joined us?' : 'New to Maison?'} <button type="button" onClick={() => navigate(page === 'register' ? 'login' : 'register')}>{page === 'register' ? 'Sign in' : 'Create an account'}</button></p>
      </form></main>}

      {page === 'staff-login' && <main className="form-page staff-login-page"><div className="form-aside"><p className="eyebrow">RESTAURANT PARTNERS</p><h1>Your room,<br /><em>your service.</em></h1><p>Sign in to manage reservations, tables, and the walk-in list for your restaurant.</p></div><form className="panel form-panel" onSubmit={submitStaffLogin} noValidate><p className="eyebrow">STAFF ACCESS</p><h2>Restaurant sign in</h2><label>Email address<input type="email" autoComplete="username" required value={staffForm.email} onChange={(event) => setStaffForm({ ...staffForm, email: event.target.value })} placeholder="staff@restaurant.com" /></label><label>Password<input type="password" autoComplete="current-password" required value={staffForm.password} onChange={(event) => setStaffForm({ ...staffForm, password: event.target.value })} placeholder="Your staff password" /></label><button className="button button-gold form-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in to workspace'} <span>↗</span></button><p className="form-switch">Restaurant staff only. Customer accounts cannot access this workspace.</p></form></main>}

      {page === 'staff' && <main className="workspace-page staff-page">
        <div className="page-heading"><p className="eyebrow">RESTAURANT WORKSPACE</p><h1>{staffWorkspace.restaurant?.name || 'Your restaurant'}</h1><p>{staffWorkspace.restaurant?.address || 'Your service overview'}</p></div>
        {staffLoading ? <p className="directory-state">Loading your restaurant workspace…</p> :
          <><section className="staff-tables panel"><div className="list-title"><div><p className="eyebrow">YOUR FLOOR</p><h2>Tables & capacity</h2></div><span>{staffWorkspace.tables.length.toString().padStart(2, '0')}</span></div><div className="staff-slot-controls"><label>Check date<input type="date" min={today()} value={staffSlot.date} onChange={(event) => setStaffSlot({ ...staffSlot, date: event.target.value })} /></label><label>Arrival time<select value={staffSlot.time} onChange={(event) => setStaffSlot({ ...staffSlot, time: event.target.value })}>{['17:00','18:30','20:00'].map((time) => <option key={time} value={time}>{time}</option>)}</select></label></div>{staffWorkspace.tables.length === 0 ? <p className="staff-empty">No tables have been set up for this restaurant.</p> : <div className="staff-table-list">{staffWorkspace.tables.map((table) => <div className="staff-table" key={table._id}><strong>Table {table.number}</strong><span>{table.capacity} seats</span><span className={!table.active ? 'status cancelled' : table.available ? 'status' : 'status booked'}>{!table.active ? 'Inactive' : table.available ? 'Available' : 'Booked'}</span></div>)}</div>}</section>
          <div className="staff-workspace-grid">
            <section className="panel list-panel"><div className="list-title"><div><p className="eyebrow">SERVICE BOOKINGS</p><h2>Reservations</h2></div><span>{staffWorkspace.reservations.length.toString().padStart(2, '0')}</span></div>{staffWorkspace.reservations.length === 0 ? <p className="staff-empty">No reservations for this restaurant yet.</p> : <div className="staff-record-list">{staffWorkspace.reservations.map((item) => <article className="staff-record" key={item._id}><div className="record-main"><strong>{item.date} · {item.time} · Table {item.tableNumber}</strong><span>{item.guests} {item.guests === 1 ? 'guest' : 'guests'} · <span className={`status ${item.status.toLowerCase()}`}>{item.status}</span></span><span>{item.customer?.name || 'Customer'}{item.customer?.email ? ` · ${item.customer.email}` : ''}</span>{item.note && <span className="record-note">{item.note}</span>}</div>{item.status === 'Confirmed' && <button className="quiet-action" onClick={() => cancelStaffReservation(item._id)}>Cancel</button>}</article>)}</div>}</section>
            <section className="panel list-panel"><div className="list-title"><div><p className="eyebrow">LIVE WALK-INS</p><h2>Queue</h2></div><span>{staffWorkspace.entries.length.toString().padStart(2, '0')}</span></div>{staffWorkspace.entries.length === 0 ? <p className="staff-empty">No guests are waiting right now.</p> : <div className="staff-record-list">{staffWorkspace.entries.map((entry) => <article className="staff-record" key={entry._id}><div className="queue-code"><span>POSITION {entry.position}</span><strong>{entry.code}</strong></div><div className="record-main"><strong>{entry.guests} {entry.guests === 1 ? 'guest' : 'guests'} · {entry.status}</strong><span>{entry.customer?.name || 'Customer'}{entry.customer?.email ? ` · ${entry.customer.email}` : ''}</span><span>{new Date(entry.joinedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span></div><div className="staff-actions">{entry.status === 'Waiting' && <><button className="quiet-action" onClick={() => setQueueStatus(entry._id, 'Called')}>Call</button><button className="quiet-action" onClick={() => setQueueStatus(entry._id, 'Left')}>Remove</button></>}{entry.status === 'Called' && <><button className="quiet-action" onClick={() => setQueueStatus(entry._id, 'Seated')}>Seat</button><button className="quiet-action" onClick={() => setQueueStatus(entry._id, 'Left')}>Remove</button></>}</div></article>)}</div>}</section>
          </div></>}
      </main>}

      {page === 'reservations' && <main className="workspace-page"><div className="page-heading"><p className="eyebrow">THE EVENING IS YOURS</p><h1>Find your <em>table.</em></h1><p>Choose an evening and we’ll find a seat that feels just right.</p></div><div className="workspace-grid">
        <form className="panel booking-form" onSubmit={submitReservation}><p className="eyebrow">MAKE A RESERVATION</p>{reservationRestaurant && <p className="booking-context">{reservationRestaurant.name} · {reservationRestaurant.area}</p>}<label>Restaurant<select required value={reservation.restaurantId} onChange={(event) => changeRestaurant(event.target.value)}><option value="">Choose a restaurant</option>{restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}</select>{reservationRestaurant && <span className="restaurant-address">{reservationRestaurant.address}</span>}</label><label>Date<input type="date" min={today()} required value={reservation.date} onChange={(event) => setReservation({ ...reservation, date: event.target.value })} /></label><label>Arrival time<select required value={reservation.time} onChange={(event) => setReservation({ ...reservation, time: event.target.value })}><option value="">Choose a time</option>{['17:00','18:30','20:00'].map((time) => <option key={time} value={time}>{time}</option>)}</select></label><label>Guests<select value={reservation.guests} onChange={(event) => setReservation({ ...reservation, guests: event.target.value })}>{[1,2,3,4,5,6,7,8].map((count) => <option key={count} value={count}>{count} {count === 1 ? 'guest' : 'guests'}</option>)}</select></label><label>A note for us <span className="optional">(optional)</span><textarea maxLength="500" rows="3" value={reservation.note} onChange={(event) => setReservation({ ...reservation, note: event.target.value })} placeholder="A little something we should know…" /></label>
          {reservation.time && <div className="availability-box" aria-live="polite">{availability.length ? <><span className="availability-dot" /> {availability.length} {availability.length === 1 ? 'table' : 'tables'} available for this time</> : 'No tables available at this time. Try another.'}</div>}
          <button className="button button-gold form-submit" disabled={busy || !availability.length}>{busy ? 'Confirming…' : 'Confirm reservation'} <span>↗</span></button><p className="fine-print">Your table is confirmed once your reservation is saved.</p>
        </form>
        <section className="panel list-panel"><div className="list-title"><div><p className="eyebrow">YOUR PLANS</p><h2>Reservations</h2></div><span>{reservations.length.toString().padStart(2,'0')}</span></div>
          {reservations.length === 0 ? <div className="empty-state"><span className="empty-mark">✳</span><p>Nothing on the calendar.<br />Your next evening starts here.</p></div> : <div className="record-list">{reservations.map((item) => <article className="record" key={item._id}><div className="record-date"><strong>{new Date(`${item.date}T12:00:00`).toLocaleDateString('en',{day:'2-digit'})}</strong><span>{new Date(`${item.date}T12:00:00`).toLocaleDateString('en',{month:'short',year:'numeric'})}</span></div><div className="record-main">{item.restaurantName && <strong>{item.restaurantName}</strong>}<strong>{item.time} · {item.guests} {item.guests === 1 ? 'guest' : 'guests'}</strong><span>Table {item.tableNumber} · <span className={`status ${item.status.toLowerCase()}`}>{item.status}</span></span>{item.restaurantAddress && <span className="record-address">{item.restaurantAddress}</span>}{item.note && <span className="record-note">{item.note}</span>}</div>{item.status === 'Confirmed' && <button className="quiet-action" onClick={() => cancelReservation(item._id)}>Cancel</button>}</article>)}</div>}
        </section>
      </div><p className="fine-print page-footnote">Reservations are seated in 90-minute dining periods. Times shown in the restaurant’s local time.</p></main>}

      {page === 'queue' && <main className="workspace-page queue-page"><div className="page-heading"><p className="eyebrow">COME AS YOU ARE</p><h1>Good things<br />are worth the <em>wait.</em></h1><p>Drop in for dinner. We’ll save your place in line.</p></div><div className="workspace-grid queue-grid">
        <form className="panel booking-form" onSubmit={joinQueue}><p className="eyebrow">JOIN THE WALK-IN LIST</p>{queueRestaurant && <p className="booking-context">{queueRestaurant.name} · {queueRestaurant.area}</p>}<label>Restaurant<select required value={queueRestaurantId} onChange={(event) => changeRestaurant(event.target.value)}><option value="">Choose a restaurant</option>{restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}</select>{queueRestaurant && <span className="restaurant-address">{queueRestaurant.address}</span>}</label><label>Party size<select value={queueGuests} onChange={(event) => setQueueGuests(event.target.value)}>{[1,2,3,4,5,6,7,8].map((count) => <option key={count} value={count}>{count} {count === 1 ? 'guest' : 'guests'}</option>)}</select></label><button className="button button-gold form-submit" disabled={busy || !queueRestaurantId || queueEntries.some(({entry}) => entry.active)}>{busy ? 'Finding your place…' : 'Join the queue'} <span>↗</span></button><p className="fine-print">Wait estimates are approximate and update as the queue moves.</p><div className="queue-note"><span>✳</span><p>We’ll keep your place right here. Your position and estimated wait are calculated from the live queue.</p></div></form>
        <section className="panel list-panel"><div className="list-title"><div><p className="eyebrow">YOUR PLACE IN LINE</p><h2>Walk-ins</h2></div><span>{queueEntries.length.toString().padStart(2,'0')}</span></div>
          {queueEntries.length === 0 ? <div className="empty-state"><span className="empty-mark">✳</span><p>The evening is open.<br />Join us when you’re ready.</p></div> : <div className="record-list">{queueEntries.map(({entry, position, estimatedWaitMinutes}) => <article className="record queue-record" key={entry._id}><div className="queue-code"><span>YOUR CODE</span><strong>{entry.code}</strong></div><div className="record-main">{entry.restaurantName && <strong>{entry.restaurantName}</strong>}<strong>{entry.guests} {entry.guests === 1 ? 'guest' : 'guests'} · {entry.status}</strong><span>{entry.status === 'Waiting' ? position === null ? 'Position unavailable' : `Position ${position} · about ${estimatedWaitMinutes} min` : 'No longer waiting'}</span>{entry.restaurantAddress && <span className="record-address">{entry.restaurantAddress}</span>}<span className="record-note">{new Date(entry.joinedAt).toLocaleString([], {dateStyle:'medium',timeStyle:'short'})}</span></div>{entry.status === 'Waiting' && <button className="quiet-action" onClick={() => leaveQueue(entry._id)}>Leave</button>}</article>)}</div>}
        </section>
      </div><p className="fine-print page-footnote">Each restaurant manages its own walk-in queue. Wait estimates are approximate and not a guarantee.</p></main>}

      <footer className="site-footer"><span className="wordmark footer-mark">maison<span>.</span></span><span>GOOD FOOD, GOOD COMPANY.</span><span>AN EVENING, WELL SPENT.</span></footer>
    </div>
  );
}

export default App;
