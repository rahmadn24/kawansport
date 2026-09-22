import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { UpdateProfileInput } from './src/api/profile';
import {
  BookingItem,
  bookEventCourt,
  cancelBooking,
  createBooking,
  eventDayKey,
  listMyBookings,
  next14Days,
  toDateKey,
  validateBookingInput,
} from './src/api/bookings';
import {
  ShopCart,
  ShopOrder,
  checkoutCart,
  clearCart,
  getCart,
  listMyOrders,
  setCartItem,
  validateCartQty,
} from './src/api/shop';
import {
  AvailabilityResult,
  CourtItem,
  VenueItem,
  activeCourts,
  getCourtAvailability,
  getVenueDetail,
  listVenues,
} from './src/api/venues';
import {
  CreateEventInput,
  EventDetail,
  EventParticipantItem,
  SportEventItem,
  createEvent,
  getEventDetail,
  joinEvent,
  leaveEvent,
  listEvents,
  listParticipants,
} from './src/api/events';
import {
  PartnerItem,
  SearchPartnersFilter,
  searchPartners,
  validateSearchPartners,
} from './src/api/partners';
import type { ChatMessage, ConversationItem } from './src/api/chat';
import type { DeepLink } from './src/config/notifications';
import {
  getMessages,
  getOrCreateConversation,
  listConversations,
  markConversationRead,
  validateMessageBody,
} from './src/api/chat';
import { useChatSocket } from './src/chat/socket';
import { getCurrentPosition } from './src/location/geolocation';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { EditProfileScreen } from './src/screens/EditProfileScreen';
import { SearchPartnerScreen } from './src/screens/SearchPartnerScreen';
import { ChatListScreen } from './src/screens/ChatListScreen';
import { ChatRoomScreen } from './src/screens/ChatRoomScreen';
import { CreateEventScreen } from './src/screens/CreateEventScreen';
import { EventDetailScreen } from './src/screens/EventDetailScreen';
import { EventListScreen } from './src/screens/EventListScreen';
import { VenueListScreen } from './src/screens/VenueListScreen';
import { VenueDetailScreen } from './src/screens/VenueDetailScreen';
import { CheckoutScreen } from './src/screens/CheckoutScreen';
import { MyBookingsScreen } from './src/screens/MyBookingsScreen';
import { CartScreen } from './src/screens/CartScreen';
import { MpCheckoutScreen } from './src/screens/MpCheckoutScreen';
import { MyOrdersScreen } from './src/screens/MyOrdersScreen';

