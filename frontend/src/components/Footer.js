import React from 'react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <p className="site-footer-copyright">
        &copy; {currentYear} USLS-IS Golden Batch 2003
      </p>
      <p className="site-footer-credits">
        Concept: Organizing Committee | Design: William Kramer &amp; Felie Magbanua | Development: Felie Magbanua
      </p>
    </footer>
  );
}
