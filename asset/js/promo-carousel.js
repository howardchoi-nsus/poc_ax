(function () {
  const DESKTOP_QUERY = '(min-width: 1024px)';
  const DRAG_THRESHOLD = 42;

  function clampIndex(index, length) {
    if (!length) return 0;
    return ((index % length) + length) % length;
  }

  function createPromoCarousel(root) {
    const viewport = root.querySelector('.embla__viewport');
    const container = root.querySelector('.embla__container');
    const dots = root.querySelector('.embla__dots');
    const slides = Array.from(root.querySelectorAll('.embla__slide'));
    const desktopMedia = window.matchMedia(DESKTOP_QUERY);

    if (!viewport || !container || !slides.length) return null;

    let selected = 0;
    let slideWidth = 0;
    let startX = 0;
    let deltaX = 0;
    let dragging = false;

    function measure() {
      const firstSlide = slides[0];
      slideWidth = firstSlide.getBoundingClientRect().width || 1;
      update();
    }

    function setRelativeClasses() {
      const length = slides.length;
      slides.forEach((slide, index) => {
        slide.classList.remove('is-snapped', 'is-prev', 'is-next', 'is-prev2', 'is-next2');
        if (!desktopMedia.matches && index !== selected) slide.classList.remove('flip');

        let distance = index - selected;
        if (distance > length / 2) distance -= length;
        if (distance < -length / 2) distance += length;

        if (distance === 0) slide.classList.add('is-snapped');
        if (distance === -1) slide.classList.add('is-prev');
        if (distance === 1) slide.classList.add('is-next');
        if (distance === -2) slide.classList.add('is-prev2');
        if (distance === 2) slide.classList.add('is-next2');
      });
    }

    function renderDots() {
      if (!dots) return;
      dots.innerHTML = slides.map((_, index) => (
        `<button class="embla__dot" type="button" aria-label="프로모션 카드 ${index + 1} 보기"></button>`
      )).join('');
      Array.from(dots.children).forEach((dot, index) => {
        dot.addEventListener('click', () => goTo(index));
      });
    }

    function updateDots() {
      if (!dots) return;
      Array.from(dots.children).forEach((dot, index) => {
        dot.classList.toggle('embla__dot--selected', index === selected);
      });
    }

    function update(temporaryOffset = 0) {
      setRelativeClasses();
      updateDots();

      if (desktopMedia.matches) {
        container.style.transform = '';
        return;
      }

      const viewportWidth = viewport.getBoundingClientRect().width;
      const centerOffset = (viewportWidth - slideWidth) / 2;
      const x = centerOffset - selected * slideWidth + temporaryOffset;
      container.style.transform = `translate3d(${x}px, 0, 0)`;
    }

    function goTo(index) {
      selected = clampIndex(index, slides.length);
      update();
    }

    function onPointerDown(event) {
      if (desktopMedia.matches) return;
      dragging = true;
      startX = event.clientX;
      deltaX = 0;
      viewport.classList.add('is-dragging');
      viewport.setPointerCapture?.(event.pointerId);
    }

    function onPointerMove(event) {
      if (!dragging) return;
      deltaX = event.clientX - startX;
      update(deltaX);
    }

    function onPointerUp() {
      if (!dragging) return;
      dragging = false;
      viewport.classList.remove('is-dragging');

      if (Math.abs(deltaX) >= DRAG_THRESHOLD) {
        goTo(selected + (deltaX < 0 ? 1 : -1));
        return;
      }

      update();
    }

    function bindFlipMode() {
      slides.forEach((slide) => {
        slide.onmouseenter = null;
        slide.onmouseleave = null;
        slide.onclick = null;
        slide.classList.remove('flip');

        if (desktopMedia.matches) {
          slide.onmouseenter = () => slide.classList.add('flip');
          slide.onmouseleave = () => slide.classList.remove('flip');
        } else {
          slide.onclick = () => {
            if (slide.classList.contains('is-snapped')) slide.classList.toggle('flip');
          };
        }
      });
    }

    function onModeChange() {
      bindFlipMode();
      measure();
    }

    renderDots();
    bindFlipMode();
    measure();

    viewport.addEventListener('pointerdown', onPointerDown);
    viewport.addEventListener('pointermove', onPointerMove);
    viewport.addEventListener('pointerup', onPointerUp);
    viewport.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('resize', measure);
    desktopMedia.addEventListener?.('change', onModeChange);

    return { goTo, measure };
  }

  function initPromoCarousels() {
    document.querySelectorAll('[data-promo-carousel]').forEach(createPromoCarousel);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPromoCarousels);
  } else {
    initPromoCarousels();
  }

  window.createPromoCarousel = createPromoCarousel;
})();
