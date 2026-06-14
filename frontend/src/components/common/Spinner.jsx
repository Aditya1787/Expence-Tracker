import React from 'react';

const Spinner = ({ size = 'medium', className = '' }) => {
  const sizes = {
    small: 'h-4 w-4 border-2',
    medium: 'h-8 w-8 border-3',
    large: 'h-12 w-12 border-4',
  };

  return (
    <div className={`flex justify-center items-center ${className}`}>
      <div
        className={`${sizes[size]} animate-spin rounded-full border-t-transparent border-primary-500`}
        role="status"
        aria-label="loading"
      />
    </div>
  );
};

export default Spinner;
