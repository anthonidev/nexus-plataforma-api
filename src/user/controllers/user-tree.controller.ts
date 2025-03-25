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

  /**
   * Nuevo endpoint para obtener un nodo específico con sus ancestros y descendientes
   */
  @Public()
  @Get('node/:nodeId')
  async getNodeWithContext(
    @Param('nodeId') nodeId: string,
    @Query('descendantDepth', new ParseIntPipe({ optional: true }))
    descendantDepth: number = 3,
    @Query('ancestorDepth', new ParseIntPipe({ optional: true }))
    ancestorDepth: number = 3,
  ) {
    const startTime = Date.now();

    // Obtener información del nodo con sus ancestros y descendientes
    const nodeContext = await this.userTreeService.getNodeWithContext(
      nodeId,
      descendantDepth,
      ancestorDepth,
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
