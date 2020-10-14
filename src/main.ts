import { Browser, launch, Page } from 'puppeteer';
import { load } from 'cheerio';
import { format, startOfToday, startOfYesterday, subDays } from 'date-fns';

type UserAction = {
  who: string;
  when: string;
  what: string;
  link: string;
};

function buildURL(link: string): string {
  const ROOT_URL = 'https://www.dofus.com';
  return `${ROOT_URL}${link}`;
}

function buildCosaGuildURL(): string {
  const URl_COSA = `/pt/mmorpg/comunidade/anuarios/paginas-guildas/201900202-cosa-nostra`;
  return buildURL(URl_COSA);
}

async function getContent(page: Page, url: string): Promise<string> {
  await page.goto(url);
  return page.content();
}

function getEventsHtmlContent(html: string): string[] {
  const selector = `div[class="ak-character-actions"] > 
                    div[class="ak-actions"] > 
                    div[class="ak-actions-list"] > 
                    div[class*="ak-container ak-content-list"] > 
                    div[class="ak-list-element"]`;

  const $ = load(html);
  const events: string[] = [];
  $(selector).each(function (_, element) {
    const event: string = $(element).html() as string;
    events.push(event);
  });
  return events;
}

function transformHtmlToEvent(events: string[]): UserAction[] {
  const transformTextToDate = (when: string): string => {
    let date = null;
    if (when.includes('hoje')) {
      date = startOfToday();
    } else if (when.includes('ontem')) {
      date = startOfYesterday();
    } else {
      const daysAgo = Number(when.replace(/\D/g, ''));
      date = subDays(startOfToday(), daysAgo);
    }
    return format(date, 'dd/MM/yyyy');
  };

  return events.map((event) => {
    const $ = load(event);
    const when = transformTextToDate($('span[class="date"]').text());
    const action = $('a[class="lien_action"]');
    const who = action.text();
    const link = `${buildURL(action.attr('href') as string)}`;
    const what = $('.ak-title').text().includes('uniu') ? 'ENTROU' : 'SAIU';

    return {
      who,
      when,
      what,
      link,
    };
  });
}

async function main() {
  const browser: Browser = await launch();
  try {
    const page: Page = await browser.newPage();
    const content: string = await getContent(page, buildCosaGuildURL());
    const events = transformHtmlToEvent(getEventsHtmlContent(content));
    console.log(events);
  } catch (e) {
    console.error(e);
  } finally {
    await browser.close();
  }
}

(async () => await main())();
