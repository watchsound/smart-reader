import React, { useRef, useEffect } from 'react';
import { DefaultLinkSegmentWidget } from '@projectstorm/react-diagrams';
import { PathFindingLinkWidget } from '@projectstorm/react-diagrams-routing';

function CustomLinkWidget({link, factory}) {

  return (
    <g>
      {link.getPoints().map((point, index) => {
        if (index === 0) return null;
        const previousPoint = link.getPoints()[index - 1];
        const path = `M${previousPoint.getX()} ${previousPoint.getY()} L${point.getX()} ${point.getY()}`;
        return (
          <DefaultLinkSegmentWidget
            key={index}
            path={path}
            selected={link.isSelected()}
            model={link}
            stroke={link.color}
            link={link}
            factory={factory}
          />
        );
      })}
    </g>
  );
}

export default CustomLinkWidget;
