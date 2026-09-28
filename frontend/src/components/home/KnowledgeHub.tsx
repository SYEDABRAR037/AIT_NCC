import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, Compass, Flag, Medal, Mountain, Shield, Sparkles, Users } from 'lucide-react';
import './KnowledgeHub.css';
import { RankExplorer } from './RankExplorer';

const topics = [
  {
    title: 'NCC Basics', icon: Shield,
    summary: 'A starting point for understanding the National Cadet Corps and cadet life.',
    detail: 'Explore the Corps, its organization, the cadet experience, and the values that guide training. Use this overview as a starting point and follow official NCC material for current rules and instructions.',
  },
  {
    title: 'Ranks', icon: Medal,
    summary: 'Understand cadet appointments and the leadership responsibilities they represent.',
    detail: 'Rank appointments give cadets opportunities to practice responsibility, teamwork, and leadership. Titles and structures can differ by division and wing; follow your unit’s current instructions.',
  },
  {
    title: 'Badges & Insignia', icon: Sparkles,
    summary: 'A guide to learning the purpose of uniform badges and insignia.',
    detail: 'Uniform insignia communicate identity, appointment, and achievement. This hub introduces the topic; always consult approved uniform guidance for exact placement and wear.',
  },
  {
    title: 'Drill & Training', icon: Compass,
    summary: 'Explore the skills and habits developed through structured training.',
    detail: 'Training can include drill, fitness, field skills, and shared learning. Activities and schedules are determined by the relevant unit and current training plan.',
  },
  {
    title: 'Camps', icon: Mountain,
    summary: 'Learn how camps bring cadets together for focused training and exchange.',
    detail: 'Camps provide opportunities for collective learning and experience. Camp names, eligibility, dates, and selection processes vary; check official notices for current details.',
  },
  {
    title: 'Certificates', icon: BookOpen,
    summary: 'Get oriented to the NCC certificate learning pathway.',
    detail: 'Certificate requirements and examinations are governed by current NCC directions. Your instructors and official training material are the source for eligibility, syllabus, and examination details.',
  },
  {
    title: 'NCC History', icon: Flag,
    summary: 'Discover the story and development of the National Cadet Corps.',
    detail: 'Use this topic to explore how the Corps developed and how its role has evolved. Refer to official NCC resources for dates, milestones, and historical detail.',
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
          <p>A concise guide to NCC learning, training, and cadet life.</p>
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
        <p className="knowledge-hub-note">For current instructions, eligibility, and official uniform guidance, follow your NCC unit and authorized NCC publications.</p>
        <RankExplorer />
      </div>
    </section>
  );
};
