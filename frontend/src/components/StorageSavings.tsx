import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fileService } from '../services/fileService';
import { formatStorageSize } from '../utils/fileUtils';

export const StorageSavings: React.FC = () => {
    const { data: savings, isLoading } = useQuery({
        queryKey: ['storage-savings'],
        queryFn: fileService.getStorageSavings,
        refetchInterval: 2000,
        staleTime: 500,
        refetchOnWindowFocus: true,
    });

    if (isLoading) return <div>Loading savings...</div>;

    return (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h3 className="text-lg font-medium text-gray-900">Storage Savings</h3>
            <dl className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div className="px-4 py-5 bg-gray-50 shadow rounded-lg overflow-hidden sm:p-6">
                    <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Storage Saved
                    </dt>
                    <dd className="mt-1 text-3xl font-semibold text-gray-900">
                        {formatStorageSize(savings?.total_mb_saved || 0)}
                    </dd>
                </div>
                <div className="px-4 py-5 bg-gray-50 shadow rounded-lg overflow-hidden sm:p-6">
                    <dt className="text-sm font-medium text-gray-500 truncate">
                        Deduplication Stats
                    </dt>
                    <dd className="mt-1 text-xl font-semibold text-gray-900">
                        {savings?.duplicate_files || 0} duplicates<br/>
                        {savings?.original_files || 0} originals<br/>
                    </dd>
                </div>
            </dl>
        </div>
    );
};