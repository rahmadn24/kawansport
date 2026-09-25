import { Controller, Get, Query } from '@nestjs/common';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly service: SearchService) {}

  /**
   * Pencarian gabungan (ST-09, PUBLIK tanpa auth — keputusan: sama
   * seperti `GET /venues` + `GET /products` yang publik).
   * Venue approved + event + produk approved; substring case-insensitive;
   * geo opsional → `distanceMeters` + sort jarak, else sort abjad.
   */
  @Get()
  search(@Query() query: SearchQueryDto) {
    return this.service.search(query);
  }
}
