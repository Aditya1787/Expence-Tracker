import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertCircle, CheckCircle, Info, X, AlertTriangle } from 'lucide-react';

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'success', duration = 4000) => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      removeToast(id);
    }, duration);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Toast Render Area */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col space-y-3 max-w-sm w-full">
        {toasts.map((toast) => {
          let bg = 'bg-white dark:bg-gray-900 border-green-500';
          let text = 'text-gray-800 dark:text-gray-200';
          let icon = <CheckCircle className="h-5 w-5 text-green-500" />;
          
          if (toast.type === 'error') {
            bg = 'bg-white dark:bg-gray-900 border-red-500';
            icon = <AlertCircle className="h-5 w-5 text-red-500" />;
          } else if (toast.type === 'warning') {
            bg = 'bg-white dark:bg-gray-900 border-amber-500';
            icon = <AlertTriangle className="h-5 w-5 text-amber-500" />;
          } else if (toast.type === 'info') {
            bg = 'bg-white dark:bg-gray-900 border-blue-500';
            icon = <Info className="h-5 w-5 text-blue-500" />;
          }

          return (
            <div
              key={toast.id}
              className={`flex items-start justify-between p-4 rounded-2xl border-l-4 shadow-xl ring-1 ring-black/5 dark:ring-white/5 transition-all duration-300 animate-slide-in ${bg} ${text}`}
            >
              <div className="flex space-x-3">
                <div className="flex-shrink-0 mt-0.5">{icon}</div>
                <p className="text-sm font-medium leading-5">{toast.message}</p>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="ml-4 flex-shrink-0 inline-flex text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 rounded-lg p-1 hover:bg-gray-150 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
