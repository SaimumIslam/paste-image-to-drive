// Paste Image to Drive — Ctrl+V an image in a Google Drive folder to upload it there.
// Works by handing the pasted file to Drive's own drag-and-drop uploader,
// so it lands in whatever folder is currently open. No OAuth/API setup needed.
(() => {
  if (window.__drivePasteImageLoaded) return;
  window.__drivePasteImageLoaded = true;

  const EXT = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif',
    'image/webp': 'webp', 'image/bmp': 'bmp', 'image/svg+xml': 'svg',
  };

  const isEditable = (el) =>
    !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

  const inFolderView = () => /\/drive\//.test(location.pathname);

  const stamp = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
           `${p(d.getHours())}.${p(d.getMinutes())}.${p(d.getSeconds())}`;
  };

  function imagesFrom(cd) {
    const out = [];
    for (const item of cd?.items || []) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) out.push(f);
      }
    }
    return out;
  }

  // Screenshots come in as "image.png" — give them a useful, unique name.
  // Real files copied from the file manager keep their own name.
  function named(files) {
    const ts = stamp();
    return files.map((f, i) => {
      if (f.name && !/^image\.\w+$/i.test(f.name)) return f;
      const suffix = files.length > 1 ? ` (${i + 1})` : '';
      const ext = EXT[f.type] || 'png';
      return new File([f], `Pasted image ${ts}${suffix}.${ext}`, {
        type: f.type, lastModified: Date.now(),
      });
    });
  }

  // Drop onto the main list container itself (never onto a folder tile,
  // which would upload into that sub-folder instead).
  function dropTarget() {
    return document.querySelector('[role="main"]') || document.body;
  }

  function uploadViaDrop(files) {
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    const target = dropTarget();
    const r = target.getBoundingClientRect();
    const opts = {
      bubbles: true, cancelable: true, composed: true, dataTransfer: dt,
      clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
    };
    ['dragenter', 'dragover', 'drop'].forEach((type) =>
      target.dispatchEvent(new DragEvent(type, opts))
    );
  }

  function toast(msg) {
    const el = document.createElement('div');
    el.textContent = msg;
    Object.assign(el.style, {
      position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
      background: '#202124', color: '#fff', padding: '10px 18px', borderRadius: '8px',
      font: '14px/1.4 system-ui, sans-serif', zIndex: 2147483647,
      boxShadow: '0 4px 12px rgba(0,0,0,.3)', transition: 'opacity .3s',
    });
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; }, 2200);
    setTimeout(() => el.remove(), 2600);
  }

  window.addEventListener('paste', (e) => {
    if (!inFolderView() || isEditable(document.activeElement)) return;
    const images = imagesFrom(e.clipboardData);
    if (!images.length) return; // let Drive handle normal paste

    e.preventDefault();
    e.stopImmediatePropagation();

    const files = named(images);
    uploadViaDrop(files);
    toast(files.length === 1 ? `Uploading ${files[0].name}` : `Uploading ${files.length} images`);
  }, true);
})();
