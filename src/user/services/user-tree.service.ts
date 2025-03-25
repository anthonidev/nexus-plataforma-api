import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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
   * Nuevo método para obtener un nodo con su contexto completo:
   * - El nodo mismo con sus descendientes hasta cierta profundidad
   * - Sus ancestros hasta la raíz o una profundidad determinada
   * - Opcionalmente, información sobre hermanos para navegación lateral
   */
  async getNodeWithContext(
    nodeId: string,
    descendantDepth: number = 3,
    ancestorDepth: number = 3,
  ): Promise<NodeContext> {
    // Verificar que el nodo existe
    const nodeExists = await this.userRepository.findOne({
      where: { id: nodeId },
      select: ['id'],
    });

    if (!nodeExists) {
      throw new NotFoundException(`Usuario con ID ${nodeId} no encontrado`);
    }

    // Paso 1: Obtener todos los usuarios relevantes para este contexto en una sola consulta
    const usersToFetch = new Set<string>([nodeId]);
    const fetchedUsers = new Map<string, FlatUser>();

    // Construir consulta para obtener los usuarios
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

    // Primero obtenemos el nodo actual para identificar su cadena de ancestros
    const currentNode = await query
      .where('user.id = :nodeId', { nodeId })
      .getOne();

    if (!currentNode) {
      throw new NotFoundException(`Error al obtener el nodo ${nodeId}`);
    }

    // Añadir a nuestra colección
    fetchedUsers.set(currentNode.id, this.mapUserToFlatUser(currentNode));

    // Recopilar IDs de ancestros
    let currentAncestor = currentNode.parent;
    const ancestorIds: string[] = [];

    // Añadir ancestros a la lista de IDs a buscar
    while (currentAncestor && ancestorIds.length < ancestorDepth) {
      ancestorIds.push(currentAncestor.id);
      usersToFetch.add(currentAncestor.id);

      // Obtener el siguiente ancestro
      const ancestor = await query
        .where('user.id = :ancestorId', { ancestorId: currentAncestor.id })
        .getOne();

      if (!ancestor) break;

      fetchedUsers.set(ancestor.id, this.mapUserToFlatUser(ancestor));
      currentAncestor = ancestor.parent;
    }

    // Para los descendientes, hacemos como en getUserTreeOptimized pero con mejoras
    // Comenzamos con el nodo actual
    const descendantIdsToProcess = new Set<string>([nodeId]);

    // Iterativamente buscamos usuarios hasta alcanzar la profundidad máxima
    for (let depth = 0; depth < descendantDepth; depth++) {
      // Cambiado de <= a < para ser más directo
      if (descendantIdsToProcess.size === 0) break;

      this.logger.debug(
        `Procesando descendientes a profundidad ${depth}, nodos: ${Array.from(descendantIdsToProcess).join(', ')}`,
      );

      // Convertir el conjunto a un array para la consulta
      const userIds = Array.from(descendantIdsToProcess);
      descendantIdsToProcess.clear(); // Limpiar para la próxima iteración

      // Obtener usuarios de este nivel con sus hijos directos (1 nivel más)
      const users = await this.userRepository
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.personalInfo', 'personalInfo')
        .leftJoinAndSelect('user.leftChild', 'leftChild') // Cambiado a leftJoinAndSelect para obtener datos completos
        .leftJoinAndSelect('user.rightChild', 'rightChild') // Cambiado a leftJoinAndSelect para obtener datos completos
        .leftJoinAndSelect('leftChild.personalInfo', 'leftChildInfo')
        .leftJoinAndSelect('rightChild.personalInfo', 'rightChildInfo')
        .where('user.id IN (:...userIds)', { userIds })
        .getMany();

      // Procesar los usuarios obtenidos
      for (const user of users) {
        // Guardar usuario en formato plano (actualizando si ya existía)
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

        // Si tiene hijos, guardarlos también y añadirlos al siguiente nivel
        if (user.leftChild) {
          const leftChild = {
            id: user.leftChild.id,
            email: user.leftChild.email,
            referralCode: user.leftChild.referralCode,
            position: user.leftChild.position,
            isActive: user.leftChild.isActive,
            firstName: user.leftChild.personalInfo?.firstName,
            lastName: user.leftChild.personalInfo?.lastName,
            // No sabemos los hijos aún, así que los dejamos indefinidos
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
            // No sabemos los hijos aún, así que los dejamos indefinidos
            leftChildId: undefined,
            rightChildId: undefined,
            parentId: user.id,
          };

          fetchedUsers.set(user.rightChild.id, rightChild);
          descendantIdsToProcess.add(user.rightChild.id);
        }
      }
    }

    // Paso 2: Construir el árbol de descendientes
    // Asegurarnos de que fetchedUsers contiene todos los descendientes necesarios
    const currentUser = fetchedUsers.get(nodeId);

    // Verificamos explícitamente si hay hijos y los incluimos
    if (currentUser.leftChildId) {
      this.logger.debug(
        `El nodo ${nodeId} tiene hijo izquierdo: ${currentUser.leftChildId}`,
      );
      // Asegurarnos de consultar información de este hijo si no la tenemos
      if (!fetchedUsers.has(currentUser.leftChildId)) {
        const leftChild = await query
          .where('user.id = :childId', { childId: currentUser.leftChildId })
          .getOne();

        if (leftChild) {
          fetchedUsers.set(leftChild.id, this.mapUserToFlatUser(leftChild));
          // También deberíamos buscar sus hijos si aún no alcanzamos el límite de profundidad
          if (descendantDepth > 1) descendantIdsToProcess.add(leftChild.id);
        }
      }
    }

    if (currentUser.rightChildId) {
      this.logger.debug(
        `El nodo ${nodeId} tiene hijo derecho: ${currentUser.rightChildId}`,
      );
      // Asegurarnos de consultar información de este hijo si no la tenemos
      if (!fetchedUsers.has(currentUser.rightChildId)) {
        const rightChild = await query
          .where('user.id = :childId', { childId: currentUser.rightChildId })
          .getOne();

        if (rightChild) {
          fetchedUsers.set(rightChild.id, this.mapUserToFlatUser(rightChild));
          // También deberíamos buscar sus hijos si aún no alcanzamos el límite de profundidad
          if (descendantDepth > 1) descendantIdsToProcess.add(rightChild.id);
        }
      }
    }

    // Ahora construimos el árbol con todos los datos obtenidos
    const nodeTree = this.buildOptimizedTreeNode(
      nodeId,
      fetchedUsers,
      0,
      descendantDepth,
    );

    // Paso 3: Construir la cadena de ancestros
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
        depth: index, // Profundidad relativa en la cadena de ancestros
      };
    });

    // Paso 4: Buscar hermanos para navegación lateral si este nodo tiene un padre
    const siblings = {};
    if (currentNode.parent) {
      const parent = fetchedUsers.get(currentNode.parent.id);
      if (parent) {
        // Si hay un hermano izquierdo y no es el nodo actual
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

        // Si hay un hermano derecho y no es el nodo actual
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

    // Construir y devolver el contexto completo
    return {
      node: nodeTree,
      ancestors,
      siblings: Object.keys(siblings).length > 0 ? siblings : undefined,
    };
  }

  /**
   * Convierte una entidad User a un objeto FlatUser
   */
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
        fetchedUsers.set(user.id, this.mapUserToFlatUser(user));

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

    if (!user) {
      this.logger.warn(
        `No se encontró el usuario ${userId} en el mapa de usuarios`,
      );
      return null;
    }

    // Si hemos alcanzado la profundidad máxima, retornamos el nodo sin hijos
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

    // Registrar información para depuración
    this.logger.debug(
      `Construyendo nodo ${userId} (profundidad ${currentDepth}), hijos izq: ${user.leftChildId}, der: ${user.rightChildId}`,
    );

    // Construir nodo con estructura para hijos
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

    // Si no hay hijos, asegurarnos de que el objeto children esté vacío pero definido
    if (!treeNode.children.left && !treeNode.children.right) {
      // Verificamos en la base de datos si realmente no tiene hijos o si es un problema de datos
      this.logger.debug(
        `Nodo ${userId} no tiene hijos en el mapa. Verificando si realmente no tiene hijos.`,
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
