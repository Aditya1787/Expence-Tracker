import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Wallet, UserPlus, User, Mail, Lock } from 'lucide-react';
import Spinner from '../components/common/Spinner';

const Register = () => {
  const { register: signup } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, watch, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setSubmitting(true);
    const result = await signup(data.name, data.email, data.password);
    setSubmitting(false);

    if (result.success) {
      addToast('Account created successfully!', 'success');
      navigate('/');
    } else {
      addToast(result.error, 'error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4 py-12 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-900 p-8 rounded-3xl shadow-xl ring-1 ring-black/5 dark:ring-white/5">
        <div className="flex flex-col items-center">
          <div className="h-12 w-12 rounded-2xl bg-primary-100 dark:bg-primary-950/40 flex items-center justify-center text-primary-600 dark:text-primary-450 mb-3">
            <Wallet className="h-7 w-7" />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight">Create your account</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-500">
              Sign in
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            {/* Name Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                  <User className="h-5 w-5" />
                </span>
                <input
                  type="text"
                  placeholder="Aisha Patel"
                  className={`block w-full pl-10 pr-3 py-3 rounded-xl border ${
                    errors.name 
                      ? 'border-red-500 ring-red-150' 
                      : 'border-gray-300 dark:border-gray-700'
                  } bg-white dark:bg-gray-950 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition-all duration-200`}
                  {...register('name', { required: 'Name is required' })}
                />
              </div>
              {errors.name && (
                <span className="text-red-500 text-xs mt-1 block">{errors.name.message}</span>
              )}
            </div>

            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                  <Mail className="h-5 w-5" />
                </span>
                <input
                  type="email"
                  placeholder="name@example.com"
                  className={`block w-full pl-10 pr-3 py-3 rounded-xl border ${
                    errors.email 
                      ? 'border-red-500 ring-red-150' 
                      : 'border-gray-300 dark:border-gray-700'
                  } bg-white dark:bg-gray-950 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition-all duration-200`}
                  {...register('email', { 
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address'
                    }
                  })}
                />
              </div>
              {errors.email && (
                <span className="text-red-500 text-xs mt-1 block">{errors.email.message}</span>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                  <Lock className="h-5 w-5" />
                </span>
                <input
                  type="password"
                  placeholder="••••••••"
                  className={`block w-full pl-10 pr-3 py-3 rounded-xl border ${
                    errors.password 
                      ? 'border-red-500 ring-red-150' 
                      : 'border-gray-300 dark:border-gray-700'
                  } bg-white dark:bg-gray-950 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition-all duration-200`}
                  {...register('password', { 
                    required: 'Password is required',
                    minLength: {
                      value: 6,
                      message: 'Password must be at least 6 characters'
                    }
                  })}
                />
              </div>
              {errors.password && (
                <span className="text-red-500 text-xs mt-1 block">{errors.password.message}</span>
              )}
            </div>

            {/* Confirm Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                  <Lock className="h-5 w-5" />
                </span>
                <input
                  type="password"
                  placeholder="••••••••"
                  className={`block w-full pl-10 pr-3 py-3 rounded-xl border ${
                    errors.confirmPassword 
                      ? 'border-red-500 ring-red-150' 
                      : 'border-gray-300 dark:border-gray-700'
                  } bg-white dark:bg-gray-950 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition-all duration-200`}
                  {...register('confirmPassword', { 
                    required: 'Please confirm your password',
                    validate: (value) => value === watch('password') || 'Passwords do not match'
                  })}
                />
              </div>
              {errors.confirmPassword && (
                <span className="text-red-500 text-xs mt-1 block">{errors.confirmPassword.message}</span>
              )}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={submitting}
              className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {submitting ? (
                <Spinner size="small" className="mr-2" />
              ) : (
                <UserPlus className="h-5 w-5 mr-2" />
              )}
              <span>Create Account</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;
