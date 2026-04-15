import { z } from 'zod'

export const LoginSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
})
export type LoginInput = z.infer<typeof LoginSchema>

export const RegisterSchema = z
  .object({
    email: z.string().email('Email tidak valid'),
    displayName: z.string().min(2, 'Nama minimal 2 karakter').optional(),
    password: z.string().min(8, 'Password minimal 8 karakter'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Password tidak sama',
    path: ['confirmPassword'],
  })
export type RegisterInput = z.infer<typeof RegisterSchema>
