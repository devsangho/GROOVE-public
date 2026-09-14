/* Animate the manuscript SVGs; the original images remain the loading fallback. */
(() => {
  if (!window.IntersectionObserver || !Element.prototype.animate) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  document.querySelectorAll('[data-animate-chart]').forEach(async (panel, index) => {
    const image = panel.querySelector('img');
    const replay = panel.closest('.chart-figure').querySelector('.chart-replay');
    let observer;
    let animations = [];
    try {
      const response = await fetch(image.src);
      if (!response.ok) return;
      const documentSVG = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
      if (documentSVG.querySelector('parsererror')) return;
      const svg = document.importNode(documentSVG.documentElement, true);
      if (svg.localName !== 'svg') return;
      const bars = [...svg.querySelectorAll('[id^="chart-bar-"]')];
      const details = [...svg.querySelectorAll('[id^="chart-detail-"]')];
      if (!bars.length || !details.length) return;

      // Matplotlib IDs repeat across figures. Scope both IDs and their references.
      const prefix = `result-chart-${index}-`;
      svg.querySelectorAll('[id]').forEach(node => { node.id = prefix + node.id; });
      svg.querySelectorAll('*').forEach(node => {
        for (const attribute of [...node.attributes]) {
          let value = attribute.value.replace(/url\(#([^)]*)\)/g, `url(#${prefix}$1)`);
          if (attribute.localName === 'href' && value.startsWith('#')) {
            value = '#' + prefix + value.slice(1);
          }
          attribute.value = value;
        }
      });
      // The exported universal style must not leak into the surrounding page.
      svg.querySelectorAll('style, metadata').forEach(node => node.remove());
      svg.style.strokeLinejoin = 'round';
      svg.style.strokeLinecap = 'butt';
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', image.alt);
      svg.setAttribute('focusable', 'false');
      image.replaceWith(svg);

      const ordered = bars.map(node => ({node, box: node.getBBox()}))
        .sort((a, b) => a.box.y - b.box.y);
      ordered.forEach(({node, box}) => {
        node.style.transformBox = 'view-box';
        node.style.transformOrigin = `${box.x}px ${box.y}px`;
      });

      function finish() {
        animations.forEach(animation => animation.cancel());
        animations = [];
        replay.disabled = false;
      }

      function prepare() {
        finish();
        ordered.forEach(({node}, position) => {
          const animation = node.animate(
            [{transform: 'scaleX(0)'}, {transform: 'scaleX(1)'}],
            {duration: 760, delay: position * 55, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both'}
          );
          animation.pause();
          animation.currentTime = 0;
          animations.push(animation);
        });
        details.forEach(node => {
          const animation = node.animate([{opacity: 0}, {opacity: 1}], {
            duration: 260, delay: 760 + (ordered.length - 1) * 55, fill: 'both'
          });
          animation.pause();
          animation.currentTime = 0;
          animations.push(animation);
        });
      }

      let started = false;
      let visible = false;
      function updatePlayback() {
        if (motion.matches || !animations.length) return;
        if (visible && !document.hidden) {
          started = true;
          replay.disabled = true;
          animations.forEach(animation => {
            if (animation.playState !== 'finished') animation.play();
          });
          const current = animations;
          Promise.all(current.map(animation => animation.finished)).then(() => {
            if (animations === current) finish();
          }).catch(() => {}); // Cancelling for reduced motion is expected.
        } else {
          animations.forEach(animation => {
            if (animation.playState !== 'finished') animation.pause();
          });
        }
      }

      if (!motion.matches) prepare();
      replay.hidden = motion.matches;
      observer = new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        updatePlayback();
      }, {threshold: 0.15});
      observer.observe(panel);
      replay.addEventListener('click', () => {
        if (motion.matches) return;
        prepare();
        updatePlayback();
      });
      document.addEventListener('visibilitychange', updatePlayback);
      motion.addEventListener('change', () => {
        replay.hidden = motion.matches;
        if (motion.matches) finish();
        else if (!started) {
          prepare();
          updatePlayback();
        }
      });
    } catch (error) {
      observer?.disconnect();
      animations.forEach(animation => animation.cancel());
      // Leave the complete chart readable if loading or animation is unavailable.
      replay.hidden = true;
    }
  });
})();
