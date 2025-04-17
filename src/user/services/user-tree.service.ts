import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Membership,
  MembershipStatus,
} from 'src/memberships/entities/membership.entity';
import { UserRank } from 'src/ranks/entities/user_ranks.entity';
import { User } from 'src/user/entities/user.entity';
import { In, Repository } from 'typeorm';
import { FlatUser } from '../interface/flat-user.interface';
import { NodeContext, TreeNode } from '../interface/tree-node.interface';

@Injectable()
export class UserTreeService {
  private readonly logger = new Logger(UserTreeService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
    @InjectRepository(UserRank)
    private readonly userRankRepository: Repository<UserRank>,
  ) {}

  async getUserTree(userId: string, maxDepth = 3): Promise<TreeNode> {
    try {
      const rootExists = await this.userRepository.findOne({
        where: { id: userId },
        select: ['id'],
      });

      if (!rootExists) {
        throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
      }

      return this.getUserTreeOptimized(userId, maxDepth);
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

      return this.isDescendant(userId, nodeId);
    } catch (error) {
      this.logger.error(`Error al verificar acceso: ${error.message}`);
      return false;
    }
  }

  private async isDescendant(
    ancestorId: string,
    descendantId: string,
  ): Promise<boolean> {
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

    const result = await this.userRepository.query(query, [
      ancestorId,
      descendantId,
    ]);
    return result[0]?.is_descendant === true;
  }

  async getNodeWithContext(
    nodeId: string,
    descendantDepth = 3,
    ancestorDepth = 3,
    currentUserId: string,
  ): Promise<NodeContext> {
    // Verify node exists
    const nodeExists = await this.userRepository.findOne({
      where: { id: nodeId },
      select: ['id'],
    });

    if (!nodeExists) {
      throw new NotFoundException(`Usuario con ID ${nodeId} no encontrado`);
    }

    const fetchedUsers = new Map<string, FlatUser>();
    const userMemberships = new Map<string, any>();
    const userRanks = new Map<string, any>();
    const allUserIds = new Set<string>([nodeId]);

    const userQuery = this.userRepository
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

    const currentNode = await userQuery
      .where('user.id = :nodeId', { nodeId })
      .getOne();

    if (!currentNode) {
      throw new NotFoundException(`Error al obtener el nodo ${nodeId}`);
    }

    fetchedUsers.set(currentNode.id, this.mapUserToFlatUser(currentNode));

    const isCurrentUserAncestorOfNode = await this.isDescendant(
      currentUserId,
      nodeId,
    );
    const isCurrentUserParentOfNode = currentNode.parent?.id === currentUserId;
    const currentUserIsInAncestorPath =
      isCurrentUserAncestorOfNode || isCurrentUserParentOfNode;

    const ancestorIds: string[] = [];
    if (currentUserIsInAncestorPath && currentNode.parent) {
      let currentAncestor = currentNode.parent;

      while (currentAncestor && ancestorIds.length < ancestorDepth) {
        const ancestor = await userQuery
          .where('user.id = :ancestorId', { ancestorId: currentAncestor.id })
          .getOne();

        if (!ancestor || ancestor.id === currentUserId) break;

        const isDescendantOfCurrentUser = await this.isDescendant(
          currentUserId,
          ancestor.id,
        );

        if (!isDescendantOfCurrentUser && ancestor.id !== currentUserId) break;

        ancestorIds.push(ancestor.id);
        allUserIds.add(ancestor.id);
        fetchedUsers.set(ancestor.id, this.mapUserToFlatUser(ancestor));
        currentAncestor = ancestor.parent;
      }
    }

    const descendantIdsToProcess = new Set<string>([nodeId]);

    for (let depth = 0; depth < descendantDepth; depth++) {
      if (descendantIdsToProcess.size === 0) break;

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
        const flatUser = this.mapUserToFlatUser(user);
        fetchedUsers.set(user.id, flatUser);
        allUserIds.add(user.id);

        if (user.leftChild) {
          fetchedUsers.set(
            user.leftChild.id,
            this.mapUserToFlatUser(user.leftChild),
          );
          descendantIdsToProcess.add(user.leftChild.id);
          allUserIds.add(user.leftChild.id);
        }

        if (user.rightChild) {
          fetchedUsers.set(
            user.rightChild.id,
            this.mapUserToFlatUser(user.rightChild),
          );
          descendantIdsToProcess.add(user.rightChild.id);
          allUserIds.add(user.rightChild.id);
        }
      }
    }

