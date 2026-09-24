'use client';

import { useEffect } from 'react';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { B2BBand, Faq, Features, HowItWorks, ProductKnowledge, SportsMarquee, Testimonials } from '@/components/Sections';
import { CTA, Footer } from '@/components/CTA';
import { BRAND, FAQS } from '@/lib/content';

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

export default function HomePage() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('reveal--visible'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal--visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <a href="#main" className="skip-link">Lewati ke konten utama</a>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <Header />
      <main id="main">
        <Hero />
        <SportsMarquee />
        <Features />
        <ProductKnowledge />
        <HowItWorks />
        <B2BBand />
        <Testimonials />
        <Faq />
        <CTA />
      </main>
      <Footer />
      <p className="visually-hidden">{BRAND.name} — {BRAND.tagline}.</p>
    </>
  );
}
