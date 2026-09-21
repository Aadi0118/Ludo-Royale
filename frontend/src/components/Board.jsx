import React, { useState, useEffect } from 'react';
import { Star, ArrowRight, ArrowDown, ArrowLeft, ArrowUp } from 'lucide-react';
import Dice from './Dice';

import { playMoveSound } from '../utils/audio';

const PATH_COORDS = [
  { r: 6, c: 1 }, { r: 6, c: 2 }, { r: 6, c: 3 }, { r: 6, c: 4 }, { r: 6, c: 5 },
  { r: 5, c: 6 }, { r: 4, c: 6 }, { r: 3, c: 6 }, { r: 2, c: 6 }, { r: 1, c: 6 }, { r: 0, c: 6 },
  { r: 0, c: 7 }, { r: 0, c: 8 },
  { r: 1, c: 8 }, { r: 2, c: 8 }, { r: 3, c: 8 }, { r: 4, c: 8 }, { r: 5, c: 8 },
  { r: 6, c: 9 }, { r: 6, c: 10 }, { r: 6, c: 11 }, { r: 6, c: 12 }, { r: 6, c: 13 }, { r: 6, c: 14 },
  { r: 7, c: 14 }, { r: 8, c: 14 },
  { r: 8, c: 13 }, { r: 8, c: 12 }, { r: 8, c: 11 }, { r: 8, c: 10 }, { r: 8, c: 9 },
  { r: 9, c: 8 }, { r: 10, c: 8 }, { r: 11, c: 8 }, { r: 12, c: 8 }, { r: 13, c: 8 }, { r: 14, c: 8 },
  { r: 14, c: 7 }, { r: 14, c: 6 },
  { r: 13, c: 6 }, { r: 12, c: 6 }, { r: 11, c: 6 }, { r: 10, c: 6 }, { r: 9, c: 6 },
  { r: 8, c: 5 }, { r: 8, c: 4 }, { r: 8, c: 3 }, { r: 8, c: 2 }, { r: 8, c: 1 }, { r: 8, c: 0 },
  { r: 7, c: 0 }, { r: 6, c: 0 }
];

const HOME_PATHS = {
  yellow: [{ r: 7, c: 1 }, { r: 7, c: 2 }, { r: 7, c: 3 }, { r: 7, c: 4 }, { r: 7, c: 5 }],
  blue: [{ r: 1, c: 7 }, { r: 2, c: 7 }, { r: 3, c: 7 }, { r: 4, c: 7 }, { r: 5, c: 7 }],
  red: [{ r: 7, c: 13 }, { r: 7, c: 12 }, { r: 7, c: 11 }, { r: 7, c: 10 }, { r: 7, c: 9 }],
  green: [{ r: 13, c: 7 }, { r: 12, c: 7 }, { r: 11, c: 7 }, { r: 10, c: 7 }, { r: 9, c: 7 }]
};

const SAFE_ZONES = [0, 8, 13, 21, 26, 34, 39, 47];
const START_POSITIONS = { yellow: 0, blue: 13, red: 26, green: 39 };

