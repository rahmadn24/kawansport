import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { COLORS, RADIUS, SPACING, TYPO, friendlyServerError } from './src/theme';
import {
  UIAppBar,
  UIAvatar,
  UIBadge,
  UIButton,
  UICard,
  UIEmptyState,
  UIErrorBanner,
  UISectionTitle,
  UISkeleton,
  UITextInput,
  UIToast,
} from './src/components/ui';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { UpdateProfileInput, deleteMyAccount } from './src/api/profile';
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
  RentalItem,
  RentalSelection,
  VenueItem,
  activeCourts,
  getCourtAvailability,
  getVenueDetail,
  getVenueRentals,
  listVenues,
} from './src/api/venues';
import { api } from './src/api/client';
import {
  getLoyaltyBalance,
  normalizeVoucherCode,
  validateVoucherCode,
} from './src/api/vouchers';
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
  sendMessageRest,
  validateMessageBody,
} from './src/api/chat';
import {
  listMyNotifications,
  markNotificationRead,
  type AppNotification,
} from './src/api/notifications';
import {
  acceptInvite,
  declineInvite,
  listMyInvites,
  sendInvite,
  type InviteDir,
  type InviteItem,
} from './src/api/invites';
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
import { SearchScreen } from './src/screens/SearchScreen';
import {
  SearchItem,
  searchAll,
  validateSearchFilter,
} from './src/api/search';
import { PromoItem, listPromos } from './src/api/promos';
import { VenueDetailScreen } from './src/screens/VenueDetailScreen';
import { CheckoutScreen } from './src/screens/CheckoutScreen';
import { MyBookingsScreen } from './src/screens/MyBookingsScreen';
import { NotifInboxScreen } from './src/screens/NotifInboxScreen';
import { InvitesScreen } from './src/screens/InvitesScreen';
import { CartScreen } from './src/screens/CartScreen';
import { MpCheckoutScreen } from './src/screens/MpCheckoutScreen';
import { MyOrdersScreen } from './src/screens/MyOrdersScreen';

// Logo resmi KawanSport (src/assets/logo.png, master: docs/design/logo.png).
// Dipakai splash Gate + hero auth; Metro me-resolve require statis ini saat bundling.
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const K_LOGO = require('./src/assets/logo.png');

