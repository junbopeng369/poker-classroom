(function () {
  'use strict';
  const config = document.currentScript || document.querySelector('script[data-mobile-ui]');
  if (!config || window.PokerMobileReady) return;
  window.PokerMobileReady = true;
  const en = config.dataset.language === 'en';
  const page = config.dataset.page || 'document';
  const copy = en ? {
    courses: 'Courses', trees: 'Decisions', practice: 'Practice', choose: 'Choose lesson',
    menu: 'Course navigation', hand: 'Choose a starting hand', matrix: 'Full range chart',
    swipe: 'Swipe sideways to see all hands. Tap a cell to select it.',
    finder: 'Find by starting hand', examples: 'Choose another example',
    expand: 'Expand', close: 'Close enlarged view', fit: 'Fit', zoomIn: 'Zoom in', zoomOut: 'Zoom out',
    drag: 'Drag to pan · tap to play/pause', player: 'Enlarged lesson'
  } : {
    courses: '课程', trees: '决策树', practice: '训练台', choose: '选课',
    menu: '课程导航', hand: '选择起手牌', matrix: '展开完整范围表',
    swipe: '左右滑动查看全部手牌，点击格子选择。',
    finder: '按起手牌查询', examples: '选择其他牌例',
    expand: '放大画面', close: '关闭放大画面', fit: '全图', zoomIn: '放大', zoomOut: '缩小',
    drag: '拖动看图 · 点画面播放／暂停', player: '放大课堂画面'
  };
  const mq = matchMedia('(max-width:900px),(max-width:1024px) and (max-height:600px) and (pointer:coarse)');
  let active = false;
  let disposers = [];
  let closeCourseMenu = () => {};
  let examplesDisclosure = null;
  let viewer = null;
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function move(node, parent, restores) {
    const marker = document.createComment('mobile layout position');
    node.before(marker);
    parent.append(node);
    restores.push(() => { if (marker.parentNode) marker.replaceWith(node); });
  }
  function scrollTo(node) {
    if (!node || node.hidden) return;
    node.scrollIntoView?.({block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
  }
  function focusHeading(node) {
    if (!node) return;
    node.setAttribute('tabindex', '-1');
    node.focus({preventScroll: true});
  }

  function addPrimaryNav() {
    if (!config.dataset.courseHref) return () => {};
    const nav = element('nav', 'mobile-primary-nav');
    nav.setAttribute('aria-label', en ? 'Learning tools' : '学习工具');
    const icons = {
      classroom: '<path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-3H4z"/><path d="M13 7a3 3 0 0 1 3-3h5v14h-4a4 4 0 0 0-4 3"/>',
      trees: '<rect x="9" y="2" width="6" height="5" rx="1"/><path d="M12 7v5M5 16v-4h14v4"/><rect x="2" y="16" width="6" height="5" rx="1"/><rect x="16" y="16" width="6" height="5" rx="1"/>',
      practice: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 9 2 2 5-5M8 16h8"/>'
    };
    for (const [kind, href, label] of [
      ['classroom', config.dataset.courseHref, copy.courses],
      ['trees', config.dataset.treeHref, copy.trees],
      ['practice', config.dataset.practiceHref, copy.practice]
    ]) {
      const link = element('a');
      link.href = href;
      if (page === kind) link.setAttribute('aria-current', 'page');
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = icons[kind];
      link.append(icon, element('span', '', label));
      nav.append(link);
    }
    document.body.append(nav);
    document.body.classList.add('has-mobile-nav');
    return () => { nav.remove(); document.body.classList.remove('has-mobile-nav'); };
  }

  function setupCourses() {
    const sidebar = document.querySelector('.sidebar');
    const top = sidebar?.querySelector('.sidebar-top');
    const brand = top?.querySelector('.brand');
    if (!sidebar || !top || !brand) return () => {};
    const restores = [];
    const header = element('div', 'mobile-course-header');
    const toggle = element('button', 'mobile-course-toggle', copy.choose);
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'mobile-course-drawer');
    const drawer = element('div', 'mobile-course-drawer');
    drawer.id = 'mobile-course-drawer';
    drawer.hidden = true;
    drawer.setAttribute('aria-label', copy.menu);
    const items = Array.from(sidebar.children).filter(node => node.matches('.home-button, nav'));
    sidebar.prepend(header);
    move(brand, header, restores);
    header.append(toggle);
    sidebar.append(drawer);
    items.forEach(node => move(node, drawer, restores));
    closeCourseMenu = () => { drawer.hidden = true; toggle.setAttribute('aria-expanded', 'false'); };
    toggle.addEventListener('click', () => {
      drawer.hidden = !drawer.hidden;
      toggle.setAttribute('aria-expanded', String(!drawer.hidden));
    });
    drawer.addEventListener('keydown', event => {
      if (event.key === 'Escape') { closeCourseMenu(); toggle.focus({preventScroll: true}); }
    });
    const lessonView = document.getElementById('lesson-view');
    const sync = () => document.body.classList.toggle('mobile-lesson-view', Boolean(lessonView && !lessonView.hidden));
    const observer = new MutationObserver(sync);
    if (lessonView) observer.observe(lessonView, {attributes: true, attributeFilter: ['hidden']});
    sync();
    return () => {
      observer.disconnect(); restores.reverse().forEach(restore => restore());
      header.remove(); drawer.remove(); closeCourseMenu = () => {};
      document.body.classList.remove('mobile-lesson-view');
    };
  }

  function disclose(nodes, label) {
    nodes = nodes.filter(Boolean);
    if (!nodes.length) return {details: null, restore() {}};
    const details = element('details', 'mobile-section');
    details.append(element('summary', '', label));
    const restores = [];
    nodes[0].before(details);
    nodes.forEach(node => move(node, details, restores));
    return {details, restore() { restores.reverse().forEach(fn => fn()); details.remove(); }};
  }

  function setupTrees() {
    const finder = disclose([document.querySelector('.finder')], copy.finder);
    const chooser = disclose([document.querySelector('.case-heading'), document.getElementById('case-list'), document.getElementById('no-case')], copy.examples);
    examplesDisclosure = chooser.details;
    const map = document.querySelector('.tree-map');
    const wasOpen = map?.open;
    if (map) map.open = false;
    const empty = document.getElementById('no-case');
    const sync = () => { if (empty && !empty.hidden && chooser.details) chooser.details.open = true; };
    const observer = new MutationObserver(sync);
    if (empty) observer.observe(empty, {attributes: true, attributeFilter: ['hidden']});
    sync();
    return () => { observer.disconnect(); finder.restore(); chooser.restore(); examplesDisclosure = null; if (map) map.open = wasOpen; };
  }

  function setupMatrix(matrix) {
    const parentScroll = matrix.parentElement?.classList.contains('matrix-scroll') ? matrix.parentElement : null;
    const anchor = parentScroll || matrix;
    const details = element('details', 'mobile-range-grid');
    details.append(element('summary', '', copy.matrix));
    const picker = element('label', 'mobile-hand-picker', copy.hand);
    const select = element('select');
    select.setAttribute('aria-label', copy.hand);
    picker.append(select);
    anchor.before(picker, details);
    const restores = [];
    const frame = parentScroll || element('div', 'mobile-matrix-frame');
    if (parentScroll) move(parentScroll, details, restores);
    else { details.append(frame); move(matrix, frame, restores); }
    details.append(element('p', 'mobile-matrix-hint', copy.swipe));
    const update = () => {
      const buttons = Array.from(matrix.querySelectorAll('button.hand'));
      const selected = buttons.find(button => button.classList.contains('selected'));
      select.replaceChildren(...buttons.map(button => { const option = element('option', '', button.textContent.trim()); option.value = button.textContent.trim(); return option; }));
      if (selected) select.value = selected.textContent.trim();
    };
    select.addEventListener('change', () => {
      const button = Array.from(matrix.querySelectorAll('button.hand')).find(b => b.textContent.trim() === select.value);
      button?.click();
    });
    const observer = new MutationObserver(update);
    observer.observe(matrix, {childList: true});
    update();
    return () => { observer.disconnect(); restores.reverse().forEach(fn => fn()); picker.remove(); details.remove(); };
  }

  function fitViewer(center = false) {
    if (!viewer) return;
    const {frame, surface, canvas} = viewer;
    const width = frame.clientWidth || Math.max(280, innerWidth - 24);
    const height = frame.clientHeight || Math.max(160, innerHeight - 220);
    const ratio = canvas.width / canvas.height || 1.6;
    const oldWidth = viewer.width || width;
    const oldHeight = oldWidth / ratio;
    const x = center ? .5 : (frame.scrollLeft + width / 2 - Math.max(0, (width - oldWidth) / 2)) / oldWidth;
    const y = center ? .5 : (frame.scrollTop + height / 2 - Math.max(0, (height - oldHeight) / 2)) / oldHeight;
    const nextWidth = Math.min(width, height * ratio) * viewer.zoom;
    const nextHeight = nextWidth / ratio;
    surface.style.width = nextWidth + 'px';
    surface.style.height = nextHeight + 'px';
    surface.style.marginLeft = Math.max(0, (width - nextWidth) / 2) + 'px';
    surface.style.marginTop = Math.max(0, (height - nextHeight) / 2) + 'px';
    viewer.width = nextWidth;
    frame.scrollLeft = Math.max(0, x * nextWidth - width / 2);
    frame.scrollTop = Math.max(0, y * nextHeight - height / 2);
    viewer.output.textContent = Math.round(viewer.zoom * 100) + '%';
    viewer.minus.disabled = viewer.zoom <= 1;
    viewer.plus.disabled = viewer.zoom >= 6;
  }

  function closeViewer() {
    if (viewer) viewer.dialog.close();
  }

  function openViewer() {
    if (viewer) return true;
    const stage = document.getElementById('visual-stage');
    const frame = document.getElementById('canvas-wrap');
    const canvas = document.getElementById('scene');
    if (!stage || !frame || !canvas || !window.HTMLDialogElement || typeof HTMLDialogElement.prototype.showModal !== 'function') return false;
    const dialog = element('dialog', 'mobile-stage-dialog');
    dialog.setAttribute('aria-label', copy.player);
    const shell = element('div', 'mobile-stage-shell');
    const header = element('div', 'mobile-stage-header');
    header.append(element('p', 'mobile-stage-title', document.getElementById('lesson-title')?.textContent || copy.player));
    const close = element('button', '', '✕');
    close.type = 'button'; close.setAttribute('aria-label', copy.close);
    header.append(close);
    const tools = element('div', 'mobile-stage-tools');
    const minus = element('button', '', '−'), plus = element('button', '', '+'), fit = element('button', '', copy.fit), output = element('output', '', '200%');
    minus.setAttribute('aria-label', copy.zoomOut); plus.setAttribute('aria-label', copy.zoomIn);
    output.setAttribute('aria-live', 'polite');
    for (const button of [minus, plus, fit]) button.type = 'button';
    tools.append(minus, output, plus, fit, element('p', '', copy.drag));
    const host = element('div', 'mobile-stage-host');
    shell.append(header, tools, host); dialog.append(shell);
    const originalFocus = document.getElementById('fullscreen') || document.activeElement, scrollYBefore = window.scrollY;
    const marker = document.createComment('inline lesson stage'); stage.before(marker);
    const surface = element('div', 'mobile-canvas-surface');
    const children = Array.from(frame.childNodes);
    children.forEach(child => surface.append(child)); frame.append(surface);
    host.append(stage); document.body.append(dialog);
    viewer = {dialog, stage, frame, canvas, surface, zoom: 2, width: 0, output, minus, plus, observer: null};
    function restore() {
      if (!viewer || viewer.dialog !== dialog) return;
      viewer.observer?.disconnect();
      children.forEach(child => frame.append(child)); surface.remove(); marker.replaceWith(stage);
      viewer = null; dialog.remove(); document.body.classList.remove('mobile-stage-open');
      window.scrollTo({top: scrollYBefore, behavior: 'auto'});
      if (originalFocus?.isConnected) originalFocus.focus?.({preventScroll: true});
    }
    dialog.addEventListener('close', restore, {once: true});
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeViewer(); });
    close.addEventListener('click', closeViewer);
    minus.addEventListener('click', () => { viewer.zoom = Math.max(1, viewer.zoom - 1); fitViewer(true); });
    plus.addEventListener('click', () => { viewer.zoom = Math.min(6, viewer.zoom + 1); fitViewer(true); });
    fit.addEventListener('click', () => { viewer.zoom = 1; fitViewer(true); });
    try { dialog.showModal(); }
    catch { restore(); return false; }
    document.body.classList.add('mobile-stage-open');
    close.focus({preventScroll: true});
    requestAnimationFrame(() => fitViewer(true));
    if (window.ResizeObserver) { viewer.observer = new ResizeObserver(() => fitViewer(false)); viewer.observer.observe(frame); }
    return true;
  }

  const expand = document.getElementById('fullscreen');
  const originalExpandText = expand?.textContent;
  const originalExpandLabel = expand?.getAttribute('aria-label');
  expand?.addEventListener('click', event => {
    if (active && openViewer()) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);

  function apply() {
    const next = mq.matches;
    if (next === active) return;
    active = next;
    document.body.classList.toggle('mobile-layout', active);
    if (active) {
      disposers.push(addPrimaryNav());
      if (page === 'classroom') disposers.push(setupCourses());
      if (page === 'trees') disposers.push(setupTrees());
      for (const id of ['matrix', 'hand-matrix']) { const matrix = document.getElementById(id); if (matrix) disposers.push(setupMatrix(matrix)); }
      if (expand) { expand.textContent = copy.expand; expand.setAttribute('aria-label', copy.expand); }
      const query = new URLSearchParams(location.search);
      if (page === 'trees' && (query.has('case') || query.has('scenario'))) requestAnimationFrame(() => scrollTo(document.getElementById('explorer')));
    } else {
      closeViewer();
      disposers.reverse().forEach(dispose => dispose()); disposers = [];
      if (expand) { expand.textContent = originalExpandText; if (originalExpandLabel) expand.setAttribute('aria-label', originalExpandLabel); }
      document.body.classList.remove('mobile-editing');
    }
  }
  document.body.dataset.mobilePage = page;
  const syncEditing = () => document.body.classList.toggle('mobile-editing', active && Boolean(document.activeElement?.matches('input:not([type=range]),textarea')));
  document.addEventListener('focusin', syncEditing);
  document.addEventListener('focusout', () => requestAnimationFrame(syncEditing));
  if (mq.addEventListener) mq.addEventListener('change', apply); else mq.addListener(apply);
  window.addEventListener('resize', () => { if (viewer) requestAnimationFrame(() => fitViewer(false)); });
  document.addEventListener('click', event => {
    if (!active || viewer || !(event.target instanceof Element)) return;
    const target = event.target;
    if (page === 'classroom' && target.closest('.course-card,.map-start,.lesson-btn,.neighbor,#course-home,.track')) {
      requestAnimationFrame(() => { closeCourseMenu(); scrollTo(document.querySelector('.heading')); focusHeading(document.getElementById('lesson-title')); });
    }
    if (page === 'trees' && target.closest('.scenario-card,.case-choice,.tree-node,.branch,#back-node,.breadcrumbs button')) {
      requestAnimationFrame(() => {
        if (examplesDisclosure) examplesDisclosure.open = false;
        const map = document.querySelector('.tree-map'); if (map) map.open = false;
        scrollTo(document.getElementById('explorer'));
        focusHeading(document.getElementById('node-title'));
      });
    }
  }, true);
  apply();
})();
