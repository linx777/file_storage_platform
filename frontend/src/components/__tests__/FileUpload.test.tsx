import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FileUpload } from '../FileUpload';
import { fileService } from '../../services/fileService';
import { File as FileType } from '../../types/file';

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

describe('FileUpload', () => {
  const mockOnUploadSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnUploadSuccess.mockClear();
  });

  it('renders upload interface correctly', () => {
    renderWithQueryClient(<FileUpload onUploadSuccess={mockOnUploadSuccess} />);

    expect(screen.getByText('Upload File')).toBeInTheDocument();
    expect(screen.getByText('Upload a file')).toBeInTheDocument();
    expect(screen.getByText('or drag and drop')).toBeInTheDocument();
    expect(screen.getByText('Any file up to 10MB')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument();
  });

  it('handles file selection', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<FileUpload onUploadSuccess={mockOnUploadSuccess} />);

    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const input = screen.getByLabelText(/upload a file/i);

    await user.upload(input, file);

    expect(screen.getByText('Selected: test.txt')).toBeInTheDocument();
  });

  it('enables upload button when file is selected', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<FileUpload onUploadSuccess={mockOnUploadSuccess} />);

    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const input = screen.getByLabelText(/upload a file/i);

    await user.upload(input, file);

    const uploadButton = screen.getByRole('button', { name: /upload/i });
    expect(uploadButton).toBeEnabled();
  });

  it('shows error when trying to upload without selecting a file', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<FileUpload onUploadSuccess={mockOnUploadSuccess} />);

    // The button should be disabled when no file is selected
    const uploadButton = screen.getByRole('button', { name: /upload/i });
    expect(uploadButton).toBeDisabled();
  });

  it('handles successful file upload', async () => {
    const user = userEvent.setup();
    const mockFile: FileType = {
      id: '123',
      original_filename: 'test.txt',
      file_type: 'text/plain',
      size: 1024,
      uploaded_at: '2023-01-01T00:00:00Z',
      file: 'http://example.com/test.txt',
      is_duplicate: false,
      reference_count: 1,
      original_file: null,
      total_space_saved: 0,
      duplicate_ids: [],
      storage_saved: 0,
    };

    mockedFileService.uploadFile.mockResolvedValue(mockFile);

    renderWithQueryClient(<FileUpload onUploadSuccess={mockOnUploadSuccess} />);

    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const input = screen.getByLabelText(/upload a file/i);
    await user.upload(input, file);

    const uploadButton = screen.getByRole('button', { name: /upload/i });
    await user.click(uploadButton);

    await waitFor(() => {
      expect(mockedFileService.uploadFile).toHaveBeenCalledWith(file);
      expect(mockOnUploadSuccess).toHaveBeenCalled();
    });
  });

  it('shows duplicate notification when duplicate file is uploaded', async () => {
    const user = userEvent.setup();
    const mockFile: FileType = {
      id: '123',
      original_filename: 'test.txt',
      file_type: 'text/plain',
      size: 1024 * 1024, // 1MB
      uploaded_at: '2023-01-01T00:00:00Z',
      file: 'http://example.com/test.txt',
      is_duplicate: true,
      original_file: '456',
      reference_count: 1,
      total_space_saved: 1024 * 1024,
      duplicate_ids: [],
      storage_saved: 1024 * 1024,
    };

    mockedFileService.uploadFile.mockResolvedValue(mockFile);

    renderWithQueryClient(<FileUpload onUploadSuccess={mockOnUploadSuccess} />);

    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const input = screen.getByLabelText(/upload a file/i);
    await user.upload(input, file);

    const uploadButton = screen.getByRole('button', { name: /upload/i });
    await user.click(uploadButton);

    await waitFor(() => {
      expect(screen.getByText(/duplicate detected/i)).toBeInTheDocument();
      expect(screen.getByText(/saved 1 mb/i)).toBeInTheDocument();
    });
  });

  it('handles upload errors', async () => {
    const user = userEvent.setup();
    const mockError: any = new Error('Upload failed');
    mockError.response = { data: { error: 'File too large' } };
    mockedFileService.uploadFile.mockRejectedValue(mockError);

    renderWithQueryClient(<FileUpload onUploadSuccess={mockOnUploadSuccess} />);

    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const input = screen.getByLabelText(/upload a file/i);
    await user.upload(input, file);

    const uploadButton = screen.getByRole('button', { name: /upload/i });
    await user.click(uploadButton);

    await waitFor(() => {
      expect(screen.getByText('File too large')).toBeInTheDocument();
    });
  });

  it('handles rate limiting errors', async () => {
    const user = userEvent.setup();
    const mockError: any = new Error('Rate limited');
    mockError.response = { 
      status: 429, 
      data: { error: 'Rate limit exceeded' } 
    };
    mockedFileService.uploadFile.mockRejectedValue(mockError);

    renderWithQueryClient(<FileUpload onUploadSuccess={mockOnUploadSuccess} />);

    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const input = screen.getByLabelText(/upload a file/i);
    await user.upload(input, file);

    const uploadButton = screen.getByRole('button', { name: /upload/i });
    await user.click(uploadButton);

    await waitFor(() => {
      expect(screen.getByText(/rate limit exceeded/i)).toBeInTheDocument();
    });
  });

  it('handles drag and drop interface', () => {
    renderWithQueryClient(<FileUpload onUploadSuccess={mockOnUploadSuccess} />);

    const dropZone = screen.getByText('or drag and drop').closest('div');
    expect(dropZone?.parentElement?.parentElement).toHaveClass('border-dashed');
  });

  it('disables upload button during upload', async () => {
    const user = userEvent.setup();
    let resolveUpload: (value: any) => void;
    const uploadPromise = new Promise((resolve) => {
      resolveUpload = resolve;
    });
    mockedFileService.uploadFile.mockReturnValue(uploadPromise);

    renderWithQueryClient(<FileUpload onUploadSuccess={mockOnUploadSuccess} />);

    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const input = screen.getByLabelText(/upload a file/i);
    await user.upload(input, file);

    const uploadButton = screen.getByRole('button', { name: /upload/i });
    await user.click(uploadButton);

    expect(uploadButton).toBeDisabled();
    expect(screen.getByText('Uploading...')).toBeInTheDocument();

    resolveUpload!({ id: '123', original_filename: 'test.txt' });

    // After successful upload, the button should be disabled again because no file is selected
    await waitFor(() => {
      expect(uploadButton).toBeDisabled();
    }, { timeout: 3000 });
  });

  it('clears error when new file is selected', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<FileUpload onUploadSuccess={mockOnUploadSuccess} />);

    // First, create an error by mocking a failed upload
    const mockError: any = new Error('Upload failed');
    mockError.response = { data: { error: 'Test error' } };
    mockedFileService.uploadFile.mockRejectedValueOnce(mockError);

    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const input = screen.getByLabelText(/upload a file/i);
    await user.upload(input, file);

    const uploadButton = screen.getByRole('button', { name: /upload/i });
    await user.click(uploadButton);

    await waitFor(() => {
      expect(screen.getByText('Test error')).toBeInTheDocument();
    });

    // Now select a new file, which should clear the error
    const newFile = new File(['new content'], 'new.txt', { type: 'text/plain' });
    await user.upload(input, newFile);

    expect(screen.queryByText('Test error')).not.toBeInTheDocument();
  });

  it('disables file input during upload', async () => {
    const user = userEvent.setup();
    let resolveUpload: (value: any) => void;
    const uploadPromise = new Promise((resolve) => {
      resolveUpload = resolve;
    });
    mockedFileService.uploadFile.mockReturnValue(uploadPromise);

    renderWithQueryClient(<FileUpload onUploadSuccess={mockOnUploadSuccess} />);

    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const input = screen.getByLabelText(/upload a file/i);
    await user.upload(input, file);

    const uploadButton = screen.getByRole('button', { name: /upload/i });
    await user.click(uploadButton);

    expect(input).toBeDisabled();

    resolveUpload!({ id: '123', original_filename: 'test.txt' });

    await waitFor(() => {
      expect(input).not.toBeDisabled();
    });
  });
});
