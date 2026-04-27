import type { FileEntry } from '@prisma/client';
import type { DiskTreeResponse, TreeNode } from '@/types';

type FlatNode = Pick<FileEntry, 'id' | 'name' | 'fullPath' | 'extension' | 'modifiedAt' | 'size' | 'entryType' | 'parentId'>;

export function buildTreeFromEntries(entries: FlatNode[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  const childrenMap = new Map<string | null, TreeNode[]>();

  for (const entry of entries) {
    const node: TreeNode = {
      id: entry.id,
      type: entry.entryType === 'FILE' ? 'file' : 'folder',
      name: entry.name,
      path: entry.fullPath,
      extension: entry.extension,
      size: entry.size === null ? null : Number(entry.size),
      modified_at: entry.modifiedAt?.toISOString() ?? null,
      children: entry.entryType === 'FOLDER' ? [] : undefined
    };

    nodeMap.set(entry.id, node);
    const parentKey = entry.parentId ?? null;
    const bucket = childrenMap.get(parentKey) ?? [];
    bucket.push(node);
    childrenMap.set(parentKey, bucket);
  }

  for (const entry of entries) {
    if (entry.entryType !== 'FOLDER') continue;
    const folder = nodeMap.get(entry.id);
    if (!folder) continue;
    folder.children = (childrenMap.get(entry.id) ?? []).sort(sortTreeNodes);
  }

  return (childrenMap.get(null) ?? []).sort(sortTreeNodes);
}

function sortTreeNodes(a: TreeNode, b: TreeNode) {
  if (a.type !== b.type) {
    return a.type === 'folder' ? -1 : 1;
  }

  return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
}

export function buildDiskTreeResponse(params: {
  diskId: string;
  diskName: string;
  rootPath: string;
  status: string;
  lastScan: Date | null;
  entries: FlatNode[];
}): DiskTreeResponse {
  return {
    disk_id: params.diskId,
    disk_name: params.diskName,
    root_path: params.rootPath,
    last_scan: params.lastScan?.toISOString() ?? null,
    status: params.status,
    tree: buildTreeFromEntries(params.entries)
  };
}
