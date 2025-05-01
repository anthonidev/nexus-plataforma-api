import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CutConfiguration } from './entities/cut_configurations.entity';
import { CutExecutionLog } from './entities/cut_execution_logs.entity';
import { CutExecution } from './entities/cut_executions.entity';
import { CutsController } from './controllers/cuts.controller';
import { CutsService } from './services/cuts.service';
import { WeeklyVolumeService } from './services/weekly-volume.service';
import { ScheduledTasksService } from './services/scheduled-tasks.service';
import { MembershipsModule } from 'src/memberships/memberships.module';
import { PointsModule } from 'src/points/points.module';
import { MonthlyVolumeService } from './services/monthly-volume.service';
import { RanksModule } from 'src/ranks/ranks.module';
import { ScheduleModule } from '@nestjs/schedule';
import { MailModule } from 'src/mail/mail.module';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  controllers: [CutsController],
  providers: [
    CutsService,
    WeeklyVolumeService,
    MonthlyVolumeService,
    ScheduledTasksService,
  ],
  imports: [
    TypeOrmModule.forFeature([CutConfiguration, CutExecutionLog, CutExecution]),
    MembershipsModule,
    PointsModule,
    RanksModule,
    ScheduleModule,
    MailModule,
    NotificationsModule,

  ],
  exports: [
    CutsService,
    WeeklyVolumeService,
    TypeOrmModule,
    ScheduledTasksService,
  ],
})
export class CutsModule { }
