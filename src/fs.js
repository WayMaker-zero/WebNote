// File System Access helpers (Chromium browsers)

export async function pickDirectory() {
  if (!('showDirectoryPicker' in window)) {
    throw new Error('当前浏览器不支持目录访问（需 Chrome/Edge）。');
  }
  const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
  return dirHandle;
}

export async function scanDirectory(dirHandle, { includeExtensions = ['.md', '.markdown'] } = {}) {
  async function scan(handle, path = '') {
    const node = { type: 'directory', name: path || '/', handle, children: [] };
    for await (const [name, child] of handle.entries()) {
      if (child.kind === 'directory') {
        const sub = await scan(child, name);
        sub.name = name;
        node.children.push(sub);
      } else if (child.kind === 'file') {
        const lower = name.toLowerCase();
        const match = includeExtensions.some(ext => lower.endsWith(ext));
        if (match) {
          node.children.push({ type: 'file', name, handle: child });
        }
      }
    }
    // sort: dirs first then files
    node.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return node;
  }
  return await scan(dirHandle, '');
}

export async function readFile(fileHandle) {
  const file = await fileHandle.getFile();
  const text = await file.text();
  return { content: text, lastModified: file.lastModified, size: file.size };
}

export async function writeFile(fileHandle, content) {
  const writable = await fileHandle.createWritable();
  await writable.truncate(0);
  await writable.write(content);
  await writable.close();
  const file = await fileHandle.getFile();
  return { lastModified: file.lastModified, size: file.size };
}

export async function createFile(dirHandle, name, content = '') {
  // ensure extension
  if (!/\.(md|markdown)$/i.test(name)) name = `${name}.md`;
  const fileHandle = await dirHandle.getFileHandle(name, { create: true });
  await writeFile(fileHandle, content);
  return fileHandle;
}

