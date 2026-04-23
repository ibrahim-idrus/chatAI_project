import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from '@tanstack/react-router'
import { useLogin } from '../hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Sparkles, Mail, Lock, AlertCircle } from 'lucide-react'

const schema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
})

type FormData = z.infer<typeof schema>

export function LoginPage() {
  const { mutate: login, isPending, error } = useLogin()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = (data: FormData) => login(data)
  const loginError = error as (Error & { status?: number }) | null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex flex-col items-center justify-center p-4">
      {/* Brand */}
      <div className="flex flex-col items-center gap-2 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-primary tracking-tight">chatAI</h1>
        <p className="text-sm text-muted-foreground">Design your dialogue with precision.</p>
      </div>

      <Card className="w-full max-w-sm shadow-xl border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-xl font-semibold">Welcome Back</CardTitle>
          <CardDescription>Enter your credentials to access your canvas.</CardDescription>
        </CardHeader>

        <CardContent>
          {loginError && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {loginError.status === 401
                ? 'Email atau password salah'
                : loginError.message || 'Terjadi kesalahan, coba lagi'}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@workspace.com"
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
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  className="pl-9"
                  {...register('password')}
                />
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <Button type="submit" disabled={isPending} className="w-full mt-2">
              {isPending ? 'Signing in...' : 'Sign In →'}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center pt-0">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary font-medium hover:underline">
              Register now
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
