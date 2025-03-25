export interface TreeNode {
  id: string;
  email: string;
  referralCode: string;
  position: string;
  isActive: boolean;
  fullName?: string;
  depth: number;
  children?: {
    left?: TreeNode;
    right?: TreeNode;
  };
}

export interface NodeContext {
  // El nodo actual
  node: TreeNode;
  // Camino de ancestros hasta la raíz (incluye desde el padre hasta la raíz)
  ancestors: TreeNode[];
  // Información sobre hermanos (opcional, para navegación lateral)
  siblings?: {
    left?: {
      id: string;
      email: string;
      referralCode: string;
    };
    right?: {
      id: string;
      email: string;
      referralCode: string;
    };
  };
}
