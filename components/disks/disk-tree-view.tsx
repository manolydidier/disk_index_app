'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderTree,
  Search,
  X
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { TreeNode } from '@/types';

type DiskTreeViewProps = {
  tree: TreeNode[];
};

export function DiskTreeView({ tree }: DiskTreeViewProps) {
  const [query, setQuery] = useState('');
  const [expandedPaths, setExpandedPaths] = useState<string[]>([]);
  const [progressVisible, setProgressVisible] = useState(false);
  const [progressValue, setProgressValue] = useState(0);

  const timersRef = useRef<number[]>([]);

  function clearProgressTimers() {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }

  function pulseProgress() {
    clearProgressTimers();

    setProgressVisible(true);
    setProgressValue(18);

    timersRef.current.push(
      window.setTimeout(() => setProgressValue(62), 90)
    );

    timersRef.current.push(
      window.setTimeout(() => setProgressValue(100), 220)
    );

    timersRef.current.push(
      window.setTimeout(() => {
        setProgressVisible(false);
        setProgressValue(0);
      }, 380)
    );
  }

  useEffect(() => {
    const rootFolders = tree
      .filter((node) => node.type === 'folder')
      .map((node) => node.path);

    setExpandedPaths(rootFolders);
  }, [tree]);

  useEffect(() => {
    return () => {
      clearProgressTimers();
    };
  }, []);

  useEffect(() => {
    if (query.trim() === '') return;
    pulseProgress();
  }, [query]);

  const filteredTree = useMemo(() => {
    const trimmed = query.trim().toLowerCase();

    if (!trimmed) return tree;

    return filterTree(tree, trimmed);
  }, [tree, query]);

  const filteredFolderPaths = useMemo(() => {
    return collectFolderPaths(filteredTree);
  }, [filteredTree]);

  const expandedSet = useMemo(() => {
    const base = new Set(expandedPaths);

    if (query.trim()) {
      filteredFolderPaths.forEach((path) => base.add(path));
    }

    return base;
  }, [expandedPaths, filteredFolderPaths, query]);

  const totalVisibleNodes = useMemo(() => {
    return countNodes(filteredTree);
  }, [filteredTree]);

  function toggleFolder(path: string) {
    setExpandedPaths((current) => {
      const next = new Set(current);

      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }

      return Array.from(next);
    });

    pulseProgress();
  }

  function expandAll() {
    setExpandedPaths(collectFolderPaths(tree));
    pulseProgress();
  }

  function collapseAll() {
    setExpandedPaths([]);
    pulseProgress();
  }

  if (tree.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        Aucune donnée indexée pour ce disque.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <FolderTree className="h-4 w-4" />
          Arborescence indexée
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
            {totalVisibleNodes} élément{totalVisibleNodes > 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={expandAll}>
            Ouvrir tout
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={collapseAll}
          >
            Fermer tout
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-background p-4">
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un fichier, un dossier ou un chemin..."
                className="h-10 pl-9 pr-10"
              />

              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    pulseProgress();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                  aria-label="Effacer la recherche"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>

          {progressVisible ? <Progress value={progressValue} className="h-1.5" /> : null}

          {query.trim() ? (
            <p className="text-xs text-muted-foreground">
              Filtre actif : <span className="font-medium">{query}</span>
            </p>
          ) : null}
        </div>

        <div className="mt-4 rounded-xl border bg-muted/10 p-3">
          {filteredTree.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Aucun résultat pour cette recherche.
            </div>
          ) : (
            <ul className="space-y-1">
              {filteredTree.map((node) => (
                <TreeNodeItem
                  key={node.path}
                  node={node}
                  depth={0}
                  expandedSet={expandedSet}
                  onToggle={toggleFolder}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function TreeNodeItem({
  node,
  depth,
  expandedSet,
  onToggle
}: {
  node: TreeNode;
  depth: number;
  expandedSet: Set<string>;
  onToggle: (path: string) => void;
}) {
  const isFolder = node.type === 'folder';
  const isExpanded = isFolder ? expandedSet.has(node.path) : false;

  return (
    <li>
      <div
        className="group flex items-start gap-2 rounded-lg px-2 py-1.5 transition hover:bg-muted/50"
        style={{ paddingLeft: depth * 16 + 8 }}
      >
        {isFolder ? (
          <button
            type="button"
            onClick={() => onToggle(node.path)}
            className="mt-0.5 flex shrink-0 items-center text-muted-foreground transition hover:text-foreground"
            aria-label={isExpanded ? 'Fermer le dossier' : 'Ouvrir le dossier'}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {isFolder ? (
          <Folder className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        ) : (
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        )}

        <div className="min-w-0 flex-1">
          <div className="break-all text-sm font-medium">{node.name}</div>
          <div className="break-all text-xs text-muted-foreground">
            {node.path}
          </div>
        </div>
      </div>

      {isFolder && isExpanded && node.children?.length ? (
        <ul className="space-y-1">
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              expandedSet={expandedSet}
              onToggle={onToggle}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  return nodes
    .map((node) => {
      const selfMatch =
        node.name.toLowerCase().includes(query) ||
        node.path.toLowerCase().includes(query);

      const children = node.children?.length
        ? filterTree(node.children, query)
        : [];

      if (selfMatch) {
        return {
          ...node,
          children: children.length > 0 ? children : node.children
        };
      }

      if (children.length > 0) {
        return {
          ...node,
          children
        };
      }

      return null;
    })
    .filter(Boolean) as TreeNode[];
}

function collectFolderPaths(nodes: TreeNode[]): string[] {
  const result: string[] = [];

  for (const node of nodes) {
    if (node.type === 'folder') {
      result.push(node.path);

      if (node.children?.length) {
        result.push(...collectFolderPaths(node.children));
      }
    }
  }

  return result;
}

function countNodes(nodes: TreeNode[]): number {
  let total = 0;

  for (const node of nodes) {
    total += 1;

    if (node.children?.length) {
      total += countNodes(node.children);
    }
  }

  return total;
}