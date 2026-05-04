import { z } from "zod";

export const registerSchema = z.object({
    username: z.string()
        .min(3, "Username must be at least 3 characters")
        .max(20, "Username must not exceed 20 characters")
        .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers and underscores"),
    
    email: z.string()
        .email("Invalid email format"),
    
    fullName: z.string()
        .min(2, "Full name must be at least 2 characters")
        .max(50, "Full name must not exceed 50 characters"),
    
    password: z.string()
        .min(6, "Password must be at least 6 characters")
        .max(50, "Password must not exceed 50 characters")
});

export const loginSchema = z.object({
    email: z.string()
        .email("Invalid email format")
        .optional(),
    
    username: z.string()
        .min(3)
        .optional(),
    
    password: z.string()
        .min(1, "Password is required")
}).refine(data => data.email || data.username, {
    message: "Either email or username is required"
});

export const changePasswordSchema = z.object({
    oldPassword: z.string()
        .min(1, "Old password is required"),
    
    newPassword: z.string()
        .min(6, "New password must be at least 6 characters")
        .max(50, "New password must not exceed 50 characters")
});

export const updateCredentialsSchema = z.object({
    username: z.string()
        .min(3)
        .max(20)
        .regex(/^[a-zA-Z0-9_]+$/)
        .optional(),
    
    email: z.string()
        .email()
        .optional(),
    
    password: z.string()
        .min(1, "Password is required to update credentials")
}).refine(data => data.username || data.email, {
    message: "Provide at least username or email to update"
});