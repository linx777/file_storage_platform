import axios from 'axios';
import { File as FileType, FileFilters, StorageSavings } from '../types/file';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

export const fileService = {
    async uploadFile(file: File): Promise<FileType> {
        const formData = new FormData();
        formData.append('file', file);

        const response = await axios.post(`${API_URL}/files/`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    async getFile(id: string): Promise<FileType> {
        const response = await axios.get(`${API_URL}/files/${id}/`);
        return response.data;
    },

    async getFiles(filters?: FileFilters, page: number = 1, pageSize: number = 50): Promise<{
        results: FileType[];
        count: number;
        next: string | null;
        previous: string | null;
        page: number;
        total_pages: number;
    }> {
        const params = new URLSearchParams();
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                // Only add non-empty, non-undefined, non-null values
                if (value !== undefined && value !== null && value !== '') {
                    // Handle datetime formatting
                    if (key === 'uploaded_after' || key === 'uploaded_before') {
                        // Ensure datetime is in ISO format without timezone
                        const date = new Date(value);
                        const isoString = date.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM format
                        params.append(key, isoString);
                    } else {
                        params.append(key, value.toString());
                    }
                }
            });
        }
        
        // Add pagination parameters
        params.append('page', page.toString());
        params.append('page_size', pageSize.toString());
        
        // Add cache busting parameter to ensure fresh data
        params.append('_t', Date.now().toString());
        
        const response = await axios.get(`${API_URL}/files/?${params.toString()}`);
        return response.data;
    },

    async deleteFile(id: string): Promise<void> {
        await axios.delete(`${API_URL}/files/${id}/`);
    },

    async downloadFile(fileUrl: string, filename: string): Promise<void> {
        const response = await axios.get(fileUrl, {
            responseType: 'blob',
        });
        
        const blob = new Blob([response.data]);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    },

    async getStorageSavings(): Promise<StorageSavings> {
        // Add cache busting parameter
        const params = new URLSearchParams();
        params.append('_t', Date.now().toString());
        
        const response = await axios.get(`${API_URL}/files/storage_savings/?${params.toString()}`);
        return response.data;
    },

    async refreshFileStatus(): Promise<any> {
        const response = await axios.get(`${API_URL}/files/refresh_file_status/`);
        return response.data;
    }
};