function Profile() {
  const { user, logout, loading, error, refreshProfile, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  if (editing && user) {
    const save = (input: UpdateProfileInput) => {
      updateProfile(input)
        .then(() => setEditing(false))
        .catch(() => undefined);
    };
    // GPS hanya mengisi field lat/lng di form; user menekan Simpan untuk PATCH /me.
    const useGps = async () => {
      setGpsLoading(true);
      setGpsError(null);
      try {
        const pos = await getCurrentPosition();
        return { latitude: pos.latitude, longitude: pos.longitude };
      } catch (e) {
        setGpsError(e instanceof Error ? e.message : 'Gagal mendapatkan lokasi GPS');
        throw e;
      } finally {
        setGpsLoading(false);
      }
    };
    return (
      <EditProfileScreen
        initial={user}
        saving={loading}
        serverError={error}
        gpsLoading={gpsLoading}
        gpsError={gpsError}
        onSave={save}
        onUseGps={useGps}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <View style={styles.box}>
      <Text style={styles.title}>KawanSport</Text>
      <Text style={styles.subtitle}>{user?.email}</Text>
      {user?.displayName ? <Text style={styles.subtitle}>{user.displayName}</Text> : null}
      {user && user.sports.length > 0 ? (
        <Text style={styles.subtitle}>Olahraga: {user.sports.join(', ')}</Text>
      ) : null}
      {user?.skillLevel ? <Text style={styles.subtitle}>Skill: {user.skillLevel}</Text> : null}
      {user?.lat != null && user?.lng != null ? (
        <Text style={styles.subtitle}>
          Lokasi: {user.lat}, {user.lng}
        </Text>
      ) : null}
      <View style={styles.gap} />
      {loading ? (
        <ActivityIndicator />
      ) : (
        <>
          <Button title="Refresh Profile (/me)" onPress={refreshProfile} />
          <View style={styles.gap} />
          <Button title="Edit Profil" onPress={() => setEditing(true)} />
          <View style={styles.gap} />
          <Button title="Logout" onPress={logout} />
        </>
      )}
    </View>
  );
}

type EventsRoute =
  | { name: 'list' }
  | { name: 'create' }
  | { name: 'detail'; id: string };

function toErrorMessage(e: unknown): string {
  const data = (e as { response?: { data?: { message?: unknown } } })?.response?.data;
  if (data && typeof data.message === 'string') return data.message;
  if (data && Array.isArray(data.message)) return data.message.join(', ');
  const msg = (e as { message?: unknown })?.message;
  return typeof msg === 'string' ? msg : 'Request failed';
}

/** Alur Event SM-04 + SM-05: list + filter sport, create, detail, join/leave. */
function EventsFlow({
  onBookCourt,
  deepEventId,
  onConsumedDeepEvent,
}: {
  onBookCourt: (event: EventDetail) => void;
  /** PH3-06: deep-link notifikasi event → buka detail sekali lalu konsumsi. */
  deepEventId?: string | null;
  onConsumedDeepEvent?: () => void;
}) {
  const [route, setRoute] = useState<EventsRoute>({ name: 'list' });
  const [events, setEvents] = useState<SportEventItem[]>([]);
  const [sportFilter, setSportFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<EventParticipantItem[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const loadList = useCallback(async (sport: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const res = await listEvents(sport ? { sport } : {});
      setEvents(res.data);
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList(sportFilter).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // PH3-06: deep-link tap notifikasi event → buka detail eventId.
  useEffect(() => {
    if (!deepEventId) return;
    openDetail(deepEventId);
    onConsumedDeepEvent?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepEventId]);

  const changeFilter = (sport: string | null) => {
    setSportFilter(sport);
    loadList(sport).catch(() => undefined);
  };

  const loadParticipants = (id: string) => {
    setParticipantsLoading(true);
    listParticipants(id)
      .then((res) => setParticipants(res.data))
      .catch(() => undefined)
      .finally(() => setParticipantsLoading(false));
  };

  const openDetail = (id: string) => {
    setRoute({ name: 'detail', id });
    setDetail(null);
    setDetailError(null);
    setJoinError(null);
    setParticipants([]);
    setDetailLoading(true);
    getEventDetail(id)
      .then(setDetail)
      .catch((e) => setDetailError(toErrorMessage(e)))
      .finally(() => setDetailLoading(false));
    loadParticipants(id);
  };

  const refreshDetail = () => {
    if (route.name !== 'detail') return;
    setDetailLoading(true);
    setDetailError(null);
    setJoinError(null);
    getEventDetail(route.id)
      .then(setDetail)
      .catch((e) => setDetailError(toErrorMessage(e)))
      .finally(() => setDetailLoading(false));
    loadParticipants(route.id);
  };

  /** SM-05: join/leave lalu sinkronkan detail + daftar peserta. */
  const mutateJoin = (fn: (id: string) => Promise<EventDetail>) => {
    if (route.name !== 'detail') return;
    const id = route.id;
    setMutating(true);
    setJoinError(null);
    fn(id)
      .then((updated) => {
        setDetail(updated);
        loadParticipants(id);
      })
      .catch((e) => setJoinError(toErrorMessage(e)))
      .finally(() => setMutating(false));
  };

  const handleJoin = () => mutateJoin(joinEvent);
  const handleLeave = () => mutateJoin(leaveEvent);

  const submitCreate = (input: CreateEventInput) => {
    setSaving(true);
    setCreateError(null);
    createEvent(input)
      .then((created) => {
        setEvents((prev) => [created, ...prev]);
        setRoute({ name: 'list' });
        loadList(sportFilter).catch(() => undefined);
      })
      .catch((e) => setCreateError(toErrorMessage(e)))
      .finally(() => setSaving(false));
  };

  if (route.name === 'create') {
    return (
      <CreateEventScreen
        saving={saving}
        serverError={createError}
        onSubmit={submitCreate}
        onCancel={() => setRoute({ name: 'list' })}
      />
    );
  }
  if (route.name === 'detail') {
    return (
      <EventDetailScreen
        event={detail}
        loading={detailLoading}
        error={detailError}
        participants={participants}
        participantsLoading={participantsLoading}
        mutating={mutating}
        joinError={joinError}
        onBack={() => setRoute({ name: 'list' })}
        onRefresh={refreshDetail}
        onJoin={handleJoin}
        onLeave={handleLeave}
        onBookCourt={() => {
          if (detail) onBookCourt(detail);
        }}
      />
    );
  }
  return (
    <EventListScreen
      events={events}
      loading={loading}
      error={error}
      sportFilter={sportFilter}
      onFilterChange={changeFilter}
      onRefresh={() => loadList(sportFilter).catch(() => undefined)}
      onSelect={openDetail}
      onCreate={() => setRoute({ name: 'create' })}
    />
  );
}

/** Konteks booking dari event (BK-04): tombol Book Court di EventDetail. */
export interface EventBookingCtx {
  eventId: string;
  title: string;
  /** Hari-UTC datetime event (selaras aturan same-day server). */
  date: string;
}

type BookingRoute =
  | { name: 'venues' }
  | { name: 'venue'; id: string }
  | { name: 'checkout'; booking: BookingItem; courtLabel: string | null }
  | { name: 'mine' };

/** Alur Booking BK-04: venue list -> detail (court + tanggal + slot) -> checkout -> my bookings. */
function BookingFlow({
  eventCtx,
  deepVenueId,
  onConsumedDeepVenue,
  mineSignal,
}: {
  eventCtx: EventBookingCtx | null;
  /** PH3-06: deep-link notifikasi venue → buka venue detail sekali lalu konsumsi. */
  deepVenueId?: string | null;
  onConsumedDeepVenue?: () => void;
  /** PH3-06: deep-link notifikasi booking → buka tab mine (increment = trigger). */
  mineSignal?: number;
}) {
  const [route, setRoute] = useState<BookingRoute>({ name: 'venues' });
  const [venues, setVenues] = useState<VenueItem[]>([]);
  const [sportFilter, setSportFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [venue, setVenue] = useState<VenueItem | null>(null);
  const [venueLoading, setVenueLoading] = useState(false);
  const [venueError, setVenueError] = useState<string | null>(null);
  const [court, setCourt] = useState<CourtItem | null>(null);
  const [date, setDate] = useState<string>(() => eventCtx?.date ?? toDateKey(new Date()));
  const [slots, setSlots] = useState<AvailabilityResult['slots']>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [bookingStart, setBookingStart] = useState<string | null>(null);
  const [bookError, setBookError] = useState<string | null>(null);

  const [mine, setMine] = useState<BookingItem[]>([]);
  const [mineLoading, setMineLoading] = useState(false);
  const [mineError, setMineError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Tanggal event selalu tersedia di picker walau di luar strip 14 hari.
  const dateOptions = (() => {
    const base = next14Days();
    if (eventCtx && !base.includes(eventCtx.date)) return [eventCtx.date, ...base];
    return base;
  })();

  const loadVenues = useCallback(async (sport: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const res = await listVenues(sport ? { sport } : {});
      setVenues(res.data);
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVenues(sportFilter).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // PH3-06: deep-link tap notifikasi venue → buka venue detail.
  useEffect(() => {
    if (!deepVenueId) return;
    openVenue(deepVenueId);
    onConsumedDeepVenue?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepVenueId]);

  // PH3-06: deep-link tap notifikasi booking → route 'mine'.
  useEffect(() => {
    if (!mineSignal) return;
    setRoute({ name: 'mine' });
    loadMine().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mineSignal]);

  // Konteks event baru (tap Book Court di event lain) -> reset ke daftar venue.
  useEffect(() => {
    if (eventCtx) {
      setDate(eventCtx.date);
      setRoute({ name: 'venues' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventCtx?.eventId]);

  const loadSlots = useCallback(async (c: CourtItem, d: string) => {
    setSlotsLoading(true);
    setSlotsError(null);
    try {
      const res = await getCourtAvailability(c.id, d);
      setSlots(res.slots);
    } catch (e) {
      setSlots([]);
      setSlotsError(toErrorMessage(e));
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  const openVenue = (id: string) => {
    setRoute({ name: 'venue', id });
    setVenue(null);
    setVenueError(null);
    setBookError(null);
    setSlots([]);
    setVenueLoading(true);
    getVenueDetail(id)
      .then((v) => {
        setVenue(v);
        const first = activeCourts(v)[0] ?? null;
        setCourt(first);
        if (first) loadSlots(first, date).catch(() => undefined);
      })
      .catch((e) => setVenueError(toErrorMessage(e)))
      .finally(() => setVenueLoading(false));
  };

  const changeCourt = (c: CourtItem) => {
    setCourt(c);
    setBookError(null);
    loadSlots(c, date).catch(() => undefined);
  };

  const changeDate = (d: string) => {
    setDate(d);
    setBookError(null);
    if (court) loadSlots(court, d).catch(() => undefined);
  };

  const handleBook = (slot: AvailabilityResult['slots'][number]) => {
    if (!court) return;
    const input = { courtId: court.id, date, start: slot.start };
    const invalid = validateBookingInput(input);
    if (invalid) {
      setBookError(invalid);
      return;
    }
    setBookingStart(slot.start);
    setBookError(null);
    const req = eventCtx
      ? bookEventCourt(eventCtx.eventId, input)
      : createBooking(input);
    req
      .then((booking) => {
        setRoute({
          name: 'checkout',
          booking,
          courtLabel: venue ? `${venue.name} • ${court.name}` : court.name,
        });
      })
      .catch((e) => setBookError(toErrorMessage(e)))
      .finally(() => setBookingStart(null));
  };

  const loadMine = useCallback(async () => {
    setMineLoading(true);
    setMineError(null);
    setCancelError(null);
    try {
      setMine(await listMyBookings());
    } catch (e) {
      setMineError(toErrorMessage(e));
    } finally {
      setMineLoading(false);
    }
  }, []);

  const handleCancel = (b: BookingItem) => {
    setCancellingId(b.id);
    setCancelError(null);
    cancelBooking(b.id)
      .then(() => loadMine().catch(() => undefined))
      .catch((e) => setCancelError(toErrorMessage(e)))
      .finally(() => setCancellingId(null));
  };

  if (route.name === 'checkout') {
    return (
      <CheckoutScreen
        booking={route.booking}
        courtLabel={route.courtLabel}
        onDone={() => setRoute({ name: 'venues' })}
        onMyBookings={() => {
          setRoute({ name: 'mine' });
          loadMine().catch(() => undefined);
        }}
      />
    );
  }
  if (route.name === 'mine') {
    return (
      <MyBookingsScreen
        bookings={mine}
        loading={mineLoading}
        error={mineError}
        cancellingId={cancellingId}
        cancelError={cancelError}
        onRefresh={() => loadMine().catch(() => undefined)}
        onCancel={handleCancel}
      />
    );
  }
  if (route.name === 'venue') {
    return (
      <VenueDetailScreen
        venue={venue}
        loading={venueLoading}
        error={venueError}
        court={court}
        onCourtChange={changeCourt}
        date={date}
        onDateChange={changeDate}
        dateOptions={dateOptions}
        slots={slots}
        slotsLoading={slotsLoading}
        slotsError={slotsError}
        bookingStart={bookingStart}
        bookError={bookError}
        onBook={handleBook}
        onBack={() => setRoute({ name: 'venues' })}
      />
    );
  }
  return (
    <VenueListScreen
      venues={venues}
      loading={loading}
      error={error}
      sportFilter={sportFilter}
      onFilterChange={(sport) => {
        setSportFilter(sport);
        loadVenues(sport).catch(() => undefined);
      }}
      onRefresh={() => loadVenues(sportFilter).catch(() => undefined)}
      onSelect={openVenue}
      eventLabel={eventCtx ? `${eventCtx.title} (${eventCtx.date})` : null}
    />
  );
}

type ShopRoute =
  | { name: 'cart' }
  | { name: 'checkout'; order: ShopOrder }
  | { name: 'orders' };

/** Alur Shop MP-02: cart -> checkout (1 order + N grup) -> orders. */
function ShopFlow() {
  const [route, setRoute] = useState<ShopRoute>({ name: 'cart' });
  const [cart, setCart] = useState<ShopCart | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const [mutateError, setMutateError] = useState<string | null>(null);

  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadCart = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCart(await getCart());
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCart().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mutateCart = (fn: () => Promise<ShopCart>) => {
    setMutating(true);
    setMutateError(null);
    fn()
      .then(setCart)
      .catch((e) => setMutateError(toErrorMessage(e)))
      .finally(() => setMutating(false));
  };

  const handleSetQty = (productId: string, qty: number) => {
    const invalid = validateCartQty(qty);
    if (invalid) {
      setMutateError(invalid);
      return;
    }
    mutateCart(() => setCartItem(productId, qty));
  };

  const handleCheckout = () => {
    setMutating(true);
    setMutateError(null);
    checkoutCart()
      .then((order) => setRoute({ name: 'checkout', order }))
      .catch((e) => setMutateError(toErrorMessage(e)))
      .finally(() => setMutating(false));
  };

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      setOrders(await listMyOrders());
    } catch (e) {
      setOrdersError(toErrorMessage(e));
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  if (route.name === 'checkout') {
    return (
      <MpCheckoutScreen
        order={route.order}
        onDone={() => {
          setRoute({ name: 'cart' });
          loadCart().catch(() => undefined);
        }}
        onMyOrders={() => {
          setRoute({ name: 'orders' });
          loadOrders().catch(() => undefined);
        }}
      />
    );
  }
  if (route.name === 'orders') {
    return (
      <MyOrdersScreen
        orders={orders}
        loading={ordersLoading}
        error={ordersError}
        expandedId={expandedId}
        onToggle={(id) => setExpandedId((prev) => (prev === id ? null : id))}
        onRefresh={() => loadOrders().catch(() => undefined)}
      />
    );
  }
  return (
    <CartScreen
      cart={cart}
      loading={loading}
      error={error}
      mutating={mutating}
      mutateError={mutateError}
      onRefresh={() => loadCart().catch(() => undefined)}
      onSetQty={handleSetQty}
      onClear={() => mutateCart(clearCart)}
      onCheckout={handleCheckout}
    />
  );
}

function LoggedIn() {
  const [tab, setTab] = useState<'events' | 'booking' | 'shop' | 'partners' | 'chat' | 'profile'>(
    'events',
  );
  const [chatPartnerId, setChatPartnerId] = useState<string | null>(null);
  const [eventCtx, setEventCtx] = useState<EventBookingCtx | null>(null);
  /** PH3-06: deep-link mentah dari tap notifikasi, dikonsumsi effect di bawah. */
  const [pendingDeepLink, setPendingDeepLink] = useState<DeepLink | null>(null);
  const [deepVenueId, setDeepVenueId] = useState<string | null>(null);
  const [mineSignal, setMineSignal] = useState(0);
  const [deepEventId, setDeepEventId] = useState<string | null>(null);
  const [deepConversationId, setDeepConversationId] = useState<string | null>(null);

  /**
   * PH3-05: inisialisasi push notification sekali saat user login.
   * PH3-08: native FCM murni (tanpa expo). Lazy require (bukan static import)
   * mengikuti pola geolocation.ts — modul native FCM tak tersedia di jest,
   * jadi modul ini hanya di-load saat LoggedIn ter-mount.
   * Cleanup saat unmount (= saat logout, Gate kembali ke LoginScreen).
   * Tap notifikasi (termasuk cold start — diteruskan dari
   * getInitialNotification di dalam initializeNotifications)
   * diparse ke DeepLink di dalam modul lalu dikonsumsi effect di bawah.
   */
  useEffect(() => {
    let cleanupFn: (() => void) | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
      const mod = require('./src/config/notifications') as typeof import('./src/config/notifications');
      cleanupFn = mod.cleanupNotificationListeners;
      mod
        .initializeNotifications((link) => {
          setPendingDeepLink(link);
        })
        .catch(() => undefined);
    } catch {
      // Lingkungan tanpa native FCM (mis. emulator/test) — abaikan.
    }
    return () => {
      try {
        cleanupFn?.();
      } catch {
        // Best-effort cleanup.
      }
    };
  }, []);

  /** PH3-06: konsumsi deep-link tap notifikasi → tab + route yg relevan. */
  useEffect(() => {
    if (!pendingDeepLink) return;
    const link = pendingDeepLink;
    setPendingDeepLink(null);
    if (link.type === 'venue') {
      if (link.entityId) {
        setDeepVenueId(link.entityId);
        setTab('booking');
      }
    } else if (link.type === 'booking') {
      // Tanpa entityId pun tetap buka daftar booking (tak ada route detail).
      setMineSignal((s) => s + 1);
      setTab('booking');
    } else if (link.type === 'chat') {
      setTab('chat');
      if (link.chatKind === 'partner' && link.entityId) {
        setChatPartnerId(link.entityId);
      } else if (link.chatKind === 'conversation' && link.entityId) {
        setDeepConversationId(link.entityId);
      }
    } else if (link.type === 'event') {
      if (link.entityId) {
        setDeepEventId(link.entityId);
        setTab('events');
      }
    }
    // system / link tanpa entityId (selain booking): tetap di tab aktif.
  }, [pendingDeepLink]);

  /** BK-04: dari EventDetail -> tab Booking dengan konteks event. */
  const handleBookCourt = (e: EventDetail) => {
    setEventCtx({ eventId: e.id, title: e.title, date: eventDayKey(e.datetime) });
    setTab('booking');
  };

  return (
    <View style={styles.tabs}>
      <View style={styles.tabBar}>
        <View style={styles.tabFlex}>
          <Button title="Event" onPress={() => setTab('events')} />
        </View>
        <View style={styles.tabFlex}>
          <Button title="Booking" onPress={() => setTab('booking')} />
        </View>
        <View style={styles.tabFlex}>
          <Button title="Shop" onPress={() => setTab('shop')} />
        </View>
        <View style={styles.tabFlex}>
          <Button title="Partner" onPress={() => setTab('partners')} />
        </View>
        <View style={styles.tabFlex}>
          <Button title="Chat" onPress={() => setTab('chat')} />
        </View>
        <View style={styles.tabFlex}>
          <Button title="Profil" onPress={() => setTab('profile')} />
        </View>
      </View>
      <View style={styles.tabBody}>
        {tab === 'events' ? (
          <EventsFlow
            onBookCourt={handleBookCourt}
            deepEventId={deepEventId}
            onConsumedDeepEvent={() => setDeepEventId(null)}
          />
        ) : tab === 'booking' ? (
          <BookingFlow
            key={eventCtx?.eventId ?? 'direct'}
            eventCtx={eventCtx}
            deepVenueId={deepVenueId}
            onConsumedDeepVenue={() => setDeepVenueId(null)}
            mineSignal={mineSignal}
          />
        ) : tab === 'shop' ? (
          <ShopFlow />
        ) : tab === 'partners' ? (
          <PartnersFlow
            onChatPartner={(partnerId) => {
              setChatPartnerId(partnerId);
              setTab('chat');
            }}
          />
        ) : tab === 'chat' ? (
          <ChatFlow
            key={`${chatPartnerId ?? '-'}-${deepConversationId ?? '-'}`}
            initialPartnerId={chatPartnerId ?? undefined}
            onConsumedPartner={() => setChatPartnerId(null)}
            initialConversationId={deepConversationId ?? undefined}
            onConsumedConversation={() => setDeepConversationId(null)}
          />
        ) : (
          <Profile />
        )}
      </View>
    </View>
  );
}

/** Alur Chat SM-07: list + room (optimistic UI, socket + polling fallback). */
function ChatFlow({
  initialPartnerId,
  onConsumedPartner,
  initialConversationId,
  onConsumedConversation,
}: {
  initialPartnerId?: string;
  onConsumedPartner?: () => void;
  /** PH3-06: deep-link notifikasi chat via conversationId → buka room. */
  initialConversationId?: string;
  onConsumedConversation?: () => void;
}) {
  const { user } = useAuth();
  const myId = user?.id ?? null;
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listLoaded, setListLoaded] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [active, setActive] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgLoadingMore, setMsgLoadingMore] = useState(false);
  const [msgError, setMsgError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      setConversations(await listConversations());
    } catch (e) {
      setListError(toErrorMessage(e));
    } finally {
      setListLoading(false);
      setListLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadList().catch(() => undefined);
  }, [loadList]);

  // Deep-link dari tab Partner: buka/buat conversation lalu masuk room.
  useEffect(() => {
    if (!initialPartnerId) return;
    getOrCreateConversation(initialPartnerId)
      .then((conv) => {
        setConversations((prev) =>
          prev.some((c) => c.id === conv.id) ? prev : [conv, ...prev],
        );
        openRoom(conv);
      })
      .catch((e) => setListError(toErrorMessage(e)))
      .finally(() => onConsumedPartner?.());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPartnerId]);

  // PH3-06: deep-link tap notifikasi chat via conversationId — buka room
  // bila conversation ada di list yg sudah dimuat.
  useEffect(() => {
    if (!initialConversationId || !listLoaded) return;
    const found = conversations.find((c) => c.id === initialConversationId);
    if (found) openRoom(found);
    // TODO(PH3-06): conversationId tak ada di list (mis. riwayat lama di
    // luar halaman pertama) — buka room langsung via GET /conversations/:id
    // bila API detail conversation tersedia; saat ini tetap di list chat.
    onConsumedConversation?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialConversationId, listLoaded, conversations]);

  const loadMessages = useCallback(async (convId: string, p: number, append: boolean) => {
    if (append) setMsgLoadingMore(true);
    else {
      setMsgLoading(true);
      setMsgError(null);
    }
    try {
      const res = await getMessages(convId, p, 20);
      setTotal(res.meta.total);
      setPage(res.meta.page);
      setMessages((prev) => {
        const merged = append ? [...res.data, ...prev] : res.data;
        const seen = new Set<string>();
        return merged.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
      });
    } catch (e) {
      if (!append) setMsgError(toErrorMessage(e));
    } finally {
      setMsgLoading(false);
      setMsgLoadingMore(false);
    }
  }, []);

  const openRoom = (conv: ConversationItem) => {
    setActive(conv);
    setMessages([]);
    setPage(1);
    setTotal(0);
    setSendError(null);
    loadMessages(conv.id, 1, false).catch(() => undefined);
    markConversationRead(conv.id)
      .then(() =>
        setConversations((prev) =>
          prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c)),
        ),
      )
      .catch(() => undefined);
  };

  const { connected, socketError, sendMessage } = useChatSocket({
    conversationId: active?.id ?? null,
    enabled: active != null,
    onMessage: (msg) => {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      setTotal((t) => t + 1);
      // Pesan masuk saat room terbuka langsung ditandai dibaca.
      if (active && msg.senderId !== myId) {
        markConversationRead(active.id).catch(() => undefined);
      }
    },
    onConversationUpdate: (upd) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === upd.conversationId
            ? {
                ...c,
                lastMessage: upd.lastMessage,
                unreadCount:
                  active?.id === upd.conversationId && upd.lastMessage.senderId !== myId
                    ? 0
                    : upd.unreadCount,
              }
            : c,
        ),
      );
    },
  });

  // Polling fallback tiap 5 dtk bila socket tidak terhubung / error.
  useEffect(() => {
    if (!active) return;
    const mustPoll = !connected || !!socketError;
    setPolling(mustPoll);
    if (!mustPoll) return;
    const t = setInterval(() => {
      getMessages(active.id, 1, Math.max(20, messages.length || 20))
        .then((res) => {
          setMessages(res.data);
          setTotal(res.meta.total);
        })
        .catch(() => undefined);
    }, 5000);
    return () => clearInterval(t);
  }, [active, connected, socketError, messages.length]);

  const handleSend = (body: string) => {
    if (!active || !myId) return;
    const invalid = validateMessageBody(body);
    if (invalid) {
      setSendError(invalid);
      return;
    }
    setSending(true);
    setSendError(null);
    // Optimistic UI: tampilkan langsung dengan id sementara.
    const temp: ChatMessage = {
      id: `temp-${Date.now()}`,
      conversationId: active.id,
      senderId: myId,
      body: body.trim(),
      createdAt: new Date().toISOString(),
      readAt: null,
    };
    setMessages((prev) => [...prev, temp]);
    sendMessage(body.trim())
      .then((saved) => {
        setMessages((prev) => prev.map((m) => (m.id === temp.id ? saved : m)));
        loadList().catch(() => undefined);
      })
      .catch((e) => {
        setMessages((prev) => prev.filter((m) => m.id !== temp.id));
        setSendError(e instanceof Error ? e.message : 'Gagal mengirim pesan');
      })
      .finally(() => setSending(false));
  };

  if (active) {
    return (
      <ChatRoomScreen
        messages={messages}
        myId={myId}
        loading={msgLoading}
        loadingMore={msgLoadingMore}
        hasMore={messages.length < total}
        error={msgError}
        connected={connected}
        socketError={socketError}
        polling={polling}
        sending={sending}
        sendError={sendError}
        onBack={() => {
          setActive(null);
          loadList().catch(() => undefined);
        }}
        onLoadMore={() => loadMessages(active.id, page + 1, true).catch(() => undefined)}
        onSend={handleSend}
      />
    );
  }
  return (
    <ChatListScreen
      conversations={conversations}
      loading={listLoading}
      error={listError}
      onRefresh={() => loadList().catch(() => undefined)}
      onSelect={openRoom}
    />
  );
}

/** Alur Search Partner SM-06: filter sport/skill/radius + GPS, list + jarak, pagination. */
function PartnersFlow({ onChatPartner }: { onChatPartner?: (partnerId: string) => void }) {
  const [partners, setPartners] = useState<PartnerItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [lastFilter, setLastFilter] = useState<SearchPartnersFilter>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const runSearch = useCallback(async (filter: SearchPartnersFilter) => {
    const invalid = validateSearchPartners(filter);
    if (invalid) {
      setError(invalid);
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await searchPartners({ ...filter, limit: filter.limit ?? 20 });
      const nextPage = res.meta.page;
      setLastFilter(filter);
      setPartners((prev) => (nextPage <= 1 ? res.data : [...prev, ...res.data]));
      setTotal(res.meta.total);
      setPage(res.meta.page);
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = () => {
    if (loading) return;
    runSearch({ ...lastFilter, page: page + 1, limit }).catch(() => undefined);
  };

  const useGps = async () => {
    setGpsLoading(true);
    setGpsError(null);
    try {
      const pos = await getCurrentPosition();
      return { latitude: pos.latitude, longitude: pos.longitude };
    } catch (e) {
      setGpsError(e instanceof Error ? e.message : 'Gagal mendapatkan lokasi GPS');
      throw e;
    } finally {
      setGpsLoading(false);
    }
  };

  // Invite placeholder sampai SM-08; Chat (SM-07) buka room 1-1.
  const placeholder = (kind: 'Invite' | 'Chat', p: PartnerItem) => {
    if (kind === 'Chat') {
      if (onChatPartner) onChatPartner(p.id);
      else setNotice(`Chat ke ${p.displayName || p.email} segera hadir (SM-07).`);
      return;
    }
    setNotice(`${kind} ke ${p.displayName || p.email} segera hadir (SM-07).`);
  };

  return (
    <SearchPartnerScreen
      partners={partners}
      total={total}
      page={page}
      limit={limit}
      loading={loading}
      error={error}
      gpsLoading={gpsLoading}
      gpsError={gpsError}
      notice={notice}
      onSearch={runSearch}
      onLoadMore={loadMore}
      hasMore={partners.length < total}
      onUseGps={useGps}
      onInvite={(p) => placeholder('Invite', p)}
      onChat={(p) => placeholder('Chat', p)}
    />
  );
}

function Gate() {
  const { user, initializing, loading, error, login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');

  if (initializing) {
    return (
      <View style={styles.box}>
        <ActivityIndicator />
      </View>
    );
  }

  if (user) return <LoggedIn />;

  const noop = () => undefined;
  if (mode === 'login') {
    return (
      <LoginScreen
        loading={loading}
        serverError={error}
        onSubmit={(email, password) => login(email, password).catch(noop)}
        onSwitch={() => setMode('register')}
      />
    );
  }
  return (
    <RegisterScreen
      loading={loading}
      serverError={error}
      onSubmit={(email, password, displayName) =>
        register(email, password, displayName).catch(noop)
      }
      onSwitch={() => setMode('login')}
    />
  );
}

function App(): React.JSX.Element {
  return (
    <AuthProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <Gate />
      </SafeAreaView>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#555' },
  gap: { height: 12 },
  tabs: { flex: 1 },
  tabBar: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8 },
  tabFlex: { flex: 1, marginHorizontal: 4 },
  tabBody: { flex: 1 },
});

export default App;
