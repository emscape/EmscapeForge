import React from 'react';

export default function PresentationEmbed({ title, slug, date }) {
  return (
    <div className="presentation-card">
      <h2>{title}</h2>
      <div className="metadata">
        <time dateTime={date}>{new Date(date).toLocaleDateString()}</time>
        <span>Slug: {slug}</span>
      </div>
      <div className="embed-container">
        <iframe
          src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(`/presentations/${slug}.pptx`)}`}
          width="100%"
          height="100%"
          frameBorder="0"
          title={`${title} PowerPoint Presentation`}
          allowFullScreen
        />
      </div>
    </div>
  );
}