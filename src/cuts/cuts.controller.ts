import { Controller } from '@nestjs/common';
import { CutsService } from './cuts.service';

@Controller('cuts')
export class CutsController {
  constructor(private readonly cutsService: CutsService) {}
}
