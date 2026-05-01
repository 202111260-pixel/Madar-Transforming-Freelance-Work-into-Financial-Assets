import { useState, useEffect } from 'react';
import './GeneratingLoader.css';

const SUB_AGENTS = [
  { name: 'Sentinel',   color: '#1e40af', orb: 'blue' },
  { name: 'Negotiator', color: '#065f46', orb: 'green' },
  { name: 'Treasurer',  color: '#78350f', orb: 'amber' },
];

export default function GeneratingLoader() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIdx(i => (i + 1) % SUB_AGENTS.length), 2400);
    return () => clearInterval(id);
  }, []);

  const agent = SUB_AGENTS[idx];
  const letters = agent.name.split('');

  return (
    <div className={`generating-loader-wrapper orb-${agent.orb}`}>
      <div className="generating-loader-text" key={idx} style={{ color: agent.color }}>
        {letters.map((ch, i) => (
          <span
            key={i}
            className="generating-loader-letter"
            style={{ animationDelay: `${i * 0.07}s` }}
          >
            {ch}
          </span>
        ))}
      </div>
      <div className="generating-loader-orb" />
    </div>
  );
}
