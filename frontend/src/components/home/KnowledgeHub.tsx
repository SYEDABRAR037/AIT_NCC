import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, Compass, Flag, Medal, Mountain, Shield, Sparkles, Users } from 'lucide-react';
import './KnowledgeHub.css';
import { RankExplorer } from './RankExplorer';

const topics = [
  {
    title: 'NCC Basics', icon: Shield,
    summary: 'The National Cadet Corps and cadet life.',
    detail: 'The NCC gives young people opportunities to learn leadership, discipline, and service through training and community activities.',
  },
  {
    title: 'Ranks', icon: Medal,
    summary: 'Cadet appointments and their responsibilities.',
    detail: 'Cadet appointments recognize leadership and responsibility within a unit. Rank structures vary between divisions and wings.',
  },
  {
    title: 'Badges & Insignia', icon: Sparkles,
    summary: 'The meaning of uniform badges and insignia.',
    detail: 'Uniform insignia identify the NCC, a cadet appointment, or an achievement.',
  },
  {
    title: 'Drill & Training', icon: Compass,
    summary: 'Drill, fitness, and field skills.',
    detail: 'NCC training includes drill, physical fitness, field skills, and group activities.',
  },
  {
    title: 'Camps', icon: Mountain,
    summary: 'Training and activities at NCC camps.',
    detail: 'NCC camps bring cadets together for training, competitions, and cultural exchange.',
  },
  {
    title: 'Certificates', icon: BookOpen,
    summary: 'NCC certificate levels and examinations.',
    detail: 'NCC offers A, B, and C certificate examinations. Ask your unit about eligibility and the current syllabus.',
  },
  {
    title: 'NCC History', icon: Flag,
    summary: 'The history of the National Cadet Corps.',
    detail: 'The NCC’s history includes changes to its organization, training, and role.',
  },
  {
    title: 'Motto & Core Values', icon: Users,
    summary: 'Reflect on the principles that shape conduct, service, and teamwork.',
    detail: 'Unity and Discipline is the NCC motto. The values are reflected in collective effort, responsible leadership, respect, and service.',
  },
];

export const KnowledgeHub: React.FC = () => {
  const [openTopic, setOpenTopic] = useState<string | null>(null);

  return (
    <section className="knowledge-hub section-py" id="knowledge-hub" aria-labelledby="knowledge-hub-title">
      <div className="knowledge-hub-inner">
        <div className="knowledge-hub-heading">
          <span className="knowledge-hub-kicker">LEARN • LEAD • SERVE</span>
          <h2 id="knowledge-hub-title">NCC Knowledge Hub</h2>
        </div>
        <div className="knowledge-topic-grid">
          {topics.map(({ title, icon: Icon, summary, detail }) => {
            const expanded = openTopic === title;
            const panelId = `knowledge-topic-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
            return (
              <article className={`knowledge-topic-card${expanded ? ' is-expanded' : ''}`} key={title}>
                <button
                  className="knowledge-topic-toggle"
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={() => setOpenTopic(expanded ? null : title)}
                >
                  <span className="knowledge-topic-icon" aria-hidden="true"><Icon size={20} /></span>
                  <span className="knowledge-topic-copy">
                    <span className="knowledge-topic-title">{title}</span>
                    <span className="knowledge-topic-summary">{summary}</span>
                  </span>
                  <span className="knowledge-topic-chevron" aria-hidden="true">{expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</span>
                </button>
                <div className="knowledge-topic-detail" id={panelId} hidden={!expanded}>
                  <p>{detail}</p>
                </div>
              </article>
            );
          })}
        </div>
        <RankExplorer />
      </div>
    </section>
  );
};
