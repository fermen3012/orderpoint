'use client';

import React, { createContext, useContext, ReactNode } from 'react';

export interface UserProfile {
    id: string;
    role: string;
    restaurant_id: string | null;
    is_super_admin: boolean;
    full_name: string | null;
}

interface AuthContextType {
    userProfile: UserProfile | null;
    restaurantId: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({
    children,
    value
}: {
    children: ReactNode;
    value: AuthContextType
}) {
    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        // Fallback for pages outside an AuthProvider (e.g. Superadmin view)
        return { userProfile: null, restaurantId: null };
    }
    return context;
}
