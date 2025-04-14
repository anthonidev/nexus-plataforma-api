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
   * Verifica si un usuario tiene acceso a un nodo específico en el árbol
   * @param userId ID del usuario actual
   * @param nodeId ID del nodo al que se quiere acceder
   * @returns true si el usuario tiene acceso, false en caso contrario
   */
  async checkUserAccess(userId: string, nodeId: string): Promise<boolean> {
    try {
      // Si el usuario intenta acceder a su propio nodo, siempre tiene permiso
      if (userId === nodeId) {
        return true;
      }

      // Obtener el nodo del usuario actual
      const currentUser = await this.userRepository.findOne({
        where: { id: userId },
        select: ['id', 'parent', 'leftChild', 'rightChild'],
      });

      if (!currentUser) {
        return false;
      }

      // Verificar si el nodo solicitado es descendiente del usuario actual
      return this.isDescendant(userId, nodeId);
    } catch (error) {
      this.logger.error(`Error al verificar acceso: ${error.message}`);
      return false;
    }
  }

  /**
   * Verifica si un nodo es descendiente de otro
   * @param ancestorId ID del posible ancestro
   * @param descendantId ID del posible descendiente
   * @returns true si es descendiente, false en caso contrario
   */
  private async isDescendant(ancestorId: string, descendantId: string): Promise<boolean> {
    // Consulta SQL recursiva para verificar si es descendiente
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

  /**
   * Verifica si un nodo es ancestro de otro
   * @param descendantId ID del descendiente
   * @param ancestorId ID del posible ancestro
   * @returns true si es ancestro, false en caso contrario
   */
  private async isAncestor(descendantId: string, ancestorId: string): Promise<boolean> {
    return this.isDescendant(ancestorId, descendantId);
  }

  /**
   * Método para obtener un nodo con su contexto completo:
   * - El nodo mismo con sus descendientes hasta cierta profundidad
   * - Sus ancestros hasta la raíz o una profundidad determinada, limitado por el usuario actual
   * - Opcionalmente, información sobre hermanos para navegación lateral
   */
  async getNodeWithContext(
    nodeId: string,
    descendantDepth: number = 3,
    ancestorDepth: number = 3,
    currentUserId: string, // Usuario actualmente autenticado
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

    // Recopilar IDs de ancestros, pero solo hasta el usuario autenticado
    let currentAncestor = currentNode.parent;
    const ancestorIds: string[] = [];
    let reachedCurrentUser = false;

    // Añadir ancestros a la lista de IDs a buscar, limitando hasta el usuario actual
    while (currentAncestor && ancestorIds.length < ancestorDepth && !reachedCurrentUser) {
      // Si llegamos al usuario actual, marcamos que ya no debemos subir más en el árbol
      if (currentAncestor.id === currentUserId) {
        reachedCurrentUser = true;
      }
      
      ancestorIds.push(currentAncestor.id);
      usersToFetch.add(currentAncestor.id);

      // Obtener el siguiente ancestro
      const ancestor = await query
        .where('user.id = :ancestorId', { ancestorId: currentAncestor.id })
        .getOne();

      if (!ancestor) break;

      fetchedUsers.set(ancestor.id, this.mapUserToFlatUser(ancestor));
      currentAncestor = ancestor.parent;
      
      // Si ya alcanzamos al usuario actual, no seguimos subiendo en la jerarquía
      if (reachedCurrentUser) {
        break;
      }
    }

    // Para los descendientes, hacemos como en getUserTreeOptimized pero con mejoras
    // Comenzamos con el nodo actual
    const descendantIdsToProcess = new Set<string>([nodeId]);

    // Iterativamente buscamos usuarios hasta alcanzar la profundidad máxima
    for (let depth = 0; depth < descendantDepth; depth++) {
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
        .leftJoinAndSelect('user.leftChild', 'leftChild') 
        .leftJoinAndSelect('user.rightChild', 'rightChild') 
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
}