
import { site } from './site';

export function absUrl(path = '/'): string {
  if (path.startsWith('http')) return path;
  return new URL(path, site.url).href;
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'NGO'],
    '@id': absUrl('/#organization'),
    name: site.name,
    alternateName: site.shortName,
    url: site.url,
    logo: {
      '@type': 'ImageObject',
      url: absUrl(site.logo),
      width: 350,
      height: 120,
    },
    image: absUrl(site.ogImage),
    telephone: site.phone,
    email: site.email,
    address: {
      '@type': 'PostalAddress',
      addressRegion: site.address.region,
      addressLocality: site.address.locality,
      streetAddress: site.address.street,
      addressCountry: 'JP',
    },
    areaServed: {
      '@type': 'AdministrativeArea',
      name: '関東地方',
    },
    founder: {
      '@type': 'Person',
      name: site.representative,
      jobTitle: '代表理事',
    },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: site.phone,
        contactType: 'customer service',
        availableLanguage: ['Japanese'],
        areaServed: 'JP',
      },
      {
        '@type': 'ContactPoint',
        telephone: site.phoneFree,
        contactType: 'customer service',
        contactOption: 'TollFree',
        availableLanguage: ['Japanese'],
        areaServed: 'JP',
      },
    ],
    sameAs: [
      'https://shukatsu.or.jp/',
      'https://profile.ameba.jp/ameba/shukatsu-concierge/',
    ],
  };
}

export function webSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': absUrl('/#website'),
    name: site.shortName,
    url: site.url,
    inLanguage: 'ja',
    publisher: { '@id': absUrl('/#organization') },
    description: site.description,
  };
}

export function breadcrumbJsonLd(
  items: { name: string; path?: string }[],
) {
  const list = [{ name: 'ホーム', path: '/' }, ...items];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: list.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      ...(item.path
        ? { item: absUrl(item.path) }
        : {}),
    })),
  };
}

export function faqPageJsonLd(
  faqs: { question: string; answer: string }[],
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': absUrl('/faq/#faq'),
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.answer.replace(/\s+/g, ' ').trim(),
      },
    })),
    isPartOf: { '@id': absUrl('/#website') },
    publisher: { '@id': absUrl('/#organization') },
  };
}

export function articleJsonLd(opts: {
  title: string;
  description: string;
  path: string;
  datePublished: Date | string;
  dateModified?: Date | string;
  image?: string;
}) {
  const published =
    typeof opts.datePublished === 'string'
      ? opts.datePublished
      : opts.datePublished.toISOString();
  const modified = opts.dateModified
    ? typeof opts.dateModified === 'string'
      ? opts.dateModified
      : opts.dateModified.toISOString()
    : published;

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: opts.title,
    description: opts.description,
    image: [absUrl(opts.image ?? site.ogImage)],
    datePublished: published,
    dateModified: modified,
    author: {
      '@type': 'Organization',
      name: site.name,
      url: site.url,
    },
    publisher: {
      '@type': 'Organization',
      name: site.name,
      logo: {
        '@type': 'ImageObject',
        url: absUrl(site.logo),
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': absUrl(opts.path),
    },
    inLanguage: 'ja',
  };
}

export function professionalServiceJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': absUrl('/#service'),
    name: site.name,
    url: site.url,
    image: absUrl(site.ogImage),
    telephone: site.phone,
    email: site.email,
    address: {
      '@type': 'PostalAddress',
      addressRegion: site.address.region,
      addressLocality: site.address.locality,
      streetAddress: site.address.street,
      addressCountry: 'JP',
    },
    priceRange: '¥¥',
    description: site.description,
    parentOrganization: { '@id': absUrl('/#organization') },
  };
}
