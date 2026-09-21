import React, { useState, useEffect } from 'react';
import { playDiceSound } from '../utils/audio';

const Dice = ({ value, rolling }) => {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    if (rolling) {
      playDiceSound();
      // Rapidly change the displayed value to simulate rolling
      const interval = setInterval(() => {
        setDisplayValue(Math.floor(Math.random() * 6) + 1);
      }, 50);
      return () => clearInterval(interval);
    } else {
      setDisplayValue(value);
    }
  }, [value, rolling]);

  const renderDots = () => {
    const dots = [];
    const positions = {
      1: ['center'],
      2: ['top-right', 'bottom-left'],
      3: ['top-right', 'center', 'bottom-left'],
      4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
      6: ['top-left', 'middle-left', 'bottom-left', 'top-right', 'middle-right', 'bottom-right']
    };

    const currentPositions = positions[displayValue || 1];

    currentPositions.forEach((pos, index) => {
      dots.push(<div key={index} className={`dot ${pos}`}></div>);
    });

    return dots;
  };

  return (
    <div className={`dice ${rolling ? 'rolling' : ''}`}>
      {renderDots()}
      <style>{`
        .dice {
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #ffffff, #e2e8f0);
          border-radius: 20%;
          box-shadow: inset 0 5px 15px rgba(255,255,255,0.8),
                      inset 0 -5px 15px rgba(0,0,0,0.1),
                      0 10px 20px rgba(0,0,0,0.2);
          position: relative;
          margin: 0 auto;
          display: flex;
          transition: transform 0.1s;
        }

        .rolling {
          animation: roll 0.5s infinite;
        }

        @keyframes roll {
          0% { transform: rotate(0deg) scale(1); }
          25% { transform: rotate(15deg) scale(1.1); }
          50% { transform: rotate(0deg) scale(1); }
          75% { transform: rotate(-15deg) scale(1.1); }
          100% { transform: rotate(0deg) scale(1); }
        }

        .dot {
          width: 20%;
          height: 20%;
          background-color: #1e293b;
          border-radius: 50%;
          position: absolute;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);
        }

        .center { top: 50%; left: 50%; transform: translate(-50%, -50%); }
        .top-left { top: 15%; left: 15%; }
        .top-right { top: 15%; right: 15%; }
        .bottom-left { bottom: 15%; left: 15%; }
        .bottom-right { bottom: 15%; right: 15%; }
        .middle-left { top: 50%; left: 15%; transform: translateY(-50%); }
        .middle-right { top: 50%; right: 15%; transform: translateY(-50%); }
      `}</style>
    </div>
  );
};

export default Dice;
