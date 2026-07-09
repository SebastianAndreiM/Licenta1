export interface User {
    id: number;
    name: string;
    email: string;
    institution: string;
    createdAt?: string;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    name: string;
    email: string;
    password: string;
    institution: string;
}

export interface AuthResponse{
    access_token: string;
    token_type: string;
    expires_in: number;
    user: User;
}