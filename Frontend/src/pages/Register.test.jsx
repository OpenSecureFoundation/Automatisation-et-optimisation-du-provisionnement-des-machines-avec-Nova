import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import Register from './Register';

function renderWithProviders(ui) {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {ui}
      </AuthProvider>
    </BrowserRouter>
  );
}

describe('Register', () => {
  test('affiche le titre Créer un compte', () => {
    renderWithProviders(<Register />);
    expect(screen.getByRole('heading', { name: /créer un compte/i })).toBeInTheDocument();
  });

  test('affiche les champs email, nom et mot de passe', () => {
    renderWithProviders(<Register />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nom/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mot de passe/i)).toBeInTheDocument();
  });

  test('affiche le bouton S\'inscrire', () => {
    renderWithProviders(<Register />);
    expect(screen.getByRole('button', { name: /s'inscrire/i })).toBeInTheDocument();
  });

  test('affiche le lien vers la connexion', () => {
    renderWithProviders(<Register />);
    const link = screen.getByRole('link', { name: /se connecter/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/login');
  });
});
