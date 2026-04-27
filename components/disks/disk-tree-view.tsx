import { FolderTree, FileText, Folder } from 'lucide-react';
import type { TreeNode } from '@/types';

export function DiskTreeView({ tree }: { tree: TreeNode[] }) {
  if (tree.length === 0) {
    return <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Aucune donnée indexée pour ce disque.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <FolderTree className="h-4 w-4" />
        Arborescence indexée
      </div>
      <div className="rounded-xl border p-4">
        <ul className="space-y-1">
          {tree.map((node) => (
            <TreeNodeItem key={node.path} node={node} depth={0} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function TreeNodeItem({ node, depth }: { node: TreeNode; depth: number }) {
  return (
    <li>
      <div className="flex items-start gap-2 rounded-md px-2 py-1 hover:bg-muted/50" style={{ paddingLeft: depth * 16 + 8 }}>
        {node.type === 'folder' ? <Folder className="mt-0.5 h-4 w-4 shrink-0" /> : <FileText className="mt-0.5 h-4 w-4 shrink-0" />}
        <div className="min-w-0">
          <div className="break-all text-sm font-medium">{node.name}</div>
          <div className="break-all text-xs text-muted-foreground">{node.path}</div>
        </div>
      </div>
      {node.children?.length ? (
        <ul className="space-y-1">
          {node.children.map((child) => (
            <TreeNodeItem key={child.path} node={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
