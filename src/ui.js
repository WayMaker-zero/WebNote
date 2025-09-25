export function renderTree(rootNode, { onOpen, selectedPath, expandState } = {}) {
  const container = document.getElementById('tree');
  container.innerHTML = '';

  const isExpanded = (path) => expandState && expandState.get(path);
  const setExpanded = (path, val) => { if (expandState) expandState.set(path, val); };

  function buildDirectory(node, parentPath = '', ul) {
    for (const child of node.children) {
      const currentPath = parentPath ? `${parentPath}/${child.name}` : child.name;
      if (child.type === 'directory') {
        const li = document.createElement('li');
        const row = document.createElement('div');
        row.className = 'node';
        const expanded = !!isExpanded(currentPath);
        row.innerHTML = `<span class="disclosure">${expanded ? '▾' : '▸'}</span><span class="icon">📁</span><span class="name">${child.name}</span>`;
        row.addEventListener('click', (e) => {
          e.stopPropagation();
          const now = !isExpanded(currentPath);
          setExpanded(currentPath, now);
          renderTree(rootNode, { onOpen, selectedPath, expandState });
        });
        li.appendChild(row);
        const sub = document.createElement('ul');
        sub.style.display = expanded ? 'block' : 'none';
        if (expanded) buildDirectory(child, currentPath, sub);
        li.appendChild(sub);
        ul.appendChild(li);
      } else {
        const li = document.createElement('li');
        const row = document.createElement('div');
        row.className = 'node';
        if (selectedPath && selectedPath === currentPath) row.classList.add('active');
        row.innerHTML = `<span class="icon">📝</span><span class="name">${child.name}</span>`;
        row.addEventListener('click', (e) => {
          e.stopPropagation();
          onOpen && onOpen({ ...child, path: currentPath });
          container.querySelectorAll('.node.active').forEach(n => n.classList.remove('active'));
          row.classList.add('active');
        });
        li.appendChild(row);
        ul.appendChild(li);
      }
    }
  }

  if (!rootNode) {
    container.textContent = '尚未选择目录';
    return;
  }
  const rootList = document.createElement('ul');
  buildDirectory(rootNode, '', rootList);
  container.appendChild(rootList);
}

export function setStatus(text) {
  const bar = document.getElementById('statusBar');
  bar.textContent = text;
}
