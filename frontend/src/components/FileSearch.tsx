import React, { useState } from 'react';
import { FileFilters } from '../types/file';

interface FileSearchProps {
    onSearch: (filters: FileFilters) => void;
    currentFilters: FileFilters;
}

export const FileSearch: React.FC<FileSearchProps> = ({ onSearch, currentFilters }) => {
    const [localFilters, setLocalFilters] = useState<FileFilters>({});
    const [minSizeUnit, setMinSizeUnit] = useState<'bytes' | 'kb' | 'mb'>('bytes');
    const [maxSizeUnit, setMaxSizeUnit] = useState<'bytes' | 'kb' | 'mb'>('bytes');

    const convertToBytes = (value: number, unit: 'bytes' | 'kb' | 'mb'): number => {
        switch (unit) {
            case 'kb': return value * 1024;
            case 'mb': return value * 1024 * 1024;
            default: return value;
        }
    };

    const convertFromBytes = (bytes: number, unit: 'bytes' | 'kb' | 'mb'): number => {
        switch (unit) {
            case 'kb': return Math.round(bytes / 1024);
            case 'mb': return Math.round(bytes / (1024 * 1024));
            default: return bytes;
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const processedFilters = { ...localFilters };
        
        if (localFilters.min_size !== undefined) {
            processedFilters.min_size = convertToBytes(localFilters.min_size, minSizeUnit);
        }
        
        if (localFilters.max_size !== undefined) {
            processedFilters.max_size = convertToBytes(localFilters.max_size, maxSizeUnit);
        }
        
        if (processedFilters.min_size !== undefined && processedFilters.max_size !== undefined) {
            if (processedFilters.min_size > processedFilters.max_size) {
                alert('Minimum size cannot be greater than maximum size');
                return;
            }
        }
        
        // Merge with current filters (additive search)
        const mergedFilters = { ...currentFilters, ...processedFilters };
        
        // Remove undefined values
        Object.keys(mergedFilters).forEach(key => {
            if (mergedFilters[key as keyof FileFilters] === undefined) {
                delete mergedFilters[key as keyof FileFilters];
            }
        });
        
        onSearch(mergedFilters);
        
        // Clear local form after search
        setLocalFilters({});
    };

    const handleClearFilters = () => {
        setLocalFilters({});
        onSearch({});
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-white rounded-lg shadow">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Filename</label>
                    <input
                        type="text"
                        placeholder="Search by filename..."
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        value={localFilters.filename || ''}
                        onChange={(e) => {
                            const value = e.target.value.trim();
                            setLocalFilters({ 
                                ...localFilters, 
                                filename: value || undefined 
                            });
                        }}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">File Type</label>
                    <input
                        type="text"
                        placeholder="e.g., pdf, image, text..."
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        value={localFilters.file_type || ''}
                        onChange={(e) => {
                            const value = e.target.value.trim();
                            setLocalFilters({ 
                                ...localFilters, 
                                file_type: value || undefined 
                            });
                        }}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Min Size</label>
                    <div className="mt-1 flex rounded-md shadow-sm">
                        <input
                            type="number"
                            min="0"
                            className="flex-1 rounded-l-md border-gray-300 focus:border-primary-500 focus:ring-primary-500"
                            placeholder="0"
                            value={localFilters.min_size || ''}
                            onChange={(e) => {
                                const value = e.target.value;
                                setLocalFilters({ 
                                    ...localFilters, 
                                    min_size: value ? parseInt(value) : undefined 
                                });
                            }}
                        />
                        <select
                            value={minSizeUnit}
                            className="rounded-r-md border-l-0 border-gray-300 bg-gray-50 text-gray-500 text-sm"
                            onChange={(e) => {
                                const newUnit = e.target.value as 'bytes' | 'kb' | 'mb';
                                setMinSizeUnit(newUnit);
                                
                                if (localFilters.min_size !== undefined) {
                                    const bytesValue = convertToBytes(localFilters.min_size, minSizeUnit);
                                    const newDisplayValue = convertFromBytes(bytesValue, newUnit);
                                    setLocalFilters({ 
                                        ...localFilters, 
                                        min_size: newDisplayValue 
                                    });
                                }
                            }}
                        >
                            <option value="bytes">bytes</option>
                            <option value="kb">KB</option>
                            <option value="mb">MB</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Max Size</label>
                    <div className="mt-1 flex rounded-md shadow-sm">
                        <input
                            type="number"
                            min="0"
                            className="flex-1 rounded-l-md border-gray-300 focus:border-primary-500 focus:ring-primary-500"
                            placeholder="∞"
                            value={localFilters.max_size || ''}
                            onChange={(e) => {
                                const value = e.target.value;
                                setLocalFilters({ 
                                    ...localFilters, 
                                    max_size: value ? parseInt(value) : undefined 
                                });
                            }}
                        />
                        <select
                            value={maxSizeUnit}
                            className="rounded-r-md border-l-0 border-gray-300 bg-gray-50 text-gray-500 text-sm"
                            onChange={(e) => {
                                const newUnit = e.target.value as 'bytes' | 'kb' | 'mb';
                                setMaxSizeUnit(newUnit);
                                
                                if (localFilters.max_size !== undefined) {
                                    const bytesValue = convertToBytes(localFilters.max_size, maxSizeUnit);
                                    const newDisplayValue = convertFromBytes(bytesValue, newUnit);
                                    setLocalFilters({ 
                                        ...localFilters, 
                                        max_size: newDisplayValue 
                                    });
                                }
                            }}
                        >
                            <option value="bytes">bytes</option>
                            <option value="kb">KB</option>
                            <option value="mb">MB</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Uploaded After</label>
                    <input
                        type="datetime-local"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        value={localFilters.uploaded_after || ''}
                        onChange={(e) => {
                            const value = e.target.value;
                            setLocalFilters({ 
                                ...localFilters, 
                                uploaded_after: value || undefined 
                            });
                        }}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Uploaded Before</label>
                    <input
                        type="datetime-local"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        value={localFilters.uploaded_before || ''}
                        onChange={(e) => {
                            const value = e.target.value;
                            setLocalFilters({ 
                                ...localFilters, 
                                uploaded_before: value || undefined 
                            });
                        }}
                    />
                </div>
            </div>
            
            {/* Current Active Filters Display */}
            {Object.keys(currentFilters).length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-blue-900 mb-2">Current Active Filters:</h4>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(currentFilters).map(([key, value]) => {
                            if (!value) return null;
                            const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                            return (
                                <span key={key} className="inline-block bg-blue-100 text-blue-800 rounded-full px-2 py-1 text-xs">
                                    {label}: {value}
                                </span>
                            );
                        })}
                    </div>
                </div>
            )}
            
            <div className="flex justify-between">
                <div className="flex space-x-2">
                    <button
                        type="button"
                        onClick={handleClearFilters}
                        className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                        Clear All Filters
                    </button>
                </div>
                <button
                    type="submit"
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                    Search
                </button>
            </div>
        </form>
    );
};