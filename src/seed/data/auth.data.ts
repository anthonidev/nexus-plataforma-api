export const rolData = [
  {
    name: 'Sistema',
    code: 'SYS',
    views: ['PROFILE', 'USER', 'TREE'],
  },
  {
    name: 'Cliente',
    code: 'CLI',
    views: ['PROFILE', 'TREE'],
  },
  {
    name: 'Facturación',
    code: 'FAC',
    views: ['PROFILE', 'USER', 'TREE'],
  },
  {
    name: 'Administrador',
    code: 'ADM',
    views: ['PROFILE', 'USER', 'TREE'],
  },
];
export const vistaData = [
  {
    name: 'Perfil',
    url: '/perfil',
    order: 1,
    icon: 'profile',
    code: 'PROFILE',
    children: null,
    parent: null,
  },
  {
    name: 'Usuarios',
    url: '/usuarios',
    order: 2,
    icon: 'user',
    parent: null,
    children: null,
    code: 'USER',
  },
  {
    name: 'Arbol',
    url: '/arbol',
    order: 3,
    icon: 'tree',
    parent: null,
    children: null,
    code: 'TREE',
  },
];
