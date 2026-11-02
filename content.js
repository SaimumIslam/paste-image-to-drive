// Paste Image to Drive — Ctrl/Cmd+V an image in a Google Drive folder to upload it there.
// Works by handing the pasted file to Drive's own drag-and-drop uploader,
// so it lands in whatever folder is currently open. No OAuth/API setup needed.
(() => {
  if (window.__drivePasteImageLoaded) return;
  window.__drivePasteImageLoaded = true;

  // Quiet by default. Enable step-by-step logs from the Drive console with:
  //   localStorage.pasteToDriveDebug = '1'   (then reload)
  let DEBUG = false;
  try { DEBUG = localStorage.getItem('pasteToDriveDebug') === '1'; } catch {}
  const LOG = (...a) => { if (DEBUG) console.log('[Paste Image to Drive]', ...a); };
  const WARN = (...a) => console.warn('[Paste Image to Drive]', ...a);

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

  // ---- Upload via Drive's own "New > File upload" flow ----------------------
  // Drive ignores synthetic drop events, so instead we open its upload menu and
  // intercept the file picker it tries to open, handing it our files directly.
  // The upload then goes into the current folder exactly like a manual upload.

  let pending = null; // { files, done }

  function feed(input) {
    const p = pending;
    pending = null;
    const dt = new DataTransfer();
    p.files.forEach((f) => dt.items.add(f));
    input.files = dt.files;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    LOG('handed files to Drive file input');
    p.done(true);
  }

  const isFileInput = (el) => el instanceof HTMLInputElement && el.type === 'file';

  // Patched at document_start, before Drive's code loads.
  const origClick = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function (...a) {
    if (pending && isFileInput(this)) return feed(this);
    return origClick.apply(this, a);
  };
  const origPicker = HTMLInputElement.prototype.showPicker;
  if (origPicker) {
    HTMLInputElement.prototype.showPicker = function (...a) {
      if (pending && isFileInput(this)) return feed(this);
      return origPicker.apply(this, a);
    };
  }
  const origDispatch = EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent = function (ev) {
    if (pending && ev?.type === 'click' && isFileInput(this)) { feed(this); return true; }
    return origDispatch.call(this, ev);
  };

  function fakeClick(el) {
    const r = el.getBoundingClientRect();
    const o = {
      bubbles: true, cancelable: true, composed: true, view: window, button: 0,
      clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
    };
    for (const t of ['pointerover', 'mouseover', 'pointerdown', 'mousedown',
                     'pointerup', 'mouseup', 'click']) {
      const ev = t.startsWith('pointer')
        ? new PointerEvent(t, { ...o, pointerType: 'mouse', isPrimary: true })
        : new MouseEvent(t, o);
      origDispatch.call(el, ev);
    }
  }

  const visible = (el) => !!el && el.getClientRects().length > 0;

  function findNewButton() {
    const direct = document.querySelector(
      '[guidedhelpid="new_menu_button"], [aria-label="New"], [data-tooltip="New"]'
    );
    if (visible(direct)) return direct;
    return [...document.querySelectorAll('button, [role="button"]')].find((b) => {
      if (!visible(b)) return false;
      const label = (b.getAttribute('aria-label') || '').trim();
      const text = (b.innerText || b.textContent || '').trim();
      return /^new$/i.test(label) || /^new$/i.test(text);
    });
  }

  function findUploadItem() {
    const items = [...document.querySelectorAll('[role="menuitem"]')].filter(visible);
    return items.find((i) => /file\s*upload|upload\s*file/i.test(i.textContent || '')) ||
           items.find((i) => /upload/i.test(i.textContent || '') && !/folder/i.test(i.textContent || ''));
  }

  const waitFor = (fn, ms) => new Promise((res) => {
    const t0 = Date.now();
    (function tick() {
      const v = fn();
      if (v || Date.now() - t0 > ms) return res(v || null);
      setTimeout(tick, 50);
    })();
  });

  function escape() {
    origDispatch.call(document.activeElement || document.body,
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
  }

  function upload(files) {
    return new Promise(async (resolve) => {
      const timer = setTimeout(() => {
        if (pending) { pending = null; WARN('timed out waiting for Drive file input'); escape(); }
        resolve(false);
      }, 4000);
      pending = { files, done: (ok) => { clearTimeout(timer); resolve(ok); } };

      // Menu may already be open; otherwise wait for Drive to render "New".
      if (!findUploadItem()) {
        const btn = await waitFor(findNewButton, 2000);
        if (!btn) { WARN('"New" button not found'); return; }
        if (!pending) return;
        fakeClick(btn);
      }

      const item = await waitFor(findUploadItem, 2000);
      if (!item) { WARN('"File upload" menu item not found'); escape(); return; }
      if (!pending) return;
      fakeClick(item);
    });
  }

  function toast(msg) {
    if (!document.body) return;
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

  let lastUpload = 0;
  async function handle(images, via) {
    if (pending || Date.now() - lastUpload < 1000) return; // de-dupe paste + fallback
    lastUpload = Date.now();
    const files = named(images);
    LOG(`uploading ${files.length} file(s) via ${via}:`, files.map((f) => f.name));
    const ok = await upload(files);
    toast(ok
      ? (files.length === 1 ? `Uploading ${files[0].name}` : `Uploading ${files.length} images`)
      : 'Couldn’t start the upload. Open DevTools console for details.');
  }

  // 1) Normal path: the browser's paste event.
  let pasteSeen = false;
  window.addEventListener('paste', (e) => {
    pasteSeen = true;
    if (!inFolderView() || isEditable(document.activeElement)) return;
    const images = imagesFrom(e.clipboardData);
    if (!images.length) {
      LOG('paste: clipboard has no image, types =', [...(e.clipboardData?.types || [])]);
      return; // let Drive handle its own paste
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    handle(images, 'paste event');
  }, true);

  // 2) Fallback: Drive swallows Ctrl/Cmd+V for its own file copy/paste, which
  //    stops the paste event from firing. If no paste event follows the keypress,
  //    read the clipboard directly (Chrome asks once for clipboard permission).
  window.addEventListener('keydown', (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
    if ((e.key || '').toLowerCase() !== 'v') return;
    if (!inFolderView() || isEditable(document.activeElement)) return;
    pasteSeen = false;
    setTimeout(() => { if (!pasteSeen) readClipboardFallback(); }, 150);
  }, true);

  async function readClipboardFallback() {
    LOG('no paste event (Drive blocked it), reading clipboard directly');
    if (!navigator.clipboard?.read) return WARN('Clipboard API unavailable');
    try {
      const items = await navigator.clipboard.read();
      const images = [];
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (!type) continue;
        const blob = await item.getType(type);
        images.push(new File([blob], `image.${EXT[type] || 'png'}`, { type }));
      }
      if (images.length) handle(images, 'clipboard API');
      else LOG('clipboard has no image');
    } catch (err) {
      WARN('clipboard read failed:', err);
      toast('Allow clipboard access for drive.google.com to paste images');
    }
  }

  LOG('loaded');
})();
