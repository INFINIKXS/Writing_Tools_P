import asyncio
import time
import httpx
import logging
from dataclasses import dataclass, field
from typing import Optional
from tenacity import (
    retry, stop_after_attempt,
    wait_exponential, retry_if_exception_type
)

logger = logging.getLogger(__name__)

import os
from core.config import PUBMED_EMAIL

CR_BASE = 'https://api.crossref.org'
MAILTO = os.environ.get("CROSSREF_MAILTO", PUBMED_EMAIL or 'biskmem@gmail.com')
HEADERS = {'User-Agent': f'WritingTools/1.0 (mailto:{MAILTO})'}

@dataclass
class MetadataRecord:
    source:       str
    title:        str = ''
    authors:      list[str] = field(default_factory=list)
    journal:      str = ''
    year:         Optional[int] = None
    doi:          Optional[str] = None
    pmid:         Optional[str] = None
    abstract:     str = ''
    url:          Optional[str] = None
    open_access:  bool = False
    citations:    Optional[int] = None
    volume:       Optional[str] = None
    issue:        Optional[str] = None
    pages:        Optional[str] = None
    publisher:    Optional[str] = None
    type:         str = 'Journal Article'

class TokenBucket:
    def __init__(self, rate=5, capacity=5):
        self.rate = rate          # tokens added per second
        self.capacity = capacity  # max burst
        self.tokens = capacity
        self.last_refill = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self):
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self.last_refill
            self.tokens = min(
                self.capacity,
                self.tokens + elapsed * self.rate
            )
            self.last_refill = now
            if self.tokens < 1:
                wait = (1 - self.tokens) / self.rate
                await asyncio.sleep(wait)
                self.tokens = 0
                self.last_refill = time.monotonic()
            else:
                self.tokens -= 1

# Shared rate limiter across all batch API outbound requests
rate_limiter = TokenBucket(rate=5, capacity=5)

@retry(
    retry=retry_if_exception_type(httpx.HTTPStatusError),
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=1, max=60),
    reraise=True
)
async def safe_get(client: httpx.AsyncClient, url: str, params=None, headers=None):
    r = await client.get(url, params=params, headers=headers)
    if r.status_code == 429:
        retry_after = int(r.headers.get('Retry-After', 10))
        logger.warning(f"429 Too Many Requests from {url}. Retrying after {retry_after}s.")
        await asyncio.sleep(retry_after)
        r.raise_for_status()
    r.raise_for_status()
    return r

def normalise_crossref(msg: dict) -> MetadataRecord:
    authors = []
    for a in msg.get('author', []):
        family = a.get('family', '')
        given = a.get('given', '')
        if family and given:
            # Initials formatting to match our existing expected schema
            initials = ". ".join(w[0].upper() for w in given.split() if w) + "."
            authors.append(f"{family}, {initials}")
        elif family:
            authors.append(family)
        elif given:
            authors.append(given)

    date_parts = (msg.get('issued', {}).get('date-parts') or [[]])[0]
    year = date_parts[0] if date_parts else None
    
    return MetadataRecord(
        source='crossref',
        title=(msg.get('title') or [''])[0],
        authors=authors, 
        year=year,
        doi=msg.get('DOI', '').lower() if msg.get('DOI') else None,
        journal=(msg.get('container-title') or [''])[0],
        url=msg.get('URL'),
        citations=msg.get('is-referenced-by-count'),
        open_access='license' in msg,
        volume=msg.get('volume'),
        issue=msg.get('issue'),
        pages=msg.get('page'),
        publisher=msg.get('publisher'),
        type=msg.get('type', 'Journal Article')
    )

async def fetch_one_doi(client: httpx.AsyncClient, doi: str) -> Optional[MetadataRecord]:
    await rate_limiter.acquire()
    url = f'{CR_BASE}/works/{doi}?mailto={MAILTO}'
    try:
        r = await safe_get(client, url, headers=HEADERS)
        data = r.json()['message']
        return normalise_crossref(data)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return None
        logger.error(f"HTTPError fetching DOI {doi}: {e}")
        return None
    except Exception as e:
        logger.error(f"Error fetching DOI {doi}: {e}")
        return None

async def fetch_crossref_batch(dois: list[str], client: Optional[httpx.AsyncClient] = None) -> list[MetadataRecord]:
    """Fetch multiple DOIs concurrently via the TokenBucket."""
    if client:
        tasks = [fetch_one_doi(client, doi) for doi in dois]
        results = await asyncio.gather(*tasks, return_exceptions=True)
    else:
        async with httpx.AsyncClient(timeout=30) as new_client:
            tasks = [fetch_one_doi(new_client, doi) for doi in dois]
            results = await asyncio.gather(*tasks, return_exceptions=True)
        
    valid_results = []
    for r in results:
        if r and not isinstance(r, Exception):
            valid_results.append(r)
    return valid_results


