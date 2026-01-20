import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <p className="site-footer-copyright">
        &copy; {currentYear} USLS-IS Golden Batch 2003
      </p>
      <p className="site-footer-credits">
        Concept: <Link to="/committee" className="site-footer-link">Organizing Committee</Link>
        <span className="site-footer-separator"> | </span>
        Design: <Link to="/directory?search=William%20Kramer" className="site-footer-link">William Kramer</Link>
        {' & '}
        <Link to="/directory?search=Felie%20Magbanua" className="site-footer-link">Felie Magbanua</Link>
        <span className="site-footer-separator"> | </span>
        Development: <Link to="/directory?search=Felie%20Magbanua" className="site-footer-link">Felie Magbanua</Link>
      </p>
    </footer>
  );
}
