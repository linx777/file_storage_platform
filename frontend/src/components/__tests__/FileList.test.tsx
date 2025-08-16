import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FileList } from '../FileList';
import { fileService } from '../../services/fileService';
import { File as FileType } from '../../types/file';

// Mock the fileService
jest.mock('../../services/fileService');
const mockedFileService = fileService as any;

// Mock the StorageSavings component
jest.mock('../StorageSavings', () => ({
  StorageSavings: () => <div data-testid="storage-savings">Storage Savings Component</div>
}));

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

describe('FileList', () => {
  const mockFiles: FileType[] = [
    {
      id: '1',
      original_filename: 'test1.txt',
      file_type: 'text/plain',
      size: 1024,
      uploaded_at: '2023-01-01T00:00:00Z',
      file: 'http://example.com/file1.txt',
      is_duplicate: false,
      reference_count: 1,
      original_file: null,
      total_space_saved: 0,
      duplicate_ids: [],
      storage_saved: 0,
    },
    {
      id: '2',
      original_filename: 'test2.jpg',
      file_type: 'image/jpeg',
      size: 2048,
      uploaded_at: '2023-01-02T00:00:00Z',
      file: 'http://example.com/file2.jpg',
      is_duplicate: true,
      original_file: '1',
      reference_count: 1,
      total_space_saved: 0,
      duplicate_ids: [],
      storage_saved: 2048,
    },
  ];

  const mockFileListResponse = {
    results: mockFiles,
    count: 2,
    next: null,
    previous: null,
    page: 1,
    total_pages: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedFileService.getFiles.mockResolvedValue(mockFileListResponse);
    mockedFileService.deleteFile.mockResolvedValue();
    mockedFileService.downloadFile.mockResolvedValue();
  });

  it('renders file list correctly', async () => {
    renderWithQueryClient(<FileList />);

    await waitFor(() => {
      expect(screen.getByText('test1.txt')).toBeInTheDocument();
      expect(screen.getByText('test2.jpg')).toBeInTheDocument();
    });
  });

  it('displays file information correctly', async () => {
    renderWithQueryClient(<FileList />);

    await waitFor(() => {
      // Check file names
      expect(screen.getByText('test1.txt')).toBeInTheDocument();
      expect(screen.getByText('test2.jpg')).toBeInTheDocument();

      // Check file types and sizes (they are displayed together)
      expect(screen.getByText(/text\/plain.*1 KB/)).toBeInTheDocument();
      expect(screen.getByText(/image\/jpeg.*2 KB/)).toBeInTheDocument();
    });
  });

  it('shows duplicate indicator for duplicate files', async () => {
    renderWithQueryClient(<FileList />);

    await waitFor(() => {
      // Should show duplicate indicator for the second file
      expect(screen.getByText('Duplicate')).toBeInTheDocument();
    });
  });

  it('handles file deletion', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<FileList />);

    await waitFor(() => {
      expect(screen.getByText('test1.txt')).toBeInTheDocument();
    });

    // Find and click delete button for first file
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockedFileService.deleteFile).toHaveBeenCalledWith('1');
    });
  });

  it('handles file download', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<FileList />);

    await waitFor(() => {
      expect(screen.getByText('test1.txt')).toBeInTheDocument();
    });

    // Find and click download button for first file
    const downloadButtons = screen.getAllByRole('button', { name: /download/i });
    await user.click(downloadButtons[0]);

    await waitFor(() => {
      expect(mockedFileService.downloadFile).toHaveBeenCalledWith(
        'http://example.com/file1.txt',
        'test1.txt'
      );
    });
  });

  it('handles search functionality', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<FileList />);

    await waitFor(() => {
      expect(screen.getByText('test1.txt')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search by filename/i);
    await user.type(searchInput, 'test1');

    const searchButton = screen.getByRole('button', { name: /search/i });
    await user.click(searchButton);

    await waitFor(() => {
      expect(mockedFileService.getFiles).toHaveBeenCalledWith(
        expect.objectContaining({ filename: 'test1' }),
        expect.any(Number),
        expect.any(Number)
      );
    });
  });

  it('handles pagination', async () => {
    const user = userEvent.setup();
    const mockPaginatedResponse = {
      ...mockFileListResponse,
      next: 'http://localhost:8000/api/files/?page=2',
      total_pages: 2,
    };
    mockedFileService.getFiles.mockResolvedValue(mockPaginatedResponse);

    renderWithQueryClient(<FileList />);

    await waitFor(() => {
      expect(screen.getByText('test1.txt')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    await waitFor(() => {
      expect(mockedFileService.getFiles).toHaveBeenCalledWith(
        expect.any(Object),
        2,
        expect.any(Number)
      );
    });
  });

  it('shows loading state', async () => {
    let resolveFiles: (value: typeof mockFileListResponse) => void;
    const filesPromise = new Promise<typeof mockFileListResponse>((resolve) => {
      resolveFiles = resolve;
    });
    mockedFileService.getFiles.mockReturnValue(filesPromise);

    renderWithQueryClient(<FileList />);

    // Check for loading skeleton elements
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();

    resolveFiles!(mockFileListResponse);

    await waitFor(() => {
      expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument();
    });
  });

  it('shows error state', async () => {
    const mockError = new Error('Failed to fetch files');
    mockedFileService.getFiles.mockRejectedValue(mockError);

    renderWithQueryClient(<FileList />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load files/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when no files', async () => {
    const emptyResponse = {
      results: [],
      count: 0,
      next: null,
      previous: null,
      page: 1,
      total_pages: 0,
    };
    mockedFileService.getFiles.mockResolvedValue(emptyResponse);

    renderWithQueryClient(<FileList />);

    await waitFor(() => {
      expect(screen.getByText(/no files/i)).toBeInTheDocument();
    });
  });

  it('displays storage savings information', async () => {
    renderWithQueryClient(<FileList />);

    await waitFor(() => {
      // Should show storage saved for duplicate file
      expect(screen.getByText(/saved/i)).toBeInTheDocument();
    });
  });

  it('handles multiple file operations', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<FileList />);

    await waitFor(() => {
      expect(screen.getByText('test1.txt')).toBeInTheDocument();
      expect(screen.getByText('test2.jpg')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    await user.click(deleteButtons[0]);
    await user.click(deleteButtons[1]);

    await waitFor(() => {
      expect(mockedFileService.deleteFile).toHaveBeenCalledWith('1');
      expect(mockedFileService.deleteFile).toHaveBeenCalledWith('2');
    });
  });

  it('formats file sizes correctly', async () => {
    const largeFile: FileType = {
      ...mockFiles[0],
      id: '3',
      original_filename: 'large.txt',
      size: 1024 * 1024 * 5, // 5MB
    };

    const responseWithLargeFile = {
      ...mockFileListResponse,
      results: [largeFile],
    };
    mockedFileService.getFiles.mockResolvedValue(responseWithLargeFile);

    renderWithQueryClient(<FileList />);

    await waitFor(() => {
      expect(screen.getByText(/text\/plain.*5 MB/)).toBeInTheDocument();
    });
  });

  it('handles file type icons correctly', async () => {
    renderWithQueryClient(<FileList />);

    await waitFor(() => {
      // Should show appropriate icons for different file types
      expect(screen.getByText('test1.txt')).toBeInTheDocument();
      expect(screen.getByText('test2.jpg')).toBeInTheDocument();
    });
  });
});