    const userIdsArray = Array.from(allUserIds);

    const memberships = await this.membershipRepository.find({
      where: {
        user: { id: In(userIdsArray) },
        status: MembershipStatus.ACTIVE,
      },
      relations: ['plan', 'user'],
    });

    this.logger.log(
      `Encontradas ${memberships.length} membresías activas para ${userIdsArray.length} usuarios`,
    );

    const ranks = await this.userRankRepository.find({
      where: {
        user: { id: In(userIdsArray) },
      },
      relations: ['currentRank', 'highestRank', 'user'],
    });

    this.logger.log(
      `Encontrados ${ranks.length} registros de rangos para ${userIdsArray.length} usuarios`,
    );

    memberships.forEach((membership) => {
      userMemberships.set(membership.user.id, {
        plan: {
          name: membership.plan.name,
        },
        status: membership.status,
        startDate: membership.startDate,
        endDate: membership.endDate,
      });
    });

    ranks.forEach((userRank) => {
      userRanks.set(userRank.user.id, {
        currentRank: userRank.currentRank
          ? {
              name: userRank.currentRank.name,
              code: userRank.currentRank.code,
            }
          : null,
        highestRank: userRank.highestRank
          ? {
              name: userRank.highestRank.name,
              code: userRank.highestRank.code,
            }
          : null,
      });
    });

    const nodeTree = this.buildOptimizedTreeNode(
      nodeId,
      fetchedUsers,
      userMemberships,
      userRanks,
      0,
      descendantDepth,
    );

    const ancestors: TreeNode[] = ancestorIds.map((ancestorId, index) => {
      const user = fetchedUsers.get(ancestorId);
      const membership = userMemberships.get(ancestorId);
      const rank = userRanks.get(ancestorId);

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
        membership,
        rank,
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

  async getUserTreeOptimized(userId: string, maxDepth = 3): Promise<TreeNode> {
    const fetchedUsers = new Map<string, FlatUser>();
    const allUserIds = new Set<string>([userId]);
    const usersToFetch = new Set<string>([userId]);

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
          if (user.leftChild?.id) {
            usersToFetch.add(user.leftChild.id);
            allUserIds.add(user.leftChild.id);
          }
          if (user.rightChild?.id) {
            usersToFetch.add(user.rightChild.id);
            allUserIds.add(user.rightChild.id);
          }
        }
      }
    }

    if (!fetchedUsers.has(userId)) {
      throw new Error(
        'Error al construir el árbol: no se pudo obtener el nodo raíz',
      );
    }

    this.logger.log(
      `Recopilados ${allUserIds.size} usuarios para el árbol con profundidad ${maxDepth}`,
    );

    const userIdsArray = Array.from(allUserIds);