def normalise_pubmed(article) -> Optional[MetadataRecord]:
    """Parse a single PubmedArticle XML node into a MetadataRecord."""
    import defusedxml.ElementTree as ET  # SEC: defusedxml prevents XXE attacks
    import re
    
    doi_el = article.find(".//ArticleIdList/ArticleId[@IdType='doi']")
    if doi_el is None or not doi_el.text:
        return None
    doi = doi_el.text.strip().lower()

    title = article.findtext(".//ArticleTitle")
    
    # Authors list
    authors = []
    for a in article.findall(".//AuthorList/Author"):
        last = a.findtext("LastName", "")
        fore = a.findtext("ForeName", "")
        if last and fore:
            initials = ". ".join(w[0].upper() for w in fore.split() if w) + "."
            authors.append(f"{last}, {initials}")
        elif last:
            authors.append(last)
        elif fore:
            authors.append(fore)
            
    # Year
    year_el = article.find(".//JournalIssue/PubDate/Year")
    year = int(year_el.text) if year_el is not None and year_el.text else None
    if not year:
        # Fallback to MedlineDate parsing e.g. "2020 Sep-Oct"
        medline_date = article.findtext(".//JournalIssue/PubDate/MedlineDate")
        if medline_date:
            m = re.search(r'\b((?:19|20)\d{2})\b', medline_date)
            if m:
                year = int(m.group(1))

    journal_title = article.findtext(".//Journal/Title") or article.findtext(".//Journal/ISOAbbreviation")
    volume = article.findtext(".//JournalIssue/Volume")
    issue = article.findtext(".//JournalIssue/Issue")
    pages = article.findtext(".//Pagination/MedlinePgn")

    # Fallback for pages
    if not pages:
        eloc = article.find(".//ELocationID")
        if eloc is not None and eloc.text:
            pages = eloc.text
            
    return MetadataRecord(
        source='pubmed',
        title=title or '',
        authors=authors,
        year=year,
        doi=doi,
        journal=journal_title or '',
        volume=volume,
        issue=issue,
        pages=pages,
        type='Journal Article'
    )


async def fetch_pubmed_batch(dois: list[str], client: Optional[httpx.AsyncClient] = None) -> list[MetadataRecord]:
    """Fetch multiple DOIs concurrently or in bulk from PubMed E-utilities."""
    if not dois:
        return []
        
    from core.config import NCBI_API_KEY, PUBMED_EMAIL
    import defusedxml.ElementTree as ET  # SEC: defusedxml prevents XXE attacks

    unique_dois = list(set(d.strip().lower() for d in dois if d.strip()))
    if not unique_dois:
        return []

    # Step 1: Resolve DOIs to PMIDs using esearch (POST method to avoid URL length issues)
    search_term = " OR ".join(f"{doi}[Location ID]" for doi in unique_dois)
    params = {
        "db": "pubmed",
        "term": search_term,
        "retmode": "json",
        "retmax": len(unique_dois)
    }
    if NCBI_API_KEY:
        params["api_key"] = NCBI_API_KEY
    if PUBMED_EMAIL:
        params["email"] = PUBMED_EMAIL

    async def run_search(c: httpx.AsyncClient):
        logger.info(f"Querying PubMed esearch for {len(unique_dois)} DOIs")
        res = await c.post("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi", data=params)
        res.raise_for_status()
        return res.json().get("esearchresult", {}).get("idlist", [])

    try:
        if client:
            pmids = await run_search(client)
        else:
            async with httpx.AsyncClient(timeout=30) as new_client:
                pmids = await run_search(new_client)
        
        if not pmids:
            return []

        # Step 2: Fetch XML for all resolved PMIDs
        fetch_params = {
            "db": "pubmed",
            "id": ",".join(pmids),
            "retmode": "xml"
        }
        if NCBI_API_KEY:
            fetch_params["api_key"] = NCBI_API_KEY
        if PUBMED_EMAIL:
            fetch_params["email"] = PUBMED_EMAIL

        async def run_fetch(c: httpx.AsyncClient):
            logger.info(f"Querying PubMed efetch for {len(pmids)} PMIDs")
            res = await c.post("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi", data=fetch_params)
            res.raise_for_status()
            return res.text

        if client:
            xml_text = await run_fetch(client)
        else:
            async with httpx.AsyncClient(timeout=30) as new_client:
                xml_text = await run_fetch(new_client)

        # Step 3: Parse XML and construct records
        root = ET.fromstring(xml_text)
        records = []
        for article in root.findall(".//PubmedArticle"):
            rec = normalise_pubmed(article)
            if rec:
                records.append(rec)
        return records

    except Exception as e:
        logger.error(f"Error fetching PubMed batch: {e}")
        return []