function Profile() {
  const { user, logout, loading, error, refreshProfile, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  /** GAP-02 hapus akun: idle -> confirm -> typing("HAPUS") -> DELETE /me. */
  const [delStep, setDelStep] = useState<'idle' | 'confirm' | 'typing'>('idle');
  const [delText, setDelText] = useState('');
  const [delLoading, setDelLoading] = useState(false);
  const [delError, setDelError] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  if (editing && user) {
    const save = (input: UpdateProfileInput) => {
      updateProfile(input)
        .then(() => {
          setEditing(false);
          setToast('Profil tersimpan ✓');
        })
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

  const confirmLogout = () => {
    Alert.alert('Keluar dari KawanSport?', 'Kamu harus masuk lagi untuk main bareng.', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Ya, keluar', style: 'destructive', onPress: () => logout().catch(() => undefined) },
    ]);
  };

  /**
   * GAP-02: DELETE /me lalu logout lokal (reset ke Gate).
   * 409 (ada tanggungan) -> alasan server ditampilkan jujur, akun tetap utuh.
   */
  const doDeleteAccount = () => {
    setDelLoading(true);
    setDelError(null);
    deleteMyAccount()
      .then(() => logout().catch(() => undefined))
      .catch((e) => setDelError(toErrorMessage(e)))
      .finally(() => setDelLoading(false));
  };

  const displayName = user?.displayName || user?.email || 'Kawan';
  const shownSports = (user?.sports ?? []).slice(0, 4);

  return (
    <View style={styles.screenWrap}>
      <View style={styles.padded}>
        <UIAppBar title="Profil Saya" />
      </View>
      {loading && !user ? (
        <View style={styles.padded}>
          <UISkeleton rows={2} />
        </View>
      ) : (
        <ScrollView style={styles.bodyFlex} contentContainerStyle={styles.bodyPad}>
          <UICard>
            <View style={styles.profileTop}>
              <UIAvatar name={user?.displayName} email={user?.email} uri={user?.avatarUrl} size={64} />
              <View style={styles.profileHead}>
                <Text style={styles.profileName} accessibilityLabel={`Nama: ${displayName}`} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={styles.profileEmail} numberOfLines={1}>
                  {user?.email ?? '—'}
                </Text>
                {/* TODO(ST-07): badge verifikasi komunitas DISEMBUNYIKAN sampai API profil sosial ada. */}
                {user?.skillLevel ? (
                  <View style={styles.badgeRow}>
                    <UIBadge kind="skill" label={skillLabel(user.skillLevel)} icon="★" />
                  </View>
                ) : null}
              </View>
            </View>
            {shownSports.length > 0 ? (
              <View style={styles.sportsRow}>
                {shownSports.map((s) => (
                  <View key={s} style={styles.miniChip}>
                    <Text style={styles.miniChipText}>🏅 {s}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.profileEmpty}>Belum ada olahraga favorit — lengkapi via Edit Profil.</Text>
            )}
            <Text style={styles.profileLoc} accessibilityLabel={user?.lat != null ? 'Lokasi sudah ditandai' : 'Lokasi belum ditandai'}>
              {user?.lat != null && user?.lng != null
                ? '📍 Lokasi sudah ditandai'
                : '📍 Lokasi belum ditandai — atur via Edit Profil'}
            </Text>
            {/* TODO(ST-07): stat sosial (TOTAL MABAR, game selesai, bintang sportif)
                DISEMBUNYIKAN — butuh EL-00/ST-07; tampilkan yang ada: olahraga + skill + lokasi. */}
            {/* TODO(ST-07): badge prestasi, riwayat main bareng, dan circle teman
                DISEMBUNYIKAN sampai API profil sosial tersedia. */}
          </UICard>

          <UISectionTitle>Pratinjau kartu partner</UISectionTitle>
          <UICard>
            <View style={styles.profileTop}>
              <UIAvatar name={user?.displayName} email={user?.email} uri={user?.avatarUrl} size={44} />
              <View style={styles.profileHead}>
                <Text style={styles.previewName} numberOfLines={1}>
                  {displayName} 👋
                </Text>
                <Text style={styles.previewSub}>
                  {shownSports.length > 0 ? shownSports.join(' • ') : 'Siap diajak sparing!'}
                </Text>
              </View>
            </View>
          </UICard>

          <UIErrorBanner message={friendlyServerError(error)} actionLabel="Coba lagi" onAction={() => refreshProfile().catch(() => undefined)} />

          <View style={styles.gap} />
          {loading ? (
            <ActivityIndicator accessibilityLabel="Memuat profil" />
          ) : (
            <>
              {/* Profil sendiri: Edit. Tombol "Ajak Mabar" HANYA di profil orang lain. */}
              <UIButton title="Edit Profil" onPress={() => setEditing(true)} accessibilityLabel="Edit profil" />
              <View style={styles.gap} />
              <UIButton title="Muat ulang" variant="ghost" onPress={() => refreshProfile().catch(() => undefined)} accessibilityLabel="Muat ulang profil" />
              <View style={styles.gap} />
              <UIButton title="Keluar" variant="danger" onPress={confirmLogout} accessibilityLabel="Keluar dari akun" />
              <View style={styles.gap} />
              <UISectionTitle>Zona berbahaya</UISectionTitle>
              <UICard>
                {delStep === 'idle' ? (
                  <UIButton
                    title="Hapus Akun"
                    variant="danger"
                    onPress={() => {
                      setDelError(null);
                      setDelStep('confirm');
                    }}
                    accessibilityLabel="Hapus akun permanen"
                  />
                ) : delStep === 'confirm' ? (
                  <>
                    <Text style={styles.deleteWarn}>
                      Hapus akun permanen? Semua sesi ikut keluar. Bila masih ada booking/order
                      aktif, event mendatang, venue, atau toko, server menolak — alasannya
                      ditampilkan di sini.
                    </Text>
                    <View style={styles.gap} />
                    <UIButton
                      title="Ya, lanjutkan"
                      variant="danger"
                      onPress={() => setDelStep('typing')}
                      accessibilityLabel="Lanjutkan hapus akun"
                    />
                    <View style={styles.gap} />
                    <UIButton title="Batal" variant="ghost" onPress={() => setDelStep('idle')} accessibilityLabel="Batal hapus akun" />
                  </>
                ) : (
                  <>
                    <Text style={styles.deleteWarn}>
                      Ketik HAPUS (huruf besar) untuk konfirmasi penghapusan permanen.
                    </Text>
                    <UITextInput
                      label='Ketik "HAPUS"'
                      testID="delete-confirm"
                      placeholder="HAPUS"
                      autoCapitalize="characters"
                      autoCorrect={false}
                      value={delText}
                      onChangeText={setDelText}
                    />
                    <UIErrorBanner message={friendlyServerError(delError)} />
                    <UIButton
                      title="Hapus permanen"
                      variant="danger"
                      onPress={doDeleteAccount}
                      disabled={delText.trim() !== 'HAPUS'}
                      loading={delLoading}
                      loadingTitle="Menghapus…"
                      accessibilityLabel="Hapus akun permanen"
                      testID="delete-submit"
                    />
                    <View style={styles.gap} />
                    <UIButton
                      title="Batal"
                      variant="ghost"
                      onPress={() => {
                        setDelStep('idle');
                        setDelText('');
                        setDelError(null);
                      }}
                      accessibilityLabel="Batal hapus akun"
                    />
                  </>
                )}
              </UICard>
            </>
          )}
        </ScrollView>
      )}
      <UIToast message={toast} kind="success" />
    </View>
  );
}

function skillLabel(level: NonNullable<ReturnType<typeof useAuth>['user']>['skillLevel']): string {
  if (level === 'beginner') return 'Pemula';
  if (level === 'intermediate') return 'Menengah';
  return 'Lanjutan';
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
  onOpenNotifications,
}: {
  onBookCourt: (event: EventDetail) => void;
  /** PH3-06: deep-link notifikasi event → buka detail sekali lalu konsumsi. */
  deepEventId?: string | null;
  onConsumedDeepEvent?: () => void;
  /** GAP-01: bell -> kotak masuk notifikasi. */
  onOpenNotifications?: () => void;
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
  const [toast, setToast] = useState<string | null>(null);
  /** ST-09: banner promo CMS real; gagal/kosong -> disembunyikan (fail-soft). */
  const [promos, setPromos] = useState<PromoItem[]>([]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

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
    // ST-09: promo banner CMS (GET /promos publik); gagal -> [] = sembunyi.
    listPromos()
      .then(setPromos)
      .catch(() => setPromos([]));
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
  const mutateJoin = (fn: (id: string) => Promise<EventDetail>, okMsg: string) => {
    if (route.name !== 'detail') return;
    const id = route.id;
    setMutating(true);
    setJoinError(null);
    fn(id)
      .then((updated) => {
        setDetail(updated);
        loadParticipants(id);
        setToast(okMsg);
      })
      .catch((e) => setJoinError(toErrorMessage(e)))
      .finally(() => setMutating(false));
  };

  /**
   * Join via JoinEventResult: gratis -> toast ikut; berbayar (ST-02) ->
   * toast info paymentRef; penuh (ST-03) -> 409 ditangkap di api sebagai
   * `{ waitlisted: true, position }`, bukan error.
   */
  const handleJoin = () => {
    if (route.name !== 'detail') return;
    const id = route.id;
    setMutating(true);
    setJoinError(null);
    joinEvent(id)
      .then((res) => {
        if (res.event) {
          setDetail(res.event);
          loadParticipants(id);
        }
        if (res.waitlisted) {
          setToast(`Event penuh — kamu masuk antrean posisi ${res.position ?? '?'}.`);
        } else if (res.payment) {
          setToast(`Event berbayar — selesaikan pembayaran ${res.payment.paymentRef}.`);
        } else {
          setToast('Kamu ikut event ini. Sampai jumpa di lapangan! 🎉');
        }
      })
      .catch((e) => setJoinError(toErrorMessage(e)))
      .finally(() => setMutating(false));
  };
  const handleLeave = () => mutateJoin(leaveEvent, 'Kamu keluar dari event.');

  const submitCreate = (input: CreateEventInput) => {
    setSaving(true);
    setCreateError(null);
    createEvent(input)
      .then((created) => {
        setEvents((prev) => [created, ...prev]);
        setRoute({ name: 'list' });
        loadList(sportFilter).catch(() => undefined);
        setToast('Event dibuat. Ajak kawanmu gabung! 🎉');
      })
      .catch((e) => setCreateError(toErrorMessage(e)))
      .finally(() => setSaving(false));
  };

  const toastView = <UIToast message={toast} kind="success" />;

  if (route.name === 'create') {
    return (
      <View style={styles.flowWrap}>
        <CreateEventScreen
          saving={saving}
          serverError={createError}
          onSubmit={submitCreate}
          onCancel={() => setRoute({ name: 'list' })}
        />
        {toastView}
      </View>
    );
  }
  if (route.name === 'detail') {
    return (
      <View style={styles.flowWrap}>
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
        {toastView}
      </View>
    );
  }
  return (
    <View style={styles.flowWrap}>
      <EventListScreen
        events={events}
        loading={loading}
        error={error}
        sportFilter={sportFilter}
        onFilterChange={changeFilter}
        onRefresh={() => loadList(sportFilter).catch(() => undefined)}
        onSelect={openDetail}
        onCreate={() => setRoute({ name: 'create' })}
        onBellPress={onOpenNotifications}
        promos={promos}
      />
      {toastView}
    </View>
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
  onOpenNotifications,
}: {
  eventCtx: EventBookingCtx | null;
  /** PH3-06: deep-link notifikasi venue → buka venue detail sekali lalu konsumsi. */
  deepVenueId?: string | null;
  onConsumedDeepVenue?: () => void;
  /** PH3-06: deep-link notifikasi booking → buka tab mine (increment = trigger). */
  mineSignal?: number;
  /** GAP-01: bell -> kotak masuk notifikasi. */
  onOpenNotifications?: () => void;
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
  /** Katalog sewa venue (ST-10, upsell opsional; gagal dimuat = disembunyikan jujur). */
  const [rentals, setRentals] = useState<RentalItem[]>([]);
  const [rentalsLoading, setRentalsLoading] = useState(false);

  const [mine, setMine] = useState<BookingItem[]>([]);
  const [mineLoading, setMineLoading] = useState(false);
  const [mineError, setMineError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  /** UX-03: peta courtId -> "Venue • Court" (real, dari daftar venue yg dimuat). */
  const venueNameByCourt = useMemo(() => {
    const map: Record<string, string> = {};
    for (const v of venues) {
      for (const c of v.courts ?? []) {
        map[c.id] = `${v.name} • ${c.name}`;
      }
    }
    return map;
  }, [venues]);

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
    setRentals([]);
    setVenueLoading(true);
    setRentalsLoading(true);
    getVenueDetail(id)
      .then((v) => {
        setVenue(v);
        const first = activeCourts(v)[0] ?? null;
        setCourt(first);
        if (first) loadSlots(first, date).catch(() => undefined);
      })
      .catch((e) => setVenueError(toErrorMessage(e)))
      .finally(() => setVenueLoading(false));
    // Katalog sewa fail-soft: gagal dimuat → section disembunyikan (tanpa angka palsu).
    getVenueRentals(id)
      .then((items) => setRentals(items.filter((r) => r.status === 'active')))
      .catch(() => setRentals([]))
      .finally(() => setRentalsLoading(false));
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

  const handleBook = (
    slot: AvailabilityResult['slots'][number],
    rentalSel: RentalSelection[] = [],
  ) => {
    if (!court) return;
    const input = {
      courtId: court.id,
      date,
      start: slot.start,
      ...(rentalSel.length > 0 ? { rentals: rentalSel } : {}),
    };
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

  /** UX-03: bayar ulang booking pending via layar checkout existing. */
  const handleRepay = (b: BookingItem) => {
    setRoute({
      name: 'checkout',
      booking: b,
      courtLabel: venueNameByCourt[b.courtId] ?? null,
    });
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
        venueNameByCourt={venueNameByCourt}
        onRepay={handleRepay}
        onBellPress={onOpenNotifications}
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
        rentals={rentals}
        rentalsLoading={rentalsLoading}
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
      onBellPress={onOpenNotifications}
    />
  );
}

/**
 * Alur Cari ST-09: query + hasil gabungan (venue/event/produk) + nearby geo.
 * Venue -> tab Booking (deepVenueId); event -> tab Event (deepEventId);
 * produk -> tab Shop (tak ada layar detail produk di mobile).
 * TODO(ST-09-map): map view butuh react-native-maps (native rebuild tak
 * terverifikasi) — sementara daftar nearby + jarak, tanpa peta palsu.
 */
function SearchFlow({
  onSelectVenue,
  onSelectEvent,
  onSelectProduct,
  onOpenNotifications,
}: {
  onSelectVenue: (id: string) => void;
  onSelectEvent: (id: string) => void;
  onSelectProduct: (id: string) => void;
  onOpenNotifications?: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const runSearch = useCallback(
    async (q: string, l: { lat: number; lng: number } | null) => {
      const filter = {
        ...(q.trim() ? { q: q.trim() } : {}),
        ...(l ? { lat: l.lat, lng: l.lng } : {}),
        limit: 20,
      };
      const invalid = validateSearchFilter(filter);
      if (invalid) {
        setError(invalid);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await searchAll(filter);
        setResults(res.data);
        setTotal(res.meta.total);
      } catch (e) {
        setError(toErrorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    runSearch('', null).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUseLocation = async () => {
    setLocating(true);
    setLocationError(null);
    try {
      const pos = await getCurrentPosition();
      const l = { lat: pos.latitude, lng: pos.longitude };
      setLoc(l);
      await runSearch(query, l);
    } catch (e) {
      setLocationError(e instanceof Error ? e.message : 'Gagal mendapatkan lokasi GPS');
    } finally {
      setLocating(false);
    }
  };

  const handleClearLocation = () => {
    setLoc(null);
    runSearch(query, null).catch(() => undefined);
  };

  return (
    <SearchScreen
      query={query}
      onQueryChange={setQuery}
      results={results}
      total={total}
      loading={loading}
      error={error}
      nearbyActive={loc !== null}
      locating={locating}
      locationError={locationError}
      onSubmit={() => runSearch(query, loc).catch(() => undefined)}
      onRefresh={() => runSearch(query, loc).catch(() => undefined)}
      onUseLocation={() => handleUseLocation().catch(() => undefined)}
      onClearLocation={handleClearLocation}
      onSelectVenue={onSelectVenue}
      onSelectEvent={onSelectEvent}
      onSelectProduct={onSelectProduct}
      onBellPress={onOpenNotifications}
    />
  );
}

type ShopRoute =
  | { name: 'cart' }
  | { name: 'checkout'; order: ShopOrder }
  | { name: 'orders' };

/** Alur Shop MP-02: cart -> checkout (1 order + N grup) -> orders. */
function ShopFlow({ onOpenNotifications }: { onOpenNotifications?: () => void }) {
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
  /** ST-04: kode voucher untuk checkout + saldo Poin Kawan (display). */
  const [voucherCode, setVoucherCode] = useState('');
  const [loyaltyBalance, setLoyaltyBalance] = useState<number | null>(null);
  const [loyaltyError, setLoyaltyError] = useState<string | null>(null);

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
    // ST-04: saldo poin best-effort; gagal -> pesan jujur di section voucher.
    getLoyaltyBalance()
      .then(setLoyaltyBalance)
      .catch((e) => setLoyaltyError(toErrorMessage(e)));
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
    const code = normalizeVoucherCode(voucherCode);
    if (voucherCode.trim()) {
      const invalid = validateVoucherCode(voucherCode);
      if (invalid) {
        setMutateError(invalid);
        return;
      }
    }
    setMutating(true);
    setMutateError(null);
    checkoutCart(api, code ? { voucherCode: code } : undefined)
      .then((order) => {
        setVoucherCode('');
        setRoute({ name: 'checkout', order });
      })
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
        onBellPress={onOpenNotifications}
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
      voucherCode={voucherCode}
      onVoucherCodeChange={setVoucherCode}
      loyaltyBalance={loyaltyBalance}
      loyaltyError={loyaltyError}
    />
  );
}

const TABS = [
  { key: 'events', label: 'Event', icon: '📅', a11y: 'Tab Event' },
  { key: 'booking', label: 'Booking', icon: '🏟', a11y: 'Tab Booking' },
  { key: 'search', label: 'Cari', icon: '🔍', a11y: 'Tab Cari' },
  { key: 'shop', label: 'Shop', icon: '🛍', a11y: 'Tab Shop' },
  { key: 'partners', label: 'Partner', icon: '🤝', a11y: 'Tab Partner' },
  { key: 'chat', label: 'Chat', icon: '💬', a11y: 'Tab Chat' },
  { key: 'profile', label: 'Profil', icon: '👤', a11y: 'Tab Profil' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

function LoggedIn() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabKey>('events');
  const [chatPartnerId, setChatPartnerId] = useState<string | null>(null);
  const [eventCtx, setEventCtx] = useState<EventBookingCtx | null>(null);
  /** PH3-06: deep-link mentah dari tap notifikasi, dikonsumsi effect di bawah. */
  const [pendingDeepLink, setPendingDeepLink] = useState<DeepLink | null>(null);
  const [deepVenueId, setDeepVenueId] = useState<string | null>(null);
  const [mineSignal, setMineSignal] = useState(0);
  const [deepEventId, setDeepEventId] = useState<string | null>(null);
  const [deepConversationId, setDeepConversationId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  /** GAP-01: kotak masuk notifikasi (route overlay, dibuka via bell). */
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [notifTotal, setNotifTotal] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [notifMarkingId, setNotifMarkingId] = useState<string | null>(null);
  const [notifMarkError, setNotifMarkError] = useState<string | null>(null);

  // UX-02: sapa user sekali saat masuk (login/register sukses → LoggedIn mount).
  useEffect(() => {
    setToast('Selamat datang di KawanSport! 🎉');
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

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
        setToast('Membuka lapangan dari notifikasi.');
      }
    } else if (link.type === 'booking') {
      // Tanpa entityId pun tetap buka daftar booking (tak ada route detail).
      setMineSignal((s) => s + 1);
      setTab('booking');
      setToast('Membuka booking dari notifikasi.');
    } else if (link.type === 'chat') {
      setTab('chat');
      setToast('Membuka chat dari notifikasi.');
      if (link.chatKind === 'partner' && link.entityId) {
        setChatPartnerId(link.entityId);
      } else if (link.chatKind === 'conversation' && link.entityId) {
        setDeepConversationId(link.entityId);
      }
    } else if (link.type === 'event') {
      if (link.entityId) {
        setDeepEventId(link.entityId);
        setTab('events');
        setToast('Membuka event dari notifikasi.');
      }
    }
    // system / link tanpa entityId (selain booking): tetap di tab aktif.
  }, [pendingDeepLink]);

  /** BK-04: dari EventDetail -> tab Booking dengan konteks event. */
  const handleBookCourt = (e: EventDetail) => {
    setEventCtx({ eventId: e.id, title: e.title, date: eventDayKey(e.datetime) });
    setTab('booking');
  };

  const unreadLabel = unreadCount > 0 ? `, ${unreadCount > 99 ? '99+' : unreadCount} belum dibaca` : '';

  /** GAP-01: riwayat notifikasi — muat saat inbox dibuka + tandai dibaca. */
  const loadNotifs = useCallback(async () => {
    setNotifLoading(true);
    setNotifError(null);
    try {
      const res = await listMyNotifications(1, 20);
      setNotifs(res.data);
      setNotifTotal(res.meta.total);
    } catch (e) {
      setNotifError(toErrorMessage(e));
    } finally {
      setNotifLoading(false);
    }
  }, []);

  const openNotif = useCallback(() => {
    setNotifOpen(true);
    loadNotifs().catch(() => undefined);
  }, [loadNotifs]);

  const handleMarkNotifRead = (id: string) => {
    setNotifMarkingId(id);
    setNotifMarkError(null);
    markNotificationRead(id)
      .then((updated) => {
        setNotifs((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      })
      .catch((e) => setNotifMarkError(toErrorMessage(e)))
      .finally(() => setNotifMarkingId(null));
  };

  return (
    <View style={styles.tabs}>
      <View style={styles.tabBody}>
        {notifOpen ? (
          <NotifInboxScreen
            notifications={notifs}
            total={notifTotal}
            loading={notifLoading}
            error={notifError}
            markingId={notifMarkingId}
            markError={notifMarkError}
            onRefresh={() => loadNotifs().catch(() => undefined)}
            onMarkRead={handleMarkNotifRead}
            onBack={() => setNotifOpen(false)}
          />
        ) : tab === 'events' ? (
          <EventsFlow
            onBookCourt={handleBookCourt}
            deepEventId={deepEventId}
            onConsumedDeepEvent={() => setDeepEventId(null)}
            onOpenNotifications={openNotif}
          />
        ) : tab === 'booking' ? (
          <BookingFlow
            key={eventCtx?.eventId ?? 'direct'}
            eventCtx={eventCtx}
            deepVenueId={deepVenueId}
            onConsumedDeepVenue={() => setDeepVenueId(null)}
            mineSignal={mineSignal}
            onOpenNotifications={openNotif}
          />
        ) : tab === 'search' ? (
          <SearchFlow
            onSelectVenue={(id) => {
              setDeepVenueId(id);
              setTab('booking');
            }}
            onSelectEvent={(id) => {
              setDeepEventId(id);
              setTab('events');
            }}
            onSelectProduct={() => setTab('shop')}
            onOpenNotifications={openNotif}
          />
        ) : tab === 'shop' ? (
          <ShopFlow onOpenNotifications={openNotif} />
        ) : tab === 'partners' ? (
          <PartnersFlow
            onChatPartner={(partnerId) => {
              setChatPartnerId(partnerId);
              setTab('chat');
            }}
            onOpenNotifications={openNotif}
          />
        ) : tab === 'chat' ? (
          <ChatFlow
            key={`${chatPartnerId ?? '-'}-${deepConversationId ?? '-'}`}
            initialPartnerId={chatPartnerId ?? undefined}
            onConsumedPartner={() => setChatPartnerId(null)}
            initialConversationId={deepConversationId ?? undefined}
            onConsumedConversation={() => setDeepConversationId(null)}
            onUnreadChange={setUnreadCount}
            onOpenNotifications={openNotif}
          />
        ) : (
          <Profile />
        )}
      </View>
      <View style={styles.tabBar} accessibilityRole="tablist">
        {TABS.map((t) => {
          const active = tab === t.key;
          const label = t.key === 'chat' ? `${t.a11y}${unreadLabel}` : t.a11y;
          return (
            <Pressable
              key={t.key}
              style={[styles.tabItem, active && styles.tabItemActive]}
              onPress={() => setTab(t.key)}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: active }}
            >
              <View style={styles.tabIconWrap}>
                {t.key === 'profile' ? (
                  <UIAvatar name={user?.displayName} email={user?.email} uri={user?.avatarUrl} size={36} />
                ) : (
                  <Text style={styles.tabIcon} accessibilityElementsHidden>
                    {t.icon}
                  </Text>
                )}
                {t.key === 'chat' && unreadCount > 0 ? (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{unreadCount > 99 ? '99+' : String(unreadCount)}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
              {active ? <View style={styles.tabIndicator} /> : null}
            </Pressable>
          );
        })}
      </View>
      <UIToast message={toast} kind="info" />
    </View>
  );
}

/** Alur Chat SM-07: list + room (optimistic UI, socket + polling fallback). */
function ChatFlow({
  initialPartnerId,
  onConsumedPartner,
  initialConversationId,
  onConsumedConversation,
  onUnreadChange,
  onOpenNotifications,
}: {
  initialPartnerId?: string;
  onConsumedPartner?: () => void;
  /** PH3-06: deep-link notifikasi chat via conversationId → buka room. */
  initialConversationId?: string;
  onConsumedConversation?: () => void;
  /** UX-02: laporkan total unread ke BottomTabs (badge). Display-only. */
  onUnreadChange?: (n: number) => void;
  /** GAP-01: bell -> kotak masuk notifikasi. */
  onOpenNotifications?: () => void;
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
  /** GAP-02: indikator jujur bila kiriman terakhir lewat jalur cadangan REST. */
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
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

  // UX-02: total unread untuk badge tab Chat (display-only, tak ubah logika).
  useEffect(() => {
    onUnreadChange?.(conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0));
  }, [conversations, onUnreadChange]);

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
    setFallbackNotice(null);
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

  /** Batas tunggu ack WS sebelum fallback REST (GAP-02). */
  const WS_SEND_TIMEOUT_MS = 8000;

  const withTimeout = <T,>(p: Promise<T>, ms: number, message: string): Promise<T> =>
    new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(message)), ms);
      p.then(
        (v) => {
          clearTimeout(t);
          resolve(v);
        },
        (e) => {
          clearTimeout(t);
          reject(e);
        },
      );
    });

  const handleSend = (body: string) => {
    if (!active || !myId) return;
    const invalid = validateMessageBody(body);
    if (invalid) {
      setSendError(invalid);
      return;
    }
    setSending(true);
    setSendError(null);
    setFallbackNotice(null);
    // Optimistic UI: tampilkan langsung dengan id sementara.
    const trimmed = body.trim();
    const temp: ChatMessage = {
      id: `temp-${Date.now()}`,
      conversationId: active.id,
      senderId: myId,
      body: trimmed,
      createdAt: new Date().toISOString(),
      readAt: null,
    };
    setMessages((prev) => [...prev, temp]);
    const convId = active.id;
    const replaceTemp = (saved: ChatMessage) => {
      setMessages((prev) => prev.map((m) => (m.id === temp.id ? saved : m)));
      loadList().catch(() => undefined);
    };
    // GAP-02: WS dulu (dengan timeout) -> gagal/timeout = fallback REST
    // otomatis. Gagal dua-duanya = pesan error jujur, JANGAN diam.
    withTimeout(sendMessage(trimmed), WS_SEND_TIMEOUT_MS, 'Koneksi langsung lambat')
      .then((saved) => {
        replaceTemp(saved);
        setSending(false);
      })
      .catch(() => {
        sendMessageRest(convId, trimmed)
          .then((saved) => {
            replaceTemp(saved);
            setFallbackNotice('Koneksi langsung gagal — pesan dikirim via jalur cadangan.');
          })
          .catch((e2) => {
            setMessages((prev) => prev.filter((m) => m.id !== temp.id));
            setSendError(
              e2 instanceof Error
                ? `Pesan gagal terkirim via koneksi langsung maupun jalur cadangan: ${e2.message}`
                : 'Pesan gagal terkirim via koneksi langsung maupun jalur cadangan.',
            );
          })
          .finally(() => setSending(false));
      });
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
        fallbackNotice={fallbackNotice}
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
      onBellPress={onOpenNotifications}
    />
  );
}

/** Alur Search Partner SM-06 + Invite GAP-01: filter sport/skill/radius + GPS, list + jarak, pagination, invite real. */
function PartnersFlow({
  onChatPartner,
  onOpenNotifications,
}: {
  onChatPartner?: (partnerId: string) => void;
  /** GAP-01: bell -> kotak masuk notifikasi. */
  onOpenNotifications?: () => void;
}) {
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
  /** GAP-01: invite real — id partner yang undangannya sedang dikirim. */
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [showInvites, setShowInvites] = useState(false);
  const [incoming, setIncoming] = useState<InviteItem[]>([]);
  const [outgoing, setOutgoing] = useState<InviteItem[]>([]);
  const [invitesDir, setInvitesDir] = useState<InviteDir>('in');
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [invitesError, setInvitesError] = useState<string | null>(null);
  const [invitesActionId, setInvitesActionId] = useState<string | null>(null);
  const [invitesActionError, setInvitesActionError] = useState<string | null>(null);

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

  // GAP-01: invite real (POST /invites) + feedback jujur; Chat (SM-07) buka room 1-1.
  const handleChat = (p: PartnerItem) => {
    const name = p.displayName || p.email;
    if (onChatPartner) onChatPartner(p.id);
    else setNotice(`Chat ke ${name} segera hadir.`);
  };

  const handleInvite = (p: PartnerItem) => {
    const name = p.displayName || p.email;
    setInvitingId(p.id);
    setError(null);
    sendInvite({ toUserId: p.id })
      .then(() => {
        setNotice(`Undangan terkirim ke ${name}. Pantau di Undangan Sparing.`);
        loadInvites().catch(() => undefined);
      })
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setInvitingId(null));
  };

  const loadInvites = useCallback(async () => {
    setInvitesLoading(true);
    setInvitesError(null);
    setInvitesActionError(null);
    try {
      const [masuk, keluar] = await Promise.all([listMyInvites('in'), listMyInvites('sent')]);
      setIncoming(masuk);
      setOutgoing(keluar);
    } catch (e) {
      setInvitesError(toErrorMessage(e));
    } finally {
      setInvitesLoading(false);
    }
  }, []);

  const mutateInvite = (id: string, fn: (inviteId: string) => Promise<unknown>, okMsg: string) => {
    setInvitesActionId(id);
    setInvitesActionError(null);
    fn(id)
      .then(() => {
        setNotice(okMsg);
        loadInvites().catch(() => undefined);
      })
      .catch((e) => setInvitesActionError(toErrorMessage(e)))
      .finally(() => setInvitesActionId(null));
  };

  const openInvites = () => {
    setShowInvites(true);
    loadInvites().catch(() => undefined);
  };

  const pendingIncoming = incoming.filter((i) => i.status === 'pending').length;

  if (showInvites) {
    return (
      <InvitesScreen
        incoming={incoming}
        outgoing={outgoing}
        dir={invitesDir}
        onDirChange={setInvitesDir}
        loading={invitesLoading}
        error={invitesError}
        actionId={invitesActionId}
        actionError={invitesActionError}
        onRefresh={() => loadInvites().catch(() => undefined)}
        onAccept={(id) => mutateInvite(id, acceptInvite, 'Undangan diterima — chat terbuka otomatis saat kamu buka tab Chat.')}
        onDecline={(id) => mutateInvite(id, declineInvite, 'Undangan ditolak.')}
        onBack={() => setShowInvites(false)}
      />
    );
  }

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
      onInvite={handleInvite}
      onChat={handleChat}
      onBellPress={onOpenNotifications}
      invitingId={invitingId}
      onOpenInvites={openInvites}
      pendingInvites={pendingIncoming}
    />
  );
}

function Gate() {
  const { user, initializing, loading, error, login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  // UX-02: email dipertahankan saat ganti mode Masuk/Daftar.
  const [email, setEmail] = useState('');

  if (initializing) {
    return (
      <View style={styles.gate}>
        <View style={styles.heroMini} accessibilityLabel="Memuat KawanSport">
          <Image source={K_LOGO} style={styles.splashLogo} accessibilityLabel="Logo KawanSport" />
          <Text style={styles.heroName}>KawanSport</Text>
          <Text style={styles.heroSlogan}>Main bareng, naik level</Text>
        </View>
        <View style={styles.splashSpin}>
          <ActivityIndicator size="small" color={COLORS.brand700} accessibilityLabel="Memuat" />
          <Text style={styles.splashSpinText}>Menyiapkan arena…</Text>
        </View>
      </View>
    );
  }

  if (user) return <LoggedIn />;

  const noop = () => undefined;
  return (
    <ScrollView style={styles.gateScroll} contentContainerStyle={styles.gate} keyboardShouldPersistTaps="handled">
      <View style={styles.hero} accessibilityRole="header">
        <Image source={K_LOGO} style={styles.heroLogo} accessibilityLabel="Logo KawanSport" />
        <Text style={styles.heroName}>KawanSport</Text>
        <Text style={styles.heroSlogan}>Cari sparing, booking lapangan, kawan main.</Text>
      </View>

      <View style={styles.formCard}>
        <UIErrorBanner message={friendlyServerError(error)} />
        {mode === 'login' ? (
          <LoginScreen
            loading={loading}
            serverError={null}
            onSubmit={(em, password) => login(em, password).catch(noop)}
            onSwitch={() => setMode('register')}
            initialEmail={email}
            onEmailChange={setEmail}
          />
        ) : (
          <RegisterScreen
            loading={loading}
            serverError={null}
            onSubmit={(em, password, displayName) =>
              register(em, password, displayName).catch(noop)
            }
            onSwitch={() => setMode('login')}
            initialEmail={email}
            onEmailChange={setEmail}
          />
        )}
      </View>
      <Text style={styles.gateFoot}>
        {mode === 'login' ? 'Belum punya akun? Tekan Daftar di bawah form.' : 'Sudah punya akun? Tekan Masuk di bawah form.'}
      </Text>
    </ScrollView>
  );
}

function App(): React.JSX.Element {
  return (
    <AuthProvider>
      {/*
        Latar navy di balik SafeAreaView: inset atas (status bar) menyatu
        dengan header navy + StatusBar light agar ikon sistem terbaca.
        Inset bawah tetap putih mengikuti container konten. Tanpa dep baru.
      */}
      <View style={styles.rootTop}>
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
          <Gate />
        </SafeAreaView>
      </View>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  // Inset status-bar navy agar menyatu header; konten di container putih.
  rootTop: { flex: 1, backgroundColor: COLORS.navy },
  container: { flex: 1, backgroundColor: COLORS.bg },
  flowWrap: { flex: 1 },
  screenWrap: { flex: 1, backgroundColor: COLORS.bg },
  padded: { paddingHorizontal: SPACING.screen, paddingTop: SPACING.screen },
  bodyFlex: { flex: 1 },
  bodyPad: { paddingHorizontal: SPACING.screen, paddingBottom: SPACING.screen },
  gap: { height: SPACING.md },
  // Gate
  gateScroll: { flex: 1, backgroundColor: COLORS.bg },
  gate: { padding: SPACING.screen },
  hero: { alignItems: 'center', marginBottom: SPACING.lg },
  heroMini: { alignItems: 'center', marginBottom: SPACING.xl },
  splashLogo: {
    width: 76,
    height: 76,
    borderRadius: 22,
    marginBottom: SPACING.sm,
  },
  heroLogo: {
    width: 64,
    height: 64,
    borderRadius: 18,
    marginBottom: SPACING.sm,
  },
  splashSpin: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  splashSpinText: { fontSize: 13, color: COLORS.muted, marginLeft: SPACING.sm },
  heroName: { ...TYPO.display, color: COLORS.ink },
  heroSlogan: { fontSize: 14, color: COLORS.muted, marginTop: SPACING.xs, textAlign: 'center' },
  formCard: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
  gateFoot: { fontSize: 13, color: COLORS.faint, textAlign: 'center', marginTop: SPACING.lg },
  // Profile
  profileTop: { flexDirection: 'row', alignItems: 'center' },
  profileHead: { flex: 1, marginLeft: SPACING.md },
  profileName: { fontSize: 18, fontWeight: '800', color: COLORS.ink },
  profileEmail: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  badgeRow: { flexDirection: 'row', marginTop: SPACING.sm },
  sportsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: SPACING.md },
  miniChip: {
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bgAlt,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    marginRight: SPACING.sm,
    marginTop: SPACING.sm,
  },
  miniChipText: { fontSize: 12, fontWeight: '600', color: COLORS.muted },
  profileEmpty: { fontSize: 13, color: COLORS.faint, marginTop: SPACING.md },
  profileLoc: { fontSize: 14, color: COLORS.ink, fontWeight: '600', marginTop: SPACING.md },
  deleteWarn: { fontSize: 14, color: COLORS.ink, lineHeight: 21, marginBottom: SPACING.sm },
  previewName: { fontSize: 16, fontWeight: '700', color: COLORS.ink },
  previewSub: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  // BottomTabs
  tabs: { flex: 1, backgroundColor: COLORS.bg },
  tabBody: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    backgroundColor: COLORS.bg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  tabItem: { flex: 1, alignItems: 'center', minHeight: 56, justifyContent: 'center' },
  tabItemActive: {},
  tabIconWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center', minHeight: 36 },
  tabIcon: { fontSize: 22 },
  tabLabel: { fontSize: 11, fontWeight: '600', color: COLORS.faint, marginTop: 2 },
  tabLabelActive: { color: COLORS.brand700, fontWeight: '800' },
  tabIndicator: { height: 3, width: 24, borderRadius: 2, backgroundColor: COLORS.lime, marginTop: 4 },
  tabBadge: {
    position: 'absolute',
    top: -2,
    right: -14,
    backgroundColor: COLORS.danger,
    borderRadius: RADIUS.full,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: { color: COLORS.bg, fontSize: 11, fontWeight: '800' },
});

export default App;
