import React, { useState } from 'react';
import { fileService } from '../services/fileService';
import { File as FileType, FileFilters } from '../types/file';
import { DocumentIcon, TrashIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileSearch } from './FileSearch';
import { StorageSavings } from './StorageSavings';
import { formatFileSize } from '../utils/fileUtils';

export const FileList: React.FC = () => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<FileFilters>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: filesData, isLoading, error } = useQuery({
    queryKey: ['files', filters, currentPage, pageSize],
    queryFn: () => fileService.getFiles(filters, currentPage, pageSize),
    staleTime: 500,
    refetchOnWindowFocus: true,
  });

  const files = filesData?.results || [];

  const deleteMutation = useMutation({
    mutationFn: fileService.deleteFile,
    onSuccess: async () => {
      await fileService.refreshFileStatus();
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: ['storage-savings'] });
    },
  });

  const downloadMutation = useMutation({
    mutationFn: ({ fileUrl, filename }: { fileUrl: string; filename: string }) =>
      fileService.downloadFile(fileUrl, filename),
  });

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleDownload = async (fileUrl: string, filename: string) => {
    try {
      await downloadMutation.mutateAsync({ fileUrl, filename });
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const handleSearch = (newFilters: FileFilters) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4" data-testid="loading-skeleton">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">Failed to load files. Please try again.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <StorageSavings />
      <FileSearch onSearch={handleSearch} currentFilters={filters} />
      
      <h2 className="text-xl font-semibold text-gray-900 mb-4 mt-6">
        {Object.keys(filters).length > 0 ? (
          <div>
            <div className="flex items-center">
              <span>Search Results</span>
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({files?.length || 0} file{files?.length !== 1 ? 's' : ''} found)
              </span>
              <button
                onClick={() => setFilters({})}
                className="ml-3 text-sm text-primary-600 hover:text-primary-700 underline"
              >
                Clear Search
              </button>
            </div>
            <div className="mt-2 text-sm text-gray-600">
              {Object.entries(filters).map(([key, value]) => {
                if (!value) return null;
                const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                return (
                  <span key={key} className="inline-block bg-gray-100 rounded-full px-2 py-1 mr-2 mb-1">
                    {label}: {value}
                  </span>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex items-center">
            <span>Uploaded Files</span>
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({files?.length || 0} file{files?.length !== 1 ? 's' : ''})
            </span>
          </div>
        )}
      </h2>
      
      {!files || files.length === 0 ? (
        <div className="text-center py-12">
          <DocumentIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No files</h3>
          <p className="mt-1 text-sm text-gray-500">
            {Object.keys(filters).length > 0 
              ? 'No files match your search criteria'
              : 'Get started by uploading a file'
            }
          </p>
        </div>
      ) : (
        <div className="mt-6 flow-root">
          <ul className="-my-5 divide-y divide-gray-200">
            {files.map((file) => (
              <li key={file.id} className="py-4">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <DocumentIcon className="h-8 w-8 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.original_filename}
                      </p>
                      {file.is_duplicate ? (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                          Duplicate
                        </span>
                      ) : file.reference_count > 1 && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          {file.reference_count} References
                        </span>
                      )}
                      {!file.is_duplicate && file.duplicate_ids && file.duplicate_ids.length > 0 && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          {file.duplicate_ids.length} Duplicates
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {file.file_type} • {formatFileSize(file.size)}
                      {file.storage_saved > 0 && (
                        <span className="ml-2 text-green-600">
                          • Saved {formatFileSize(file.storage_saved)}
                        </span>
                      )}
                      {file.is_duplicate && file.original_file && (
                        <span className="ml-2 text-gray-600">
                          • References original: {file.original_file}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-500">
                      Uploaded {new Date(file.uploaded_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleDownload(file.file, file.original_filename)}
                      disabled={downloadMutation.isPending}
                      className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                      <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                      Download
                    </button>
                    <button
                      onClick={() => handleDelete(file.id)}
                      disabled={deleteMutation.isPending}
                      className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <TrashIcon className="h-4 w-4 mr-1" />
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {filesData && filesData.total_pages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-700">
              Showing {((filesData.page - 1) * pageSize) + 1} to {Math.min(filesData.page * pageSize, filesData.count)} of {filesData.count} files
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="ml-2 text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
              <option value={200}>200 per page</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            
            <span className="text-sm text-gray-700">
              Page {filesData.page} of {filesData.total_pages}
            </span>
            
            <button
              onClick={() => setCurrentPage(Math.min(filesData.total_pages, currentPage + 1))}
              disabled={currentPage === filesData.total_pages}
              className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};