import {apiRequest} from "./apiClient.ts";
import type {
    AuthResponse,
    LoginRequest,
    RegisterRequest,
    User,
} from "../types/auth.types.ts";

export const authApi={
    register(payload:RegisterRequest){
        return apiRequest<AuthResponse>('/auth/register',{
            method:'POST',
            body:JSON.stringify(payload),
            }
        );
    },
    login(payload:LoginRequest){
        return apiRequest<AuthResponse>('/auth/login',{
            method:'POST',
            body:JSON.stringify(payload),
            }
        );
    },
    me(){
        return apiRequest<User>('/auth/me',{
            method:'GET',
            }
        );
    },
};