import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import CreateVM from './CreateVM';
import { AuthProvider } from '../context/AuthContext';

jest.mock('../services/api', () => ({
  __esModule: true,
  default: {
    getFlavors: jest.fn().mockResolvedValue({ flavors: [{ id: 'f1', name: 'm1.small', vcpus: 1, ram: 2048, disk: 20 }] }),
    getImages: jest.fn().mockResolvedValue({ images: [{ id: 'img1', name: 'Ubuntu 22.04' }] }),
    getNetworks: jest.fn().mockResolvedValue({ networks: [] }),
  },
}));

function renderWithProviders(ui) {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {ui}
      </AuthProvider>
    </BrowserRouter>
  );
}

describe('CreateVM', () => {
  test('affiche le formulaire après chargement', async () => {
    renderWithProviders(<CreateVM />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /créer la vm/i })).toBeInTheDocument();
    });
  });

  test('affiche le champ nom de la VM', async () => {
    renderWithProviders(<CreateVM />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/mon-serveur-web/i)).toBeInTheDocument();
    });
  });
});
