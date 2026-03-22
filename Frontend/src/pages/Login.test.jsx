import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import Login from './Login';

function renderWithProviders(ui) {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {ui}
      </AuthProvider>
    </BrowserRouter>
  );
}

describe('Login', () => {
  test('affiche le titre Bienvenue', () => {
    renderWithProviders(<Login />);
    expect(screen.getByRole('heading', { name: /bienvenue/i })).toBeInTheDocument();
  });

  test('affiche les champs email et mot de passe', () => {
    renderWithProviders(<Login />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/entrez votre adresse email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mot de passe/i)).toBeInTheDocument();
  });

  test('affiche le bouton Se connecter', () => {
    renderWithProviders(<Login />);
    expect(screen.getByRole('button', { name: /se connecter/i })).toBeInTheDocument();
  });

  test('affiche le lien vers la page d\'inscription', () => {
    renderWithProviders(<Login />);
    const link = screen.getByRole('link', { name: /créer un compte/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/register');
  });
});
