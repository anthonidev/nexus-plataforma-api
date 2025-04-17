import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  Logger,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { User } from 'src/user/entities/user.entity';
import { Public } from 'src/auth/decorators/is-public.decorator';
import { UserTreeService } from '../services/user-tree.service';

@Controller('users/tree')
export class UserTreeController {
  private readonly logger = new Logger(UserTreeController.name);
  constructor(private readonly userTreeService: UserTreeService) {}

  // @Public()
  // @Get('statistics')
  // async getTreeStatistics() {
  //   return this.userTreeService.getTreeStatistics();
  // }
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

  @UseGuards(JwtAuthGuard)
  @Get('node/:nodeId')
  async getNodeWithContext(
    @Param('nodeId') nodeId: string,
    @Query('descendantDepth', new ParseIntPipe({ optional: true }))
    descendantDepth: number = 3,
    @Query('ancestorDepth', new ParseIntPipe({ optional: true }))
    ancestorDepth: number = 3,
    @GetUser() currentUser: User,
  ) {
    const startTime = Date.now();

    const hasAccess = await this.userTreeService.checkUserAccess(
      currentUser.id,
      nodeId,
    );

    if (!hasAccess) {
      throw new ForbiddenException('No tienes permiso para ver este nodo');
    }

    const nodeContext = await this.userTreeService.getNodeWithContext(
      nodeId,
      descendantDepth,
      ancestorDepth,
      currentUser.id,
    );

    const duration = Date.now() - startTime;

    this.logger.log(
      `Contexto de nodo generado en ${duration}ms (profundidad descendientes: ${descendantDepth}, profundidad ancestros: ${ancestorDepth})`,
    );

    return {
      ...nodeContext,
      metadata: {
        queryDurationMs: duration,
        requestedNodeId: nodeId,
        descendantDepth,
        ancestorDepth,
      },
    };
  }
}
