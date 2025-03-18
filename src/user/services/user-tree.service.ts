import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/user/entities/user.entity';
import { TreeNode } from '../interface/tree-node.interface';
import { FlatUser } from '../interface/flat-user.interface';

@Injectable()
export class UserTreeService {
  private readonly logger = new Logger(UserTreeService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Obtiene el árbol de usuarios a partir de un usuario raíz
   * @param userId Id del usuario raíz para el árbol
   * @param maxDepth Profundidad máxima del árbol a recuperar
   * @returns Estructura del árbol de usuarios
   */
  async getUserTree(userId: string, maxDepth: number = 3): Promise<TreeNode> {
    // Intentamos usar el método optimizado primero
    try {
      return await this.getUserTreeOptimized(userId, maxDepth);
    } catch (error) {
      this.logger.warn(
        `Error al obtener árbol optimizado: ${error.message}. Usando método alternativo.`,
      );

      // Si hay algún problema, usamos el método original como fallback
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

  /**
   * Versión optimizada para obtener el árbol de usuarios
   * Realiza una sola consulta a la base de datos y construye el árbol en memoria
   */
  async getUserTreeOptimized(
    userId: string,
    maxDepth: number = 3,
  ): Promise<TreeNode> {
    // Verificar que el usuario raíz existe
    const rootExists = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id'],
    });

    if (!rootExists) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    // Construir consulta para obtener todos los usuarios relevantes del árbol
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

    // Comenzamos con el usuario raíz y sus descendientes
    const usersToFetch = new Set<string>([userId]);
    const fetchedUsers = new Map<string, FlatUser>();

    // Iterativamente buscamos usuarios hasta alcanzar la profundidad máxima
    for (let depth = 0; depth <= maxDepth; depth++) {
      if (usersToFetch.size === 0) break;

      // Convertir el conjunto a un array para la consulta
      const userIds = Array.from(usersToFetch);
      usersToFetch.clear(); // Limpiar para la próxima iteración

      // Obtener usuarios de este nivel
      const users = await query
        .andWhere('user.id IN (:...userIds)', { userIds })
        .getMany();

      // Procesar los usuarios obtenidos
      for (const user of users) {
        // Guardar usuario en formato plano
        fetchedUsers.set(user.id, {
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
        });

        // Añadir hijos para la próxima iteración si no hemos alcanzado la profundidad máxima
        if (depth < maxDepth) {
          if (user.leftChild?.id) usersToFetch.add(user.leftChild.id);
          if (user.rightChild?.id) usersToFetch.add(user.rightChild.id);
        }
      }
    }

    // Si no encontramos el usuario raíz, algo salió mal
    if (!fetchedUsers.has(userId)) {
      throw new Error(
        'Error al construir el árbol: no se pudo obtener el nodo raíz',
      );
    }

    // Construir el árbol usando los datos en memoria
    return this.buildOptimizedTreeNode(userId, fetchedUsers, 0, maxDepth);
  }

  /**
   * Construye un nodo del árbol usando datos previamente cargados en memoria
   */
  private buildOptimizedTreeNode(
    userId: string,
    userMap: Map<string, FlatUser>,
    currentDepth: number,
    maxDepth: number,
  ): TreeNode {
    const user = userMap.get(userId);

    // Si no tenemos este usuario o hemos alcanzado la profundidad máxima
    if (!user || currentDepth >= maxDepth) {
      return user
        ? {
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
          }
        : null;
    }

    // Construir nodo
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

    // Procesar hijos recursivamente si existen en nuestro mapa
    if (user.leftChildId && userMap.has(user.leftChildId)) {
      treeNode.children.left = this.buildOptimizedTreeNode(
        user.leftChildId,
        userMap,
        currentDepth + 1,
        maxDepth,
      );
    }

    if (user.rightChildId && userMap.has(user.rightChildId)) {
      treeNode.children.right = this.buildOptimizedTreeNode(
        user.rightChildId,
        userMap,
        currentDepth + 1,
        maxDepth,
      );
    }

    return treeNode;
  }

  /**
   * Construye recursivamente el árbol de usuarios
   */
  private async buildTreeNode(
    user: User,
    currentDepth: number,
    maxDepth: number,
  ): Promise<TreeNode> {
    // Si ya alcanzamos la profundidad máxima, devolvemos el nodo sin hijos
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

    // Verificar si se trata de una referencia parcial (solo ID)
    // En ese caso, cargamos el usuario completo con sus relaciones
    if (!user.email) {
      user = await this.userRepository.findOne({
        where: { id: user.id },
        relations: ['personalInfo', 'leftChild', 'rightChild'],
      });
    }

    // Buscar hijos del usuario - necesitamos consultar directamente en la base de datos
    // para asegurarnos de que obtenemos los hijos reales
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

    // Construir nodo con hijos
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

    // Procesar hijos recursivamente
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

  /**
   * Obtiene estadísticas generales del árbol de usuarios
   */
  async getTreeStatistics(): Promise<any> {
    const totalUsers = await this.userRepository.count();
    const activeUsers = await this.userRepository.count({
      where: { isActive: true },
    });

    // Usuarios sin hijos (nodos hoja)
    const leafUsers = await this.userRepository
      .createQueryBuilder('user')
      .leftJoin('user.leftChild', 'leftChild')
      .leftJoin('user.rightChild', 'rightChild')
      .where('leftChild.id IS NULL AND rightChild.id IS NULL')
      .getCount();

    // Usuarios con un solo hijo
    const singleChildUsers = await this.userRepository
      .createQueryBuilder('user')
      .leftJoin('user.leftChild', 'leftChild')
      .leftJoin('user.rightChild', 'rightChild')
      .where(
        '(leftChild.id IS NULL AND rightChild.id IS NOT NULL) OR (leftChild.id IS NOT NULL AND rightChild.id IS NULL)',
      )
      .getCount();

    // Usuarios con ambos hijos
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

  /**
   * Encuentra el usuario maestro (raíz del árbol)
   */
  async findMasterUser(): Promise<User> {
    // Buscar el usuario que no tiene padre (usuario raíz)
    const masterUser = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.personalInfo', 'personalInfo')
      .leftJoinAndSelect('user.leftChild', 'leftChild')
      .leftJoinAndSelect('user.rightChild', 'rightChild')
      .leftJoin('user.parent', 'parent')
      .where('parent.id IS NULL')
      .orderBy('user.createdAt', 'ASC')
      .getOne();

    if (!masterUser) {
      throw new NotFoundException('No se encontró el usuario maestro');
    }

    return masterUser;
  }
}
