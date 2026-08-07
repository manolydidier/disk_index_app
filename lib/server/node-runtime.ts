import 'server-only';

type BuiltinGetter = NodeJS.Process & {
  getBuiltinModule?: (id: string) => any;
};

function getBuiltin(id: string) {
  const getter = (process as BuiltinGetter).getBuiltinModule;

  if (!getter) {
    throw new Error(
      'process.getBuiltinModule est requis. Utilise Node.js 22+.'
    );
  }

  const moduleValue = getter(id);

  if (!moduleValue) {
    throw new Error(`Module builtin introuvable: ${id}`);
  }

  return moduleValue;
}

export function getFsPromises() {
  return getBuiltin('fs/promises') as {
    access: (...args: any[]) => Promise<any>;
    lstat: (...args: any[]) => Promise<any>;
    opendir: (...args: any[]) => Promise<any>;
    readdir: (...args: any[]) => Promise<any>;
    statfs: (
      path: string,
      options?: { bigint?: boolean }
    ) => Promise<{ blocks: bigint; bavail: bigint; bsize: bigint }>;
  };
}

export function getFs() {
  return getBuiltin('fs') as {
    watch: (...args: any[]) => {
      close: () => void;
      on?: (event: string, listener: (...args: any[]) => void) => any;
    };
  };
}

export function getPath() {
  return getBuiltin('path') as {
    join: (...args: string[]) => string;
    resolve: (...args: string[]) => string;
    basename: (value: string) => string;
    relative: (from: string, to: string) => string;
    extname: (value: string) => string;
    dirname: (value: string) => string;
    sep: string;
  };
}

export function getChildProcess() {
  return getBuiltin('child_process') as {
    spawn: (...args: any[]) => any;
  };
}