const Board = ({ gameState, onMoveToken, socketId, animationData, onAnimationComplete }) => {
  const [displayTokens, setDisplayTokens] = useState(gameState ? gameState.tokens : null);

  // Sync with gameState when not animating
  useEffect(() => {
    if (!animationData && gameState) {
      setDisplayTokens(gameState.tokens);
    }
  }, [gameState, animationData]);

  // Handle animation sequence
  useEffect(() => {
    if (animationData && displayTokens) {
      const { tokenId, color, path, capturedTokens } = animationData;
      let step = 0;

      const interval = setInterval(() => {
        if (step < path.length) {
          const currentStep = step;
          // move to path[currentStep]
          playMoveSound();
          setDisplayTokens(prev => {
            const newTokens = JSON.parse(JSON.stringify(prev)); // Deep copy
            const tIndex = newTokens[color].findIndex(t => t.id === tokenId);
            if (tIndex !== -1) {
              newTokens[color][tIndex].position = path[currentStep];
            }
            return newTokens;
          });
          step++;
        } else {
          // Path finished. Process captures if any.
          if (capturedTokens && capturedTokens.length > 0) {
            setDisplayTokens(prev => {
              const newTokens = JSON.parse(JSON.stringify(prev));
              capturedTokens.forEach(cap => {
                const cIndex = newTokens[cap.color].findIndex(t => t.id === cap.id);
                if (cIndex !== -1) {
                  newTokens[cap.color][cIndex].position = -1;
                }
              });
              return newTokens;
            });
          }
          clearInterval(interval);
          if (onAnimationComplete) {
            setTimeout(onAnimationComplete, 500);
          }
        }
      }, 300); // 300ms per step

      return () => clearInterval(interval);
    }
  }, [animationData]);

  if (!gameState || !displayTokens) return <div>Loading board...</div>;

  const isMyTurn = gameState.currentPlayer?.id === socketId;

  // Render static tokens (removed)
  const getTokensAtPos = (pos) => [];
  const renderCellWithTokens = (pos, baseClass, content = null) => {
    return (
      <div className={`board-cell ${baseClass}`} style={{ position: 'relative' }}>
        {content}
      </div>
    );
  };

  const renderPathCells = () => {
    return PATH_COORDS.map((coord, index) => {
      let isSafe = SAFE_ZONES.includes(index);
      let isStart = Object.values(START_POSITIONS).includes(index);
      let cellColorClass = '';

      if (index === START_POSITIONS.yellow) cellColorClass = 'bg-yellow-400';
      if (index === START_POSITIONS.blue) cellColorClass = 'bg-blue-400';
      if (index === START_POSITIONS.red) cellColorClass = 'bg-red-400';
      if (index === START_POSITIONS.green) cellColorClass = 'bg-green-400';

      let content = null;
      if (isSafe && !isStart) {
        content = <Star size={16} color="#ccc" style={{ position: 'absolute' }} />;
      }
      if (isStart) {
        if (index === START_POSITIONS.yellow) content = <ArrowRight size={20} color="white" style={{ position: 'absolute' }} />;
        if (index === START_POSITIONS.blue) content = <ArrowDown size={20} color="white" style={{ position: 'absolute' }} />;
        if (index === START_POSITIONS.red) content = <ArrowLeft size={20} color="white" style={{ position: 'absolute' }} />;
        if (index === START_POSITIONS.green) content = <ArrowUp size={20} color="white" style={{ position: 'absolute' }} />;
      }

      return (
        <div key={`path-${index}`} style={{ gridRow: coord.r + 1, gridColumn: coord.c + 1, position: 'relative' }}>
          {renderCellWithTokens(index, `path-cell ${cellColorClass}`, content)}
        </div>
      );
    });
  };

  const renderHomePaths = () => {
    let elements = [];
    const colors = ['yellow', 'blue', 'red', 'green'];
    const pathStarts = { yellow: 100, blue: 200, red: 300, green: 400 };

    colors.forEach(color => {
      HOME_PATHS[color].forEach((coord, i) => {
        const posId = pathStarts[color] + i;
        elements.push(
          <div key={`home-${color}-${i}`} style={{ gridRow: coord.r + 1, gridColumn: coord.c + 1 }}>
            {renderCellWithTokens(posId, `path-cell bg-${color}-400`)}
          </div>
        );
      });
    });
    return elements;
  };

  const renderBases = () => {
    const bases = [
      { color: 'yellow', r: 1, c: 1 },
      { color: 'blue', r: 1, c: 10 },
      { color: 'red', r: 10, c: 10 },
      { color: 'green', r: 10, c: 1 }
    ];

    return bases.map(base => {
      return (
        <div key={`base-${base.color}`} className={`base bg-${base.color}-500`} style={{ gridRow: `${base.r} / span 6`, gridColumn: `${base.c} / span 6` }}>
          <div className="base-inner">
            <div className="token-slots">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="token-slot">
                  {/* Tokens rendered in Animated Layer now */}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    });
  };

  const renderCenter = () => {
    return (
      <div style={{ gridRow: '7 / span 3', gridColumn: '7 / span 3', position: 'relative', overflow: 'hidden' }}>
        <div className="center-triangles"></div>
      </div>
    );
  };

  const getTokenCoords = (color, position, slotIndex) => {
    if (position === -1) {
      const baseCoords = {
        yellow: [{ r: 1.5, c: 1.5 }, { r: 1.5, c: 3.5 }, { r: 3.5, c: 1.5 }, { r: 3.5, c: 3.5 }],
        blue: [{ r: 1.5, c: 10.5 }, { r: 1.5, c: 12.5 }, { r: 3.5, c: 10.5 }, { r: 3.5, c: 12.5 }],
        red: [{ r: 10.5, c: 10.5 }, { r: 10.5, c: 12.5 }, { r: 12.5, c: 10.5 }, { r: 12.5, c: 12.5 }],
        green: [{ r: 10.5, c: 1.5 }, { r: 10.5, c: 3.5 }, { r: 12.5, c: 1.5 }, { r: 12.5, c: 3.5 }],
      };
      return baseCoords[color][slotIndex];
    }

    if (position >= 0 && position <= 51) {
      return PATH_COORDS[position];
    }

    const pathStarts = { yellow: 100, blue: 200, red: 300, green: 400 };
    const homePathIdx = position - pathStarts[color];
    if (homePathIdx >= 0 && homePathIdx < 5) {
      return HOME_PATHS[color][homePathIdx];
    }

    if (homePathIdx === 5) {
      // Reached Home center
      const homeOffsets = {
        yellow: { r: 6.5, c: 6.5 },
        blue: { r: 6.5, c: 8.5 }, // Adjust blue center
        red: { r: 8.5, c: 8.5 },
        green: { r: 8.5, c: 6.5 }
      };
      return homeOffsets[color];
    }

    // Fallback if something goes wrong, return to base to avoid crashing
    return getTokenCoords(color, -1, slotIndex);
  };

  const renderAnimatedTokens = () => {
    // Gather all tokens from local displayTokens state
    const allTokens = [];
    ['yellow', 'blue', 'red', 'green'].forEach(color => {
      displayTokens[color].forEach((t, i) => {
        allTokens.push({ ...t, color, slotIndex: i });
      });
    });

    // Count tokens at each path position to calculate overlap offsets
    const positionCounts = {};
    allTokens.forEach(t => {
      const isAnimatingToken = animationData && animationData.tokenId === t.id;
      // Do not count animating tokens for overlap so they don't cause other tokens to jump around
      if (!isAnimatingToken && t.position >= 0 && t.position <= 51) {
        if (!positionCounts[t.position]) positionCounts[t.position] = [];
        positionCounts[t.position].push(t.id);
      }
    });

    return (
      <div className="tokens-layer" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {allTokens.map(token => {
          const { r, c } = getTokenCoords(token.color, token.position, token.slotIndex);

          let offsetX = 0;
          let offsetY = 0;
          let scale = 1;

          const isAnimatingToken = animationData && animationData.tokenId === token.id;

          // If on main path and overlapping (and not currently animating)
          if (!isAnimatingToken && token.position >= 0 && token.position <= 51) {
            const overlapping = positionCounts[token.position];
            if (overlapping && overlapping.length > 1) {
              const idx = overlapping.indexOf(token.id);
              // Simple grid offset for overlapping tokens
              offsetX = (idx % 2 === 0 ? -15 : 15);
              offsetY = (idx < 2 ? -15 : 15);
              scale = 0.8;
            }
          }

          // Center the token inside the cell by adding half cell size
          const cellWidth = 100 / 15;
          const topPercent = (r + 0.5) * cellWidth;
          const leftPercent = (c + 0.5) * cellWidth;

          const canMove = isMyTurn && token.color === gameState.currentPlayer?.color;

          return (
            <div
              key={token.id}
              onClick={canMove ? () => onMoveToken(token.id) : undefined}
              className={`pawn pawn-${token.color}`}
              style={{
                position: 'absolute',
                top: `${topPercent}%`,
                left: `${leftPercent}%`,
                width: `${cellWidth * 0.55}%`,
                height: `${cellWidth * 0.55}%`,
                borderRadius: '50% 50% 50% 0',
                boxShadow: 'inset -2px -2px 4px rgba(0,0,0,0.4), 3px 3px 6px rgba(0,0,0,0.5)',
                cursor: canMove ? 'pointer' : 'default',
                zIndex: 20 + (token.position === -1 || typeof token.position !== 'number' ? 0 : token.position),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'auto',
                // Fast transition for block-by-block movement
                transition: 'top 0.25s linear, left 0.25s linear, transform 0.2s ease-out',
                transform: `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px)) rotate(-45deg) scale(${canMove ? scale * 1.1 : scale})`,
              }}
            >
              <div style={{
                width: '40%',
                height: '40%',
                backgroundColor: '#fff',
                borderRadius: '50%',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.6)'
              }}></div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="ludo-board-wrapper glass-panel">
      <div className="ludo-board" style={{ position: 'relative' }}>
        {renderBases()}
        {renderPathCells()}
        {renderHomePaths()}
        {renderCenter()}
        {renderAnimatedTokens()}
      </div>
      <style>{`
        .ludo-board-wrapper {
          padding: 0;
          display: inline-block;
          margin: 0 auto;
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        .ludo-board {
          display: grid;
          grid-template-columns: repeat(15, var(--cell-size));
          grid-template-rows: repeat(15, var(--cell-size));
          border: 1px solid #ccc;
          background: white;
        }
        .board-cell {
          width: 100%;
          height: 100%;
          border: 1px solid #ddd;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .bg-red-400 { background-color: #ff6b7b !important; }
        .bg-green-400 { background-color: #4cdb79 !important; }
        .bg-yellow-400 { background-color: #ffe040 !important; }
        .bg-blue-400 { background-color: #5bb3ff !important; }

        .bg-red-500 { background-color: var(--ludo-red); }
        .bg-green-500 { background-color: var(--ludo-green); }
        .bg-yellow-500 { background-color: var(--ludo-yellow); }
        .bg-blue-500 { background-color: var(--ludo-blue); }

        .pawn-red { background: linear-gradient(135deg, #ff4d60, #ba0c1e); }
        .pawn-green { background: linear-gradient(135deg, #32d665, #0d702d); }
        .pawn-yellow { background: linear-gradient(135deg, #ffeb6b, #b39200); }
        .pawn-blue { background: linear-gradient(135deg, #4da9ff, #0c6abf); }

        .pawn:hover {
          z-index: 20 !important;
          box-shadow: inset -2px -2px 4px rgba(0,0,0,0.4), 6px 6px 12px rgba(0,0,0,0.6) !important;
        }

        .base {
          padding: 15%;
          border: 1px solid #ccc;
        }
        .base-inner {
          background: white;
          width: 100%;
          height: 100%;
          border-radius: 10%;
          padding: 15%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .token-slots {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          gap: 20%;
          width: 100%;
          height: 100%;
        }
        .token-slot {
          border: 2px solid #e5e7eb;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        .center-triangles {
          width: 100%;
          height: 100%;
          border-style: solid;
          border-width: calc(var(--cell-size) * 1.5); /* Half of 3x3 width */
          border-color: var(--ludo-red) var(--ludo-green) var(--ludo-yellow) var(--ludo-blue);
          box-sizing: border-box;
        }
      `}</style>
    </div>
  );
};

export default Board;