    try {
      const memberships = await this.membershipRepository.find({
        where: {
          user: { id: In(userIdsArray) },
          status: MembershipStatus.ACTIVE,
        },
        relations: ['plan', 'user'],
      });

      const userMemberships = new Map<string, any>();
      memberships.forEach((membership) => {
        userMemberships.set(membership.user.id, {
          plan: {
            name: membership.plan.name,
          },
          status: membership.status,
          startDate: membership.startDate,
          endDate: membership.endDate,
        });
      });

      this.logger.log(`Encontradas ${memberships.length} membresías activas`);

      const ranks = await this.userRankRepository.find({
        where: {
          user: { id: In(userIdsArray) },
        },
        relations: ['currentRank', 'highestRank', 'user'],
      });

      const userRanks = new Map<string, any>();
      ranks.forEach((userRank) => {
        userRanks.set(userRank.user.id, {
          currentRank: userRank.currentRank
            ? {
                name: userRank.currentRank.name,
                code: userRank.currentRank.code,
              }
            : null,
          highestRank: userRank.highestRank
            ? {
                name: userRank.highestRank.name,
                code: userRank.highestRank.code,
              }
            : null,
        });
      });

      this.logger.log(`Encontrados ${ranks.length} registros de rangos`);

      return this.buildOptimizedTreeNode(
        userId,
        fetchedUsers,
        userMemberships,
        userRanks,
        0,
        maxDepth,
      );
    } catch (error) {
      this.logger.error(
        `Error al obtener información de membresía y rango: ${error.message}`,
      );
      throw error;
    }
  }

  private buildOptimizedTreeNode(
    userId: string,
    userMap: Map<string, FlatUser>,
    membershipMap: Map<string, any>,
    rankMap: Map<string, any>,
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

    const membership = membershipMap.get(userId);
    const rank = rankMap.get(userId);

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
      membership,
      rank,
    };

    if (currentDepth < maxDepth) {
      treeNode.children = {};

      if (user.leftChildId && userMap.has(user.leftChildId)) {
        treeNode.children.left = this.buildOptimizedTreeNode(
          user.leftChildId,
          userMap,
          membershipMap,
          rankMap,
          currentDepth + 1,
          maxDepth,
        );
      }

      if (user.rightChildId && userMap.has(user.rightChildId)) {
        treeNode.children.right = this.buildOptimizedTreeNode(
          user.rightChildId,
          userMap,
          membershipMap,
          rankMap,
          currentDepth + 1,
          maxDepth,
        );
      }
    }

    return treeNode;
  }

  private async buildTreeNode(
    user: User,
    currentDepth: number,
    maxDepth: number,
  ): Promise<TreeNode> {
    if (!user.email) {
      user = await this.userRepository.findOne({
        where: { id: user.id },
        relations: ['personalInfo', 'leftChild', 'rightChild'],
      });
    }

    const [membership, userRank] = await Promise.all([
      this.membershipRepository.findOne({
        where: {
          user: { id: user.id },
          status: MembershipStatus.ACTIVE,
        },
        relations: ['plan'],
      }),
      this.userRankRepository.findOne({
        where: { user: { id: user.id } },
        relations: ['currentRank', 'highestRank'],
      }),
    ]);

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
      membership: membership
        ? {
            plan: {
              name: membership.plan.name,
            },
            status: membership.status,
            startDate: membership.startDate,
            endDate: membership.endDate,
          }
        : undefined,
      rank: userRank
        ? {
            currentRank: userRank.currentRank
              ? {
                  name: userRank.currentRank.name,
                  code: userRank.currentRank.code,
                }
              : null,
            highestRank: userRank.highestRank
              ? {
                  name: userRank.highestRank.name,
                  code: userRank.highestRank.code,
                }
              : null,
          }
        : undefined,
    };

    if (currentDepth >= maxDepth) {
      return treeNode;
    }

    treeNode.children = {};

    const leftChildId = user.leftChild?.id;
    const rightChildId = user.rightChild?.id;

    const childPromises = [];

    if (leftChildId) {
      childPromises.push(
        this.userRepository
          .findOne({
            where: { id: leftChildId },
            relations: ['personalInfo'],
          })
          .then((leftChild) => {
            if (leftChild) {
              return this.buildTreeNode(
                leftChild,
                currentDepth + 1,
                maxDepth,
              ).then((node) => {
                treeNode.children.left = node;
              });
            }
          }),
      );
    }

    if (rightChildId) {
      childPromises.push(
        this.userRepository
          .findOne({
            where: { id: rightChildId },
            relations: ['personalInfo'],
          })
          .then((rightChild) => {
            if (rightChild) {
              return this.buildTreeNode(
                rightChild,
                currentDepth + 1,
                maxDepth,
              ).then((node) => {
                treeNode.children.right = node;
              });
            }
          }),
      );
    }

    if (childPromises.length > 0) {
      await Promise.all(childPromises);
    }

    return treeNode;
  }
}
