import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  Logger,
} from '@nestjs/common';
import { Public } from 'src/auth/decorators/is-public.decorator';
import { UserTreeService } from '../services/user-tree.service';

@Controller('users/tree')
export class UserTreeController {
  private readonly logger = new Logger(UserTreeController.name);
  constructor(private readonly userTreeService: UserTreeService) {}

  @Public()
  @Get('master')
  async getMasterUser() {
    const masterUser = await this.userTreeService.findMasterUser();
    return {
      id: masterUser.id,
      email: masterUser.email,
      referralCode: masterUser.referralCode,
    };
  }

  @Public()
  @Get('statistics')
  async getTreeStatistics() {
    return this.userTreeService.getTreeStatistics();
  }

  @Public()
  @Get(':userId')
  async getUserTree(
    @Param('userId') userId: string,
    @Query('depth', new ParseIntPipe({ optional: true })) depth: number = 3,
  ) {
    const startTime = Date.now();
    const tree = await this.userTreeService.getUserTree(userId, depth);
    const duration = Date.now() - startTime;

    this.logger.log(`Árbol generado en ${duration}ms (profundidad: ${depth})`);

    return {
      tree,
      metadata: {
        queryDurationMs: duration,
        requestedDepth: depth,
        rootUserId: userId,
      },
    };
  }
}
