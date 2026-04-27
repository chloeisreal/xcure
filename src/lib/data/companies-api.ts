import { cacheGet, cacheSet, cacheKey } from '../data/cache';

const COMPANIES_API_URL = 'https://api.thecompaniesapi.com/v1';
const COMPANIES_API_KEY = process.env.COMPANIES_API_KEY;

export interface CompanyData {
  name: string;
  domain?: string;
  description?: string;
  industry?: string;
  size?: string;
  founded?: number;
  location?: string;
  website?: string;
  linkedin?: string;
  facebook?: string;
  twitter?: string;
}

export async function searchCompany(query: string): Promise<CompanyData | null> {
  if (!COMPANIES_API_KEY) {
    return null;
  }

  const cacheKeyName = cacheKey('companies-api', query.toLowerCase());
  const cached = await cacheGet<CompanyData>(cacheKeyName);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(`${COMPANIES_API_URL}/search?domain=${encodeURIComponent(query)}`, {
      headers: {
        'Authorization': `Bearer ${COMPANIES_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.log('[Companies API] Error:', response.status);
      return null;
    }

    const data = await response.json();
    
    if (!data.companies || data.companies.length === 0) {
      return null;
    }

    const company = data.companies[0];
    const result: CompanyData = {
      name: company.name,
      domain: company.domain,
      description: company.short_description,
      industry: company.industry,
      size: company.size,
      founded: company.year_founded,
      location: company.city,
      website: company.website_url,
      linkedin: company.linkedin_url,
      facebook: company.facebook_url,
      twitter: company.twitter_url,
    };

    await cacheSet(cacheKeyName, result, 604800);
    return result;
  } catch (error) {
    console.error('[Companies API] Error:', error);
    return null;
  }
}

export async function getCompanyByDomain(domain: string): Promise<CompanyData | null> {
  if (!COMPANIES_API_KEY) {
    return null;
  }

  const cacheKeyName = cacheKey('companies-api', domain.toLowerCase());
  const cached = await cacheGet<CompanyData>(cacheKeyName);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(`${COMPANIES_API_URL}/domain/${encodeURIComponent(domain)}`, {
      headers: {
        'Authorization': `Bearer ${COMPANIES_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    const result: CompanyData = {
      name: data.name,
      domain: data.domain,
      description: data.short_description,
      industry: data.industry,
      size: data.size,
      founded: data.year_founded,
      location: data.city,
      website: data.website_url,
      linkedin: data.linkedin_url,
      facebook: data.facebook_url,
      twitter: data.twitter_url,
    };

    await cacheSet(cacheKeyName, result, 604800);
    return result;
  } catch (error) {
    console.error('[Companies API] Error:', error);
    return null;
  }
}