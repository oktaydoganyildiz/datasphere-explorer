import React, { useEffect, useRef } from 'react';

const pageStyles = `
@keyframes pageFadeSlideIn {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pageSlideLeft {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes staggerChild {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.page-enter {
  animation: pageFadeSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.page-enter-slide {
  animation: pageSlideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.stagger-child {
  opacity: 0;
  animation: staggerChild 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.stagger-child:nth-child(1) { animation-delay: 0ms; }
.stagger-child:nth-child(2) { animation-delay: 60ms; }
.stagger-child:nth-child(3) { animation-delay: 120ms; }
.stagger-child:nth-child(4) { animation-delay: 180ms; }
.stagger-child:nth-child(5) { animation-delay: 240ms; }
.stagger-child:nth-child(6) { animation-delay: 300ms; }
.stagger-child:nth-child(7) { animation-delay: 360ms; }
.stagger-child:nth-child(8) { animation-delay: 420ms; }

@keyframes fadeScaleIn {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.fade-scale-in {
  animation: fadeScaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes slideUpIn {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.slide-up-in {
  animation: slideUpIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
}
`;

if (!document.querySelector('#page-transition-styles')) {
  const style = document.createElement('style');
  style.id = 'page-transition-styles';
  style.textContent = pageStyles;
  document.head.appendChild(style);
}

const PageTransition = ({ children, animKey, variant = 'fade' }) => {
  const ref = useRef(null);
  const prevKey = useRef(animKey);

  useEffect(() => {
    if (!ref.current) return;
    if (prevKey.current !== animKey) {
      ref.current.style.animation = 'none';
      void ref.current.offsetHeight;
      ref.current.style.animation = '';
      prevKey.current = animKey;
    }
  }, [animKey]);

  const className = variant === 'slide' ? 'page-enter-slide' : 'page-enter';

  return (
    <div ref={ref} className={className} style={{ height: '100%' }}>
      {children}
    </div>
  );
};

export default PageTransition;

export const StaggerContainer = ({ children, className = '' }) => (
  <div className={className}>
    {React.Children.map(children, (child, i) =>
      child ? React.cloneElement(child, {
        className: `${child.props.className || ''} stagger-child`.trim(),
      }) : null
    )}
  </div>
);

export const FadeScaleIn = ({ children, delay = 0, className = '' }) => (
  <div
    className={`fade-scale-in ${className}`}
    style={{ animationDelay: `${delay}ms` }}
  >
    {children}
  </div>
);

export const SlideUpIn = ({ children, delay = 0, className = '' }) => (
  <div
    className={`slide-up-in ${className}`}
    style={{ animationDelay: `${delay}ms` }}
  >
    {children}
  </div>
);
