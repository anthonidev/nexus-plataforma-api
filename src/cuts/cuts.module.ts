import { Module } from '@nestjs/common';
import { CutsService } from './cuts.service';
import { CutsController } from './cuts.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CutConfiguration } from './entities/cut_configurations.entity';
import { CutExecutionLog } from './entities/cut_execution_logs.entity';
import { CutExecution } from './entities/cut_executions.entity';

@Module({
  controllers: [CutsController],
  providers: [CutsService],
  imports: [
    TypeOrmModule.forFeature([CutConfiguration, CutExecutionLog, CutExecution]),
  ],
  exports: [CutsService, TypeOrmModule],
})
export class CutsModule {}
