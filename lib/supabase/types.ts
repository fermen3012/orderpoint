export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            restaurants: {
                Row: {
                    id: string
                    name: string
                    slug: string | null
                    is_active: boolean
                    logo_url: string | null
                    created_at: string
                    stripe_customer_id: string | null
                    stripe_subscription_id: string | null
                    plan_quantity: number | null
                    subscription_status: string | null
                    current_period_end: string | null
                }
                Insert: {
                    id?: string
                    name: string
                    slug?: string | null
                    is_active?: boolean
                    logo_url?: string | null
                    created_at?: string
                    stripe_customer_id?: string | null
                    stripe_subscription_id?: string | null
                    plan_quantity?: number | null
                    subscription_status?: string | null
                    current_period_end?: string | null
                }
                Update: {
                    id?: string
                    name?: string
                    slug?: string | null
                    is_active?: boolean
                    logo_url?: string | null
                    created_at?: string
                    stripe_customer_id?: string | null
                    stripe_subscription_id?: string | null
                    plan_quantity?: number | null
                    subscription_status?: string | null
                    current_period_end?: string | null
                }
            }
            categories: {
                Row: {
                    id: string
                    restaurant_id: string
                    name: string
                    image_url: string | null
                    sort_order: number
                    created_at: string
                }
                Insert: {
                    id?: string
                    restaurant_id: string
                    name: string
                    image_url?: string | null
                    sort_order?: number
                    created_at?: string
                }
                Update: {
                    id?: string
                    restaurant_id?: string
                    name?: string
                    image_url?: string | null
                    sort_order?: number
                    created_at?: string
                }
            }
            products: {
                Row: {
                    id: string
                    restaurant_id: string
                    category_id: string | null
                    name: string
                    description: string | null
                    description_es: string | null
                    price: number
                    image_url: string | null
                    is_available: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    restaurant_id: string
                    category_id?: string | null
                    name: string
                    description?: string | null
                    description_es?: string | null
                    price: number
                    image_url?: string | null
                    is_available?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    restaurant_id?: string
                    category_id?: string | null
                    name?: string
                    description?: string | null
                    description_es?: string | null
                    price?: number
                    image_url?: string | null
                    is_available?: boolean
                    created_at?: string
                }
            },
            modifier_groups: {
                Row: {
                    id: string
                    restaurant_id: string
                    name: string
                    min_selections: number
                    max_selections: number | null
                    is_required: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    restaurant_id: string
                    name: string
                    min_selections?: number
                    max_selections?: number | null
                    is_required?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    restaurant_id?: string
                    name?: string
                    min_selections?: number
                    max_selections?: number | null
                    is_required?: boolean
                    created_at?: string
                }
            }
            modifiers: {
                Row: {
                    id: string
                    group_id: string
                    name: string
                    price_extra: number
                    is_available: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    group_id: string
                    name: string
                    price_extra?: number
                    is_available?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    group_id?: string
                    name?: string
                    price_extra?: number
                    is_available?: boolean
                    created_at?: string
                }
            }
            product_modifier_groups: {
                Row: {
                    product_id: string
                    group_id: string
                    sort_order: number
                }
                Insert: {
                    product_id: string
                    group_id: string
                    sort_order?: number
                }
                Update: {
                    product_id?: string
                    group_id?: string
                    sort_order?: number
                }
            }
            orders: {
                Row: {
                    id: string
                    restaurant_id: string
                    status: 'pending' | 'preparing' | 'ready' | 'completed'
                    total_amount: number
                    order_number: number
                    created_at: string
                    preparing_at: string | null
                    ready_at: string | null
                    completed_at: string | null
                    order_type: 'dine_in' | 'takeout' | null
                }
                Insert: {
                    id?: string
                    restaurant_id: string
                    status?: 'pending' | 'preparing' | 'ready' | 'completed'
                    total_amount: number
                    order_number?: number
                    created_at?: string
                    preparing_at?: string | null
                    ready_at?: string | null
                    completed_at?: string | null
                    order_type?: 'dine_in' | 'takeout' | null
                }
                Update: {
                    id?: string
                    restaurant_id?: string
                    status?: 'pending' | 'preparing' | 'ready' | 'completed'
                    total_amount?: number
                    order_number?: number
                    created_at?: string
                    preparing_at?: string | null
                    ready_at?: string | null
                    completed_at?: string | null
                    order_type?: 'dine_in' | 'takeout' | null
                }
            }
            order_items: {
                Row: {
                    id: string
                    order_id: string
                    product_id: string | null
                    quantity: number
                    unit_price: number
                    modifiers_json: Json
                    removed_ingredients: string[] | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    order_id: string
                    product_id?: string | null
                    quantity?: number
                    unit_price: number
                    modifiers_json?: Json
                    removed_ingredients?: string[] | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    order_id?: string
                    product_id?: string | null
                    quantity?: number
                    unit_price?: number
                    modifiers_json?: Json
                    removed_ingredients?: string[] | null
                    created_at?: string
                }
            }
            ingredients: {
                Row: {
                    id: string
                    restaurant_id: string
                    name: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    restaurant_id: string
                    name: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    restaurant_id?: string
                    name?: string
                    created_at?: string
                }
            }
            product_ingredients: {
                Row: {
                    id: string
                    product_id: string
                    ingredient_id: string
                    is_removable: boolean
                }
                Insert: {
                    id?: string
                    product_id: string
                    ingredient_id: string
                    is_removable?: boolean
                }
                Update: {
                    id?: string
                    product_id?: string
                    ingredient_id?: string
                    is_removable?: boolean
                }
            }
            profiles: {
                Row: {
                    id: string
                    restaurant_id: string | null
                    role: 'admin' | 'kitchen' | 'kiosk' | 'owner' | 'mesera'
                    full_name: string | null
                    is_super_admin: boolean
                    created_at: string
                }
                Insert: {
                    id: string
                    restaurant_id?: string | null
                    role?: 'admin' | 'kitchen' | 'kiosk' | 'owner' | 'mesera'
                    full_name?: string | null
                    is_super_admin?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    restaurant_id?: string | null
                    role?: 'admin' | 'kitchen' | 'kiosk' | 'owner' | 'mesera'
                    full_name?: string | null
                    is_super_admin?: boolean
                    created_at?: string
                }
            }
            tables: {
                Row: {
                    id: string
                    restaurant_id: string
                    number: string
                    capacity: number
                    waitress_id: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    restaurant_id: string
                    number: string
                    capacity?: number
                    waitress_id?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    restaurant_id?: string
                    number?: string
                    capacity?: number
                    waitress_id?: string | null
                    created_at?: string
                }
            }
            product_availability: {
                Row: {
                    id: string
                    product_id: string
                    restaurant_id: string
                    day_of_week: number
                    is_active: boolean
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    product_id: string
                    restaurant_id: string
                    day_of_week: number
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    product_id?: string
                    restaurant_id?: string
                    day_of_week?: number
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                }
            }
        }
        Functions: {
            get_next_order_number: {
                Args: {
                    p_restaurant_id: string
                }
                Returns: number
            }
        }
    }
}
