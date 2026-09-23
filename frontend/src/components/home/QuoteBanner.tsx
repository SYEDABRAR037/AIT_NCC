import React from 'react';

export const QuoteBanner: React.FC = () => {
  return (
    <section className="ref-quote-banner-section" aria-label="NCC Creed and Motto">
      <div className="ref-quote-banner-container">
        {/* Left: Inspiring Military Quote */}
        <div className="ref-quote-left">
          <span className="ref-quote-mark">&ldquo;</span>
          <blockquote className="ref-quote-text">
            The true soldier fights not because <br />
            he hates what is in front of him, <br />
            but because he loves what is behind him.
          </blockquote>
          <div className="ref-quote-author">
            &mdash; NCC Motto &bull; Unity and Discipline
          </div>
        </div>

        {/* Right: Onward to Glory & Mountain Graphic with Indian Tricolor */}
        <div className="ref-quote-right">
          <div className="ref-quote-callout">
            <h3 className="ref-onward-title">Onward to Glory</h3>
            <div className="ref-tricolor-bar">
              <span className="ref-tricolor-saffron" />
              <span className="ref-tricolor-white" />
              <span className="ref-tricolor-green" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
