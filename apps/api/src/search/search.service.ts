import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SportEvent } from '../events/event.entity';
import { Product } from '../marketplace/product.entity';
import { Venue } from '../venues/venue.entity';
import { haversineMeters } from '../venues/venues.service';
import { SearchQueryDto } from './dto/search-query.dto';

export type SearchKind = 'venue' | 'event' | 'product';

export interface SearchItem {
  kind: SearchKind;
  id: string;
  title: string;
  /** Baris kedua jujur: alamat venue / "sport • host" / "kategori • harga". */
  subtitle: string | null;
  /** Meter dari titik query; hanya ada saat filter lat/lng dipakai dan item berkoordinat. */
  distanceMeters?: number;
}

const DEFAULT_RADIUS_M = 10000;
const DEFAULT_LIMIT = 20;

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Venue)
    private readonly venues: Repository<Venue>,
    @InjectRepository(SportEvent)
    private readonly events: Repository<SportEvent>,
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
  ) {}

  /**
   * GET /search — gabungan venue (approved saja) + event (semua) +
   * produk (approved saja). Publik tanpa auth (keputusan ST-09: sama
   * seperti `GET /venues` dan `GET /products` yang publik).
   */
  async search(query: SearchQueryDto): Promise<{
    data: SearchItem[];
    meta: { total: number; limit: number };
  }> {
    const useGeo = query.lat !== undefined || query.lng !== undefined;
    if ((query.lat === undefined) !== (query.lng === undefined)) {
      throw new BadRequestException('lat and lng must be provided together');
    }
    const limit = query.limit ?? DEFAULT_LIMIT;
    const radius = query.radius ?? DEFAULT_RADIUS_M;
    const q = query.q?.trim().toLowerCase() || null;

    const [venues, events, products] = await Promise.all([
      this.venues.find({ where: { status: 'approved' } }),
      this.events.find({ relations: { host: true } }),
      this.products.find({ where: { status: 'approved' } }),
    ]);

    const items: SearchItem[] = [];

    for (const v of venues) {
      const hay = `${v.name}\n${v.address}\n${(v.sports ?? []).join(' ')}`.toLowerCase();
      if (q && !hay.includes(q)) continue;
      const geo = useGeo
        ? haversineMeters(query.lat as number, query.lng as number, v.lat, v.lng)
        : null;
      if (geo !== null && geo > radius) continue;
      items.push({
        kind: 'venue',
        id: v.id,
        title: v.name,
        subtitle: v.address ?? null,
        ...(geo !== null ? { distanceMeters: Math.round(geo) } : {}),
      });
    }

    for (const e of events) {
      const hay = `${e.title}\n${e.sport}\n${e.description ?? ''}`.toLowerCase();
      if (q && !hay.includes(q)) continue;
      const geo = useGeo
        ? haversineMeters(query.lat as number, query.lng as number, e.lat, e.lng)
        : null;
      if (geo !== null && geo > radius) continue;
      const hostName = e.host?.displayName || e.host?.email || null;
      items.push({
        kind: 'event',
        id: e.id,
        title: e.title,
        subtitle: hostName ? `${e.sport} • ${hostName}` : e.sport,
        ...(geo !== null ? { distanceMeters: Math.round(geo) } : {}),
      });
    }

    for (const p of products) {
      const hay = `${p.name}\n${p.description ?? ''}`.toLowerCase();
      if (q && !hay.includes(q)) continue;
      // Produk tak punya koordinat: selalu ikut (tanpa distanceMeters),
      // diurut abjad di belakang hasil geo (didokumentasikan di ENDPOINTS).
      items.push({
        kind: 'product',
        id: p.id,
        title: p.name,
        subtitle: `${p.category} • Rp${p.price.toLocaleString('id-ID')}`,
      });
    }

    if (useGeo) {
      items.sort((a, b) => {
        const da = a.distanceMeters ?? Number.POSITIVE_INFINITY;
        const db = b.distanceMeters ?? Number.POSITIVE_INFINITY;
        if (da !== db) return da - db;
        return a.title.localeCompare(b.title);
      });
    } else {
      items.sort((a, b) => a.title.localeCompare(b.title));
    }

    const sliced = items.slice(0, limit);
    return { data: sliced, meta: { total: items.length, limit } };
  }
}
