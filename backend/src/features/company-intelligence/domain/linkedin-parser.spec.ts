import {
  normalizeLinkedInCompanyUrl,
  validateAndCleanWebsiteUrl,
  extractWebsiteFromLinkedInHtml,
} from './linkedin-parser';

describe('linkedin-parser', () => {
  describe('normalizeLinkedInCompanyUrl', () => {
    it('should normalize basic company URLs', () => {
      expect(normalizeLinkedInCompanyUrl('https://www.linkedin.com/company/abg-pocket')).toBe(
        'https://www.linkedin.com/company/abg-pocket',
      );
    });

    it('should strip /about suffix', () => {
      expect(
        normalizeLinkedInCompanyUrl('https://www.linkedin.com/company/addie-soft-ltd/about/'),
      ).toBe('https://www.linkedin.com/company/addie-soft-ltd');
    });

    it('should strip query params and hashes', () => {
      expect(
        normalizeLinkedInCompanyUrl(
          'https://linkedin.com/company/theantopolis/?viewAsMember=true#overview',
        ),
      ).toBe('https://linkedin.com/company/theantopolis');
    });

    it('should handle missing protocol', () => {
      expect(normalizeLinkedInCompanyUrl('linkedin.com/company/foobar/')).toBe(
        'https://linkedin.com/company/foobar',
      );
    });

    it('should return empty string on invalid/empty inputs', () => {
      expect(normalizeLinkedInCompanyUrl('')).toBe('');
      // @ts-expect-error test invalid types
      expect(normalizeLinkedInCompanyUrl(null)).toBe('');
    });
  });

  describe('validateAndCleanWebsiteUrl', () => {
    it('should clean valid https URL and remove tracking parameters', () => {
      const input = 'https://addiesoft.com/?utm_source=linkedin&utm_campaign=profile';
      expect(validateAndCleanWebsiteUrl(input)).toBe('https://addiesoft.com/');
    });

    it('should reject excluded social and search engine domains', () => {
      expect(validateAndCleanWebsiteUrl('https://www.linkedin.com/company/test')).toBeNull();
      expect(validateAndCleanWebsiteUrl('https://facebook.com/testpage')).toBeNull();
      expect(validateAndCleanWebsiteUrl('https://google.com/search')).toBeNull();
      expect(validateAndCleanWebsiteUrl('https://schema.org/Organization')).toBeNull();
    });

    it('should reject invalid schemes or malformed strings', () => {
      expect(validateAndCleanWebsiteUrl('javascript:alert(1)')).toBeNull();
      expect(validateAndCleanWebsiteUrl('mailto:hr@company.com')).toBeNull();
      expect(validateAndCleanWebsiteUrl('')).toBeNull();
    });
  });

  describe('extractWebsiteFromLinkedInHtml', () => {
    it('should extract website from data-test-id="about-us__website" redirect URL', () => {
      const sampleHtml = `
        <div class="org-grid__content-height-enforcer">
          <dt class="mb1 text-heading-small">Website</dt>
          <dd class="mb4 t-black--light text-body-medium" data-test-id="about-us__website">
            <a href="https://www.linkedin.com/redir/redirect?url=https%3A%2F%2Fwww%2Eaddiesoft%2Ecom&amp;urlhash=a1b2" target="_blank" class="link-without-visited-state">
              https://www.addiesoft.com
            </a>
          </dd>
        </div>
      `;
      expect(extractWebsiteFromLinkedInHtml(sampleHtml)).toBe('https://www.addiesoft.com/');
    });

    it('should extract website from anchor text when redirect url is absent', () => {
      const sampleHtml = `
        <dd data-test-id="about-us__website">
          <a href="#">http://altersense.com</a>
        </dd>
      `;
      expect(extractWebsiteFromLinkedInHtml(sampleHtml)).toBe('http://altersense.com/');
    });

    it('should fallback to data-tracking-control-name="about_website"', () => {
      const sampleHtml = `
        <div class="about-section">
          <a data-tracking-control-name="about_website" href="https://www.linkedin.com/redir/redirect?url=https%3A%2F%2Ftheantopolis%2Ecom">
            Visit website
          </a>
        </div>
      `;
      expect(extractWebsiteFromLinkedInHtml(sampleHtml)).toBe('https://theantopolis.com/');
    });

    it('should extract website from JSON-LD Schema', () => {
      const sampleHtml = `
        <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "Acme Corp",
              "url": "https://acme.org"
            }
          </script>
        </head>
        <body></body>
        </html>
      `;
      expect(extractWebsiteFromLinkedInHtml(sampleHtml)).toBe('https://acme.org/');
    });

    it('should return null when no valid company website is present', () => {
      const sampleHtml = `
        <html>
        <body>
          <div>Login to LinkedIn</div>
          <a href="https://www.linkedin.com/help">Help</a>
        </body>
        </html>
      `;
      expect(extractWebsiteFromLinkedInHtml(sampleHtml)).toBeNull();
    });
  });
});
