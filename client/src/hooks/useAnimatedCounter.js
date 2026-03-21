import { useState, useEffect, useRef } from 'react';

const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

const useAnimatedCounter = (target, duration = 1200, delay = 0) => {
  const [value, setValue] = useState(0);
  const frameRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    if (target === null || target === undefined || typeof target !== 'number') {
      setValue(target);
      return;
    }

    const startAnimation = () => {
      startTimeRef.current = null;

      const animate = (timestamp) => {
        if (!startTimeRef.current) startTimeRef.current = timestamp;
        const elapsed = timestamp - startTimeRef.current;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeOutQuart(progress);

        setValue(Math.floor(easedProgress * target));

        if (progress < 1) {
          frameRef.current = requestAnimationFrame(animate);
        } else {
          setValue(target);
        }
      };

      frameRef.current = requestAnimationFrame(animate);
    };

    const timer = setTimeout(startAnimation, delay);

    return () => {
      clearTimeout(timer);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [target, duration, delay]);

  return value;
};

export default useAnimatedCounter;
