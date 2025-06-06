import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipsModule } from 'src/memberships/memberships.module';
import { FixController } from './fix.controller';
import { FixService } from './fix.service';

@Module({
  controllers: [FixController],
  providers: [FixService],
  imports: [TypeOrmModule, MembershipsModule],
})
export class FixModule {}
