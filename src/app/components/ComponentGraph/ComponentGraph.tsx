import React, { useState, useContext } from 'react';
import { Group } from '@visx/group';
import { hierarchy, Tree } from '@visx/hierarchy';
import { LinearGradient } from '@visx/gradient';
import { useTooltip, useTooltipInPortal, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import { pointRadial } from 'd3-shape';
import LinkControls from './LinkControls';
import getLinkComponent from './getLinkComponent';
import { componentTreeHistoryContext, snapshotIndexContext } from '../App';

interface TreeNode {
  name: string;
  isExpanded?: boolean;
  children: TreeNode[];
  atom: string[];
}

//Component graph margins
const defaultMargin = { top: 15, left: 40, right: 40, bottom: 40 };

export type LinkTypesProps = {
  width: number;
  height: number;
  margin?: { top: number; right: number; bottom: number; left: number };
};

function ComponentGraph({
  width: totalWidth,
  height: totalHeight,
  margin = defaultMargin,
}: LinkTypesProps) {
  const { componentTreeHistory, setComponentTreeHistory } = useContext<any>(
    componentTreeHistoryContext
  );
  const { snapshotIndex, setSnapshotIndex } = useContext<any>(
    snapshotIndexContext
  );
  const [layout, setLayout] = useState<string>('cartesian');
  const [orientation, setOrientation] = useState<string>('vertical');
  const [linkType, setLinkType] = useState<string>('diagonal');
  const [stepPercent, setStepPercent] = useState<number>(0.5);
  const [hoverName, setHoverName] = useState<string[]>(['empty']);
  const innerWidth = totalWidth - margin.left - margin.right;
  const innerHeight = totalHeight - margin.top - margin.bottom;

  const data: TreeNode = componentTreeHistory[snapshotIndex];

  let origin: { x: number; y: number };
  let sizeWidth: number;
  let sizeHeight: number;

  if (layout === 'polar') {
    origin = {
      x: innerWidth / 2,
      y: innerHeight / 2,
    };
    sizeWidth = 2 * Math.PI;
    sizeHeight = Math.min(innerWidth, innerHeight) / 2;
  } else {
    origin = { x: 0, y: 0 };
    if (orientation === 'vertical') {
      sizeWidth = innerWidth;
      sizeHeight = innerHeight;
    } else {
      sizeWidth = innerHeight;
      sizeHeight = innerWidth;
    }
  }

  //Hover box:
  const {
    tooltipData,
    tooltipLeft,
    tooltipTop,
    tooltipOpen,
    showTooltip,
    hideTooltip,
  }: any = useTooltip();

  const { containerRef, TooltipInPortal } = useTooltipInPortal({
    detectBounds: true,
    scroll: true,
  });
  const tooltipStyleBox = {
    ...defaultStyles,
    minWidth: 60,
    backgroundColor: 'black',
    color: 'white',
    fontSize: '13px',
    lineHeight: '18px',
  };

  const LinkComponent = getLinkComponent({ layout, linkType, orientation });

  return totalWidth < 10 ? null : (
    <div>
      <LinkControls
        layout={layout}
        orientation={orientation}
        linkType={linkType}
        stepPercent={stepPercent}
        setLayout={setLayout}
        setOrientation={setOrientation}
        setLinkType={setLinkType}
        setStepPercent={setStepPercent}
      />
      <svg width={totalWidth} height={totalHeight}>
        <LinearGradient id="links-gradient" from="#de638a" to="#d13164" />
        <rect width={totalWidth} height={totalHeight} rx={14} fill="#202020" />
        <Group top={margin.top} left={margin.left}>
          <Tree
            root={hierarchy(data, d => (d.isExpanded ? null : d.children))}
            size={[sizeWidth, sizeHeight]}
            separation={(a, b) =>
              (a.parent === b.parent ? 0.55 : 0.5) / a.depth
            }
          >
            {tree => (
              <Group top={origin.y} left={origin.x}>
                {/* Component graph lines */}
                {tree.links().map((link, i) => (
                  <LinkComponent
                    key={i}
                    data={link}
                    percent={stepPercent}
                    stroke="#7c7c7c"
                    strokeWidth="1"
                    fill="none"
                  />
                ))}

                {tree.descendants().map((node, key) => {
                  const widthFunc = (name: string) => {
                    let nodeLength = name.length;
                    if (nodeLength < 5) return nodeLength + 30;
                    if (nodeLength < 10) return nodeLength + 45;
                    return nodeLength + 70;
                  };
                  const width = widthFunc(node.data.name);
                  const height = 20;

                  let top: number;
                  let left: number;
                  if (layout === 'polar') {
                    const [radialX, radialY] = pointRadial(node.x, node.y);
                    top = radialY;
                    left = radialX;
                  } else if (orientation === 'vertical') {
                    top = node.y;
                    left = node.x;
                  } else {
                    top = node.x;
                    left = node.y;
                  }

                  //Hover box:
                  const handleMouseOver = (event: any) => {
                    const coords: any = localPoint(
                      event.target.ownerSVGElement,
                      event
                    );
                    const tooltipObj = node.data;
                    showTooltip({
                      tooltipLeft: coords.x,
                      tooltipTop: coords.y,
                      tooltipData: tooltipObj,
                    });
                    setHoverName(node.data.atom);
                  };

                  const handleMouseOut = () => {
                    hideTooltip();
                    setHoverName(['empty']);
                  };

                  function atomColor() {
                    for (let i = 0; i < hoverName.length; i++) {
                      if (node.data.atom.includes(hoverName[i]))
                        return '#d13164';
                    }
                    if (node.data.atom.length) return '#7f5dc0';
                    return '#1cb5c9';
                  }

                  return (
                    <Group top={top} left={left} key={key}>
                      {/* Root component box */}
                      {node.depth === 0 && (
                        <rect
                          height={height + 2}
                          width={width}
                          y={-height / 2}
                          x={-width / 2}
                          fill="url('#links-gradient')"
                          rx={4}
                          onClick={() => {
                            node.data.isExpanded = !node.data.isExpanded;
                          }}
                        />
                      )}
                      {/* Element or component boxes */}
                      {node.depth !== 0 && (
                        <rect
                          height={height}
                          width={width}
                          y={-height / 2}
                          x={-width / 2}
                          fill={atomColor()}
                          rx={4}
                          stroke={'black'}
                          strokeWidth={1}
                          strokeDasharray={0}
                          strokeOpacity={1}
                          onClick={() => {
                            node.data.isExpanded = !node.data.isExpanded;
                          }}
                          onMouseOver={handleMouseOver}
                          onMouseOut={handleMouseOut}
                        />
                      )}
                      {/* Text in boxed */}
                      <text
                        dy=".33em"
                        fontSize={node.depth === 0 ? 12 : 11}
                        fontFamily="Arial"
                        textAnchor="middle"
                        style={{ pointerEvents: 'none', fontWeight: 'bold' }}
                        fill={
                          node.depth === 0
                            ? 'white'
                            : node.data.atom.length
                            ? 'white'
                            : 'black'
                        }
                      >
                        {node.data.name}
                      </text>
                    </Group>
                  );
                })}
              </Group>
            )}
          </Tree>
        </Group>
      </svg>
      {/* Hover box */}
      {tooltipOpen && tooltipData && (
        <TooltipInPortal
          // set this to random so it correctly updates with parent bounds
          key={Math.random()}
          top={tooltipTop}
          left={tooltipLeft}
          style={tooltipStyleBox}
        >
          {/* Hover name: */}
          <div>
            {tooltipData.name[0] &&
            tooltipData.name[0] === tooltipData.name[0].toUpperCase() ? (
              <strong style={{ color: '#7f5dc0' }}>Component: </strong>
            ) : tooltipData.name[0] ? (
              <strong style={{ color: '#1cb5c9' }}>Element: </strong>
            ) : (
              'No Component or Element'
            )}

            {tooltipData.name}
          </div>
          {/* Hover atom: */}
          {tooltipData.atom.length > 0 && (
            <div>
              <strong style={{ color: '#41b69c' }}>Atom(s): </strong>
              {tooltipData.atom.join(', ')}
            </div>
          )}
          {/* Hover state: */}
          {tooltipData.atom.map((item: string) => (
            <div>
              <strong style={{ color: '#f4bf75' }}>{item}:</strong>
              <br />
              -Value: {JSON.stringify(tooltipData.state[item].values)}
              <br />
              -Dependents:{' '}
              {JSON.stringify(tooltipData.state[item].dependencies)}
            </div>
          ))}
        </TooltipInPortal>
      )}
    </div>
  );
}

export default ComponentGraph;