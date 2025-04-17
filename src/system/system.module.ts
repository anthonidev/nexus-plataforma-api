import { Module } from '@nestjs/common';
import { SystemController } from './controllers/system.controller';
import { SystemService } from './services/system.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from 'src/user/user.module';
import { MembershipsModule } from 'src/memberships/memberships.module';
import { RanksModule } from 'src/ranks/ranks.module';
import { PointsModule } from 'src/points/points.module';

@Module({
  controllers: [SystemController],
  providers: [SystemService],
  exports: [SystemService],
  imports: [
    TypeOrmModule,
    UserModule,
    MembershipsModule,
    RanksModule,
    PointsModule,
  ],
})
export class SystemModule {}
