import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from '@tanstack/react-router'
import { useLogin } from '../hooks/useAuth'
import './auth.css'

// cek apakah form yg diisi sudah sesuai 
const schema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
})
// menyesuaikan dengan form di schema jika email maka wajib string
type FormData = z.infer<typeof schema>

// menunggu respon server"isloding" dan isi pesan error kalau gagal
export function LoginPage() {
  const { mutate: login, isPending, error } = useLogin()

// buat validasi useForm menggunakan format zod dan zod bisa terhubung dengan racthookform
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  // jika sudah submit maka jalankan login function
  const onSubmit = (data: FormData) => login(data)
  const loginError = error as (Error & { status?: number }) | null

  return (
    <div className="auth-bg">
      {/* Header */}
      <div className="auth-header">
        <div className="auth-logo blue">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z" fill="#ffffff"/>
            <path d="M19 14L19.75 17.25L23 18L19.75 18.75L19 22L18.25 18.75L15 18L18.25 17.25L19 14Z" fill="#bfdbfe"/>
          </svg>
        </div>
        <h1 className="auth-title blue">chatAI</h1>
        <p className="auth-subtitle">Design your dialogue with precision.</p>
      </div>

      {/* Card */}
      <div className="auth-card">
        <p className="auth-card-title">Welcome Back</p>
        <p className="auth-card-desc">Please enter your credentials to access your canvas.</p>

        {loginError && (
          <p className="form-error">
            {loginError.status === 401
              ? 'Email atau password salah'
              : loginError.message || 'Terjadi kesalahan, coba lagi'}
          </p>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {/* Email */}
          <div className="field">
            <label htmlFor="email">Email Address</label>
            <div className="input-wrap">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
              </svg>
              <input
                id="email"
                type="email"
                placeholder="name@workspace.com"
                autoComplete="email"
                {...register('email')}
              />
            </div>
            {errors.email && <span className="field-error">{errors.email.message}</span>}
          </div>

          {/* Password */}
          <div className="field">
            <div className="field-label-row">
              <label htmlFor="password">Password</label>
            </div>
            <div className="input-wrap">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 8h-1V6c0-2.8-2.2-5-5-5S7 3.2 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.7 1.4-3.1 3.1-3.1 1.7 0 3.1 1.4 3.1 3.1v2z"/>
              </svg>
              <input
                id="password"
                type='password'
                placeholder="••••••••••••"
                autoComplete="current-password"
                {...register('password')}
              />
            </div>
            {errors.password && <span className="field-error">{errors.password.message}</span>}
          </div>

          <button type="submit" disabled={isPending} className="btn-primary">
            {isPending ? 'Signing in...' : 'Sign In →'}
          </button>
        </form>
        <p className="auth-footer-link">
          Don't have an account? <Link to="/register">Register now</Link>
        </p>
      </div>
    </div>
  )
}
