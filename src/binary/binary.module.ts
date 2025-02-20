import { Module } from '@nestjs/common';
import { BinaryService } from './binary.service';
import { BinaryController } from './binary.controller';

@Module({
  controllers: [BinaryController],
  providers: [BinaryService],
})
export class BinaryModule {}
