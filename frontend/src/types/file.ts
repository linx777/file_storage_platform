export interface File {
  id: string;
  original_filename: string;
  file_type: string;
  size: number;
  uploaded_at: string;
  file: string;
  is_duplicate: boolean;
  storage_saved: number;
  reference_count: number;
  original_file: string | null;
  total_space_saved: number;
  duplicate_ids: string[];
}

export interface FileFilters {
  filename?: string;
  file_type?: string;
  min_size?: number;
  max_size?: number;
  uploaded_after?: string;
  uploaded_before?: string;
}

export interface StorageSavings {
  total_bytes_saved: number;
  total_mb_saved: number;
  total_files: number;
  duplicate_files: number;
  original_files: number;
}