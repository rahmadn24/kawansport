import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Court } from '../venues/court.entity';
import { Venue } from '../venues/venue.entity';
import { Product } from '../marketplace/product.entity';
import { UsersModule } from '../users/users.module';
import { ChangeRequest } from './change-request.entity';
import { ChangeRequestsController } from './change-requests.controller';
import { ChangeRequestsService } from './change-requests.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChangeRequest, Venue, Court, Product]),
    UsersModule,
  ],
  controllers: [ChangeRequestsController],
  providers: [ChangeRequestsService],
  exports: [ChangeRequestsService],
})
export class ChangeRequestsModule {}
