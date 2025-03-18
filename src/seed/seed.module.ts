import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedController } from './seed.controller';
import { SeedService } from './seed.service';
import { View } from 'src/user/entities/view.entity';
import { Role } from 'src/user/entities/roles.entity';
import { UserModule } from 'src/user/user.module';
@Module({
  imports: [TypeOrmModule.forFeature([View, Role]), UserModule],
  controllers: [SeedController],
  providers: [SeedService],
})
export class SeedModule {}
