
export interface Modifier {
    id: string;
    name: string;
    price: number;
    is_available: boolean;
}

export interface ModifierGroup {
    id: string;
    name: string;
    min_selections: number;
    max_selections: number | null;
    is_required: boolean;
    required?: boolean; // deprecated but kept for compatibility
    options: Modifier[];
}

export interface Product {
    id: string;
    restaurant_id: string;
    category_id: string | null;
    name: any;
    description: any | null;
    price: number;
    image_url: string | null;
    is_available: boolean;
    modifier_groups: ModifierGroup[];
}

export interface SelectedModifier {
    groupId: string;
    groupName: string;
    options: Modifier[];
}

export interface CartItem {
    uniqueId: string;
    product: Product;
    selectedModifiers: SelectedModifier[];
    quantity: number;
    totalPrice: number; // Unit price (base + modifiers) * quantity
    unitPrice: number; // Price of one unit (base + modifiers)
    removedIngredients?: { id: string; name: string }[];
}
