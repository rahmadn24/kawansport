import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Court } from '../venues/court.entity';
import { Venue } from '../venues/venue.entity';
import { Rating } from './rating.entity';
import { Review } from './review.entity';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';
import { User } from '../users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Rating, Review, Venue, Court, User])],
  controllers: [RatingsController],
  providers: [RatingsService],
  exports: [RatingsService],
})
export class RatingsModule {}