import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { register as apiRegister } from '../lib/api'
import './auth.css'

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
    <div className="auth-bg">
      {/* Header */}
      <div className="auth-header">
        <div className="auth-logo purple">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z" fill="#6366f1"/>
            <path d="M19 14L19.75 17.25L23 18L19.75 18.75L19 22L18.25 18.75L15 18L18.25 17.25L19 14Z" fill="#818cf8"/>
          </svg>
        </div>
        <h1 className="auth-title dark">chatAI</h1>
        <p className="auth-subtitle">Design your digital thoughts with AI precision.</p>
      </div>

      {/* Card */}
      <div className="auth-card">
        <p className="auth-card-title">Create your account</p>

        {successMessage && <p className="form-success">{successMessage}</p>}
        {serverError && <p className="form-error">{serverError}</p>}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {/* Full Name */}
          <div className="field">
            <label htmlFor="displayName">Full Name</label>
            <div className="input-wrap">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
              </svg>
              <input
                id="displayName"
                type="text"
                placeholder="Leonardo da Vinci"
                autoComplete="name"
                {...register('displayName')}
              />
            </div>
            {errors.displayName && <span className="field-error">{errors.displayName.message}</span>}
          </div>

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
                placeholder="artist@canvas.ai"
                autoComplete="email"
                {...register('email')}
              />
            </div>
            {errors.email && <span className="field-error">{errors.email.message}</span>}
          </div>

          {/* Password */}
          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="input-wrap">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 8h-1V6c0-2.8-2.2-5-5-5S7 3.2 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.7 1.4-3.1 3.1-3.1 1.7 0 3.1 1.4 3.1 3.1v2z"/>
              </svg>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                {...register('password')}
              />
            </div>
            {errors.password && <span className="field-error">{errors.password.message}</span>}
          </div>

          {/* Confirm Password */}
          <div className="field">
            <label htmlFor="confirmPassword">Confirm</label>
            <div className="input-wrap">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 8h-1V6c0-2.8-2.2-5-5-5S7 3.2 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.7 1.4-3.1 3.1-3.1 1.7 0 3.1 1.4 3.1 3.1v2z"/>
              </svg>
              <input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                {...register('confirmPassword')}
              />
            </div>
            {errors.confirmPassword && <span className="field-error">{errors.confirmPassword.message}</span>}
          </div>

          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? 'Creating...' : <> Create Account </>}
          </button>
        </form>
        <p className="auth-footer-link">
          Already have an account? <Link to="/login">Sign in here</Link>
        </p>
      </div>
    </div>
  )
}
