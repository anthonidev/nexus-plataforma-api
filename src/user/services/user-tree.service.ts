import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/user/entities/user.entity';
import { NodeContext, TreeNode } from '../interface/tree-node.interface';
import { FlatUser } from '../interface/flat-user.interface';

@Injectable()
export class UserTreeService {
  private readonly logger = new Logger(UserTreeService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getUserTree(userId: string, maxDepth: number = 3): Promise<TreeNode> {
    try {
      return await this.getUserTreeOptimized(userId, maxDepth);
    } catch (error) {
      this.logger.warn(
        `Error al obtener árbol optimizado: ${error.message}. Usando método alternativo.`,
      );

      const rootUser = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['personalInfo', 'leftChild', 'rightChild'],
      });

      if (!rootUser) {
        throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
      }

      return this.buildTreeNode(rootUser, 0, maxDepth);
    }
  }

  async checkUserAccess(userId: string, nodeId: string): Promise<boolean> {
    try {
      if (userId === nodeId) {
        return true;
      }

      const currentUser = await this.userRepository.findOne({
        where: { id: userId },
        select: ['id', 'parent', 'leftChild', 'rightChild'],
      });

      if (!currentUser) {
        return false;
      }

      return this.isDescendant(userId, nodeId);
    } catch (error) {
      this.logger.error(`Error al verificar acceso: ${error.message}`);
      return false;
    }
  }

  private async isDescendant(ancestorId: string, descendantId: string): Promise<boolean> {
    const query = `
      WITH RECURSIVE user_tree AS (
        SELECT id, parent_id, left_child_id, right_child_id
        FROM users
        WHERE id = $1
        UNION ALL
        SELECT u.id, u.parent_id, u.left_child_id, u.right_child_id
        FROM users u
        JOIN user_tree ut ON ut.left_child_id = u.id OR ut.right_child_id = u.id
      )
      SELECT EXISTS (
        SELECT 1 FROM user_tree WHERE id = $2
      ) as is_descendant;
    `;

    const result = await this.userRepository.query(query, [ancestorId, descendantId]);
    return result[0]?.is_descendant === true;
  }

  private async isAncestor(descendantId: string, ancestorId: string): Promise<boolean> {
    return this.isDescendant(ancestorId, descendantId);
  }

  async getNodeWithContext(
    nodeId: string,
    descendantDepth: number = 3,
    ancestorDepth: number = 3,
    currentUserId: string,
  ): Promise<NodeContext> {
    const nodeExists = await this.userRepository.findOne({
      where: { id: nodeId },
      select: ['id'],
    });

    if (!nodeExists) {
      throw new NotFoundException(`Usuario con ID ${nodeId} no encontrado`);
    }

    const usersToFetch = new Set<string>([nodeId]);
    const fetchedUsers = new Map<string, FlatUser>();

    const query = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.personalInfo', 'personalInfo')
      .leftJoin('user.leftChild', 'leftChild')
      .leftJoin('user.rightChild', 'rightChild')
      .leftJoin('user.parent', 'parent')
      .select([
        'user.id',
        'user.email',
        'user.referralCode',
        'user.position',
        'user.isActive',
        'personalInfo.firstName',
        'personalInfo.lastName',
        'leftChild.id',
        'rightChild.id',
        'parent.id',
      ]);

    const currentNode = await query
      .where('user.id = :nodeId', { nodeId })
      .getOne();

    if (!currentNode) {
      throw new NotFoundException(`Error al obtener el nodo ${nodeId}`);
    }

    fetchedUsers.set(currentNode.id, this.mapUserToFlatUser(currentNode));

    // Primero verificamos que el usuario actual sea un ancestro válido en la jerarquía
    // Solo queremos mostrar ancestros que sean descendientes del usuario logueado
    const isCurrentUserAncestorOfNode = await this.isDescendant(currentUserId, nodeId);
    const isCurrentUserParentOfNode = await this.userRepository.findOne({
      where: { id: nodeId, parent: { id: currentUserId } }
    });
    
    const currentUserIsInAncestorPath = isCurrentUserAncestorOfNode || isCurrentUserParentOfNode;

    if (!currentUserIsInAncestorPath) {
      // Si el usuario actual no es un ancestro válido del nodo solicitado,
      // no hay ancestros que mostrar porque podría exponer la estructura superior
      const nodeTree = this.buildOptimizedTreeNode(
        nodeId,
        fetchedUsers,
        0,
        descendantDepth,
      );

      return {
        node: nodeTree,
        ancestors: [],
        siblings: undefined,
      };
    }
    
    // Recopilar IDs de ancestros, pero solo hasta el usuario autenticado
    let currentAncestor = currentNode.parent;
    const ancestorIds: string[] = [];

    // Añadir ancestros a la lista de IDs a buscar, limitando hasta el usuario actual
    while (currentAncestor && ancestorIds.length < ancestorDepth) {
      // Obtener el siguiente ancestro
      const ancestor = await query
        .where('user.id = :ancestorId', { ancestorId: currentAncestor.id })
        .getOne();

      if (!ancestor) break;

      // Si llegamos al usuario actual, detenemos la recopilación
      if (ancestor.id === currentUserId) {
        break;
      }
      
      // Verificar si este ancestro es descendiente del usuario logueado
      const isDescendantOfCurrentUser = await this.isDescendant(currentUserId, ancestor.id);
      if (!isDescendantOfCurrentUser && ancestor.id !== currentUserId) {
        // Si no es descendiente ni es el propio usuario, no lo incluimos
        break;
      }
      
      // Solo añadimos el ancestro si pasa las verificaciones anteriores
      ancestorIds.push(ancestor.id);
      usersToFetch.add(ancestor.id);
      fetchedUsers.set(ancestor.id, this.mapUserToFlatUser(ancestor));
      
      currentAncestor = ancestor.parent;
    }

    const descendantIdsToProcess = new Set<string>([nodeId]);

    for (let depth = 0; depth < descendantDepth; depth++) {
      if (descendantIdsToProcess.size === 0) break;

      this.logger.debug(
        `Procesando descendientes a profundidad ${depth}, nodos: ${Array.from(descendantIdsToProcess).join(', ')}`,
      );

      const userIds = Array.from(descendantIdsToProcess);
      descendantIdsToProcess.clear();

      const users = await this.userRepository
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.personalInfo', 'personalInfo')
        .leftJoinAndSelect('user.leftChild', 'leftChild') 
        .leftJoinAndSelect('user.rightChild', 'rightChild') 
        .leftJoinAndSelect('leftChild.personalInfo', 'leftChildInfo')
        .leftJoinAndSelect('rightChild.personalInfo', 'rightChildInfo')
        .where('user.id IN (:...userIds)', { userIds })
        .getMany();

      for (const user of users) {
        const flatUser = {
          id: user.id,
          email: user.email,
          referralCode: user.referralCode,
          position: user.position,
          isActive: user.isActive,
          firstName: user.personalInfo?.firstName,
          lastName: user.personalInfo?.lastName,
          leftChildId: user.leftChild?.id,
          rightChildId: user.rightChild?.id,
          parentId: user.parent?.id,
        };

        fetchedUsers.set(user.id, flatUser);

        this.logger.debug(
          `Usuario ${user.id}: lefthild=${user.leftChild?.id}, rightChild=${user.rightChild?.id}`,
        );

        if (user.leftChild) {
          const leftChild = {
            id: user.leftChild.id,
            email: user.leftChild.email,
            referralCode: user.leftChild.referralCode,
            position: user.leftChild.position,
            isActive: user.leftChild.isActive,
            firstName: user.leftChild.personalInfo?.firstName,
            lastName: user.leftChild.personalInfo?.lastName,
            leftChildId: undefined,
            rightChildId: undefined,
            parentId: user.id,
          };

          fetchedUsers.set(user.leftChild.id, leftChild);
          descendantIdsToProcess.add(user.leftChild.id);
        }

        if (user.rightChild) {
          const rightChild = {
            id: user.rightChild.id,
            email: user.rightChild.email,
            referralCode: user.rightChild.referralCode,
            position: user.rightChild.position,
            isActive: user.rightChild.isActive,
            firstName: user.rightChild.personalInfo?.firstName,
            lastName: user.rightChild.personalInfo?.lastName,
            leftChildId: undefined,
            rightChildId: undefined,
            parentId: user.id,
          };

          fetchedUsers.set(user.rightChild.id, rightChild);
          descendantIdsToProcess.add(user.rightChild.id);
        }
      }
    }

    const currentUser = fetchedUsers.get(nodeId);

    if (currentUser.leftChildId) {
      this.logger.debug(
        `El nodo ${nodeId} tiene hijo izquierdo: ${currentUser.leftChildId}`,
      );
      if (!fetchedUsers.has(currentUser.leftChildId)) {
        const leftChild = await query
          .where('user.id = :childId', { childId: currentUser.leftChildId })
          .getOne();

        if (leftChild) {
          fetchedUsers.set(leftChild.id, this.mapUserToFlatUser(leftChild));
          if (descendantDepth > 1) descendantIdsToProcess.add(leftChild.id);
        }
      }
    }

    if (currentUser.rightChildId) {
      this.logger.debug(
        `El nodo ${nodeId} tiene hijo derecho: ${currentUser.rightChildId}`,
      );
      if (!fetchedUsers.has(currentUser.rightChildId)) {
        const rightChild = await query
          .where('user.id = :childId', { childId: currentUser.rightChildId })
          .getOne();

        if (rightChild) {
          fetchedUsers.set(rightChild.id, this.mapUserToFlatUser(rightChild));
          if (descendantDepth > 1) descendantIdsToProcess.add(rightChild.id);
        }
      }
    }

    const nodeTree = this.buildOptimizedTreeNode(
      nodeId,
      fetchedUsers,
      0,
      descendantDepth,
    );

    const ancestors: TreeNode[] = ancestorIds.map((ancestorId, index) => {
      const user = fetchedUsers.get(ancestorId);
      return {
        id: user.id,
        email: user.email,
        referralCode: user.referralCode,
        position: user.position,
        isActive: user.isActive,
        fullName:
          user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : undefined,
        depth: index,
      };
    });

    const siblings = {};
    if (currentNode.parent) {
      const parent = fetchedUsers.get(currentNode.parent.id);
      if (parent) {
        if (parent.leftChildId && parent.leftChildId !== nodeId) {
          const leftSibling = fetchedUsers.get(parent.leftChildId);
          if (leftSibling) {
            siblings['left'] = {
              id: leftSibling.id,
              email: leftSibling.email,
              referralCode: leftSibling.referralCode,
            };
          }
        }

        if (parent.rightChildId && parent.rightChildId !== nodeId) {
          const rightSibling = fetchedUsers.get(parent.rightChildId);
          if (rightSibling) {
            siblings['right'] = {
              id: rightSibling.id,
              email: rightSibling.email,
              referralCode: rightSibling.referralCode,
            };
          }
        }
      }
    }

    if (!currentUserIsInAncestorPath) {
      // Ya retornamos antes si el usuario no está en la jerarquía
      return {
        node: nodeTree,
        ancestors: [],
        siblings: Object.keys(siblings).length > 0 ? siblings : undefined,
      };
    }
    
    return {
      node: nodeTree,
      ancestors,
      siblings: Object.keys(siblings).length > 0 ? siblings : undefined,
    };
  }

  private mapUserToFlatUser(user: any): FlatUser {
    return {
      id: user.id,
      email: user.email,
      referralCode: user.referralCode,
      position: user.position,
      isActive: user.isActive,
      firstName: user.personalInfo?.firstName,
      lastName: user.personalInfo?.lastName,
      leftChildId: user.leftChild?.id,
      rightChildId: user.rightChild?.id,
      parentId: user.parent?.id,
    };
  }

  async getUserTreeOptimized(
    userId: string,
    maxDepth: number = 3,
  ): Promise<TreeNode> {
    const rootExists = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id'],
    });

    if (!rootExists) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    const query = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.personalInfo', 'personalInfo')
      .leftJoin('user.leftChild', 'leftChild')
      .leftJoin('user.rightChild', 'rightChild')
      .leftJoin('user.parent', 'parent')
      .select([
        'user.id',
        'user.email',
        'user.referralCode',
        'user.position',
        'user.isActive',
        'personalInfo.firstName',
        'personalInfo.lastName',
        'leftChild.id',
        'rightChild.id',
        'parent.id',
      ]);

    const usersToFetch = new Set<string>([userId]);
    const fetchedUsers = new Map<string, FlatUser>();

    for (let depth = 0; depth <= maxDepth; depth++) {
      if (usersToFetch.size === 0) break;

      const userIds = Array.from(usersToFetch);
      usersToFetch.clear();

      const users = await query
        .andWhere('user.id IN (:...userIds)', { userIds })
        .getMany();

      for (const user of users) {
        fetchedUsers.set(user.id, this.mapUserToFlatUser(user));

        if (depth < maxDepth) {
          if (user.leftChild?.id) usersToFetch.add(user.leftChild.id);
          if (user.rightChild?.id) usersToFetch.add(user.rightChild.id);
        }
      }
    }

    if (!fetchedUsers.has(userId)) {
      throw new Error(
        'Error al construir el árbol: no se pudo obtener el nodo raíz',
      );
    }

    return this.buildOptimizedTreeNode(userId, fetchedUsers, 0, maxDepth);
  }

  private buildOptimizedTreeNode(
    userId: string,
    userMap: Map<string, FlatUser>,
    currentDepth: number,
    maxDepth: number,
  ): TreeNode {
    const user = userMap.get(userId);

    if (!user) {
      this.logger.warn(
        `No se encontró el usuario ${userId} en el mapa de usuarios`,
      );
      return null;
    }

    if (currentDepth >= maxDepth) {
      return {
        id: user.id,
        email: user.email,
        referralCode: user.referralCode,
        position: user.position,
        isActive: user.isActive,
        fullName:
          user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : undefined,
        depth: currentDepth,
      };
    }

    this.logger.debug(
      `Construyendo nodo ${userId} (profundidad ${currentDepth}), hijos izq: ${user.leftChildId}, der: ${user.rightChildId}`,
    );

    const treeNode: TreeNode = {
      id: user.id,
      email: user.email,
      referralCode: user.referralCode,
      position: user.position,
      isActive: user.isActive,
      fullName:
        user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`
          : undefined,
      depth: currentDepth,
      children: {},
    };

    if (user.leftChildId) {
      if (userMap.has(user.leftChildId)) {
        treeNode.children.left = this.buildOptimizedTreeNode(
          user.leftChildId,
          userMap,
          currentDepth + 1,
          maxDepth,
        );
      } else {
        this.logger.warn(
          `Hijo izquierdo ${user.leftChildId} del nodo ${userId} no encontrado en el mapa`,
        );
      }
    }

    if (user.rightChildId) {
      if (userMap.has(user.rightChildId)) {
        treeNode.children.right = this.buildOptimizedTreeNode(
          user.rightChildId,
          userMap,
          currentDepth + 1,
          maxDepth,
        );
      } else {
        this.logger.warn(
          `Hijo derecho ${user.rightChildId} del nodo ${userId} no encontrado en el mapa`,
        );
      }
    }

    if (!treeNode.children.left && !treeNode.children.right) {
      this.logger.debug(
        `Nodo ${userId} no tiene hijos en el mapa. Verificando si realmente no tiene hijos.`,
      );
    }

    return treeNode;
  }

  private async buildTreeNode(
    user: User,
    currentDepth: number,
    maxDepth: number,
  ): Promise<TreeNode> {
    if (currentDepth >= maxDepth) {
      return {
        id: user.id,
        email: user.email,
        referralCode: user.referralCode,
        position: user.position,
        isActive: user.isActive,
        fullName: user.personalInfo
          ? `${user.personalInfo.firstName} ${user.personalInfo.lastName}`
          : undefined,
        depth: currentDepth,
      };
    }

    if (!user.email) {
      user = await this.userRepository.findOne({
        where: { id: user.id },
        relations: ['personalInfo', 'leftChild', 'rightChild'],
      });
    }

    const leftChildId = user.leftChild?.id;
    const rightChildId = user.rightChild?.id;

    let leftChild = null;
    let rightChild = null;

    if (leftChildId) {
      leftChild = await this.userRepository.findOne({
        where: { id: leftChildId },
        relations: ['personalInfo'],
      });
    }

    if (rightChildId) {
      rightChild = await this.userRepository.findOne({
        where: { id: rightChildId },
        relations: ['personalInfo'],
      });
    }

    const treeNode: TreeNode = {
      id: user.id,
      email: user.email,
      referralCode: user.referralCode,
      position: user.position,
      isActive: user.isActive,
      fullName: user.personalInfo
        ? `${user.personalInfo.firstName} ${user.personalInfo.lastName}`
        : undefined,
      depth: currentDepth,
      children: {},
    };

    if (leftChild) {
      treeNode.children.left = await this.buildTreeNode(
        leftChild,
        currentDepth + 1,
        maxDepth,
      );
    }

    if (rightChild) {
      treeNode.children.right = await this.buildTreeNode(
        rightChild,
        currentDepth + 1,
        maxDepth,
      );
    }

    return treeNode;
  }

  async getTreeStatistics(): Promise<any> {
    const totalUsers = await this.userRepository.count();
    const activeUsers = await this.userRepository.count({
      where: { isActive: true },
    });

    const leafUsers = await this.userRepository
      .createQueryBuilder('user')
      .leftJoin('user.leftChild', 'leftChild')
      .leftJoin('user.rightChild', 'rightChild')
      .where('leftChild.id IS NULL AND rightChild.id IS NULL')
      .getCount();

    const singleChildUsers = await this.userRepository
      .createQueryBuilder('user')
      .leftJoin('user.leftChild', 'leftChild')
      .leftJoin('user.rightChild', 'rightChild')
      .where(
        '(leftChild.id IS NULL AND rightChild.id IS NOT NULL) OR (leftChild.id IS NOT NULL AND rightChild.id IS NULL)',
      )
      .getCount();

    const fullUsers = await this.userRepository
      .createQueryBuilder('user')
      .leftJoin('user.leftChild', 'leftChild')
      .leftJoin('user.rightChild', 'rightChild')
      .where('leftChild.id IS NOT NULL AND rightChild.id IS NOT NULL')
      .getCount();

    return {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      leafUsers,
      singleChildUsers,
      fullUsers,
      activePercentage: ((activeUsers / totalUsers) * 100).toFixed(2) + '%',
    };
  }
}