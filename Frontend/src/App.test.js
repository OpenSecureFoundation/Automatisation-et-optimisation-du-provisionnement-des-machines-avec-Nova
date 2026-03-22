import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders VM Marketplace brand', () => {
  render(<App />);
  const brand = screen.getByText(/VM Marketplace/i);
  expect(brand).toBeInTheDocument();
});

test('renders navigation links', () => {
  render(<App />);
  expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
  expect(screen.getByText(/Marketplace/i)).toBeInTheDocument();
});
