import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StorageSavings } from '../StorageSavings';
import { fileService } from '../../services/fileService';
import { StorageSavings as StorageSavingsType } from '../../types/file';

// Mock the fileService
jest.mock('../../services/fileService');
const mockedFileService = fileService as any;

// Mock React Query
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('StorageSavings', () => {
  const mockStorageSavings: StorageSavingsType = {
    total_bytes_saved: 1024 * 1024 * 5, // 5MB
    total_mb_saved: 5.0,
    total_files: 100,
    duplicate_files: 25,
    original_files: 75,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedFileService.getStorageSavings.mockResolvedValue(mockStorageSavings);
  });

  it('renders storage savings information correctly', async () => {
    renderWithQueryClient(<StorageSavings />);

    await waitFor(() => {
      expect(screen.getByText('Storage Savings')).toBeInTheDocument();
      expect(screen.getByText('5 MB')).toBeInTheDocument();
      expect(screen.getByText(/25/)).toBeInTheDocument();
      expect(screen.getByText(/75/)).toBeInTheDocument();
    });
  });

  it('formats large storage savings correctly', async () => {
    const largeSavings: StorageSavingsType = {
      ...mockStorageSavings,
      total_bytes_saved: 1024 * 1024 * 1024 * 2, // 2GB
      total_mb_saved: 2048.0,
    };
    mockedFileService.getStorageSavings.mockResolvedValue(largeSavings);

    renderWithQueryClient(<StorageSavings />);

    await waitFor(() => {
      expect(screen.getByText('2 GB')).toBeInTheDocument();
    });
  });

  it('handles zero storage savings', async () => {
    const zeroSavings: StorageSavingsType = {
      total_bytes_saved: 0,
      total_mb_saved: 0,
      total_files: 0,
      duplicate_files: 0,
      original_files: 0,
    };
    mockedFileService.getStorageSavings.mockResolvedValue(zeroSavings);

    renderWithQueryClient(<StorageSavings />);

    await waitFor(() => {
      expect(screen.getByText('0 B')).toBeInTheDocument();
      expect(screen.getByText(/0 duplicates/)).toBeInTheDocument();
      expect(screen.getByText(/0 originals/)).toBeInTheDocument();
    });
  });

  it('shows loading state', async () => {
    let resolveSavings: (value: StorageSavingsType) => void;
    const savingsPromise = new Promise<StorageSavingsType>((resolve) => {
      resolveSavings = resolve;
    });
    mockedFileService.getStorageSavings.mockReturnValue(savingsPromise);

    renderWithQueryClient(<StorageSavings />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    resolveSavings!(mockStorageSavings);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });
  });

  it('displays correct statistics labels', async () => {
    renderWithQueryClient(<StorageSavings />);

    await waitFor(() => {
      expect(screen.getByText('Total Storage Saved')).toBeInTheDocument();
      expect(screen.getByText('Deduplication Stats')).toBeInTheDocument();
    });
  });

  it('handles decimal storage savings', async () => {
    const decimalSavings: StorageSavingsType = {
      ...mockStorageSavings,
      total_bytes_saved: 1024 * 512, // 0.5MB
      total_mb_saved: 0.5,
    };
    mockedFileService.getStorageSavings.mockResolvedValue(decimalSavings);

    renderWithQueryClient(<StorageSavings />);

    await waitFor(() => {
      expect(screen.getByText('512 KB')).toBeInTheDocument();
    });
  });

  it('displays file count statistics correctly', async () => {
    const fileCounts: StorageSavingsType = {
      ...mockStorageSavings,
      total_files: 1000,
      duplicate_files: 300,
      original_files: 700,
    };
    mockedFileService.getStorageSavings.mockResolvedValue(fileCounts);

    renderWithQueryClient(<StorageSavings />);

    await waitFor(() => {
      expect(screen.getByText(/300/)).toBeInTheDocument();
      expect(screen.getByText(/700/)).toBeInTheDocument();
    });
  });

  it('refreshes data when component mounts', async () => {
    renderWithQueryClient(<StorageSavings />);

    await waitFor(() => {
      expect(mockedFileService.getStorageSavings).toHaveBeenCalledTimes(1);
    });
  });

  it('displays savings in appropriate units', async () => {
    const kbSavings: StorageSavingsType = {
      ...mockStorageSavings,
      total_bytes_saved: 1024 * 100, // 100KB
      total_mb_saved: 0.1,
    };
    mockedFileService.getStorageSavings.mockResolvedValue(kbSavings);

    renderWithQueryClient(<StorageSavings />);

    await waitFor(() => {
      expect(screen.getByText('102.4 KB')).toBeInTheDocument();
    });
  });
});
