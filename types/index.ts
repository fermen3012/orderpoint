
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
    required: boolean; // mapped from is_required in DB usually
    options: Modifier[];
}

export interface Product {
    id: string;
    name: string;
    description: string | null;
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
