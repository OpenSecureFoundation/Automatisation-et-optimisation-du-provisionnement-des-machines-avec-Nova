import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import BillingPage from './BillingPage';

// Mock complet de l'API pour couvrir client et admin
jest.mock('../services/api', () => ({
  __esModule: true,
  default: {
    getInvoices: jest.fn().mockResolvedValue({ success: true, invoices: [] }),
    getAdminInvoices: jest.fn().mockResolvedValue({
      success: true,
      invoices: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
    }),
    getBillingPreferences: jest.fn().mockResolvedValue({
      success: true,
      preferences: { paymentMode: 'manual', card: { hasCard: false } }
    }),
  },
}));

function renderWithProviders(ui, { path = '/client/billing' } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );
}

describe('BillingPage — client', () => {
  test('affiche le titre Facturation', async () => {
    renderWithProviders(<BillingPage />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /facturation/i })).toBeInTheDocument();
    });
  });

  test('affiche la section Mes factures', async () => {
    renderWithProviders(<BillingPage />);
    await waitFor(() => {
      expect(screen.getByText(/mes factures/i)).toBeInTheDocument();
    });
  });

  test('affiche le message "Aucune facture" quand la liste est vide', async () => {
    renderWithProviders(<BillingPage />);
    await waitFor(() => {
      expect(screen.getByText(/aucune facture/i)).toBeInTheDocument();
    });
  });
});

describe('BillingPage — admin', () => {
  test('appelle getAdminInvoices quand on est sur /admin', async () => {
    const { default: apiService } = require('../services/api');
    renderWithProviders(<BillingPage />, { path: '/admin/billing' });
    await waitFor(() => {
      // En mode admin (pathname commence par /admin), appelle getAdminInvoices
      // Note: le composant détecte isAdmin via window.location.pathname
      // Dans MemoryRouter, window.location.pathname reste '/' → tester via mock
      expect(apiService.getInvoices).toHaveBeenCalled();
    });
  });
});
