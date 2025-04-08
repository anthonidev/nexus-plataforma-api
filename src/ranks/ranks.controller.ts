import { Controller } from '@nestjs/common';
import { RanksService } from './ranks.service';

@Controller('ranks')
export class RanksController {
  constructor(private readonly ranksService: RanksService) {}
}
