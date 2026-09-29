import React, { useEffect, useState } from 'react';
import { getApiBaseUrl } from '../../utils/api';
import './RankExplorer.css';

const rankOrder = ['SUO', 'JUO', 'CSM', 'CQMH', 'SGT', 'CPL', 'LCPL'];
interface Holder { rank: string; name: string; imageUrl: string; }

export const RankExplorer: React.FC = () => {
  const [holders, setHolders] = useState<Holder[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${getApiBaseUrl()}/api/public/rank-holders`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (data?.success && Array.isArray(data.holders)) setHolders(data.holders); })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  return (
    <section className="rank-explorer" aria-labelledby="rank-explorer-title">
      <div className="rank-explorer-heading">
        <span className="rank-explorer-kicker">CADET LEADERSHIP</span>
        <h3 id="rank-explorer-title">AIT NCC Rank Holders</h3>
      </div>
      <div className="rank-holder-grid">
        {rankOrder.map((rank) => {
          const holder = holders.find((candidate) => candidate.rank === rank && candidate.name && candidate.imageUrl);
          return <article className="rank-holder-card" key={rank}>
            <h4>{rank}</h4>
            {holder ? <><img src={holder.imageUrl} alt={`${holder.name}, ${rank}`} loading="lazy" /><p>{holder.name}</p></> : <p className="rank-holder-empty">Photo and rank holder details will be updated</p>}
          </article>;
        })}
      </div>
    </section>
  );
};
