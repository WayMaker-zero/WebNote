import { pickDirectory, scanDirectory, readFile, writeFile, createFile } from './fs.js';
import { renderTree, setStatus } from './ui.js';
import { renderMarkdown } from './markdown.js';

const state = {
  dirHandle: null,
  tree: null,
  selectedFile: null, // { handle, name, path }
  editorDirty: false,
  lastKnownMTime: null,
  autoSaveTimer: null,
  viewMode: 'render', // 'render' | 'edit'
  expandState: new Map(),
};

const els = {
  btnPickDir: document.getElementById('btnPickDir'),
  btnRefresh: document.getElementById('btnRefresh'),
  btnNewNote: document.getElementById('btnNewNote'),
  btnToggleView: document.getElementById('btnToggleView'),
  btnSave: document.getElementById('btnSave'),
  editor: document.getElementById('editor'),
  editorPane: document.getElementById('editorPane'),
  renderPane: document.getElementById('renderPane'),
  rendered: document.getElementById('rendered'),
  lineNumbers: document.getElementById('lineNumbers'),
};

function enableApp(enabled) {
  els.btnRefresh.disabled = !enabled;
  els.btnNewNote.disabled = !enabled;
  els.btnToggleView.disabled = !enabled;
  els.btnSave.disabled = !enabled || !state.selectedFile;
}

async function chooseDirectory() {
  try {
    state.dirHandle = await pickDirectory();
    await refreshTree('已选择目录，正在加载…');
    enableApp(true);
  } catch (err) {
    console.error(err);
    alert(err.message || '选择目录失败');
  }
}

async function refreshTree(status = '正在刷新…') {
  if (!state.dirHandle) return;
  setStatus(status);
  state.tree = await scanDirectory(state.dirHandle);
  renderTree(state.tree, {
    onOpen: openNode,
    selectedPath: state.selectedFile?.path,
    expandState: state.expandState,
  });
  setStatus('就绪');
}

function getNodePath(node, parent = '') {
  return parent ? `${parent}/${node.name}` : node.name;
}

async function openNode(node) {
  if (node.type !== 'file') return;
  if (!(await maybeHandleUnsaved())) return;
  const { content, lastModified } = await readFile(node.handle);
  state.selectedFile = {
    handle: node.handle,
    name: node.name,
    path: node.path || node.name,
  };
  state.lastKnownMTime = lastModified;
  state.editorDirty = false;
  els.editor.value = content;
  renderCurrent();
  updateButtons();
}

function renderCurrent() {
  const text = els.editor.value;
  if (state.viewMode === 'render') {
    els.renderPane.classList.remove('hidden');
    els.editorPane.classList.add('hidden');
    els.rendered.innerHTML = renderMarkdown(text);
    els.btnToggleView.textContent = '切换为编辑视图';
  } else {
    els.renderPane.classList.add('hidden');
    els.editorPane.classList.remove('hidden');
    els.btnToggleView.textContent = '切换为渲染视图';
  }
  const name = state.selectedFile ? state.selectedFile.name : '未打开文件';
  const dirty = state.editorDirty ? '（未保存）' : '';
  setStatus(`${name} ${dirty}`);
  updateLineNumbers();
}

async function saveCurrent() {
  if (!state.selectedFile) return;
  try {
    const text = els.editor.value;
    const { lastModified } = await writeFile(state.selectedFile.handle, text);
    state.lastKnownMTime = lastModified;
    state.editorDirty = false;
    updateButtons();
    renderCurrent();
  } catch (err) {
    console.error(err);
    alert('保存失败：' + (err.message || '未知错误'));
  }
}

function updateButtons() {
  els.btnSave.disabled = !state.selectedFile || !state.editorDirty;
}

function setupAutoSave() {
  if (state.autoSaveTimer) clearInterval(state.autoSaveTimer);
  state.autoSaveTimer = setInterval(async () => {
    if (state.editorDirty && state.selectedFile) {
      await saveCurrent();
    }
  }, 5 * 60 * 1000); // 5 minutes
}

async function maybeHandleUnsaved() {
  if (!state.editorDirty) return true;
  const choice = confirm('有未保存更改，是否立即保存？\n取消 = 放弃更改');
  if (choice) {
    await saveCurrent();
    return true;
  }
  return true; // allow navigation but discard changes
}

async function handleRefresh() {
  // Detect external changes for the currently open file
  if (state.selectedFile) {
    try {
      const file = await state.selectedFile.handle.getFile();
      const changedOutside = state.lastKnownMTime != null && file.lastModified !== state.lastKnownMTime;
      if (changedOutside && state.editorDirty) {
        const doSave = confirm('检测到本地文件有更改。如果重新加载，网页端更改可能丢失。\n是否先保存网页端更改再重新加载本地文件？');
        if (doSave) await saveCurrent();
      }
      if (changedOutside && !state.editorDirty) {
        // reload file content silently
        const { content, lastModified } = await readFile(state.selectedFile.handle);
        els.editor.value = content;
        state.lastKnownMTime = lastModified;
        state.editorDirty = false;
        renderCurrent();
      }
    } catch (err) {
      console.warn('刷新时检查当前文件失败', err);
    }
  }
  await refreshTree('正在刷新…');
}

async function createNewNote() {
  if (!state.tree) return;
  // Find target directory: if a file is selected, use its parent; else root
  let targetDirHandle = state.dirHandle;
  const filename = prompt('输入新笔记名称（可不含扩展名）：', '未命名.md');
  if (!filename) return;
  try {
    const fileHandle = await createFile(targetDirHandle, filename, '# 新笔记\n\n');
    await refreshTree('已创建，刷新目录…');
    // Open new file
    const { content, lastModified } = await readFile(fileHandle);
    state.selectedFile = { handle: fileHandle, name: filename.endsWith('.md') ? filename : `${filename}.md`, path: filename };
    state.lastKnownMTime = lastModified;
    state.editorDirty = false;
    els.editor.value = content;
    renderCurrent();
    updateButtons();
  } catch (err) {
    console.error(err);
    alert('创建失败：' + (err.message || '未知错误'));
  }
}

function setupEvents() {
  els.btnPickDir.addEventListener('click', chooseDirectory);
  els.btnRefresh.addEventListener('click', handleRefresh);
  els.btnNewNote.addEventListener('click', createNewNote);
  els.btnToggleView.addEventListener('click', () => {
    state.viewMode = state.viewMode === 'render' ? 'edit' : 'render';
    renderCurrent();
  });
  els.btnSave.addEventListener('click', saveCurrent);

  els.editor.addEventListener('input', () => {
    state.editorDirty = true;
    updateButtons();
    if (state.viewMode === 'render') renderCurrent();
    else updateLineNumbers();
  });

  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveCurrent();
    }
  });

  els.editor.addEventListener('scroll', () => {
    els.lineNumbers.scrollTop = els.editor.scrollTop;
  });

  window.addEventListener('focus', () => {
    // On focus, do a light refresh check
    if (state.dirHandle) handleRefresh();
  });
}

function init() {
  setupEvents();
  setupAutoSave();
  renderTree(null, {});
  setStatus('未选择目录');
  enableApp(false);
}

function updateLineNumbers() {
  const text = els.editor.value;
  const lines = text.length ? text.split(/\r?\n/).length : 1;
  let buf = '';
  for (let i = 1; i <= lines; i++) buf += i + "\n";
  els.lineNumbers.textContent = buf;
}

init();
