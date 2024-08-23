import React, { useEffect, useRef, useState } from 'react';

function CustomLinkSegment({ model, path }) {
  const pathRef = useRef(null);
  const circleRef = useRef(null);
  const [percent, setPercent] = useState(0);
  const [mounted, setMounted] = useState(false);
  // const [stroke, setStroke] = useState('rgba(255,0,0,0.5)');

  // useEffect(() => {
  //   if (model && model.color) setStroke(model.color);
  // }, [model]);

  useEffect(() => {
    setMounted(true);
    const callback = () => {
      if (!circleRef.current || !pathRef.current) {
        return;
      }

      let newPercent = percent + 2;
      if (newPercent > 100) {
        newPercent = 0;
      }
      setPercent(newPercent);

      const point = pathRef.current.getPointAtLength(
        pathRef.current.getTotalLength() * (newPercent / 100.0),
      );

      circleRef.current.setAttribute('cx', `${point.x}`);
      circleRef.current.setAttribute('cy', `${point.y}`);

      if (mounted) {
        requestAnimationFrame(callback);
      }
    };

    requestAnimationFrame(callback);

    return () => {
      setMounted(false);
    };
  }, [percent, mounted]); // This effect depends on `percent` and `mounted`.

  return (
    <>
      <path
        fill="none"
        ref={pathRef}
        strokeWidth={model.getOptions().width}
        stroke={model.color ? model.color : 'rgba(255,0,0,0.5)'}
        d={path}
      />
      <circle ref={circleRef} r={10} fill="orange" />
    </>
  );
}

export default CustomLinkSegment;
