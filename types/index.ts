export type TreeNode = {
  id?: string;
  type: 'file' | 'folder';
  name: string;
  path: string;
  extension?: string | null;
  size?: number | null;
  modified_at?: string | null;
  children?: TreeNode[];
};

export type DiskTreeResponse = {
  disk_id: string;
  disk_name: string;
  root_path: string;
  last_scan: string | null;
  status: string;
  tree: TreeNode[];
};
