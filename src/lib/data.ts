import archiveData from '../data/videos.json' with { type: 'json' };

export interface Video {
  id: string;
  category: string;
  title: string;
  filename: string;
  thumbnail?: string;
  description?: string;
  uploadedAt: string;
}

export interface CategoryInfo {
  title: string;
  description: string;
}

export interface ArchiveData {
  categories: Record<string, CategoryInfo>;
  videos: Video[];
}

export function loadArchiveData(): ArchiveData {
  return archiveData as ArchiveData;
}

export async function fetchArchiveData(): Promise<ArchiveData> {
  return loadArchiveData();
}