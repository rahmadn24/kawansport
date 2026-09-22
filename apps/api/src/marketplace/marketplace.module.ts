import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsModule } from '../bookings/bookings.module';
import { ChangeRequestsModule } from '../change-requests/change-requests.module';
import { UsersModule } from '../users/users.module';
import { CartController } from './cart.controller';
import { Cart, CartItem } from './cart.entity';
import { CartService } from './cart.service';
import {
  CheckoutController,
  OrdersController,
} from './orders.controller';
import { OrdersService } from './orders.service';
import { Product } from './product.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { Seller } from './seller.entity';
import { SellersController } from './sellers.controller';
import { SellersService } from './sellers.service';
import {
  ShopOrder,
  ShopOrderGroup,
  ShopOrderItem,
} from './shop-order.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Seller,
      Product,
      Cart,
      CartItem,
      ShopOrder,
      ShopOrderGroup,
      ShopOrderItem,
    ]),
    UsersModule,
    ChangeRequestsModule,
    // Reuse MidtransService BK-03 (Snap + verify signature) — tanpa
    // duplikasi logika (OrdersService memakai instance yang sama).
    BookingsModule,
  ],
  controllers: [
    SellersController,
    ProductsController,
    CartController,
    CheckoutController,
    OrdersController,
  ],
  providers: [SellersService, ProductsService, CartService, OrdersService],
  exports: [SellersService, ProductsService, CartService, OrdersService],
})
export class MarketplaceModule {}
