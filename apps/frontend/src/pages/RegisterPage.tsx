import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { register as apiRegister } from '../lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Sparkles, User, Mail, Lock, AlertCircle, CheckCircle } from 'lucide-react'

const schema = z
  .object({
    displayName: z.string().min(2, 'Nama minimal 2 karakter'),
    email: z.string().email('Email tidak valid'),
    password: z.string().min(8, 'Password minimal 8 karakter'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Password tidak sama',
    path: ['confirmPassword'],
  })

type FormData = z.infer<typeof schema>

export function RegisterPage() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    setServerError(null)
    setSuccessMessage(null)
    try {
      await apiRegister(data)
      navigate({ to: '/login' })
    } catch (err: unknown) {
      const apiErr = err as Error & { status?: number }
      if (apiErr.status === 409) setError('email', { message: 'Email sudah terdaftar' })
      else setServerError(apiErr.message || 'Terjadi kesalahan, coba lagi')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-100 flex flex-col items-center justify-center p-4">
      {/* Brand */}
      <div className="flex flex-col items-center gap-2 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-indigo-600 tracking-tight">chatAI</h1>
        <p className="text-sm text-muted-foreground">Design your digital thoughts with AI precision.</p>
      </div>

      <Card className="w-full max-w-sm shadow-xl border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-xl font-semibold">Create your account</CardTitle>
          <CardDescription>Join us and start your AI journey today.</CardDescription>
        </CardHeader>

        <CardContent>
          {successMessage && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-green-50 text-green-700 text-sm">
              <CheckCircle className="w-4 h-4 shrink-0" />
              {successMessage}
            </div>
          )}
          {serverError && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="displayName">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="displayName"
                  type="text"
                  placeholder="Leonardo da Vinci"
                  autoComplete="name"
                  className="pl-9"
                  {...register('displayName')}
                />
              </div>
              {errors.displayName && <p className="text-xs text-destructive">{errors.displayName.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="artist@canvas.ai"
                  autoComplete="email"
                  className="pl-9"
                  {...register('email')}
                />
              </div>
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="pl-9"
                  {...register('password')}
                />
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="pl-9"
                  {...register('confirmPassword')}
                />
              </div>
              {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700"
            >
              {isSubmitting ? 'Creating...' : 'Create Account'}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center pt-0">
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-600 font-medium hover:underline">
              Sign in here
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
