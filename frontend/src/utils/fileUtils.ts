/**
 * Formats a file size in bytes to a human-readable string with appropriate units
 * @param bytes - Size in bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with appropriate unit
 */
export const formatFileSize = (bytes: number, decimals: number = 2): string => {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Formats a file size in MB to a human-readable string with appropriate units
 * @param mb - Size in megabytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with appropriate unit
 */
export const formatStorageSize = (mb: number, decimals: number = 2): string => {
    if (mb === 0) return '0 B';
    
    const bytes = mb * 1024 * 1024; // Convert MB to bytes
    return formatFileSize(bytes, decimals);
};
